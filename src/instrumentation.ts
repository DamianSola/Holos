export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  const globalState = globalThis as { holosBackup?: boolean };
  if (globalState.holosBackup) return;
  globalState.holosBackup = true;

  const tick = async () => {
    const { runBackup } = await import("@/server/services/backup");
    await runBackup().catch((error: unknown) => {
      console.error("[holos backup]", error instanceof Error ? error.message : error);
    });
  };

  setTimeout(() => void tick(), 60_000);
  setInterval(() => void tick(), 24 * 60 * 60 * 1000);
}
