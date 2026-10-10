import { prisma } from "@/lib/db";
import { buildProductLines } from "@/server/orders/product-lines";
import { checkReservationFit } from "@/server/orders/reservation-booking";
import { authorizeBusiness } from "@/server/auth/authorization";
import { errorResponse, unexpectedError } from "@/server/http";
import { customerOrderSchema, productOrderCreateSchema, serviceReservationSchema } from "@/server/validators/domain";

type Context = { params: Promise<{ businessId: string }> };

const orderInclude = {
  customer: { select: { id: true, name: true, phone: true } },
  product: { select: { id: true, name: true, priceMinor: true } },
  items: { select: { id: true, productId: true, productName: true, quantity: true, unitPriceMinor: true, totalMinor: true } },
  payments: { select: { id: true, amountMinor: true, paymentMethod: true, paidAt: true }, orderBy: { paidAt: "asc" as const } },
  invoice: { select: { id: true, number: true, arcaStatus: true, cae: true } },
} as const;

export async function GET(_request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;

  const items = await prisma.customerOrder.findMany({
    where: { businessId },
    include: orderInclude,
    orderBy: [{ scheduledFor: "asc" }],
    take: 500,
  });
  return Response.json({ items });
}

export async function POST(request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;

  const business = await prisma.business.findFirst({ where: { id: businessId, deletedAt: null }, select: { kind: true } });
  const body = await request.json().catch(() => null);
  if (business?.kind === "SERVICE") {
    const parsed = serviceReservationSchema.safeParse(body);
    if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "Datos inválidos.", parsed.error.flatten());
    try {
      const customer = await prisma.customer.findFirst({ where: { id: parsed.data.customerId, businessId, deletedAt: null } });
      if (!customer) return errorResponse(422, "CUSTOMER_NOT_FOUND", "El cliente no pertenece a este negocio.");
      const created = await prisma.$transaction(async (tx) => {
        const fit = await checkReservationFit(tx, { businessId, date: parsed.data.scheduledFor, startsAt: parsed.data.startsAt, place: parsed.data.place, occupy: true });
        if (!fit.ok) return fit;
        const order = await tx.customerOrder.create({
          data: {
            businessId,
            customerId: customer.id,
            createdById: access.user.id,
            kind: "SERVICE",
            bookedAs: fit.bookedAs,
            title: parsed.data.title,
            quantity: 1,
            scheduledFor: fit.scheduledFor,
            amountMinor: parsed.data.amountMinor,
            place: fit.place,
            description: parsed.data.title,
          },
          include: orderInclude,
        });
        return { ok: true as const, order };
      });
      if (!created.ok) return errorResponse(422, created.code, created.message);
      const order = created.order;
      await prisma.activityEvent.create({
        data: {
          businessId,
          actorId: access.user.id,
          type: "SERVICE_SCHEDULED",
          entityType: "CustomerOrder",
          entityId: order.id,
          metadata: { title: order.title, scheduledFor: parsed.data.scheduledFor, customer: customer.name, amountMinor: parsed.data.amountMinor },
        },
      });
      return Response.json(order, { status: 201 });
    } catch {
      return unexpectedError();
    }
  }

  const productOrder = productOrderCreateSchema.safeParse(body);
  if (productOrder.success) {
    try {
      const customer = await prisma.customer.findFirst({ where: { id: productOrder.data.customerId, businessId, deletedAt: null } });
      if (!customer) return errorResponse(422, "CUSTOMER_NOT_FOUND", "El cliente no pertenece a este negocio.");
      const built = await buildProductLines(businessId, productOrder.data.items, []);
      if (!built.ok) return errorResponse(422, built.code, built.code === "PRODUCT_NOT_FOUND" ? "El producto no pertenece a este negocio." : "El importe del pedido es demasiado grande.");
      const order = await prisma.customerOrder.create({
        data: {
          businessId,
          customerId: customer.id,
          createdById: access.user.id,
          productId: built.productId,
          kind: "PRODUCT",
          title: built.title,
          quantity: built.quantity,
          scheduledFor: new Date(`${productOrder.data.scheduledFor}T12:00:00`),
          amountMinor: built.amountMinor,
          notes: productOrder.data.notes || null,
          items: { create: built.lines },
        },
        include: orderInclude,
      });
      await prisma.activityEvent.create({
        data: {
          businessId,
          actorId: access.user.id,
          type: "ORDER_CREATED",
          entityType: "CustomerOrder",
          entityId: order.id,
          metadata: { title: order.title, scheduledFor: productOrder.data.scheduledFor, customer: customer.name, amountMinor: built.amountMinor },
        },
      });
      return Response.json(order, { status: 201 });
    } catch {
      return unexpectedError();
    }
  }
  if (body && typeof body === "object" && "items" in body) return errorResponse(400, "VALIDATION_ERROR", "Datos inválidos.", productOrder.error.flatten());

  const parsed = customerOrderSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "Datos inválidos.", parsed.error.flatten());

  try {
    const customer = await prisma.customer.findFirst({ where: { id: parsed.data.customerId, businessId, deletedAt: null } });
    if (!customer) return errorResponse(422, "CUSTOMER_NOT_FOUND", "El cliente no pertenece a este negocio.");

    let productId: string | null = null;
    if (parsed.data.kind === "PRODUCT" && parsed.data.productId) {
      const product = await prisma.product.findFirst({ where: { id: parsed.data.productId, businessId, deletedAt: null, status: "ACTIVE" } });
      if (!product) return errorResponse(422, "PRODUCT_NOT_FOUND", "El producto no pertenece a este negocio.");
      productId = product.id;
    }

    const order = await prisma.customerOrder.create({
      data: {
        businessId,
        customerId: customer.id,
        createdById: access.user.id,
        productId,
        kind: parsed.data.kind,
        title: parsed.data.title,
        quantity: parsed.data.kind === "PRODUCT" ? parsed.data.quantity : 1,
        scheduledFor: new Date(`${parsed.data.scheduledFor}T12:00:00`),
        amountMinor: parsed.data.amountMinor ?? null,
        notes: parsed.data.notes || null,
      },
      include: orderInclude,
    });
    await prisma.activityEvent.create({
      data: {
        businessId,
        actorId: access.user.id,
        type: parsed.data.kind === "SERVICE" ? "SERVICE_SCHEDULED" : "ORDER_CREATED",
        entityType: "CustomerOrder",
        entityId: order.id,
        metadata: { title: order.title, scheduledFor: parsed.data.scheduledFor, customer: customer.name },
      },
    });
    return Response.json(order, { status: 201 });
  } catch {
    return unexpectedError();
  }
}
