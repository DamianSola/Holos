import { prisma } from "@/lib/db";
import { authorizeBusiness } from "@/server/auth/authorization";
import { errorResponse, unexpectedError } from "@/server/http";
import { businessImageSchema } from "@/server/validators/domain";

type Context = { params: Promise<{ businessId: string }> };

export async function PATCH(request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId, ["OWNER"]);
  if ("response" in access) return access.response;
  const parsed = businessImageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "La imagen no es válida.", parsed.error.flatten());
  try {
    const updated = await prisma.business.updateMany({
      where: { id: businessId, deletedAt: null },
      data: { image: parsed.data.image || null },
    });
    if (updated.count !== 1) return errorResponse(404, "BUSINESS_NOT_FOUND", "El negocio no existe.");
    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return unexpectedError();
  }
}

export async function DELETE(_request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId, ["OWNER"]);
  if ("response" in access) return access.response;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const business = await tx.business.findFirst({ where: { id: businessId, deletedAt: null }, select: { id: true, name: true } });
      if (!business) throw new Error("BUSINESS_NOT_FOUND");

      await tx.membership.updateMany({ where: { businessId, deletedAt: null }, data: { deletedAt: new Date() } });
      await tx.business.update({ where: { id: businessId }, data: { deletedAt: new Date() } });
      return business;
    });

    return Response.json({ ok: true, archived: result });
  } catch (error) {
    if (error instanceof Error && error.message === "BUSINESS_NOT_FOUND") return errorResponse(404, "BUSINESS_NOT_FOUND", "El negocio no existe o ya fue archivado.");
    return unexpectedError();
  }
}
