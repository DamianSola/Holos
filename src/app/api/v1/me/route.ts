import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/auth/session";
import { errorResponse, unexpectedError } from "@/server/http";
import { userProfileUpdateSchema } from "@/server/validators/domain";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return errorResponse(401, "UNAUTHORIZED", "Sesión requerida.");

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const businesses = await Promise.all(
    user.memberships.filter(({ business }) => !business.deletedAt).map(async ({ business, role }) => {
      const [customerCount, productCount, criticalProducts, salesMonth, salesToday] = await prisma.$transaction([
        prisma.customer.count({ where: { businessId: business.id, deletedAt: null } }),
        prisma.product.count({ where: { businessId: business.id, status: "ACTIVE", deletedAt: null } }),
        prisma.product.count({ where: { businessId: business.id, status: "ACTIVE", deletedAt: null, stock: { lte: prisma.product.fields.minimumStock } } }),
        prisma.sale.aggregate({ where: { businessId: business.id, status: "CONFIRMED", confirmedAt: { gte: startOfMonth } }, _sum: { totalMinor: true } }),
        prisma.sale.aggregate({ where: { businessId: business.id, status: "CONFIRMED", confirmedAt: { gte: startOfDay } }, _sum: { totalMinor: true } }),
      ]);

      return {
        id: business.id,
        name: business.name,
        kind: business.kind,
        image: business.image,
        role,
        customerCount,
        productCount,
        criticalProducts,
        salesMonthMinor: salesMonth._sum.totalMinor ?? 0,
        salesTodayMinor: salesToday._sum.totalMinor ?? 0,
      };
    }),
  );

  return Response.json({
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    businesses,
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