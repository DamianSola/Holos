import { HolosLogo } from "@/components/brand/holos-logo";

export default function Loading() {
  return (
    <main className="route-state" aria-busy="true">
      <HolosLogo variant="mark" className="route-mark" />
      <p>Cargando el espacio de trabajo</p>
    </main>
  );
}
