import { prisma } from "@/lib/db";
import { authorizeBusiness } from "@/server/auth/authorization";
import { errorResponse, unexpectedError } from "@/server/http";
import { businessIdSchema, taskUpdateSchema } from "@/server/validators/domain";

type Context = { params: Promise<{ businessId: string; taskId: string }> };
const userSelect = { id: true, name: true, email: true } as const;
const taskInclude = {
  createdBy: { select: userSelect },
  assignee: { select: userSelect },
  items: { orderBy: { position: "asc" as const }, select: { id: true, text: true, done: true } },
} as const;
const itemLimit = 50;

function completionFromItems(items: { done: boolean }[], previousCompletedAt: Date | null) {
  const allDone = items.length > 0 && items.every((item) => item.done);
  if (!allDone) return { status: "OPEN" as const, completedAt: null };
  return { status: "DONE" as const, completedAt: previousCompletedAt ?? new Date() };
}

export async function PATCH(request: Request, context: Context) {
  const { businessId, taskId } = await context.params;
  if (!businessIdSchema.safeParse(taskId).success) return errorResponse(400, "INVALID_TASK_ID", "La tarea no es válida.");
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;

  const parsed = taskUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "Datos inválidos.", parsed.error.flatten());

  try {
    const task = await prisma.task.findFirst({ where: { id: taskId, businessId, status: { not: "ARCHIVED" } }, include: { items: { select: { id: true } } } });
    if (!task) return errorResponse(404, "TASK_NOT_FOUND", "La tarea no existe.");
    if (access.membership.role !== "OWNER" && task.assigneeId !== access.user.id && task.createdById !== access.user.id) return errorResponse(403, "FORBIDDEN", "No tenés permiso para modificar esta tarea.");

    if (parsed.data.status && task.items.length > 0) return errorResponse(422, "TASK_STATUS_FROM_ITEMS", "Esta tarea se completa tildando los ítems.");
    if (parsed.data.addItem && task.status !== "OPEN") return errorResponse(422, "TASK_NOT_OPEN", "Solo se pueden agregar ítems a una tarea pendiente.");

    if (parsed.data.assigneeId) {
      const membership = await prisma.membership.findFirst({ where: { businessId, userId: parsed.data.assigneeId, deletedAt: null } });
      if (!membership) return errorResponse(422, "ASSIGNEE_NOT_MEMBER", "La persona asignada no pertenece a este negocio.");
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (parsed.data.itemId !== undefined && parsed.data.done !== undefined) {
        const item = await tx.taskItem.findFirst({ where: { id: parsed.data.itemId, taskId } });
        if (!item) return null;
        await tx.taskItem.update({ where: { id: item.id }, data: { done: parsed.data.done } });
        const items = await tx.taskItem.findMany({ where: { taskId }, select: { done: true } });
        return tx.task.update({ where: { id: taskId }, data: completionFromItems(items, task.completedAt), include: taskInclude });
      }

      if (parsed.data.addItem) {
        const count = await tx.taskItem.count({ where: { taskId } });
        if (count >= itemLimit) return "limit" as const;
        const last = await tx.taskItem.aggregate({ where: { taskId }, _max: { position: true } });
        await tx.taskItem.create({ data: { taskId, text: parsed.data.addItem, position: (last._max.position ?? -1) + 1 } });
        return tx.task.findFirstOrThrow({ where: { id: taskId }, include: taskInclude });
      }

      const result = await tx.task.update({
        where: { id: taskId },
        data: {
          title: parsed.data.title,
          description: parsed.data.description,
          assigneeId: parsed.data.assigneeId,
          dueDate: parsed.data.dueDate === undefined ? undefined : parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
          status: parsed.data.status,
          completedAt: parsed.data.status === "DONE" ? new Date() : parsed.data.status === "OPEN" ? null : undefined,
        },
        include: taskInclude,
      });
      if (parsed.data.assigneeId && parsed.data.assigneeId !== task.assigneeId) {
        await tx.notification.create({ data: { userId: parsed.data.assigneeId, businessId, taskId, title: "Tarea reasignada", message: `Te asignaron la tarea: ${result.title}` } });
      }
      return result;
    });
    if (updated === null) return errorResponse(404, "TASK_ITEM_NOT_FOUND", "El ítem no existe.");
    if (updated === "limit") return errorResponse(422, "TOO_MANY_ITEMS", "Se pueden cargar hasta 50 ítems.");
    return Response.json(updated);
  } catch {
    return unexpectedError();
  }
}

export async function DELETE(request: Request, context: Context) {
  const { businessId, taskId } = await context.params;
  if (!businessIdSchema.safeParse(taskId).success) return errorResponse(400, "INVALID_TASK_ID", "La tarea no es válida.");
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;
  const task = await prisma.task.findFirst({ where: { id: taskId, businessId, status: { not: "ARCHIVED" } } });
  if (!task) return errorResponse(404, "TASK_NOT_FOUND", "La tarea no existe.");
  if (access.membership.role !== "OWNER" && task.createdById !== access.user.id) return errorResponse(403, "FORBIDDEN", "No tenés permiso para archivar esta tarea.");
  await prisma.task.update({ where: { id: taskId }, data: { status: "ARCHIVED" } });
  return Response.json({ ok: true });
}
