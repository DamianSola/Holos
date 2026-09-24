import { prisma } from "@/lib/db";
import { authorizeBusiness } from "@/server/auth/authorization";
import { errorResponse, unexpectedError } from "@/server/http";
import { businessIdSchema, taskUpdateSchema } from "@/server/validators/domain";

type Context = { params: Promise<{ businessId: string; taskId: string }> };
const userSelect = { id: true, name: true, email: true } as const;

export async function PATCH(request: Request, context: Context) {
  const { businessId, taskId } = await context.params;
  if (!businessIdSchema.safeParse(taskId).success) return errorResponse(400, "INVALID_TASK_ID", "La tarea no es válida.");
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;

  const parsed = taskUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "Datos inválidos.", parsed.error.flatten());

  try {
    const task = await prisma.task.findFirst({ where: { id: taskId, businessId, status: { not: "ARCHIVED" } } });
    if (!task) return errorResponse(404, "TASK_NOT_FOUND", "La tarea no existe.");
    if (access.membership.role !== "OWNER" && task.assigneeId !== access.user.id && task.createdById !== access.user.id) return errorResponse(403, "FORBIDDEN", "No tenés permiso para modificar esta tarea.");

    if (parsed.data.assigneeId) {
      const membership = await prisma.membership.findFirst({ where: { businessId, userId: parsed.data.assigneeId, deletedAt: null } });
      if (!membership) return errorResponse(422, "ASSIGNEE_NOT_MEMBER", "La persona asignada no pertenece a este negocio.");
    }

    const updated = await prisma.$transaction(async (tx) => {
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
        include: { createdBy: { select: userSelect }, assignee: { select: userSelect } },
      });
      if (parsed.data.assigneeId && parsed.data.assigneeId !== task.assigneeId) {
        await tx.notification.create({ data: { userId: parsed.data.assigneeId, businessId, taskId, title: "Tarea reasignada", message: `Te asignaron la tarea: ${result.title}` } });
      }
      return result;
    });
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
