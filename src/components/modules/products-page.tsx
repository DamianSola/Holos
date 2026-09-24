"use client";

import { FormEvent, useEffect, useState } from "react";
import { ModuleLayout } from "@/components/modules/customers-page";

type Product = { id: string; name: string; category: string | null; description: string | null; priceMinor: number; costMinor: number | null; stock: number; minimumStock: number; status: "ACTIVE" | "ARCHIVED" };
type ProductForm = { name: string; category: string; description: string; price: string; cost: string; minimumStock: string };
const emptyForm: ProductForm = { name: "", category: "", description: "", price: "", cost: "", minimumStock: "0" };

export function ProductsPage({ businessId }: { businessId: string }) {
  const [items, setItems] = useState<Product[]>([]);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() { setLoading(true); const response = await fetch(`/api/v1/businesses/${businessId}/products`, { cache: "no-store" }); if (!response.ok) { setError("No se pudieron cargar los productos."); setLoading(false); return; } setItems((await response.json()).items); setLoading(false); }
  useEffect(() => { void load(); }, [businessId]);
  function updateForm(field: keyof ProductForm, value: string) { setForm((current) => ({ ...current, [field]: value })); }
  function startEditing(product: Product) { setEditingId(product.id); setForm({ name: product.name, category: product.category ?? "", description: product.description ?? "", price: String(product.priceMinor / 100), cost: product.costMinor === null ? "" : String(product.costMinor / 100), minimumStock: String(product.minimumStock) }); setError(""); }
  function resetForm() { setEditingId(null); setForm(emptyForm); }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const stockInput = event.currentTarget.elements.namedItem("stock") as HTMLInputElement | null;
    const body = { name: form.name, category: form.category || undefined, description: form.description || undefined, priceMinor: Math.round(Number(form.price) * 100), costMinor: form.cost ? Math.round(Number(form.cost) * 100) : undefined, minimumStock: Number(form.minimumStock), ...(editingId ? { status: "ACTIVE" } : { stock: Number(stockInput?.value ?? 0) }) };
    const response = await fetch(editingId ? `/api/v1/businesses/${businessId}/products/${editingId}` : `/api/v1/businesses/${businessId}/products`, { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) { setError(editingId ? "No se pudo actualizar el producto." : "No se pudo crear el producto."); setSaving(false); return; }
    resetForm(); setSaving(false); await load();
  }

  async function adjustStock(product: Product, quantity: number) { const reason = window.prompt(quantity > 0 ? "Motivo del ingreso de stock" : "Motivo de la salida de stock", quantity > 0 ? "Reposición" : "Ajuste de inventario"); if (reason === null) return; setError(""); const response = await fetch(`/api/v1/businesses/${businessId}/products/${product.id}/inventory`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quantity, reason }) }); if (!response.ok) { setError("No se pudo ajustar el stock. Revisá que haya unidades suficientes."); return; } await load(); }
  async function archiveProduct(product: Product) { if (!window.confirm(`¿Archivar ${product.name}? Dejará de aparecer en ventas.`)) return; const response = await fetch(`/api/v1/businesses/${businessId}/products/${product.id}`, { method: "DELETE" }); if (!response.ok) { setError("No se pudo archivar el producto."); return; } if (editingId === product.id) resetForm(); await load(); }

  return <ModuleLayout eyebrow="Operations" title="Products" description="Gestioná tu catálogo, precios y existencias desde un solo lugar.">
    <form className="product-form" onSubmit={saveProduct}><div className="product-form-heading"><div><h2>{editingId ? "Editar producto" : "Nuevo producto"}</h2><p>{editingId ? "Actualizá los datos del catálogo." : "Agregá un artículo al catálogo."}</p></div>{editingId && <button className="secondary-button" type="button" onClick={resetForm}>Cancelar</button>}</div><div className="product-form-grid"><label>Nombre<input value={form.name} onChange={(event) => updateForm("name", event.target.value)} required maxLength={160} /></label><label>Tipo<input value={form.category} onChange={(event) => updateForm("category", event.target.value)} maxLength={120} /></label><label>Precio<input value={form.price} onChange={(event) => updateForm("price", event.target.value)} type="number" min="0" step="0.01" required /></label><label>Costo<input value={form.cost} onChange={(event) => updateForm("cost", event.target.value)} type="number" min="0" step="0.01" /></label><label>Stock mínimo<input value={form.minimumStock} onChange={(event) => updateForm("minimumStock", event.target.value)} type="number" min="0" required /></label>{!editingId && <label>Stock inicial<input name="stock" type="number" min="0" defaultValue="0" required /></label>}<label className="product-form-wide">Descripción<textarea value={form.description} onChange={(event) => updateForm("description", event.target.value)} maxLength={2000} rows={2} /></label></div><button className="auth-submit" type="submit" disabled={saving}>{saving ? "Guardando..." : editingId ? "Guardar cambios" : "Agregar producto"}</button></form>
    {error && <p className="form-error" role="alert">{error}</p>}{loading ? <div className="module-state">Cargando...</div> : items.length ? <div className="product-list">{items.map((product) => <article className={`product-card ${product.stock <= product.minimumStock ? "is-low-stock" : ""}`} key={product.id}><div className="product-card-main"><div><div className="product-title-line"><strong>{product.name}</strong>{product.category && <span className="customer-pill">{product.category}</span>}{product.stock <= product.minimumStock && <span className="stock-badge">Stock bajo</span>}</div>{product.description && <p>{product.description}</p>}</div><div className="product-price">{formatMoney(product.priceMinor)}<small>precio</small></div></div><div className="product-card-details"><span><strong>{product.stock}</strong> unidades</span><span>mínimo {product.minimumStock}</span>{product.costMinor !== null && <span>costo {formatMoney(product.costMinor)}</span>}</div><div className="product-actions"><button className="secondary-button" type="button" onClick={() => void adjustStock(product, 1)}>+ Ingresar stock</button><button className="secondary-button" type="button" onClick={() => void adjustStock(product, -1)} disabled={product.stock === 0}>- Retirar stock</button><button className="secondary-button" type="button" onClick={() => startEditing(product)}>Editar</button><button className="text-button" type="button" onClick={() => void archiveProduct(product)}>Archivar</button></div></article>)}</div> : <div className="module-state">Todavía no hay productos.</div>}
  </ModuleLayout>;
}

function formatMoney(valueMinor: number) { return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(valueMinor / 100); }