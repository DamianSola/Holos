"use client";

import { FormEvent, ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import { HolosLogo } from "@/components/brand/holos-logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";

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

  return <AuthPage title="Volvé a ver el todo." description="Entrá a tu espacio de trabajo y seguí operando tu negocio." submitLabel={loading ? "Ingresando..." : "Ingresar"} error={error} onSubmit={handleSubmit} footerHref="/register" footerLabel="Crear una cuenta" secondaryHref="/recuperar" secondaryLabel="Olvidé mi contraseña" />;
}

type AuthPageProps = { title: string; description: string; submitLabel: string; error: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void; footerHref: string; footerLabel: string; register?: boolean; children?: ReactNode; notice?: string; secondaryHref?: string; secondaryLabel?: string };

export function AuthPage({ title, description, submitLabel, error, onSubmit, footerHref, footerLabel, register = false, children, notice, secondaryHref, secondaryLabel }: AuthPageProps) {
  return (
    <main className="auth-page">
      <section className="auth-stage">
        <img className="auth-mark" src="/brand/holos-mark.png" alt="" />
        <HolosLogo className="auth-lockup" />
        <p className="auth-stage-copy">Una venta actualiza stock, cliente, factura y tablero. El negocio entero, en una sola operación.</p>
      </section>
      <section className="auth-panel">
        <div className="auth-toolbar"><ThemeToggle /></div>
        <p className="eyebrow">{register ? "Cuenta nueva" : "Acceso"}</p>
        <h1>{title}</h1>
        <p className="auth-description">{description}</p>
        <form className="auth-form" onSubmit={onSubmit}>
          {children ?? <>
            {register && <label>Nombre<input name="name" required maxLength={120} autoComplete="name" /></label>}
            <label>Email<input name="email" type="email" required maxLength={320} autoComplete="email" /></label>
            <label>Contraseña<input name="password" type="password" required minLength={12} maxLength={128} autoComplete={register ? "new-password" : "current-password"} /></label>
          </>}
          {notice && <p className="form-success" role="status">{notice}</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit">{submitLabel}</button>
        </form>
        {secondaryHref && secondaryLabel && <a className="auth-footer-link" href={secondaryHref}>{secondaryLabel}</a>}
        <a className="auth-footer-link" href={footerHref}>{footerLabel}</a>
      </section>
    </main>
  );
}
