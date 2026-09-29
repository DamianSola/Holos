import { prisma } from "@/lib/db";
import { authorizeBusiness } from "@/server/auth/authorization";
import { errorResponse, unexpectedError } from "@/server/http";
import { saleSchema, serviceSaleSchema } from "@/server/validators/domain";

type Context = { params: Promise<{ businessId: string }> };

export async function GET(_request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;
  const sales = await prisma.sale.findMany({ where: { businessId }, include: { customer: true, items: true, invoice: true }, orderBy: { createdAt: "desc" }, take: 100 });
  return Response.json({ items: sales });
}

export async function POST(request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;
  const body = await request.json().catch(() => null);
  const business = await prisma.business.findFirst({ where: { id: businessId, deletedAt: null }, select: { kind: true } });
  if (!business) return errorResponse(404, "BUSINESS_NOT_FOUND", "El negocio no existe.");

  if (business.kind === "SERVICE") {
    const parsed = serviceSaleSchema.safeParse(body);
    if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "Datos inválidos.", parsed.error.flatten());
    try {
      const sale = await prisma.$transaction(async (tx) => {
        const customer = await tx.customer.findFirst({ where: { id: parsed.data.customerId, businessId, deletedAt: null } });
        if (!customer) throw new Error("CUSTOMER_NOT_FOUND");
        return tx.sale.create({
          data: {
            businessId,
            customerId: customer.id,
            createdById: access.user.id,
            paymentMethod: parsed.data.paymentMethod,
            subtotalMinor: parsed.data.amountMinor,
            totalMinor: parsed.data.amountMinor,
            serviceDate: new Date(`${parsed.data.serviceDate}T12:00:00`),
            place: parsed.data.place,
            description: parsed.data.description,
            items: {
              create: {
                productName: parsed.data.description,
                quantity: 1,
                unitPriceMinor: parsed.data.amountMinor,
                totalMinor: parsed.data.amountMinor,
              },
            },
          },
          include: { items: true, customer: true },
        });
      });
      return Response.json(sale, { status: 201 });
    } catch (error) {
      if (error instanceof Error && error.message === "CUSTOMER_NOT_FOUND") return errorResponse(422, error.message, "El cliente no pertenece a este negocio.");
      return unexpectedError();
    }
  }

  const parsed = saleSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "Datos inválidos.", parsed.error.flatten());

  const uniqueProductIds = new Set(parsed.data.items.map((item) => item.productId));

  try {
    const sale = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({ where: { id: { in: [...uniqueProductIds] }, businessId, deletedAt: null, status: "ACTIVE" } });
      if (products.length !== uniqueProductIds.size) throw new Error("PRODUCT_NOT_FOUND");
      if (parsed.data.customerId) {
        const customer = await tx.customer.findFirst({ where: { id: parsed.data.customerId, businessId, deletedAt: null } });
        if (!customer) throw new Error("CUSTOMER_NOT_FOUND");
      }
      const items = parsed.data.items.map((item) => {
        const product = products.find((candidate) => candidate.id === item.productId)!;
        return { productId: product.id, productName: product.name, quantity: item.quantity, unitPriceMinor: product.priceMinor, totalMinor: product.priceMinor * item.quantity };
      });
      const totalMinor = items.reduce((total, item) => total + item.totalMinor, 0);
      return tx.sale.create({ data: { businessId, customerId: parsed.data.customerId, createdById: access.user.id, paymentMethod: parsed.data.paymentMethod, subtotalMinor: totalMinor, totalMinor, items: { create: items } }, include: { items: true } });
    });
    return Response.json(sale, { status: 201 });
  } catch (error) {
    if (error instanceof Error && ["PRODUCT_NOT_FOUND", "CUSTOMER_NOT_FOUND"].includes(error.message)) return errorResponse(422, error.message, "La venta contiene referencias inválidas.");
    return unexpectedError();
  }
}