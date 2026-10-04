"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthPage } from "@/app/login/page";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const image = String(form.get("image") ?? "");
    const response = await fetch("/api/v1/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name"), email: form.get("email"), password: form.get("password"), ...(image ? { image } : {}) }) });
    if (!response.ok) {
      const data = await response.json().catch(() => null) as { code?: string } | null;
      setError(data?.code === "DATABASE_UNAVAILABLE" ? "La base de datos no está disponible. Configurá PostgreSQL e intentá nuevamente." : "No pudimos crear la cuenta. Revisá los datos e intentá nuevamente.");
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return <AuthPage register title="Tu negocio, conectado." description="Creá tu primer espacio de trabajo y empezá a ver el todo." submitLabel={loading ? "Creando..." : "Crear cuenta"} error={error} onSubmit={handleSubmit} footerHref="/login" footerLabel="Ya tengo una cuenta" />;
}