import { prisma } from "@/lib/db";
import { ensureSubscription } from "@/server/billing/access";
import { isEntitled } from "@/server/billing/plan";
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
    kind: membership.business.kind,
    role: membership.role,
  })) });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return errorResponse(401, "UNAUTHORIZED", "Sesión requerida.");

  const parsed = businessCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "Datos inválidos.", parsed.error.flatten());
  const subscription = await ensureSubscription(user.id);
  if (!isEntitled(subscription)) return errorResponse(402, "PAYMENT_REQUIRED", "Tu prueba terminó. Activá Holos para seguir operando.");

  try {
    const business = await prisma.$transaction(async (tx) => {
      const createdBusiness = await tx.business.create({
        data: {
          name: parsed.data.name.trim(),
          legalName: parsed.data.legalName?.trim() || null,
          taxId: parsed.data.taxId?.trim() || null,
          kind: parsed.data.kind,
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

    return Response.json({ id: business.id, name: business.name, kind: business.kind }, { status: 201 });
  } catch {
    return unexpectedError();
  }
}
