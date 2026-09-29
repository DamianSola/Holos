import { applyMercadoPagoNotification } from "@/server/billing/mercadopago";

async function handle(request: Request) {
  const url = new URL(request.url);
  const body = request.method === "POST" ? await request.json().catch(() => null) as { type?: string; topic?: string; data?: { id?: string | number }; id?: string | number } | null : null;
  const topic = body?.type ?? body?.topic ?? url.searchParams.get("topic") ?? url.searchParams.get("type") ?? "";
  const id = body?.data?.id ?? body?.id ?? url.searchParams.get("id");
  if ((topic === "payment" || topic.startsWith("payment.")) && id) {
    await applyMercadoPagoNotification(String(id));
  }
  return Response.json({ ok: true });
}

export async function POST(request: Request) {
  try {
    return await handle(request);
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    return await handle(request);
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
