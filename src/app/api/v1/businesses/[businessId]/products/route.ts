import { prisma } from "@/lib/db";
import { authorizeBusiness } from "@/server/auth/authorization";
import { errorResponse, unexpectedError } from "@/server/http";
import { productSchema } from "@/server/validators/domain";

type Context = { params: Promise<{ businessId: string }> };

export async function GET(_request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;
  const products = await prisma.product.findMany({ where: { businessId, deletedAt: null }, orderBy: { name: "asc" }, take: 100 });
  return Response.json({ items: products });
}

export async function POST(request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;
  const parsed = productSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "Datos inválidos.", parsed.error.flatten());

  try {
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({ data: { businessId, ...parsed.data } });
      if (parsed.data.stock > 0) {
        await tx.inventoryMovement.create({ data: { businessId, productId: created.id, type: "INITIAL", quantity: parsed.data.stock, reason: "Initial stock" } });
      }
      return created;
    });
    return Response.json(product, { status: 201 });
  } catch {
    return unexpectedError();
  }
}