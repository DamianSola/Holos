"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ModuleLayout } from "@/components/modules/customers-page";

type Customer = { id: string; name: string };
type Product = { id: string; name: string; priceMinor: number };
type OrderKind = "PRODUCT" | "SERVICE";
type OrderStatus = "SCHEDULED" | "DONE" | "CANCELLED";
type Order = {
  id: string;
  kind: OrderKind;
  status: OrderStatus;
  title: string;
  quantity: number;
  scheduledFor: string;
  amountMinor: number | null;
  notes: string | null;
  customer: Customer;
  product: { id: string; name: string } | null;
};

const emptyForm = { kind: "PRODUCT" as OrderKind, customerId: "", productId: "", title: "", quantity: "1", scheduledFor: "", amount: "", notes: "" };

function blankOrder(kind: OrderKind) {
  return { ...emptyForm, kind };
}

export function OrdersPage({ businessId, businessKind = "STORE" }: { businessId: string; businessKind?: "STORE" | "SERVICE" }) {
  const serviceBusiness = businessKind === "SERVICE";
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(() => blankOrder(serviceBusiness ? "SERVICE" : "PRODUCT"));
  const [filter, setFilter] = useState<OrderStatus>("SCHEDULED");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [ordersResponse, customersResponse, productsResponse] = await Promise.all([
      fetch(`/api/v1/businesses/${businessId}/orders`, { cache: "no-store" }),
      fetch(`/api/v1/businesses/${businessId}/customers`, { cache: "no-store" }),
      fetch(`/api/v1/businesses/${businessId}/products`, { cache: "no-store" }),
    ]);
    if (!ordersResponse.ok || !customersResponse.ok || !productsResponse.ok) {
      setError("No se pudieron cargar los pedidos.");
      setLoading(false);
      return;
    }
    const [ordersData, customersData, productsData] = await Promise.all([ordersResponse.json(), customersResponse.json(), productsResponse.json()]);
    setOrders(ordersData.items);
    setCustomers(customersData.items);
    setProducts(productsData.items);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    async function loadInitialData() {
      const [ordersResponse, customersResponse, productsResponse] = await Promise.all([
        fetch(`/api/v1/businesses/${businessId}/orders`, { cache: "no-store" }),
        fetch(`/api/v1/businesses/${businessId}/customers`, { cache: "no-store" }),
        fetch(`/api/v1/businesses/${businessId}/products`, { cache: "no-store" }),
      ]);
      if (cancelled) return;
      if (!ordersResponse.ok || !customersResponse.ok || !productsResponse.ok) {
        setError("No se pudieron cargar los pedidos.");
        setLoading(false);
        return;
      }
      const [ordersData, customersData, productsData] = await Promise.all([ordersResponse.json(), customersResponse.json(), productsResponse.json()]);
      if (cancelled) return;
      setOrders(ordersData.items);
      setCustomers(customersData.items);
      setProducts(productsData.items);
      setLoading(false);
    }
    void loadInitialData();
    return () => { cancelled = true; };
  }, [businessId]);

  const visible = useMemo(() => orders.filter((order) => order.status === filter), [orders, filter]);
  const upcoming = orders.filter((order) => order.status === "SCHEDULED");

  function chooseProduct(productId: string) {
    const product = products.find((item) => item.id === productId);
    setForm((current) => ({
      ...current,
      productId,
      title: product ? product.name : current.title,
      amount: product && !current.amount ? String(product.priceMinor / 100) : current.amount,
    }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const parsedAmount = form.amount.trim() ? Math.round(Number(form.amount) * 100) : undefined;
    if (parsedAmount !== undefined && !Number.isFinite(parsedAmount)) {
      setError("El importe no es válido.");
      setSaving(false);
      return;
    }
    const amount = parsedAmount;
    const response = await fetch(`/api/v1/businesses/${businessId}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: form.customerId,
        kind: serviceBusiness ? "SERVICE" : form.kind,
        title: form.title.trim(),
        productId: form.kind === "PRODUCT" && form.productId ? form.productId : undefined,
        quantity: form.kind === "PRODUCT" ? Number(form.quantity) : 1,
        scheduledFor: form.scheduledFor,
        amountMinor: amount,
        notes: form.notes.trim() || undefined,
      }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      setError(payload?.message ?? "No se pudo guardar el pedido.");
      setSaving(false);
      return;
    }
    setForm(blankOrder(serviceBusiness ? "SERVICE" : "PRODUCT"));
    setFilter("SCHEDULED");
    setSaving(false);
    await load();
  }

  async function setStatus(orderId: string, status: OrderStatus) {
    const response = await fetch(`/api/v1/businesses/${businessId}/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      setError("No se pudo actualizar el pedido.");
      return;
    }
    await load();
  }

  return (
    <ModuleLayout eyebrow="Operación" title={serviceBusiness ? "Reservas" : "Pedidos"} description={serviceBusiness ? "Agendá el servicio para un cliente. Cobrarlo es una venta aparte." : "Anotá lo que un cliente te encargó. Si es un producto, queda el pedido para esa fecha. Si es un servicio, queda agendado."}>
      <div className="customer-summary">
        <div className="summary-card"><span>Próximos</span><strong>{upcoming.length}</strong></div>
        {serviceBusiness ? null : <div className="summary-card"><span>Productos</span><strong>{upcoming.filter((order) => order.kind === "PRODUCT").length}</strong></div>}
        <div className="summary-card"><span>Servicios</span><strong>{upcoming.filter((order) => order.kind === "SERVICE").length}</strong></div>
      </div>
      <form className="customer-form" onSubmit={(event) => void save(event)}>
        <div className="customer-form-heading">
          <div>
            <h2>{form.kind === "SERVICE" ? "Agendar servicio" : "Nuevo pedido"}</h2>
            <p>{form.kind === "SERVICE" ? "El cliente pide un trabajo para una fecha." : "El cliente pide un producto para una fecha."}</p>
          </div>
        </div>
        <div className="customer-form-grid">
          {serviceBusiness ? null : (
            <label>Tipo
              <select value={form.kind} onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value as OrderKind, productId: "" }))}>
                <option value="PRODUCT">Producto</option>
                <option value="SERVICE">Servicio</option>
              </select>
            </label>
          )}
          <label>Cliente
            <select value={form.customerId} onChange={(event) => setForm((current) => ({ ...current, customerId: event.target.value }))} required>
              <option value="">Elegir cliente</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </select>
          </label>
          {form.kind === "PRODUCT" && (
            <label>Del catálogo
              <select value={form.productId} onChange={(event) => chooseProduct(event.target.value)}>
                <option value="">Sin producto cargado</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
            </label>
          )}
          <label>{form.kind === "SERVICE" ? "Servicio" : "Qué pidió"}
            <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required maxLength={160} placeholder={form.kind === "SERVICE" ? "Corte, arreglo, instalación" : "Remera talle M"} />
          </label>
          {form.kind === "PRODUCT" && (
            <label>Cantidad
              <input type="number" min="1" value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} required />
            </label>
          )}
          <label>{form.kind === "SERVICE" ? "Fecha" : "Para el"}
            <input type="date" value={form.scheduledFor} onChange={(event) => setForm((current) => ({ ...current, scheduledFor: event.target.value }))} required />
          </label>
          <label>Importe estimado
            <input type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} placeholder="Opcional" />
          </label>
          <label className="customer-form-wide">Notas
            <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={2} maxLength={1000} />
          </label>
        </div>
        <button className="auth-submit" type="submit" disabled={saving || customers.length === 0}>{saving ? "Guardando..." : form.kind === "SERVICE" ? "Agendar servicio" : "Agregar pedido"}</button>
        {customers.length === 0 && <p className="module-description">Primero cargá un cliente.</p>}
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="customer-actions">
        {(["SCHEDULED", "DONE", "CANCELLED"] as const).map((status) => (
          <button className={filter === status ? "auth-submit" : "secondary-button"} key={status} type="button" onClick={() => setFilter(status)}>{filterLabel(status)}</button>
        ))}
      </div>
      {loading ? <div className="module-state">Cargando...</div> : visible.length ? (
        <div className="customer-list">
          {visible.map((order) => (
            <article className="customer-card" key={order.id}>
              <div className="customer-card-header">
                <div>
                  <strong>{order.title}</strong>
                  <p>{order.customer.name} · {formatDate(order.scheduledFor)}{order.kind === "PRODUCT" ? ` · x${order.quantity}` : ""}</p>
                </div>
                <span className="customer-pill">{kindLabel(order.kind)}</span>
              </div>
              <div className="customer-contact">
                <span>{statusText(order)}</span>
                {order.amountMinor !== null && <span>{formatMoney(order.amountMinor)}</span>}
                {order.notes && <span>{order.notes}</span>}
              </div>
              <div className="customer-actions">
                {order.status === "SCHEDULED" && <button className="secondary-button" type="button" onClick={() => void setStatus(order.id, "DONE")}>{order.kind === "SERVICE" ? "Marcar realizado" : "Marcar entregado"}</button>}
                {order.status === "SCHEDULED" && <button className="text-button" type="button" onClick={() => void setStatus(order.id, "CANCELLED")}>Cancelar</button>}
                {order.status !== "SCHEDULED" && <button className="text-button" type="button" onClick={() => void setStatus(order.id, "SCHEDULED")}>Reabrir</button>}
              </div>
            </article>
          ))}
        </div>
      ) : <div className="module-state">{emptyText(filter)}</div>}
    </ModuleLayout>
  );
}

function filterLabel(status: OrderStatus) {
  if (status === "SCHEDULED") return "Próximos";
  if (status === "DONE") return "Cumplidos";
  return "Cancelados";
}

function kindLabel(kind: OrderKind) {
  return kind === "SERVICE" ? "Servicio" : "Producto";
}

function statusText(order: Order) {
  if (order.status === "CANCELLED") return "Cancelado";
  if (order.status === "DONE") return order.kind === "SERVICE" ? "Realizado" : "Entregado";
  return order.kind === "SERVICE" ? "Agendado" : "Pendiente";
}

function emptyText(filter: OrderStatus) {
  if (filter === "DONE") return "Todavía no hay pedidos cumplidos.";
  if (filter === "CANCELLED") return "No hay pedidos cancelados.";
  return "Todavía no hay pedidos. Cuando un cliente te encargue algo, anotalo acá.";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-AR", { dateStyle: "medium" });
}

function formatMoney(valueMinor: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(valueMinor / 100);
}
