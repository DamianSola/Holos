export class ArcaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArcaError";
  }
}

export type IvaCondition = "MONOTRIBUTO" | "RESPONSABLE_INSCRIPTO";

export type VoucherAmounts = {
  cbteTipo: number;
  letter: string;
  impTotal: string;
  impNeto: string;
  impIva: string;
  iva: { id: number; base: string; amount: string } | null;
};

export type IssuedDocument = {
  number: string;
  status: "INTERNAL" | "AUTHORIZED";
  externalReference: string | null;
  cae: string | null;
  caeExpiry: Date | null;
  metadata: Record<string, string | number | null>;
};

export function fiscalProfileReady(profile: { cuit: string; pointOfSale: number; certCiphertext: string; keyCiphertext: string }) {
  return /^\d{11}$/.test(profile.cuit) && profile.pointOfSale >= 1 && profile.certCiphertext.length > 0 && profile.keyCiphertext.length > 0;
}

export function voucherFor(condition: IvaCondition, totalMinor: number): VoucherAmounts {
  const impTotal = money(totalMinor);
  if (condition === "MONOTRIBUTO") {
    return { cbteTipo: 11, letter: "C", impTotal, impNeto: impTotal, impIva: "0.00", iva: null };
  }
  const netMinor = Math.round(totalMinor / 1.21);
  const ivaMinor = totalMinor - netMinor;
  return {
    cbteTipo: 6,
    letter: "B",
    impTotal,
    impNeto: money(netMinor),
    impIva: money(ivaMinor),
    iva: { id: 5, base: money(netMinor), amount: money(ivaMinor) },
  };
}

export function formatInvoiceNumber(pointOfSale: number, sequence: number, letter: string) {
  return `${letter}-${String(pointOfSale).padStart(5, "0")}-${String(sequence).padStart(8, "0")}`;
}

export function argentinaDateStamp(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date).replaceAll("-", "");
}

export function argentinaDateIso(date = new Date()) {
  const stamp = argentinaDateStamp(date);
  return `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`;
}

export function parseAfipDate(stamp: string) {
  const year = stamp.slice(0, 4);
  const month = stamp.slice(4, 6);
  const day = stamp.slice(6, 8);
  return new Date(`${year}-${month}-${day}T23:59:59-03:00`);
}

export function internalReceipt(sequence: number, saleId: string, totalMinor: number, extra?: { business?: string; customer?: string }): IssuedDocument {
  return {
    number: formatInvoiceNumber(0, sequence, "T"),
    status: "INTERNAL",
    externalReference: saleId,
    cae: null,
    caeExpiry: null,
    metadata: {
      provider: "HOLOS_TICKET",
      totalMinor,
      business: extra?.business ?? "",
      customer: extra?.customer ?? "",
    },
  };
}

export function fiscalQrUrl(input: {
  date: Date;
  cuit: string;
  pointOfSale: number;
  cbteTipo: number;
  cbteNro: number;
  totalMinor: number;
  cae: string;
}) {
  const payload = {
    ver: 1,
    fecha: argentinaDateIso(input.date),
    cuit: Number(input.cuit),
    ptoVta: input.pointOfSale,
    tipoCmp: input.cbteTipo,
    nroCmp: input.cbteNro,
    importe: Number(money(input.totalMinor)),
    moneda: "PES",
    ctz: 1,
    tipoDocRec: 99,
    nroDocRec: 0,
    tipoCodAut: "E",
    codAut: Number(input.cae),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");
  return `https://www.afip.gob.ar/fe/qr/?p=${encodeURIComponent(encoded)}`;
}

export function xmlEscape(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export function decodeXml(value: string) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

export function xmlValue(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<(?:\\w+:)?${tag}>([\\s\\S]*?)</(?:\\w+:)?${tag}>`));
  return match?.[1] ? decodeXml(match[1].trim()) : null;
}

export function afipMessages(xml: string) {
  return [...xml.matchAll(/<(?:\w+:)?Msg>([\s\S]*?)<\/(?:\w+:)?Msg>/g)]
    .map((match) => decodeXml(match[1].trim()))
    .filter(Boolean);
}

export function buildUltimoAutorizado(input: { token: string; sign: string; cuit: string; pointOfSale: number; cbteTipo: number }) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
    <ar:FECompUltimoAutorizado>
      <ar:Auth><ar:Token>${xmlEscape(input.token)}</ar:Token><ar:Sign>${xmlEscape(input.sign)}</ar:Sign><ar:Cuit>${input.cuit}</ar:Cuit></ar:Auth>
      <ar:PtoVta>${input.pointOfSale}</ar:PtoVta>
      <ar:CbteTipo>${input.cbteTipo}</ar:CbteTipo>
    </ar:FECompUltimoAutorizado>
  </soapenv:Body>
</soapenv:Envelope>`;
}

export function buildFeCaeSolicitar(input: {
  token: string;
  sign: string;
  cuit: string;
  pointOfSale: number;
  cbteNro: number;
  cbteFch: string;
  voucher: VoucherAmounts;
}) {
  const iva = input.voucher.iva
    ? `<ar:Iva><ar:AlicIva><ar:Id>${input.voucher.iva.id}</ar:Id><ar:BaseImp>${input.voucher.iva.base}</ar:BaseImp><ar:Importe>${input.voucher.iva.amount}</ar:Importe></ar:AlicIva></ar:Iva>`
    : "";
  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
    <ar:FECAESolicitar>
      <ar:Auth><ar:Token>${xmlEscape(input.token)}</ar:Token><ar:Sign>${xmlEscape(input.sign)}</ar:Sign><ar:Cuit>${input.cuit}</ar:Cuit></ar:Auth>
      <ar:FeCAEReq>
        <ar:FeCabReq>
          <ar:CantReg>1</ar:CantReg>
          <ar:PtoVta>${input.pointOfSale}</ar:PtoVta>
          <ar:CbteTipo>${input.voucher.cbteTipo}</ar:CbteTipo>
        </ar:FeCabReq>
        <ar:FeDetReq>
          <ar:FECAEDetRequest>
            <ar:Concepto>1</ar:Concepto>
            <ar:DocTipo>99</ar:DocTipo>
            <ar:DocNro>0</ar:DocNro>
            <ar:CbteDesde>${input.cbteNro}</ar:CbteDesde>
            <ar:CbteHasta>${input.cbteNro}</ar:CbteHasta>
            <ar:CbteFch>${input.cbteFch}</ar:CbteFch>
            <ar:ImpTotal>${input.voucher.impTotal}</ar:ImpTotal>
            <ar:ImpTotConc>0.00</ar:ImpTotConc>
            <ar:ImpNeto>${input.voucher.impNeto}</ar:ImpNeto>
            <ar:ImpOpEx>0.00</ar:ImpOpEx>
            <ar:ImpIVA>${input.voucher.impIva}</ar:ImpIVA>
            <ar:ImpTrib>0.00</ar:ImpTrib>
            <ar:MonId>PES</ar:MonId>
            <ar:MonCotiz>1</ar:MonCotiz>
            <ar:CondicionIVAReceptorId>5</ar:CondicionIVAReceptorId>
            ${iva}
          </ar:FECAEDetRequest>
        </ar:FeDetReq>
      </ar:FeCAEReq>
    </ar:FECAESolicitar>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function money(minor: number) {
  return (minor / 100).toFixed(2);
}
