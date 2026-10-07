import { getSessionUser } from "@/server/auth/session";
import { errorResponse } from "@/server/http";
import { getBusinessDirectory } from "@/server/services/directory";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return errorResponse(401, "UNAUTHORIZED", "Sesión requerida.");
  return Response.json({ businesses: await getBusinessDirectory(user.id) });
}
