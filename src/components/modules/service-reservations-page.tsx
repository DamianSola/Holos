"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { CustomerPicker, type CustomerChoice } from "@/components/forms/customer-picker";
import { ModuleLayout } from "@/components/modules/customers-page";
import { SendReceiptWhatsapp } from "@/components/whatsapp-link";
import { collectionLabel, paidMinor, paymentFits, remainingMinor } from "@/lib/reservation-money";
import { buenosAiresTime, dailyPlaces, defaultSchedule, isoWeekday, slotsOf, type ReservationSchedule } from "@/lib/reservation-schedule";
import { receiptText } from "@/lib/whatsapp";

type PaymentMethod = "CASH" | "TRANSFER" | "CARD" | "OTHER";
type OrderStatus = "SCHEDULED" | "DONE" | "CANCELLED";
type Payment = { id: string; amountMinor: number; paymentMethod: PaymentMethod; paidAt: string };
type Reservation = {
  id: string;
  status: OrderStatus;
  bookedAs: "DATE" | "TURN";
  title: string;
  scheduledFor: string;
  amountMinor: number | null;
  place: string | null;
  customer: { id: string; name: string; phone: string | null };
  payments: Payment[];
  invoice: { id: string; number: string; arcaStatus: string | null; cae: string | null } | null;
};
type Customer = CustomerChoice;
type View = "agenda" | "calendar";

const paymentMethods: Array<{ value: PaymentMethod; label: string }> = [
  { value: "CASH", label: "Efectivo" },
  { value: "TRANSFER", label: "Transferencia" },
  { value: "CARD", label: "Tarjeta" },
  { value: "OTHER", label: "Otro" },
];

const weekdayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const weekdayNumbers = [1, 2, 3, 4, 5, 6, 7];

