import { describe, expect, it } from "vitest";
import { collectionLabel, paidMinor, paymentFits, remainingMinor } from "@/lib/reservation-money";

describe("reservation money", () => {
  it("sums payments and leaves the unpaid balance", () => {
    const payments = [{ amountMinor: 150000 }, { amountMinor: 50000 }];
    expect(paidMinor(payments)).toBe(200000);
    expect(remainingMinor(450000, payments)).toBe(250000);
  });

  it("accepts a deposit up to the balance and rejects one past it", () => {
    expect(paymentFits(450000, 150000, 300000)).toBe(true);
    expect(paymentFits(450000, 150000, 300001)).toBe(false);
    expect(paymentFits(450000, 0, 0)).toBe(false);
  });

  it("names the collection state", () => {
    expect(collectionLabel(450000, 0)).toBe("Sin pago");
    expect(collectionLabel(450000, 150000)).toBe("Seña");
    expect(collectionLabel(450000, 450000)).toBe("Pagada");
  });
});
