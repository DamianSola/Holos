import { prisma } from "@/lib/db";
import { authorizeBusiness } from "@/server/auth/authorization";
import { errorResponse, unexpectedError } from "@/server/http";
import { businessIdSchema, customerUpdateSchema } from "@/server/validators/domain";

type Context = { params: Promise<{ businessId: string; customerId: string }> };

async function getParams(context: Context) {
  const params = await context.params;
  if (!businessIdSchema.safeParse(params.businessId).success || !businessIdSchema.safeParse(params.customerId).success) return null;
  return params;
}

export async function PATCH(request: Request, context: Context) {
  const params = await getParams(context);
  if (!params) return errorResponse(400, "INVALID_CUSTOMER_ID", "El cliente no es válido.");
  const access = await authorizeBusiness(params.businessId);
  if ("response" in access) return access.response;

  const parsed = customerUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "Datos inválidos.", parsed.error.flatten());

  try {
    const customer = await prisma.customer.updateMany({
      where: { id: params.customerId, businessId: params.businessId, deletedAt: null },
      data: { ...parsed.data, email: parsed.data.email || null },
    });

    if (customer.count !== 1) return errorResponse(404, "CUSTOMER_NOT_FOUND", "Cliente inexistente.");

    return Response.json(await prisma.customer.findUnique({ where: { id: params.customerId } }));
  } catch {
    return unexpectedError();
  }
}

export async function DELETE(_request: Request, context: Context) {
  const params = await getParams(context);
  if (!params) return errorResponse(400, "INVALID_CUSTOMER_ID", "El cliente no es válido.");
  const access = await authorizeBusiness(params.businessId);
  if ("response" in access) return access.response;

  try {
    const customer = await prisma.customer.updateMany({
      where: { id: params.customerId, businessId: params.businessId, deletedAt: null },
      data: { deletedAt: new Date(), email: null, phone: null },
    });

    if (customer.count !== 1) return errorResponse(404, "CUSTOMER_NOT_FOUND", "Cliente inexistente.");
    return Response.json({ ok: true });
  } catch {
    return unexpectedError();
  }
}
