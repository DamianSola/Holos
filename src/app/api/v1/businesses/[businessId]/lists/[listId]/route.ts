import { prisma } from "@/lib/db";
import { authorizeBusiness } from "@/server/auth/authorization";
import { errorResponse, unexpectedError } from "@/server/http";
import { presentWorkList, workListInclude } from "@/server/services/work-lists";
import { businessIdSchema, workListPatchSchema } from "@/server/validators/domain";

type Context = { params: Promise<{ businessId: string; listId: string }> };

export async function PATCH(request: Request, context: Context) {
  const { businessId, listId } = await context.params;
  if (!businessIdSchema.safeParse(listId).success) return errorResponse(400, "INVALID_LIST_ID", "La lista no es válida.");
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;

  const parsed = workListPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "Datos inválidos.", parsed.error.flatten());

  const current = await prisma.workList.findFirst({ where: { id: listId, businessId }, select: { id: true, status: true, completedAt: true } });
  if (!current) return errorResponse(404, "LIST_NOT_FOUND", "La lista no existe.");

  if (parsed.data.assigneeId) {
    const membership = await prisma.membership.findFirst({ where: { businessId, userId: parsed.data.assigneeId, deletedAt: null }, select: { id: true } });
    if (!membership) return errorResponse(422, "ASSIGNEE_NOT_MEMBER", "La persona no pertenece a este negocio.");
  }

  const status = parsed.data.status ?? current.status;
  try {
    const list = await prisma.$transaction(async (tx) => {
      if (parsed.data.items) {
        await tx.workListItem.deleteMany({ where: { listId } });
        await tx.workListItem.createMany({
          data: parsed.data.items.map((item, index) => ({
            listId,
            text: item.text,
            cells: item.cells,
            checked: Boolean(parsed.data.withChecks) && Boolean(item.checked),
            position: index,
          })),
        });
      }
      return tx.workList.update({
        where: { id: listId },
        data: {
          ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
          ...(parsed.data.heading !== undefined ? { heading: parsed.data.heading } : {}),
          ...(parsed.data.columns !== undefined ? { columns: parsed.data.columns } : {}),
          ...(parsed.data.withChecks !== undefined ? { withChecks: parsed.data.withChecks } : {}),
          ...(parsed.data.assigneeId !== undefined ? { assigneeId: parsed.data.assigneeId } : {}),
          ...(parsed.data.status !== undefined ? {
            status: parsed.data.status,
            completedAt: parsed.data.status === "DONE" ? current.completedAt ?? new Date() : null,
          } : {}),
        },
        include: workListInclude,
      });
    });
    return Response.json({ ...presentWorkList(list), status });
  } catch {
    return unexpectedError();
  }
}

export async function DELETE(_request: Request, context: Context) {
  const { businessId, listId } = await context.params;
  if (!businessIdSchema.safeParse(listId).success) return errorResponse(400, "INVALID_LIST_ID", "La lista no es válida.");
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;

  const removed = await prisma.workList.deleteMany({ where: { id: listId, businessId } });
  if (removed.count !== 1) return errorResponse(404, "LIST_NOT_FOUND", "La lista no existe.");
  return Response.json({ ok: true });
}
