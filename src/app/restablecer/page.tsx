"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthPage } from "@/app/login/page";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [error, setError] = useState(token ? "" : "El enlace no es válido.");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setLoading(true);
    setError("");
    setNotice("");
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    const response = await fetch("/api/v1/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await response.json().catch(() => null) as { message?: string } | null;
    setLoading(false);
    if (!response.ok) {
      setError(data?.message ?? "No pudimos cambiar la contraseña.");
      return;
    }
    setNotice("Contraseña actualizada. Ya podés ingresar.");
  }

  return (
    <AuthPage title="Elegí una contraseña nueva." description="Tiene que tener al menos 12 caracteres. Al guardarla, las sesiones anteriores se cierran." submitLabel={loading ? "Guardando..." : "Guardar contraseña"} error={error} notice={notice} onSubmit={onSubmit} footerHref="/login" footerLabel="Ir a ingresar">
      <label>Contraseña nueva<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>
    </AuthPage>
  );
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<main className="auth-page"><p>Cargando...</p></main>}><ResetForm /></Suspense>;
}
