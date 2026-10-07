import { authorizeBusiness } from "@/server/auth/authorization";
import { errorResponse } from "@/server/http";
import { getBusinessDashboard } from "@/server/services/dashboard";

type Context = { params: Promise<{ businessId: string }> };

export async function GET(request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;
  const on = new URL(request.url).searchParams.get("on");
  if (!on) return Response.json(await getBusinessDashboard(businessId));
  const instant = argentinaNoon(on);
  if (!instant) return errorResponse(400, "INVALID_DATE", "La fecha no es válida.");
  return Response.json(await getBusinessDashboard(businessId, instant));
}

function argentinaNoon(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const instant = new Date(Date.UTC(year, month - 1, day, 15, 0, 0));
  const key = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
  return key === value ? instant : null;
}