import { z } from "zod";
import { prisma } from "@/lib/db";
import { appUrl } from "@/server/app-url";
import { requirePlatformAdmin } from "@/server/auth/admin";
import { getPlatformSettings } from "@/server/billing/settings";
import { errorResponse, unexpectedError } from "@/server/http";

const settingsSchema = z.object({
  planName: z.string().trim().min(1).max(80),
  trialDays: z.number().int().min(0).max(365),
  periodDays: z.number().int().min(1).max(365),
  monthlyAmountArs: z.number().int().min(1).max(10_000_000),
  termsText: z.string().trim().min(20).max(20000),
  privacyText: z.string().trim().min(20).max(20000),
  mpAccessToken: z.string().trim().max(500).optional(),
  clearMpToken: z.boolean().optional(),
}).strict();

function publicSettings(settings: { planName: string; trialDays: number; periodDays: number; monthlyAmountArs: number; termsText: string; privacyText: string; mpAccessToken: string | null }) {
  const token = settings.mpAccessToken;
  return {
    planName: settings.planName,
    trialDays: settings.trialDays,
    periodDays: settings.periodDays,
    monthlyAmountArs: settings.monthlyAmountArs,
    termsText: settings.termsText,
    privacyText: settings.privacyText,
    mpConfigured: Boolean(token || process.env.MERCADOPAGO_ACCESS_TOKEN),
    mpStored: Boolean(token),
    mpHint: token && token.length > 4 ? token.slice(-4) : "",
    webhookUrl: `${appUrl()}/api/v1/billing/mercadopago`,
  };
}

export async function GET() {
  const access = await requirePlatformAdmin();
  if ("response" in access) return access.response;
  try {
    return Response.json(publicSettings(await getPlatformSettings()));
  } catch {
    return unexpectedError();
  }
}

export async function PATCH(request: Request) {
  const access = await requirePlatformAdmin();
  if ("response" in access) return access.response;
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "Revisá los datos del plan.", parsed.error.flatten());

  try {
    const current = await getPlatformSettings();
    const nextToken = parsed.data.clearMpToken
      ? null
      : parsed.data.mpAccessToken
        ? parsed.data.mpAccessToken
        : current.mpAccessToken;
    const saved = await prisma.platformSetting.update({
      where: { id: current.id },
      data: {
        planName: parsed.data.planName,
        trialDays: parsed.data.trialDays,
        periodDays: parsed.data.periodDays,
        monthlyAmountArs: parsed.data.monthlyAmountArs,
        termsText: parsed.data.termsText,
        privacyText: parsed.data.privacyText,
        mpAccessToken: nextToken,
      },
    });
    return Response.json(publicSettings(saved));
  } catch {
    return unexpectedError();
  }
}
