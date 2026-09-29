"use client";

import { FormEvent, useEffect, useState } from "react";

type Billing = {
  planName: string;
  amountArs: number;
  trialDays: number;
  periodDays: number;
  status: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";
  trialEndsAt: string;
  currentPeriodEnd: string | null;
  entitled: boolean;
  checkoutAvailable: boolean;
  lastBackupAt: string | null;
  businesses: Array<{ id: string; name: string }>;
};

const statusLabel: Record<Billing["status"], string> = {
  TRIALING: "Prueba",
  ACTIVE: "Activo",
  PAST_DUE: "Vencido",
  CANCELED: "Cancelado",
};

export function BillingPage({ ownerBlocked, paymentState }: { ownerBlocked: boolean; paymentState: string }) {
  const [billing, setBilling] = useState<Billing | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const response = await fetch("/api/v1/billing", { cache: "no-store" });
      if (cancelled) return;
      if (!response.ok) {
        setError("No se pudo cargar el plan.");
        setLoading(false);
        return;
      }
      setBilling(await response.json());
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  async function pay(event: FormEvent) {
    event.preventDefault();
    setPaying(true);
    setError("");
    const response = await fetch("/api/v1/billing/checkout", { method: "POST" });
    const data = await response.json().catch(() => null) as { url?: string; message?: string } | null;
    if (!response.ok || !data?.url) {
      setError(data?.message ?? "No se pudo iniciar el cobro.");
      setPaying(false);
      return;
    }
    window.location.href = data.url;
  }

  if (loading) return <section className="module-page"><div className="module-state">Cargando plan...</div></section>;
  if (!billing) return <section className="module-page"><div className="module-state">No se pudo cargar el plan.</div></section>;

  const price = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(billing.amountArs);
  const trialLeft = Math.max(0, Math.ceil((new Date(billing.trialEndsAt).getTime() - Date.now()) / 86_400_000));

  return (
    <section className="module-page">
      <p className="eyebrow">Cuenta</p>
      <h1>{billing.planName}</h1>
      <p className="module-description">{billing.trialDays} días de prueba. Después, {price} cubren {billing.periodDays} días. El pago entra por Mercado Pago y, si pagás antes de que venza, los días se suman.</p>
      {ownerBlocked && <p className="form-error" role="alert">El dueño de ese negocio tiene que activar Holos. Vos no podés pagar por esa cuenta.</p>}
      {paymentState === "ok" && <p className="form-success" role="status">Si el pago fue aprobado, el plan queda activo en unos segundos. Actualizá la página.</p>}
      {paymentState === "pendiente" && <p className="form-success" role="status">El pago quedó pendiente. El plan se activa cuando Mercado Pago lo acredita.</p>}
      {paymentState === "error" && <p className="form-error" role="alert">El pago no se completó.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}

      <article className="customer-card">
        <div className="customer-card-header">
          <div>
            <strong>{statusLabel[billing.status]}</strong>
            <p>{billing.entitled ? "Podés operar." : "La operación está frenada hasta que haya un pago."}</p>
          </div>
          <span className="customer-pill">{price}</span>
        </div>
        <div className="customer-contact">
          {billing.status === "TRIALING" && <span>{billing.entitled ? `Quedan ${trialLeft} días de prueba.` : "La prueba terminó."}</span>}
          {billing.currentPeriodEnd && <span>Pago hasta {new Date(billing.currentPeriodEnd).toLocaleDateString("es-AR")}</span>}
          <span>{billing.lastBackupAt ? `Último respaldo automático: ${new Date(billing.lastBackupAt).toLocaleString("es-AR")}` : "Todavía no hubo un respaldo automático. En producción se guarda uno por día."}</span>
        </div>
        <form onSubmit={pay}>
          <button className="auth-submit" type="submit" disabled={paying || !billing.checkoutAvailable}>{paying ? "Abriendo Mercado Pago..." : `Pagar ${billing.periodDays} días`}</button>
        </form>
        {!billing.checkoutAvailable && <p className="module-description">El cobro con Mercado Pago todavía no está habilitado en este servidor.</p>}
      </article>

      <div className="portfolio-section-heading"><div><h2>Tus datos</h2></div></div>
      <p className="module-description">Aunque el plan esté vencido, podés llevarte el respaldo de cada negocio. El ticket de una venta se imprime desde Ventas mientras el plan está activo.</p>
      {billing.businesses.length ? (
        <div className="customer-list">
          {billing.businesses.map((business) => (
            <article className="customer-card" key={business.id}>
              <div className="customer-card-header"><strong>{business.name}</strong></div>
              <div className="customer-actions">
                <a className="secondary-button" href={`/api/v1/businesses/${business.id}/export?format=json`}>Descargar JSON</a>
                <a className="secondary-button" href={`/api/v1/businesses/${business.id}/export?format=print`}>Versión para imprimir</a>
              </div>
            </article>
          ))}
        </div>
      ) : <div className="module-state">Todavía no tenés un negocio propio.</div>}
    </section>
  );
}
