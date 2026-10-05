import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage } from "pdf-lib";
import type { SaleTicketInput } from "@/server/fiscal/ticket";

const WIDTH = 227;
const MARGIN = 14;

const paymentLabels: Record<string, string> = {
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
  CARD: "Tarjeta",
  OTHER: "Otro",
};

function pdfText(value: string) {
  return value.replace(/[\u202f\u00a0]/g, " ").replace(/[^\n\x20-\x7e\u00a1-\u00ff]/g, "");
}

function money(minor: number) {
  return pdfText(new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(minor / 100));
}

function decodeDataImage(value: string | null | undefined) {
  if (!value) return null;
  const match = value.trim().match(/^data:image\/(png|jpe?g);base64,([a-z0-9+/=\s]+)$/i);
  if (!match) return null;
  return {
    kind: match[1].toLowerCase() === "png" ? "png" as const : "jpg" as const,
    bytes: Uint8Array.from(Buffer.from(match[2].replace(/\s/g, ""), "base64")),
  };
}

function fit(text: string, font: PDFFont, size: number, maxWidth: number) {
  let value = pdfText(text);
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value;
  while (value.length > 1 && font.widthOfTextAtSize(`${value}...`, size) > maxWidth) value = value.slice(0, -1);
  return `${value}...`;
}

