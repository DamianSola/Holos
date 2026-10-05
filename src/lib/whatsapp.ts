const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

export function whatsappPhone(value: string): string | null {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("54")) digits = digits.slice(2);
  digits = digits.replace(/^0+/, "");
  if (!digits.startsWith("9")) {
    if (digits.startsWith("15") && digits.length > 10) digits = digits.slice(2);
    else digits = digits.replace(/^(\d{2,4})15(?=\d{6,8}$)/, "$1");
    digits = `9${digits}`;
  }
  if (digits.length < 10 || digits.length > 13) return null;
  const number = `54${digits}`;
  if (number.length < 12 || number.length > 15) return null;
  return number;
}

export function whatsappHref(phone: string, text?: string): string | null {
  const number = whatsappPhone(phone);
  if (!number) return null;
  if (!text) return `https://wa.me/${number}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function receiptText(input: {
  businessName: string;
  customerName: string;
  invoiceNumber?: string | null;
  when: Date;
  lines: string[];
  totalMinor: number;
  cae?: string | null;
}) {
  const when = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(input.when);
  const cae = input.cae && !input.cae.startsWith("MOCK") ? input.cae : null;
  return [
    `Hola ${input.customerName}, te comparto el comprobante de ${input.businessName}.`,
    "",
    input.invoiceNumber,
    when,
    ...input.lines,
    `Total: ${money.format(input.totalMinor / 100)}`,
    cae ? `CAE ${cae}` : "Comprobante interno. No es una factura fiscal.",
  ].filter((line) => line != null && line !== "").join("\n");
}
