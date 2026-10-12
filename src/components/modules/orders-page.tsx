"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { PlusIcon } from "@/components/brand/nav-icons";
import { CustomerPicker } from "@/components/forms/customer-picker";
import { PaymentForm } from "@/components/forms/payment-form";
import { FormModal } from "@/components/forms/form-modal";
import { ListSearch, SearchMiss, matchesQuery } from "@/components/forms/list-search";
import { ModuleLayout } from "@/components/modules/customers-page";
import { applySaleDiscount, type SaleDiscount } from "@/lib/sale-discount";
import { orderMoneyPhrase, orderRowPhrase } from "@/lib/order-progress";

type Customer = { id: string; name: string; phone?: string | null };
type Product = { id: string; name: string; priceMinor: number; catalogKind?: "PRODUCT" | "SUPPLY" | "TOOL" };
type OrderKind = "PRODUCT" | "SERVICE";
type OrderStatus = "SCHEDULED" | "DONE" | "CANCELLED";
type PaymentMethod = "CASH" | "TRANSFER" | "CARD" | "OTHER";
type DiscountKind = "NONE" | "PERCENT" | "PRICE";
type OrderItem = { id: string; productId: string; productName: string; quantity: number; unitPriceMinor: number; totalMinor: number; deliveredAt: string | null };
type Payment = { id: string; amountMinor: number; paymentMethod: PaymentMethod; paidAt: string };
type Order = {
  id: string;
  kind: OrderKind;
  status: OrderStatus;
  title: string;
  quantity: number;
  scheduledFor: string;
  amountMinor: number | null;
  subtotalMinor: number;
  discountKind: DiscountKind;
  discountPercentBps: number | null;
  notes: string | null;
  customer: Customer;
  product: { id: string; name: string; priceMinor: number } | null;
  items: OrderItem[];
  payments: Payment[];
  sale: { id: string } | null;
};
type DraftLine = { productId: string; productName: string; quantity: number; unitPriceMinor: number };

const paymentMethods: Array<{ value: PaymentMethod; label: string }> = [
  { value: "CASH", label: "Efectivo" },
  { value: "TRANSFER", label: "Transferencia" },
  { value: "CARD", label: "Tarjeta" },
  { value: "OTHER", label: "Otro" },
];

