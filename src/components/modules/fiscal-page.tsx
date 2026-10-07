"use client";

import { FormEvent, useState } from "react";

type FiscalForm = {
  legalName: string;
  cuit: string;
  pointOfSale: number;
  ivaCondition: "MONOTRIBUTO" | "RESPONSABLE_INSCRIPTO";
  environment: "HOMOLOGACION" | "PRODUCCION";
  certificatePem: string;
  privateKeyPem: string;
  certificateLoaded: boolean;
  privateKeyLoaded: boolean;
  configured: boolean;
};

export function FiscalPage({ businessId, initial }: { businessId: string; initial: FiscalForm }) {
  const [form, setForm] = useState<FiscalForm>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    const response = await fetch(`/api/v1/businesses/${businessId}/fiscal`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        legalName: form.legalName,
        cuit: form.cuit,
        pointOfSale: Number(form.pointOfSale),
        ivaCondition: form.ivaCondition,
        environment: form.environment,
        certificatePem: form.certificatePem || undefined,
        privateKeyPem: form.privateKeyPem || undefined,
      }),
    });
    const data = await response.json().catch(() => null) as { message?: string } | null;
    if (!response.ok) {
      setError(data?.message ?? "No se pudo guardar.");
      setSaving(false);
      return;
    }
    setForm((current) => ({ ...current, certificatePem: "", privateKeyPem: "", certificateLoaded: true, privateKeyLoaded: true, configured: true }));
    setSuccess("Datos fiscales guardados. Probá la conexión antes de la primera factura.");
    setSaving(false);
  }

  async function testConnection() {
    setError("");
    setSuccess("");
    const response = await fetch(`/api/v1/businesses/${businessId}/fiscal/test`, { method: "POST" });
    const data = await response.json().catch(() => null) as { message?: string; lastNumber?: number; letter?: string; environment?: string } | null;
    if (!response.ok) {
      setError(data?.message ?? "ARCA no respondió.");
      return;
    }
    setSuccess(`Conexión ok en ${data?.environment === "PRODUCCION" ? "producción" : "homologación"}. Último comprobante ${data?.letter}-${data?.lastNumber ?? 0}.`);
  }

  return (
    <section className="module-page">
      <p className="eyebrow">Facturación</p>
      <h1>ARCA</h1>
      <p className="module-description">Con el certificado cargado, confirmar una venta pide el CAE a ARCA. Si ARCA rechaza, la venta no se confirma y el stock no cambia. Sin certificado, la venta se confirma igual y se imprime un ticket interno, sin un CAE inventado.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      {success && <p className="form-success" role="status">{success}</p>}
      <form className="customer-form-grid" onSubmit={(event) => void save(event)}>
        <label className="span-all">Razón social<input value={form.legalName} onChange={(event) => setForm((current) => ({ ...current, legalName: event.target.value }))} required maxLength={160} /></label>
        <label>CUIT<input value={form.cuit} onChange={(event) => setForm((current) => ({ ...current, cuit: event.target.value }))} inputMode="numeric" required /></label>
        <label>Punto de venta<input type="number" min={1} max={9999} value={form.pointOfSale} onChange={(event) => setForm((current) => ({ ...current, pointOfSale: Number(event.target.value) }))} required /></label>
        <label>Condición frente al IVA<select value={form.ivaCondition} onChange={(event) => setForm((current) => ({ ...current, ivaCondition: event.target.value as FiscalForm["ivaCondition"] }))}><option value="MONOTRIBUTO">Monotributo, factura C</option><option value="RESPONSABLE_INSCRIPTO">Responsable inscripto, factura B</option></select></label>
        <label>Ambiente<select value={form.environment} onChange={(event) => setForm((current) => ({ ...current, environment: event.target.value as FiscalForm["environment"] }))}><option value="HOMOLOGACION">Homologación</option><option value="PRODUCCION">Producción</option></select></label>
        <label className="span-all">Certificado PEM{form.certificateLoaded ? " (ya cargado)" : ""}<textarea className="pem-input" rows={6} value={form.certificatePem} onChange={(event) => setForm((current) => ({ ...current, certificatePem: event.target.value }))} placeholder={form.certificateLoaded ? "Dejalo vacío para conservar el actual" : "BEGIN CERTIFICATE"} /></label>
        <label className="span-all">Clave privada PEM{form.privateKeyLoaded ? " (ya cargada)" : ""}<textarea className="pem-input" rows={6} value={form.privateKeyPem} onChange={(event) => setForm((current) => ({ ...current, privateKeyPem: event.target.value }))} placeholder={form.privateKeyLoaded ? "Dejala vacía para conservar la actual" : "BEGIN PRIVATE KEY"} /></label>
        <div className="customer-actions span-all">
          <button className="auth-submit" type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
          <button className="secondary-button" type="button" onClick={() => void testConnection()} disabled={!form.configured}>Probar conexión</button>
        </div>
      </form>
    </section>
  );
}
