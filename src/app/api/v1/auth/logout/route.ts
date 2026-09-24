import { deleteSession, getSessionUser } from "@/server/auth/session";

export async function POST() {
  const user = await getSessionUser();
  if (user) await deleteSession();
  return new Response(null, { status: 204 });
}