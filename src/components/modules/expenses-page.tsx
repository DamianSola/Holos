"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Supplier = { id: string; name: string };
type Expense = { id: string; description: string; category: string | null; amountMinor: number; expenseDate: string; notes: string | null; supplier: Supplier | null };

export function ExpensesPage({ businessId }: { businessId: string }) {
  const [items, setItems] = useState<Expense[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [form, setForm] = useState({ description: "", category: "", amount: "", expenseDate: new Date().toISOString().slice(0, 10), supplierId: "", notes: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [expensesResponse, suppliersResponse] = await Promise.all([fetch(`/api/v1/businesses/${businessId}/expenses`, { cache: "no-store" }), fetch(`/api/v1/businesses/${businessId}/suppliers`, { cache: "no-store" })]);
    if (!expensesResponse.ok || !suppliersResponse.ok) { setError("No se pudieron cargar los gastos."); setLoading(false); return; }
    const [expenses, suppliersData] = await Promise.all([expensesResponse.json(), suppliersResponse.json()]);
    setItems(expenses.items); setSuppliers(suppliersData.items); setLoading(false);
  }
  useEffect(() => { void load(); }, [businessId]);
  const total = useMemo(() => items.reduce((sum, item) => sum + item.amountMinor, 0), [items]);
  function update(field: keyof typeof form, value: string) { setForm((current) => ({ ...current, [field]: value })); }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const response = await fetch(`/api/v1/businesses/${businessId}/expenses`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: form.description, category: form.category || undefined, amountMinor: Math.round(Number(form.amount) * 100), expenseDate: new Date(`${form.expenseDate}T12:00:00`).toISOString(), supplierId: form.supplierId || undefined, notes: form.notes || undefined }) });
    if (!response.ok) { setError("No se pudo registrar el gasto."); setSaving(false); return; }
    setForm((current) => ({ ...current, description: "", category: "", amount: "", supplierId: "", notes: "" })); setSaving(false); await load();
  }

  return <section className="module-page"><p className="eyebrow">Finance</p><h1>Gastos</h1><p className="module-description">Registrá compras, insumos, herramientas y otros costos asociados a este negocio.</p>
    <div className="customer-summary"><div className="summary-card"><span>Registros</span><strong>{items.length}</strong></div><div className="summary-card"><span>Total</span><strong>{formatMoney(total)}</strong></div><div className="summary-card"><span>Proveedores</span><strong>{suppliers.length}</strong></div></div>
    <form className="customer-form" onSubmit={save}><div className="customer-form-heading"><div><h2>Registrar gasto</h2><p>El importe se guarda en centavos para conservar precisión.</p></div></div><div className="customer-form-grid"><label>Descripción<input value={form.description} onChange={(event) => update("description", event.target.value)} required maxLength={180} /></label><label>Categoría<input value={form.category} onChange={(event) => update("category", event.target.value)} placeholder="Alquiler, combustible..." maxLength={120} /></label><label>Importe<input type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => update("amount", event.target.value)} required /></label><label>Fecha<input type="date" value={form.expenseDate} onChange={(event) => update("expenseDate", event.target.value)} required /></label><label>Proveedor<select value={form.supplierId} onChange={(event) => update("supplierId", event.target.value)}><option value="">Sin proveedor</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label><label className="customer-form-wide">Notas<textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} rows={2} maxLength={1000} /></label></div><button className="auth-submit" type="submit" disabled={saving}>{saving ? "Guardando..." : "Registrar gasto"}</button></form>
    {error && <p className="form-error" role="alert">{error}</p>}{loading ? <div className="module-state">Cargando...</div> : items.length ? <div className="customer-list">{items.map((expense) => <article className="customer-card" key={expense.id}><div className="customer-card-header"><div><strong>{expense.description}</strong><p>{new Date(expense.expenseDate).toLocaleDateString("es-AR")} · {expense.category ?? "Sin categoría"}</p></div><strong>{formatMoney(expense.amountMinor)}</strong></div><div className="customer-contact"><span>{expense.supplier?.name ?? "Sin proveedor"}</span>{expense.notes && <span>{expense.notes}</span>}</div></article>)}</div> : <div className="module-state">Todavía no hay gastos registrados.</div>}
  </section>;
}

function formatMoney(valueMinor: number) { return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(valueMinor / 100); }
