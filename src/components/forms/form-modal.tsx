"use client";

import { ReactNode, useEffect } from "react";

export function ModalClose({ onClose }: { onClose: () => void }) {
  return (
    <button className="modal-close" type="button" aria-label="Cerrar" onClick={onClose}>
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}

export function FormModal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={`modal-card${wide ? " is-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="form-modal-title">
        <header className="modal-header">
          <h2 id="form-modal-title">{title}</h2>
          <ModalClose onClose={onClose} />
        </header>
        {children}
      </div>
    </div>
  );
}
