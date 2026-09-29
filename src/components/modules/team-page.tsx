"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Membership = {
  id: string;
  role: "OWNER" | "EMPLOYEE";
  user: { id: string; name: string | null; email: string; status: "ACTIVE" | "SUSPENDED" };
};

type Invitation = {
  id: string;
  email: string;
  role: "OWNER" | "EMPLOYEE";
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  expiresAt: string;
  createdAt: string;
};

export function TeamPage({ businessId }: { businessId: string }) {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<"OWNER" | "EMPLOYEE" | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"OWNER" | "EMPLOYEE">("EMPLOYEE");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const response = await fetch(`/api/v1/businesses/${businessId}/memberships`, { cache: "no-store" });
    if (!response.ok) {
      setError("No se pudieron cargar los miembros del equipo.");
      setLoading(false);
      return;
    }

    const data = await response.json();
    setMemberships(data.memberships ?? []);
    setInvitations(data.invitations ?? []);
    setCurrentUserRole(data.currentUser?.role ?? null);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [businessId]);

  const stats = useMemo(() => ({
    total: memberships.length,
    owners: memberships.filter((member) => member.role === "OWNER").length,
    employees: memberships.filter((member) => member.role === "EMPLOYEE").length,
  }), [memberships]);

  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const response = await fetch(`/api/v1/businesses/${businessId}/memberships`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.message ?? "No se pudo crear la invitación.");
      setSaving(false);
      return;
    }

    setEmail("");
    setRole("EMPLOYEE");
    setSaving(false);
    await load();
  }

  async function updateRole(membershipId: string, nextRole: "OWNER" | "EMPLOYEE") {
    const response = await fetch(`/api/v1/businesses/${businessId}/memberships`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ membershipId, role: nextRole }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.message ?? "No se pudo actualizar el rol.");
      return;
    }

    await load();
  }

  async function removeMember(membershipId: string) {
    if (!window.confirm("¿Desea quitar a este miembro del negocio?")) return;

    const response = await fetch(`/api/v1/businesses/${businessId}/memberships`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ membershipId }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.message ?? "No se pudo remover al miembro.");
      return;
    }

    await load();
  }

  const isOwner = currentUserRole === "OWNER";

  return (
    <section className="module-page">
      <p className="eyebrow">Administración</p>
      <h1>Equipo</h1>
      <p className="module-description">Gestioná miembros, permisos y nuevas invitaciones para el negocio.</p>

      <div className="customer-summary">
        <div className="summary-card"><span>Miembros</span><strong>{stats.total}</strong></div>
        <div className="summary-card"><span>Owners</span><strong>{stats.owners}</strong></div>
        <div className="summary-card"><span>Empleados</span><strong>{stats.employees}</strong></div>
      </div>

      {isOwner && (
        <form className="customer-form" onSubmit={inviteMember}>
          <div className="customer-form-heading">
            <div>
              <h2>Invitar al equipo</h2>
              <p>Agregá alguien por correo y asignale un rol.</p>
            </div>
          </div>
          <div className="customer-form-grid">
            <label>
              Email
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="persona@ejemplo.com" required />
            </label>
            <label>
              Rol
              <select value={role} onChange={(event) => setRole(event.target.value as "OWNER" | "EMPLOYEE") }>
                <option value="EMPLOYEE">Empleado</option>
                <option value="OWNER">Dueño</option>
              </select>
            </label>
          </div>
          <button className="auth-submit" type="submit" disabled={saving}>{saving ? "Enviando..." : "Enviar invitación"}</button>
        </form>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}

      {loading ? (
        <div className="module-state">Cargando...</div>
      ) : memberships.length ? (
        <div className="customer-list">
          {memberships.map((membership) => (
            <article className="customer-card" key={membership.id}>
              <div className="customer-card-header">
                <div>
                  <strong>{membership.user.name ?? membership.user.email}</strong>
                  <p>{membership.user.email}</p>
                </div>
                <span className="customer-pill">{membership.role}</span>
              </div>
              <div className="customer-contact">
                <span>Estado: {membership.user.status}</span>
              </div>

              {isOwner && (
                <div className="customer-actions">
                  <select
                    value={membership.role}
                    onChange={(event) => void updateRole(membership.id, event.target.value as "OWNER" | "EMPLOYEE")}
                    aria-label={`Cambiar rol de ${membership.user.name ?? membership.user.email}`}
                  >
                    <option value="OWNER">Dueño</option>
                    <option value="EMPLOYEE">Empleado</option>
                  </select>
                  <button className="text-button" type="button" onClick={() => void removeMember(membership.id)}>Quitar</button>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="module-state">Todavía no hay miembros en este negocio.</div>
      )}

      {invitations.length > 0 && (
        <div className="customer-list" style={{ marginTop: "2rem" }}>
          <h2>Invitaciones pendientes</h2>
          {invitations.map((invitation) => (
            <article className="customer-card" key={invitation.id}>
              <div className="customer-card-header">
                <div>
                  <strong>{invitation.email}</strong>
                  <p>{invitation.role}</p>
                </div>
                <span className="customer-pill">{invitation.status}</span>
              </div>
              <div className="customer-contact">
                <span>Expira: {new Date(invitation.expiresAt).toLocaleDateString()}</span>
                <span>Creada: {new Date(invitation.createdAt).toLocaleDateString()}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
