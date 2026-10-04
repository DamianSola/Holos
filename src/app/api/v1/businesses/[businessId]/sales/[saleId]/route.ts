import { prisma } from "@/lib/db";
import { authorizeBusiness } from "@/server/auth/authorization";
import { errorResponse, unexpectedError } from "@/server/http";
import { businessIdSchema } from "@/server/validators/domain";

type Context = { params: Promise<{ businessId: string; saleId: string }> };

export async function DELETE(_request: Request, context: Context) {
  const { businessId, saleId } = await context.params;
  if (!businessIdSchema.safeParse(businessId).success || !businessIdSchema.safeParse(saleId).success) return errorResponse(400, "INVALID_SALE_ID", "La venta no es válida.");
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;

  try {
    await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({ where: { id: saleId, businessId }, include: { items: true, invoice: true } });
      if (!sale) throw new Error("SALE_NOT_FOUND");
      if (sale.invoice?.arcaStatus === "AUTHORIZED" && sale.invoice.cae) throw new Error("FISCAL_INVOICE");

      if (sale.status === "CONFIRMED") {
        for (const item of sale.items) {
          if (!item.productId) continue;
          await tx.product.updateMany({ where: { id: item.productId, businessId }, data: { stock: { increment: item.quantity } } });
        }
      }

      await tx.inventoryMovement.deleteMany({ where: { saleId } });
      if (sale.invoice) {
        await tx.invoiceItem.deleteMany({ where: { invoiceId: sale.invoice.id } });
        await tx.invoice.delete({ where: { id: sale.invoice.id } });
      }
      await tx.activityEvent.create({
        data: {
          businessId,
          actorId: access.user.id,
          type: "SALE_DELETED",
          entityType: "Sale",
          entityId: sale.id,
          metadata: { totalMinor: sale.totalMinor, status: sale.status },
        },
      });
      await tx.sale.delete({ where: { id: saleId } });
    });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) {
      const messages: Record<string, [number, string]> = {
        SALE_NOT_FOUND: [404, "Venta inexistente."],
        FISCAL_INVOICE: [409, "Esta venta tiene una factura autorizada por ARCA y no se puede eliminar."],
      };
      const mapped = messages[error.message];
      if (mapped) return errorResponse(mapped[0], error.message, mapped[1]);
    }
    return unexpectedError();
  }
}
