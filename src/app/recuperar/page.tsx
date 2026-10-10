"use client";

import { FormEvent, useState } from "react";
import { AuthPage } from "@/app/login/page";

export default function ForgotPasswordPage() {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    const response = await fetch("/api/v1/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    if (!response.ok) {
      setError("No pudimos enviar el enlace. Intentá de nuevo.");
      return;
    }
    setNotice("Si el email está registrado, te enviamos un enlace para elegir una contraseña nueva. Revisá el correo.");
  }

  return (
    <AuthPage title="Recuperar el acceso." submitLabel={loading ? "Enviando..." : "Enviar enlace"} error={error} notice={notice} onSubmit={onSubmit} footerHref="/login" footerLabel="Volver a ingresar">
      <label>Email<input name="email" type="email" required maxLength={320} autoComplete="email" /></label>
    </AuthPage>
  );
}
