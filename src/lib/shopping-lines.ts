export function shortageQuantity(stock: number, minimum: number) {
  if (!Number.isFinite(stock) || !Number.isFinite(minimum) || stock > minimum) return 0;
  return Math.max(1, minimum - stock);
}
