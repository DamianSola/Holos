"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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

  async function adjustStock(product: Product, quantity: number) {
    const reason = window.prompt(quantity > 0 ? "Motivo de la entrada" : "Motivo de la salida", quantity > 0 ? "Compra" : "Uso");
    if (reason === null) return;
    setError("");
    const response = await fetch(`/api/v1/businesses/${businessId}/products/${product.id}/inventory`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quantity, reason }) });
    if (!response.ok) { setError("No se pudo ajustar el stock. Revisá que haya unidades suficientes."); return; }
    await load();
  }

  async function archiveProduct(product: Product) {
    if (!window.confirm(stockMode ? `¿Archivar ${product.name}? Deja de aparecer en el stock.` : `¿Archivar ${product.name}? Dejará de aparecer en ventas.`)) return;
    const response = await fetch(`/api/v1/businesses/${businessId}/products/${product.id}`, { method: "DELETE" });
    if (!response.ok) { setError("No se pudo archivar."); return; }
    if (editingId === product.id) closeForm();
    await load();
  }

  const listed = items.filter((product) => stockMode ? product.catalogKind !== "PRODUCT" : product.catalogKind === "PRODUCT");
  const visible = useMemo(() => listed.filter((product) => matchesQuery(query, product.name, product.category, product.description, kindLabel(product.catalogKind))), [listed, query]);

  return (
    <ModuleLayout eyebrow="Operación" title={stockMode ? "Stock" : "Productos"} description={stockMode ? "Llevá insumos y herramientas. Sumar o restar no mueve la plata: el gasto se carga aparte." : "Gestioná tu catálogo, precios y existencias desde un solo lugar."}>
      <div className="customer-actions"><button className="auth-submit" type="button" onClick={openCreate}>{stockMode ? "Nuevo ítem" : "Nuevo producto"}</button></div>
      {error && !formOpen && <p className="form-error" role="alert">{error}</p>}
      {listed.length > 0 && <ListSearch value={query} onChange={setQuery} placeholder={stockMode ? "Nombre o tipo" : "Nombre o tipo"} />}
      {loading ? <div className="module-state">Cargando...</div> : listed.length === 0 ? <div className="module-state">{stockMode ? "Todavía no hay insumos ni herramientas." : "Todavía no hay productos."}</div> : visible.length ? (
        <div className="product-list">
          {visible.map((product) => (
            <article className={`product-card ${product.stock <= product.minimumStock ? "is-low-stock" : ""}`} key={product.id}>
              <div className="product-card-main">
                <div>
                  <div className="product-title-line">
                    <strong>{product.name}</strong>
                    {stockMode ? <span className="customer-pill">{kindLabel(product.catalogKind)}</span> : product.category && <span className="customer-pill">{product.category}</span>}
                    {product.stock <= product.minimumStock && <span className="stock-badge">Stock bajo</span>}
                  </div>
                  {product.description && <p>{product.description}</p>}
                </div>
                {stockMode ? null : <div className="product-price">{formatMoney(product.priceMinor)}<small>precio</small></div>}
              </div>
              <div className="product-card-details">
                <span><strong>{product.stock}</strong> unidades</span>
                <span>mínimo {product.minimumStock}</span>
                {product.costMinor !== null && <span>costo {formatMoney(product.costMinor)}</span>}
              </div>
              <div className="product-actions">
                <button className="secondary-button" type="button" onClick={() => void adjustStock(product, 1)}>{stockMode ? "Sumar" : "+ Ingresar stock"}</button>
                <button className="secondary-button" type="button" onClick={() => void adjustStock(product, -1)} disabled={product.stock === 0}>{stockMode ? "Restar" : "- Retirar stock"}</button>
                <button className="secondary-button" type="button" onClick={() => startEditing(product)}>Editar</button>
                <button className="text-button" type="button" onClick={() => void archiveProduct(product)}>Archivar</button>
              </div>
            </article>
          ))}
        </div>
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
    </ModuleLayout>
  );
}

function kindLabel(kind: CatalogKind) {
  if (kind === "TOOL") return "Herramienta";
  if (kind === "SUPPLY") return "Insumo";
  return "Producto";
}

function formatMoney(valueMinor: number) { return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(valueMinor / 100); }
