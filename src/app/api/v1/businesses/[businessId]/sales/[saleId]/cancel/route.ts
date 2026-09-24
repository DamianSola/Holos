import { prisma } from "@/lib/db";
import { authorizeBusiness } from "@/server/auth/authorization";
import { errorResponse, unexpectedError } from "@/server/http";
import { businessIdSchema } from "@/server/validators/domain";

type Context = { params: Promise<{ businessId: string; saleId: string }> };

export async function POST(_request: Request, context: Context) {
  const { businessId, saleId } = await context.params;
  if (!businessIdSchema.safeParse(businessId).success || !businessIdSchema.safeParse(saleId).success) return errorResponse(400, "INVALID_SALE_ID", "La venta no es válida.");
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;

  try {
    const sale = await prisma.$transaction(async (tx) => {
      const current = await tx.sale.findFirst({ where: { id: saleId, businessId } });
      if (!current) throw new Error("SALE_NOT_FOUND");
      if (current.status !== "DRAFT") throw new Error("SALE_NOT_DRAFT");
      const cancelled = await tx.sale.update({ where: { id: saleId }, data: { status: "CANCELLED", cancelledAt: new Date() }, include: { items: true, customer: true, invoice: true } });
      await tx.activityEvent.create({ data: { businessId, actorId: access.user.id, type: "SALE_CANCELLED", entityType: "Sale", entityId: sale.id, metadata: {} } });
      return cancelled;
    });
    return Response.json(sale);
  } catch (error) {
    if (error instanceof Error) {
      const messages: Record<string, [number, string]> = { SALE_NOT_FOUND: [404, "Venta inexistente."], SALE_NOT_DRAFT: [409, "Solo se pueden cancelar ventas pendientes."] };
      const mapped = messages[error.message];
      if (mapped) return errorResponse(mapped[0], error.message, mapped[1]);
    }
    return unexpectedError();
  }
}