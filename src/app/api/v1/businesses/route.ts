import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/auth/session";
import { errorResponse, unexpectedError } from "@/server/http";
import { businessCreateSchema } from "@/server/validators/domain";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return errorResponse(401, "UNAUTHORIZED", "Sesión requerida.");

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id, deletedAt: null, business: { deletedAt: null } },
    include: {
      business: true,
    },
  });

  return Response.json({ items: memberships.map((membership) => ({
    id: membership.businessId,
    name: membership.business.name,
    role: membership.role,
  })) });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return errorResponse(401, "UNAUTHORIZED", "Sesión requerida.");

  const parsed = businessCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "Datos inválidos.", parsed.error.flatten());

  try {
    const business = await prisma.$transaction(async (tx) => {
      const createdBusiness = await tx.business.create({
        data: {
          name: parsed.data.name.trim(),
          legalName: parsed.data.legalName?.trim() || null,
          taxId: parsed.data.taxId?.trim() || null,
        },
      });

      await tx.membership.create({
        data: {
          userId: user.id,
          businessId: createdBusiness.id,
          role: "OWNER",
        },
      });

      return createdBusiness;
    });

    return Response.json({ id: business.id, name: business.name }, { status: 201 });
  } catch {
    return unexpectedError();
  }
}
