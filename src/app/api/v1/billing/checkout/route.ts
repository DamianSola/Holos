import { createCheckout } from "@/server/billing/mercadopago";
import { getSessionUser } from "@/server/auth/session";
import { errorResponse, unexpectedError } from "@/server/http";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return errorResponse(401, "UNAUTHORIZED", "Sesión requerida.");

  try {
    const result = await createCheckout({ id: user.id, email: user.email });
    if ("url" in result) return Response.json({ url: result.url });
    return errorResponse(503, "CHECKOUT_UNAVAILABLE", result.error);
  } catch {
    return unexpectedError();
  }
}
