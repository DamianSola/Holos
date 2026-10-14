"use client";

import { FormEvent, useEffect, useState } from "react";
import { PlusIcon } from "@/components/brand/nav-icons";
import { ConfirmModal } from "@/components/forms/confirm-modal";
import { DownloadList } from "@/components/forms/download-list";
import { FormModal } from "@/components/forms/form-modal";
import { ModuleLayout } from "@/components/modules/customers-page";
import { shortageQuantity } from "@/lib/shopping-lines";

type Member = { id: string; name: string | null; email: string };
type ListItem = { id: string; text: string; quantity: number | null; position: number };
type WorkList = {
  id: string;
  title: string;
  status: "OPEN" | "DONE";
  assignee: Member | null;
  items: ListItem[];
};
type DraftLine = { text: string; quantity: string };
type Product = { name: string; stock: number; minimumStock: number; status: string };

const columns = [{ label: "Cant.", weight: 0.7 }, { label: "Ítem", weight: 3 }];

function blankLine(): DraftLine {
  return { text: "", quantity: "" };
}

function defaultTitle() {
  const label = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date()).replace(".", "");
  return `Compras · ${label}`;
}

function personName(member: Member | null) {
  if (!member) return "";
  return member.name?.trim() || member.email;
}

function linesOf(list: WorkList) {
  return list.items.map((item) => [item.quantity ? String(item.quantity) : "", item.text]);
}