export function OrdersPage({ businessId, businessKind = "STORE", openOrderId }: { businessId: string; businessKind?: "STORE" | "SERVICE"; openOrderId?: string }) {
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
  const [discountKind, setDiscountKind] = useState<DiscountKind>("NONE");
  const [discountPercent, setDiscountPercent] = useState("");
  const [discountPrice, setDiscountPrice] = useState("");
  const [paid, setPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<OrderStatus>("SCHEDULED");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [openOrder, setOpenOrder] = useState<Order | null>(null);
  const [askCancel, setAskCancel] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [detailMethod, setDetailMethod] = useState<PaymentMethod>("CASH");
  const pendingCustomer = useRef<string | null>(null);

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
    const items = ordersData.items as Order[];
    setOrders(items);
    setCustomers(customersData.items);
    setProducts(productsData.items);
    setOpenOrder((current) => current ? items.find((order) => order.id === current.id) ?? null : null);
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
      const items = ordersData.items as Order[];
      setOrders(items);
      setCustomers(customersData.items);
      setProducts(productsData.items);
      if (openOrderId) {
        const match = items.find((order) => order.id === openOrderId);
        if (match) {
          setOpenOrder(match);
          setFilter(match.status);
        }
      }
      setLoading(false);
    }
    void loadInitialData();
    return () => { cancelled = true; };
  }, [businessId, openOrderId]);

  const catalog = useMemo(() => products.filter((product) => product.catalogKind !== "SUPPLY" && product.catalogKind !== "TOOL"), [products]);
  const byStatus = useMemo(() => orders.filter((order) => order.status === filter), [orders, filter]);
  const visible = useMemo(() => byStatus.filter((order) => matchesQuery(query, order.title, order.customer.name, order.notes, order.product?.name, order.kind === "PRODUCT" ? rowPhrase(order) : statusText(order), ...shownLines(order).map((line) => line.productName))), [byStatus, query]);
  const openOrders = orders.filter((order) => order.status === "SCHEDULED");
  const dueMinor = openOrders.reduce((total, order) => order.kind === "PRODUCT" ? total + Math.max(0, chargeOf(order) - paidOf(order)) : total, 0);
  const draftTotal = lines.reduce((total, line) => total + line.unitPriceMinor * line.quantity, 0);
  const priced = useMemo(() => applySaleDiscount(draftTotal, previewDiscount(discountKind, discountPercent, discountPrice, draftTotal)), [draftTotal, discountKind, discountPercent, discountPrice]);
  const paidMinor = paid.trim() ? Math.round(Number(paid) * 100) : 0;

  function resetForm() {
    setEditingId(null);
    setKind(serviceBusiness ? "SERVICE" : "PRODUCT");
    setCustomerId("");
    setTitle("");
    setScheduledFor(todayKey());
    setAmount("");
    setNotes("");
    setLines([]);
    setPickId("");
    setPickQty(1);
    setDiscountKind("NONE");
    setDiscountPercent("");
    setDiscountPrice("");
    setPaid("");
    setPaymentMethod("CASH");
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
    setDiscountKind(order.discountKind ?? "NONE");
    setDiscountPercent(order.discountKind === "PERCENT" && order.discountPercentBps ? String(order.discountPercentBps / 100) : "");
    setDiscountPrice(order.discountKind === "PRICE" ? String((order.amountMinor ?? 0) / 100) : "");
    setPaid("");
    setPickId("");
    setPickQty(1);
    setError("");
    setOpenOrder(null);
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

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    if (pendingCustomer.current) {
      setError(`Elegí «${pendingCustomer.current}» en la lista o agregalo como cliente nuevo.`);
      setSaving(false);
      return;
    }
    const productOrder = kind === "PRODUCT";
    if (productOrder && lines.length < 1) {
      setError("Agregá al menos un producto.");
      setSaving(false);
      return;
    }
    if (!customerId) {
      setError("Elegí un cliente.");
      setSaving(false);
      return;
    }
    const discount = discountPayload(discountKind, discountPercent, discountPrice);
    if (discount === "invalid-percent") { setError("El porcentaje tiene que estar entre 0,01 y 100."); setSaving(false); return; }
    if (discount === "invalid-price") { setError("Escribí el precio a cobrar."); setSaving(false); return; }
    if (discount && discount.kind === "PRICE" && discount.priceMinor > draftTotal) { setError("El precio manual no puede superar el total de la lista."); setSaving(false); return; }
    if (productOrder && (!Number.isFinite(paidMinor) || paidMinor < 0)) { setError("El pago no es válido."); setSaving(false); return; }
    if (productOrder && paidMinor > priced.totalMinor) { setError("El pago supera el saldo."); setSaving(false); return; }
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
        ...(discount ? { discount } : {}),
        ...(!editingId && paidMinor > 0 ? { paidMinor, paymentMethod } : {}),
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

  function replaceOrder(updated: Order) {
    setOrders((current) => current.map((order) => order.id === updated.id ? updated : order));
    setOpenOrder((current) => current?.id === updated.id ? updated : current);
  }

  async function patchOrder(orderId: string, body: unknown) {
    setSaving(true);
    setError("");
    const response = await fetch(`/api/v1/businesses/${businessId}/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      setError(payload?.message ?? "No se pudo actualizar el pedido.");
      await load();
      return;
    }
    replaceOrder(await response.json());
  }

  async function addPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!openOrder) return;
    const amountMinor = Math.round(Number(paymentAmount) * 100);
    if (!Number.isFinite(amountMinor) || amountMinor < 1) { setError("Escribí el monto del pago."); return; }
    setSaving(true);
    setError("");
    const response = await fetch(`/api/v1/businesses/${businessId}/orders/${openOrder.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountMinor, paymentMethod: detailMethod }),
    });
    setSaving(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      setError(payload?.message ?? "No se pudo registrar el pago.");
      return;
    }
    setPaymentAmount("");
    await load();
  }

  const viewing = openOrder;

  return (
    <ModuleLayout eyebrow="Operación" title="Pedidos">
      <div className="customer-summary">
        <div className="summary-card"><span>Abiertos</span><strong>{openOrders.length}</strong></div>
        <div className="summary-card"><span>Por cobrar</span><strong>{formatMoney(dueMinor)}</strong></div>
      </div>
      <div className="customer-actions"><button className="auth-submit" type="button" onClick={openCreate}><PlusIcon />Nuevo pedido</button></div>
      {formOpen && <FormModal title={editingId ? "Editar pedido" : "Nuevo pedido"} onClose={() => { setFormOpen(false); resetForm(); }}>
        <form className="customer-form" onSubmit={(event) => void save(event)}>
          <div className="customer-form-grid">
            {serviceBusiness || editingId ? null : (
              <label>Tipo
                <select value={kind} onChange={(event) => setKind(event.target.value as OrderKind)}>
                  <option value="PRODUCT">Producto</option>
                  <option value="SERVICE">Servicio</option>
                </select>
              </label>
            )}
            <label className="customer-form-wide">Cliente
              <CustomerPicker businessId={businessId} customers={customers} value={customerId} onChange={(id) => { setCustomerId(id); setError(""); }} onCreated={(customer) => setCustomers((current) => current.some((item) => item.id === customer.id) ? current : [...current, customer].sort((a, b) => a.name.localeCompare(b.name, "es")))} onUncommitted={(name) => { pendingCustomer.current = name; }} disabled={saving} />
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
                        <button className="text-button" type="button" onClick={() => setLines((current) => current.filter((item) => item.productId !== line.productId))} disabled={lines.length < 2}>Quitar</button>
                      </div>
                    ))}
                    <div className="sale-form">
                      <label>Descuento
                        <select value={discountKind} onChange={(event) => setDiscountKind(event.target.value as DiscountKind)}>
                          <option value="NONE">Sin descuento</option>
                          <option value="PERCENT">Porcentaje</option>
                          <option value="PRICE">Precio manual</option>
                        </select>
                      </label>
                      {discountKind === "PERCENT" && <label>Porcentaje<input type="number" min="0.01" max="100" step="0.01" value={discountPercent} onChange={(event) => setDiscountPercent(event.target.value)} placeholder="10" /></label>}
                      {discountKind === "PRICE" && <label>Precio a cobrar<input type="number" min="0" step="0.01" value={discountPrice} onChange={(event) => setDiscountPrice(event.target.value)} placeholder={String(draftTotal / 100)} /></label>}
                    </div>
                    {priced.discountMinor > 0 && <div className="sale-total"><span>Lista</span><strong>{formatMoney(draftTotal)}</strong></div>}
                    {priced.discountMinor > 0 && <div className="sale-total"><span>Descuento</span><strong>-{formatMoney(priced.discountMinor)}</strong></div>}
                    <div className="sale-total"><span>Total</span><strong>{formatMoney(priced.totalMinor)}</strong></div>
                    {editingId ? null : (
                      <div className="sale-form">
                        <label>Ya pagó
                          <input type="number" min="0" step="0.01" value={paid} onChange={(event) => setPaid(event.target.value)} placeholder="0" />
                        </label>
                        {paidMinor > 0 && (
                          <label>Medio
                            <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}>
                              {paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
                            </select>
                          </label>
                        )}
                      </div>
                    )}
                    {editingId ? null : <div className="sale-total"><span>Debe</span><strong>{formatMoney(Math.max(0, priced.totalMinor - (Number.isFinite(paidMinor) ? paidMinor : 0)))}</strong></div>}
                  </div>
                ) : <div className="module-state">Agregá al menos un producto.</div>}
              </div>
            )}
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={saving || (kind === "PRODUCT" && lines.length < 1)}>{saving ? "Guardando..." : editingId ? "Guardar cambios" : kind === "SERVICE" ? "Agendar servicio" : "Agregar pedido"}</button>
        </form>
      </FormModal>}
      {error && !formOpen && !viewing && <p className="form-error" role="alert">{error}</p>}
      {orders.length > 0 && <ListSearch value={query} onChange={setQuery} placeholder="Cliente o pedido" />}
      <div className="customer-actions">
        {(["SCHEDULED", "DONE", "CANCELLED"] as const).map((status) => (
          <button className={filter === status ? "auth-submit" : "secondary-button"} key={status} type="button" onClick={() => setFilter(status)}>{filterLabel(status)}</button>
        ))}
      </div>
      {loading ? <div className="module-state">Cargando...</div> : visible.length ? (
        <div className="record-scroll"><div className="record-list orders">
          {visible.map((order) => {
            const linesOnCard = shownLines(order);
            const delivered = linesOnCard.filter((line) => lineIsDelivered(order, line)).length;
            return (
              <article className="record-row orders" key={order.id}>
                <strong className="record-who">{order.customer.name}</strong>
                <span className="record-phrase">{order.kind === "PRODUCT" ? orderRowPhrase(order.status, delivered, linesOnCard.length, chargeOf(order), paidOf(order), formatMoney) : `${statusText(order)}${order.amountMinor === null ? "" : ` · ${formatMoney(order.amountMinor)}`}`}</span>
                <button className="secondary-button record-view" type="button" onClick={() => { setError(""); setAskCancel(false); setOpenOrder(order); }}>Ver</button>
              </article>
            );
          })}
        </div></div>
      ) : query.trim() ? <SearchMiss query={query} /> : <div className="module-state">{emptyText(filter)}</div>}
      {viewing && (
        <FormModal title={viewing.customer.name} onClose={() => { setOpenOrder(null); setAskCancel(false); setError(""); }}>
          <div className="record-detail">
            <p>{formatDate(viewing.scheduledFor)} · {viewing.kind === "PRODUCT" ? rowPhrase(viewing) : statusText(viewing)}</p>
            {viewing.notes && <p>{viewing.notes}</p>}
            {viewing.kind === "PRODUCT" ? <ProductDetail businessId={businessId} order={viewing} saving={saving} error={error} askCancel={askCancel} paymentAmount={paymentAmount} paymentMethod={detailMethod} onPaymentAmount={setPaymentAmount} onPaymentMethod={setDetailMethod} onToggle={(itemId, delivered) => void patchOrder(viewing.id, { itemId, delivered })} onDeliverAll={() => void patchOrder(viewing.id, { deliverAll: true })} onPay={(event) => void addPayment(event)} onEdit={() => openEdit(viewing)} onAskCancel={setAskCancel} onCancel={(refund) => { setAskCancel(false); void patchOrder(viewing.id, { status: "CANCELLED", refund }); }} onReopen={() => void patchOrder(viewing.id, { status: "SCHEDULED" })} /> : (
              <div className="customer-actions">
                {viewing.status === "SCHEDULED" && <button className="secondary-button" type="button" onClick={() => void patchOrder(viewing.id, { status: "DONE" })}>Marcar realizado</button>}
                {viewing.status === "SCHEDULED" && <button className="text-button" type="button" onClick={() => void patchOrder(viewing.id, { status: "CANCELLED" })}>Cancelar</button>}
                {viewing.status !== "SCHEDULED" && <button className="text-button" type="button" onClick={() => void patchOrder(viewing.id, { status: "SCHEDULED" })}>Reabrir</button>}
              </div>
            )}
          </div>
        </FormModal>
      )}
    </ModuleLayout>
  );
}

