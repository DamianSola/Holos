import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type FiscalScreen = {
  legalName: string;
  cuit: string;
  pointOfSale: number;
  ivaCondition: "MONOTRIBUTO" | "RESPONSABLE_INSCRIPTO";
  environment: "HOMOLOGACION" | "PRODUCCION";
  certificatePem: string;
  privateKeyPem: string;
  certificateLoaded: boolean;
  privateKeyLoaded: boolean;
  configured: boolean;
};

type FiscalRow = {
  cuit: string;
  pointOfSale: number;
  ivaCondition: FiscalScreen["ivaCondition"];
  environment: FiscalScreen["environment"];
  certificateLoaded: boolean;
  privateKeyLoaded: boolean;
};

export async function getFiscalScreen(businessId: string): Promise<FiscalScreen> {
  const [business, rows] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { legalName: true, taxId: true } }),
    prisma.$queryRaw<FiscalRow[]>(Prisma.sql`
      SELECT cuit,
        "pointOfSale",
        "ivaCondition"::text AS "ivaCondition",
        environment::text AS environment,
        (octet_length("certCiphertext") > 0) AS "certificateLoaded",
        (octet_length("keyCiphertext") > 0) AS "privateKeyLoaded"
      FROM "FiscalProfile"
      WHERE "businessId" = ${businessId}::uuid
    `),
  ]);
  const profile = rows[0];
  const certificateLoaded = Boolean(profile?.certificateLoaded);
  const privateKeyLoaded = Boolean(profile?.privateKeyLoaded);
  const cuit = profile?.cuit ?? business?.taxId ?? "";
  return {
    legalName: business?.legalName ?? "",
    cuit,
    pointOfSale: profile?.pointOfSale ?? 1,
    ivaCondition: profile?.ivaCondition ?? "MONOTRIBUTO",
    environment: profile?.environment ?? "HOMOLOGACION",
    certificatePem: "",
    privateKeyPem: "",
    certificateLoaded,
    privateKeyLoaded,
    configured: certificateLoaded && privateKeyLoaded && Boolean(cuit),
  };
}
