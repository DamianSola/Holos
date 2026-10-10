import { prisma } from "@/lib/db";
import { readSchedule, scheduleRecord } from "@/server/orders/reservation-booking";
import { authorizeBusiness } from "@/server/auth/authorization";
import { errorResponse, unexpectedError } from "@/server/http";
import { reservationScheduleSchema } from "@/server/validators/domain";

type Context = { params: Promise<{ businessId: string }> };

export async function GET(_request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;
  const schedule = await readSchedule(prisma, businessId);
  return Response.json(schedule);
}

export async function PUT(request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;
  const parsed = reservationScheduleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Datos inválidos.";
    return errorResponse(400, "VALIDATION_ERROR", message, parsed.error.flatten());
  }
  try {
    await prisma.reservationSchedule.upsert({
      where: { businessId },
      create: { businessId, ...scheduleRecord(parsed.data) },
      update: scheduleRecord(parsed.data),
    });
    return Response.json(await readSchedule(prisma, businessId));
  } catch {
    return unexpectedError();
  }
}
