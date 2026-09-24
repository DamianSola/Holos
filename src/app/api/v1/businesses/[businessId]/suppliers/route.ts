import { prisma } from "@/lib/db";
import { authorizeBusiness } from "@/server/auth/authorization";
import { errorResponse, unexpectedError } from "@/server/http";
import { supplierSchema } from "@/server/validators/domain";

type Context = { params: Promise<{ businessId: string }> };

export async function GET(_request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;

  const suppliers = await prisma.supplier.findMany({
    where: { businessId, deletedAt: null },
    include: { _count: { select: { expenses: true } } },
    orderBy: { name: "asc" },
  });
  return Response.json({ items: suppliers });
}

export async function POST(request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;

  const parsed = supplierSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "Datos inválidos.", parsed.error.flatten());

  try {
    const supplier = await prisma.supplier.create({
      data: { businessId, ...parsed.data, email: parsed.data.email || null },
    });
    return Response.json(supplier, { status: 201 });
  } catch {
    return unexpectedError();
  }
}
