import { prisma } from "@/lib/db";
import { authorizeBusiness } from "@/server/auth/authorization";
import { errorResponse, unexpectedError } from "@/server/http";
import { ArcaError } from "@/server/fiscal/document";
import { createArcaInvoice } from "@/server/services/arca";
import { businessIdSchema } from "@/server/validators/domain";

type Context = { params: Promise<{ businessId: string; saleId: string }> };

export async function POST(_request: Request, context: Context) {
  const { businessId, saleId } = await context.params;
  if (!businessIdSchema.safeParse(saleId).success) return errorResponse(400, "INVALID_SALE_ID", "La venta no es válida.");
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({ where: { id: saleId, businessId }, include: { items: true } });
      if (!sale) throw new Error("SALE_NOT_FOUND");
      if (sale.status !== "DRAFT") throw new Error("SALE_NOT_DRAFT");

      const stockItems = sale.items.filter((item) => item.productId);
      for (const item of stockItems) {
        const updated = await tx.product.updateMany({ where: { id: item.productId!, businessId, status: "ACTIVE", deletedAt: null, stock: { gte: item.quantity } }, data: { stock: { decrement: item.quantity } } });
        if (updated.count !== 1) throw new Error("INSUFFICIENT_STOCK");
      }

      if (stockItems.length) {
        await tx.inventoryMovement.createMany({ data: stockItems.map((item) => ({ businessId, productId: item.productId!, type: "SALE" as const, quantity: -item.quantity, saleId: sale.id, reason: `Sale ${sale.id}` })) });
      }

      const business = await tx.business.findUnique({ where: { id: businessId } });
      const customer = sale.customerId ? await tx.customer.findUnique({ where: { id: sale.customerId } }) : null;
      const arcaInvoice = await createArcaInvoice(tx, {
        business,
        customer,
        sale,
        items: sale.items,
      });

      const invoice = await tx.invoice.create({
        data: {
          businessId,
          saleId: sale.id,
          status: "ISSUED",
          number: arcaInvoice.number,
          totalMinor: sale.totalMinor,
          issuedAt: new Date(),
          cae: arcaInvoice.cae ?? null,
          caeExpiry: arcaInvoice.caeExpiry ?? null,
          arcaStatus: arcaInvoice.status,
          externalRef: arcaInvoice.externalReference ?? null,
          metadata: arcaInvoice.metadata ?? null,
          items: { create: sale.items.map((item) => ({ description: item.productName, quantity: item.quantity, unitPriceMinor: item.unitPriceMinor, totalMinor: item.totalMinor })) },
        },
      });

      const confirmedSale = await tx.sale.update({ where: { id: sale.id }, data: { status: "CONFIRMED", confirmedAt: new Date() }, include: { items: true, invoice: true } });
      await tx.activityEvent.create({ data: { businessId, actorId: access.user.id, type: "SALE_CONFIRMED", entityType: "Sale", entityId: sale.id, metadata: { totalMinor: sale.totalMinor, invoiceNumber: invoice.number, arcaStatus: arcaInvoice.status } } });
      return { sale: confirmedSale, invoice };
    }, { isolationLevel: "Serializable", timeout: 30_000 });
    return Response.json(result);
  } catch (error) {
    if (error instanceof Error) {
      const messages: Record<string, [number, string]> = { SALE_NOT_FOUND: [404, "Venta inexistente."], SALE_NOT_DRAFT: [409, "La venta ya fue procesada."], INSUFFICIENT_STOCK: [422, "Stock insuficiente."] };
      const mapped = messages[error.message];
      if (mapped) return errorResponse(mapped[0], error.message, mapped[1]);
      if (error instanceof ArcaError) return errorResponse(422, "ARCA_REJECTED", error.message);
    }
    return unexpectedError();
  }
}