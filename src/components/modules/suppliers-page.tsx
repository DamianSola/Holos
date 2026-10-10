"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { FormModal } from "@/components/forms/form-modal";
import { ListSearch, SearchMiss, matchesQuery } from "@/components/forms/list-search";

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
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [viewing, setViewing] = useState<Supplier | null>(null);

  async function load() {
    setLoading(true);
    const response = await fetch(`/api/v1/businesses/${businessId}/suppliers`, { cache: "no-store" });
    if (!response.ok) { setError("No se pudieron cargar los proveedores."); setLoading(false); return; }
    setItems((await response.json()).items);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [businessId]);

  const stats = useMemo(() => ({ total: items.length, products: items.filter((item) => item.type === "PRODUCT").length, supplies: items.filter((item) => item.type === "SUPPLY").length }), [items]);
  const visible = useMemo(() => items.filter((item) => matchesQuery(query, item.name, item.email, item.phone, item.taxId, item.notes, typeLabels[item.type])), [items, query]);
  function update(field: keyof SupplierForm, value: string) { setForm((current) => ({ ...current, [field]: value })); }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const response = await fetch(`/api/v1/businesses/${businessId}/suppliers`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, email: form.email || undefined, phone: form.phone || undefined, taxId: form.taxId || undefined, notes: form.notes || undefined }) });
    if (!response.ok) { setError("No se pudo crear el proveedor."); setSaving(false); return; }
    setForm(emptyForm); setFormOpen(false); setSaving(false); await load();
  }

  return <section className="module-page"><p className="eyebrow">Compras</p><h1>Proveedores</h1>
    <div className="customer-summary"><div className="summary-card"><span>Total</span><strong>{stats.total}</strong></div><div className="summary-card"><span>Productos</span><strong>{stats.products}</strong></div><div className="summary-card"><span>Insumos</span><strong>{stats.supplies}</strong></div></div>
    <div className="customer-actions"><button className="auth-submit" type="button" onClick={() => { setError(""); setFormOpen(true); }}>Nuevo proveedor</button></div>
    {formOpen && <FormModal title="Nuevo proveedor" onClose={() => setFormOpen(false)}><form className="customer-form" onSubmit={save}><div className="customer-form-grid"><label>Nombre<input value={form.name} onChange={(event) => update("name", event.target.value)} required maxLength={160} /></label><label>Tipo<select value={form.type} onChange={(event) => update("type", event.target.value)}>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Email<input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} /></label><label>Teléfono<input value={form.phone} onChange={(event) => update("phone", event.target.value)} maxLength={40} /></label><label>CUIT<input value={form.taxId} onChange={(event) => update("taxId", event.target.value)} maxLength={40} /></label><label className="customer-form-wide">Notas<textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} rows={2} maxLength={1000} /></label></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="auth-submit" type="submit" disabled={saving}>{saving ? "Guardando..." : "Agregar proveedor"}</button></form></FormModal>}
    {error && <p className="form-error" role="alert">{error}</p>}{items.length > 0 && <ListSearch value={query} onChange={setQuery} placeholder="Nombre, CUIT o teléfono" />}{loading ? <div className="module-state">Cargando...</div> : items.length === 0 ? <div className="module-state">Todavía no hay proveedores.</div> : visible.length ? <div className="record-scroll"><div className="record-list suppliers">{visible.map((supplier) => <article className="record-row suppliers" key={supplier.id}><strong>{supplier.name}</strong><span>{typeLabels[supplier.type]}</span><span>{supplier.phone ?? "—"}</span><span>{supplier.email ?? "—"}</span><span>{supplier.taxId ?? "—"}</span><span>{supplier.notes ?? "—"}</span><span>{supplier._count.expenses === 1 ? "1 gasto" : `${supplier._count.expenses} gastos`}</span><button className="secondary-button" type="button" onClick={() => setViewing(supplier)}>Ver</button></article>)}</div></div> : <SearchMiss query={query} />}
    {viewing && <FormModal title={viewing.name} onClose={() => setViewing(null)}><div className="record-detail"><dl className="record-fields"><div><dt>Tipo</dt><dd>{typeLabels[viewing.type]}</dd></div><div><dt>Teléfono</dt><dd>{viewing.phone ?? "—"}</dd></div><div><dt>Email</dt><dd>{viewing.email ?? "—"}</dd></div><div><dt>CUIT</dt><dd>{viewing.taxId ?? "—"}</dd></div><div><dt>Notas</dt><dd>{viewing.notes || "—"}</dd></div><div><dt>Gastos</dt><dd>{viewing._count.expenses === 1 ? "1 gasto" : `${viewing._count.expenses} gastos`}</dd></div></dl></div></FormModal>}
  </section>;
}
