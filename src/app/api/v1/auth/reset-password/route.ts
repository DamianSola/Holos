import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { errorResponse, unexpectedError } from "@/server/http";

const schema = z.object({
  token: z.string().trim().min(32).max(200),
  password: z.string().min(12).max(128),
}).strict();

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "Datos inválidos.");

  try {
    const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
    const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!row || row.usedAt || row.expiresAt <= new Date()) {
      return errorResponse(400, "INVALID_TOKEN", "El enlace venció o no es válido.");
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    await prisma.$transaction([
      prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      prisma.session.deleteMany({ where: { userId: row.userId } }),
    ]);
    return Response.json({ ok: true });
  } catch {
    return unexpectedError();
  }
}
