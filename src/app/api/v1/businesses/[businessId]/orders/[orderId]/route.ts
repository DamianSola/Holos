import { prisma } from "@/lib/db";
import { authorizeBusiness } from "@/server/auth/authorization";
import { errorResponse, unexpectedError } from "@/server/http";
import { businessIdSchema, customerOrderStatusSchema } from "@/server/validators/domain";

type Context = { params: Promise<{ businessId: string; orderId: string }> };

export async function PATCH(request: Request, context: Context) {
  const { businessId, orderId } = await context.params;
  if (!businessIdSchema.safeParse(orderId).success) return errorResponse(400, "INVALID_ORDER_ID", "El pedido no es válido.");
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;

  const parsed = customerOrderStatusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "Datos inválidos.", parsed.error.flatten());

  try {
    const current = await prisma.customerOrder.findFirst({ where: { id: orderId, businessId } });
    if (!current) return errorResponse(404, "ORDER_NOT_FOUND", "El pedido no existe.");

    const now = new Date();
    const order = await prisma.customerOrder.update({
      where: { id: orderId },
      data: {
        status: parsed.data.status,
        completedAt: parsed.data.status === "DONE" ? now : null,
        cancelledAt: parsed.data.status === "CANCELLED" ? now : null,
      },
      include: { customer: { select: { id: true, name: true } }, product: { select: { id: true, name: true } } },
    });
    await prisma.activityEvent.create({
      data: {
        businessId,
        actorId: access.user.id,
        type: parsed.data.status === "DONE" ? "ORDER_COMPLETED" : parsed.data.status === "CANCELLED" ? "ORDER_CANCELLED" : "ORDER_REOPENED",
        entityType: "CustomerOrder",
        entityId: order.id,
        metadata: { title: order.title, status: order.status },
      },
    });
    return Response.json(order);
  } catch {
    return unexpectedError();
  }
}