function ProductDetail({ businessId, order, saving, error, askCancel, paymentAmount, paymentMethod, onPaymentAmount, onPaymentMethod, onToggle, onDeliverAll, onPay, onEdit, onAskCancel, onCancel, onReopen }: {
  businessId: string;
  order: Order;
  saving: boolean;
  error: string;
  askCancel: boolean;
  paymentAmount: string;
  paymentMethod: PaymentMethod;
  onPaymentAmount: (value: string) => void;
  onPaymentMethod: (value: PaymentMethod) => void;
  onToggle: (itemId: string, delivered: boolean) => void;
  onDeliverAll: () => void;
  onPay: (event: FormEvent<HTMLFormElement>) => void;
  onEdit: () => void;
  onAskCancel: (value: boolean) => void;
  onCancel: (refund: boolean) => void;
  onReopen: () => void;
}) {
  const lines = shownLines(order);
  const delivered = lines.filter((line) => lineIsDelivered(order, line)).length;
  const charge = chargeOf(order);
  const paid = paidOf(order);
  const balance = Math.max(0, charge - paid);
  const list = listOf(order);
  const editable = order.status === "SCHEDULED" && lines.every((line) => !line.deliveredAt);
  return (
    <>
      {lines.length > 0 && (
        <>
          <div className="task-meter" aria-hidden="true"><span style={{ width: `${Math.round((delivered / lines.length) * 100)}%` }} /></div>
          <p className="task-progress">{delivered} de {lines.length} entregados</p>
          <ul className="task-checks">
            {lines.map((line) => {
              const checked = lineIsDelivered(order, line);
              return (
                <li key={line.id}>
                  <label className={checked ? "task-check is-done" : "task-check"}>
                    <input type="checkbox" checked={checked} disabled={saving || order.status === "CANCELLED" || !line.id} onChange={(event) => onToggle(line.id, event.target.checked)} />
                    <span className="task-check-box" aria-hidden="true" />
                    <span className="order-check-main"><span>{line.productName} x{line.quantity}</span><strong>{formatMoney(line.totalMinor)}</strong></span>
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {list > charge && <p>Lista {formatMoney(list)} · descuento {formatMoney(list - charge)}</p>}
      <p>Total <strong>{formatMoney(charge)}</strong> · {orderMoneyPhrase(order.status, charge, paid, formatMoney)}</p>
      {order.payments.length > 0 && <ul className="reservation-payments">{order.payments.map((payment) => <li key={payment.id}><span>{formatDate(payment.paidAt)} · {paymentMethods.find((method) => method.value === payment.paymentMethod)?.label}</span><strong>{formatMoney(payment.amountMinor)}</strong></li>)}</ul>}
      {order.status === "DONE" && order.sale && <p><a className="record-link" href={`/businesses/${businessId}/sales?venta=${order.sale.id}`}>Quedó en Ventas</a></p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {order.status !== "CANCELLED" && balance > 0 && (
        <PaymentForm balanceMinor={balance} amount={paymentAmount} method={paymentMethod} saving={saving} onAmount={onPaymentAmount} onMethod={onPaymentMethod} onSubmit={onPay} />
      )}
      {askCancel ? (
        <div className="customer-actions">
          <p>{paid > 0 ? `Ya cobraste ${formatMoney(paid)}.` : "El cliente no se lo lleva."}</p>
          {paid > 0 ? <button className="secondary-button" type="button" disabled={saving} onClick={() => onCancel(true)}>Devolver lo cobrado</button> : <button className="secondary-button" type="button" disabled={saving} onClick={() => onCancel(false)}>Cancelar pedido</button>}
          {paid > 0 && <button className="secondary-button" type="button" disabled={saving} onClick={() => onCancel(false)}>Quedarme con la seña</button>}
          <button className="text-button" type="button" onClick={() => onAskCancel(false)}>Volver</button>
        </div>
      ) : (
        <div className="customer-actions">
          {order.status !== "CANCELLED" && delivered < lines.length && <button className="secondary-button" type="button" disabled={saving} onClick={onDeliverAll}>Entregar todo</button>}
          {editable && <button className="secondary-button" type="button" onClick={onEdit}>Editar</button>}
          {order.status !== "CANCELLED" && <button className="text-button" type="button" onClick={() => onAskCancel(true)}>Cancelar</button>}
          {order.status === "CANCELLED" && <button className="text-button" type="button" onClick={onReopen}>Reabrir</button>}
        </div>
      )}
    </>
  );
}

function shownLines(order: Order) {
  if (order.kind !== "PRODUCT") return [];
  if (order.items?.length) return order.items;
  if (order.product) {
    const totalMinor = order.product.priceMinor * order.quantity;
    return [{ id: "", productId: order.product.id, productName: order.product.name, quantity: order.quantity, unitPriceMinor: order.product.priceMinor, totalMinor, deliveredAt: null }];
  }
  return [];
}

function draftLines(order: Order): DraftLine[] {
  if (order.items?.length) return order.items.map((item) => ({ productId: item.productId, productName: item.productName, quantity: item.quantity, unitPriceMinor: item.unitPriceMinor }));
  if (order.product) return [{ productId: order.product.id, productName: order.product.name, quantity: order.quantity, unitPriceMinor: order.product.priceMinor }];
  return [];
}

function lineIsDelivered(order: Order, line: { deliveredAt: string | null }) {
  if (line.deliveredAt) return true;
  return order.status === "DONE" && order.items.every((item) => !item.deliveredAt);
}

function deliveredCount(order: Order) {
  return shownLines(order).filter((line) => lineIsDelivered(order, line)).length;
}

function listOf(order: Order) {
  const lines = shownLines(order).reduce((total, line) => total + line.totalMinor, 0);
  return order.subtotalMinor > 0 ? order.subtotalMinor : lines;
}

function chargeOf(order: Order) {
  return order.amountMinor ?? listOf(order);
}

function paidOf(order: Order) {
  return (order.payments ?? []).reduce((total, payment) => total + payment.amountMinor, 0);
}

function rowPhrase(order: Order) {
  const lines = shownLines(order);
  const delivered = lines.filter((line) => lineIsDelivered(order, line)).length;
  return orderRowPhrase(order.status, delivered, lines.length, chargeOf(order), paidOf(order), formatMoney);
}

function filterLabel(status: OrderStatus) {
  if (status === "SCHEDULED") return "Abiertos";
  if (status === "DONE") return "Cerrados";
  return "Cancelados";
}

function statusText(order: Order) {
  if (order.status === "CANCELLED") return "Cancelado";
  if (order.status === "DONE") return "Realizado";
  return "Agendado";
}

function emptyText(filter: OrderStatus) {
  if (filter === "DONE") return "Todavía no hay pedidos cerrados.";
  if (filter === "CANCELLED") return "No hay pedidos cancelados.";
  return "Todavía no hay pedidos. Cuando un cliente te encargue algo, anotalo acá.";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-AR", { dateStyle: "medium" });
}

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function dateInputValue(value: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function formatMoney(valueMinor: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(valueMinor / 100);
}

function previewDiscount(kind: DiscountKind, percent: string, price: string, subtotalMinor: number): SaleDiscount {
  if (kind === "PERCENT") {
    const value = Number(percent);
    if (!Number.isFinite(value) || value <= 0) return { kind: "NONE" };
    return { kind: "PERCENT", percentBps: Math.min(10_000, Math.round(value * 100)) };
  }
  if (kind === "PRICE") {
    const value = Math.round(Number(price) * 100);
    if (!Number.isFinite(value) || value < 0 || price === "") return { kind: "NONE" };
    if (value > subtotalMinor) return { kind: "PRICE", priceMinor: subtotalMinor };
    return { kind: "PRICE", priceMinor: value };
  }
  return { kind: "NONE" };
}

function discountPayload(kind: DiscountKind, percent: string, price: string) {
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
