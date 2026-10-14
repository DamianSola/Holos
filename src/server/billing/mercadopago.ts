import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { appUrl } from "@/server/app-url";
import { ensureSubscription } from "@/server/billing/access";
import { extendPeriod } from "@/server/billing/plan";
import { getPlatformSettings } from "@/server/billing/settings";

export async function mpAccessToken() {
  const settings = await getPlatformSettings();
  return settings.mpAccessToken || process.env.MERCADOPAGO_ACCESS_TOKEN || "";
}

export async function checkoutConfigured() {
  return Boolean(await mpAccessToken());
}

export async function createCheckout(user: { id: string; email: string }): Promise<{ error: string } | { url: string }> {
  const token = await mpAccessToken();
  if (!token) return { error: "El cobro con Mercado Pago todavía no está habilitado." };
  const settings = await getPlatformSettings();
  const response = await fetch("https://api.mercadopago.com/preapproval", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      reason: settings.planName,
      external_reference: user.id,
      payer_email: user.email,
      back_url: `${appUrl()}/billing?pago=ok`,
      status: "pending",
      auto_recurring: {
        frequency: settings.periodDays,
        frequency_type: "days",
        transaction_amount: settings.monthlyAmountArs,
        currency_id: "ARS",
      },
    }),
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json().catch(() => null) as { init_point?: string } | null;
  const url = payload?.init_point;
  if (!response.ok || !url) return { error: "Mercado Pago no dejó crear la suscripción. Revisá el token y que la cuenta tenga suscripciones habilitadas." };
  return { url };
}

export async function applyPreapprovalNotification(preapprovalId: string) {
  const token = await mpAccessToken();
  if (!token || !preapprovalId) return;
  const response = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("MP_PREAPPROVAL_LOOKUP_FAILED");
  const preapproval = await response.json() as { status?: string; external_reference?: string };
  const userId = String(preapproval.external_reference ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return;
  if (preapproval.status === "paused") {
    await prisma.subscription.updateMany({ where: { userId, status: "ACTIVE" }, data: { status: "PAST_DUE" } });
  }
  if (preapproval.status === "cancelled") {
    await prisma.subscription.updateMany({ where: { userId }, data: { status: "CANCELED" } });
  }
}

export async function applyAuthorizedPayment(authorizedPaymentId: string) {
  const token = await mpAccessToken();
  if (!token || !authorizedPaymentId) return;
  const response = await fetch(`https://api.mercadopago.com/authorized_payments/${authorizedPaymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) return;
  const payload = await response.json() as { preapproval_id?: string; external_reference?: string; payment?: { id?: string | number } };
  let userId = String(payload.external_reference ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(userId) && payload.preapproval_id) {
    const preapproval = await fetch(`https://api.mercadopago.com/preapproval/${payload.preapproval_id}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (preapproval.ok) {
      const body = await preapproval.json() as { external_reference?: string };
      userId = String(body.external_reference ?? "");
    }
  }
  const paymentId = payload.payment?.id;
  if (paymentId) await applyMercadoPagoNotification(String(paymentId), userId);
}

export async function applyMercadoPagoNotification(paymentId: string, fallbackUserId = "") {
  const token = await mpAccessToken();
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
  const fromPayment = String(payment.external_reference ?? "");
  const userId = /^[0-9a-f-]{36}$/i.test(fromPayment) ? fromPayment : fallbackUserId;
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
      const settings = await getPlatformSettings();
      await tx.subscription.update({
        where: { userId },
        data: { status: "ACTIVE", currentPeriodEnd: extendPeriod(subscription.currentPeriodEnd, new Date(), settings.periodDays) },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return;
    throw error;
  }
}
