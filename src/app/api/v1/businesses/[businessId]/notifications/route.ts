import { prisma } from "@/lib/db";
import { authorizeBusiness } from "@/server/auth/authorization";
import { errorResponse } from "@/server/http";
import { listRecentNotifications } from "@/server/services/notifications";

type Context = { params: Promise<{ businessId: string }> };

export async function GET(_request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;

  const items = await listRecentNotifications(access.user.id, businessId);
  return Response.json({ items, unread: items.filter((item) => !item.readAt).length });
}

export async function PATCH(request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload.notificationId !== "string") return errorResponse(400, "INVALID_NOTIFICATION", "La notificación no es válida.");

  const updated = await prisma.notification.updateMany({ where: { id: payload.notificationId, businessId, userId: access.user.id, readAt: null }, data: { readAt: new Date() } });
  if (updated.count !== 1) return errorResponse(404, "NOTIFICATION_NOT_FOUND", "La notificación no existe.");
  return Response.json({ ok: true });
}
