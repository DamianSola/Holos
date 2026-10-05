import { readFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { authorizeBusiness } from "@/server/auth/authorization";
import { fiscalQrUrl } from "@/server/fiscal/document";
import { renderSaleTicket } from "@/server/fiscal/ticket";
import { renderSaleTicketPdf } from "@/server/fiscal/ticket-pdf";
import { errorResponse, unexpectedError } from "@/server/http";
import { businessIdSchema } from "@/server/validators/domain";

type Context = { params: Promise<{ businessId: string; orderId: string }> };

let holosLogoPng: Uint8Array | null | undefined;

async function loadHolosLogo() {
  if (holosLogoPng !== undefined) return holosLogoPng;
  try {
    const svg = await readFile(path.join(process.cwd(), "public", "brand", "holos-logo.svg"), "utf8");
    const match = svg.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/);
    holosLogoPng = match ? Uint8Array.from(Buffer.from(match[1], "base64")) : null;
  } catch {
    holosLogoPng = null;
  }
  return holosLogoPng;
}

export async function GET(request: Request, context: Context) {
  const { businessId, orderId } = await context.params;
  if (!businessIdSchema.safeParse(orderId).success) return errorResponse(400, "INVALID_ORDER_ID", "La reserva no es válida.");
  const access = await authorizeBusiness(businessId, undefined, { allowWhenUnpaid: true });
  if ("response" in access) return access.response;

  try {
    const order = await prisma.customerOrder.findFirst({
      where: { id: orderId, businessId, kind: "SERVICE" },
      include: { customer: true, invoice: true, business: true, payments: { orderBy: { paidAt: "desc" }, take: 1 } },
    });
    if (!order) return errorResponse(404, "ORDER_NOT_FOUND", "La reserva no existe.");
    if (!order.invoice || !order.amountMinor) return errorResponse(409, "INVOICE_MISSING", "El comprobante está disponible cuando se emite desde la reserva.");

    const fiscal = order.invoice.arcaStatus === "AUTHORIZED" && Boolean(order.invoice.cae) && !order.invoice.cae?.startsWith("MOCK");
    const meta = readMeta(order.invoice.metadata);
    let qrDataUrl: string | null = null;
    if (fiscal && order.invoice.cae && meta.cuit && meta.cbteTipo && meta.cbteNro && meta.puntoVenta) {
      const url = fiscalQrUrl({
        date: order.invoice.issuedAt ?? order.createdAt,
        cuit: meta.cuit,
        pointOfSale: meta.puntoVenta,
        cbteTipo: meta.cbteTipo,
        cbteNro: meta.cbteNro,
        totalMinor: order.amountMinor,
        cae: order.invoice.cae,
      });
      qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 180 });
    }

    const ticket = {
      id: order.id,
      createdAt: order.invoice.issuedAt ?? order.createdAt,
      paymentMethod: order.payments[0]?.paymentMethod ?? null,
      totalMinor: order.amountMinor,
      businessName: order.business.name,
      legalName: order.business.legalName,
      taxId: order.business.taxId,
      customerName: order.customer.name,
      serviceDate: order.scheduledFor,
      place: order.place,
      description: null,
      items: [{ productName: order.title, quantity: 1, unitPriceMinor: order.amountMinor, totalMinor: order.amountMinor }],
      invoiceNumber: order.invoice.number,
      fiscal,
      cae: order.invoice.cae,
      caeExpiry: order.invoice.caeExpiry,
      qrDataUrl,
      businessImage: order.business.image,
    };
    if (new URL(request.url).searchParams.get("format") === "pdf") {
      const bytes = await renderSaleTicketPdf(ticket, { holosPng: await loadHolosLogo() });
      const filename = `${order.invoice.number.replace(/[^\w.-]+/g, "-")}.pdf`;
      return new Response(Buffer.from(bytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${filename}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    return new Response(renderSaleTicket(ticket), { headers: { "Content-Type": "text/html; charset=utf-8" } });
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
