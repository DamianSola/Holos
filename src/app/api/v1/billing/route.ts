import { prisma } from "@/lib/db";
import { ensureSubscription } from "@/server/billing/access";
import { checkoutConfigured } from "@/server/billing/mercadopago";
import { HOLOS_PLAN, isEntitled, monthlyAmountArs } from "@/server/billing/plan";
import { getSessionUser } from "@/server/auth/session";
import { errorResponse, unexpectedError } from "@/server/http";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return errorResponse(401, "UNAUTHORIZED", "Sesión requerida.");

  try {
    const subscription = await ensureSubscription(user.id);
    const [businesses, lastBackup] = await Promise.all([
      prisma.membership.findMany({
        where: { userId: user.id, role: "OWNER", deletedAt: null, business: { deletedAt: null } },
        include: { business: { select: { id: true, name: true } } },
      }),
      prisma.backupSnapshot.findFirst({ where: { status: "SUCCEEDED" }, orderBy: { finishedAt: "desc" } }),
    ]);

    return Response.json({
      planName: HOLOS_PLAN.name,
      amountArs: monthlyAmountArs(),
      trialDays: HOLOS_PLAN.trialDays,
      periodDays: HOLOS_PLAN.periodDays,
      status: subscription.status,
      trialEndsAt: subscription.trialEndsAt,
      currentPeriodEnd: subscription.currentPeriodEnd,
      entitled: isEntitled(subscription),
      checkoutAvailable: checkoutConfigured(),
      lastBackupAt: lastBackup?.finishedAt ?? null,
      businesses: businesses.map((membership) => ({ id: membership.business.id, name: membership.business.name })),
    });
  } catch {
    return unexpectedError();
  }
}
