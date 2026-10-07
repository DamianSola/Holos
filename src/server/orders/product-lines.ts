import { prisma } from "@/lib/db";

type RequestedLine = { productId: string; quantity: number };
type StoredLine = { productId: string | null; unitPriceMinor: number };

export async function buildProductLines(businessId: string, items: RequestedLine[], previous: StoredLine[]) {
  const ids = [...new Set(items.map((item) => item.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, businessId, deletedAt: null, status: "ACTIVE", catalogKind: "PRODUCT" },
    select: { id: true, name: true, priceMinor: true },
  });
  if (products.length !== ids.length) return { ok: false as const, code: "PRODUCT_NOT_FOUND" as const };

  const lines = [];
  for (const item of items) {
    const product = products.find((candidate) => candidate.id === item.productId)!;
    const stored = previous.find((line) => line.productId === item.productId);
    const unitPriceMinor = stored?.unitPriceMinor ?? product.priceMinor;
    if (unitPriceMinor > 0 && item.quantity > Math.floor(2_147_483_647 / unitPriceMinor)) return { ok: false as const, code: "AMOUNT_TOO_LARGE" as const };
    lines.push({
      productId: product.id,
      productName: product.name,
      quantity: item.quantity,
      unitPriceMinor,
      totalMinor: unitPriceMinor * item.quantity,
    });
  }

  const amountMinor = lines.reduce((total, line) => total + line.totalMinor, 0);
  if (amountMinor > 2_147_483_647) return { ok: false as const, code: "AMOUNT_TOO_LARGE" as const };
  const title = lines.map((line) => line.productName).join(", ");
  return {
    ok: true as const,
    lines,
    amountMinor,
    title: title.length <= 160 ? title : `${title.slice(0, 157)}…`,
    quantity: lines.reduce((total, line) => total + line.quantity, 0),
    productId: lines[0].productId,
  };
}
