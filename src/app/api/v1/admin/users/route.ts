import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/server/auth/admin";
import { unexpectedError } from "@/server/http";

export async function GET(request: Request) {
  const access = await requirePlatformAdmin();
  if ("response" in access) return access.response;
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  try {
    const users = await prisma.user.findMany({
      where: query ? {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
      } : undefined,
      orderBy: { createdAt: "desc" },
      take: 80,
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        deletedAt: true,
        createdAt: true,
        platformAdmin: true,
        subscription: { select: { status: true, trialEndsAt: true, currentPeriodEnd: true } },
        _count: { select: { memberships: true } },
      },
    });
    return Response.json({
      items: users.map(({ _count, ...user }) => ({ ...user, businessCount: _count.memberships })),
    });
  } catch {
    return unexpectedError();
  }
}
