import { prisma } from "@/lib/db";
import { ensureSubscription } from "@/server/billing/access";
import { checkoutConfigured } from "@/server/billing/mercadopago";
import { isEntitled } from "@/server/billing/plan";
import { getPlatformSettings } from "@/server/billing/settings";
import { getSessionUser } from "@/server/auth/session";
import { errorResponse, unexpectedError } from "@/server/http";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return errorResponse(401, "UNAUTHORIZED", "Sesión requerida.");

  try {
    const [subscription, settings] = await Promise.all([ensureSubscription(user.id), getPlatformSettings()]);
    const [businesses, lastBackup] = await Promise.all([
      prisma.membership.findMany({
        where: { userId: user.id, role: "OWNER", deletedAt: null, business: { deletedAt: null } },
        include: { business: { select: { id: true, name: true } } },
      }),
      prisma.backupSnapshot.findFirst({ where: { status: "SUCCEEDED" }, orderBy: { finishedAt: "desc" } }),
    ]);

    return Response.json({
      planName: settings.planName,
      amountArs: settings.monthlyAmountArs,
      trialDays: settings.trialDays,
      periodDays: settings.periodDays,
      status: subscription.status,
      trialEndsAt: subscription.trialEndsAt,
      currentPeriodEnd: subscription.currentPeriodEnd,
      entitled: isEntitled(subscription),
      checkoutAvailable: await checkoutConfigured(),
      lastBackupAt: lastBackup?.finishedAt ?? null,
      businesses: businesses.map((membership) => ({ id: membership.business.id, name: membership.business.name })),
    });
  } catch {
    return unexpectedError();
  }
}
