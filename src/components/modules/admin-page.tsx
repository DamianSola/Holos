"use client";

import { FormEvent, useEffect, useState } from "react";
import { IconAction } from "@/components/forms/icon-action";
import { ConfirmModal } from "@/components/forms/confirm-modal";
import { ModuleLayout } from "@/components/modules/customers-page";

type Settings = {
  planName: string;
  trialDays: number;
  periodDays: number;
  monthlyAmountArs: number;
  termsText: string;
  privacyText: string;
  mpConfigured: boolean;
  mpStored: boolean;
  mpHint: string;
  webhookUrl: string;
};

type AdminUser = {
  id: string;
  name: string | null;
  email: string;
  status: "ACTIVE" | "SUSPENDED";
  deletedAt: string | null;
  platformAdmin: boolean;
  businessCount: number;
  subscription: { status: string; trialEndsAt: string; currentPeriodEnd: string | null } | null;
};

type Pending = { user: AdminUser; action: "suspend" | "activate" | "delete" | "restore" | "extend" };

const actionCopy: Record<Pending["action"], { title: string; message: (name: string) => string }> = {
  suspend: { title: "Suspender usuario", message: (name) => `${name} no va a poder entrar hasta que lo reactives.` },
  activate: { title: "Reactivar usuario", message: (name) => `${name} vuelve a poder entrar.` },
  delete: { title: "Eliminar usuario", message: (name) => `${name} deja de entrar. La cuenta queda oculta y se puede restaurar.` },
  restore: { title: "Restaurar usuario", message: (name) => `${name} vuelve a la lista y puede entrar.` },
  extend: { title: "Dar un período", message: (name) => `${name} queda activo por un período más, sin pasar por Mercado Pago.` },
};

function planLabel(user: AdminUser) {
  const subscription = user.subscription;
  if (!subscription) return "Sin plan";
  const until = subscription.currentPeriodEnd ?? subscription.trialEndsAt;
  const date = new Date(until).toLocaleDateString("es-AR");
  if (subscription.status === "TRIALING") return new Date(subscription.trialEndsAt) > new Date() ? `Prueba hasta ${date}` : "Prueba vencida";
  if (subscription.status === "ACTIVE") return `Activo hasta ${date}`;
  if (subscription.status === "PAST_DUE") return `Cobro pendiente · hasta ${date}`;
  if (subscription.status === "CANCELED" && subscription.currentPeriodEnd && new Date(subscription.currentPeriodEnd) > new Date()) return `Baja pedida · hasta ${date}`;
  if (subscription.status === "CANCELED" && new Date(subscription.trialEndsAt) > new Date()) return `Baja pedida · prueba hasta ${new Date(subscription.trialEndsAt).toLocaleDateString("es-AR")}`;
  return "Plan vencido";
}

