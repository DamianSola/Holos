import type { Prisma } from "@prisma/client";
import forge from "node-forge";
import { prisma } from "@/lib/db";
import {
  ArcaError,
  afipMessages,
  argentinaDateStamp,
  buildFeCaeSolicitar,
  buildUltimoAutorizado,
  formatInvoiceNumber,
  parseAfipDate,
  voucherFor,
  xmlValue,
  type IssuedDocument,
  type IvaCondition,
} from "@/server/fiscal/document";
import { openSecret } from "@/server/fiscal/seal";

const ENDPOINTS = {
  HOMOLOGACION: {
    wsaa: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
    wsfe: "https://wswhomo.afip.gov.ar/wsfev1/service.asmx",
  },
  PRODUCCION: {
    wsaa: "https://wsaa.afip.gov.ar/ws/services/LoginCms",
    wsfe: "https://servicios1.afip.gov.ar/wsfev1/service.asmx",
  },
} as const;

export type StoredProfile = {
  businessId: string;
  cuit: string;
  pointOfSale: number;
  ivaCondition: IvaCondition;
  environment: "HOMOLOGACION" | "PRODUCCION";
  certCiphertext: string;
  keyCiphertext: string;
  wsaaToken: string | null;
  wsaaSign: string | null;
  wsaaExpiresAt: Date | null;
};

type SaleInput = {
  business: { id: string; name: string } | null;
  customer: { name: string } | null;
  sale: { id: string; totalMinor: number; createdAt: Date };
  items: Array<{ productName: string; quantity: number; unitPriceMinor: number; totalMinor: number }>;
};

type Auth = { token: string; sign: string; expiresAt: Date };
type Context = "sale" | "probe";

const memory = new Map<string, Auth>();

function cacheKey(profile: StoredProfile) {
  return `${profile.environment}:${profile.cuit}`;
}

function readCache(profile: StoredProfile) {
  const limit = Date.now() + 2 * 60 * 1000;
  const cached = memory.get(cacheKey(profile));
  if (cached && cached.expiresAt.getTime() > limit) return cached;
  if (profile.wsaaToken && profile.wsaaSign && profile.wsaaExpiresAt && profile.wsaaExpiresAt.getTime() > limit) {
    const auth = { token: profile.wsaaToken, sign: profile.wsaaSign, expiresAt: profile.wsaaExpiresAt };
    memory.set(cacheKey(profile), auth);
    return auth;
  }
  return null;
}

function failure(detail: string, context: Context) {
  const suffix = context === "sale" ? " La venta no se confirmó y el stock no cambió." : "";
  return new ArcaError(`${detail}${suffix}`);
}

function argentinaTimestamp(date: Date) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return `${parts.replace(" ", "T")}-03:00`;
}

function signCms(xml: string, certPem: string, keyPem: string) {
  const certificate = forge.pki.certificateFromPem(certPem);
  const key = forge.pki.privateKeyFromPem(keyPem);
  const signed = forge.pkcs7.createSignedData();
  signed.content = forge.util.createBuffer(xml, "utf8");
  signed.addCertificate(certificate);
  signed.addSigner({
    key,
    certificate,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() as unknown as string },
    ],
  });
  signed.sign({ detached: false });
  return forge.util.encode64(forge.asn1.toDer(signed.toAsn1()).getBytes());
}

async function soap(url: string, action: string, body: string, context: Context) {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: action },
      body,
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw failure("ARCA no respondió.", context);
  }
  const text = await response.text();
  if (!response.ok || text.includes("Fault")) {
    const fault = xmlValue(text, "faultstring") ?? "ARCA rechazó el pedido.";
    throw failure(fault.slice(0, 280), context);
  }
  return text;
}

