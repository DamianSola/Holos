import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { appUrl } from "@/server/app-url";
import { errorResponse, unexpectedError } from "@/server/http";
import { sendMail } from "@/server/services/mail";

const schema = z.object({ email: z.string().trim().email().max(320) }).strict();

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "Datos inválidos.");

  try {
    const user = await prisma.user.findUnique({ where: { emailNormalized: parsed.data.email.toLowerCase() } });
    if (user && !user.deletedAt && user.status === "ACTIVE") {
      const recent = await prisma.passwordResetToken.findFirst({
        where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 60_000) } },
      });
      if (!recent) {
        const raw = randomBytes(32).toString("hex");
        await prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash: createHash("sha256").update(raw).digest("hex"),
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          },
        });
        const url = `${appUrl()}/restablecer?token=${raw}`;
        await sendMail({
          to: user.email,
          subject: "Recuperar tu contraseña de Holos",
          text: `Para elegir una contraseña nueva, abrí este enlace dentro de la próxima hora:\n\n${url}\n\nSi no pediste este cambio, ignorá este mensaje.`,
        });
      }
    }
    return Response.json({ ok: true });
  } catch {
    return unexpectedError();
  }
}
