"use client";

import { useEffect, useMemo, useState } from "react";
import { FormModal } from "@/components/forms/form-modal";
import { parseProductTable, readyRows, type ImportMode, type ImportRow } from "@/lib/product-import";

type Preview = { rows: ImportRow[]; truncated: boolean; ready: number; ignored: string[] };

export function ProductImport({ businessId, mode, onClose, onDone }: { businessId: string; mode: ImportMode; onClose: () => void; onDone: (message: string) => void }) {
  const stockMode = mode === "stock";
  const [text, setText] = useState("");
  const [remote, setRemote] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);

  const local = useMemo(() => {
    if (!text.trim()) return { rows: [] as ImportRow[], truncated: false, ready: 0, ignored: [] as string[] };
    const parsed = parseProductTable(text, mode);
    return { rows: parsed.rows, truncated: parsed.truncated, ready: readyRows(parsed.rows).length, ignored: parsed.ignored };
  }, [text, mode]);
  const preview = remote ?? local;

  useEffect(() => {
    setRemote(null);
    if (!text.trim()) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(`/api/v1/businesses/${businessId}/products/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, commit: false }),
        signal: controller.signal,
      }).then(async (response) => {
        if (!response.ok) return;
        const data = await response.json() as Preview;
        setRemote({ rows: data.rows, truncated: data.truncated, ready: data.ready, ignored: data.ignored ?? [] });
      }).catch(() => undefined);
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [text, businessId]);

  async function readFile(file: File) {
    setError("");
    setReading(true);
    const pdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!pdf) {
      setText(await file.text());
      setReading(false);
      return;
    }
    const body = new FormData();
    body.set("file", file);
    const response = await fetch(`/api/v1/businesses/${businessId}/products/import/file`, { method: "POST", body });
    const data = await response.json().catch(() => null) as { text?: string; message?: string } | null;
    setReading(false);
    if (!response.ok || !data?.text) {
      setError(data?.message || "No pude leer ese PDF. Copiá la tabla y pegala.");
      return;
    }
    setText(data.text);
  }

  async function save() {
    setSaving(true);
    setError("");
    const response = await fetch(`/api/v1/businesses/${businessId}/products/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, commit: true }),
    });
    const data = await response.json().catch(() => null) as { created?: number; skipped?: number; message?: string } | null;
    setSaving(false);
    if (!response.ok || data?.created === undefined) {
      setError(data?.message || "No se pudo guardar.");
      return;
    }
    const noun = stockMode ? (data.created === 1 ? "ítem" : "ítems") : (data.created === 1 ? "producto" : "productos");
    const skipped = data.skipped ? ` ${data.skipped} ${data.skipped === 1 ? "fila quedó afuera" : "filas quedaron afuera"}.` : "";
    onDone(`Se cargaron ${data.created} ${noun}.${skipped}`);
  }

  return (
    <FormModal title={stockMode ? "Cargar varios ítems" : "Cargar varios productos"} onClose={onClose} wide>
      <div className="import-box">
        <p className="import-hint">
          {stockMode
            ? "Pegá desde Excel o un PDF. Si hay títulos, se guardan nombre, tipo, stock, características, costo y stock mínimo."
            : "Pegá desde Excel o un PDF. Si hay títulos, se guardan nombre, precio, stock, características, costo y stock mínimo."}
        </p>
        <p className="import-example">{stockMode ? "Bolsa    insumo    4" : "Yerba 1kg    3500    12"}</p>
        <textarea aria-label={stockMode ? "Tabla de ítems" : "Tabla de productos"} value={text} onChange={(event) => setText(event.target.value)} rows={7} placeholder="Pegá la tabla acá" maxLength={100000} />
        <label className="secondary-button import-file-label">
          {reading ? "Leyendo..." : "Elegir archivo o PDF"}
          <input className="import-file" type="file" accept=".txt,.csv,.tsv,.pdf,text/plain,text/csv,application/pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); event.target.value = ""; }} />
        </label>
        {preview.ignored.length > 0 && <p className="import-hint">No se guardan: {preview.ignored.join(", ")}.</p>}
        {preview.truncated && <p className="form-error" role="alert">Solo se leen las primeras 200 filas.</p>}
        {preview.rows.length > 0 && (
          <div className="import-rows">
            {preview.rows.map((row) => (
              <div className="import-row" key={`${row.line}-${row.name}`}>
                <span>{row.line}</span>
                <strong>{row.name || "Sin nombre"}</strong>
                <span className={row.error ? "is-bad" : "is-ok"}>{row.error ?? "Listo"}</span>
              </div>
            ))}
          </div>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="list-form-footer">
          <button className="auth-submit" type="button" disabled={saving || preview.ready === 0} onClick={() => void save()}>
            {saving ? "Guardando..." : `Guardar los que están bien${preview.ready ? ` (${preview.ready})` : ""}`}
          </button>
        </div>
      </div>
    </FormModal>
  );
}
