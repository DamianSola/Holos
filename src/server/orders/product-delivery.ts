import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { discountLabel } from "@/lib/sale-discount";
import { orderShouldClose } from "@/lib/order-progress";
import { paidMinor } from "@/lib/reservation-money";
import { orderInclude } from "@/server/orders/order-include";
import { createArcaInvoice } from "@/server/services/arca";

type Writer = Prisma.TransactionClient;
type Line = { id: string; productId: string; productName: string; quantity: number; totalMinor: number; deliveredAt: Date | null };

export async function deliverProductOrder(businessId: string, orderId: string, change: { itemId: string; delivered: boolean } | { deliverAll: true }) {
  try {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.customerOrder.findFirst({ where: { id: orderId, businessId }, include: { items: true, payments: { select: { amountMinor: true } } } });
      if (!order) throw stop(404, "ORDER_NOT_FOUND", "El pedido no existe.");
      if (order.kind !== "PRODUCT") throw stop(422, "NOT_A_PRODUCT_ORDER", "Este pedido no es de productos.");
      if (order.status === "CANCELLED") throw stop(409, "ORDER_CANCELLED", "Un pedido cancelado no se puede entregar.");

      const legacy = order.status === "DONE" && order.items.every((item) => !item.deliveredAt);
      if ("deliverAll" in change) {
        if (!legacy) {
          for (const item of order.items) {
            if (item.deliveredAt) continue;
            const taken = await takeStock(tx, businessId, item);
            if (!taken) throw stop(422, "INSUFFICIENT_STOCK", `No hay stock de ${item.productName}.`);
            await tx.orderItem.update({ where: { id: item.id }, data: { deliveredAt: new Date() } });
          }
        }
      } else {
        const item = order.items.find((line) => line.id === change.itemId);
        if (!item) throw stop(404, "ITEM_NOT_FOUND", "El producto no está en el pedido.");
        if (change.delivered) {
          if (!item.deliveredAt && !legacy) {
            const taken = await takeStock(tx, businessId, item);
            if (!taken) throw stop(422, "INSUFFICIENT_STOCK", `No hay stock de ${item.productName}.`);
            await tx.orderItem.update({ where: { id: item.id }, data: { deliveredAt: new Date() } });
          }
        } else if (legacy) {
          await tx.orderItem.updateMany({ where: { orderId, id: { not: item.id } }, data: { deliveredAt: order.completedAt ?? new Date() } });
        } else if (item.deliveredAt) {
          await returnStock(tx, businessId, item);
          await tx.orderItem.update({ where: { id: item.id }, data: { deliveredAt: null } });
        }
      }
      await syncClosure(tx, orderId);
      return reload(tx, orderId);
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof DeliveryStop) return error.result;
    return refuse(500, "UNEXPECTED", "No se pudo actualizar la entrega.");
  }
}

export async function cancelProductOrder(businessId: string, orderId: string, refund: boolean) {
  try {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.customerOrder.findFirst({ where: { id: orderId, businessId }, include: { items: true, payments: { select: { amountMinor: true } } } });
      if (!order) return refuse(404, "ORDER_NOT_FOUND", "El pedido no existe.");
      if (order.kind !== "PRODUCT") return refuse(422, "NOT_A_PRODUCT_ORDER", "Este pedido no es de productos.");
      if (order.status === "CANCELLED") return reload(tx, orderId);
      await removeOrderSale(tx, orderId);
      const paid = paidMinor(order.payments);
      for (const item of order.items) {
        if (!item.deliveredAt) continue;
        await returnStock(tx, businessId, item);
      }
      if (refund && paid > 0) await tx.orderPayment.deleteMany({ where: { orderId } });
      await tx.orderItem.updateMany({ where: { orderId }, data: { deliveredAt: null } });
      await tx.customerOrder.update({ where: { id: orderId }, data: { status: "CANCELLED", cancelledAt: new Date(), completedAt: null } });
      return reload(tx, orderId);
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof DeliveryStop) return error.result;
    return refuse(500, "UNEXPECTED", "No se pudo cancelar el pedido.");
  }
}

export async function closeProductOrderIfSettled(tx: Writer, orderId: string) {
  await syncClosure(tx, orderId);
}

async function syncClosure(tx: Writer, orderId: string) {
  const fresh = await tx.customerOrder.findFirst({
    where: { id: orderId },
    include: {
      items: true,
      payments: { select: { amountMinor: true, paymentMethod: true }, orderBy: { paidAt: "desc" } },
      customer: { select: { name: true } },
    },
  });
  if (!fresh || fresh.status === "CANCELLED" || fresh.kind !== "PRODUCT") return;
  const charge = fresh.amountMinor ?? fresh.items.reduce((total, item) => total + item.totalMinor, 0);
  const allDelivered = fresh.items.length > 0 && fresh.items.every((item) => item.deliveredAt);
  const close = orderShouldClose(allDelivered, charge, paidMinor(fresh.payments));
  if (close && fresh.status !== "DONE") {
    await tx.customerOrder.update({ where: { id: orderId }, data: { status: "DONE", completedAt: new Date(), cancelledAt: null } });
    await recordOrderSale(tx, fresh, charge);
  } else if (!close && fresh.status === "DONE") {
    await removeOrderSale(tx, orderId);
    await tx.customerOrder.update({ where: { id: orderId }, data: { status: "SCHEDULED", completedAt: null } });
  }
}

