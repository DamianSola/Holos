import { prisma } from "@/lib/db";
import { paidMinor, paymentFits } from "@/lib/reservation-money";
import { authorizeBusiness } from "@/server/auth/authorization";
import { errorResponse, unexpectedError } from "@/server/http";
import { businessIdSchema, orderPaymentSchema } from "@/server/validators/domain";

type Context = { params: Promise<{ businessId: string; orderId: string }> };

export async function POST(request: Request, context: Context) {
  const { businessId, orderId } = await context.params;
  if (!businessIdSchema.safeParse(orderId).success) return errorResponse(400, "INVALID_ORDER_ID", "La reserva no es válida.");
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;

  const parsed = orderPaymentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "Datos inválidos.", parsed.error.flatten());

  try {
    const order = await prisma.customerOrder.findFirst({
      where: { id: orderId, businessId },
      include: { payments: { select: { amountMinor: true } } },
    });
    if (!order || order.kind !== "SERVICE") return errorResponse(404, "ORDER_NOT_FOUND", "La reserva no existe.");
    if (order.status === "CANCELLED") return errorResponse(409, "ORDER_CANCELLED", "Una reserva cancelada no puede cobrar.");
    if (order.amountMinor === null) return errorResponse(422, "BUDGET_REQUIRED", "Cargá el presupuesto para poder cobrar.");
    if (!paymentFits(order.amountMinor, paidMinor(order.payments), parsed.data.amountMinor)) {
      return errorResponse(422, "PAYMENT_ABOVE_BALANCE", "El pago supera el saldo.");
    }

    const payment = await prisma.orderPayment.create({
      data: {
        businessId,
        orderId: order.id,
        createdById: access.user.id,
        amountMinor: parsed.data.amountMinor,
        paymentMethod: parsed.data.paymentMethod,
      },
    });
    await prisma.activityEvent.create({
      data: {
        businessId,
        actorId: access.user.id,
        type: "RESERVATION_PAYMENT",
        entityType: "CustomerOrder",
        entityId: order.id,
        metadata: { amountMinor: payment.amountMinor, paymentMethod: payment.paymentMethod, title: order.title },
      },
    });
    return Response.json(payment, { status: 201 });
  } catch {
    return unexpectedError();
  }
}
