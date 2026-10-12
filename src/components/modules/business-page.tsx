"use client";

import { FormEvent, useMemo, useState } from "react";
import { ImagePicker } from "@/components/forms/account-fields";
import { ConfirmModal } from "@/components/forms/confirm-modal";

type BusinessKind = "STORE" | "SERVICE";

type BusinessSummary = {
  id: string;
  name: string;
  kind: BusinessKind;
  image: string | null;
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

const emptyForm = { name: "", kind: "STORE" as BusinessKind, image: "" };

export function BusinessPage({ initialPortfolio, initialBusinesses }: { initialPortfolio: Portfolio; initialBusinesses: BusinessSummary[] }) {
  const [businesses, setBusinesses] = useState<BusinessSummary[]>(initialBusinesses);
  const [form, setForm] = useState(emptyForm);
  const [pendingArchive, setPendingArchive] = useState<BusinessSummary | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const response = await fetch("/api/v1/directory", { cache: "no-store" });
    if (!response.ok) {
      setError("No se pudieron cargar tus negocios.");
      setLoading(false);
      return;
    }

    const data = await response.json();
    setBusinesses(data.businesses ?? []);
    setLoading(false);
  }

  async function createBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    const response = await fetch("/api/v1/businesses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name.trim(), kind: form.kind, ...(form.image ? { image: form.image } : {}) }),
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

  async function updateBusinessImage(businessId: string, image: string) {
    setError("");
    setSuccess("");
    const response = await fetch(`/api/v1/businesses/${businessId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.message ?? "No se pudo actualizar la imagen del negocio.");
      return;
    }
    setSuccess("Imagen del negocio actualizada.");
    await load();
  }

  async function archiveBusiness(business: BusinessSummary) {
    if (business.role !== "OWNER") return;
    setPendingArchive(null);
    setError(""); setSuccess("");
    const response = await fetch(`/api/v1/businesses/${business.id}`, { method: "DELETE" });
    if (!response.ok) { setError("No se pudo archivar el negocio."); return; }
    setSuccess(`${business.name} fue archivado. Su información histórica quedó conservada.`);
    await load();
  }

  function exportBusiness(businessId: string, format: "json" | "print") {
    window.open(`/api/v1/businesses/${businessId}/export?format=${format}`, "_blank", "noopener,noreferrer");
  }

  const listed = useMemo(() => [...businesses].sort((left, right) => right.salesMonthMinor - left.salesMonthMinor || left.name.localeCompare(right.name, "es")), [businesses]);
  const alerts = listed.filter((business) => business.criticalProducts > 0);

  return (
    <section className="module-page portfolio-page">
      <p className="eyebrow">Tablero general</p>
      <h1>Todos tus negocios</h1>

      <div className="portfolio-stat-grid">
        <article className="summary-card"><span>Entró hoy</span><strong>{formatMoney(initialPortfolio.totals.salesTodayMinor)}</strong></article>
        <article className="summary-card"><span>Ingresos del mes</span><strong>{formatMoney(initialPortfolio.totals.salesMonthMinor)}</strong></article>
        <article className="summary-card">
          <span>Resultado del mes</span>
          <strong className={initialPortfolio.totals.netMonthMinor >= 0 ? "metric-positive" : "metric-negative"}>{formatMoney(initialPortfolio.totals.netMonthMinor)}</strong>
          <small>Gastos {formatMoney(initialPortfolio.totals.expensesMonthMinor)}</small>
        </article>
      </div>

      <MonthChart trend={initialPortfolio.trend} />

      {alerts.length > 0 && (
        <ul className="portfolio-alerts">
          {alerts.map((business) => (
            <li key={business.id}>
              <a href={`/businesses/${business.id}${business.kind === "SERVICE" ? "/stock" : "/products"}`}>{business.name} · {stockAlert(business.criticalProducts)}</a>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}
      {success && <p className="form-success" role="status">{success}</p>}

      <div className="portfolio-section-heading"><h2>Mis negocios</h2><span className="panel-count">{listed.length}</span></div>
      {loading ? (
        <div className="module-state">Cargando negocios...</div>
      ) : listed.length ? (
        <div className="business-directory">
          {listed.map((business) => {
            const service = business.kind === "SERVICE";
            return (
              <article className="business-row" key={business.id}>
                <div className="business-row-who">
                  {business.image ? <img className="business-logo" src={business.image} alt="" /> : <span className="business-mark" aria-hidden="true">{businessInitial(business.name)}</span>}
                  <div>
                    <strong>{business.name}</strong>
                    <p>{business.role === "OWNER" ? "Dueño" : "Colaborador"} · {service ? "Servicios" : "Venta de productos"}</p>
                  </div>
                </div>
                <div className="business-row-money is-today"><span>Hoy</span><strong>{formatMoney(business.salesTodayMinor)}</strong></div>
                <div className="business-row-money is-month"><span>Este mes</span><strong>{formatMoney(business.salesMonthMinor)}</strong></div>
                <a className="secondary-button" href={`/businesses/${business.id}`}>Abrir</a>
                {business.role === "OWNER" && (
                  <div className="business-row-tools">
                    <ImagePicker label={business.image ? "Cambiar imagen" : "Agregar imagen"} value={business.image ?? ""} onChange={(image) => void updateBusinessImage(business.id, image)} />
                    <button className="secondary-button" type="button" onClick={() => exportBusiness(business.id, "json")}>Respaldo JSON</button>
                    <button className="secondary-button" type="button" onClick={() => exportBusiness(business.id, "print")}>Guardar PDF</button>
                    <button className="text-button" type="button" onClick={() => setPendingArchive(business)}>Archivar</button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="module-state">Todavía no creaste ningún negocio.</div>
      )}

      <form className="customer-form" onSubmit={createBusiness}>
        <div className="customer-form-heading">
          <div>
            <h2>Crear negocio</h2>
          </div>
        </div>
        <div className="customer-form-grid">
          <label className="customer-form-wide">
            Nombre del negocio
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} maxLength={160} required />
          </label>
          <label>
            Qué tipo de negocio
            <select value={form.kind} onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value as BusinessKind }))}>
              <option value="STORE">Venta de productos</option>
              <option value="SERVICE">Servicios</option>
            </select>
          </label>
          <ImagePicker label="Imagen del negocio" value={form.image} onChange={(image) => setForm((current) => ({ ...current, image }))} />
        </div>
        <button className="auth-submit" type="submit" disabled={saving}>{saving ? "Creando..." : "Crear negocio"}</button>
      </form>
      {pendingArchive && <ConfirmModal title="Archivar negocio" message={`¿Archivar ${pendingArchive.name}? Primero descargá el respaldo si necesitás conservarlo fuera de la aplicación.`} onCancel={() => setPendingArchive(null)} onAccept={() => void archiveBusiness(pendingArchive)} />}
    </section>
  );
}

function businessInitial(name: string) {
  const letter = name.trim().charAt(0);
  return letter ? letter.toLocaleUpperCase("es-AR") : "H";
}

function formatMoney(valueMinor: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(valueMinor / 100);
}

function MonthChart({ trend }: { trend: Portfolio["trend"] }) {
  const peak = Math.max(...trend.flatMap((period) => [period.incomeMinor, period.expensesMinor]), 1);
  const currentIndex = trend.findIndex((period) => period.current);
  const current = currentIndex >= 0 ? trend[currentIndex] : undefined;
  const previous = currentIndex > 0 ? trend[currentIndex - 1].incomeMinor : null;
  const phrase = incomePhrase(current?.incomeMinor ?? 0, previous);
  return (
    <section className="portfolio-chart panel" aria-label="Ingresos y gastos de los últimos 6 meses">
      <div className="panel-heading">
        <h2>Ingresos y gastos</h2>
        {phrase && <p className={deltaClass(previous === null || previous === 0 ? 0 : (current?.incomeMinor ?? 0) - previous)}>{phrase}</p>}
      </div>
      <div className="chart-legend">
        <span className="trend-income"><i className="trend-dot trend-income" />Ingresos</span>
        <span className="trend-expenses"><i className="trend-dot trend-expenses" />Gastos</span>
      </div>
      <div className="month-chart">
        {trend.map((period) => (
          <div className={period.current ? "month-chart-col is-current" : "month-chart-col"} key={`${period.label}-${period.current}`} aria-label={`${period.label}: ingresos ${formatMoney(period.incomeMinor)}, gastos ${formatMoney(period.expensesMinor)}`}>
            <div className="month-chart-bars" aria-hidden="true">
              <span className="month-bar income" style={{ height: `${barHeight(period.incomeMinor, peak)}%` }} />
              <span className="month-bar expense" style={{ height: `${barHeight(period.expensesMinor, peak)}%` }} />
            </div>
            <span className="month-chart-label">{period.label}{period.current ? " · actual" : ""}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function barHeight(value: number, peak: number) {
  if (value <= 0) return 0;
  return Math.max(8, Math.round((value / peak) * 100));
}

function incomePhrase(current: number, previous: number | null) {
  if (previous === null) return "";
  if (previous === 0) return current === 0 ? "Ingresos iguales al mes pasado" : "El mes pasado no hubo ingresos";
  const delta = Math.round(((current - previous) / Math.abs(previous)) * 100);
  if (delta === 0) return "Ingresos iguales al mes pasado";
  return `Ingresos ${delta > 0 ? "+" : ""}${delta}% respecto al mes pasado`;
}

function stockAlert(count: number) {
  return count === 1 ? "1 producto en stock crítico" : `${count} productos en stock crítico`;
}

function deltaClass(value: number | null) {
  if (value === null || value === 0) return "delta-flat";
  return value > 0 ? "delta-up" : "delta-down";
}
