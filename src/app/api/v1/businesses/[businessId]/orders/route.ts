import { prisma } from "@/lib/db";
import { authorizeBusiness } from "@/server/auth/authorization";
import { errorResponse, unexpectedError } from "@/server/http";
import { customerOrderSchema } from "@/server/validators/domain";

type Context = { params: Promise<{ businessId: string }> };

const orderInclude = {
  customer: { select: { id: true, name: true } },
  product: { select: { id: true, name: true } },
} as const;

export async function GET(_request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;

  const items = await prisma.customerOrder.findMany({
    where: { businessId },
    include: orderInclude,
    orderBy: [{ status: "asc" }, { scheduledFor: "asc" }],
    take: 200,
  });
  return Response.json({ items });
}

export async function POST(request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;

  const parsed = customerOrderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "Datos inválidos.", parsed.error.flatten());
  const business = await prisma.business.findFirst({ where: { id: businessId, deletedAt: null }, select: { kind: true } });
  if (business?.kind === "SERVICE" && parsed.data.kind === "PRODUCT") return errorResponse(422, "SERVICE_BUSINESS", "En un negocio de servicios la reserva es un servicio.");

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
