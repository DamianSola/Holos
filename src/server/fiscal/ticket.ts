function escapeHtml(value: unknown) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

const paymentLabels: Record<string, string> = {
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
  CARD: "Tarjeta",
  OTHER: "Otro",
};

export type SaleTicketInput = {
  id: string;
  createdAt: Date;
  paymentMethod: string | null;
  totalMinor: number;
  subtotalMinor?: number;
  discountLabel?: string | null;
  businessName: string;
  legalName?: string | null;
  taxId?: string | null;
  customerName: string;
  serviceDate?: Date | null;
  place?: string | null;
  description?: string | null;
  items: Array<{ productName: string; quantity: number; unitPriceMinor: number; totalMinor: number }>;
  invoiceNumber: string;
  fiscal: boolean;
  cae?: string | null;
  caeExpiry?: Date | null;
  qrDataUrl?: string | null;
  businessImage?: string | null;
};

export function renderSaleTicket(input: SaleTicketInput) {
  const when = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(input.createdAt);
  const serviceWhen = input.serviceDate ? new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeZone: "America/Argentina/Buenos_Aires" }).format(input.serviceDate) : "";
  const detail = [serviceWhen && `Servicio ${serviceWhen}`, input.place && `Lugar ${input.place}`, input.description].filter(Boolean).map((line) => `<br>${escapeHtml(line)}`).join("");
  const rows = input.items.map((item) => `<tr><td>${escapeHtml(item.productName)}${item.quantity > 1 ? `<br><span>x${item.quantity}</span>` : ""}</td><td>${money(item.totalMinor)}</td></tr>`).join("");
  const businessImage = input.businessImage?.trim() ?? "";
  const businessLogo = businessImage
    ? `<img class="logo business" alt="${escapeHtml(input.businessName)}" src="${escapeHtml(businessImage)}">`
    : "";
  const fiscalBlock = input.fiscal && input.cae
    ? `<p class="cae">CAE ${escapeHtml(input.cae)}</p><p>Vence ${escapeHtml(input.caeExpiry ? new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(input.caeExpiry) : "")}</p>${input.qrDataUrl ? `<img class="qr" alt="Código QR de ARCA" src="${escapeHtml(input.qrDataUrl)}">` : ""}`
    : `<p class="banner">Comprobante interno. No es una factura fiscal.</p>`;

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(input.invoiceNumber)}</title><style>
    body{margin:0;background:#f4f1ea;color:#1c1915;font-family:"Courier New",monospace}
    main{width:80mm;margin:24px auto;background:#fff;padding:16px 14px 20px}
    h1{margin:0;font-size:16px;letter-spacing:.12em;text-transform:uppercase}
    p,td{font-size:12px;line-height:1.4}
    .muted{color:#5c564c}
    table{width:100%;border-collapse:collapse;margin-top:12px}
    td{padding:6px 0;border-top:1px dashed #cfc6b8;vertical-align:top}
    td:last-child{text-align:right;white-space:nowrap}
    .total{display:flex;justify-content:space-between;margin-top:8px;font-size:16px;font-weight:700}
    .banner{margin-top:14px;padding:8px;border:1px solid #1c1915}
    .cae{font-weight:700;letter-spacing:.04em}
    .logos{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 10px}
    .logo{display:block;height:32px;width:auto;max-width:46%;object-fit:contain}
    .qr{display:block;width:140px;height:140px;margin:8px auto 0}
    button{margin-top:16px;width:100%;height:40px}
    @media print{body{background:#fff}main{margin:0}button{display:none}.logo,.qr{display:block;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body><main>
    <div class="logos"><img class="logo holos" alt="Holos" src="/brand/holos-logo.svg">${businessLogo}</div>
    <h1>${escapeHtml(input.legalName || input.businessName)}</h1>
    <p class="muted">${escapeHtml(input.businessName)}${input.taxId ? `<br>CUIT ${escapeHtml(input.taxId)}` : ""}</p>
    <p>${escapeHtml(input.invoiceNumber)}<br>${escapeHtml(when)}<br>${escapeHtml(input.customerName)}<br>${escapeHtml(paymentLabels[input.paymentMethod ?? ""] ?? "Sin medio")}${detail}</p>
    <table>${rows}</table>
    ${input.discountLabel && input.subtotalMinor !== undefined && input.subtotalMinor > input.totalMinor ? `<div class="total"><span>Subtotal</span><span>${money(input.subtotalMinor)}</span></div><div class="total"><span>${escapeHtml(input.discountLabel)}</span><span>-${money(input.subtotalMinor - input.totalMinor)}</span></div>` : ""}
    <div class="total"><span>Total</span><span>${money(input.totalMinor)}</span></div>
    ${fiscalBlock}
    <button type="button" onclick="window.print()">Imprimir</button>
  </main><script>(function(){function printTicket(){Promise.all([...document.images].map((img)=>img.decode?img.decode().catch(()=>{}):Promise.resolve())).then(()=>window.print())}if(document.readyState==="complete")printTicket();else window.addEventListener("load",printTicket)})()</script></body></html>`;
}

function money(minor: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(minor / 100);
}
