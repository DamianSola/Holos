import { prisma } from "@/lib/db";
import { authorizeBusiness } from "@/server/auth/authorization";
import { errorResponse, unexpectedError } from "@/server/http";

type Context = { params: Promise<{ businessId: string }> };

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
