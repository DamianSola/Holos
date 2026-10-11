import { applySaleDiscount, type SaleDiscount } from "@/lib/sale-discount";

export type DiscountInput = { kind: "NONE" } | { kind: "PERCENT"; percent: number } | { kind: "PRICE"; priceMinor: number };

export function discountFromInput(input: DiscountInput | undefined): SaleDiscount {
  if (!input || input.kind === "NONE") return { kind: "NONE" };
  if (input.kind === "PERCENT") return { kind: "PERCENT", percentBps: Math.min(10_000, Math.max(0, Math.round(input.percent * 100))) };
  return { kind: "PRICE", priceMinor: input.priceMinor };
}

export function quoteOrder(subtotalMinor: number, input: DiscountInput | undefined) {
  const discount = discountFromInput(input);
  try {
    const priced = applySaleDiscount(subtotalMinor, discount);
    return {
      ok: true as const,
      subtotalMinor,
      totalMinor: priced.totalMinor,
      discountKind: discount.kind,
      discountPercentBps: discount.kind === "PERCENT" ? discount.percentBps : null,
    };
  } catch {
    return { ok: false as const, code: "PRICE_ABOVE_LIST" as const };
  }
}
