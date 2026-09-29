"use client";

import { FormEvent, useEffect, useState } from "react";
import { ModuleLayout } from "@/components/modules/customers-page";

type Customer = { id: string; name: string };
type Sale = {
  id: string;
  status: "DRAFT" | "CONFIRMED" | "CANCELLED";
  totalMinor: number;
  serviceDate: string | null;
  place: string | null;
  description: string | null;
  customer: Customer | null;
  invoice: { number: string; arcaStatus: string | null } | null;
};

const paymentMethods = [
  { value: "CASH", label: "Efectivo" },
  { value: "TRANSFER", label: "Transferencia" },
  { value: "CARD", label: "Tarjeta" },
  { value: "OTHER", label: "Otro" },
];

const emptyForm = { customerId: "", serviceDate: "", amount: "", place: "", description: "", paymentMethod: "TRANSFER" };

export function ServiceSalesPage({ businessId }: { businessId: string }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [customerResponse, salesResponse] = await Promise.all([
      fetch(`/api/v1/businesses/${businessId}/customers`, { cache: "no-store" }),
      fetch(`/api/v1/businesses/${businessId}/sales`, { cache: "no-store" }),
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
        fetch(`/api/v1/businesses/${businessId}/sales`, { cache: "no-store" }),
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
  }, [businessId]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    const amountMinor = Math.round(Number(form.amount) * 100);
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      setError("El presupuesto tiene que ser mayor a cero.");
      setSaving(false);
      return;
    }
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
      }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      setError(payload?.message ?? "No se pudo crear la venta.");
      setSaving(false);
      return;
    }
    const sale = await response.json() as { id: string };
    const confirmation = await fetch(`/api/v1/businesses/${businessId}/sales/${sale.id}/confirm`, { method: "POST" });
    const confirmed = await confirmation.json().catch(() => null) as { message?: string; invoice?: { arcaStatus?: string } } | null;
    if (!confirmation.ok) {
      setError(confirmed?.message ?? "No se pudo confirmar la venta.");
      setSaving(false);
      await load();
      return;
    }
    setForm(emptyForm);
    setSaving(false);
    setMessage(confirmed?.invoice?.arcaStatus === "AUTHORIZED" ? "Venta confirmada. La factura con CAE está lista para imprimir." : "Venta confirmada. El comprobante de este servicio está listo para imprimir.");
    await load();
  }

  return (
    <ModuleLayout eyebrow="Operación" title="Ventas" description="Cerrá el cobro de un servicio. El presupuesto entra como ingreso al confirmar, y la fecha queda anotada en el comprobante.">
      <form className="customer-form" onSubmit={(event) => void save(event)}>
        <div className="customer-form-heading">
          <div>
            <h2>Servicio prestado</h2>
            <p>El precio se carga a mano. No descuenta stock.</p>
          </div>
        </div>
        <div className="customer-form-grid">
          <label>Cliente
            <select value={form.customerId} onChange={(event) => setForm((current) => ({ ...current, customerId: event.target.value }))} required>
              <option value="">Elegir cliente</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </select>
          </label>
          <label>Fecha del servicio
            <input type="date" value={form.serviceDate} onChange={(event) => setForm((current) => ({ ...current, serviceDate: event.target.value }))} required />
          </label>
          <label>Presupuesto
            <input type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} required />
          </label>
          <label>Lugar
            <input value={form.place} onChange={(event) => setForm((current) => ({ ...current, place: event.target.value }))} required maxLength={160} placeholder="Salón, dirección, evento" />
          </label>
          <label>Medio de pago
            <select value={form.paymentMethod} onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value }))}>
              {paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
            </select>
          </label>
          <label className="customer-form-wide">Qué incluye
            <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} required maxLength={2000} rows={3} placeholder="Barra de tragos para 80 personas, 4 horas" />
          </label>
        </div>
        <button className="auth-submit" type="submit" disabled={saving || customers.length === 0}>{saving ? "Confirmando..." : "Confirmar venta"}</button>
        {customers.length === 0 && <p className="module-description">Primero cargá un cliente.</p>}
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      <section className="sales-history">
        <div className="sale-section-heading">
          <div>
            <h2>Historial</h2>
            <p>Servicios cobrados en este negocio.</p>
          </div>
          <span className="panel-count">{sales.length}</span>
        </div>
        {loading ? <div className="module-state">Cargando...</div> : sales.length ? (
          <div className="sales-list">
            {sales.map((sale) => (
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
                  {sale.status === "CONFIRMED" && <a className="text-button" href={`/api/v1/businesses/${businessId}/sales/${sale.id}/ticket`} target="_blank" rel="noreferrer">Imprimir</a>}
                  {sale.invoice && <small>{sale.invoice.number}</small>}
                </div>
              </article>
            ))}
          </div>
        ) : <div className="module-state">Todavía no hay ventas. Cuando cobres un servicio, queda acá.</div>}
      </section>
    </ModuleLayout>
  );
}

function statusLabel(status: Sale["status"]) {
  if (status === "CONFIRMED") return "Confirmada";
  if (status === "CANCELLED") return "Cancelada";
  return "Pendiente";
}

function formatMoney(valueMinor: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(valueMinor / 100);
}
