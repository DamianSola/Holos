import { authorizeBusiness } from "@/server/auth/authorization";
import { getBusinessDashboard } from "@/server/services/dashboard";

type Context = { params: Promise<{ businessId: string }> };

export async function GET(_request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;
  return Response.json(await getBusinessDashboard(businessId));
}