export async function renderSaleTicketPdf(input: SaleTicketInput, assets?: { holosPng?: Uint8Array | null }) {
  const doc = await PDFDocument.create();
  doc.setTitle(pdfText(input.invoiceNumber) || "Comprobante");
  doc.setAuthor("Holos");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const holos = assets?.holosPng ? await doc.embedPng(assets.holosPng).catch(() => null) : null;
  const businessRaw = decodeDataImage(input.businessImage);
  const business = businessRaw
    ? await (businessRaw.kind === "png" ? doc.embedPng(businessRaw.bytes) : doc.embedJpg(businessRaw.bytes)).catch(() => null)
    : null;
  const qrRaw = input.fiscal && input.qrDataUrl ? decodeDataImage(input.qrDataUrl) : null;
  const qr = qrRaw?.kind === "png" ? await doc.embedPng(qrRaw.bytes).catch(() => null) : null;

  const when = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(input.createdAt);
  const serviceWhen = input.serviceDate ? new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeZone: "America/Argentina/Buenos_Aires" }).format(input.serviceDate) : "";
  const details = [serviceWhen && `Servicio ${serviceWhen}`, input.place && `Lugar ${input.place}`, input.description].filter((line): line is string => Boolean(line));
  const fiscal = Boolean(input.fiscal && input.cae && !input.cae.startsWith("MOCK"));

  type Row =
    | { kind: "logos" }
    | { kind: "text"; text: string; size: number; bold?: boolean }
    | { kind: "amount"; left: string; right: string; size: number; bold?: boolean }
    | { kind: "rule" }
    | { kind: "qr" }
    | { kind: "space"; size: number };

  const rows: Row[] = [
    { kind: "logos" },
    { kind: "text", text: (input.legalName || input.businessName).toUpperCase(), size: 11, bold: true },
    { kind: "text", text: input.businessName, size: 8 },
  ];
  if (input.taxId) rows.push({ kind: "text", text: `CUIT ${input.taxId}`, size: 8 });
  rows.push(
    { kind: "space", size: 6 },
    { kind: "text", text: input.invoiceNumber, size: 9, bold: true },
    { kind: "text", text: when, size: 8 },
    { kind: "text", text: input.customerName, size: 8 },
    { kind: "text", text: paymentLabels[input.paymentMethod ?? ""] ?? "Sin medio", size: 8 },
  );
  for (const detail of details) rows.push({ kind: "text", text: detail, size: 8 });
  rows.push({ kind: "space", size: 4 }, { kind: "rule" });
  for (const item of input.items) {
    rows.push({ kind: "amount", left: item.quantity > 1 ? `${item.productName} x${item.quantity}` : item.productName, right: money(item.totalMinor), size: 8 });
  }
  if (input.discountLabel && input.subtotalMinor !== undefined && input.subtotalMinor > input.totalMinor) {
    rows.push({ kind: "amount", left: "Subtotal", right: money(input.subtotalMinor), size: 8 });
    rows.push({ kind: "amount", left: input.discountLabel, right: `-${money(input.subtotalMinor - input.totalMinor)}`, size: 8 });
  }
  rows.push({ kind: "amount", left: "Total", right: money(input.totalMinor), size: 11, bold: true }, { kind: "space", size: 8 });
  if (fiscal && input.cae) {
    rows.push({ kind: "text", text: `CAE ${input.cae}`, size: 9, bold: true });
    if (input.caeExpiry) {
      rows.push({ kind: "text", text: `Vence ${new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(input.caeExpiry)}`, size: 8 });
    }
    if (qr) rows.push({ kind: "qr" });
  } else {
    rows.push({ kind: "text", text: "Comprobante interno.", size: 8, bold: true });
    rows.push({ kind: "text", text: "No es una factura fiscal.", size: 8 });
  }

  const logoHeight = 22;
  const rowHeight = (row: Row) => {
    if (row.kind === "logos") return holos || business ? logoHeight + 8 : 16;
    if (row.kind === "text") return row.size + 3;
    if (row.kind === "amount") return row.size + 6;
    if (row.kind === "rule") return 8;
    if (row.kind === "qr") return 110;
    return row.size;
  };
  const page = doc.addPage([WIDTH, MARGIN * 2 + rows.reduce((sum, row) => sum + rowHeight(row), 0) + 8]);
  let y = page.getHeight() - MARGIN;
  const ink = rgb(0.11, 0.09, 0.07);

  function drawFittedImage(image: PDFImage, x: number, top: number, height: number) {
    const width = (image.width / image.height) * height;
    page.drawImage(image, { x, y: top - height, width, height });
    return width;
  }

  for (const row of rows) {
    if (row.kind === "logos") {
      if (holos) drawFittedImage(holos, MARGIN, y, logoHeight);
      else page.drawText("HOLOS", { x: MARGIN, y: y - 12, size: 11, font: bold, color: ink });
      if (business) {
        const width = (business.width / business.height) * logoHeight;
        drawFittedImage(business, WIDTH - MARGIN - width, y, logoHeight);
      }
      y -= rowHeight(row);
      continue;
    }
    if (row.kind === "space") {
      y -= row.size;
      continue;
    }
    if (row.kind === "rule") {
      y -= 4;
      page.drawLine({ start: { x: MARGIN, y }, end: { x: WIDTH - MARGIN, y }, thickness: 0.4, color: rgb(0.5, 0.47, 0.42) });
      y -= 4;
      continue;
    }
    if (row.kind === "qr" && qr) {
      const size = 100;
      page.drawImage(qr, { x: (WIDTH - size) / 2, y: y - size, width: size, height: size });
      y -= 110;
      continue;
    }
    if (row.kind === "text") {
      const used = row.bold ? bold : font;
      page.drawText(fit(row.text, used, row.size, WIDTH - MARGIN * 2), { x: MARGIN, y: y - row.size, size: row.size, font: used, color: ink });
      y -= rowHeight(row);
      continue;
    }
    if (row.kind === "amount") {
      const used = row.bold ? bold : font;
      const right = pdfText(row.right);
      const rightWidth = used.widthOfTextAtSize(right, row.size);
      page.drawText(fit(row.left, used, row.size, WIDTH - MARGIN * 2 - rightWidth - 8), { x: MARGIN, y: y - row.size, size: row.size, font: used, color: ink });
      page.drawText(right, { x: WIDTH - MARGIN - rightWidth, y: y - row.size, size: row.size, font: used, color: ink });
      y -= rowHeight(row);
    }
  }

  return doc.save();
}
