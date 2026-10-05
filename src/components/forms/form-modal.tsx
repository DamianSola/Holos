"use client";

import { ReactNode, useEffect } from "react";

export function FormModal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="form-modal-title">
        <header className="modal-header">
          <h2 id="form-modal-title">{title}</h2>
          <button className="secondary-button modal-close" type="button" onClick={onClose}>Cerrar</button>
        </header>
        {children}
      </div>
    </div>
  );
}
