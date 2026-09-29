import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { appUrl } from "@/server/app-url";
import { ensureSubscription } from "@/server/billing/access";
import { extendPeriod, HOLOS_PLAN, monthlyAmountArs } from "@/server/billing/plan";

export function checkoutConfigured() {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);
}

export async function createCheckout(user: { id: string; email: string }): Promise<{ error: string } | { url: string }> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) return { error: "El cobro con Mercado Pago todavía no está habilitado en este servidor." };

  const amount = monthlyAmountArs();
  const back = `${appUrl()}/billing`;
  const preference: Record<string, unknown> = {
    items: [{ title: `${HOLOS_PLAN.name} — 30 días`, quantity: 1, currency_id: "ARS", unit_price: amount }],
    external_reference: user.id,
    payer: { email: user.email },
    back_urls: {
      success: `${back}?pago=ok`,
      pending: `${back}?pago=pendiente`,
      failure: `${back}?pago=error`,
    },
    notification_url: `${appUrl()}/api/v1/billing/mercadopago`,
    metadata: { user_id: user.id },
  };
  if (appUrl().startsWith("https://")) preference.auto_return = "approved";

  const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(preference),
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json().catch(() => null) as { init_point?: string } | null;
  const url = payload?.init_point;
  if (!response.ok || !url) return { error: "No se pudo iniciar el cobro." };
  return { url };
}

export async function applyMercadoPagoNotification(paymentId: string) {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token || !paymentId) return;
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("MP_PAYMENT_LOOKUP_FAILED");
  const payment = await response.json() as {
    id?: string | number;
    status?: string;
    currency_id?: string;
    transaction_amount?: number;
    external_reference?: string;
  };
  if (payment.status !== "approved" || payment.currency_id !== "ARS") return;
  const userId = String(payment.external_reference ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return;
  const amount = Number(payment.transaction_amount);
  if (!Number.isFinite(amount) || amount < 1) return;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return;
  await ensureSubscription(userId);

  try {
    await prisma.$transaction(async (tx) => {
      const id = String(payment.id);
      const existing = await tx.billingPayment.findUnique({ where: { id } });
      if (existing) return;
      const subscription = await tx.subscription.findUnique({ where: { userId } });
      if (!subscription) return;
      await tx.billingPayment.create({ data: { id, userId, amountMinor: Math.round(amount * 100) } });
      await tx.subscription.update({
        where: { userId },
        data: { status: "ACTIVE", currentPeriodEnd: extendPeriod(subscription.currentPeriodEnd) },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return;
    throw error;
  }
}
