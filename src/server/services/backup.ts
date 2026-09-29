import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@/lib/db";
import { loadBusinessExport } from "@/server/services/business-export";
import { sendMail, smtpConfigured } from "@/server/services/mail";

type ExportedBusiness = NonNullable<Awaited<ReturnType<typeof loadBusinessExport>>>;

function backupDir() {
  if (process.env.BACKUP_DIR) return process.env.BACKUP_DIR;
  if (process.env.VERCEL) return "/tmp/holos-backups";
  return join(process.cwd(), "backups");
}

export async function runBackup() {
  const snapshot = await prisma.backupSnapshot.create({ data: { status: "RUNNING" } });
  try {
    const businesses = await prisma.business.findMany({ where: { deletedAt: null }, select: { id: true } });
    const exported: ExportedBusiness[] = [];
    for (const business of businesses) {
      const full = await loadBusinessExport(business.id);
      if (full) exported.push(full);
    }
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      select: { id: true, email: true, name: true, passwordHash: true, status: true, createdAt: true },
    });
    const body = JSON.stringify({ exportedAt: new Date().toISOString(), businesses: exported, users });
    const dir = backupDir();
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, `holos-${new Date().toISOString().replaceAll(":", "-")}.json`);
    await writeFile(filePath, body, "utf8");
    const emailedOwners = await emailOwnerCopies(exported);
    await prisma.backupSnapshot.update({
      where: { id: snapshot.id },
      data: { status: "SUCCEEDED", byteSize: Buffer.byteLength(body), filePath, emailedOwners, finishedAt: new Date() },
    });
    await pruneBackups();
    return { ok: true as const, id: snapshot.id, byteSize: Buffer.byteLength(body), emailedOwners };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Error";
    await prisma.backupSnapshot.update({
      where: { id: snapshot.id },
      data: { status: "FAILED", error: message, finishedAt: new Date() },
    });
    throw error;
  }
}

async function emailOwnerCopies(businesses: ExportedBusiness[]) {
  if (!smtpConfigured()) return 0;
  const byOwner = new Map<string, ExportedBusiness[]>();
  for (const business of businesses) {
    for (const membership of business.memberships) {
      if (membership.role !== "OWNER" || membership.deletedAt) continue;
      const list = byOwner.get(membership.user.email) ?? [];
      list.push(business);
      byOwner.set(membership.user.email, list);
    }
  }

  let sent = 0;
  for (const [email, owned] of byOwner) {
    const delivered = await sendMail({
      to: email,
      subject: "Respaldo de tus negocios en Holos",
      text: "Adjuntamos una copia de los datos de tus negocios. Guardala fuera de Holos. Si perdés el acceso, con este archivo se puede reconstruir la operación.",
      attachments: [{
        filename: "holos-respaldo.json",
        content: JSON.stringify({ exportedAt: new Date().toISOString(), businesses: owned }),
        contentType: "application/json",
      }],
    });
    if (delivered) sent += 1;
  }
  return sent;
}

async function pruneBackups() {
  const stale = await prisma.backupSnapshot.findMany({ orderBy: { createdAt: "desc" }, skip: 14 });
  await Promise.all(stale.map(async (row) => {
    if (row.filePath) await unlink(row.filePath).catch(() => undefined);
  }));
  if (stale.length) await prisma.backupSnapshot.deleteMany({ where: { id: { in: stale.map((row) => row.id) } } });
}
