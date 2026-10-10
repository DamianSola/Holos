"use client";

import { FormEvent, useEffect, useState } from "react";
import { ImagePicker, PasswordField } from "@/components/forms/account-fields";

type Profile = {
  id: string;
  name: string | null;
  email: string;
  status: "ACTIVE" | "SUSPENDED";
  image: string | null;
  businesses: Array<{ id: string; name: string; role: "OWNER" | "EMPLOYEE"; image: string | null }>;
};

export function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", image: "" });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true);
    const response = await fetch("/api/v1/me", { cache: "no-store" });
    if (!response.ok) {
      setError("No se pudo cargar tu perfil.");
      setLoading(false);
      return;
    }

    const data = await response.json();
    setProfile(data);
    setForm({ name: data.name ?? "", email: data.email ?? "", password: "", image: data.image ?? "" });
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    const payload: Record<string, string> = {};
    if (form.name.trim() && form.name.trim() !== (profile?.name ?? "")) payload.name = form.name.trim();
    if (form.email.trim().toLowerCase() !== (profile?.email ?? "").toLowerCase()) payload.email = form.email.trim().toLowerCase();
    if (form.password.trim()) payload.password = form.password.trim();
    if (form.image !== (profile?.image ?? "")) payload.image = form.image;

    if (Object.keys(payload).length === 0) {
      setSuccess("No hubo cambios para guardar.");
      setSaving(false);
      return;
    }

    const response = await fetch("/api/v1/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.message ?? "No se pudo actualizar tu perfil.");
      setSaving(false);
      return;
    }

    setSuccess("Perfil actualizado correctamente.");
    setForm((current) => ({ ...current, password: "" }));
    await load();
    setSaving(false);
  }

  if (loading) return <section className="module-page"><div className="module-state">Cargando perfil...</div></section>;
  if (!profile) return <section className="module-page"><div className="module-state">No se pudo cargar tu perfil.</div></section>;

  return (
    <section className="module-page">
      <p className="eyebrow">Cuenta</p>
      <h1>Perfil</h1>

      <div className="customer-summary">
        <div className="summary-card"><span>Estado</span><strong>{profile.status}</strong></div>
        <div className="summary-card"><span>Negocios</span><strong>{profile.businesses.length}</strong></div>
        <div className="summary-card"><span>Email</span><strong>{profile.email}</strong></div>
      </div>

      <form className="customer-form" onSubmit={saveProfile}>
        <div className="customer-form-heading">
          <div>
            <h2>Datos personales</h2>
          </div>
        </div>
        <div className="customer-form-grid">
          <label>
            Nombre
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} maxLength={120} />
          </label>
          <label>
            Email
            <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} maxLength={320} />
          </label>
          <PasswordField label="Nueva contraseña" value={form.password} onChange={(password) => setForm((current) => ({ ...current, password }))} minLength={12} maxLength={128} placeholder="Opcional" />
          <ImagePicker label="Foto de perfil" value={form.image} onChange={(image) => setForm((current) => ({ ...current, image }))} />
        </div>
        <button className="auth-submit" type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar cambios"}</button>
      </form>

      {error && <p className="form-error" role="alert">{error}</p>}
      {success && <p className="form-success" role="status">{success}</p>}

      <div className="customer-list" style={{ marginTop: "2rem" }}>
        <h2>Mis negocios</h2>
        {profile.businesses.length ? (
          profile.businesses.map((business) => (
            <article className="customer-card" key={business.id}>
              <div className="customer-card-header">
                <div className="identity-line">
                  <div>
                    <strong>{business.name}</strong>
                    <p>Acceso como {business.role === "OWNER" ? "dueño" : "colaborador"}</p>
                  </div>
                </div>
                <span className="customer-pill">{business.role === "OWNER" ? "Dueño" : "Colaborador"}</span>
              </div>
            </article>
          ))
        ) : (
          <div className="module-state">Todavía no pertenecés a ningún negocio.</div>
        )}
      </div>
    </section>
  );
}
