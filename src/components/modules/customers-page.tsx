"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Customer = { id: string; name: string; email: string | null; phone: string | null; notes: string | null; sales: Array<{ id: string; totalMinor: number; status: "DRAFT" | "CONFIRMED" | "CANCELLED" }> };

type CustomerForm = { name: string; email: string; phone: string; notes: string };

const emptyForm: CustomerForm = { name: "", email: "", phone: "", notes: "" };

export function CustomersPage({ businessId }: { businessId: string }) {
  const [items, setItems] = useState<Customer[]>([]);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const response = await fetch(`/api/v1/businesses/${businessId}/customers`, { cache: "no-store" });
    if (!response.ok) { setError("No se pudieron cargar los clientes."); setLoading(false); return; }
    const data = await response.json();
    setItems(data.items);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    async function loadInitialData() {
      const response = await fetch(`/api/v1/businesses/${businessId}/customers`, { cache: "no-store" });
      if (cancelled) return;
      if (!response.ok) { setError("No se pudieron cargar los clientes."); setLoading(false); return; }
      setItems((await response.json()).items);
      setLoading(false);
    }
    void loadInitialData();
    return () => { cancelled = true; };
  }, [businessId]);

  const stats = useMemo(() => ({ total: items.length, withEmail: items.filter((customer) => customer.email).length, withPhone: items.filter((customer) => customer.phone).length }), [items]);

  function updateForm(field: keyof CustomerForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function startEditing(customer: Customer) {
    setEditingId(customer.id);
    setForm({ name: customer.name, email: customer.email ?? "", phone: customer.phone ?? "", notes: customer.notes ?? "" });
    setError("");
  }

  async function saveCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError("");
    const body = { name: form.name, email: form.email || undefined, phone: form.phone || undefined, notes: form.notes || undefined };
    const response = await fetch(editingId ? `/api/v1/businesses/${businessId}/customers/${editingId}` : `/api/v1/businesses/${businessId}/customers`, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) { setError(editingId ? "No se pudo actualizar el cliente." : "No se pudo crear el cliente."); setSaving(false); return; }
    resetForm(); setSaving(false); await load();
  }

  async function deleteCustomer(customerId: string) {
    if (!window.confirm("¿Desea eliminar este cliente? Se ocultará del negocio.")) return;
    const response = await fetch(`/api/v1/businesses/${businessId}/customers/${customerId}`, { method: "DELETE" });
    if (!response.ok) { setError("No se pudo eliminar el cliente."); return; }
    if (editingId === customerId) resetForm();
    await load();
  }

  return <ModuleLayout eyebrow="People" title="Customers" description="Guardá clientes, sus datos de contacto y todo el historial de relación comercial.">
    <div className="customer-summary"><div className="summary-card"><span>Total</span><strong>{stats.total}</strong></div><div className="summary-card"><span>Con email</span><strong>{stats.withEmail}</strong></div><div className="summary-card"><span>Con teléfono</span><strong>{stats.withPhone}</strong></div></div>
    <form className="customer-form" onSubmit={saveCustomer}><div className="customer-form-heading"><div><h2>{editingId ? "Editar cliente" : "Nuevo cliente"}</h2><p>{editingId ? "Actualizá los datos del perfil." : "Agregá un cliente al negocio."}</p></div>{editingId && <button className="secondary-button" type="button" onClick={resetForm}>Cancelar</button>}</div><div className="customer-form-grid"><label>Nombre<input value={form.name} onChange={(event) => updateForm("name", event.target.value)} required maxLength={160} /></label><label>Email<input type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} placeholder="cliente@ejemplo.com" /></label><label>Teléfono<input value={form.phone} onChange={(event) => updateForm("phone", event.target.value)} placeholder="+54 ..." maxLength={40} /></label><label className="customer-form-wide">Notas<textarea value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} rows={3} maxLength={1000} /></label></div><button className="auth-submit" type="submit" disabled={saving}>{saving ? "Guardando..." : editingId ? "Guardar cliente" : "Agregar cliente"}</button></form>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading ? <LoadingState /> : items.length ? <div className="customer-list">{items.map((customer) => <article className="customer-card" key={customer.id}><div className="customer-card-header"><div><strong>{customer.name}</strong>{customer.notes && <p>{customer.notes}</p>}</div><div className="customer-pill-row"><span className="customer-pill">{customer.sales.length} ventas</span></div></div><div className="customer-contact"><span>{customer.email ?? "Sin email"}</span><span>{customer.phone ?? "Sin teléfono"}</span></div><div className="customer-actions"><button className="secondary-button" type="button" onClick={() => startEditing(customer)}>Editar</button><button className="text-button" type="button" onClick={() => void deleteCustomer(customer.id)}>Eliminar</button></div></article>)}</div> : <EmptyState text="Todavía no hay clientes." />}
  </ModuleLayout>;
}

export function ModuleLayout({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) { return <section className="module-page"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="module-description">{description}</p>{children}</section>; }
function LoadingState() { return <div className="module-state">Cargando...</div>; }
function EmptyState({ text }: { text: string }) { return <div className="module-state">{text}</div>; }