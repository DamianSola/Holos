import { prisma } from "@/lib/db";
import { authorizeBusiness } from "@/server/auth/authorization";
import { errorResponse, unexpectedError } from "@/server/http";
import { presentWorkList, workListInclude } from "@/server/services/work-lists";
import { workListSchema } from "@/server/validators/domain";

type Context = { params: Promise<{ businessId: string }> };

async function memberOrNull(businessId: string, assigneeId: string | null | undefined) {
  if (!assigneeId) return true;
  const membership = await prisma.membership.findFirst({ where: { businessId, userId: assigneeId, deletedAt: null }, select: { id: true } });
  return Boolean(membership);
}

export async function GET(_request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;

  const items = await prisma.workList.findMany({
    where: { businessId },
    include: workListInclude,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  });
  return Response.json({ items: items.map((list) => presentWorkList(list)) });
}

export async function POST(request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;

  const parsed = workListSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "Datos inválidos.", parsed.error.flatten());
  if (!(await memberOrNull(businessId, parsed.data.assigneeId))) {
    return errorResponse(422, "ASSIGNEE_NOT_MEMBER", "La persona no pertenece a este negocio.");
  }

  try {
    const list = await prisma.workList.create({
      data: {
        businessId,
        createdById: access.user.id,
        assigneeId: parsed.data.assigneeId || null,
        title: parsed.data.title,
        heading: parsed.data.heading,
        columns: parsed.data.columns,
        withChecks: parsed.data.withChecks,
        items: {
          create: parsed.data.items.map((item, index) => ({
            text: item.text,
            cells: item.cells,
            checked: parsed.data.withChecks && Boolean(item.checked),
            position: index,
          })),
        },
      },
      include: workListInclude,
    });
    return Response.json(presentWorkList(list), { status: 201 });
  } catch {
    return unexpectedError();
  }
}