async function recordOrderSale(tx: Writer, order: {
  id: string;
  businessId: string;
  customerId: string;
  createdById: string;
  subtotalMinor: number;
  discountKind: "NONE" | "PERCENT" | "PRICE";
  discountPercentBps: number | null;
  items: Array<{ productId: string; productName: string; quantity: number; unitPriceMinor: number; totalMinor: number }>;
  payments: Array<{ paymentMethod: "CASH" | "TRANSFER" | "CARD" | "OTHER" }>;
  customer: { name: string } | null;
}, charge: number) {
  const existing = await tx.sale.findFirst({ where: { orderId: order.id }, select: { id: true } });
  if (existing) return;
  const subtotalMinor = order.subtotalMinor > 0 ? order.subtotalMinor : order.items.reduce((total, item) => total + item.totalMinor, 0);
  const sale = await tx.sale.create({
    data: {
      businessId: order.businessId,
      customerId: order.customerId,
      createdById: order.createdById,
      orderId: order.id,
      status: "CONFIRMED",
      confirmedAt: new Date(),
      paymentMethod: order.payments[0]?.paymentMethod ?? null,
      subtotalMinor,
      totalMinor: charge,
      discountKind: order.discountKind,
      discountPercentBps: order.discountPercentBps,
      items: { create: order.items.map((item) => ({ productId: item.productId, productName: item.productName, quantity: item.quantity, unitPriceMinor: item.unitPriceMinor, totalMinor: item.totalMinor })) },
    },
    include: { items: true },
  });
  const business = await tx.business.findUnique({ where: { id: order.businessId }, select: { id: true, name: true } });
  const issued = await createArcaInvoice(tx, {
    business,
    customer: order.customer,
    sale: { id: sale.id, totalMinor: charge, createdAt: sale.createdAt },
    items: sale.items,
  });
  await tx.invoice.create({
    data: {
      businessId: order.businessId,
      saleId: sale.id,
      status: "ISSUED",
      number: issued.number,
      totalMinor: charge,
      issuedAt: new Date(),
      cae: issued.cae ?? null,
      caeExpiry: issued.caeExpiry ?? null,
      arcaStatus: issued.status,
      externalRef: issued.externalReference ?? null,
      metadata: issued.metadata ?? null,
      items: {
        create: [
          ...sale.items.map((item) => ({ description: item.productName, quantity: item.quantity, unitPriceMinor: item.unitPriceMinor, totalMinor: item.totalMinor })),
          ...(subtotalMinor > charge ? [{ description: discountLabel(order.discountKind, order.discountPercentBps) ?? "Descuento", quantity: 1, unitPriceMinor: charge - subtotalMinor, totalMinor: charge - subtotalMinor }] : []),
        ],
      },
    },
  });
  await tx.activityEvent.create({
    data: {
      businessId: order.businessId,
      actorId: order.createdById,
      type: "SALE_CONFIRMED",
      entityType: "Sale",
      entityId: sale.id,
      metadata: { totalMinor: charge, orderId: order.id },
    },
  });
}

async function removeOrderSale(tx: Writer, orderId: string) {
  const sale = await tx.sale.findFirst({ where: { orderId }, include: { invoice: true } });
  if (!sale) return;
  if (sale.invoice?.arcaStatus === "AUTHORIZED" && sale.invoice.cae && !sale.invoice.cae.startsWith("MOCK")) {
    throw stop(409, "FISCAL_INVOICE", "Esta venta tiene una factura de ARCA y el pedido no se puede reabrir.");
  }
  await tx.inventoryMovement.deleteMany({ where: { saleId: sale.id } });
  if (sale.invoice) {
    await tx.invoiceItem.deleteMany({ where: { invoiceId: sale.invoice.id } });
    await tx.invoice.delete({ where: { id: sale.invoice.id } });
  }
  await tx.sale.delete({ where: { id: sale.id } });
}

async function takeStock(tx: Writer, businessId: string, item: Line) {
  const updated = await tx.product.updateMany({
    where: { id: item.productId, businessId, status: "ACTIVE", deletedAt: null, stock: { gte: item.quantity } },
    data: { stock: { decrement: item.quantity } },
  });
  if (updated.count !== 1) return false;
  await tx.inventoryMovement.create({ data: { businessId, productId: item.productId, type: "ADJUSTMENT", quantity: -item.quantity, reason: "Entrega de pedido" } });
  return true;
}

async function returnStock(tx: Writer, businessId: string, item: Line) {
  await tx.product.updateMany({ where: { id: item.productId, businessId }, data: { stock: { increment: item.quantity } } });
  await tx.inventoryMovement.create({ data: { businessId, productId: item.productId, type: "ADJUSTMENT", quantity: item.quantity, reason: "Vuelve de un pedido" } });
}

async function reload(tx: Writer, orderId: string) {
  const order = await tx.customerOrder.findFirstOrThrow({ where: { id: orderId }, include: orderInclude });
  return { ok: true as const, order };
}

class DeliveryStop extends Error {
  constructor(readonly result: ReturnType<typeof refuse>) {
    super(result.message);
  }
}

function stop(status: number, code: string, message: string) {
  return new DeliveryStop(refuse(status, code, message));
}

function refuse(status: number, code: string, message: string) {
  return { ok: false as const, status, code, message };
}
