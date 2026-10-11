export const orderInclude = {
  customer: { select: { id: true, name: true, phone: true } },
  product: { select: { id: true, name: true, priceMinor: true } },
  items: { select: { id: true, productId: true, productName: true, quantity: true, unitPriceMinor: true, totalMinor: true, deliveredAt: true } },
  payments: { select: { id: true, amountMinor: true, paymentMethod: true, paidAt: true }, orderBy: { paidAt: "asc" as const } },
  invoice: { select: { id: true, number: true, arcaStatus: true, cae: true } },
  sale: { select: { id: true } },
} as const;