async function login(profile: StoredProfile, context: Context, tx?: Prisma.TransactionClient) {
  const cached = readCache(profile);
  if (cached) return cached;

  let cms = "";
  try {
    cms = signCms(loginTicketXml(), openSecret(profile.certCiphertext), openSecret(profile.keyCiphertext));
  } catch {
    throw failure("El certificado o la clave privada no se pueden usar.", context);
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov"><soapenv:Header/><soapenv:Body><wsaa:loginCms><wsaa:in0><![CDATA[${cms}]]></wsaa:in0></wsaa:loginCms></soapenv:Body></soapenv:Envelope>`;
  const xml = await soap(ENDPOINTS[profile.environment].wsaa, "", body, context);
  const ticket = xmlValue(xml, "loginCmsReturn") ?? xml;
  const token = xmlValue(ticket, "token");
  const sign = xmlValue(ticket, "sign");
  const expiration = xmlValue(ticket, "expirationTime");
  if (!token || !sign) {
    const detail = afipMessages(xml).join(" ") || "No se pudo autenticar el certificado con ARCA.";
    throw failure(detail.slice(0, 280), context);
  }

  const auth = { token, sign, expiresAt: expiration ? new Date(expiration) : new Date(Date.now() + 10 * 60 * 60 * 1000) };
  memory.set(cacheKey(profile), auth);
  const data = { wsaaToken: auth.token, wsaaSign: auth.sign, wsaaExpiresAt: auth.expiresAt };
  if (tx) await tx.fiscalProfile.update({ where: { businessId: profile.businessId }, data });
  else await prisma.fiscalProfile.update({ where: { businessId: profile.businessId }, data });
  return auth;
}

function loginTicketXml() {
  const uniqueId = Math.floor(Date.now() / 1000);
  return `<?xml version="1.0" encoding="UTF-8"?><loginTicketRequest version="1.0"><header><uniqueId>${uniqueId}</uniqueId><generationTime>${argentinaTimestamp(new Date(Date.now() - 5 * 60 * 1000))}</generationTime><expirationTime>${argentinaTimestamp(new Date(Date.now() + 12 * 60 * 60 * 1000))}</expirationTime></header><service>wsfe</service></loginTicketRequest>`;
}

async function lastNumber(profile: StoredProfile, auth: Auth, cbteTipo: number, context: Context) {
  const xml = await soap(
    ENDPOINTS[profile.environment].wsfe,
    "http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado",
    buildUltimoAutorizado({ token: auth.token, sign: auth.sign, cuit: profile.cuit, pointOfSale: profile.pointOfSale, cbteTipo }),
    context,
  );
  const number = xmlValue(xml, "CbteNro");
  if (number === null) {
    const detail = afipMessages(xml).join(" ") || "ARCA no informó el último comprobante.";
    throw failure(detail.slice(0, 280), context);
  }
  return Number(number);
}

export async function requestInvoiceAuthorization(tx: Prisma.TransactionClient, profile: StoredProfile, input: SaleInput): Promise<IssuedDocument> {
  if (input.sale.totalMinor <= 0) throw failure("El importe de la factura tiene que ser mayor a cero.", "sale");
  const voucher = voucherFor(profile.ivaCondition, input.sale.totalMinor);
  const auth = await login(profile, "sale", tx);
  const cbteNro = await lastNumber(profile, auth, voucher.cbteTipo, "sale") + 1;
  const xml = await soap(
    ENDPOINTS[profile.environment].wsfe,
    "http://ar.gov.afip.dif.FEV1/FECAESolicitar",
    buildFeCaeSolicitar({
      token: auth.token,
      sign: auth.sign,
      cuit: profile.cuit,
      pointOfSale: profile.pointOfSale,
      cbteNro,
      cbteFch: argentinaDateStamp(input.sale.createdAt),
      voucher,
    }),
    "sale",
  );
  const resultado = xmlValue(xml, "Resultado");
  const cae = xmlValue(xml, "CAE");
  const expiry = xmlValue(xml, "CAEFchVto");
  if (resultado !== "A" || !cae || !expiry) {
    const detail = afipMessages(xml).join(" ") || "ARCA no autorizó el comprobante.";
    throw failure(detail.slice(0, 280), "sale");
  }
  return {
    number: formatInvoiceNumber(profile.pointOfSale, cbteNro, voucher.letter),
    status: "AUTHORIZED",
    externalReference: cae,
    cae,
    caeExpiry: parseAfipDate(expiry),
    metadata: {
      provider: "ARCA",
      environment: profile.environment,
      cbteTipo: voucher.cbteTipo,
      puntoVenta: profile.pointOfSale,
      cbteNro,
      cuit: profile.cuit,
      resultado,
    },
  };
}

export async function probeFiscalConnection(profile: StoredProfile) {
  const voucher = voucherFor(profile.ivaCondition, 100);
  const auth = await login(profile, "probe");
  const lastNumberValue = await lastNumber(profile, auth, voucher.cbteTipo, "probe");
  return { lastNumber: lastNumberValue, environment: profile.environment, letter: voucher.letter };
}
