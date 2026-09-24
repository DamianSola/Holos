import { prisma } from "@/lib/db";
import { authorizeBusiness } from "@/server/auth/authorization";
import { errorResponse, unexpectedError } from "@/server/http";
import { businessIdSchema, inventoryAdjustmentSchema } from "@/server/validators/domain";

type Context = { params: Promise<{ businessId: string; productId: string }> };

export async function POST(request: Request, context: Context) {
  const { businessId, productId } = await context.params;
  if (!businessIdSchema.safeParse(businessId).success || !businessIdSchema.safeParse(productId).success) return errorResponse(400, "INVALID_PRODUCT_ID", "El producto no es válido.");
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;
  const parsed = inventoryAdjustmentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "Datos inválidos.", parsed.error.flatten());

  try {
    const product = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.updateMany({
        where: { id: productId, businessId, status: "ACTIVE", deletedAt: null, ...(parsed.data.quantity < 0 ? { stock: { gte: Math.abs(parsed.data.quantity) } } : {}) },
        data: parsed.data.quantity > 0 ? { stock: { increment: parsed.data.quantity } } : { stock: { decrement: Math.abs(parsed.data.quantity) } },
      });
      if (updated.count !== 1) throw new Error("PRODUCT_NOT_FOUND_OR_INSUFFICIENT_STOCK");
      await tx.inventoryMovement.create({ data: { businessId, productId, type: "ADJUSTMENT", quantity: parsed.data.quantity, reason: parsed.data.reason || "Manual adjustment" } });
      return tx.product.findUnique({ where: { id: productId } });
    });
    return Response.json(product);
  } catch (error) {
    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND_OR_INSUFFICIENT_STOCK") return errorResponse(422, "INVALID_STOCK_ADJUSTMENT", "El producto no existe, está archivado o no tiene stock suficiente.");
    return unexpectedError();
  }
}