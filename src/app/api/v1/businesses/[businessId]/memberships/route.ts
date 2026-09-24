import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { authorizeBusiness } from "@/server/auth/authorization";
import { errorResponse, unexpectedError } from "@/server/http";
import { membershipInviteSchema, membershipRoleSchema } from "@/server/validators/domain";

type Context = { params: Promise<{ businessId: string }> };

async function getMembershipsForBusiness(businessId: string) {
  const memberships = await prisma.membership.findMany({
    where: { businessId, deletedAt: null },
    include: { user: { select: { id: true, name: true, email: true, status: true } } },
    orderBy: { createdAt: "asc" },
  });

  const invitations = await prisma.invitation.findMany({
    where: { businessId, status: "PENDING", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  return { memberships, invitations };
}

export async function GET(_request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;

  const { memberships, invitations } = await getMembershipsForBusiness(businessId);
  return Response.json({
    memberships,
    invitations,
    currentUser: { id: access.user.id, role: access.membership.role },
  });
}

export async function POST(request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId, ["OWNER"]);
  if ("response" in access) return access.response;

  const parsed = membershipInviteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "Datos inválidos.", parsed.error.flatten());

  const email = parsed.data.email.trim().toLowerCase();

  try {
    const user = await prisma.user.findUnique({ where: { emailNormalized: email } });
    if (user) {
      const isAlreadyMember = await prisma.membership.findFirst({ where: { businessId, userId: user.id, deletedAt: null } });
      if (isAlreadyMember) return errorResponse(409, "ALREADY_MEMBER", "El usuario ya pertenece a este negocio.");

      const membership = await prisma.membership.create({ data: { businessId, userId: user.id, role: parsed.data.role } });
      return Response.json({ membership, invitation: null }, { status: 201 });
    }

    const pendingInvitation = await prisma.invitation.findFirst({
      where: { businessId, email, status: "PENDING", expiresAt: { gt: new Date() } },
    });
    if (pendingInvitation) return errorResponse(409, "INVITATION_EXISTS", "Ya existe una invitación pendiente para ese email.");

    const invitation = await prisma.invitation.create({
      data: {
        businessId,
        inviterId: access.user.id,
        email,
        role: parsed.data.role,
        status: "PENDING",
        tokenHash: `invite-${randomUUID()}-${Date.now()}`,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      },
    });

    return Response.json({ membership: null, invitation }, { status: 201 });
  } catch {
    return unexpectedError();
  }
}

export async function PATCH(request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId, ["OWNER"]);
  if ("response" in access) return access.response;

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") return errorResponse(400, "INVALID_PAYLOAD", "El payload no es válido.");

  const parsed = membershipRoleSchema.safeParse({ role: payload.role });
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "Datos inválidos.", parsed.error.flatten());

  if (!payload.membershipId || typeof payload.membershipId !== "string") return errorResponse(400, "INVALID_MEMBERSHIP_ID", "La membresía no es válida.");

  try {
    const membership = await prisma.membership.findFirst({ where: { id: payload.membershipId, businessId, deletedAt: null } });
    if (!membership) return errorResponse(404, "MEMBERSHIP_NOT_FOUND", "La membresía no existe.");
    if (membership.userId === access.user.id && parsed.data.role === "EMPLOYEE") return errorResponse(409, "CANNOT_DEMOTE_SELF", "No podés cambiarte tu propio rol.");

    const updated = await prisma.membership.update({ where: { id: payload.membershipId }, data: { role: parsed.data.role } });
    return Response.json(updated);
  } catch {
    return unexpectedError();
  }
}

export async function DELETE(request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId, ["OWNER"]);
  if ("response" in access) return access.response;

  const payload = await request.json().catch(() => ({}));
  if (!payload.membershipId || typeof payload.membershipId !== "string") return errorResponse(400, "INVALID_MEMBERSHIP_ID", "La membresía no es válida.");

  try {
    const membership = await prisma.membership.findFirst({ where: { id: payload.membershipId, businessId, deletedAt: null } });
    if (!membership) return errorResponse(404, "MEMBERSHIP_NOT_FOUND", "La membresía no existe.");
    if (membership.userId === access.user.id) return errorResponse(409, "CANNOT_REMOVE_SELF", "No podés eliminarte a vos mismo del negocio.");

    const remainingOwners = await prisma.membership.count({ where: { businessId, role: "OWNER", deletedAt: null } });
    if (membership.role === "OWNER" && remainingOwners <= 1) return errorResponse(409, "OWNER_REQUIRED", "Debe quedar al menos un propietario.");

    await prisma.membership.update({ where: { id: payload.membershipId }, data: { deletedAt: new Date() } });
    return Response.json({ ok: true });
  } catch {
    return unexpectedError();
  }
}
