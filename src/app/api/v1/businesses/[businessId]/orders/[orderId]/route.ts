import { prisma } from "@/lib/db";
import { paidMinor } from "@/lib/reservation-money";
import { buildProductLines } from "@/server/orders/product-lines";
import { authorizeBusiness } from "@/server/auth/authorization";
import { errorResponse, unexpectedError } from "@/server/http";
import { businessIdSchema, customerOrderStatusSchema, productOrderUpdateSchema, serviceReservationUpdateSchema } from "@/server/validators/domain";

type Context = { params: Promise<{ businessId: string; orderId: string }> };

const orderInclude = {
  customer: { select: { id: true, name: true, phone: true } },
  product: { select: { id: true, name: true, priceMinor: true } },
  items: { select: { id: true, productId: true, productName: true, quantity: true, unitPriceMinor: true, totalMinor: true } },
  payments: { select: { id: true, amountMinor: true, paymentMethod: true, paidAt: true }, orderBy: { paidAt: "asc" as const } },
  invoice: { select: { id: true, number: true, arcaStatus: true, cae: true } },
} as const;

export async function PATCH(request: Request, context: Context) {
  const { businessId, orderId } = await context.params;
  if (!businessIdSchema.safeParse(orderId).success) return errorResponse(400, "INVALID_ORDER_ID", "El pedido no es válido.");
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;

  const body = await request.json().catch(() => null);
  const statusOnly = customerOrderStatusSchema.safeParse(body);
  if (statusOnly.success) return updateStatus(businessId, orderId, access.user.id, statusOnly.data.status);

  const productUpdate = productOrderUpdateSchema.safeParse(body);
  if (productUpdate.success) return updateProductOrder(businessId, orderId, productUpdate.data);

  const parsed = serviceReservationUpdateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "Datos inválidos.", parsed.error.flatten());

  try {
    const current = await prisma.customerOrder.findFirst({ where: { id: orderId, businessId }, include: { payments: { select: { amountMinor: true } } } });
    if (!current) return errorResponse(404, "ORDER_NOT_FOUND", "La reserva no existe.");
    if (current.kind !== "SERVICE") return errorResponse(422, "NOT_A_RESERVATION", "Este pedido no es una reserva de servicio.");

    if (parsed.data.amountMinor !== undefined && parsed.data.amountMinor < paidMinor(current.payments)) {
      return errorResponse(422, "BUDGET_BELOW_PAID", "El presupuesto no puede ser menor a lo ya cobrado.");
    }

    let customerId = current.customerId;
    if (parsed.data.customerId && parsed.data.customerId !== current.customerId) {
      const customer = await prisma.customer.findFirst({ where: { id: parsed.data.customerId, businessId, deletedAt: null } });
      if (!customer) return errorResponse(422, "CUSTOMER_NOT_FOUND", "El cliente no pertenece a este negocio.");
      customerId = customer.id;
    }

    const now = new Date();
    const order = await prisma.customerOrder.update({
      where: { id: orderId },
      data: {
        customerId,
        title: parsed.data.title,
        description: parsed.data.title,
        place: parsed.data.place,
        amountMinor: parsed.data.amountMinor,
        scheduledFor: parsed.data.scheduledFor ? new Date(`${parsed.data.scheduledFor}T12:00:00`) : undefined,
        status: parsed.data.status,
        completedAt: parsed.data.status === undefined ? undefined : parsed.data.status === "DONE" ? now : null,
        cancelledAt: parsed.data.status === undefined ? undefined : parsed.data.status === "CANCELLED" ? now : null,
      },
      include: orderInclude,
    });
    await prisma.activityEvent.create({
      data: {
        businessId,
        actorId: access.user.id,
        type: "RESERVATION_UPDATED",
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

async function updateStatus(businessId: string, orderId: string, actorId: string, status: "SCHEDULED" | "DONE" | "CANCELLED") {
  try {
    const current = await prisma.customerOrder.findFirst({ where: { id: orderId, businessId } });
    if (!current) return errorResponse(404, "ORDER_NOT_FOUND", "El pedido no existe.");

    const now = new Date();
    const order = await prisma.customerOrder.update({
      where: { id: orderId },
      data: {
        status,
        completedAt: status === "DONE" ? now : null,
        cancelledAt: status === "CANCELLED" ? now : null,
      },
      include: orderInclude,
    });
    await prisma.activityEvent.create({
      data: {
        businessId,
        actorId,
        type: status === "DONE" ? "ORDER_COMPLETED" : status === "CANCELLED" ? "ORDER_CANCELLED" : "ORDER_REOPENED",
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

async function updateProductOrder(businessId: string, orderId: string, data: { customerId: string; scheduledFor: string; notes?: string; items: Array<{ productId: string; quantity: number }> }) {
  try {
    const current = await prisma.customerOrder.findFirst({
      where: { id: orderId, businessId },
      include: { items: { select: { productId: true, unitPriceMinor: true } } },
    });
    if (!current) return errorResponse(404, "ORDER_NOT_FOUND", "El pedido no existe.");
    if (current.kind !== "PRODUCT") return errorResponse(422, "NOT_A_PRODUCT_ORDER", "Este pedido no es de productos.");
    if (current.status !== "SCHEDULED") return errorResponse(422, "ORDER_CLOSED", "Este pedido no se puede editar.");

    const customer = await prisma.customer.findFirst({ where: { id: data.customerId, businessId, deletedAt: null } });
    if (!customer) return errorResponse(422, "CUSTOMER_NOT_FOUND", "El cliente no pertenece a este negocio.");

    const built = await buildProductLines(businessId, data.items, current.items);
    if (!built.ok) return errorResponse(422, built.code, built.code === "PRODUCT_NOT_FOUND" ? "El producto no pertenece a este negocio." : "El importe del pedido es demasiado grande.");

    const order = await prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { orderId } });
      return tx.customerOrder.update({
        where: { id: orderId },
        data: {
          customerId: customer.id,
          productId: built.productId,
          title: built.title,
          quantity: built.quantity,
          scheduledFor: new Date(`${data.scheduledFor}T12:00:00`),
          amountMinor: built.amountMinor,
          notes: data.notes || null,
          items: { create: built.lines },
        },
        include: orderInclude,
      });
    });
    return Response.json(order);
  } catch {
    return unexpectedError();
  }
}
