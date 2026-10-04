import { prisma } from "@/lib/db";
import { authorizeBusiness } from "@/server/auth/authorization";
import { errorResponse, unexpectedError } from "@/server/http";
import { businessIdSchema } from "@/server/validators/domain";

type Context = { params: Promise<{ businessId: string; expenseId: string }> };

export async function DELETE(_request: Request, context: Context) {
  const { businessId, expenseId } = await context.params;
  if (!businessIdSchema.safeParse(businessId).success || !businessIdSchema.safeParse(expenseId).success) {
    return errorResponse(400, "INVALID_EXPENSE_ID", "El gasto no es válido.");
  }
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;

  try {
    const expense = await prisma.expense.updateMany({
      where: { id: expenseId, businessId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (expense.count !== 1) return errorResponse(404, "EXPENSE_NOT_FOUND", "Gasto inexistente.");
    return Response.json({ ok: true });
  } catch {
    return unexpectedError();
  }
}
