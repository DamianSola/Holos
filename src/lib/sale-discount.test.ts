import { describe, expect, it } from "vitest";
import { applySaleDiscount, discountLabel } from "@/lib/sale-discount";

describe("sale discounts", () => {
  it("keeps the list total when there is no discount", () => {
    expect(applySaleDiscount(150000, { kind: "NONE" })).toEqual({ totalMinor: 150000, discountMinor: 0 });
  });

  it("applies a percentage and rounds to cents", () => {
    expect(applySaleDiscount(100000, { kind: "PERCENT", percentBps: 1000 })).toEqual({ totalMinor: 90000, discountMinor: 10000 });
    expect(applySaleDiscount(333, { kind: "PERCENT", percentBps: 1000 }).totalMinor).toBe(300);
  });

  it("charges the typed price when it does not exceed the list", () => {
    expect(applySaleDiscount(200000, { kind: "PRICE", priceMinor: 150000 })).toEqual({ totalMinor: 150000, discountMinor: 50000 });
    expect(() => applySaleDiscount(200000, { kind: "PRICE", priceMinor: 200001 })).toThrow("PRICE_ABOVE_LIST");
  });

  it("labels a percent discount in Spanish", () => {
    expect(discountLabel("PERCENT", 1050)).toBe("Descuento 10,5%");
    expect(discountLabel("PRICE", null)).toBe("Precio manual");
  });
});
