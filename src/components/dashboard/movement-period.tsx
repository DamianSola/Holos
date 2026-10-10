"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import type { MovementPeriod } from "@/lib/movement-period";

type Totals = { incomeMinor: number; expensesMinor: number; productsSold: number };

const periods: Array<{ id: MovementPeriod; label: string }> = [
  { id: "month", label: "Mes" },
  { id: "week", label: "Semana" },
  { id: "day", label: "Día" },
];

export function MovementPeriod({ businessId, service, movement: initialMovement, pulseHeading, activity, children }: { businessId: string; service: boolean; movement: Record<MovementPeriod, Totals>; pulseHeading: string; activity: ReactNode; children: ReactNode }) {
  const today = useMemo(todayKey, []);
  const [period, setPeriod] = useState<MovementPeriod>("month");
  const [draft, setDraft] = useState(today);
  const [anchor, setAnchor] = useState(today);
  const [movement, setMovement] = useState(initialMovement);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const shownAnchor = useRef(today);
  const totals = movement[period];
  const range = cardRange(period, anchor, today);
  const selectedDay = period === "day" && anchor !== today;

  useEffect(() => {
    if (draft === today) {
      shownAnchor.current = today;
      setAnchor(today);
      setMovement(initialMovement);
      setLoading(false);
      setError("");
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/v1/businesses/${businessId}/dashboard?on=${draft}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("fail");
        return response.json() as Promise<{ movement: Record<MovementPeriod, Totals> }>;
      })
      .then((data) => {
        shownAnchor.current = draft;
        setAnchor(draft);
        setMovement(data.movement);
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setDraft(shownAnchor.current);
        setError("No se pudo cargar esa fecha.");
        setLoading(false);
      });
    return () => controller.abort();
  }, [draft, businessId, initialMovement, today]);

  return (
    <>
      <div className="movement-toolbar">
        <div className="view-switch movement-switch" role="group" aria-label="Período del movimiento">
          {periods.map((option) => (
            <button key={option.id} className={period === option.id ? "auth-submit" : "secondary-button"} type="button" aria-pressed={period === option.id} onClick={() => setPeriod(option.id)}>{option.label}</button>
          ))}
        </div>
        <div className="movement-date">
          <label>Fecha
            <input type="date" value={draft} aria-label="Fecha del movimiento" onChange={(event) => { if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) setDraft(event.target.value); }} />
          </label>
          <button className="secondary-button" type="button" onClick={() => setDraft(today)}>Hoy</button>
        </div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <section className="status-grid" aria-label="Movimiento del negocio" aria-busy={loading}>
        <StatusCard label={selectedDay ? `${service ? "Ingresos" : "Ventas"} del ${range}` : `${service ? "Ingresos" : "Ventas"} de ${range}`} value={formatMoney(totals.incomeMinor)} tone="ready" />
        <StatusCard label={selectedDay ? `Gastos del ${range}` : `Gastos de ${range}`} value={formatMoney(totals.expensesMinor)} tone="pending" />
        {children}
      </section>
      <section className="dashboard-lower-grid">
        {activity}
        <div className="panel next-panel">
          <p className="eyebrow">Pulso</p>
          <h2>{pulseHeading}</h2>
        </div>
      </section>
    </>
  );
}

function cardRange(period: MovementPeriod, anchor: string, today: string) {
  if (period === "day") return anchor === today ? "hoy" : formatCivil(anchor, { day: "numeric", month: "long", year: "numeric" });
  if (period === "week") return mondayKey(anchor) === mondayKey(today) ? "esta semana" : `la semana del ${formatCivil(mondayKey(anchor), { day: "numeric", month: "long" })}`;
  return anchor.slice(0, 7) === today.slice(0, 7) ? "este mes" : formatCivil(anchor, { month: "long", year: "numeric" });
}

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function formatCivil(key: string, options: Intl.DateTimeFormatOptions) {
  const [year, month, day] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", { ...options, timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(Date.UTC(year, month - 1, day, 15)));
}

function mondayKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const weekday = utc.getUTCDay();
  utc.setUTCDate(utc.getUTCDate() - (weekday === 0 ? 6 : weekday - 1));
  return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, "0")}-${String(utc.getUTCDate()).padStart(2, "0")}`;
}

export function StatusCard({ label, value, tone }: { label: string; value: string; tone: "ready" | "pending" }) {
  return (
    <article className="status-card">
      <div className="status-card-topline">
        <span className="status-label">{label}</span>
        <span className={`status-dot status-dot-${tone}`} aria-label={tone === "ready" ? "Ready" : "Pending"} />
      </div>
      <strong>{value}</strong>
    </article>
  );
}

function formatMoney(valueMinor: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(valueMinor / 100);
}
