import { prisma } from "@/lib/db";
import { buenosAiresDate, buenosAiresTime } from "@/lib/reservation-schedule";
import { paidMinor } from "@/lib/reservation-money";
import { orderInclude } from "@/server/orders/order-include";
import { quoteOrder } from "@/server/orders/order-price";
import { cancelProductOrder, deliverProductOrder } from "@/server/orders/product-delivery";
import { buildProductLines } from "@/server/orders/product-lines";
import { checkReservationFit } from "@/server/orders/reservation-booking";
import { authorizeBusiness } from "@/server/auth/authorization";
import { errorResponse, unexpectedError } from "@/server/http";
import { businessIdSchema, customerOrderStatusSchema, productCancelSchema, productDeliverySchema, productOrderUpdateSchema, serviceReservationUpdateSchema } from "@/server/validators/domain";

type Context = { params: Promise<{ businessId: string; orderId: string }> };

export async function PATCH(request: Request, context: Context) {
  const { businessId, orderId } = await context.params;
  if (!businessIdSchema.safeParse(orderId).success) return errorResponse(400, "INVALID_ORDER_ID", "El pedido no es válido.");
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;

  const body = await request.json().catch(() => null);
  const delivery = productDeliverySchema.safeParse(body);
  if (delivery.success) {
    const result = await deliverProductOrder(businessId, orderId, delivery.data);
    if (!result.ok) return errorResponse(result.status, result.code, result.message);
    await prisma.activityEvent.create({ data: { businessId, actorId: access.user.id, type: "ORDER_DELIVERED", entityType: "CustomerOrder", entityId: orderId, metadata: { status: result.order.status } } });
    return Response.json(result.order);
  }
  const productCancel = productCancelSchema.safeParse(body);
  if (productCancel.success) {
    const result = await cancelProductOrder(businessId, orderId, productCancel.data.refund);
    if (!result.ok) return errorResponse(result.status, result.code, result.message);
    await prisma.activityEvent.create({ data: { businessId, actorId: access.user.id, type: "ORDER_CANCELLED", entityType: "CustomerOrder", entityId: orderId, metadata: { refund: productCancel.data.refund } } });
    return Response.json(result.order);
  }
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
    const nextStatus = parsed.data.status ?? current.status;
    const date = parsed.data.scheduledFor ?? buenosAiresDate(current.scheduledFor);
    const startsAt = parsed.data.startsAt ?? (current.bookedAs === "TURN" ? buenosAiresTime(current.scheduledFor) : null);
    const saved = await prisma.$transaction(async (tx) => {
      const fit = await checkReservationFit(tx, {
        businessId,
        date,
        startsAt,
        place: parsed.data.place === undefined ? current.place : parsed.data.place,
        bookedAs: current.bookedAs,
        excludeOrderId: orderId,
        occupy: nextStatus !== "CANCELLED",
      });
      if (!fit.ok) return fit;
      const order = await tx.customerOrder.update({
        where: { id: orderId },
        data: {
          customerId,
          title: parsed.data.title,
          description: parsed.data.title,
          place: fit.place,
          amountMinor: parsed.data.amountMinor,
          scheduledFor: fit.scheduledFor,
          status: parsed.data.status,
          completedAt: parsed.data.status === undefined ? undefined : parsed.data.status === "DONE" ? now : null,
          cancelledAt: parsed.data.status === undefined ? undefined : parsed.data.status === "CANCELLED" ? now : null,
        },
        include: orderInclude,
      });
      return { ok: true as const, order };
    });
    if (!saved.ok) return errorResponse(422, saved.code, saved.message);
    const order = saved.order;
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

    if (current.kind === "PRODUCT") {
      if (status === "DONE") {
        const result = await deliverProductOrder(businessId, orderId, { deliverAll: true });
        if (!result.ok) return errorResponse(result.status, result.code, result.message);
        return Response.json(result.order);
      }
      if (status === "CANCELLED") {
        const paid = await prisma.orderPayment.aggregate({ where: { orderId }, _sum: { amountMinor: true } });
        if ((paid._sum.amountMinor ?? 0) > 0) return errorResponse(422, "REFUND_REQUIRED", "Elegí si devolvés lo cobrado.");
        const result = await cancelProductOrder(businessId, orderId, false);
        if (!result.ok) return errorResponse(result.status, result.code, result.message);
        return Response.json(result.order);
      }
      if (status === "SCHEDULED" && current.status === "CANCELLED") {
        const order = await prisma.customerOrder.update({ where: { id: orderId }, data: { status: "SCHEDULED", cancelledAt: null, completedAt: null }, include: orderInclude });
        return Response.json(order);
      }
      if (status === "SCHEDULED") return errorResponse(422, "ORDER_OPEN", "Desmarcá un producto para reabrir el pedido.");
    }

    if (current.kind === "SERVICE" && current.status === "CANCELLED" && status === "SCHEDULED") {
      const fit = await checkReservationFit(prisma, {
        businessId,
        date: buenosAiresDate(current.scheduledFor),
        startsAt: current.bookedAs === "TURN" ? buenosAiresTime(current.scheduledFor) : null,
        place: current.place,
        bookedAs: current.bookedAs,
        excludeOrderId: orderId,
        occupy: true,
      });
      if (!fit.ok) return errorResponse(422, fit.code, fit.message);
    }

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

async function updateProductOrder(businessId: string, orderId: string, data: { customerId: string; scheduledFor: string; notes?: string; items: Array<{ productId: string; quantity: number }>; discount?: { kind: "NONE" } | { kind: "PERCENT"; percent: number } | { kind: "PRICE"; priceMinor: number } }) {
  try {
    const current = await prisma.customerOrder.findFirst({
      where: { id: orderId, businessId },
      include: { items: { select: { productId: true, unitPriceMinor: true, deliveredAt: true } }, payments: { select: { amountMinor: true } } },
    });
    if (!current) return errorResponse(404, "ORDER_NOT_FOUND", "El pedido no existe.");
    if (current.kind !== "PRODUCT") return errorResponse(422, "NOT_A_PRODUCT_ORDER", "Este pedido no es de productos.");
    if (current.status !== "SCHEDULED" || current.items.some((item) => item.deliveredAt)) return errorResponse(422, "ORDER_CLOSED", "Este pedido no se puede editar.");

    const customer = await prisma.customer.findFirst({ where: { id: data.customerId, businessId, deletedAt: null } });
    if (!customer) return errorResponse(422, "CUSTOMER_NOT_FOUND", "El cliente no pertenece a este negocio.");

    const built = await buildProductLines(businessId, data.items, current.items);
    if (!built.ok) return errorResponse(422, built.code, built.code === "PRODUCT_NOT_FOUND" ? "El producto no pertenece a este negocio." : "El importe del pedido es demasiado grande.");
    const quoted = quoteOrder(built.amountMinor, data.discount);
    if (!quoted.ok) return errorResponse(422, quoted.code, "El precio manual no puede superar el total de la lista.");
    if (quoted.totalMinor < paidMinor(current.payments)) return errorResponse(422, "BUDGET_BELOW_PAID", "El precio no puede ser menor a lo ya cobrado.");

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
          amountMinor: quoted.totalMinor,
          subtotalMinor: quoted.subtotalMinor,
          discountKind: quoted.discountKind,
          discountPercentBps: quoted.discountPercentBps,
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
