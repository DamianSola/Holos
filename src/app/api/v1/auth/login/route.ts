import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { errorResponse, isDatabaseInitializationError, unexpectedError } from "@/server/http";
import { createSession } from "@/server/auth/session";

const loginSchema = z.object({ email: z.string().trim().email().max(320), password: z.string().min(1).max(128) }).strict();

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "Datos inválidos.");

  try {
    const user = await prisma.user.findUnique({ where: { emailNormalized: parsed.data.email.toLowerCase() } });
    const valid = user ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false;
    if (!user || !valid || user.status !== "ACTIVE" || user.deletedAt) return errorResponse(401, "INVALID_CREDENTIALS", "Credenciales inválidas.");
    await createSession(user.id);
    return Response.json({ id: user.id, email: user.email, name: user.name });
  } catch (error) {
    if (isDatabaseInitializationError(error)) {
      console.error("Database unavailable during login", error);
      return errorResponse(503, "DATABASE_UNAVAILABLE", "El servicio de datos no está disponible.");
    }
    return unexpectedError();
  }
}