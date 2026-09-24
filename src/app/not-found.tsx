import Link from "next/link";

export default function NotFound() {
  return <main className="route-state"><h1>Vista no encontrada.</h1><p>La dirección que buscaste no existe.</p><Link className="auth-footer-link" href="/">Volver al inicio</Link></main>;
}