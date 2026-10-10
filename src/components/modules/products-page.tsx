"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ConfirmModal } from "@/components/forms/confirm-modal";
import { FormModal } from "@/components/forms/form-modal";
import { ListSearch, SearchMiss, matchesQuery } from "@/components/forms/list-search";
import { ModuleLayout } from "@/components/modules/customers-page";

type CatalogKind = "PRODUCT" | "SUPPLY" | "TOOL";
type Product = { id: string; name: string; catalogKind: CatalogKind; category: string | null; description: string | null; priceMinor: number; costMinor: number | null; stock: number; minimumStock: number; status: "ACTIVE" | "ARCHIVED" };
type ProductForm = { name: string; catalogKind: "SUPPLY" | "TOOL"; category: string; description: string; price: string; cost: string; minimumStock: string; stock: string };
const emptyForm: ProductForm = { name: "", catalogKind: "SUPPLY", category: "", description: "", price: "", cost: "", minimumStock: "0", stock: "0" };

export function ProductsPage({ businessId, mode = "catalog" }: { businessId: string; mode?: "catalog" | "stock" }) {
  const stockMode = mode === "stock";
  const [items, setItems] = useState<Product[]>([]);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [stockPrompt, setStockPrompt] = useState<{ product: Product; direction: "in" | "out" } | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Product | null>(null);
  const [viewing, setViewing] = useState<Product | null>(null);

  async function load() {
    setLoading(true);
    const response = await fetch(`/api/v1/businesses/${businessId}/products`, { cache: "no-store" });
    if (!response.ok) { setError(stockMode ? "No se pudo cargar el stock." : "No se pudieron cargar los productos."); setLoading(false); return; }
    setItems((await response.json()).items);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [businessId]);

  function updateForm(field: keyof ProductForm, value: string) { setForm((current) => ({ ...current, [field]: value })); }
  function closeForm() { setEditingId(null); setForm(emptyForm); setFormOpen(false); }
  function openCreate() { closeForm(); setFormOpen(true); setError(""); }
  function startEditing(product: Product) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      catalogKind: product.catalogKind === "TOOL" ? "TOOL" : "SUPPLY",
      category: product.category ?? "",
      description: product.description ?? "",
      price: String(product.priceMinor / 100),
      cost: product.costMinor === null ? "" : String(product.costMinor / 100),
      minimumStock: String(product.minimumStock),
      stock: String(product.stock),
    });
    setError("");
    setFormOpen(true);
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const costMinor = form.cost.trim() ? Math.round(Number(form.cost) * 100) : undefined;
    const body = stockMode
      ? { name: form.name, catalogKind: form.catalogKind, description: form.description || undefined, costMinor, minimumStock: Number(form.minimumStock), ...(editingId ? { priceMinor: 0, status: "ACTIVE" as const } : { stock: Number(form.stock) }) }
      : { name: form.name, category: form.category || undefined, description: form.description || undefined, priceMinor: Math.round(Number(form.price) * 100), costMinor, minimumStock: Number(form.minimumStock), ...(editingId ? { status: "ACTIVE" as const } : { stock: Number(form.stock) }) };
    const response = await fetch(editingId ? `/api/v1/businesses/${businessId}/products/${editingId}` : `/api/v1/businesses/${businessId}/products`, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) { setError(editingId ? "No se pudo guardar." : stockMode ? "No se pudo agregar al stock." : "No se pudo crear el producto."); setSaving(false); return; }
    closeForm();
    setSaving(false);
    await load();
  }

  async function adjustStock(product: Product, quantity: number, reason: string) {
    setError("");
    const response = await fetch(`/api/v1/businesses/${businessId}/products/${product.id}/inventory`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quantity, reason }) });
    if (!response.ok) { setError("No se pudo ajustar el stock. Revisá que haya unidades suficientes."); return false; }
    setStockPrompt(null);
    await load();
    return true;
  }

  async function archiveProduct(product: Product) {
    setArchiveTarget(null);
    const response = await fetch(`/api/v1/businesses/${businessId}/products/${product.id}`, { method: "DELETE" });
    if (!response.ok) { setError("No se pudo archivar."); return; }
    if (editingId === product.id) closeForm();
    await load();
  }

  const listed = items.filter((product) => stockMode ? product.catalogKind !== "PRODUCT" : product.catalogKind === "PRODUCT");
  const visible = useMemo(() => listed.filter((product) => matchesQuery(query, product.name, product.category, product.description, kindLabel(product.catalogKind))), [listed, query]);

  return (
    <ModuleLayout eyebrow="Operación" title={stockMode ? "Stock" : "Productos"}>
      <div className="customer-actions"><button className="auth-submit" type="button" onClick={openCreate}>{stockMode ? "Nuevo ítem" : "Nuevo producto"}</button></div>
      {error && !formOpen && !stockPrompt && <p className="form-error" role="alert">{error}</p>}
      {listed.length > 0 && <ListSearch value={query} onChange={setQuery} placeholder={stockMode ? "Nombre o tipo" : "Nombre o tipo"} />}
      {loading ? <div className="module-state">Cargando...</div> : listed.length === 0 ? <div className="module-state">{stockMode ? "Todavía no hay insumos ni herramientas." : "Todavía no hay productos."}</div> : visible.length ? (
        <div className="record-scroll"><div className="record-list products">
          {visible.map((product) => {
            const low = product.stock <= product.minimumStock;
            return (
              <article className="record-row products" key={product.id}>
                <strong>{product.name}</strong>
                <span>{stockMode ? kindLabel(product.catalogKind) : (product.category || "—")}</span>
                <strong className="record-money">{stockMode ? `${product.stock} un.` : formatMoney(product.priceMinor)}</strong>
                <span className={low ? "record-alert" : undefined}>{stockMode ? `mín. ${product.minimumStock}` : low ? `${product.stock} un. · Bajo` : `${product.stock} un.`}</span>
                <button className="secondary-button" type="button" onClick={() => setViewing(product)}>Ver</button>
              </article>
            );
          })}
        </div></div>
      ) : <SearchMiss query={query} />}
      {formOpen && (
        <FormModal title={editingId ? (stockMode ? "Editar ítem" : "Editar producto") : (stockMode ? "Nuevo ítem" : "Nuevo producto")} onClose={closeForm}>
          <form className="customer-form" onSubmit={(event) => void saveProduct(event)}>
            <div className="customer-form-grid">
              <label>Nombre<input value={form.name} onChange={(event) => updateForm("name", event.target.value)} required maxLength={160} /></label>
              {stockMode ? (
                <label>Tipo
                  <select value={form.catalogKind} onChange={(event) => updateForm("catalogKind", event.target.value)}>
                    <option value="SUPPLY">Insumo</option>
                    <option value="TOOL">Herramienta</option>
                  </select>
                </label>
              ) : <label>Tipo<input value={form.category} onChange={(event) => updateForm("category", event.target.value)} maxLength={120} /></label>}
              {stockMode ? null : <label>Precio<input value={form.price} onChange={(event) => updateForm("price", event.target.value)} type="number" min="0" step="0.01" required /></label>}
              <label>Costo<input value={form.cost} onChange={(event) => updateForm("cost", event.target.value)} type="number" min="0" step="0.01" placeholder={stockMode ? "Opcional" : undefined} /></label>
              <label>Stock mínimo<input value={form.minimumStock} onChange={(event) => updateForm("minimumStock", event.target.value)} type="number" min="0" required /></label>
              {!editingId && <label>Stock inicial<input value={form.stock} onChange={(event) => updateForm("stock", event.target.value)} type="number" min="0" required /></label>}
              <label className="customer-form-wide">Descripción<textarea value={form.description} onChange={(event) => updateForm("description", event.target.value)} maxLength={2000} rows={2} /></label>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit" disabled={saving}>{saving ? "Guardando..." : editingId ? "Guardar cambios" : stockMode ? "Agregar al stock" : "Agregar producto"}</button>
          </form>
        </FormModal>
      )}
      {archiveTarget && <ConfirmModal title="Archivar" message={stockMode ? `¿Archivar ${archiveTarget.name}? Deja de aparecer en el stock.` : `¿Archivar ${archiveTarget.name}? Dejará de aparecer en ventas.`} onCancel={() => setArchiveTarget(null)} onAccept={() => void archiveProduct(archiveTarget)} />}
      {viewing && <FormModal title={viewing.name} onClose={() => setViewing(null)}><div className="record-detail"><p>{stockMode ? kindLabel(viewing.catalogKind) : (viewing.category || "Sin tipo")}</p>{stockMode ? null : <p>Precio <strong>{formatMoney(viewing.priceMinor)}</strong></p>}<p>Stock <strong>{viewing.stock}</strong> · mínimo {viewing.minimumStock}{viewing.stock <= viewing.minimumStock ? " · Bajo" : ""}</p>{viewing.costMinor !== null && <p>Costo <strong>{formatMoney(viewing.costMinor)}</strong></p>}<p>{viewing.description || "Sin descripción"}</p><div className="customer-actions"><button className="secondary-button" type="button" onClick={() => { setError(""); setStockPrompt({ product: viewing, direction: "in" }); setViewing(null); }}>{stockMode ? "Sumar" : "Ingresar stock"}</button><button className="secondary-button" type="button" onClick={() => { setError(""); setStockPrompt({ product: viewing, direction: "out" }); setViewing(null); }} disabled={viewing.stock === 0}>{stockMode ? "Restar" : "Retirar stock"}</button><button className="secondary-button" type="button" onClick={() => { startEditing(viewing); setViewing(null); }}>Editar</button><button className="text-button" type="button" onClick={() => { setArchiveTarget(viewing); setViewing(null); }}>Archivar</button></div></div></FormModal>}
      {stockPrompt && <StockAdjustModal product={stockPrompt.product} direction={stockPrompt.direction} stockMode={stockMode} error={error} onCancel={() => { setError(""); setStockPrompt(null); }} onAccept={(quantity, reason) => adjustStock(stockPrompt.product, quantity, reason)} />}
    </ModuleLayout>
  );
}

