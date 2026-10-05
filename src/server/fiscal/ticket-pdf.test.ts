import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { renderSaleTicketPdf } from "@/server/fiscal/ticket-pdf";
import type { SaleTicketInput } from "@/server/fiscal/ticket";

const sale: SaleTicketInput = {
  id: "sale-1",
  createdAt: new Date("2026-10-04T20:48:00.000Z"),
  paymentMethod: "CASH",
  totalMinor: 150000,
  businessName: "Local Ticket",
  legalName: "Local Ticket SAS",
  taxId: "20111111112",
  customerName: "Ana",
  items: [{ productName: "Remera prueba", quantity: 1, unitPriceMinor: 150000, totalMinor: 150000 }],
  invoiceNumber: "T-00000-00000002",
  fiscal: false,
};

const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64"));

describe("sale ticket pdf", () => {
  it("builds a PDF receipt without pretending an internal ticket is fiscal", async () => {
    const bytes = await renderSaleTicketPdf({ ...sale, businessImage: `data:image/png;base64,${Buffer.from(png).toString("base64")}` }, { holosPng: png });
    expect(Buffer.from(bytes.subarray(0, 5)).toString("ascii")).toBe("%PDF-");
    const document = await PDFDocument.load(bytes);
    expect(document.getTitle()).toBe("T-00000-00000002");
    expect(document.getPageCount()).toBe(1);
  });

  it("keeps the authorized CAE in the document title path and still renders", async () => {
    const bytes = await renderSaleTicketPdf({
      ...sale,
      invoiceNumber: "C-00001-00000008",
      fiscal: true,
      cae: "12345678901234",
      caeExpiry: new Date("2026-10-14T02:59:59.000Z"),
      qrDataUrl: `data:image/png;base64,${Buffer.from(png).toString("base64")}`,
    });
    const document = await PDFDocument.load(bytes);
    expect(document.getTitle()).toBe("C-00001-00000008");
    expect(document.getPage(0).getHeight()).toBeGreaterThan(200);
  });
});