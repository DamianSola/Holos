"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { FormModal } from "@/components/forms/form-modal";
import { ListSearch, SearchMiss, matchesQuery } from "@/components/forms/list-search";
import { ModuleLayout } from "@/components/modules/customers-page";

type Customer = { id: string; name: string };
type Product = { id: string; name: string; priceMinor: number; catalogKind?: "PRODUCT" | "SUPPLY" | "TOOL" };
type OrderKind = "PRODUCT" | "SERVICE";
type OrderStatus = "SCHEDULED" | "DONE" | "CANCELLED";
type OrderItem = { id: string; productId: string; productName: string; quantity: number; unitPriceMinor: number; totalMinor: number };
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
  product: { id: string; name: string; priceMinor: number } | null;
  items: OrderItem[];
};
type DraftLine = { productId: string; productName: string; quantity: number; unitPriceMinor: number };

export function OrdersPage({ businessId, businessKind = "STORE" }: { businessId: string; businessKind?: "STORE" | "SERVICE" }) {
  const serviceBusiness = businessKind === "SERVICE";
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [kind, setKind] = useState<OrderKind>(serviceBusiness ? "SERVICE" : "PRODUCT");
  const [customerId, setCustomerId] = useState("");
  const [title, setTitle] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [pickId, setPickId] = useState("");
  const [pickQty, setPickQty] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<OrderStatus>("SCHEDULED");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

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

  const catalog = useMemo(() => products.filter((product) => product.catalogKind !== "SUPPLY" && product.catalogKind !== "TOOL"), [products]);
  const byStatus = useMemo(() => orders.filter((order) => order.status === filter), [orders, filter]);
  const visible = useMemo(() => byStatus.filter((order) => matchesQuery(query, order.title, order.customer.name, order.notes, order.product?.name, ...shownLines(order).map((line) => line.productName))), [byStatus, query]);
  const upcoming = orders.filter((order) => order.status === "SCHEDULED");
  const draftTotal = lines.reduce((total, line) => total + line.unitPriceMinor * line.quantity, 0);

  function resetForm() {
    setEditingId(null);
    setKind(serviceBusiness ? "SERVICE" : "PRODUCT");
    setCustomerId("");
    setTitle("");
    setScheduledFor("");
    setAmount("");
    setNotes("");
    setLines([]);
    setPickId("");
    setPickQty(1);
  }

  function openCreate() {
    resetForm();
    setError("");
    setFormOpen(true);
  }

  function openEdit(order: Order) {
    setEditingId(order.id);
    setKind("PRODUCT");
    setCustomerId(order.customer.id);
    setScheduledFor(dateInputValue(order.scheduledFor));
    setNotes(order.notes ?? "");
    setLines(draftLines(order));
    setPickId("");
    setPickQty(1);
    setError("");
    setFormOpen(true);
  }

  function addLine() {
    const product = catalog.find((item) => item.id === pickId);
    const quantity = Math.floor(pickQty);
    if (!product || quantity < 1) return;
    setLines((current) => {
      const existing = current.find((line) => line.productId === product.id);
      if (existing) return current.map((line) => line.productId === product.id ? { ...line, quantity: Math.min(100_000, line.quantity + quantity) } : line);
      return [...current, { productId: product.id, productName: product.name, quantity: Math.min(100_000, quantity), unitPriceMinor: product.priceMinor }];
    });
    setPickId("");
    setPickQty(1);
  }

  function changeLineQuantity(productId: string, quantity: number) {
    if (!Number.isFinite(quantity) || quantity < 1) return;
    setLines((current) => current.map((line) => line.productId === productId ? { ...line, quantity: Math.min(100_000, Math.floor(quantity)) } : line));
  }

  function removeLine(productId: string) {
    setLines((current) => current.length < 2 ? current : current.filter((line) => line.productId !== productId));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const productOrder = kind === "PRODUCT";
    if (productOrder && lines.length < 1) {
      setError("Agregá al menos un producto.");
      setSaving(false);
      return;
    }
    const parsedAmount = amount.trim() ? Math.round(Number(amount) * 100) : undefined;
    if (!productOrder && parsedAmount !== undefined && !Number.isFinite(parsedAmount)) {
      setError("El importe no es válido.");
      setSaving(false);
      return;
    }
    const response = await fetch(editingId ? `/api/v1/businesses/${businessId}/orders/${editingId}` : `/api/v1/businesses/${businessId}/orders`, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(productOrder ? {
        customerId,
        ...(editingId ? {} : { kind: "PRODUCT" as const }),
        scheduledFor,
        notes: notes.trim() || undefined,
        items: lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
      } : {
        customerId,
        kind: "SERVICE",
        title: title.trim(),
        quantity: 1,
        scheduledFor,
        amountMinor: parsedAmount,
        notes: notes.trim() || undefined,
      }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      setError(payload?.message ?? "No se pudo guardar el pedido.");
      setSaving(false);
      return;
    }
    resetForm();
    setFilter("SCHEDULED");
    setFormOpen(false);
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
      <div className="customer-actions"><button className="auth-submit" type="button" onClick={openCreate}>Nuevo pedido</button></div>
      {formOpen && <FormModal title={editingId ? "Editar pedido" : "Nuevo pedido"} onClose={() => { setFormOpen(false); resetForm(); }}>
        <form className="customer-form" onSubmit={(event) => void save(event)}>
          <div className="customer-form-heading">
            <div>
              <h2>{editingId ? "Editar pedido" : kind === "SERVICE" ? "Agendar servicio" : "Nuevo pedido"}</h2>
              <p>{kind === "SERVICE" ? "El cliente pide un trabajo para una fecha." : "El cliente pide productos para una fecha."}</p>
            </div>
          </div>
          <div className="customer-form-grid">
            {serviceBusiness || editingId ? null : (
              <label>Tipo
                <select value={kind} onChange={(event) => setKind(event.target.value as OrderKind)}>
                  <option value="PRODUCT">Producto</option>
                  <option value="SERVICE">Servicio</option>
                </select>
              </label>
            )}
            <label>Cliente
              <select value={customerId} onChange={(event) => setCustomerId(event.target.value)} required>
                <option value="">Elegir cliente</option>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
              </select>
            </label>
            {kind === "SERVICE" && (
              <label>Servicio
                <input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={160} placeholder="Corte, arreglo, instalación" />
              </label>
            )}
            <label>{kind === "SERVICE" ? "Fecha" : "Para el"}
              <input type="date" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} required />
            </label>
            {kind === "SERVICE" && (
              <label>Importe estimado
                <input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Opcional" />
              </label>
            )}
            <label className="customer-form-wide">Notas
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} maxLength={1000} />
            </label>
            {kind === "PRODUCT" && (
              <div className="customer-form-wide">
                <div className="sale-form">
                  <label>Producto
                    <select value={pickId} onChange={(event) => setPickId(event.target.value)}>
                      <option value="">Elegir producto</option>
                      {catalog.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                    </select>
                  </label>
                  <label>Cantidad
                    <input type="number" min="1" value={pickQty} onChange={(event) => setPickQty(Number(event.target.value))} />
                  </label>
                  <button className="secondary-button" type="button" onClick={addLine} disabled={!pickId || pickQty < 1}>Agregar</button>
                </div>
                {lines.length ? (
                  <div className="cart-list">
                    {lines.map((line) => (
                      <div className="cart-row" key={line.productId}>
                        <span><strong>{line.productName}</strong><small>{formatMoney(line.unitPriceMinor)} c/u</small></span>
                        <input aria-label={`Cantidad de ${line.productName}`} type="number" min="1" value={line.quantity} onChange={(event) => changeLineQuantity(line.productId, Number(event.target.value))} />
                        <strong>{formatMoney(line.unitPriceMinor * line.quantity)}</strong>
                        <button className="text-button" type="button" onClick={() => removeLine(line.productId)} disabled={lines.length < 2}>Quitar</button>
                      </div>
                    ))}
                    <div className="sale-total"><span>Total</span><strong>{formatMoney(draftTotal)}</strong></div>
                  </div>
                ) : <div className="module-state">Agregá al menos un producto.</div>}
              </div>
            )}
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={saving || customers.length === 0 || (kind === "PRODUCT" && lines.length < 1)}>{saving ? "Guardando..." : editingId ? "Guardar cambios" : kind === "SERVICE" ? "Agendar servicio" : "Agregar pedido"}</button>
          {customers.length === 0 && <p className="module-description">Primero cargá un cliente.</p>}
        </form>
      </FormModal>}
      {error && !formOpen && <p className="form-error" role="alert">{error}</p>}
      {orders.length > 0 && <ListSearch value={query} onChange={setQuery} placeholder="Cliente o pedido" />}
      <div className="customer-actions">
        {(["SCHEDULED", "DONE", "CANCELLED"] as const).map((status) => (
          <button className={filter === status ? "auth-submit" : "secondary-button"} key={status} type="button" onClick={() => setFilter(status)}>{filterLabel(status)}</button>
        ))}
      </div>
      {loading ? <div className="module-state">Cargando...</div> : visible.length ? (
        <div className="customer-list">
          {visible.map((order) => {
            const linesOnCard = shownLines(order);
            const total = linesOnCard.length ? linesOnCard.reduce((sum, line) => sum + line.totalMinor, 0) : order.amountMinor;
            return (
              <article className="customer-card" key={order.id}>
                <div className="customer-card-header">
                  <div>
                    <strong>{linesOnCard.length ? linesOnCard.map((line) => `${line.productName} x${line.quantity}`).join(", ") : order.title}</strong>
                    <p>{order.customer.name} · {formatDate(order.scheduledFor)}</p>
                  </div>
                  <span className="customer-pill">{kindLabel(order.kind)}</span>
                </div>
                <div className="customer-contact">
                  <span>{statusText(order)}</span>
                  {total !== null && <span>{formatMoney(total)}</span>}
                  {order.notes && <span>{order.notes}</span>}
                </div>
                <div className="customer-actions">
                  {order.kind === "PRODUCT" && order.status === "SCHEDULED" && <button className="secondary-button" type="button" onClick={() => openEdit(order)}>Editar</button>}
                  {order.status === "SCHEDULED" && <button className="secondary-button" type="button" onClick={() => void setStatus(order.id, "DONE")}>{order.kind === "SERVICE" ? "Marcar realizado" : "Marcar entregado"}</button>}
                  {order.status === "SCHEDULED" && <button className="text-button" type="button" onClick={() => void setStatus(order.id, "CANCELLED")}>Cancelar</button>}
                  {order.status !== "SCHEDULED" && <button className="text-button" type="button" onClick={() => void setStatus(order.id, "SCHEDULED")}>Reabrir</button>}
                </div>
              </article>
            );
          })}
        </div>
      ) : query.trim() ? <SearchMiss query={query} /> : <div className="module-state">{emptyText(filter)}</div>}
    </ModuleLayout>
  );
}

function shownLines(order: Order) {
  if (order.kind !== "PRODUCT") return [];
  if (order.items?.length) return order.items;
  if (order.product) {
    const totalMinor = order.product.priceMinor * order.quantity;
    return [{ productName: order.product.name, quantity: order.quantity, totalMinor }];
  }
  return [];
}

function draftLines(order: Order): DraftLine[] {
  if (order.items?.length) return order.items.map((item) => ({ productId: item.productId, productName: item.productName, quantity: item.quantity, unitPriceMinor: item.unitPriceMinor }));
  if (order.product) return [{ productId: order.product.id, productName: order.product.name, quantity: order.quantity, unitPriceMinor: order.product.priceMinor }];
  return [];
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

function dateInputValue(value: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function formatMoney(valueMinor: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(valueMinor / 100);
}
