"use client";

import { useEffect, useState } from "react";

type Notification = { id: string; title: string; message: string; readAt: string | null; createdAt: string };

export function NotificationBell({ businessId }: { businessId: string }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  async function load() {
    if (!businessId) return;
    const response = await fetch(`/api/v1/businesses/${businessId}/notifications`, { cache: "no-store" });
    if (response.ok) setItems((await response.json()).items);
  }

  useEffect(() => { void load(); }, [businessId]);

  async function markRead(id: string) {
    await fetch(`/api/v1/businesses/${businessId}/notifications`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notificationId: id }) });
    setItems((current) => current.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item));
  }

  const unread = items.filter((item) => !item.readAt).length;
  return <div className="notification-wrap"><button className="notification-button" type="button" aria-label={`Notificaciones${unread ? `, ${unread} sin leer` : ""}`} onClick={() => setOpen((value) => !value)}><span aria-hidden="true">🔔</span>{unread > 0 && <b>{unread > 9 ? "9+" : unread}</b>}</button>{open && <div className="notification-popover"><div className="notification-heading"><strong>Notificaciones</strong><button className="text-button" type="button" onClick={() => setOpen(false)}>Cerrar</button></div>{items.length ? items.slice(0, 8).map((item) => <button className={`notification-item${item.readAt ? " is-read" : ""}`} type="button" key={item.id} onClick={() => void markRead(item.id)}><strong>{item.title}</strong><span>{item.message}</span><small>{new Date(item.createdAt).toLocaleString("es-AR")}</small></button>) : <p className="notification-empty">No tenés notificaciones nuevas.</p>}</div>}</div>;
}
