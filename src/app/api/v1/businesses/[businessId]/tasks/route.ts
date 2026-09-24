import { prisma } from "@/lib/db";
import { authorizeBusiness } from "@/server/auth/authorization";
import { errorResponse, unexpectedError } from "@/server/http";
import { taskSchema } from "@/server/validators/domain";

type Context = { params: Promise<{ businessId: string }> };

const userSelect = { id: true, name: true, email: true } as const;

export async function GET(_request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;

  const tasks = await prisma.task.findMany({
    where: { businessId, status: { not: "ARCHIVED" } },
    include: { createdBy: { select: userSelect }, assignee: { select: userSelect } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  });
  return Response.json({ items: tasks });
}

export async function POST(request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;

  const parsed = taskSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "Datos inválidos.", parsed.error.flatten());

  const assigneeId = parsed.data.assigneeId ?? access.user.id;
  try {
    const membership = await prisma.membership.findFirst({ where: { businessId, userId: assigneeId, deletedAt: null }, include: { user: { select: userSelect } } });
    if (!membership) return errorResponse(422, "ASSIGNEE_NOT_MEMBER", "La persona asignada no pertenece a este negocio.");

    const task = await prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          businessId,
          createdById: access.user.id,
          assigneeId,
          title: parsed.data.title,
          description: parsed.data.description || null,
          dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        },
        include: { createdBy: { select: userSelect }, assignee: { select: userSelect } },
      });

      await tx.notification.create({
        data: {
          userId: assigneeId,
          businessId,
          taskId: created.id,
          title: "Nueva tarea asignada",
          message: `${access.user.name ?? access.user.email} te asignó: ${created.title}`,
        },
      });
      return created;
    });

    return Response.json(task, { status: 201 });
  } catch {
    return unexpectedError();
  }
}
