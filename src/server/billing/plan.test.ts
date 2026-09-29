import { describe, expect, it } from "vitest";
import { extendPeriod, isEntitled, monthlyAmountArs, trialEndsAtFrom } from "@/server/billing/plan";

describe("Holos plan entitlement", () => {
  it("keeps a trial open until the end date", () => {
    const now = new Date("2026-09-29T12:00:00.000Z");
    expect(isEntitled({ status: "TRIALING", trialEndsAt: trialEndsAtFrom(now), currentPeriodEnd: null }, now)).toBe(true);
    expect(isEntitled({ status: "TRIALING", trialEndsAt: now, currentPeriodEnd: null }, now)).toBe(false);
  });

  it("requires a future period end for a paid plan", () => {
    const now = new Date("2026-09-29T12:00:00.000Z");
    expect(isEntitled({ status: "ACTIVE", trialEndsAt: now, currentPeriodEnd: extendPeriod(null, now) }, now)).toBe(true);
    expect(isEntitled({ status: "ACTIVE", trialEndsAt: now, currentPeriodEnd: now }, now)).toBe(false);
    expect(isEntitled({ status: "ACTIVE", trialEndsAt: now, currentPeriodEnd: null }, now)).toBe(false);
    expect(isEntitled({ status: "CANCELED", trialEndsAt: trialEndsAtFrom(now), currentPeriodEnd: extendPeriod(null, now) }, now)).toBe(false);
  });

  it("uses the configured monthly price", () => {
    const previous = process.env.HOLOS_MONTHLY_ARS;
    process.env.HOLOS_MONTHLY_ARS = "25000";
    expect(monthlyAmountArs()).toBe(25000);
    process.env.HOLOS_MONTHLY_ARS = "nope";
    expect(monthlyAmountArs()).toBe(19900);
    if (previous === undefined) delete process.env.HOLOS_MONTHLY_ARS;
    else process.env.HOLOS_MONTHLY_ARS = previous;
  });
});
