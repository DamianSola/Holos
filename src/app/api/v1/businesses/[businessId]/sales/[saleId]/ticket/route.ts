import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { authorizeBusiness } from "@/server/auth/authorization";
import { fiscalQrUrl } from "@/server/fiscal/document";
import { discountLabel } from "@/lib/sale-discount";
import { renderSaleTicket } from "@/server/fiscal/ticket";
import { errorResponse, unexpectedError } from "@/server/http";
import { businessIdSchema } from "@/server/validators/domain";

type Context = { params: Promise<{ businessId: string; saleId: string }> };

export async function GET(_request: Request, context: Context) {
  const { businessId, saleId } = await context.params;
  if (!businessIdSchema.safeParse(saleId).success) return errorResponse(400, "INVALID_SALE_ID", "La venta no es válida.");
  const access = await authorizeBusiness(businessId, undefined, { allowWhenUnpaid: true });
  if ("response" in access) return access.response;

  try {
    const sale = await prisma.sale.findFirst({
      where: { id: saleId, businessId },
      include: { items: true, customer: true, invoice: true, business: true },
    });
    if (!sale) return errorResponse(404, "SALE_NOT_FOUND", "Venta inexistente.");
    if (sale.status !== "CONFIRMED" || !sale.invoice) return errorResponse(409, "SALE_NOT_CONFIRMED", "El ticket está disponible cuando la venta está confirmada.");

    const fiscal = sale.invoice.arcaStatus === "AUTHORIZED" && Boolean(sale.invoice.cae) && !sale.invoice.cae?.startsWith("MOCK");
    const meta = readMeta(sale.invoice.metadata);
    let qrDataUrl: string | null = null;
    if (fiscal && sale.invoice.cae && meta.cuit && meta.cbteTipo && meta.cbteNro && meta.puntoVenta) {
      const url = fiscalQrUrl({
        date: sale.invoice.issuedAt ?? sale.confirmedAt ?? sale.createdAt,
        cuit: meta.cuit,
        pointOfSale: meta.puntoVenta,
        cbteTipo: meta.cbteTipo,
        cbteNro: meta.cbteNro,
        totalMinor: sale.totalMinor,
        cae: sale.invoice.cae,
      });
      qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 180 });
    }

    const html = renderSaleTicket({
      id: sale.id,
      createdAt: sale.confirmedAt ?? sale.createdAt,
      paymentMethod: sale.paymentMethod,
      totalMinor: sale.totalMinor,
      subtotalMinor: sale.subtotalMinor,
      discountLabel: discountLabel(sale.discountKind, sale.discountPercentBps),
      businessName: sale.business.name,
      legalName: sale.business.legalName,
      taxId: sale.business.taxId,
      customerName: sale.customer?.name ?? "Consumidor final",
      serviceDate: sale.serviceDate,
      place: sale.place,
      description: sale.place ? null : sale.description,
      items: sale.items,
      invoiceNumber: sale.invoice.number,
      fiscal,
      cae: sale.invoice.cae,
      caeExpiry: sale.invoice.caeExpiry,
      qrDataUrl,
      businessImage: sale.business.image,
    });
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch {
    return unexpectedError();
  }
}

function readMeta(value: unknown) {
  if (!value || typeof value !== "object") return { cbteTipo: null, cbteNro: null, cuit: null, puntoVenta: null };
  const record = value as Record<string, unknown>;
  return {
    cbteTipo: typeof record.cbteTipo === "number" ? record.cbteTipo : null,
    cbteNro: typeof record.cbteNro === "number" ? record.cbteNro : null,
    cuit: typeof record.cuit === "string" ? record.cuit : null,
    puntoVenta: typeof record.puntoVenta === "number" ? record.puntoVenta : null,
  };
}
