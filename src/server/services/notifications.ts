import { prisma } from "@/lib/db";
import type { ShellNotification } from "@/lib/shell-notification";

export type { ShellNotification };

export async function listRecentNotifications(userId: string, businessId: string): Promise<ShellNotification[]> {
  const items = await prisma.notification.findMany({
    where: { businessId, userId },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, title: true, message: true, readAt: true, createdAt: true },
  });
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    message: item.message,
    readAt: item.readAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
  }));
}