export function AdminPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [token, setToken] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);

  async function loadUsers(search = query) {
    const response = await fetch(`/api/v1/admin/users?q=${encodeURIComponent(search)}`);
    if (!response.ok) return;
    const body = await response.json() as { items: AdminUser[] };
    setUsers(body.items);
  }

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/v1/admin/settings");
      if (!response.ok) {
        setError("No se pudo abrir el admin.");
        return;
      }
      setSettings(await response.json());
      await loadUsers("");
    })();
  }, []);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => current ? { ...current, [key]: value } : current);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError("");
    setNote("");
    const response = await fetch("/api/v1/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planName: settings.planName,
        trialDays: Number(settings.trialDays),
        periodDays: Number(settings.periodDays),
        monthlyAmountArs: Number(settings.monthlyAmountArs),
        termsText: settings.termsText,
        privacyText: settings.privacyText,
        ...(token.trim() ? { mpAccessToken: token.trim() } : {}),
      }),
    });
    setSaving(false);
    if (!response.ok) {
      setError("No se pudo guardar. Revisá los campos.");
      return;
    }
    setSettings(await response.json());
    setToken("");
    setNote("Guardado.");
  }

  async function clearToken() {
    setSaving(true);
    setError("");
    const response = await fetch("/api/v1/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planName: settings?.planName,
        trialDays: Number(settings?.trialDays),
        periodDays: Number(settings?.periodDays),
        monthlyAmountArs: Number(settings?.monthlyAmountArs),
        termsText: settings?.termsText,
        privacyText: settings?.privacyText,
        clearMpToken: true,
      }),
    });
    setSaving(false);
    if (!response.ok) {
      setError("No se pudo quitar Mercado Pago.");
      return;
    }
    setSettings(await response.json());
    setToken("");
    setNote("Se quitó el token guardado en Holos.");
  }

  async function runPending() {
    if (!pending) return;
    const response = await fetch(`/api/v1/admin/users/${pending.user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: pending.action }),
    });
    setPending(null);
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { message?: string } | null;
      setError(body?.message ?? "No se pudo actualizar el usuario.");
      return;
    }
    await loadUsers();
  }

  if (!settings) return <ModuleLayout eyebrow="Plataforma" title="Admin"><div className="module-state">{error || "Cargando..."}</div></ModuleLayout>;

  return (
    <ModuleLayout eyebrow="Plataforma" title="Admin">
      {error && <p className="form-error" role="alert">{error}</p>}
      {note && <p className="form-success" role="status">{note}</p>}
      <form className="customer-form" onSubmit={(event) => void save(event)}>
        <h2>Plan</h2>
        <div className="customer-form-grid">
          <label>Nombre del plan<input value={settings.planName} onChange={(event) => update("planName", event.target.value)} required maxLength={80} /></label>
          <label>Días de prueba<input type="number" min="0" max="365" value={settings.trialDays} onChange={(event) => update("trialDays", Number(event.target.value))} required /></label>
          <label>Días de cada período<input type="number" min="1" max="365" value={settings.periodDays} onChange={(event) => update("periodDays", Number(event.target.value))} required /></label>
          <label>Precio del período, en pesos<input type="number" min="1" value={settings.monthlyAmountArs} onChange={(event) => update("monthlyAmountArs", Number(event.target.value))} required /></label>
        </div>
        <p className="module-description">La prueba nueva usa estos días. Un período ya pago no se achica. Si Mercado Pago no cobra el siguiente, al vencer la fecha la cuenta deja de operar.</p>

        <h2>Mercado Pago</h2>
        <p className="module-description">{settings.mpConfigured ? `El cobro está habilitado${settings.mpHint ? ` · token …${settings.mpHint}` : ""}.` : "Todavía no hay un token. Sin eso nadie puede suscribirse."}</p>
        <div className="customer-form-grid">
          <label className="customer-form-wide">Access token
            <input type="password" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" placeholder="Pegalo para reemplazar el actual" />
          </label>
        </div>
        <p className="module-description">El cliente autoriza una suscripción y Mercado Pago cobra solo cada período. En el panel de Mercado Pago, el webhook tiene que apuntar a {settings.webhookUrl}.</p>
        {settings.mpStored && <button className="text-button" type="button" onClick={() => void clearToken()} disabled={saving}>Quitar token guardado</button>}

        <h2>Términos y privacidad</h2>
        <label>Términos y condiciones<textarea rows={14} value={settings.termsText} onChange={(event) => update("termsText", event.target.value)} required /></label>
        <label>Política de privacidad<textarea rows={14} value={settings.privacyText} onChange={(event) => update("privacyText", event.target.value)} required /></label>
        <p className="module-description">Se publican en /terminos y /privacidad. Quien crea una cuenta tiene que aceptarlos. Conviene que un abogado los revise antes de vender.</p>
        <button className="auth-submit" type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar configuración"}</button>
      </form>

      <h2>Usuarios</h2>
      <form className="customer-actions admin-search" onSubmit={(event) => { event.preventDefault(); void loadUsers(); }}>
        <label>Buscar<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre o mail" /></label>
        <button className="secondary-button" type="submit">Buscar</button>
      </form>
      <div className="record-scroll"><div className="record-list admin-users">
        {users.map((user) => {
          const name = user.name?.trim() || user.email;
          return (
            <article className="record-row admin-users" key={user.id}>
              <strong className="record-who">{name}</strong>
              <span className="record-meta">
                <span>{user.email}</span>
                <span>{user.deletedAt ? "Eliminado" : user.status === "SUSPENDED" ? "Suspendido" : "Activo"}</span>
                <span>{planLabel(user)}</span>
                <span>{user.businessCount === 1 ? "1 negocio" : `${user.businessCount} negocios`}</span>
                {user.platformAdmin && <span>Admin</span>}
              </span>
              <span className="record-actions">
                <button className="secondary-button" type="button" onClick={() => setPending({ user, action: "extend" })}>Dar un período</button>
                {user.deletedAt ? <button className="secondary-button" type="button" onClick={() => setPending({ user, action: "restore" })}>Restaurar</button> : user.platformAdmin ? null : <>
                  <button className="secondary-button" type="button" onClick={() => setPending({ user, action: user.status === "SUSPENDED" ? "activate" : "suspend" })}>{user.status === "SUSPENDED" ? "Reactivar" : "Suspender"}</button>
                  <IconAction label="Eliminar" icon="delete" onClick={() => setPending({ user, action: "delete" })} />
                </>}
              </span>
            </article>
          );
        })}
      </div></div>
      {pending && <ConfirmModal title={actionCopy[pending.action].title} message={actionCopy[pending.action].message(pending.user.name?.trim() || pending.user.email)} onCancel={() => setPending(null)} onAccept={() => void runPending()} />}
    </ModuleLayout>
  );
}
