"use client";

import { useState } from "react";

type ActivityEvent = { id: string; type: string; createdAt: string };

export function RecentActivity({ events }: { events: ActivityEvent[] }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="panel activity-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Actividad</p>
          <h2>Movimientos recientes</h2>
        </div>
        <div className="panel-heading-actions">
          <span className="panel-count">{events.length}</span>
          <button className="secondary-button" type="button" aria-expanded={open} aria-controls="recent-activity" onClick={() => setOpen((value) => !value)}>{open ? "Ocultar" : "Ver"}</button>
        </div>
      </div>
      {open ? (
        <div id="recent-activity">
          {events.length ? (
            <div className="data-list">{events.map((event) => <div className="data-row" key={event.id}><span>{event.type}</span><span>{new Date(event.createdAt).toLocaleString("es-AR")}</span></div>)}</div>
          ) : (
            <div className="empty-state"><span className="empty-state-mark" aria-hidden="true">—</span><p>Todavía no hay actividad registrada.</p></div>
          )}
        </div>
      ) : null}
    </div>
  );
}
