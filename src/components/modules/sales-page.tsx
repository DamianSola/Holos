"use client";

import { useEffect, useMemo, useState } from "react";
import { ListSearch, SearchMiss, matchesQuery } from "@/components/forms/list-search";
import { applySaleDiscount, type SaleDiscount } from "@/lib/sale-discount";
import { ModuleLayout } from "@/components/modules/customers-page";

type Product = { id: string; name: string; priceMinor: number; stock: number };
type Customer = { id: string; name: string };
type CartItem = { productId: string; quantity: number };
type DiscountKind = "NONE" | "PERCENT" | "PRICE";
type Sale = {
  id: string;
  status: "DRAFT" | "CONFIRMED" | "CANCELLED";
  subtotalMinor: number;
  totalMinor: number;
  createdAt: string;
  customer: Customer | null;
  items: Array<{ productName: string; quantity: number; totalMinor: number }>;
  invoice: { number: string; arcaStatus: string | null; cae: string | null } | null;
};
const paymentMethods = [{ value: "CASH", label: "Efectivo" }, { value: "TRANSFER", label: "Transferencia" }, { value: "CARD", label: "Tarjeta" }, { value: "OTHER", label: "Otro" }];

export function SalesPage({ businessId }: { businessId: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productId, setProductId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("TRANSFER");
  const [quantity, setQuantity] = useState(1);
  const [discountKind, setDiscountKind] = useState<DiscountKind>("NONE");
  const [discountPercent, setDiscountPercent] = useState("");
  const [discountPrice, setDiscountPrice] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  async function load() {
    setLoading(true);
    const [productResponse, customerResponse, salesResponse] = await Promise.all([fetch(`/api/v1/businesses/${businessId}/products`, { cache: "no-store" }), fetch(`/api/v1/businesses/${businessId}/customers`, { cache: "no-store" }), fetch(`/api/v1/businesses/${businessId}/sales`, { cache: "no-store" })]);
    if (!productResponse.ok || !customerResponse.ok || !salesResponse.ok) { setError("No se pudo cargar el módulo de ventas."); setLoading(false); return; }
    const [productData, customerData, salesData] = await Promise.all([productResponse.json(), customerResponse.json(), salesResponse.json()]);
    setProducts(productData.items); setCustomers(customerData.items); setSales(salesData.items); setLoading(false);
  }
  useEffect(() => {
    let cancelled = false;
    async function loadInitialData() {
      const [productResponse, customerResponse, salesResponse] = await Promise.all([fetch(`/api/v1/businesses/${businessId}/products`, { cache: "no-store" }), fetch(`/api/v1/businesses/${businessId}/customers`, { cache: "no-store" }), fetch(`/api/v1/businesses/${businessId}/sales`, { cache: "no-store" })]);
      if (cancelled) return;
      if (!productResponse.ok || !customerResponse.ok || !salesResponse.ok) { setError("No se pudo cargar el módulo de ventas."); setLoading(false); return; }
      const [productData, customerData, salesData] = await Promise.all([productResponse.json(), customerResponse.json(), salesResponse.json()]);
      if (cancelled) return;
      setProducts(productData.items); setCustomers(customerData.items); setSales(salesData.items); setLoading(false);
    }
    void loadInitialData();
    return () => { cancelled = true; };
  }, [businessId]);
  const cartTotal = useMemo(() => cart.reduce((total, item) => { const product = products.find((candidate) => candidate.id === item.productId); return total + (product?.priceMinor ?? 0) * item.quantity; }, 0), [cart, products]);
  const priced = useMemo(() => applySaleDiscount(cartTotal, previewDiscount(discountKind, discountPercent, discountPrice, cartTotal)), [cartTotal, discountKind, discountPercent, discountPrice]);
  const visibleSales = useMemo(() => sales.filter((sale) => matchesQuery(query, sale.customer?.name, sale.invoice?.number, statusLabel(sale.status), ...sale.items.map((item) => item.productName))), [sales, query]);
  function addToCart() { if (!productId || quantity < 1) return; setCart((current) => { const existing = current.find((item) => item.productId === productId); return existing ? current.map((item) => item.productId === productId ? { ...item, quantity: item.quantity + quantity } : item) : [...current, { productId, quantity }]; }); setProductId(""); setQuantity(1); }
  function changeQuantity(productIdToChange: string, nextQuantity: number) { setCart((current) => nextQuantity < 1 ? current.filter((item) => item.productId !== productIdToChange) : current.map((item) => item.productId === productIdToChange ? { ...item, quantity: nextQuantity } : item)); }
  function resetSale() { setCart([]); setCustomerId(""); setDiscountKind("NONE"); setDiscountPercent(""); setDiscountPrice(""); }
  async function submit() {
    setMessage(""); setError("");
    if (!cart.length) { setError("Agregá al menos un producto."); return; }
    const discount = discountPayload(discountKind, discountPercent, discountPrice);
    if (discount === "invalid-percent") { setError("El porcentaje tiene que estar entre 0,01 y 100."); return; }
    if (discount === "invalid-price") { setError("Escribí el precio a cobrar."); return; }
    if (discount && discount.kind === "PRICE" && discount.priceMinor > cartTotal) { setError("El precio manual no puede superar el total de la lista."); return; }
    const response = await fetch(`/api/v1/businesses/${businessId}/sales`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId: customerId || undefined, paymentMethod, items: cart, ...(discount ? { discount } : {}) }) });
    if (!response.ok) { const payload = await response.json().catch(() => null) as { message?: string } | null; setError(payload?.message ?? "No se pudo crear la venta."); return; }
    const sale = await response.json();
    const confirmation = await fetch(`/api/v1/businesses/${businessId}/sales/${sale.id}/confirm`, { method: "POST" });
    const confirmed = await confirmation.json().catch(() => null) as { message?: string; invoice?: { arcaStatus?: string } } | null;
    if (!confirmation.ok) { setError(confirmed?.message ?? "No se pudo confirmar la venta."); await load(); return; }
    resetSale();
    setMessage(confirmed?.invoice?.arcaStatus === "AUTHORIZED" ? "Venta confirmada. La factura con CAE está lista para imprimir." : "Venta confirmada. El ticket de esta venta está listo para imprimir.");
    await load();
  }
  async function deleteSale(saleId: string) {
    const confirmed = window.confirm("¿Eliminar esta venta? Si ya estaba confirmada, el stock vuelve y deja de sumar como ingreso.");
    if (!confirmed) return;
    setMessage(""); setError("");
    const response = await fetch(`/api/v1/businesses/${businessId}/sales/${saleId}`, { method: "DELETE" });
    if (!response.ok) { const payload = await response.json().catch(() => null) as { message?: string } | null; setError(payload?.message ?? "No se pudo eliminar la venta."); return; }
    setMessage("Venta eliminada.");
    await load();
  }

  return <ModuleLayout eyebrow="Operación" title="Ventas" description="Armá ventas con varios productos, aplicá un descuento y confirmá el cobro.">
    <div className="sales-workspace"><section className="sale-builder"><div className="sale-section-heading"><div><h2>Nueva venta</h2><p>El stock se descuenta al confirmar.</p></div></div><div className="sale-form"><label>Cliente<select value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Consumidor final</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label><label>Medio de pago<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>{paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}</select></label><label>Producto<select value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Seleccionar producto</option>{products.map((product) => <option key={product.id} value={product.id} disabled={product.stock === 0}>{product.name} · {product.stock} disponibles</option>)}</select></label><label>Cantidad<input type="number" min="1" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label><button className="secondary-button" type="button" onClick={addToCart}>Agregar</button></div>{cart.length ? <div className="cart-list">{cart.map((item) => { const product = products.find((candidate) => candidate.id === item.productId); if (!product) return null; return <div className="cart-row" key={item.productId}><span><strong>{product.name}</strong><small>{formatMoney(product.priceMinor)} c/u</small></span><input aria-label={`Cantidad de ${product.name}`} type="number" min="1" max={product.stock} value={item.quantity} onChange={(event) => changeQuantity(item.productId, Number(event.target.value))} /><strong>{formatMoney(product.priceMinor * item.quantity)}</strong><button className="text-button" type="button" onClick={() => changeQuantity(item.productId, 0)}>Quitar</button></div>; })}<div className="sale-form"><label>Descuento<select value={discountKind} onChange={(event) => setDiscountKind(event.target.value as DiscountKind)}><option value="NONE">Sin descuento</option><option value="PERCENT">Porcentaje</option><option value="PRICE">Precio manual</option></select></label>{discountKind === "PERCENT" && <label>Porcentaje<input type="number" min="0.01" max="100" step="0.01" value={discountPercent} onChange={(event) => setDiscountPercent(event.target.value)} placeholder="10" /></label>}{discountKind === "PRICE" && <label>Precio a cobrar<input type="number" min="0" step="0.01" value={discountPrice} onChange={(event) => setDiscountPrice(event.target.value)} placeholder={String(cartTotal / 100)} /></label>}</div>{priced.discountMinor > 0 && <div className="sale-total"><span>Lista</span><strong>{formatMoney(cartTotal)}</strong></div>}{priced.discountMinor > 0 && <div className="sale-total"><span>Descuento</span><strong>-{formatMoney(priced.discountMinor)}</strong></div>}<div className="sale-total"><span>Total</span><strong>{formatMoney(priced.totalMinor)}</strong></div><button className="auth-submit" type="button" onClick={() => void submit()}>Confirmar venta</button></div> : <div className="module-state">Agregá productos para armar la venta.</div>}</section></div>
    {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}
    <section className="sales-history"><div className="sale-section-heading"><div><h2>Historial de ventas</h2><p>Últimas operaciones del negocio.</p></div><span className="panel-count">{sales.length}</span></div>{sales.length > 0 && <ListSearch value={query} onChange={setQuery} placeholder="Cliente o producto" />}{loading ? <div className="module-state">Cargando...</div> : sales.length === 0 ? <div className="module-state">Todavía no hay ventas.</div> : visibleSales.length ? <div className="sales-list">{visibleSales.map((sale) => <article className="sale-row" key={sale.id}><div><div className="sale-row-title"><strong>{sale.customer?.name ?? "Consumidor final"}</strong><span className={`sale-status sale-status-${sale.status.toLowerCase()}`}>{statusLabel(sale.status)}</span></div><p>{new Date(sale.createdAt).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" })} · {sale.items.map((item) => `${item.productName} x${item.quantity}`).join(", ")}</p></div><div className="sale-row-total"><strong>{formatMoney(sale.totalMinor)}</strong>{sale.subtotalMinor > sale.totalMinor && <small>Lista {formatMoney(sale.subtotalMinor)}</small>}{sale.status === "CONFIRMED" && <a className="text-button" href={`/api/v1/businesses/${businessId}/sales/${sale.id}/ticket`} target="_blank" rel="noreferrer">Imprimir</a>}{sale.invoice && <small>{sale.invoice.number}</small>}{sale.invoice?.arcaStatus !== "AUTHORIZED" && <button className="text-button" type="button" onClick={() => void deleteSale(sale.id)}>Eliminar</button>}</div></article>)}</div> : <SearchMiss query={query} />}</section>
  </ModuleLayout>;
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

function statusLabel(status: Sale["status"]) { return status === "CONFIRMED" ? "Confirmada" : status === "CANCELLED" ? "Cancelada" : "Pendiente"; }
function formatMoney(valueMinor: number) { return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(valueMinor / 100); }
