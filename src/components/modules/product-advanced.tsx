"use client";

import { useState } from "react";
import { ConfirmModal } from "@/components/forms/confirm-modal";
import { FormModal } from "@/components/forms/form-modal";

type Action = "archive" | "archive-empty" | "delete";

export function ProductAdvanced({ businessId, stockMode, onClose, onDone }: { businessId: string; stockMode: boolean; onClose: () => void; onDone: (message: string) => void }) {
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState("");
  const noun = stockMode ? "ítems" : "productos";

  async function run(action: Action) {
    setError("");
    const response = await fetch(`/api/v1/businesses/${businessId}/products/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await response.json().catch(() => null) as { archived?: number; deleted?: number; message?: string } | null;
    if (!response.ok || data?.archived === undefined || data.deleted === undefined) {
      setPending(null);
      setError(data?.message || "No se pudo completar.");
      return;
    }
    onDone(summary(action, data.archived, data.deleted, noun));
  }

  if (pending) {
    return (
      <ConfirmModal
        title={pending === "delete" ? "Eliminar todos" : pending === "archive-empty" ? "Archivar sin stock" : "Archivar todos"}
        message={confirmMessage(pending, stockMode)}
        onCancel={() => setPending(null)}
        onAccept={() => void run(pending)}
      />
    );
  }

  return (
    <FormModal title="Opciones avanzadas" onClose={onClose}>
      <div className="advanced-box">
        <button className="secondary-button advanced-option" type="button" onClick={() => setPending("archive")}>
          <strong>Archivar todos</strong>
          <span>{stockMode ? "Dejan de aparecer en el stock." : "Dejan de aparecer en ventas. El historial queda."}</span>
        </button>
        <button className="secondary-button advanced-option" type="button" onClick={() => setPending("archive-empty")}>
          <strong>Archivar los que están sin stock</strong>
          <span>El resto queda como está.</span>
        </button>
        <button className="secondary-button advanced-option is-danger" type="button" onClick={() => setPending("delete")}>
          <strong>Eliminar todos</strong>
          <span>Borra los que no tienen ventas ni pedidos. Los que sí, se archivan.</span>
        </button>
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
    </FormModal>
  );
}

function confirmMessage(action: Action, stockMode: boolean) {
  if (action === "archive-empty") return stockMode ? "¿Archivar los ítems con stock 0?" : "¿Archivar los productos con stock 0?";
  if (action === "delete") {
    return stockMode
      ? "¿Eliminar todos los ítems? Se borran los que no tienen ventas ni pedidos. Los que sí, se archivan para no perder el historial. No se puede deshacer."
      : "¿Eliminar todos los productos? Se borran los que no tienen ventas ni pedidos. Los que sí, se archivan para no perder el historial. No se puede deshacer.";
  }
  return stockMode
    ? "¿Archivar todos los ítems? Dejan de aparecer en el stock."
    : "¿Archivar todos los productos? Dejan de aparecer en ventas. Las ventas ya hechas siguen en el historial.";
}

function summary(action: Action, archived: number, deleted: number, noun: string) {
  if (action === "delete") {
    const removed = deleted === 0 ? "No se eliminó ninguno." : deleted === 1 ? "Se eliminó 1." : `Se eliminaron ${deleted}.`;
    const hidden = archived === 0 ? "" : archived === 1 ? " 1 se archivó porque ya tenía ventas o pedidos." : ` ${archived} se archivaron porque ya tenían ventas o pedidos.`;
    return `${removed}${hidden}`;
  }
  if (archived === 0) return "No había nada para archivar.";
  if (action === "archive-empty") return archived === 1 ? "Se archivó 1 sin stock." : `Se archivaron ${archived} sin stock.`;
  return archived === 1 ? `Se archivó 1.` : `Se archivaron ${archived} ${noun}.`;
}
