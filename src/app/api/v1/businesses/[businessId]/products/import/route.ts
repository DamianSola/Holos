import { prisma } from "@/lib/db";
import { markExisting, parseProductTable, readyRows, type ImportMode, type ImportRow } from "@/lib/product-import";
import { authorizeBusiness } from "@/server/auth/authorization";
import { errorResponse, unexpectedError } from "@/server/http";
import { productSchema, stockItemSchema } from "@/server/validators/domain";
import { z } from "zod";

type Context = { params: Promise<{ businessId: string }> };
type ImportRecord = { name: string; catalogKind: "PRODUCT" | "SUPPLY" | "TOOL"; category: string | null; description: string | null; priceMinor: number; costMinor: number | null; stock: number; minimumStock: number };

function recordFromRow(row: ImportRow, mode: ImportMode): ImportRecord | null {
  if (mode === "stock") {
    const parsed = stockItemSchema.safeParse({
      name: row.name,
      catalogKind: row.catalogKind,
      description: row.description || undefined,
      costMinor: row.costMinor ?? undefined,
      stock: row.stock ?? 0,
      minimumStock: row.minimumStock,
    });
    if (!parsed.success || parsed.data.catalogKind === undefined) return null;
    return { name: parsed.data.name, catalogKind: parsed.data.catalogKind, category: null, description: parsed.data.description ?? null, priceMinor: 0, costMinor: parsed.data.costMinor ?? null, stock: parsed.data.stock, minimumStock: parsed.data.minimumStock };
  }
  const parsed = productSchema.safeParse({
    name: row.name,
    category: row.category || undefined,
    description: row.description || undefined,
    priceMinor: row.priceMinor ?? 0,
    costMinor: row.costMinor ?? undefined,
    stock: row.stock ?? 0,
    minimumStock: row.minimumStock,
  });
  if (!parsed.success) return null;
  return { name: parsed.data.name, catalogKind: "PRODUCT", category: parsed.data.category ?? null, description: parsed.data.description ?? null, priceMinor: parsed.data.priceMinor, costMinor: parsed.data.costMinor ?? null, stock: parsed.data.stock, minimumStock: parsed.data.minimumStock };
}

const bodySchema = z.object({
  text: z.string().max(100_000),
  commit: z.boolean(),
}).strict();

export async function POST(request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;

  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) return errorResponse(400, "VALIDATION_ERROR", "Datos inválidos.", parsedBody.error.flatten());

  const business = await prisma.business.findFirst({ where: { id: businessId, deletedAt: null }, select: { kind: true } });
  if (!business) return errorResponse(404, "BUSINESS_NOT_FOUND", "El negocio no existe.");
  const mode: ImportMode = business.kind === "SERVICE" ? "stock" : "catalog";
  const parsed = parseProductTable(parsedBody.data.text, mode);

  try {
    const existing = await prisma.product.findMany({
      where: { businessId, deletedAt: null },
      select: { name: true },
    });
    const rows = markExisting(parsed.rows, existing.map((product) => product.name));
    const ready = readyRows(rows);
    if (!parsedBody.data.commit) {
      return Response.json({ mode, truncated: parsed.truncated, ignored: parsed.ignored, rows, ready: ready.length });
    }
    if (ready.length === 0) return errorResponse(422, "NOTHING_TO_IMPORT", "No hay filas listas para guardar.");
    const records = ready.flatMap((row) => {
      const record = recordFromRow(row, mode);
      return record ? [record] : [];
    });
    if (records.length !== ready.length) return errorResponse(422, "NOTHING_TO_IMPORT", "Hay filas que no se pueden guardar.");

    const created = await prisma.$transaction(async (tx) => {
      const current = await tx.product.findMany({ where: { businessId, deletedAt: null }, select: { name: true } });
      const seen = new Set(current.map((product) => product.name.trim().toLocaleLowerCase("es")));
      let count = 0;
      for (const record of records) {
        const key = record.name.trim().toLocaleLowerCase("es");
        if (seen.has(key)) continue;
        const product = await tx.product.create({
          data: {
            businessId,
            name: record.name,
            catalogKind: record.catalogKind,
            category: record.category,
            description: record.description,
            priceMinor: record.priceMinor,
            costMinor: record.costMinor,
            stock: record.stock,
            minimumStock: record.minimumStock,
          },
        });
        if (record.stock > 0) {
          await tx.inventoryMovement.create({
            data: { businessId, productId: product.id, type: "INITIAL", quantity: record.stock, reason: "Stock inicial" },
          });
        }
        seen.add(key);
        count += 1;
      }
      return count;
    }, { timeout: 20000 });

    const skipped = rows.filter((row) => row.error === "Ya está en el negocio" || row.error === "Repetido en la lista").length;
    return Response.json({ created, skipped, rejected: rows.length - ready.length });
  } catch {
    return unexpectedError();
  }
}
