import { prisma } from "@/lib/db";
import { authorizeBusiness } from "@/server/auth/authorization";
import { ArcaError, fiscalProfileReady } from "@/server/fiscal/document";
import { probeFiscalConnection, type StoredProfile } from "@/server/fiscal/wsfe";
import { errorResponse, unexpectedError } from "@/server/http";

type Context = { params: Promise<{ businessId: string }> };

export async function POST(_request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId, ["OWNER"]);
  if ("response" in access) return access.response;

  try {
    const profile = await prisma.fiscalProfile.findUnique({ where: { businessId } });
    if (!profile || !fiscalProfileReady(profile)) {
      return errorResponse(422, "FISCAL_NOT_CONFIGURED", "Primero guardá CUIT, punto de venta, certificado y clave.");
    }
    const result = await probeFiscalConnection(profile as StoredProfile);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof ArcaError) return errorResponse(422, "ARCA_REJECTED", error.message);
    return unexpectedError();
  }
}
