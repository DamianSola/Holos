import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

const SESSION_COOKIE = "holos_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const rawToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.session.create({
    data: { sessionToken: hashToken(rawToken), userId, expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (!rawToken) return null;

  const session = await prisma.session.findUnique({
    where: { sessionToken: hashToken(rawToken) },
    include: {
      user: {
        include: {
          memberships: { where: { deletedAt: null }, include: { business: true } },
        },
      },
    },
  });

  if (!session || session.expiresAt <= new Date() || session.user.status !== "ACTIVE" || session.user.deletedAt) {
    await deleteSession(rawToken);
    return null;
  }

  return session.user;
}

export async function deleteSession(rawToken?: string) {
  const cookieStore = await cookies();
  const token = rawToken ?? cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { sessionToken: hashToken(token) } });
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function requireBusinessMembership(businessId: string) {
  const user = await getSessionUser();
  if (!user) return { user: null, membership: null };

  const membership = user.memberships.find((item) => item.businessId === businessId && !item.business.deletedAt);
  return { user, membership: membership ?? null };
}