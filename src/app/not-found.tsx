import Link from "next/link";
import { HolosLogo } from "@/components/brand/holos-logo";

export default function NotFound() {
  return (
    <main className="route-state">
      <HolosLogo />
      <h1>Esa vista no existe.</h1>
      <p>La dirección no corresponde a ninguna operación de Holos.</p>
      <Link className="auth-submit route-retry" href="/">Volver al tablero</Link>
    </main>
  );
}
