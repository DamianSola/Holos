"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type BusinessSummary = {
  id: string;
  name: string;
  role: "OWNER" | "EMPLOYEE";
  customerCount: number;
  productCount: number;
  salesMonthMinor: number;
  salesTodayMinor: number;
  criticalProducts: number;
};

type Portfolio = {
  businesses: Array<{ id: string; name: string; role: "OWNER" | "EMPLOYEE" }>;
  totals: { businessCount: number; customerCount: number; productCount: number; criticalProducts: number; salesMonthMinor: number; salesTodayMinor: number; expensesMonthMinor: number; netMonthMinor: number };
  trend: Array<{ label: string; incomeMinor: number; expensesMinor: number; netMinor: number; current: boolean; incomeDeltaPercent: number | null; expensesDeltaPercent: number | null; netDeltaPercent: number | null }>;
};

const emptyForm = { name: "" };

export function BusinessPage({ initialPortfolio }: { initialPortfolio: Portfolio }) {
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const response = await fetch("/api/v1/me", { cache: "no-store" });
    if (!response.ok) {
      setError("No se pudieron cargar tus negocios.");
      setLoading(false);
      return;
    }

    const data = await response.json();
    setBusinesses(data.businesses ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    const response = await fetch("/api/v1/businesses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name.trim() }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.message ?? "No se pudo crear el negocio.");
      setSaving(false);
      return;
    }

    setForm(emptyForm);
    setSuccess("Negocio creado correctamente.");
    setSaving(false);
    await load();
  }

  async function archiveBusiness(business: BusinessSummary) {
    if (business.role !== "OWNER") return;
    const confirmed = window.confirm(`¿Archivar ${business.name}? Primero descargá el respaldo si necesitás conservarlo fuera de la aplicación.`);
    if (!confirmed) return;
    setError(""); setSuccess("");
    const response = await fetch(`/api/v1/businesses/${business.id}`, { method: "DELETE" });
    if (!response.ok) { setError("No se pudo archivar el negocio."); return; }
    setSuccess(`${business.name} fue archivado. Su información histórica quedó conservada.`);
    await load();
  }

  function exportBusiness(businessId: string, format: "json" | "print") {
    window.open(`/api/v1/businesses/${businessId}/export?format=${format}`, "_blank", "noopener,noreferrer");
  }

  const totals = useMemo(() => ({
    businesses: businesses.length,
    customers: businesses.reduce((sum, item) => sum + item.customerCount, 0),
    products: businesses.reduce((sum, item) => sum + item.productCount, 0),
    revenue: businesses.reduce((sum, item) => sum + item.salesMonthMinor, 0),
  }), [businesses]);

  return (
    <section className="module-page portfolio-page">
      <p className="eyebrow">Portfolio overview</p>
      <h1>Todos tus negocios</h1>
      <p className="module-description">Una vista consolidada de ingresos, gastos, operación y evolución de todos los negocios a los que tenés acceso.</p>

      <div className="portfolio-stat-grid">
        <MetricCard label="Negocios" value={String(initialPortfolio.totals.businessCount)} detail="con acceso activo" tone="neutral" icon="01" />
        <MetricCard label="Ingresos del mes" value={formatMoney(initialPortfolio.totals.salesMonthMinor)} detail={`${formatMoney(initialPortfolio.totals.salesTodayMinor)} hoy`} tone="income" icon="$" trend={initialPortfolio.trend.map((period) => period.incomeMinor)} />
        <MetricCard label="Gastos del mes" value={formatMoney(initialPortfolio.totals.expensesMonthMinor)} detail="registrados en todos" tone="expense" icon="-" trend={initialPortfolio.trend.map((period) => period.expensesMinor)} />
        <MetricCard label="Resultado neto" value={formatMoney(initialPortfolio.totals.netMonthMinor)} detail="ingresos menos gastos" tone={initialPortfolio.totals.netMonthMinor >= 0 ? "income" : "expense"} icon="↗" trend={initialPortfolio.trend.map((period) => period.netMinor)} />
        <MetricCard label="Clientes" value={String(initialPortfolio.totals.customerCount)} detail="en todos los negocios" tone="neutral" icon="◎" />
        <MetricCard label="Stock crítico" value={String(initialPortfolio.totals.criticalProducts)} detail={`${initialPortfolio.totals.productCount} productos activos`} tone={initialPortfolio.totals.criticalProducts ? "expense" : "income"} icon="!" />
      </div>

      <section className="portfolio-health panel">
        <div><p className="eyebrow">Salud operativa</p><h2>Tu portfolio está {initialPortfolio.totals.criticalProducts ? "pidiendo atención" : "en buen estado"}</h2><p>Señal basada en stock crítico, resultado neto y actividad de tus negocios.</p></div>
        <div className="health-meter"><span style={{ width: `${healthScore(initialPortfolio)}%` }} /><strong>{healthScore(initialPortfolio)}%</strong></div>
      </section>

      <section className="portfolio-trend panel">
        <div className="panel-heading"><div><p className="eyebrow">Evolución consolidada</p><h2>Ingresos, gastos y resultado</h2></div><span className="panel-count">Últimos 6 meses</span></div>
        <div className="trend-table-wrap"><table className="trend-table"><thead><tr><th>Período</th><th>Ingresos</th><th>Gastos</th><th>Resultado neto</th><th>Variación</th></tr></thead><tbody>{initialPortfolio.trend.map((period) => <tr className={period.current ? "is-current" : ""} key={`${period.label}-${period.current}`}><th scope="row">{period.label}{period.current && <span className="current-period">Actual</span>}</th><td className="income-cell">{formatMoney(period.incomeMinor)}</td><td className="expense-cell">{formatMoney(period.expensesMinor)}</td><td className={period.netMinor >= 0 ? "net-cell-positive" : "net-cell-negative"}>{formatMoney(period.netMinor)}</td><td><div className="change-list"><span>Ingresos <b className={deltaClass(period.incomeDeltaPercent)}>{formatChange(period.incomeDeltaPercent)}</b></span><span>Gastos <b className={deltaClass(period.expensesDeltaPercent)}>{formatChange(period.expensesDeltaPercent)}</b></span><span>Neto <b className={deltaClass(period.netDeltaPercent)}>{formatChange(period.netDeltaPercent)}</b></span></div></td></tr>)}</tbody></table></div>
        <p className="trend-caption">Las variaciones se calculan sobre el total consolidado de todos tus negocios.</p>
      </section>

      <form className="customer-form" onSubmit={createBusiness}>
        <div className="customer-form-heading">
          <div>
            <h2>Crear negocio</h2>
            <p>Agregá un nuevo negocio y empezá a gestionarlo.</p>
          </div>
        </div>
        <div className="customer-form-grid">
          <label className="customer-form-wide">
            Nombre del negocio
            <input value={form.name} onChange={(event) => setForm({ name: event.target.value })} maxLength={160} required />
          </label>
        </div>
        <button className="auth-submit" type="submit" disabled={saving}>{saving ? "Creando..." : "Crear negocio"}</button>
      </form>

      {error && <p className="form-error" role="alert">{error}</p>}
      {success && <p className="form-success" role="status">{success}</p>}

      <div className="portfolio-section-heading"><div><p className="eyebrow">Business directory</p><h2>Mis negocios</h2></div><span className="panel-count">{totals.businesses} registrados</span></div>
      {loading ? (
        <div className="module-state">Cargando negocios...</div>
      ) : businesses.length ? (
        <div className="customer-list">
          {businesses.map((business) => (
            <article className="customer-card" key={business.id}>
              <div className="customer-card-header">
                <div>
                  <strong>{business.name}</strong>
                  <p>Rol: {business.role}</p>
                </div>
                <span className="customer-pill">{business.role}</span>
              </div>

              <div className="customer-contact">
                <span>Clientes: {business.customerCount}</span>
                <span>Productos: {business.productCount}</span>
                <span>Stock crítico: {business.criticalProducts}</span>
              </div>

              <div className="customer-actions">
                <a className="secondary-button" href="/">Dashboard general</a>
                <a className="secondary-button" href={`/businesses/${business.id}`}>Abrir negocio</a>
                <a className="secondary-button" href={`/businesses/${business.id}/sales`}>Vender</a>
                <a className="secondary-button" href={`/businesses/${business.id}/products`}>Productos</a>
                <a className="secondary-button" href={`/businesses/${business.id}/customers`}>Clientes</a>
                {business.role === "OWNER" && <><button className="secondary-button" type="button" onClick={() => exportBusiness(business.id, "json")}>Respaldo JSON</button><button className="secondary-button" type="button" onClick={() => exportBusiness(business.id, "print")}>Guardar PDF</button><button className="text-button" type="button" onClick={() => void archiveBusiness(business)}>Archivar</button></>}
                <span className="customer-pill">Mes: {formatMoney(business.salesMonthMinor)}</span>
                <span className="customer-pill">Hoy: {formatMoney(business.salesTodayMinor)}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="module-state">Todavía no creaste ningún negocio.</div>
      )}
    </section>
  );
}

function formatMoney(valueMinor: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(valueMinor / 100);
}

function formatChange(value: number | null) {
  if (value === null) return "base";
  return `${value > 0 ? "+" : ""}${value}%`;
}

function deltaClass(value: number | null) {
  if (value === null || value === 0) return "delta-flat";
  return value > 0 ? "delta-up" : "delta-down";
}

function MetricCard({ label, value, detail, tone, icon, trend = [] }: { label: string; value: string; detail: string; tone: "neutral" | "income" | "expense"; icon: string; trend?: number[] }) {
  const maximum = Math.max(...trend, 1);
  return <article className={`metric-card metric-card-${tone}`}><div className="metric-card-top"><span className="metric-icon" aria-hidden="true">{icon}</span><span className="metric-label">{label}</span></div><strong>{value}</strong><div className="metric-card-bottom"><small>{detail}</small>{trend.length > 0 && <span className="mini-chart" aria-hidden="true">{trend.map((point, index) => <i key={`${point}-${index}`} style={{ height: `${Math.max(15, (point / maximum) * 100)}%` }} />)}</span>}</div></article>;
}

function healthScore(portfolio: Portfolio) {
  const stockPenalty = Math.min(portfolio.totals.criticalProducts * 8, 48);
  const netPenalty = portfolio.totals.netMonthMinor < 0 ? 24 : 0;
  return Math.max(18, 100 - stockPenalty - netPenalty);
}
