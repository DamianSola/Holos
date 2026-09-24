import { prisma } from "@/lib/db";
import { authorizeBusiness } from "@/server/auth/authorization";
import { errorResponse, unexpectedError } from "@/server/http";
import { businessIdSchema, productUpdateSchema } from "@/server/validators/domain";

type Context = { params: Promise<{ businessId: string; productId: string }> };

async function getParams(context: Context) {
  const params = await context.params;
  if (!businessIdSchema.safeParse(params.businessId).success || !businessIdSchema.safeParse(params.productId).success) return null;
  return params;
}

export async function PATCH(request: Request, context: Context) {
  const params = await getParams(context);
  if (!params) return errorResponse(400, "INVALID_PRODUCT_ID", "El producto no es válido.");
  const access = await authorizeBusiness(params.businessId);
  if ("response" in access) return access.response;
  const parsed = productUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "Datos inválidos.", parsed.error.flatten());

  try {
    const product = await prisma.product.updateMany({ where: { id: params.productId, businessId: params.businessId, deletedAt: null }, data: parsed.data });
    if (product.count !== 1) return errorResponse(404, "PRODUCT_NOT_FOUND", "Producto inexistente.");
    return Response.json(await prisma.product.findUnique({ where: { id: params.productId } }));
  } catch {
    return unexpectedError();
  }
}

export async function DELETE(_request: Request, context: Context) {
  const params = await getParams(context);
  if (!params) return errorResponse(400, "INVALID_PRODUCT_ID", "El producto no es válido.");
  const access = await authorizeBusiness(params.businessId);
  if ("response" in access) return access.response;

  try {
    const product = await prisma.product.updateMany({ where: { id: params.productId, businessId: params.businessId, deletedAt: null }, data: { status: "ARCHIVED", deletedAt: new Date() } });
    if (product.count !== 1) return errorResponse(404, "PRODUCT_NOT_FOUND", "Producto inexistente.");
    return Response.json({ ok: true });
  } catch {
    return unexpectedError();
  }
}