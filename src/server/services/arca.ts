import type { Prisma } from "@prisma/client";
import { fiscalProfileReady, internalReceipt } from "@/server/fiscal/document";
import { requestInvoiceAuthorization, type StoredProfile } from "@/server/fiscal/wsfe";

type Tx = Prisma.TransactionClient;

type ArcaInvoiceInput = {
  business: { id: string; name: string } | null;
  customer: { name: string } | null;
  sale: { id: string; totalMinor: number; createdAt: Date };
  items: Array<{ productName: string; quantity: number; unitPriceMinor: number; totalMinor: number }>;
};

export async function createArcaInvoice(tx: Tx, input: ArcaInvoiceInput) {
  const businessId = input.business?.id;
  const profile = businessId ? await tx.fiscalProfile.findUnique({ where: { businessId } }) : null;
  if (profile && fiscalProfileReady(profile)) {
    return requestInvoiceAuthorization(tx, profile as StoredProfile, input);
  }
  if (!businessId) return internalReceipt(1, input.sale.id, input.sale.totalMinor);
  const updated = await tx.business.update({
    where: { id: businessId },
    data: { receiptSeq: { increment: 1 } },
    select: { receiptSeq: true },
  });
  return internalReceipt(updated.receiptSeq, input.sale.id, input.sale.totalMinor, {
    business: input.business?.name,
    customer: input.customer?.name ?? "Consumidor final",
  });
}
