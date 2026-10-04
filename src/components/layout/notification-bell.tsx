"use client";

import { useEffect, useState } from "react";

type Notification = { id: string; title: string; message: string; readAt: string | null; createdAt: string };

export function NotificationBell({ businessId }: { businessId: string }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  async function load() {
    if (!businessId) return;
    try {
      const response = await fetch(`/api/v1/businesses/${businessId}/notifications`, { cache: "no-store" });
      if (response.ok) setItems((await response.json()).items);
    } catch {
      // La consulta se corta si la página se está yendo o el servidor no responde.
    }
  }

  useEffect(() => { void load(); }, [businessId]);

  async function markRead(id: string) {
    try {
      await fetch(`/api/v1/businesses/${businessId}/notifications`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notificationId: id }) });
    } catch {
      return;
    }
    setItems((current) => current.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item));
  }

  const unread = items.filter((item) => !item.readAt).length;
  return <div className="notification-wrap"><button className="notification-button" type="button" aria-expanded={open} aria-label={`Avisos${unread ? `, ${unread} sin leer` : ""}`} onClick={() => setOpen((value) => !value)}><BellMark />{unread > 0 && <b>{unread > 9 ? "9+" : unread}</b>}</button>{open && <div className="notification-popover"><div className="notification-heading"><strong>Avisos</strong><button className="text-button" type="button" onClick={() => setOpen(false)}>Cerrar</button></div>{items.length ? items.slice(0, 8).map((item) => <button className={`notification-item${item.readAt ? " is-read" : ""}`} type="button" key={item.id} onClick={() => void markRead(item.id)}><strong>{item.title}</strong><span>{item.message}</span><small>{new Date(item.createdAt).toLocaleString("es-AR")}</small></button>) : <p className="notification-empty">No tenés avisos nuevos.</p>}</div>}</div>;
}

function BellMark() {
  return (
    <svg className="icon-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.4 16.6h11.2" />
      <path d="M7.4 16.6V11a4.6 4.6 0 0 1 9.2 0v5.6" />
      <path d="M10.3 16.6a1.7 1.7 0 0 0 3.4 0" />
    </svg>
  );
}
