"use client";

import { FormEvent, useEffect, useState } from "react";

type Member = { id: string; name: string | null; email: string };
type Task = { id: string; title: string; description: string | null; status: "OPEN" | "DONE" | "ARCHIVED"; dueDate: string | null; assignee: Member };

export function TasksPanel({ businessId, members }: { businessId: string; members: Member[] }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [form, setForm] = useState({ title: "", description: "", assigneeId: "", dueDate: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const response = await fetch(`/api/v1/businesses/${businessId}/tasks`, { cache: "no-store" });
    if (!response.ok) { setError("No se pudieron cargar las tareas."); setLoading(false); return; }
    setTasks((await response.json()).items);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [businessId]);

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const response = await fetch(`/api/v1/businesses/${businessId}/tasks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: form.title, description: form.description || undefined, assigneeId: form.assigneeId || undefined, dueDate: form.dueDate ? new Date(`${form.dueDate}T12:00:00`).toISOString() : undefined }) });
    if (!response.ok) { setError("No se pudo crear la tarea."); setSaving(false); return; }
    setForm({ title: "", description: "", assigneeId: "", dueDate: "" }); setSaving(false); await load();
  }

  async function updateTask(taskId: string, status: "OPEN" | "DONE") {
    const response = await fetch(`/api/v1/businesses/${businessId}/tasks/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (!response.ok) { setError("No se pudo actualizar la tarea."); return; }
    await load();
  }

  return <section className="panel tasks-panel"><div className="panel-heading"><div><p className="eyebrow">Colaboración</p><h2>Tareas y mensajes</h2></div><span className="panel-count">{tasks.filter((task) => task.status === "OPEN").length} pendientes</span></div>
    <form className="task-form" onSubmit={createTask}><label>Tarea o mensaje<input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ej. Revisar stock de cubiertas" required maxLength={160} /></label><label>Asignar a<select value={form.assigneeId} onChange={(event) => setForm((current) => ({ ...current, assigneeId: event.target.value }))}><option value="">Yo mismo</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name ?? member.email}</option>)}</select></label><label>Vencimiento<input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} /></label><label className="task-form-wide">Mensaje<textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={2} maxLength={2000} /></label><button className="auth-submit" type="submit" disabled={saving}>{saving ? "Guardando..." : "Crear tarea"}</button></form>
    {error && <p className="form-error" role="alert">{error}</p>}{loading ? <div className="module-state">Cargando tareas...</div> : tasks.length ? <div className="data-list">{tasks.map((task) => <div className="task-row" key={task.id}><div><strong>{task.title}</strong><span>{task.description ?? "Sin mensaje"} · Para: {task.assignee.name ?? task.assignee.email}{task.dueDate ? ` · vence ${new Date(task.dueDate).toLocaleDateString("es-AR")}` : ""}</span></div><button className="secondary-button" type="button" onClick={() => void updateTask(task.id, task.status === "DONE" ? "OPEN" : "DONE")}>{task.status === "DONE" ? "Reabrir" : "Completar"}</button></div>)}</div> : <div className="empty-state"><p>No hay tareas pendientes. Creá la primera.</p></div>}
  </section>;
}
