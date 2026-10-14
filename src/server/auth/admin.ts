import { errorResponse } from "@/server/http";
import { getSessionUser } from "@/server/auth/session";

export async function requirePlatformAdmin() {
  const user = await getSessionUser();
  if (!user) return { response: errorResponse(401, "UNAUTHORIZED", "Sesión requerida.") };
  if (!user.platformAdmin) return { response: errorResponse(403, "FORBIDDEN", "No tenés acceso al admin de Holos.") };
  return { user };
}
