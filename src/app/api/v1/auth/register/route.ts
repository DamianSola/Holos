import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { errorResponse, isDatabaseInitializationError, unexpectedError } from "@/server/http";
import { createSession } from "@/server/auth/session";
import { trialEndsAtFrom } from "@/server/billing/plan";
import { imageSchema } from "@/server/validators/domain";

const registerSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(12).max(128),
  name: z.string().trim().min(1).max(120),
  image: imageSchema.optional(),
}).strict();

export async function POST(request: Request) {
  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "Datos inválidos.", parsed.error.flatten());

  const emailNormalized = parsed.data.email.toLowerCase();
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email: parsed.data.email, emailNormalized, passwordHash, name: parsed.data.name, image: parsed.data.image || null },
      });
      await tx.subscription.create({
        data: { userId: created.id, status: "TRIALING", trialEndsAt: trialEndsAtFrom() },
      });
      return created;
    });

    await createSession(user.id);
    return Response.json({ id: user.id, email: user.email, name: user.name }, { status: 201 });
  } catch (error) {
    if (isDatabaseInitializationError(error)) {
      console.error("Database unavailable during registration", error);
      return errorResponse(503, "DATABASE_UNAVAILABLE", "El servicio de datos no está disponible.");
    }
    if (error instanceof Error && error.message.includes("Unique constraint")) return errorResponse(409, "EMAIL_IN_USE", "No se pudo crear la cuenta.");
    return unexpectedError();
  }
}