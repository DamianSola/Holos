import { prisma } from "@/lib/db";
import { authorizeBusiness } from "@/server/auth/authorization";
import { errorResponse, unexpectedError } from "@/server/http";
import { customerSchema } from "@/server/validators/domain";

type Context = { params: Promise<{ businessId: string }> };

export async function GET(_request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;
  const customers = await prisma.customer.findMany({
    where: { businessId, deletedAt: null },
    include: { sales: { select: { id: true, totalMinor: true, status: true } } },
    orderBy: { name: "asc" },
    take: 100,
  });
  return Response.json({ items: customers });
}

export async function POST(request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;
  const parsed = customerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "Datos inválidos.", parsed.error.flatten());

  try {
    const customer = await prisma.customer.create({ data: { businessId, ...parsed.data, email: parsed.data.email || null } });
    return Response.json(customer, { status: 201 });
  } catch {
    return unexpectedError();
  }
}

