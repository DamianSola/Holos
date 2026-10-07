"use client";

import { FormEvent, useEffect, useState } from "react";
import { FormModal } from "@/components/forms/form-modal";

type Member = { id: string; name: string | null; email: string };
type TaskItem = { id: string; text: string; done: boolean };
type Task = {
  id: string;
  title: string;
  description: string | null;
  status: "OPEN" | "DONE" | "ARCHIVED";
  dueDate: string | null;
  createdAt?: string;
  assignee: Member;
  items?: TaskItem[];
};

const itemLimit = 50;
const emptyForm = { title: "", description: "", assigneeId: "", dueDate: "", itemText: "" };

function sortTasks(items: Task[]) {
  return [...items].sort((left, right) => {
    if (left.status !== right.status) return left.status < right.status ? -1 : 1;
    return (right.createdAt ?? "").localeCompare(left.createdAt ?? "");
  });
}

export function TasksPanel({ businessId, members }: { businessId: string; members: Member[] }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [draftItems, setDraftItems] = useState<string[]>([]);
  const [itemDrafts, setItemDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  async function load() {
    const response = await fetch(`/api/v1/businesses/${businessId}/tasks`, { cache: "no-store" });
    if (!response.ok) { setError("No se pudieron cargar las tareas."); setLoading(false); return; }
    setTasks(sortTasks((await response.json()).items));
    setLoading(false);
  }

  useEffect(() => { void load(); }, [businessId]);

  function closeForm() {
    setFormOpen(false);
    setForm(emptyForm);
    setDraftItems([]);
    setFormError("");
  }

  function addDraftItem() {
    const text = form.itemText.trim();
    if (!text) return;
    if (draftItems.length >= itemLimit) { setFormError("Se pueden cargar hasta 50 ítems."); return; }
    setDraftItems((current) => [...current, text]);
    setForm((current) => ({ ...current, itemText: "" }));
    setFormError("");
  }

  function replaceTask(updated: Task) {
    setTasks((current) => sortTasks(current.map((task) => task.id === updated.id ? updated : task)));
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    const pending = form.itemText.trim();
    const items = pending ? [...draftItems, pending] : draftItems;
    if (items.length > itemLimit) { setFormError("Se pueden cargar hasta 50 ítems."); setSaving(false); return; }
    const response = await fetch(`/api/v1/businesses/${businessId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        description: form.description || undefined,
        assigneeId: form.assigneeId || undefined,
        dueDate: form.dueDate ? new Date(`${form.dueDate}T12:00:00`).toISOString() : undefined,
        items: items.length ? items : undefined,
      }),
    });
    if (!response.ok) { setFormError("No se pudo crear la tarea."); setSaving(false); return; }
    setSaving(false);
    closeForm();
    await load();
  }

  async function updateTask(taskId: string, status: "OPEN" | "DONE") {
    setError("");
    const response = await fetch(`/api/v1/businesses/${businessId}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) { setError("No se pudo actualizar la tarea."); return; }
    replaceTask(await response.json());
  }

  async function addItem(taskId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = (itemDrafts[taskId] ?? "").trim();
    if (!text) return;
    setError("");
    const response = await fetch(`/api/v1/businesses/${businessId}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addItem: text }),
    });
    if (!response.ok) { setError("No se pudo agregar el ítem."); return; }
    setItemDrafts((current) => ({ ...current, [taskId]: "" }));
    replaceTask(await response.json());
  }

  async function toggleItem(taskId: string, itemId: string, done: boolean) {
    setError("");
    setTasks((current) => current.map((task) => {
      if (task.id !== taskId) return task;
      const items = (task.items ?? []).map((item) => item.id === itemId ? { ...item, done } : item);
      const status = items.length > 0 && items.every((item) => item.done) ? "DONE" : items.length > 0 ? "OPEN" : task.status;
      return { ...task, items, status };
    }));
    const response = await fetch(`/api/v1/businesses/${businessId}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, done }),
    });
    if (!response.ok) { setError("No se pudo actualizar el ítem."); await load(); return; }
    replaceTask(await response.json());
  }

  const pendingCount = tasks.filter((task) => task.status === "OPEN").length;

  return (
    <section className="panel tasks-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Colaboración</p>
          <h2>Tareas y mensajes</h2>
        </div>
        <div className="task-heading-actions">
          <span className="panel-count">{pendingCount} pendientes</span>
          <button className="auth-submit task-new" type="button" onClick={() => { setError(""); setFormOpen(true); }}>Nueva tarea</button>
        </div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading ? <div className="module-state">Cargando tareas...</div> : tasks.length ? (
        <div className="task-list">
          {tasks.map((task) => {
            const items = task.items ?? [];
            const doneCount = items.filter((item) => item.done).length;
            return (
              <article className={task.status === "DONE" ? "task-card is-done" : "task-card"} key={task.id}>
                <div className="task-card-top">
                  <h3>{task.title}</h3>
                  <span className={task.status === "DONE" ? "task-pill is-done" : "task-pill"}>{task.status === "DONE" ? "Hecha" : "Pendiente"}</span>
                </div>
                <p className="task-meta">{task.description ?? "Sin mensaje"} · Para: {task.assignee.name ?? task.assignee.email}{task.dueDate ? ` · vence ${new Date(task.dueDate).toLocaleDateString("es-AR")}` : ""}</p>
                {items.length > 0 && (
                  <>
                    <div className="task-meter" aria-hidden="true"><span style={{ width: `${Math.round((doneCount / items.length) * 100)}%` }} /></div>
                    <p className="task-progress">{doneCount} de {items.length} cumplidos</p>
                    <ul className="task-checks">
                      {items.map((item) => (
                        <li key={item.id}>
                          <label className={item.done ? "task-check is-done" : "task-check"}>
                            <input type="checkbox" checked={item.done} onChange={(event) => void toggleItem(task.id, item.id, event.target.checked)} />
                            <span className="task-check-box" aria-hidden="true" />
                            <span>{item.text}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {task.status === "OPEN" && (
                  <form className="task-item-add" onSubmit={(event) => void addItem(task.id, event)}>
                    <input aria-label={`Nuevo ítem de ${task.title}`} value={itemDrafts[task.id] ?? ""} onChange={(event) => setItemDrafts((current) => ({ ...current, [task.id]: event.target.value }))} placeholder="Agregar un ítem" maxLength={160} />
                    <button className="secondary-button" type="submit">Agregar</button>
                  </form>
                )}
                {items.length === 0 && (
                  <div className="task-card-actions">
                    <button className="secondary-button" type="button" onClick={() => void updateTask(task.id, task.status === "DONE" ? "OPEN" : "DONE")}>{task.status === "DONE" ? "Reabrir" : "Completar"}</button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : <div className="empty-state"><p>No hay tareas. Creá la primera.</p></div>}
      {formOpen && (
        <FormModal title="Nueva tarea" onClose={closeForm}>
          <form className="customer-form task-create" onSubmit={createTask}>
            <div className="customer-form-grid">
              <label className="customer-form-wide">Tarea o mensaje<input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ej. Revisar stock de cubiertas" required maxLength={160} /></label>
              <label>Asignar a<select value={form.assigneeId} onChange={(event) => setForm((current) => ({ ...current, assigneeId: event.target.value }))}><option value="">Yo mismo</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name ?? member.email}</option>)}</select></label>
              <label>Vencimiento<input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} /></label>
              <label className="customer-form-wide">Mensaje<textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={3} maxLength={2000} placeholder="Detalle opcional" /></label>
            </div>
            <fieldset className="task-draft">
              <legend>Ítems</legend>
              <p>Cada ítem se tilda en la tarea cuando se cumple. Podés crearla sin ítems.</p>
              <div className="task-item-add">
                <input aria-label="Ítem" value={form.itemText} onChange={(event) => setForm((current) => ({ ...current, itemText: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addDraftItem(); } }} placeholder="Ej. Llamar al proveedor" maxLength={160} />
                <button className="secondary-button" type="button" onClick={addDraftItem}>Agregar</button>
              </div>
              {draftItems.length > 0 && (
                <ul className="task-draft-list">
                  {draftItems.map((text, index) => (
                    <li key={`${text}-${index}`}>
                      <span className="task-check-box" aria-hidden="true" />
                      <span>{text}</span>
                      <button className="text-button" type="button" onClick={() => setDraftItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Quitar</button>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
            {formError && <p className="form-error" role="alert">{formError}</p>}
            <button className="auth-submit" type="submit" disabled={saving}>{saving ? "Guardando..." : "Crear tarea"}</button>
          </form>
        </FormModal>
      )}
    </section>
  );
}
