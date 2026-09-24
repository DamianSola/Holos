"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
    if (!response.ok) {
      const data = await response.json().catch(() => null) as { code?: string } | null;
      setError(data?.code === "DATABASE_UNAVAILABLE" ? "La base de datos no está disponible." : "No pudimos iniciar sesión con esos datos.");
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return <AuthPage title="Volvé a ver el todo." description="Entrá a tu espacio de trabajo y seguí operando tu negocio." submitLabel={loading ? "Ingresando..." : "Ingresar"} error={error} onSubmit={handleSubmit} footerHref="/register" footerLabel="Crear una cuenta" />;
}

type AuthPageProps = { title: string; description: string; submitLabel: string; error: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void; footerHref: string; footerLabel: string; register?: boolean };

export function AuthPage({ title, description, submitLabel, error, onSubmit, footerHref, footerLabel, register = false }: AuthPageProps) {
  return <main className="auth-page"><section className="auth-panel"><div className="sidebar-brand"><span className="brand-mark" aria-hidden="true">H</span><span className="brand-name">HOLos</span></div><p className="eyebrow">Business management platform</p><h1>{title}</h1><p className="auth-description">{description}</p><form className="auth-form" onSubmit={onSubmit}>{register && <label>Nombre<input name="name" required maxLength={120} /></label>}<label>Email<input name="email" type="email" required maxLength={320} autoComplete="email" /></label><label>Contraseña<input name="password" type="password" required minLength={12} maxLength={128} autoComplete={register ? "new-password" : "current-password"} /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="auth-submit" type="submit">{submitLabel}</button></form><a className="auth-footer-link" href={footerHref}>{footerLabel}</a></section></main>;
}