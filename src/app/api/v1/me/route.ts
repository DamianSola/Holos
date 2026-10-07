import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/auth/session";
import { errorResponse, unexpectedError } from "@/server/http";
import { userProfileUpdateSchema } from "@/server/validators/domain";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return errorResponse(401, "UNAUTHORIZED", "Sesión requerida.");

  const [profile, memberships] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { image: true } }),
    prisma.membership.findMany({
      where: { userId: user.id, deletedAt: null, business: { deletedAt: null } },
      select: { role: true, business: { select: { id: true, name: true, kind: true, image: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return Response.json({
    id: user.id,
    email: user.email,
    name: user.name,
    image: profile?.image ?? null,
    businesses: memberships.map(({ role, business }) => ({
      id: business.id,
      name: business.name,
      kind: business.kind,
      image: business.image,
      role,
    })),
    status: user.status,
  });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return errorResponse(401, "UNAUTHORIZED", "Sesión requerida.");

  const parsed = userProfileUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "Datos inválidos.", parsed.error.flatten());

  const data: Record<string, unknown> = {};

  if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
  if (parsed.data.email !== undefined) {
    const normalized = parsed.data.email.trim().toLowerCase();
    if (normalized !== user.email) {
      const existing = await prisma.user.findUnique({ where: { emailNormalized: normalized } });
      if (existing && existing.id !== user.id) return errorResponse(409, "EMAIL_IN_USE", "El email ya está en uso.");
      data.email = normalized;
      data.emailNormalized = normalized;
    }
  }
  if (parsed.data.password !== undefined) {
    data.passwordHash = await bcrypt.hash(parsed.data.password, 12);
  }
  if (parsed.data.image !== undefined) data.image = parsed.data.image || null;

  if (Object.keys(data).length === 0) return errorResponse(400, "NO_CHANGES", "No se detectaron cambios.");

  try {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data,
      select: { id: true, name: true, email: true, status: true, image: true },
    });

    return Response.json(updated);
  } catch {
    return unexpectedError();
  }
}