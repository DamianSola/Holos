"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="route-state"><h1>No pudimos cargar esta vista.</h1><p>Intentá nuevamente. Si el problema continúa, revisá la conexión del espacio de trabajo.</p><button className="auth-submit route-retry" type="button" onClick={reset}>Reintentar</button></main>;
}