import { prisma } from "@/lib/db";
import { authorizeBusiness } from "@/server/auth/authorization";
import { ArcaError } from "@/server/fiscal/document";
import { errorResponse, unexpectedError } from "@/server/http";
import { createArcaInvoice } from "@/server/services/arca";
import { businessIdSchema } from "@/server/validators/domain";

type Context = { params: Promise<{ businessId: string; orderId: string }> };

export async function POST(_request: Request, context: Context) {
  const { businessId, orderId } = await context.params;
  if (!businessIdSchema.safeParse(orderId).success) return errorResponse(400, "INVALID_ORDER_ID", "La reserva no es válida.");
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;

  try {
    const invoice = await prisma.$transaction(async (tx) => {
      const order = await tx.customerOrder.findFirst({
        where: { id: orderId, businessId },
        include: { customer: true, invoice: true, payments: { orderBy: { paidAt: "desc" }, take: 1 } },
      });
      if (!order || order.kind !== "SERVICE") throw new Error("ORDER_NOT_FOUND");
      if (order.invoice) throw new Error("INVOICE_EXISTS");
      if (!order.amountMinor) throw new Error("BUDGET_REQUIRED");

      const business = await tx.business.findUnique({ where: { id: businessId } });
      const issued = await createArcaInvoice(tx, {
        business,
        customer: order.customer,
        sale: { id: order.id, totalMinor: order.amountMinor, createdAt: order.createdAt },
        items: [{ productName: order.title.trim() || order.customer.name, quantity: 1, unitPriceMinor: order.amountMinor, totalMinor: order.amountMinor }],
      });
      const created = await tx.invoice.create({
        data: {
          businessId,
          orderId: order.id,
          status: "ISSUED",
          number: issued.number,
          totalMinor: order.amountMinor,
          issuedAt: new Date(),
          cae: issued.cae ?? null,
          caeExpiry: issued.caeExpiry ?? null,
          arcaStatus: issued.status,
          externalRef: issued.externalReference ?? null,
          metadata: issued.metadata ?? null,
          items: { create: [{ description: order.title.trim() || order.customer.name, quantity: 1, unitPriceMinor: order.amountMinor, totalMinor: order.amountMinor }] },
        },
      });
      await tx.activityEvent.create({
        data: {
          businessId,
          actorId: access.user.id,
          type: "RESERVATION_INVOICED",
          entityType: "CustomerOrder",
          entityId: order.id,
          metadata: { invoiceNumber: created.number, totalMinor: order.amountMinor },
        },
      });
      return created;
    }, { isolationLevel: "Serializable", timeout: 30_000 });
    return Response.json(invoice, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      const messages: Record<string, [number, string]> = {
        ORDER_NOT_FOUND: [404, "La reserva no existe."],
        INVOICE_EXISTS: [409, "Esta reserva ya tiene comprobante."],
        BUDGET_REQUIRED: [422, "Cargá el presupuesto antes de emitir el comprobante."],
      };
      const mapped = messages[error.message];
      if (mapped) return errorResponse(mapped[0], error.message, mapped[1]);
      if (error instanceof ArcaError) return errorResponse(422, "ARCA_REJECTED", error.message);
    }
    return unexpectedError();
  }
}
