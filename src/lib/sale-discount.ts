export type SaleDiscount =
  | { kind: "NONE" }
  | { kind: "PERCENT"; percentBps: number }
  | { kind: "PRICE"; priceMinor: number };

export function applySaleDiscount(subtotalMinor: number, discount: SaleDiscount) {
  if (discount.kind === "NONE" || subtotalMinor <= 0) {
    return { totalMinor: Math.max(0, subtotalMinor), discountMinor: 0 };
  }
  if (discount.kind === "PERCENT") {
    const totalMinor = Math.max(0, Math.round((subtotalMinor * (10_000 - discount.percentBps)) / 10_000));
    return { totalMinor, discountMinor: subtotalMinor - totalMinor };
  }
  if (discount.priceMinor > subtotalMinor) throw new Error("PRICE_ABOVE_LIST");
  return { totalMinor: discount.priceMinor, discountMinor: subtotalMinor - discount.priceMinor };
}

export function discountLabel(kind: "NONE" | "PERCENT" | "PRICE", percentBps: number | null) {
  if (kind === "PERCENT" && percentBps) {
    const percent = percentBps / 100;
    const text = Number.isInteger(percent) ? String(percent) : percent.toLocaleString("es-AR", { maximumFractionDigits: 2 });
    return `Descuento ${text}%`;
  }
  if (kind === "PRICE") return "Precio manual";
  return null;
}
