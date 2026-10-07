import { inclusiveCivilRange } from "@/lib/movement-period";
import { applySaleDiscount, type SaleDiscount } from "@/lib/sale-discount";
import { prisma } from "@/lib/db";
import { authorizeBusiness } from "@/server/auth/authorization";
import { errorResponse, unexpectedError } from "@/server/http";
import { saleSchema, serviceSaleSchema } from "@/server/validators/domain";

function discountFromInput(input: { kind: "NONE" } | { kind: "PERCENT"; percent: number } | { kind: "PRICE"; priceMinor: number } | undefined): SaleDiscount {
  if (!input || input.kind === "NONE") return { kind: "NONE" };
  if (input.kind === "PERCENT") return { kind: "PERCENT", percentBps: Math.min(10_000, Math.max(0, Math.round(input.percent * 100))) };
  return { kind: "PRICE", priceMinor: input.priceMinor };
}

type Context = { params: Promise<{ businessId: string }> };

export async function GET(request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;
  const range = readRange(request);
  if (range === "invalid") return errorResponse(400, "INVALID_DATE", "La fecha no es válida.");
  const service = access.membership.business.kind === "SERVICE";
  const sales = await prisma.sale.findMany({
    where: range ? { businessId, OR: service ? serviceDateWhere(range.start, range.end) : storeDateWhere(range.start, range.end) } : { businessId },
    include: { customer: true, items: true, invoice: true },
    orderBy: { createdAt: "desc" },
    ...(range ? {} : { take: 100 }),
  });
  return Response.json({ items: sales });
}

function readRange(request: Request) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from && !to) return null;
  if (!from || !to) return "invalid" as const;
  return inclusiveCivilRange(from, to) ?? "invalid";
}

function storeDateWhere(start: Date, end: Date) {
  return [
    { confirmedAt: { gte: start, lt: end } },
    { confirmedAt: null, createdAt: { gte: start, lt: end } },
  ];
}

function serviceDateWhere(start: Date, end: Date) {
  return [
    { serviceDate: { gte: start, lt: end } },
    { serviceDate: null, confirmedAt: { gte: start, lt: end } },
    { serviceDate: null, confirmedAt: null, createdAt: { gte: start, lt: end } },
  ];
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
        const discount = discountFromInput(parsed.data.discount);
        const priced = applySaleDiscount(parsed.data.amountMinor, discount);
        return tx.sale.create({
          data: {
            businessId,
            customerId: customer.id,
            createdById: access.user.id,
            paymentMethod: parsed.data.paymentMethod,
            subtotalMinor: parsed.data.amountMinor,
            totalMinor: priced.totalMinor,
            discountKind: discount.kind,
            discountPercentBps: discount.kind === "PERCENT" ? discount.percentBps : null,
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
      if (error instanceof Error && error.message === "PRICE_ABOVE_LIST") return errorResponse(422, error.message, "El precio manual no puede superar el presupuesto.");
      return unexpectedError();
    }
  }

  const parsed = saleSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "Datos inválidos.", parsed.error.flatten());

  const uniqueProductIds = new Set(parsed.data.items.map((item) => item.productId));

  try {
    const sale = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({ where: { id: { in: [...uniqueProductIds] }, businessId, deletedAt: null, status: "ACTIVE" } });
      if (products.length !== uniqueProductIds.size || products.some((product) => product.catalogKind !== "PRODUCT")) throw new Error("PRODUCT_NOT_FOUND");
      if (parsed.data.customerId) {
        const customer = await tx.customer.findFirst({ where: { id: parsed.data.customerId, businessId, deletedAt: null } });
        if (!customer) throw new Error("CUSTOMER_NOT_FOUND");
      }
      const items = parsed.data.items.map((item) => {
        const product = products.find((candidate) => candidate.id === item.productId)!;
        return { productId: product.id, productName: product.name, quantity: item.quantity, unitPriceMinor: product.priceMinor, totalMinor: product.priceMinor * item.quantity };
      });
      const subtotalMinor = items.reduce((total, item) => total + item.totalMinor, 0);
      const discount = discountFromInput(parsed.data.discount);
      const priced = applySaleDiscount(subtotalMinor, discount);
      return tx.sale.create({ data: { businessId, customerId: parsed.data.customerId, createdById: access.user.id, paymentMethod: parsed.data.paymentMethod, subtotalMinor, totalMinor: priced.totalMinor, discountKind: discount.kind, discountPercentBps: discount.kind === "PERCENT" ? discount.percentBps : null, items: { create: items } }, include: { items: true } });
    });
    return Response.json(sale, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "PRICE_ABOVE_LIST") return errorResponse(422, error.message, "El precio manual no puede superar el total de la lista.");
    if (error instanceof Error && ["PRODUCT_NOT_FOUND", "CUSTOMER_NOT_FOUND"].includes(error.message)) return errorResponse(422, error.message, "La venta contiene referencias inválidas.");
    return unexpectedError();
  }
}