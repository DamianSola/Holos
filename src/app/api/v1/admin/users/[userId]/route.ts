import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/server/auth/admin";
import { extendPeriod } from "@/server/billing/plan";
import { getPlatformSettings } from "@/server/billing/settings";
import { errorResponse, unexpectedError } from "@/server/http";
import { businessIdSchema } from "@/server/validators/domain";

type Context = { params: Promise<{ userId: string }> };

const actionSchema = z.object({
  action: z.enum(["suspend", "activate", "delete", "restore", "extend"]),
}).strict();

export async function PATCH(request: Request, context: Context) {
  const { userId } = await context.params;
  if (!businessIdSchema.safeParse(userId).success) return errorResponse(400, "INVALID_USER_ID", "El usuario no es válido.");
  const access = await requirePlatformAdmin();
  if ("response" in access) return access.response;
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "La acción no es válida.");
  if (userId === access.user.id && parsed.data.action !== "extend") {
    return errorResponse(422, "ADMIN_SELF", "No podés suspenderte ni eliminarte desde acá.");
  }

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, subscription: { select: { currentPeriodEnd: true } } } });
  if (!target) return errorResponse(404, "USER_NOT_FOUND", "El usuario no existe.");

  try {
    if (parsed.data.action === "suspend") {
      await prisma.$transaction([
        prisma.user.update({ where: { id: userId }, data: { status: "SUSPENDED" } }),
        prisma.session.deleteMany({ where: { userId } }),
      ]);
    }
    if (parsed.data.action === "activate" || parsed.data.action === "restore") {
      await prisma.user.update({ where: { id: userId }, data: { status: "ACTIVE", deletedAt: null } });
    }
    if (parsed.data.action === "delete") {
      await prisma.$transaction([
        prisma.user.update({ where: { id: userId }, data: { status: "SUSPENDED", deletedAt: new Date() } }),
        prisma.session.deleteMany({ where: { userId } }),
      ]);
    }
    if (parsed.data.action === "extend") {
      const settings = await getPlatformSettings();
      const currentPeriodEnd = extendPeriod(target.subscription?.currentPeriodEnd ?? null, new Date(), settings.periodDays);
      await prisma.subscription.upsert({
        where: { userId },
        update: { status: "ACTIVE", currentPeriodEnd },
        create: { userId, status: "ACTIVE", trialEndsAt: new Date(), currentPeriodEnd },
      });
    }
    return Response.json({ ok: true });
  } catch {
    return unexpectedError();
  }
}