export function ServiceReservationsPage({ businessId, businessName }: { businessId: string; businessName: string }) {
  const [orders, setOrders] = useState<Reservation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [schedule, setSchedule] = useState<ReservationSchedule>(defaultSchedule);
  const [cupoOpen, setCupoOpen] = useState(false);
  const [view, setView] = useState<View>("agenda");
  const [cursor, setCursor] = useState(() => new Date());
  const [showCancelled, setShowCancelled] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const pendingCustomer = useRef<string | null>(null);

  async function load() {
    const [ordersResponse, customersResponse] = await Promise.all([
      fetch(`/api/v1/businesses/${businessId}/orders`, { cache: "no-store" }),
      fetch(`/api/v1/businesses/${businessId}/customers`, { cache: "no-store" }),
    ]);
    if (!ordersResponse.ok || !customersResponse.ok) {
      setError("No se pudieron cargar las reservas.");
      setLoading(false);
      return;
    }
    const [ordersData, customersData] = await Promise.all([ordersResponse.json(), customersResponse.json()]);
    setOrders(ordersData.items);
    setCustomers(customersData.items);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    async function loadInitialData() {
      const [ordersResponse, customersResponse, scheduleResponse] = await Promise.all([
        fetch(`/api/v1/businesses/${businessId}/orders`, { cache: "no-store" }),
        fetch(`/api/v1/businesses/${businessId}/customers`, { cache: "no-store" }),
        fetch(`/api/v1/businesses/${businessId}/reservation-schedule`, { cache: "no-store" }),
      ]);
      if (cancelled) return;
      if (!ordersResponse.ok || !customersResponse.ok || !scheduleResponse.ok) {
        setError("No se pudieron cargar las reservas.");
        setLoading(false);
        return;
      }
      const [ordersData, customersData, scheduleData] = await Promise.all([ordersResponse.json(), customersResponse.json(), scheduleResponse.json()]);
      if (cancelled) return;
      setOrders(ordersData.items);
      setCustomers(customersData.items);
      setSchedule(scheduleData);
      setLoading(false);
    }
    void loadInitialData();
    return () => { cancelled = true; };
  }, [businessId]);

  const visible = useMemo(() => orders.filter((order) => showCancelled || order.status !== "CANCELLED"), [orders, showCancelled]);
  const byDay = useMemo(() => {
    const groups = new Map<string, Reservation[]>();
    for (const order of visible) {
      const key = dateKey(order.scheduledFor);
      groups.set(key, [...(groups.get(key) ?? []), order]);
    }
    return groups;
  }, [visible]);
  const open = orders.find((order) => order.id === openId) ?? null;
  const weekStart = mondayOf(cursor);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthDays = Array.from({ length: 42 }, (_, index) => addDays(mondayOf(monthStart), index));

  function openCreate(date = dateKey(new Date()), startsAt = "") {
    setError("");
    setOpenId(null);
    setEditing(false);
    setForm({ ...blankForm(), scheduledFor: date, startsAt, customerId: "" });
    setCreating(date);
  }

  function openReservation(order: Reservation) {
    setError("");
    setCreating(null);
    setEditing(false);
    setPaymentAmount("");
    setPaymentMethod("CASH");
    setForm({
      customerId: order.customer.id,
      title: order.title,
      scheduledFor: dateKey(order.scheduledFor),
      place: order.place ?? "",
      startsAt: order.bookedAs === "TURN" ? buenosAiresTime(new Date(order.scheduledFor)) : "",
      amount: order.amountMinor === null ? "" : String(order.amountMinor / 100),
    });
    setOpenId(order.id);
  }

  function closeModal() {
    setCreating(null);
    setOpenId(null);
    setEditing(false);
    setError("");
  }

  async function saveReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingCustomer.current) {
      setError(`Elegí «${pendingCustomer.current}» en la lista o agregalo como cliente nuevo.`);
      return;
    }
    if (!form.customerId) {
      setError("Elegí un cliente.");
      return;
    }
    const amountMinor = pesosToMinor(form.amount);
    if (amountMinor === null || amountMinor <= 0) {
      setError("El presupuesto tiene que ser mayor a cero.");
      return;
    }
    setSaving(true);
    setError("");
    const bookingMode = creating ? schedule.mode : (open?.bookedAs ?? schedule.mode);
    const payload = {
      customerId: form.customerId,
      title: form.title.trim(),
      scheduledFor: form.scheduledFor,
      amountMinor,
      ...(bookingMode === "TURN" ? { startsAt: form.startsAt } : { place: form.place.trim() }),
    };
    const response = await fetch(creating ? `/api/v1/businesses/${businessId}/orders` : `/api/v1/businesses/${businessId}/orders/${openId}`, {
      method: creating ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { message?: string } | null;
      setError(body?.message ?? "No se pudo guardar la reserva.");
      setSaving(false);
      return;
    }
    const saved = await response.json() as Reservation;
    setOrders((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
    setSaving(false);
    setCreating(null);
    setEditing(false);
    setOpenId(saved.id);
    await load();
  }

  async function changeDate(scheduledFor: string) {
    if (!openId || !scheduledFor || (open && dateKey(open.scheduledFor) === scheduledFor)) return;
    setError("");
    setSaving(true);
    const response = await fetch(`/api/v1/businesses/${businessId}/orders/${openId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(open?.bookedAs === "TURN" ? { scheduledFor, startsAt: buenosAiresTime(new Date(open.scheduledFor)) } : { scheduledFor }),
    });
    setSaving(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { message?: string } | null;
      setError(body?.message ?? "No se pudo cambiar la fecha.");
      return;
    }
    const [year, month, day] = scheduledFor.split("-").map(Number);
    setCursor(new Date(year, month - 1, day));
    await load();
  }

  async function setStatus(status: OrderStatus) {
    if (!openId) return;
    setError("");
    const response = await fetch(`/api/v1/businesses/${businessId}/orders/${openId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { message?: string } | null;
      setError(body?.message ?? "No se pudo actualizar la reserva.");
      return;
    }
    await load();
  }

  async function addPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!open || open.amountMinor === null) return;
    const amountMinor = pesosToMinor(paymentAmount);
    if (amountMinor === null || !paymentFits(open.amountMinor, paidMinor(open.payments), amountMinor)) {
      setError("El pago supera el saldo.");
      return;
    }
    setSaving(true);
    setError("");
    const response = await fetch(`/api/v1/businesses/${businessId}/orders/${open.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountMinor, paymentMethod }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { message?: string } | null;
      setError(body?.message ?? "No se pudo registrar el pago.");
      setSaving(false);
      return;
    }
    setPaymentAmount("");
    setSaving(false);
    await load();
  }

  async function issueInvoice() {
    if (!openId) return;
    setSaving(true);
    setError("");
    const response = await fetch(`/api/v1/businesses/${businessId}/orders/${openId}/invoice`, { method: "POST" });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { message?: string } | null;
      setError(body?.message ?? "No se pudo emitir el comprobante.");
      setSaving(false);
      return;
    }
    setSaving(false);
    await load();
  }

  const rangeLabel = view === "agenda" ? weekLabel(weekStart) : monthLabel(cursor);
  const rangeCount = (view === "agenda" ? weekDays : monthDays.filter((day) => day.getMonth() === cursor.getMonth()))
    .reduce((total, day) => total + (byDay.get(dateKey(day))?.length ?? 0), 0);

  return (
    <ModuleLayout eyebrow="Operación" title="Reservas">
      <div className="reservation-toolbar">
        <div className="view-switch" role="group" aria-label="Vista de reservas">
          <button className={view === "agenda" ? "auth-submit" : "secondary-button"} type="button" aria-pressed={view === "agenda"} onClick={() => setView("agenda")}>Agenda</button>
          <button className={view === "calendar" ? "auth-submit" : "secondary-button"} type="button" aria-pressed={view === "calendar"} onClick={() => setView("calendar")}>Calendario</button>
        </div>
        <div className="reservation-nav">
          <button className="secondary-button" type="button" onClick={() => setCursor((current) => shiftCursor(current, view, -1))}>Anterior</button>
          <button className="secondary-button" type="button" onClick={() => setCursor(new Date())}>Hoy</button>
          <button className="secondary-button" type="button" onClick={() => setCursor((current) => shiftCursor(current, view, 1))}>Siguiente</button>
        </div>
        <button className="secondary-button" type="button" onClick={() => setCupoOpen(true)}>Cupo</button>
        <button className="auth-submit" type="button" onClick={() => (schedule.mode === "TURN" && slotsOf(schedule).length === 0 ? setCupoOpen(true) : openCreate(dateKey(new Date())))}>Nueva reserva</button>
      </div>
      <div className="reservation-caption">
        <strong>{rangeLabel}{schedule.mode === "TURN" && schedule.fixedPlace ? ` · ${schedule.fixedPlace}` : ""}</strong>
        <span>{rangeCount} {rangeCount === 1 ? "reserva" : "reservas"}</span>
        <button className="text-button" type="button" onClick={() => setShowCancelled((current) => !current)}>{showCancelled ? "Ocultar canceladas" : "Ver canceladas"}</button>
      </div>
      {error && !creating && !open && <p className="form-error" role="alert">{error}</p>}
      {loading ? <div className="module-state">Cargando...</div> : view === "agenda" ? (
        <div className="agenda-list">
          {weekDays.map((day) => {
            const key = dateKey(day);
            const dayOrders = byDay.get(key) ?? [];
            const held = orders.filter((order) => order.status !== "CANCELLED" && dateKey(order.scheduledFor) === key);
            const cap = schedule.mode === "DATE" ? dailyPlaces(schedule.crewSize, schedule.visitsEach) : null;
            const closed = schedule.mode === "TURN" && !schedule.weekdays.includes(isoWeekday(key));
            return (
              <section className={`agenda-day${key === dateKey(new Date()) ? " is-today" : ""}`} key={key}>
                <header>
                  <div>
                    <strong>{day.toLocaleDateString("es-AR", { weekday: "long" })}</strong>
                    <span>{day.toLocaleDateString("es-AR", { day: "numeric", month: "long" })}</span>
                  </div>
                  {cap !== null && <span className={held.length > cap ? "record-alert" : "agenda-count"}>{held.length} de {cap}</span>}
                  {schedule.mode === "DATE" && <button className="secondary-button" type="button" onClick={() => openCreate(key)} disabled={cap !== null && held.length >= cap}>Agendar</button>}
                  {closed && <span className="agenda-count">No atiende</span>}
                </header>
                {schedule.mode === "TURN" ? (
                  <TurnDay orders={held} schedule={schedule} closed={closed} onOpen={openReservation} onBook={(time) => openCreate(key, time)} />
                ) : dayOrders.length ? <div className="record-scroll"><div className="record-list reservations">{dayOrders.map((order) => {
                  const budget = order.amountMinor ?? 0;
                  const paid = paidMinor(order.payments);
                  return <article className="record-row reservations" key={order.id}><strong>{order.customer.name}</strong><span>{order.title.trim() || "—"}</span><span>{order.place ?? "—"}</span><span>{collectionLabel(budget, paid)}{budget > 0 ? ` · ${formatMoney(paid)} de ${formatMoney(budget)}` : ""}</span><button className="secondary-button" type="button" onClick={() => openReservation(order)}>Ver</button></article>;
                })}</div></div> : <p className="agenda-empty">Sin reservas.</p>}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="calendar-board">
          {weekdayLabels.map((label) => <div className="calendar-dow" key={label}>{label}</div>)}
          {monthDays.map((day) => {
            const key = dateKey(day);
            const dayOrders = byDay.get(key) ?? [];
            const outside = day.getMonth() !== cursor.getMonth();
            const cap = schedule.mode === "DATE" ? dailyPlaces(schedule.crewSize, schedule.visitsEach) : null;
            const heldCount = orders.filter((order) => order.status !== "CANCELLED" && dateKey(order.scheduledFor) === key).length;
            return (
              <div className={`calendar-day${outside ? " is-outside" : ""}${key === dateKey(new Date()) ? " is-today" : ""}`} key={key}>
                <button className="calendar-day-number" type="button" onClick={() => openCreate(key)}>{day.getDate()}{cap !== null && !outside ? ` · ${heldCount}/${cap}` : ""}</button>
                {dayOrders.slice(0, 3).map((order) => <ReservationChip key={order.id} order={order} compact onOpen={() => openReservation(order)} />)}
                {dayOrders.length > 3 && <span className="calendar-more">+{dayOrders.length - 3}</span>}
              </div>
            );
          })}
        </div>
      )}
      {creating && (
        <Modal title="Nueva reserva" onClose={closeModal}>
          <ReservationForm businessId={businessId} customers={customers} schedule={schedule} orders={orders} mode={schedule.mode} onCustomer={(customerId) => { setError(""); setForm((current) => ({ ...current, customerId })); }} onCreated={(customer) => { setError(""); setCustomers((current) => current.some((item) => item.id === customer.id) ? current : [...current, customer].sort((a, b) => a.name.localeCompare(b.name, "es"))); }} onUncommitted={(name) => { pendingCustomer.current = name; }} form={form} setForm={setForm} saving={saving} error={error} submitLabel="Agendar reserva" onSubmit={(event) => void saveReservation(event)} />
        </Modal>
      )}
      {open && (
        <Modal title={open.customer.name} onClose={closeModal}>
          {editing ? (
            <ReservationForm businessId={businessId} customers={customers} schedule={schedule} orders={orders} mode={open.bookedAs} onCustomer={(customerId) => { setError(""); setForm((current) => ({ ...current, customerId })); }} onCreated={(customer) => { setError(""); setCustomers((current) => current.some((item) => item.id === customer.id) ? current : [...current, customer].sort((a, b) => a.name.localeCompare(b.name, "es"))); }} onUncommitted={(name) => { pendingCustomer.current = name; }} form={form} setForm={setForm} saving={saving} error={error} submitLabel="Guardar cambios" onSubmit={(event) => void saveReservation(event)} />
          ) : (
            <ReservationDetail
              businessId={businessId}
              businessName={businessName}
              order={open}
              error={error}
              saving={saving}
              paymentAmount={paymentAmount}
              paymentMethod={paymentMethod}
              onPaymentAmount={setPaymentAmount}
              onPaymentMethod={setPaymentMethod}
              onEdit={() => setEditing(true)}
              onDate={(scheduledFor) => void changeDate(scheduledFor)}
              onStatus={(status) => void setStatus(status)}
              onPay={(event) => void addPayment(event)}
              onInvoice={() => void issueInvoice()}
            />
          )}
        </Modal>
      )}
      {cupoOpen && <ScheduleModal schedule={schedule} saving={saving} onClose={() => setCupoOpen(false)} onSave={async (next) => {
        setSaving(true);
        const response = await fetch(`/api/v1/businesses/${businessId}/reservation-schedule`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
        const body = await response.json().catch(() => null) as (ReservationSchedule & { message?: string }) | null;
        setSaving(false);
        if (!response.ok || !body || !("mode" in body)) return body?.message ?? "No se pudo guardar el cupo.";
        setSchedule(body);
        setCupoOpen(false);
        return "";
      }} />}
    </ModuleLayout>
  );
}

function ReservationChip({ order, compact = false, onOpen }: { order: Reservation; compact?: boolean; onOpen: () => void }) {
  const budget = order.amountMinor ?? 0;
  const paid = paidMinor(order.payments);
  return (
    <button className={`reservation-chip reservation-${order.status.toLowerCase()}${compact ? " is-compact" : ""}`} type="button" onClick={onOpen}>
      <strong>{order.customer.name}</strong>
      {compact ? null : <span>{[order.title.trim(), order.place].filter(Boolean).join(" · ") || "—"}</span>}
      <em>{collectionLabel(budget, paid)}{budget > 0 ? ` · ${formatMoney(paid)} de ${formatMoney(budget)}` : ""}</em>
    </button>
  );
}

function ReservationForm({ businessId, customers, schedule, orders, mode, onCustomer, onCreated, onUncommitted, form, setForm, saving, error, submitLabel, onSubmit }: {
  businessId: string;
  customers: Customer[];
  schedule: ReservationSchedule;
  orders: Reservation[];
  mode: "DATE" | "TURN";
  onCustomer: (customerId: string) => void;
  onCreated: (customer: Customer) => void;
  onUncommitted: (name: string | null) => void;
  form: ReturnType<typeof blankForm>;
  setForm: (value: ReturnType<typeof blankForm> | ((current: ReturnType<typeof blankForm>) => ReturnType<typeof blankForm>)) => void;
  saving: boolean;
  error: string;
  submitLabel: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const cap = mode === "DATE" ? dailyPlaces(schedule.crewSize, schedule.visitsEach) : null;
  const held = orders.filter((order) => order.status !== "CANCELLED" && dateKey(order.scheduledFor) === form.scheduledFor).length;
  const slots = slotsOf(schedule);
  return (
    <form className="customer-form" onSubmit={onSubmit}>
      <div className="customer-form-grid">
        <CustomerPicker businessId={businessId} customers={customers} value={form.customerId} onChange={onCustomer} onCreated={onCreated} onUncommitted={onUncommitted} disabled={saving} />
        <label>Fecha
          <input type="date" value={form.scheduledFor} onChange={(event) => setForm((current) => ({ ...current, scheduledFor: event.target.value }))} required />
        </label>
        {mode === "TURN" ? (
          <label>Hora
            <select value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} required>
              <option value="">Elegir</option>
              {slots.map((time) => {
                const taken = orders.filter((order) => order.status !== "CANCELLED" && order.bookedAs === "TURN" && dateKey(order.scheduledFor) === form.scheduledFor && buenosAiresTime(new Date(order.scheduledFor)) === time).length;
                const seats = schedule.seatsPerTurn ?? 0;
                return <option key={time} value={time} disabled={taken >= seats && time !== form.startsAt}>{time} · {taken} de {seats}</option>;
              })}
            </select>
          </label>
        ) : (
          <label>Lugar
            <input value={form.place} onChange={(event) => setForm((current) => ({ ...current, place: event.target.value }))} required maxLength={160} />
          </label>
        )}
        <label>Presupuesto
          <input type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} required />
        </label>
        <label className="customer-form-wide">Nota
          <textarea value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} maxLength={160} rows={2} />
        </label>
      </div>
      {mode === "DATE" && cap !== null && <p className={held >= cap ? "record-alert" : "agenda-empty"}>{held} de {cap} lugares</p>}
      {mode === "TURN" && schedule.fixedPlace && <p className="agenda-empty">{schedule.fixedPlace}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="auth-submit" type="submit" disabled={saving}>{saving ? "Guardando..." : submitLabel}</button>
    </form>
  );
}

function TurnDay({ orders, schedule, closed, onOpen, onBook }: { orders: Reservation[]; schedule: ReservationSchedule; closed: boolean; onOpen: (order: Reservation) => void; onBook: (time: string) => void }) {
  const slots = slotsOf(schedule);
  if (closed) return null;
  if (slots.length === 0 || !schedule.seatsPerTurn) return <p className="agenda-empty">Definí el horario.</p>;
  const untimed = orders.filter((order) => order.bookedAs !== "TURN");
  return (
    <div className="turn-list">
      {slots.map((time) => {
        const seated = orders.filter((order) => order.bookedAs === "TURN" && buenosAiresTime(new Date(order.scheduledFor)) === time);
        const full = seated.length >= schedule.seatsPerTurn!;
        return (
          <div className={`turn-row${full ? " is-full" : ""}`} key={time}>
            <strong>{time}</strong>
            <div className="turn-names">
              {seated.length ? seated.map((order) => <button key={order.id} className="turn-name" type="button" onClick={() => onOpen(order)}>{order.customer.name}{order.title.trim() ? ` · ${order.title.trim()}` : ""}</button>) : <span className="agenda-empty">Libre</span>}
            </div>
            <span className={full ? "record-alert" : "agenda-count"}>{seated.length} de {schedule.seatsPerTurn}</span>
            {full ? <span className="agenda-count">Completo</span> : <button className="secondary-button" type="button" onClick={() => onBook(time)}>Agendar</button>}
          </div>
        );
      })}
      {untimed.map((order) => <button className="turn-name" type="button" key={order.id} onClick={() => onOpen(order)}>{order.customer.name} · sin horario</button>)}
    </div>
  );
}

function ScheduleModal({ schedule, saving, onClose, onSave }: { schedule: ReservationSchedule; saving: boolean; onClose: () => void; onSave: (next: ReservationSchedule) => Promise<string> }) {
  const [draft, setDraft] = useState(schedule);
  const [error, setError] = useState("");
  const places = dailyPlaces(draft.crewSize, draft.visitsEach);
  function updateCount(key: "crewSize" | "visitsEach" | "seatsPerTurn", value: string) {
    const parsed = value === "" ? null : Number(value);
    setDraft((current) => ({ ...current, [key]: parsed !== null && Number.isInteger(parsed) ? parsed : null }));
  }
  return (
    <Modal title="Cupo" onClose={onClose}>
      <form className="customer-form" onSubmit={(event) => {
        event.preventDefault();
        void onSave({ ...draft, fixedPlace: draft.fixedPlace?.trim() || null, weekdays: [...draft.weekdays].sort((left, right) => left - right) }).then((message) => setError(message));
      }}>
        <div className="view-switch" role="group" aria-label="Tipo de reserva">
          <button className={draft.mode === "DATE" ? "auth-submit" : "secondary-button"} type="button" aria-pressed={draft.mode === "DATE"} onClick={() => setDraft((current) => ({ ...current, mode: "DATE" }))}>Por fecha</button>
          <button className={draft.mode === "TURN" ? "auth-submit" : "secondary-button"} type="button" aria-pressed={draft.mode === "TURN"} onClick={() => setDraft((current) => ({ ...current, mode: "TURN" }))}>Por turnos</button>
        </div>
        {draft.mode === "DATE" ? (
          <div className="customer-form-grid">
            <label>Personas que salen
              <input inputMode="numeric" value={draft.crewSize ?? ""} onChange={(event) => updateCount("crewSize", event.target.value)} />
            </label>
            <label>Visitas de cada una
              <input inputMode="numeric" value={draft.visitsEach ?? ""} onChange={(event) => updateCount("visitsEach", event.target.value)} />
            </label>
          </div>
        ) : (
          <div className="customer-form-grid">
            <div className="view-switch customer-form-wide" role="group" aria-label="Duración del turno">
              <button className={draft.turnMinutes === 30 ? "auth-submit" : "secondary-button"} type="button" aria-pressed={draft.turnMinutes === 30} onClick={() => setDraft((current) => ({ ...current, turnMinutes: 30 }))}>30 min</button>
              <button className={draft.turnMinutes === 60 ? "auth-submit" : "secondary-button"} type="button" aria-pressed={draft.turnMinutes === 60} onClick={() => setDraft((current) => ({ ...current, turnMinutes: 60 }))}>1 hora</button>
            </div>
            <label>Lugares por turno
              <input inputMode="numeric" value={draft.seatsPerTurn ?? ""} onChange={(event) => updateCount("seatsPerTurn", event.target.value)} />
            </label>
            <label>Desde
              <input type="time" value={draft.openTime ?? ""} onChange={(event) => setDraft((current) => ({ ...current, openTime: event.target.value || null }))} required />
            </label>
            <label>Hasta
              <input type="time" value={draft.closeTime ?? ""} onChange={(event) => setDraft((current) => ({ ...current, closeTime: event.target.value || null }))} required />
            </label>
            <div className="weekday-picks customer-form-wide" role="group" aria-label="Días de atención">
              {weekdayNumbers.map((day, index) => <button key={day} className={draft.weekdays.includes(day) ? "auth-submit" : "secondary-button"} type="button" aria-pressed={draft.weekdays.includes(day)} onClick={() => setDraft((current) => ({ ...current, weekdays: current.weekdays.includes(day) ? current.weekdays.filter((item) => item !== day) : [...current.weekdays, day] }))}>{weekdayLabels[index]}</button>)}
            </div>
            <label className="customer-form-wide">Lugar fijo
              <input value={draft.fixedPlace ?? ""} onChange={(event) => setDraft((current) => ({ ...current, fixedPlace: event.target.value }))} maxLength={160} placeholder="Consultorio" />
            </label>
          </div>
        )}
        {draft.mode === "DATE" && <p className="agenda-empty">{places === null ? "Sin límite por día" : `${places} lugares por día`}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="auth-submit" type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar cupo"}</button>
      </form>
    </Modal>
  );
}

function ReservationDetail({ businessId, businessName, order, error, saving, paymentAmount, paymentMethod, onPaymentAmount, onPaymentMethod, onEdit, onDate, onStatus, onPay, onInvoice }: {
  businessId: string;
  businessName: string;
  order: Reservation;
  error: string;
  saving: boolean;
  paymentAmount: string;
  paymentMethod: PaymentMethod;
  onPaymentAmount: (value: string) => void;
  onPaymentMethod: (value: PaymentMethod) => void;
  onEdit: () => void;
  onDate: (scheduledFor: string) => void;
  onStatus: (status: OrderStatus) => void;
  onPay: (event: FormEvent<HTMLFormElement>) => void;
  onInvoice: () => void;
}) {
  const budget = order.amountMinor ?? 0;
  const paid = paidMinor(order.payments);
  const balance = remainingMinor(budget, order.payments);
  const work = order.status === "DONE" ? "Realizada" : order.status === "CANCELLED" ? "Cancelada" : "Agendada";
  return (
    <div className="reservation-detail">
      <div className="reservation-meta">
        <p>{order.customer.name}{order.place ? ` · ${order.place}` : ""}</p>
        {order.title.trim() ? <p>{order.title.trim()}</p> : null}
        <div className="customer-pill-row">
          <span className="customer-pill">{work}</span>
          <span className="customer-pill">{collectionLabel(budget, paid)}</span>
        </div>
      </div>
      <label className="reservation-date">Fecha
        <input type="date" value={dateKey(order.scheduledFor)} onChange={(event) => onDate(event.target.value)} disabled={saving} />
      </label>
      <div className="reservation-money">
        <span>Presupuesto <strong>{budget ? formatMoney(budget) : "Sin cargar"}</strong></span>
        <span>Cobrado <strong>{formatMoney(paid)}</strong></span>
        <span>Saldo <strong>{formatMoney(Math.max(0, balance))}</strong></span>
      </div>
      <div className="customer-actions reservation-actions">
        <button className="secondary-button" type="button" onClick={onEdit}>Editar</button>
        {order.status === "SCHEDULED" && <button className="secondary-button" type="button" onClick={() => onStatus("DONE")}>Marcar realizada</button>}
        {order.status === "SCHEDULED" && <button className="text-button" type="button" onClick={() => onStatus("CANCELLED")}>Cancelar</button>}
        {order.status !== "SCHEDULED" && <button className="text-button" type="button" onClick={() => onStatus("SCHEDULED")}>Reabrir</button>}
      </div>
      <section className="reservation-section">
      <h3>Pagos</h3>
      {order.payments.length ? (
        <ul className="reservation-payments">
          {order.payments.map((payment) => <li key={payment.id}><span>{formatLongDate(payment.paidAt)} · {methodLabel(payment.paymentMethod)}</span><strong>{formatMoney(payment.amountMinor)}</strong></li>)}
        </ul>
      ) : <p className="agenda-empty">Todavía no hay pagos.</p>}
      {order.status !== "CANCELLED" && balance > 0 && budget > 0 && (
        <form className="reservation-pay" onSubmit={onPay}>
          <label>Monto
            <input type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(event) => onPaymentAmount(event.target.value)} required />
          </label>
          <label>Medio
            <select value={paymentMethod} onChange={(event) => onPaymentMethod(event.target.value as PaymentMethod)}>
              {paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
            </select>
          </label>
          <button className="auth-submit" type="submit" disabled={saving}>{saving ? "Guardando..." : "Agregar pago"}</button>
        </form>
      )}
      <div className="customer-actions">
        {order.invoice ? (
          <>
            <a className="secondary-button" href={`/api/v1/businesses/${businessId}/orders/${order.id}/ticket`} target="_blank" rel="noreferrer">Imprimir</a>
            <SendReceiptWhatsapp phone={order.customer.phone} text={receiptText({ businessName, customerName: order.customer.name, invoiceNumber: order.invoice.number, when: new Date(order.scheduledFor), lines: [order.title, order.place ?? ""].filter(Boolean), totalMinor: budget, cae: order.invoice.arcaStatus === "AUTHORIZED" ? order.invoice.cae : null })} pdfUrl={`/api/v1/businesses/${businessId}/orders/${order.id}/ticket?format=pdf`} fileName={`${order.invoice.number}.pdf`} />
          </>
        ) : budget > 0 ? <button className="secondary-button" type="button" disabled={saving} onClick={onInvoice}>{saving ? "Emitiendo..." : "Emitir comprobante"}</button> : null}
      </div>
      </section>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="reservation-modal-title">
        <header className="modal-header">
          <h2 id="reservation-modal-title">{title}</h2>
          <button className="secondary-button modal-close" type="button" onClick={onClose}>Cerrar</button>
        </header>
        {children}
      </div>
    </div>
  );
}

function blankForm() {
  return { customerId: "", title: "", scheduledFor: "", place: "", startsAt: "", amount: "" };
}

function pesosToMinor(value: string) {
  const parsed = Math.round(Number(value.replace(",", ".")) * 100);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateKey(value: Date | string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function mondayOf(date: Date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay();
  copy.setDate(copy.getDate() + (day === 0 ? -6 : 1 - day));
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function shiftCursor(current: Date, view: View, direction: -1 | 1) {
  if (view === "agenda") return addDays(current, direction * 7);
  return new Date(current.getFullYear(), current.getMonth() + direction, 1);
}

function weekLabel(start: Date) {
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const startText = start.toLocaleDateString("es-AR", { day: "numeric", month: sameMonth ? undefined : "long" });
  const endText = end.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
  return `${startText} – ${endText}`;
}

function monthLabel(date: Date) {
  const label = date.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatLongDate(value: string) {
  return new Date(value).toLocaleDateString("es-AR", { dateStyle: "medium", timeZone: "America/Argentina/Buenos_Aires" });
}

function formatMoney(valueMinor: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(valueMinor / 100);
}

function methodLabel(method: PaymentMethod) {
  return paymentMethods.find((item) => item.value === method)?.label ?? "Otro";
}
