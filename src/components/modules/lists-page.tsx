"use client";

import { FormEvent, useEffect, useState } from "react";
import { PlusIcon } from "@/components/brand/nav-icons";
import { IconAction } from "@/components/forms/icon-action";
import { ConfirmModal } from "@/components/forms/confirm-modal";
import { DownloadList } from "@/components/forms/download-list";
import { FormModal } from "@/components/forms/form-modal";
import { ModuleLayout } from "@/components/modules/customers-page";
import { shortageQuantity } from "@/lib/shopping-lines";

type Member = { id: string; name: string | null; email: string };
type ListItem = { id: string; text: string; cells: string[]; checked: boolean; position: number };
type WorkList = {
  id: string;
  title: string;
  status: "OPEN" | "DONE";
  heading: string;
  columns: string[];
  withChecks: boolean;
  assignee: Member | null;
  items: ListItem[];
};
type DraftLine = { text: string; cells: string[]; checked: boolean };
type Product = { name: string; stock: number; minimumStock: number; status: string };

const MAX_COLUMNS = 10;

function blankLine(columnCount: number): DraftLine {
  return { text: "", cells: Array.from({ length: columnCount }, () => ""), checked: false };
}

function defaultTitle() {
  const label = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date()).replace(".", "");
  return `Lista · ${label}`;
}

function personName(member: Member | null) {
  if (!member) return "";
  return member.name?.trim() || member.email;
}

