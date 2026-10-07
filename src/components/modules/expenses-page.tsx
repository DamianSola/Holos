"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ConfirmModal } from "@/components/forms/confirm-modal";
import { FormModal } from "@/components/forms/form-modal";
import { DateRangeFilter, datedListPath } from "@/components/forms/date-range-filter";
import { ListSearch, SearchMiss, matchesQuery } from "@/components/forms/list-search";

type Supplier = { id: string; name: string };
type Expense = { id: string; description: string; category: string | null; amountMinor: number; expenseDate: string; notes: string | null; supplier: Supplier | null };

export function ExpensesPage({ businessId }: { businessId: string }) {
  const [items, setItems] = useState<Expense[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [form, setForm] = useState({ description: "", category: "", amount: "", expenseDate: new Date().toISOString().slice(0, 10), supplierId: "", notes: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [expensesResponse, suppliersResponse] = await Promise.all([fetch(datedListPath(`/api/v1/businesses/${businessId}/expenses`, from, to), { cache: "no-store" }), fetch(`/api/v1/businesses/${businessId}/suppliers`, { cache: "no-store" })]);
    if (!expensesResponse.ok || !suppliersResponse.ok) { setError("No se pudieron cargar los gastos."); setLoading(false); return; }
    const [expenses, suppliersData] = await Promise.all([expensesResponse.json(), suppliersResponse.json()]);
    setItems(expenses.items); setSuppliers(suppliersData.items); setLoading(false);
  }
  useEffect(() => { void load(); }, [businessId, from, to]);
  const visible = useMemo(() => items.filter((item) => matchesQuery(query, item.description, item.category, item.notes, item.supplier?.name)), [items, query]);
  const visibleTotal = useMemo(() => visible.reduce((sum, item) => sum + item.amountMinor, 0), [visible]);
  const dated = Boolean(from && to);
  function update(field: keyof typeof form, value: string) { setForm((current) => ({ ...current, [field]: value })); }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const response = await fetch(`/api/v1/businesses/${businessId}/expenses`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: form.description, category: form.category || undefined, amountMinor: Math.round(Number(form.amount) * 100), expenseDate: new Date(`${form.expenseDate}T12:00:00`).toISOString(), supplierId: form.supplierId || undefined, notes: form.notes || undefined }) });
    if (!response.ok) { setError("No se pudo registrar el gasto."); setSaving(false); return; }
    setForm((current) => ({ ...current, description: "", category: "", amount: "", supplierId: "", notes: "" })); setFormOpen(false); setSaving(false); await load();
  }

  async function removeExpense(expenseId: string) {
    setPendingDeleteId(null);
    setError("");
    const response = await fetch(`/api/v1/businesses/${businessId}/expenses/${expenseId}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      setError(payload?.message ?? "No se pudo eliminar el gasto.");
      return;
    }
    setItems((current) => current.filter((item) => item.id !== expenseId));
  }

  return <section className="module-page"><p className="eyebrow">Finanzas</p><h1>Gastos</h1><p className="module-description">Registrá compras, insumos, herramientas y otros costos asociados a este negocio.</p>
    <div className="customer-summary"><div className="summary-card"><span>Registros</span><strong>{visible.length}</strong></div><div className="summary-card"><span>Total</span><strong>{formatMoney(visibleTotal)}</strong></div><div className="summary-card"><span>Proveedores</span><strong>{suppliers.length}</strong></div></div>
    <div className="customer-actions"><button className="auth-submit" type="button" onClick={() => { setError(""); setFormOpen(true); }}>Registrar gasto</button></div>
    {formOpen && <FormModal title="Registrar gasto" onClose={() => setFormOpen(false)}><form className="customer-form" onSubmit={save}><div className="customer-form-grid"><label>Descripción<input value={form.description} onChange={(event) => update("description", event.target.value)} required maxLength={180} /></label><label>Categoría<input value={form.category} onChange={(event) => update("category", event.target.value)} placeholder="Alquiler, combustible..." maxLength={120} /></label><label>Importe<input type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => update("amount", event.target.value)} required /></label><label>Fecha<input type="date" value={form.expenseDate} onChange={(event) => update("expenseDate", event.target.value)} required /></label><label>Proveedor<select value={form.supplierId} onChange={(event) => update("supplierId", event.target.value)}><option value="">Sin proveedor</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label><label className="customer-form-wide">Notas<textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} rows={2} maxLength={1000} /></label></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="auth-submit" type="submit" disabled={saving}>{saving ? "Guardando..." : "Registrar gasto"}</button></form></FormModal>}
    {error && <p className="form-error" role="alert">{error}</p>}<DateRangeFilter from={from} to={to} onChange={(nextFrom, nextTo) => { setFrom(nextFrom); setTo(nextTo); }} /><p className="list-total"><span>Total</span><strong>{formatMoney(visibleTotal)}</strong></p>{(items.length > 0 || query) && <ListSearch value={query} onChange={setQuery} placeholder="Descripción, categoría o proveedor" />}{loading ? <div className="module-state">Cargando...</div> : items.length === 0 ? <div className="module-state">{dated ? "No hay gastos en esas fechas." : "Todavía no hay gastos registrados."}</div> : visible.length ? <div className="customer-list">{visible.map((expense) => <article className="customer-card" key={expense.id}><div className="customer-card-header"><div><strong>{expense.description}</strong><p>{new Date(expense.expenseDate).toLocaleDateString("es-AR")} · {expense.category ?? "Sin categoría"}</p></div><strong>{formatMoney(expense.amountMinor)}</strong></div><div className="customer-contact"><span>{expense.supplier?.name ?? "Sin proveedor"}</span>{expense.notes && <span>{expense.notes}</span>}</div><div className="customer-actions"><button className="text-button" type="button" onClick={() => setPendingDeleteId(expense.id)}>Eliminar</button></div></article>)}</div> : <SearchMiss query={query} />}
    {pendingDeleteId && <ConfirmModal title="Eliminar gasto" message="¿Eliminar este gasto? Deja de sumar en el total." onCancel={() => setPendingDeleteId(null)} onAccept={() => void removeExpense(pendingDeleteId)} />}
  </section>;
}

function formatMoney(valueMinor: number) { return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(valueMinor / 100); }
