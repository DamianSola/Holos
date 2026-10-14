import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DEFAULT_PRIVACY, DEFAULT_TERMS } from "@/server/billing/legal-copy";
import { HOLOS_PLAN, monthlyAmountArs } from "@/server/billing/plan";

const SETTINGS_ID = "holos";

export async function getPlatformSettings() {
  const existing = await prisma.platformSetting.findUnique({ where: { id: SETTINGS_ID } });
  if (existing) return existing;
  try {
    return await prisma.platformSetting.create({
      data: {
        id: SETTINGS_ID,
        planName: HOLOS_PLAN.name,
        trialDays: HOLOS_PLAN.trialDays,
        periodDays: HOLOS_PLAN.periodDays,
        monthlyAmountArs: monthlyAmountArs(),
        termsText: DEFAULT_TERMS,
        privacyText: DEFAULT_PRIVACY,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raced = await prisma.platformSetting.findUnique({ where: { id: SETTINGS_ID } });
      if (raced) return raced;
    }
    throw error;
  }
}
