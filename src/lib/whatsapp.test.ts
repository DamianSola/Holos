import { describe, expect, it } from "vitest";
import { receiptText, whatsappHref, whatsappPhone } from "@/lib/whatsapp";

describe("whatsapp phone", () => {
  it("keeps an Argentine mobile that already includes the country code", () => {
    expect(whatsappPhone("+54 9 11 5555-6666")).toBe("5491155556666");
    expect(whatsappHref("+54 9 11 5555-6666")).toBe("https://wa.me/5491155556666");
  });

  it("adds the country code and the mobile 9 to a local number", () => {
    expect(whatsappPhone("11 5555 6666")).toBe("5491155556666");
    expect(whatsappPhone("011 15 5555 6666")).toBe("5491155556666");
    expect(whatsappPhone("351 15 555 6666")).toBe("5493515556666");
  });

  it("ignores a phone that cannot be a WhatsApp number", () => {
    expect(whatsappPhone("")).toBeNull();
    expect(whatsappPhone("abc")).toBeNull();
    expect(whatsappPhone("123")).toBeNull();
    expect(whatsappHref("123", "Hola")).toBeNull();
  });

  it("puts the receipt in the message and leaves the send to the person", () => {
    const href = whatsappHref("11 5555 6666", "Hola Ana");
    expect(href).toBe("https://wa.me/5491155556666?text=Hola%20Ana");
  });
});

describe("receipt text", () => {
  const receipt = {
    businessName: "Local Ticket",
    customerName: "Ana",
    invoiceNumber: "T-00000-00000001",
    when: new Date("2026-10-04T20:48:00.000Z"),
    lines: ["Remera prueba x1"],
    totalMinor: 150000,
  };

  it("shares an internal receipt without inventing a CAE", () => {
    const text = receiptText({ ...receipt, cae: "MOCK-CAE" });
    expect(text).toContain("Hola Ana, te comparto el comprobante de Local Ticket.");
    expect(text).toContain("T-00000-00000001");
    expect(text).toContain("Remera prueba x1");
    expect(text).toContain("1.500");
    expect(text).toContain("Comprobante interno");
    expect(text).not.toContain("MOCK-CAE");
    expect(text).not.toContain("CAE");
  });

  it("includes the real CAE when ARCA authorized the invoice", () => {
    const text = receiptText({ ...receipt, invoiceNumber: "C-00001-00000008", cae: "12345678901234" });
    expect(text).toContain("CAE 12345678901234");
    expect(text).not.toContain("Comprobante interno");
  });
});
