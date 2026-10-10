"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmModal } from "@/components/forms/confirm-modal";
import { DateRangeFilter, datedListPath } from "@/components/forms/date-range-filter";
import { ListSearch, SearchMiss, matchesQuery } from "@/components/forms/list-search";
import { applySaleDiscount } from "@/lib/sale-discount";
import { receiptText } from "@/lib/whatsapp";
import { SendReceiptWhatsapp } from "@/components/whatsapp-link";
import { ModuleLayout } from "@/components/modules/customers-page";

type Customer = { id: string; name: string; phone?: string | null };
type Sale = {
  id: string;
  status: "DRAFT" | "CONFIRMED" | "CANCELLED";
  subtotalMinor: number;
  totalMinor: number;
  serviceDate: string | null;
  place: string | null;
  description: string | null;
  customer: Customer | null;
  invoice: { number: string; arcaStatus: string | null; cae: string | null } | null;
};

const paymentMethods = [
  { value: "CASH", label: "Efectivo" },
  { value: "TRANSFER", label: "Transferencia" },
  { value: "CARD", label: "Tarjeta" },
  { value: "OTHER", label: "Otro" },
];

const emptyForm = { customerId: "", serviceDate: "", amount: "", place: "", description: "", paymentMethod: "TRANSFER", discountKind: "NONE" as "NONE" | "PERCENT" | "PRICE", discountPercent: "", discountPrice: "" };