function StockAdjustModal({ product, direction, stockMode, error, onCancel, onAccept }: { product: Product; direction: "in" | "out"; stockMode: boolean; error: string; onCancel: () => void; onAccept: (quantity: number, reason: string) => Promise<boolean> }) {
  const [movement, setMovement] = useState(direction);
  const [amount, setAmount] = useState("1");
  const [reason, setReason] = useState(direction === "in" ? "Compra" : "Uso");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState("");
  const inLabel = stockMode ? "Sumar" : "Ingresar";
  const outLabel = stockMode ? "Restar" : "Retirar";

  function changeMovement(next: "in" | "out") {
    setMovement(next);
    setLocalError("");
    setReason((current) => current === "Compra" || current === "Uso" ? (next === "in" ? "Compra" : "Uso") : current);
  }

  async function accept(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const units = Number(amount);
    if (!Number.isInteger(units) || units < 1) { setLocalError("Ingresá una cantidad entera mayor a cero."); return; }
    if (movement === "out" && units > product.stock) { setLocalError("No hay tantas unidades para restar."); return; }
    setBusy(true);
    setLocalError("");
    const ok = await onAccept(movement === "in" ? units : -units, reason);
    if (!ok) setBusy(false);
  }

  return (
    <FormModal title="Actualizar stock" onClose={onCancel}>
      <form className="customer-form dialog-body" onSubmit={(event) => void accept(event)}>
        <p>{product.name}. Hay {product.stock} unidades.</p>
        <div className="customer-form-grid">
          <label className="customer-form-wide">Movimiento
            <select value={movement} onChange={(event) => changeMovement(event.target.value as "in" | "out")}>
              <option value="in">{inLabel}</option>
              <option value="out" disabled={product.stock === 0}>{outLabel}</option>
            </select>
          </label>
          <label className="customer-form-wide">Cantidad
            <input type="number" min={1} max={movement === "out" ? product.stock : undefined} step={1} value={amount} onChange={(event) => setAmount(event.target.value)} required autoFocus />
          </label>
          <label className="customer-form-wide">Motivo
            <input aria-label="Motivo" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} />
          </label>
        </div>
        {(localError || error) && <p className="form-error" role="alert">{localError || error}</p>}
        <div className="dialog-actions">
          <button className="secondary-button" type="button" onClick={onCancel}>Cancelar</button>
          <button className="auth-submit" type="submit" disabled={busy}>Actualizar stock</button>
        </div>
      </form>
    </FormModal>
  );
}

function kindLabel(kind: CatalogKind) {
  if (kind === "TOOL") return "Herramienta";
  if (kind === "SUPPLY") return "Insumo";
  return "Producto";
}

function formatMoney(valueMinor: number) { return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(valueMinor / 100); }
