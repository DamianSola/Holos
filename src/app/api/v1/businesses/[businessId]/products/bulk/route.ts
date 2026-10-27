import { prisma } from "@/lib/db";
import { authorizeBusiness } from "@/server/auth/authorization";
import { errorResponse, unexpectedError } from "@/server/http";
import { z } from "zod";

type Context = { params: Promise<{ businessId: string }> };

const bodySchema = z.object({
  action: z.enum(["archive", "archive-empty", "delete"]),
}).strict();

export async function POST(request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "Datos inválidos.", parsed.error.flatten());

  const business = await prisma.business.findFirst({ where: { id: businessId, deletedAt: null }, select: { kind: true } });
  if (!business) return errorResponse(404, "BUSINESS_NOT_FOUND", "El negocio no existe.");
  const where = {
    businessId,
    deletedAt: null,
    catalogKind: business.kind === "SERVICE" ? { in: ["SUPPLY" as const, "TOOL" as const] } : "PRODUCT" as const,
  };

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (parsed.data.action !== "delete") {
        const updated = await tx.product.updateMany({
          where: parsed.data.action === "archive-empty" ? { ...where, stock: 0 } : where,
          data: { status: "ARCHIVED", deletedAt: new Date() },
        });
        return { archived: updated.count, deleted: 0 };
      }

      const products = await tx.product.findMany({ where, select: { id: true } });
      const ids = products.map((product) => product.id);
      if (ids.length === 0) return { archived: 0, deleted: 0 };
      const [sales, orders, bookings] = await Promise.all([
        tx.saleItem.findMany({ where: { productId: { in: ids } }, select: { productId: true }, distinct: ["productId"] }),
        tx.orderItem.findMany({ where: { productId: { in: ids } }, select: { productId: true }, distinct: ["productId"] }),
        tx.customerOrder.findMany({ where: { productId: { in: ids } }, select: { productId: true }, distinct: ["productId"] }),
      ]);
      const blocked = new Set([...sales, ...orders, ...bookings].map((row) => row.productId).filter((id): id is string => Boolean(id)));
      const removable = ids.filter((id) => !blocked.has(id));
      const kept = ids.filter((id) => blocked.has(id));
      await eachSlice(removable, (slice) => tx.inventoryMovement.deleteMany({ where: { productId: { in: slice } } }));
      await eachSlice(removable, (slice) => tx.product.deleteMany({ where: { id: { in: slice } } }));
      if (kept.length > 0) {
        await eachSlice(kept, (slice) => tx.product.updateMany({ where: { id: { in: slice } }, data: { status: "ARCHIVED", deletedAt: new Date() } }));
      }
      return { archived: kept.length, deleted: removable.length };
    }, { timeout: 20000 });
    return Response.json(result);
  } catch {
    return unexpectedError();
  }
}

async function eachSlice(ids: string[], run: (slice: string[]) => Promise<unknown>) {
  for (let index = 0; index < ids.length; index += 400) await run(ids.slice(index, index + 400));
}