function pdfColumns(heading: string, columns: string[]) {
  return [{ label: heading, weight: 3 }, ...columns.map((label) => ({ label, weight: 1.2 }))];
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
  const [heading, setHeading] = useState("Descripción");
  const [columns, setColumns] = useState<string[]>([]);
  const [withChecks, setWithChecks] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>([blankLine(0)]);
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
    setHeading("Descripción");
    setColumns([]);
    setWithChecks(false);
    setLines([blankLine(0)]);
    setFormOpen(true);
  }

  function openEdit(list: WorkList) {
    setError("");
    setNote("");
    setEditingId(list.id);
    setTitle(list.title);
    setAssigneeId(list.assignee?.id ?? "");
    setHeading(list.heading || "Descripción");
    setColumns(list.columns);
    setWithChecks(list.withChecks);
    setLines(list.items.length ? list.items.map((item) => ({ text: item.text, cells: list.columns.map((_, index) => item.cells[index] ?? ""), checked: item.checked })) : [blankLine(list.columns.length)]);
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

  function addColumn() {
    if (columns.length >= MAX_COLUMNS) return;
    setColumns((current) => [...current, ""]);
    setLines((current) => current.map((line) => ({ ...line, cells: [...line.cells, ""] })));
  }

  function renameColumn(index: number, name: string) {
    setColumns((current) => current.map((column, columnIndex) => columnIndex === index ? name : column));
  }

  function removeColumn(index: number) {
    setColumns((current) => current.filter((_, columnIndex) => columnIndex !== index));
    setLines((current) => current.map((line) => ({ ...line, cells: line.cells.filter((_, cellIndex) => cellIndex !== index) })));
  }

  function payloadItems() {
    return lines
      .map((line) => ({ text: line.text.trim(), cells: line.cells.map((cell) => cell.trim()), checked: withChecks && line.checked }))
      .filter((line) => line.text.length > 0);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const first = heading.trim();
    const named = columns.map((column) => column.trim());
    if (!first || named.some((column) => column.length === 0)) {
      setError("Poné el nombre de cada columna.");
      return;
    }
    const items = payloadItems();
    if (!title.trim() || items.length === 0) {
      setError("Escribí un título y al menos una descripción.");
      return;
    }
    setSaving(true);
    setError("");
    const body = { title: title.trim(), assigneeId: assigneeId || null, heading: first, columns: named, withChecks, items };
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
      const cells = columns.map((_, index) => index === 0 ? String(quantity) : "");
      return [{ text: product.name, cells, checked: false }];
    });
    if (additions.length === 0) {
      setNote("No hay productos bajo el mínimo.");
      return;
    }
    setLines((current) => [...current.filter((line) => line.text.trim() || line.cells.some((cell) => cell.trim())), ...additions]);
  }

  const editing = lists.find((list) => list.id === editingId) ?? null;

  return (
    <ModuleLayout eyebrow="Operación" title="Listas">
      <div className="customer-actions">
        <button className="auth-submit" type="button" onClick={openCreate}><PlusIcon />Nueva lista</button>
      </div>
      {error && !formOpen && <p className="form-error" role="alert">{error}</p>}
      {loading ? <div className="module-state">Cargando...</div> : lists.length === 0 ? <div className="module-state">Todavía no hay listas.</div> : (
        <div className="list-board">
          {lists.map((list) => {
            const detail = [
              list.assignee ? `Para ${personName(list.assignee)}` : "Sin asignar",
              list.items.length === 1 ? "1 ítem" : `${list.items.length} ítems`,
              list.status === "DONE" ? "Hecha" : "Abierta",
            ].join(" · ");
            return (
              <article className="list-card" key={list.id}>
                <div>
                  <strong>{list.title}</strong>
                  <p>{detail}</p>
                </div>
                <div className="list-card-actions">
                  <DownloadList choices={[{
                    label: "PDF",
                    title: list.title,
                    subtitle: list.assignee ? `Para ${personName(list.assignee)}` : undefined,
                    columns: pdfColumns(list.heading || "Descripción", list.columns),
                    rows: list.items.map((item) => [item.text, ...list.columns.map((_, index) => item.cells[index] ?? "")]),
                    checkbox: list.withChecks,
                    marks: list.withChecks ? list.items.map((item) => item.checked) : undefined,
                  }]} />
                  <IconAction label="Ver" icon="view" onClick={() => openEdit(list)} />
                </div>
              </article>
            );
          })}
        </div>
      )}
      {formOpen && (
        <FormModal wide title={editingId ? "Editar lista" : "Nueva lista"} onClose={closeForm}>
          <form className="customer-form list-form" onSubmit={(event) => void save(event)}>
            <div className="list-form-fields">
              <label>Título<input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={160} /></label>
              <label>Para
                <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
                  <option value="">Sin asignar</option>
                  {members.map((member) => <option key={member.id} value={member.id}>{personName(member)}</option>)}
                </select>
              </label>
            </div>
            <div className="list-columns">
              <span className="list-column-chip">
                <input aria-label="Nombre de la primera columna" value={heading} maxLength={40} placeholder="Descripción" onChange={(event) => setHeading(event.target.value)} />
              </span>
              {columns.map((column, index) => (
                <span className="list-column-chip" key={index}>
                  <input aria-label={`Nombre de la columna ${index + 2}`} value={column} maxLength={40} placeholder="Nombre" onChange={(event) => renameColumn(index, event.target.value)} />
                  <button className="list-x" type="button" aria-label={`Quitar columna ${index + 2}`} onClick={() => removeColumn(index)}>
                    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  </button>
                </span>
              ))}
              <IconAction label="Columna" icon="add" onClick={addColumn} disabled={columns.length >= MAX_COLUMNS} />
              <label className="auth-check list-check"><input type="checkbox" checked={withChecks} onChange={(event) => setWithChecks(event.target.checked)} /><span>Casilla para tildar</span></label>
            </div>
            <div className="list-lines">
              {lines.map((line, index) => (
                <div className="list-line" key={index}>
                  {withChecks && <input aria-label={`Tildar renglón ${index + 1}`} type="checkbox" checked={line.checked} onChange={(event) => updateLine(index, { checked: event.target.checked })} />}
                  <input
                    className="list-desc"
                    aria-label={`${heading.trim() || "Descripción"} ${index + 1}`}
                    value={line.text}
                    maxLength={200}
                    placeholder={heading.trim() || "Descripción"}
                    onChange={(event) => updateLine(index, { text: event.target.value })}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      setLines((current) => {
                        const next = [...current];
                        next.splice(index + 1, 0, blankLine(columns.length));
                        return next;
                      });
                    }}
                  />
                  {columns.map((column, cellIndex) => (
                    <input
                      className="list-cell"
                      key={cellIndex}
                      aria-label={`${column.trim() || `Columna ${cellIndex + 2}`} ${index + 1}`}
                      value={line.cells[cellIndex] ?? ""}
                      maxLength={120}
                      placeholder={column.trim() || "—"}
                      onChange={(event) => {
                        const cells = line.cells.map((cell, currentIndex) => currentIndex === cellIndex ? event.target.value : cell);
                        updateLine(index, { cells });
                      }}
                    />
                  ))}
                  <button className="list-x" type="button" aria-label={`Quitar renglón ${index + 1}`} onClick={() => setLines((current) => current.length === 1 ? [blankLine(columns.length)] : current.filter((_, lineIndex) => lineIndex !== index))}>
                    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  </button>
                </div>
              ))}
            </div>
            <div className="list-form-links">
              <IconAction label="Renglón" icon="add" onClick={() => setLines((current) => [...current, blankLine(columns.length)])} />
              <button className="text-button" type="button" onClick={() => void bringShortages()}>Traer lo que falta</button>
            </div>
            {note && <p className="form-success" role="status">{note}</p>}
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="list-form-footer">
              <button className="auth-submit" type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
              {editing && (
                <>
                  <IconAction label={editing.status === "DONE" ? "Reabrir" : "Marcar hecha"} icon={editing.status === "DONE" ? "reopen" : "check"} onClick={() => void setStatus(editing, editing.status === "DONE" ? "OPEN" : "DONE")} />
                  <IconAction label="Eliminar" icon="delete" onClick={() => setPendingDeleteId(editing.id)} />
                </>
              )}
            </div>
          </form>
        </FormModal>
      )}
      {pendingDeleteId && <ConfirmModal title="Eliminar lista" message="¿Eliminar esta lista? El PDF que ya descargaron sigue igual." onCancel={() => setPendingDeleteId(null)} onAccept={() => void remove(pendingDeleteId)} />}
    </ModuleLayout>
  );
}
