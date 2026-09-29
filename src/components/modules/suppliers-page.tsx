"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Supplier = { id: string; name: string; type: "PRODUCT" | "SUPPLY" | "TOOL" | "SERVICE" | "OTHER"; email: string | null; phone: string | null; taxId: string | null; notes: string | null; _count: { expenses: number } };
type SupplierForm = { name: string; type: Supplier["type"]; email: string; phone: string; taxId: string; notes: string };
const emptyForm: SupplierForm = { name: "", type: "OTHER", email: "", phone: "", taxId: "", notes: "" };
const typeLabels = { PRODUCT: "Productos", SUPPLY: "Insumos", TOOL: "Herramientas", SERVICE: "Servicios", OTHER: "Otros" };

export function SuppliersPage({ businessId }: { businessId: string }) {
  const [items, setItems] = useState<Supplier[]>([]);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const response = await fetch(`/api/v1/businesses/${businessId}/suppliers`, { cache: "no-store" });
    if (!response.ok) { setError("No se pudieron cargar los proveedores."); setLoading(false); return; }
    setItems((await response.json()).items);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [businessId]);

  const stats = useMemo(() => ({ total: items.length, products: items.filter((item) => item.type === "PRODUCT").length, supplies: items.filter((item) => item.type === "SUPPLY").length }), [items]);
  function update(field: keyof SupplierForm, value: string) { setForm((current) => ({ ...current, [field]: value })); }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const response = await fetch(`/api/v1/businesses/${businessId}/suppliers`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, email: form.email || undefined, phone: form.phone || undefined, taxId: form.taxId || undefined, notes: form.notes || undefined }) });
    if (!response.ok) { setError("No se pudo crear el proveedor."); setSaving(false); return; }
    setForm(emptyForm); setSaving(false); await load();
  }

  return <section className="module-page"><p className="eyebrow">Compras</p><h1>Proveedores</h1><p className="module-description">Organizá los contactos que abastecen productos, insumos, herramientas y servicios de este negocio.</p>
    <div className="customer-summary"><div className="summary-card"><span>Total</span><strong>{stats.total}</strong></div><div className="summary-card"><span>Productos</span><strong>{stats.products}</strong></div><div className="summary-card"><span>Insumos</span><strong>{stats.supplies}</strong></div></div>
    <form className="customer-form" onSubmit={save}><div className="customer-form-heading"><div><h2>Nuevo proveedor</h2><p>Guardá sus datos para asociarlos a gastos.</p></div></div><div className="customer-form-grid"><label>Nombre<input value={form.name} onChange={(event) => update("name", event.target.value)} required maxLength={160} /></label><label>Tipo<select value={form.type} onChange={(event) => update("type", event.target.value)}>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Email<input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} /></label><label>Teléfono<input value={form.phone} onChange={(event) => update("phone", event.target.value)} maxLength={40} /></label><label>CUIT<input value={form.taxId} onChange={(event) => update("taxId", event.target.value)} maxLength={40} /></label><label className="customer-form-wide">Notas<textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} rows={2} maxLength={1000} /></label></div><button className="auth-submit" type="submit" disabled={saving}>{saving ? "Guardando..." : "Agregar proveedor"}</button></form>
    {error && <p className="form-error" role="alert">{error}</p>}{loading ? <div className="module-state">Cargando...</div> : items.length ? <div className="customer-list">{items.map((supplier) => <article className="customer-card" key={supplier.id}><div className="customer-card-header"><div><strong>{supplier.name}</strong><p>{supplier.email ?? "Sin email"} · {supplier.phone ?? "Sin teléfono"}</p></div><span className="customer-pill">{typeLabels[supplier.type]}</span></div><div className="customer-contact"><span>{supplier.taxId ? `CUIT: ${supplier.taxId}` : "Sin CUIT"}</span><span>{supplier._count.expenses} gastos asociados</span></div></article>)}</div> : <div className="module-state">Todavía no hay proveedores.</div>}
  </section>;
}
