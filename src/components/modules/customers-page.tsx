"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ConfirmModal } from "@/components/forms/confirm-modal";
import { FormModal } from "@/components/forms/form-modal";
import { ListSearch, SearchMiss, matchesQuery } from "@/components/forms/list-search";
import { WhatsappLink } from "@/components/whatsapp-link";

type Customer = { id: string; name: string; email: string | null; phone: string | null; notes: string | null; saleCount: number };

type CustomerForm = { name: string; email: string; phone: string; notes: string };

const emptyForm: CustomerForm = { name: "", email: "", phone: "", notes: "" };

export function CustomersPage({ businessId }: { businessId: string }) {
  const [items, setItems] = useState<Customer[]>([]);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Customer | null>(null);

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
  const visible = useMemo(() => items.filter((customer) => matchesQuery(query, customer.name, customer.email, customer.phone, customer.notes)), [items, query]);

  function updateForm(field: keyof CustomerForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(false);
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setFormOpen(true);
  }

  function startEditing(customer: Customer) {
    setEditingId(customer.id);
    setForm({ name: customer.name, email: customer.email ?? "", phone: customer.phone ?? "", notes: customer.notes ?? "" });
    setError("");
    setFormOpen(true);
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
    setPendingDeleteId(null);
    const response = await fetch(`/api/v1/businesses/${businessId}/customers/${customerId}`, { method: "DELETE" });
    if (!response.ok) { setError("No se pudo eliminar el cliente."); return; }
    if (editingId === customerId) resetForm();
    await load();
  }

  return <ModuleLayout eyebrow="Relación" title="Clientes">
    <div className="customer-summary"><div className="summary-card"><span>Total</span><strong>{stats.total}</strong></div><div className="summary-card"><span>Con email</span><strong>{stats.withEmail}</strong></div><div className="summary-card"><span>Con teléfono</span><strong>{stats.withPhone}</strong></div></div>
    <div className="customer-actions"><button className="auth-submit" type="button" onClick={openCreate}>Nuevo cliente</button></div>
    {formOpen && <FormModal title={editingId ? "Editar cliente" : "Nuevo cliente"} onClose={resetForm}><form className="customer-form" onSubmit={saveCustomer}><div className="customer-form-grid"><label>Nombre<input value={form.name} onChange={(event) => updateForm("name", event.target.value)} required maxLength={160} /></label><label>Email<input type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} placeholder="cliente@ejemplo.com" /></label><label>Teléfono<input value={form.phone} onChange={(event) => updateForm("phone", event.target.value)} placeholder="+54 ..." maxLength={40} /></label><label className="customer-form-wide">Notas<textarea value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} rows={3} maxLength={1000} /></label></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="auth-submit" type="submit" disabled={saving}>{saving ? "Guardando..." : editingId ? "Guardar cliente" : "Agregar cliente"}</button></form></FormModal>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {items.length > 0 && <ListSearch value={query} onChange={setQuery} placeholder="Nombre, teléfono o email" />}
    {loading ? <LoadingState /> : items.length === 0 ? <EmptyState text="Todavía no hay clientes." /> : visible.length ? <div className="record-scroll"><div className="record-list customers">{visible.map((customer) => <article className="record-row customers" key={customer.id}><strong>{customer.name}</strong><span>{customer.phone ?? "—"}</span><span>{customer.email ?? "—"}</span><span>{customer.saleCount === 1 ? "1 venta" : `${customer.saleCount} ventas`}</span><button className="secondary-button" type="button" onClick={() => setViewing(customer)}>Ver</button><button className="secondary-button" type="button" onClick={() => startEditing(customer)}>Editar</button><button className="text-button" type="button" onClick={() => setPendingDeleteId(customer.id)}>Eliminar</button></article>)}</div></div> : <SearchMiss query={query} />}
    {viewing && <FormModal title={viewing.name} onClose={() => setViewing(null)}><div className="record-detail"><dl className="record-fields"><div><dt>Teléfono</dt><dd>{viewing.phone ?? "—"}</dd></div><div><dt>Email</dt><dd>{viewing.email ?? "—"}</dd></div><div><dt>Notas</dt><dd>{viewing.notes || "—"}</dd></div><div><dt>Ventas</dt><dd>{viewing.saleCount === 1 ? "1 venta" : `${viewing.saleCount} ventas`}</dd></div></dl><div className="customer-actions"><WhatsappLink phone={viewing.phone} /><button className="secondary-button" type="button" onClick={() => { const customer = viewing; setViewing(null); startEditing(customer); }}>Editar</button></div></div></FormModal>}
    {pendingDeleteId && <ConfirmModal title="Eliminar cliente" message="¿Desea eliminar este cliente? Se ocultará del negocio." onCancel={() => setPendingDeleteId(null)} onAccept={() => void deleteCustomer(pendingDeleteId)} />}
  </ModuleLayout>;
}

export function ModuleLayout({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) { return <section className="module-page"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{children}</section>; }
function LoadingState() { return <div className="module-state">Cargando...</div>; }
function EmptyState({ text }: { text: string }) { return <div className="module-state">{text}</div>; }