export function ServiceSalesPage({ businessId, businessName }: { businessId: string; businessName: string }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const savingRef = useRef(false);

  async function load() {
    setLoading(true);
    const [customerResponse, salesResponse] = await Promise.all([
      fetch(`/api/v1/businesses/${businessId}/customers`, { cache: "no-store" }),
      fetch(datedListPath(`/api/v1/businesses/${businessId}/sales`, from, to), { cache: "no-store" }),
    ]);
    if (!customerResponse.ok || !salesResponse.ok) {
      setError("No se pudieron cargar las ventas.");
      setLoading(false);
      return;
    }
    const [customerData, salesData] = await Promise.all([customerResponse.json(), salesResponse.json()]);
    setCustomers(customerData.items);
    setSales(salesData.items);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    async function loadInitialData() {
      const [customerResponse, salesResponse] = await Promise.all([
        fetch(`/api/v1/businesses/${businessId}/customers`, { cache: "no-store" }),
        fetch(datedListPath(`/api/v1/businesses/${businessId}/sales`, from, to), { cache: "no-store" }),
      ]);
      if (cancelled) return;
      if (!customerResponse.ok || !salesResponse.ok) {
        setError("No se pudieron cargar las ventas.");
        setLoading(false);
        return;
      }
      const [customerData, salesData] = await Promise.all([customerResponse.json(), salesResponse.json()]);
      if (cancelled) return;
      setCustomers(customerData.items);
      setSales(salesData.items);
      setLoading(false);
    }
    void loadInitialData();
    return () => { cancelled = true; };
  }, [businessId, from, to]);

  const visibleSales = useMemo(() => sales.filter((sale) => matchesQuery(query, sale.customer?.name, sale.place, sale.description, sale.invoice?.number, statusLabel(sale.status))), [sales, query]);
  const visibleTotal = useMemo(() => visibleSales.reduce((sum, sale) => sum + sale.totalMinor, 0), [visibleSales]);
  const dated = Boolean(from && to);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;
    setMessage("");
    setError("");
    const amountMinor = Math.round(Number(form.amount) * 100);
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      setError("El presupuesto tiene que ser mayor a cero.");
      return;
    }
    const discount = serviceDiscount(form.discountKind, form.discountPercent, form.discountPrice);
    if (discount === "invalid-percent") { setError("El porcentaje tiene que estar entre 0,01 y 100."); return; }
    if (discount === "invalid-price") { setError("Escribí el precio a cobrar."); return; }
    if (discount && discount.kind === "PRICE" && discount.priceMinor > amountMinor) { setError("El precio manual no puede superar el presupuesto."); return; }
    const customer = customers.find((item) => item.id === form.customerId) ?? null;
    savingRef.current = true;
    setSaving(true);
    try {
      const response = await fetch(`/api/v1/businesses/${businessId}/sales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: form.customerId,
          paymentMethod: form.paymentMethod,
          serviceDate: form.serviceDate,
          amountMinor,
          place: form.place.trim(),
          description: form.description.trim(),
          ...(discount ? { discount } : {}),
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { message?: string } | null;
        setError(payload?.message ?? "No se pudo crear la venta.");
        return;
      }
      const created = await response.json() as Sale;
      const confirmation = await fetch(`/api/v1/businesses/${businessId}/sales/${created.id}/confirm`, { method: "POST" });
      const confirmed = await confirmation.json().catch(() => null) as { message?: string; invoice?: { number: string; arcaStatus?: string | null; cae?: string | null } | null } | null;
      if (!confirmation.ok) {
        setError(confirmed?.message ?? "No se pudo confirmar la venta.");
        setSales((current) => current.some((item) => item.id === created.id) ? current : [{ ...created, customer: created.customer ?? customer }, ...current]);
        return;
      }
      const invoice = confirmed?.invoice
        ? { number: confirmed.invoice.number, arcaStatus: confirmed.invoice.arcaStatus ?? null, cae: confirmed.invoice.cae ?? null }
        : null;
      setSales((current) => [{ ...created, customer: created.customer ?? customer, status: "CONFIRMED", invoice }, ...current.filter((item) => item.id !== created.id)]);
      setForm(emptyForm);
      setMessage(invoice?.arcaStatus === "AUTHORIZED" ? "Venta confirmada. La factura con CAE está lista para imprimir." : "Venta confirmada. El comprobante de este servicio está listo para imprimir.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function deleteSale(saleId: string) {
    setPendingDeleteId(null);
    setMessage("");
    setError("");
    const response = await fetch(`/api/v1/businesses/${businessId}/sales/${saleId}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      setError(payload?.message ?? "No se pudo eliminar la venta.");
      return;
    }
    setMessage("Venta eliminada.");
    await load();
  }

  const quoteMinor = Math.round(Number(form.amount) * 100);
  const preview = Number.isFinite(quoteMinor) && quoteMinor > 0
    ? applySaleDiscount(quoteMinor, form.discountKind === "PERCENT" && Number(form.discountPercent) > 0
      ? { kind: "PERCENT", percentBps: Math.min(10_000, Math.round(Number(form.discountPercent) * 100)) }
      : form.discountKind === "PRICE" && form.discountPrice !== "" && Number(form.discountPrice) >= 0
        ? { kind: "PRICE", priceMinor: Math.min(quoteMinor, Math.round(Number(form.discountPrice) * 100)) }
        : { kind: "NONE" })
    : null;

  return (
    <ModuleLayout eyebrow="Operación" title="Ventas">
      <form className="customer-form" onSubmit={(event) => void save(event)}>
        <div className="customer-form-heading">
          <div>
            <h2>Servicio prestado</h2>
          </div>
        </div>
        <div className="customer-form-grid">
          <label>Cliente
            <select disabled={saving} value={form.customerId} onChange={(event) => setForm((current) => ({ ...current, customerId: event.target.value }))} required>
              <option value="">Elegir cliente</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </select>
          </label>
          <label>Fecha del servicio
            <input disabled={saving} type="date" value={form.serviceDate} onChange={(event) => setForm((current) => ({ ...current, serviceDate: event.target.value }))} required />
          </label>
          <label>Presupuesto
            <input disabled={saving} type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} required />
          </label>
          <label>Descuento
            <select disabled={saving} value={form.discountKind} onChange={(event) => setForm((current) => ({ ...current, discountKind: event.target.value as "NONE" | "PERCENT" | "PRICE" }))}>
              <option value="NONE">Sin descuento</option>
              <option value="PERCENT">Porcentaje</option>
              <option value="PRICE">Precio manual</option>
            </select>
          </label>
          {form.discountKind === "PERCENT" && <label>Porcentaje
            <input disabled={saving} type="number" min="0.01" max="100" step="0.01" value={form.discountPercent} onChange={(event) => setForm((current) => ({ ...current, discountPercent: event.target.value }))} placeholder="10" />
          </label>}
          {form.discountKind === "PRICE" && <label>Precio a cobrar
            <input disabled={saving} type="number" min="0" step="0.01" value={form.discountPrice} onChange={(event) => setForm((current) => ({ ...current, discountPrice: event.target.value }))} />
          </label>}
          <label>Lugar
            <input disabled={saving} value={form.place} onChange={(event) => setForm((current) => ({ ...current, place: event.target.value }))} required maxLength={160} placeholder="Salón, dirección, evento" />
          </label>
          <label>Medio de pago
            <select disabled={saving} value={form.paymentMethod} onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value }))}>
              {paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
            </select>
          </label>
          <label className="customer-form-wide">Qué incluye
            <textarea disabled={saving} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} required maxLength={2000} rows={3} placeholder="Barra de tragos para 80 personas, 4 horas" />
          </label>
        </div>
        {preview && preview.discountMinor > 0 && <p className="module-description">Se cobra {formatMoney(preview.totalMinor)} sobre un presupuesto de {formatMoney(quoteMinor)}.</p>}
        <button className="auth-submit" type="submit" disabled={saving || customers.length === 0}>{saving ? "Confirmando..." : "Confirmar venta"}</button>
        {customers.length === 0 && <p className="module-description">Primero cargá un cliente.</p>}
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      <section className="sales-history">
        <div className="sale-section-heading">
          <div>
            <h2>Historial</h2>
          </div>
          <span className="panel-count">{visibleSales.length}</span>
        </div>
        <DateRangeFilter from={from} to={to} onChange={(nextFrom, nextTo) => { setFrom(nextFrom); setTo(nextTo); }} />
        <p className="list-total"><span>Total</span><strong>{formatMoney(visibleTotal)}</strong></p>
        {(sales.length > 0 || query) && <ListSearch value={query} onChange={setQuery} placeholder="Cliente, lugar o detalle" />}
        {loading ? <div className="module-state">Cargando...</div> : sales.length === 0 ? <div className="module-state">{dated ? "No hay ventas en esas fechas." : "Todavía no hay ventas. Cuando cobres un servicio, queda acá."}</div> : visibleSales.length ? (
          <div className="sales-list">
            {visibleSales.map((sale) => (
              <article className="sale-row" key={sale.id}>
                <div>
                  <div className="sale-row-title">
                    <strong>{sale.customer?.name ?? "Sin cliente"}</strong>
                    <span className={`sale-status sale-status-${sale.status.toLowerCase()}`}>{statusLabel(sale.status)}</span>
                  </div>
                  <p>{sale.serviceDate ? new Date(sale.serviceDate).toLocaleDateString("es-AR", { dateStyle: "medium" }) : "Sin fecha"}{sale.place ? ` · ${sale.place}` : ""}</p>
                  {sale.description && <p>{sale.description}</p>}
                </div>
                <div className="sale-row-total">
                  <strong>{formatMoney(sale.totalMinor)}</strong>
                  {sale.subtotalMinor > sale.totalMinor && <small>Presupuesto {formatMoney(sale.subtotalMinor)}</small>}
                  {sale.status === "CONFIRMED" && <a className="text-button" href={`/api/v1/businesses/${businessId}/sales/${sale.id}/ticket`} target="_blank" rel="noreferrer">Imprimir</a>}
                  {sale.status === "CONFIRMED" && <SendReceiptWhatsapp phone={sale.customer?.phone} text={receiptText({ businessName, customerName: sale.customer?.name ?? "cliente", invoiceNumber: sale.invoice?.number, when: new Date(sale.serviceDate ?? Date.now()), lines: [sale.description, sale.place].filter((line): line is string => Boolean(line)), totalMinor: sale.totalMinor, cae: sale.invoice?.arcaStatus === "AUTHORIZED" ? sale.invoice.cae : null })} pdfUrl={`/api/v1/businesses/${businessId}/sales/${sale.id}/ticket?format=pdf`} fileName={`${sale.invoice?.number ?? "comprobante"}.pdf`} />}
                  {sale.invoice && <small>{sale.invoice.number}</small>}
                  {sale.invoice?.arcaStatus !== "AUTHORIZED" && <button className="text-button" type="button" onClick={() => setPendingDeleteId(sale.id)}>Eliminar</button>}
                </div>
              </article>
            ))}
          </div>
        ) : <SearchMiss query={query} />}
      </section>
      {pendingDeleteId && <ConfirmModal title="Eliminar venta" message="¿Eliminar esta venta? Deja de sumar como ingreso." onCancel={() => setPendingDeleteId(null)} onAccept={() => void deleteSale(pendingDeleteId)} />}
    </ModuleLayout>
  );
}

function statusLabel(status: Sale["status"]) {
  if (status === "CONFIRMED") return "Confirmada";
  if (status === "CANCELLED") return "Cancelada";
  return "Pendiente";
}

function serviceDiscount(kind: "NONE" | "PERCENT" | "PRICE", percent: string, price: string) {
  if (kind === "NONE") return undefined;
  if (kind === "PERCENT") {
    const value = Number(percent);
    if (!Number.isFinite(value) || value <= 0 || value > 100) return "invalid-percent" as const;
    return { kind: "PERCENT" as const, percent: value };
  }
  const priceMinor = Math.round(Number(price) * 100);
  if (!Number.isFinite(priceMinor) || price === "" || priceMinor < 0) return "invalid-price" as const;
  return { kind: "PRICE" as const, priceMinor };
}

function formatMoney(valueMinor: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(valueMinor / 100);
}
