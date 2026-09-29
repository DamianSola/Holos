import { prisma } from "@/lib/db";
import { authorizeBusiness } from "@/server/auth/authorization";
import { ArcaError } from "@/server/fiscal/document";
import { sealSecret } from "@/server/fiscal/seal";
import { errorResponse, unexpectedError } from "@/server/http";
import { fiscalProfileSchema } from "@/server/validators/domain";

type Context = { params: Promise<{ businessId: string }> };

export async function GET(_request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId, ["OWNER"]);
  if ("response" in access) return access.response;

  const [business, profile] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { legalName: true, taxId: true } }),
    prisma.fiscalProfile.findUnique({ where: { businessId } }),
  ]);

  return Response.json({
    legalName: business?.legalName ?? "",
    cuit: profile?.cuit ?? business?.taxId ?? "",
    pointOfSale: profile?.pointOfSale ?? 1,
    ivaCondition: profile?.ivaCondition ?? "MONOTRIBUTO",
    environment: profile?.environment ?? "HOMOLOGACION",
    certificateLoaded: Boolean(profile?.certCiphertext),
    privateKeyLoaded: Boolean(profile?.keyCiphertext),
    configured: Boolean(profile?.certCiphertext && profile.keyCiphertext && profile.cuit),
  });
}

export async function PUT(request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId, ["OWNER"]);
  if ("response" in access) return access.response;

  const parsed = fiscalProfileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const cuitIssue = parsed.error.issues.some((issue) => issue.path[0] === "cuit");
    return errorResponse(400, "VALIDATION_ERROR", cuitIssue ? "El CUIT tiene que tener 11 dígitos." : "Datos inválidos.", parsed.error.flatten());
  }

  const cuit = parsed.data.cuit.replaceAll(/\D/g, "");
  if (!/^\d{11}$/.test(cuit)) return errorResponse(400, "VALIDATION_ERROR", "El CUIT tiene que tener 11 dígitos.");

  const certificate = parsed.data.certificatePem?.trim() ?? "";
  const privateKey = parsed.data.privateKeyPem?.trim() ?? "";
  if (certificate && !certificate.includes("BEGIN CERTIFICATE")) return errorResponse(400, "VALIDATION_ERROR", "El certificado tiene que estar en formato PEM.");
  if (privateKey && !privateKey.includes("PRIVATE KEY")) return errorResponse(400, "VALIDATION_ERROR", "La clave privada tiene que estar en formato PEM.");
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
    return errorResponse(500, "SERVER_MISCONFIGURED", "El servidor no puede guardar el certificado.");
  }

  try {
    const current = await prisma.fiscalProfile.findUnique({ where: { businessId } });
    if ((!current?.certCiphertext && !certificate) || (!current?.keyCiphertext && !privateKey)) {
      return errorResponse(400, "VALIDATION_ERROR", "Cargá el certificado y la clave privada de ARCA.");
    }

    await prisma.$transaction([
      prisma.business.update({ where: { id: businessId }, data: { legalName: parsed.data.legalName, taxId: cuit } }),
      prisma.fiscalProfile.upsert({
        where: { businessId },
        create: {
          businessId,
          cuit,
          pointOfSale: parsed.data.pointOfSale,
          ivaCondition: parsed.data.ivaCondition,
          environment: parsed.data.environment,
          certCiphertext: sealSecret(certificate),
          keyCiphertext: sealSecret(privateKey),
        },
        update: {
          cuit,
          pointOfSale: parsed.data.pointOfSale,
          ivaCondition: parsed.data.ivaCondition,
          environment: parsed.data.environment,
          ...(certificate ? { certCiphertext: sealSecret(certificate), wsaaToken: null, wsaaSign: null, wsaaExpiresAt: null } : {}),
          ...(privateKey ? { keyCiphertext: sealSecret(privateKey), wsaaToken: null, wsaaSign: null, wsaaExpiresAt: null } : {}),
        },
      }),
    ]);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ArcaError) return errorResponse(422, "ARCA_REJECTED", error.message);
    return unexpectedError();
  }
}
