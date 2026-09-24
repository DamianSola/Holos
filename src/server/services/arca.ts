type ArcaInvoiceInput = {
  business: { id: string; name: string; taxId?: string | null; legalName?: string | null } | null;
  customer: { id: string; name: string; email?: string | null; phone?: string | null } | null;
  sale: { id: string; totalMinor: number; createdAt: Date; customerId?: string | null };
  items: Array<{ productName: string; quantity: number; unitPriceMinor: number; totalMinor: number }>;
};

export async function createArcaInvoice(input: ArcaInvoiceInput) {
  const isEnabled = process.env.ARCA_MODE === "live" || process.env.ARCA_API_URL;

  if (!isEnabled) {
    const fallbackNumber = `ARCA-MOCK-${input.sale.id.slice(0, 8).toUpperCase()}`;
    return {
      number: fallbackNumber,
      status: "MOCKED",
      externalReference: `mock-${input.sale.id}`,
      cae: "MOCK-CAE",
      caeExpiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      metadata: {
        provider: "ARCA_MOCK",
        business: input.business?.name ?? "Sin nombre",
        customer: input.customer?.name ?? "Consumidor final",
        totalMinor: input.sale.totalMinor,
      },
    };
  }

  const response = await fetch(process.env.ARCA_API_URL ?? "http://localhost:4000/arcas/invoice", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(process.env.ARCA_API_TOKEN ? { Authorization: `Bearer ${process.env.ARCA_API_TOKEN}` } : {}) },
    body: JSON.stringify({
      business: {
        id: input.business?.id,
        name: input.business?.name,
        legalName: input.business?.legalName ?? input.business?.name,
        taxId: input.business?.taxId ?? "00000000000",
      },
      customer: {
        id: input.customer?.id,
        name: input.customer?.name ?? "Consumidor final",
        email: input.customer?.email ?? null,
        phone: input.customer?.phone ?? null,
      },
      saleId: input.sale.id,
      totalMinor: input.sale.totalMinor,
      items: input.items.map((item) => ({
        description: item.productName,
        quantity: item.quantity,
        unitPriceMinor: item.unitPriceMinor,
        totalMinor: item.totalMinor,
      })),
    }),
  });

  if (!response.ok) {
    throw new Error("ARCA_INVOICE_FAILED");
  }

  const payload = await response.json().catch(() => null);
  return {
    number: payload?.number ?? `ARCA-${input.sale.id.slice(0, 8).toUpperCase()}`,
    status: payload?.status ?? "EMITIDA",
    externalReference: payload?.externalReference ?? input.sale.id,
    cae: payload?.cae ?? null,
    caeExpiry: payload?.caeExpiry ? new Date(payload.caeExpiry) : null,
    metadata: payload ?? {},
  };
}
