import { inclusiveCivilRange } from "@/lib/movement-period";
import { prisma } from "@/lib/db";
import { authorizeBusiness } from "@/server/auth/authorization";
import { errorResponse, unexpectedError } from "@/server/http";
import { expenseSchema } from "@/server/validators/domain";

type Context = { params: Promise<{ businessId: string }> };

export async function GET(request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const range = from || to ? inclusiveCivilRange(from ?? "", to ?? "") : null;
  if ((from || to) && !range) return errorResponse(400, "INVALID_DATE", "La fecha no es válida.");

  const expenses = await prisma.expense.findMany({
    where: { businessId, deletedAt: null, ...(range ? { expenseDate: { gte: range.start, lt: range.end } } : {}) },
    include: { supplier: { select: { id: true, name: true } }, createdBy: { select: { name: true, email: true } } },
    orderBy: { expenseDate: "desc" },
    ...(range ? {} : { take: 200 }),
  });
  const totalMinor = expenses.reduce((total, expense) => total + expense.amountMinor, 0);
  return Response.json({ items: expenses, totalMinor });
}

export async function POST(request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;

  const parsed = expenseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "Datos inválidos.", parsed.error.flatten());

  try {
    if (parsed.data.supplierId) {
      const supplier = await prisma.supplier.findFirst({ where: { id: parsed.data.supplierId, businessId, deletedAt: null } });
      if (!supplier) return errorResponse(422, "SUPPLIER_NOT_FOUND", "El proveedor no pertenece a este negocio.");
    }

    const expense = await prisma.expense.create({
      data: {
        businessId,
        createdById: access.user.id,
        supplierId: parsed.data.supplierId,
        description: parsed.data.description,
        category: parsed.data.category || null,
        amountMinor: parsed.data.amountMinor,
        expenseDate: parsed.data.expenseDate ? new Date(parsed.data.expenseDate) : new Date(),
        notes: parsed.data.notes || null,
      },
      include: { supplier: { select: { id: true, name: true } } },
    });
    return Response.json(expense, { status: 201 });
  } catch {
    return unexpectedError();
  }
}
