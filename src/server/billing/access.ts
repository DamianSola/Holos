import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/auth/session";
import { isEntitled, trialEndsAtFrom } from "@/server/billing/plan";

export async function ensureSubscription(userId: string) {
  const existing = await prisma.subscription.findUnique({ where: { userId } });
  if (existing) return existing;
  try {
    return await prisma.subscription.create({
      data: { userId, status: "TRIALING", trialEndsAt: trialEndsAtFrom() },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raced = await prisma.subscription.findUnique({ where: { userId } });
      if (raced) return raced;
    }
    throw error;
  }
}

export async function businessIsEntitled(businessId: string) {
  const owners = await prisma.membership.findMany({
    where: { businessId, role: "OWNER", deletedAt: null },
    select: { userId: true },
  });
  for (const owner of owners) {
    const subscription = await ensureSubscription(owner.userId);
    if (isEntitled(subscription)) return true;
  }
  return false;
}

export async function workspaceIsOpen(user: {
  id: string;
  memberships: Array<{ role: "OWNER" | "EMPLOYEE"; businessId: string; business: { deletedAt: Date | null } }>;
}) {
  const subscription = await ensureSubscription(user.id);
  if (isEntitled(subscription)) return true;
  for (const membership of user.memberships) {
    if (membership.role !== "EMPLOYEE" || membership.business.deletedAt) continue;
    if (await businessIsEntitled(membership.businessId)) return true;
  }
  return false;
}

export async function requireBusinessPage(businessId: string) {
  const user = await getSessionUser();
  const membership = user?.memberships.find((item) => item.businessId === businessId && !item.business.deletedAt);
  if (!user || !membership) redirect("/login");
  if (!(await businessIsEntitled(businessId))) {
    redirect(membership.role === "OWNER" ? "/billing" : "/billing?bloqueado=dueno");
  }
  return { user, membership };
}
