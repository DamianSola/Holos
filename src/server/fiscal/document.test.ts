import { describe, expect, it } from "vitest";
import {
  afipMessages,
  buildFeCaeSolicitar,
  decodeXml,
  fiscalQrUrl,
  formatInvoiceNumber,
  internalReceipt,
  voucherFor,
} from "@/server/fiscal/document";
import { renderSaleTicket } from "@/server/fiscal/ticket";

describe("fiscal documents", () => {
  it("prices factura C without VAT and factura B with 21 percent", () => {
    const facturaC = voucherFor("MONOTRIBUTO", 10000);
    expect(facturaC).toMatchObject({ cbteTipo: 11, letter: "C", impTotal: "100.00", impNeto: "100.00", impIva: "0.00", iva: null });

    const facturaB = voucherFor("RESPONSABLE_INSCRIPTO", 12100);
    expect(facturaB.cbteTipo).toBe(6);
    expect(facturaB.impTotal).toBe("121.00");
    expect(facturaB.impNeto).toBe("100.00");
    expect(facturaB.impIva).toBe("21.00");
    expect(facturaB.iva).toEqual({ id: 5, base: "100.00", amount: "21.00" });
  });

  it("builds an authorized request without a fake CAE", () => {
    const xml = buildFeCaeSolicitar({
      token: "tok<en>",
      sign: "sig",
      cuit: "20111111112",
      pointOfSale: 1,
      cbteNro: 8,
      cbteFch: "20260929",
      voucher: voucherFor("MONOTRIBUTO", 150000),
    });
    expect(xml).toContain("<ar:CbteTipo>11</ar:CbteTipo>");
    expect(xml).toContain("<ar:CondicionIVAReceptorId>5</ar:CondicionIVAReceptorId>");
    expect(xml).not.toContain("AlicIva");
    expect(xml).toContain("&lt;en&gt;");
    expect(xml).not.toContain("MOCK-CAE");
  });

  it("includes VAT lines for factura B", () => {
    const xml = buildFeCaeSolicitar({
      token: "t",
      sign: "s",
      cuit: "20111111112",
      pointOfSale: 2,
      cbteNro: 1,
      cbteFch: "20260929",
      voucher: voucherFor("RESPONSABLE_INSCRIPTO", 12100),
    });
    expect(xml).toContain("<ar:CbteTipo>6</ar:CbteTipo>");
    expect(xml).toContain("<ar:Id>5</ar:Id>");
  });

  it("keeps internal receipts without a CAE", () => {
    const receipt = internalReceipt(4, "sale-1", 250000);
    expect(receipt.status).toBe("INTERNAL");
    expect(receipt.cae).toBeNull();
    expect(receipt.number).toBe("T-00000-00000004");
    expect(formatInvoiceNumber(3, 12, "C")).toBe("C-00003-00000012");
  });

  it("decodes AFIP faults and builds the fiscal QR", () => {
    expect(decodeXml("&lt;token&gt;abc&amp;d&lt;/token&gt;")).toBe("<token>abc&d</token>");
    expect(afipMessages("<Err><Msg>Punto de venta no habilitado</Msg></Err>")).toEqual(["Punto de venta no habilitado"]);
    const url = fiscalQrUrl({
      date: new Date("2026-09-29T15:00:00.000Z"),
      cuit: "20111111112",
      pointOfSale: 1,
      cbteTipo: 11,
      cbteNro: 8,
      totalMinor: 10000,
      cae: "12345678901234",
    });
    expect(url.startsWith("https://www.afip.gob.ar/fe/qr/?p=")).toBe(true);
  });
});

describe("sale ticket", () => {
  const sale = {
    id: "sale-1",
    createdAt: new Date("2026-09-29T15:00:00.000Z"),
    paymentMethod: "CASH",
    totalMinor: 250000,
    businessName: "Casa Norte",
    legalName: "Casa Norte SAS",
    taxId: "20111111112",
    customerName: "Ana",
    items: [{ productName: "Remera", quantity: 1, unitPriceMinor: 250000, totalMinor: 250000 }],
  };

  it("prints an internal ticket without pretending it is fiscal", () => {
    const html = renderSaleTicket({ ...sale, invoiceNumber: "T-00000-00000004", fiscal: false });
    expect(html).toContain("Comprobante interno");
    expect(html).toContain("Remera");
    expect(html).toContain("Ana");
    expect(html).not.toContain("MOCK-CAE");
    expect(html).not.toContain("CAE");
  });

  it("prints the real CAE when ARCA authorized the invoice", () => {
    const html = renderSaleTicket({
      ...sale,
      invoiceNumber: "C-00001-00000008",
      fiscal: true,
      cae: "12345678901234",
      caeExpiry: new Date("2026-10-09T02:59:59.000Z"),
      qrDataUrl: "data:image/png;base64,abc",
    });
    expect(html).toContain("12345678901234");
    expect(html).toContain("data:image/png;base64,abc");
    expect(html).not.toContain("Comprobante interno");
  });
});
