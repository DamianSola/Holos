import { businessIsEntitled } from "@/server/billing/access";
import { errorResponse } from "@/server/http";
import { requireBusinessMembership } from "@/server/auth/session";
import { businessIdSchema } from "@/server/validators/domain";

export async function authorizeBusiness(businessId: string, roles?: Array<"OWNER" | "EMPLOYEE">, options?: { allowWhenUnpaid?: boolean }) {
  if (!businessIdSchema.safeParse(businessId).success) return { response: errorResponse(400, "INVALID_BUSINESS_ID", "El negocio no es válido.") };
  const result = await requireBusinessMembership(businessId);
  if (!result.user) return { response: errorResponse(401, "UNAUTHORIZED", "Sesión requerida.") };
  if (!result.membership || (roles && !roles.includes(result.membership.role))) {
    return { response: errorResponse(403, "FORBIDDEN", "No tenés acceso a este negocio.") };
  }
  if (!options?.allowWhenUnpaid && !(await businessIsEntitled(businessId))) {
    const message = result.membership.role === "OWNER"
      ? "Tu prueba terminó. Activá Holos para seguir operando."
      : "El dueño del negocio tiene que activar Holos para seguir operando.";
    return { response: errorResponse(402, "PAYMENT_REQUIRED", message) };
  }
  return { user: result.user, membership: result.membership };
}