export function ListsPage({ businessId }: { businessId: string }) {
  const [lists, setLists] = useState<WorkList[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  async function load() {
    const [listsResponse, teamResponse] = await Promise.all([
      fetch(`/api/v1/businesses/${businessId}/lists`),
      fetch(`/api/v1/businesses/${businessId}/memberships`),
    ]);
    if (!listsResponse.ok) {
      setError("No se pudieron cargar las listas.");
      setLoading(false);
      return;
    }
    const listsBody = await listsResponse.json() as { items: WorkList[] };
    const teamBody = teamResponse.ok ? await teamResponse.json() as { memberships: Array<{ user: Member }> } : { memberships: [] };
    setLists(listsBody.items);
    setMembers(teamBody.memberships.map((membership) => membership.user));
    setLoading(false);
  }

  useEffect(() => { void load(); }, [businessId]);

  function openCreate() {
    setError("");
    setNote("");
    setEditingId(null);
    setTitle(defaultTitle());
    setAssigneeId("");
    setLines([blankLine()]);
    setFormOpen(true);
  }

  function openEdit(list: WorkList) {
    setError("");
    setNote("");
    setEditingId(list.id);
    setTitle(list.title);
    setAssigneeId(list.assignee?.id ?? "");
    setLines(list.items.length ? list.items.map((item) => ({ text: item.text, quantity: item.quantity ? String(item.quantity) : "" })) : [blankLine()]);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setError("");
    setNote("");
  }

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));
  }

  function payloadItems() {
    return lines
      .map((line) => ({ text: line.text.trim(), quantity: line.quantity.trim() ? Number(line.quantity) : null }))
      .filter((line) => line.text.length > 0)
      .map((line) => ({ text: line.text, quantity: line.quantity && Number.isFinite(line.quantity) && line.quantity > 0 ? Math.round(line.quantity) : null }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const items = payloadItems();
    if (!title.trim() || items.length === 0) {
      setError("Escribí un título y al menos un ítem.");
      return;
    }
    setSaving(true);
    setError("");
    const body = { title: title.trim(), assigneeId: assigneeId || null, items };
    const response = await fetch(editingId ? `/api/v1/businesses/${businessId}/lists/${editingId}` : `/api/v1/businesses/${businessId}/lists`, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      setError(payload?.message ?? "No se pudo guardar la lista.");
      return;
    }
    closeForm();
    await load();
  }

  async function setStatus(list: WorkList, status: "OPEN" | "DONE") {
    setError("");
    const response = await fetch(`/api/v1/businesses/${businessId}/lists/${list.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      setError("No se pudo actualizar la lista.");
      return;
    }
    if (editingId === list.id) closeForm();
    await load();
  }

  async function remove(listId: string) {
    setPendingDeleteId(null);
    const response = await fetch(`/api/v1/businesses/${businessId}/lists/${listId}`, { method: "DELETE" });
    if (!response.ok) {
      setError("No se pudo eliminar la lista.");
      return;
    }
    if (editingId === listId) closeForm();
    await load();
  }

  async function bringShortages() {
    setNote("");
    setError("");
    const response = await fetch(`/api/v1/businesses/${businessId}/products`);
    if (!response.ok) {
      setError("No se pudo leer el stock.");
      return;
    }
    const body = await response.json() as { items: Product[] };
    const existing = new Set(lines.map((line) => line.text.trim().toLocaleLowerCase("es")).filter(Boolean));
    const additions = body.items.flatMap((product) => {
      if (product.status !== "ACTIVE") return [];
      const quantity = shortageQuantity(product.stock, product.minimumStock);
      if (quantity < 1 || existing.has(product.name.trim().toLocaleLowerCase("es"))) return [];
      existing.add(product.name.trim().toLocaleLowerCase("es"));
      return [{ text: product.name, quantity: String(quantity) }];
    });
    if (additions.length === 0) {
      setNote("No hay productos bajo el mínimo.");
      return;
    }
    setLines((current) => [...current.filter((line) => line.text.trim() || line.quantity.trim()), ...additions]);
  }

  const editing = lists.find((list) => list.id === editingId) ?? null;

  return (
    <ModuleLayout eyebrow="Operación" title="Listas">
      <div className="customer-actions">
        <button className="auth-submit" type="button" onClick={openCreate}><PlusIcon />Nueva lista</button>
      </div>
      {error && !formOpen && <p className="form-error" role="alert">{error}</p>}
      {loading ? <div className="module-state">Cargando...</div> : lists.length === 0 ? <div className="module-state">Todavía no hay listas. Armá una de compras y descargala para quien va a hacerla.</div> : (
        <div className="record-scroll"><div className="record-list work-lists">
          {lists.map((list) => (
            <article className="record-row work-lists" key={list.id}>
              <strong className="record-who">{list.title}</strong>
              <span className="record-meta">
                <span>{list.assignee ? `Para ${personName(list.assignee)}` : "Sin asignar"}</span>
                <span>{list.items.length === 1 ? "1 ítem" : `${list.items.length} ítems`}</span>
                <span>{list.status === "DONE" ? "Hecha" : "Abierta"}</span>
              </span>
              <span className="record-actions">
                <DownloadList choices={[{ label: "PDF", title: list.title, subtitle: list.assignee ? `Para ${personName(list.assignee)}` : undefined, columns, rows: linesOf(list), checkbox: true }]} />
                <button className="secondary-button record-view" type="button" onClick={() => openEdit(list)}>Ver</button>
              </span>
            </article>
          ))}
        </div></div>
      )}
      {formOpen && (
        <FormModal title={editingId ? "Editar lista" : "Nueva lista"} onClose={closeForm}>
          <form className="customer-form" onSubmit={(event) => void save(event)}>
            <div className="customer-form-grid">
              <label className="customer-form-wide">Título<input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={160} /></label>
              <label className="customer-form-wide">Para
                <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
                  <option value="">Sin asignar</option>
                  {members.map((member) => <option key={member.id} value={member.id}>{personName(member)}</option>)}
                </select>
              </label>
            </div>
            <div className="list-lines">
              {lines.map((line, index) => (
                <div className="list-line" key={index}>
                  <input aria-label={`Cantidad ${index + 1}`} inputMode="numeric" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value.replace(/[^\d]/g, "") })} placeholder="Cant." />
                  <input
                    aria-label={`Ítem ${index + 1}`}
                    value={line.text}
                    maxLength={200}
                    placeholder="Qué hay que comprar"
                    onChange={(event) => updateLine(index, { text: event.target.value })}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      setLines((current) => {
                        const next = [...current];
                        next.splice(index + 1, 0, blankLine());
                        return next;
                      });
                    }}
                  />
                  <button className="text-button" type="button" onClick={() => setLines((current) => current.length === 1 ? [blankLine()] : current.filter((_, lineIndex) => lineIndex !== index))}>Quitar</button>
                </div>
              ))}
            </div>
            <div className="customer-actions">
              <button className="secondary-button" type="button" onClick={() => setLines((current) => [...current, blankLine()])}>Agregar renglón</button>
              <button className="secondary-button" type="button" onClick={() => void bringShortages()}>Traer lo que falta</button>
            </div>
            {note && <p className="form-success" role="status">{note}</p>}
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar lista"}</button>
            {editing && (
              <div className="customer-actions">
                <button className="secondary-button" type="button" onClick={() => void setStatus(editing, editing.status === "DONE" ? "OPEN" : "DONE")}>{editing.status === "DONE" ? "Reabrir" : "Marcar hecha"}</button>
                <button className="text-button" type="button" onClick={() => setPendingDeleteId(editing.id)}>Eliminar</button>
              </div>
            )}
          </form>
        </FormModal>
      )}
      {pendingDeleteId && <ConfirmModal title="Eliminar lista" message="¿Eliminar esta lista? El PDF que ya descargaron sigue igual." onCancel={() => setPendingDeleteId(null)} onAccept={() => void remove(pendingDeleteId)} />}
    </ModuleLayout>
  );
}
