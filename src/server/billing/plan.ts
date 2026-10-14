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
  const trialOpen = subscription.trialEndsAt.getTime() > now.getTime();
  const periodOpen = subscription.currentPeriodEnd !== null && subscription.currentPeriodEnd.getTime() > now.getTime();
  if (subscription.status === "TRIALING") return trialOpen;
  if (subscription.status === "ACTIVE" || subscription.status === "PAST_DUE") return periodOpen;
  if (subscription.status === "CANCELED") return periodOpen || trialOpen;
  return false;
}

export function trialEndsAtFrom(now = new Date(), trialDays = HOLOS_PLAN.trialDays) {
  return new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
}

export function extendPeriod(currentPeriodEnd: Date | null, now = new Date(), periodDays = HOLOS_PLAN.periodDays) {
  const base = currentPeriodEnd && currentPeriodEnd.getTime() > now.getTime() ? currentPeriodEnd : now;
  return new Date(base.getTime() + periodDays * 24 * 60 * 60 * 1000);
}
