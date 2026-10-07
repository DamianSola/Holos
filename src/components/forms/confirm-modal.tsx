"use client";

import { FormEvent, useState } from "react";
import { FormModal } from "@/components/forms/form-modal";

export function ConfirmModal({ title, message, onAccept, onCancel }: { title: string; message: string; onAccept: () => void; onCancel: () => void }) {
  const [busy, setBusy] = useState(false);

  function accept(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    onAccept();
  }

  return (
    <FormModal title={title} onClose={onCancel}>
      <form className="customer-form dialog-body" onSubmit={accept}>
        <p>{message}</p>
        <div className="dialog-actions">
          <button className="secondary-button" type="button" onClick={onCancel}>Cancelar</button>
          <button className="auth-submit" type="submit" disabled={busy}>Aceptar</button>
        </div>
      </form>
    </FormModal>
  );
}
