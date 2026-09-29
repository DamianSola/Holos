export const HOLOS_PLAN = {
  code: "LOCAL",
  name: "Holos Local",
  trialDays: 14,
  periodDays: 30,
  currency: "ARS" as const,
};

export function monthlyAmountArs() {
  const parsed = Number(process.env.HOLOS_MONTHLY_ARS ?? "19900");
  if (!Number.isFinite(parsed) || parsed < 1) return 19900;
  return Math.round(parsed);
}

export function isEntitled(
  subscription: { status: string; trialEndsAt: Date; currentPeriodEnd: Date | null },
  now = new Date(),
) {
  if (subscription.status === "TRIALING") return subscription.trialEndsAt.getTime() > now.getTime();
  if (subscription.status === "ACTIVE") {
    return subscription.currentPeriodEnd !== null && subscription.currentPeriodEnd.getTime() > now.getTime();
  }
  return false;
}

export function trialEndsAtFrom(now = new Date()) {
  return new Date(now.getTime() + HOLOS_PLAN.trialDays * 24 * 60 * 60 * 1000);
}

export function extendPeriod(currentPeriodEnd: Date | null, now = new Date()) {
  const base = currentPeriodEnd && currentPeriodEnd.getTime() > now.getTime() ? currentPeriodEnd : now;
  return new Date(base.getTime() + HOLOS_PLAN.periodDays * 24 * 60 * 60 * 1000);
}
