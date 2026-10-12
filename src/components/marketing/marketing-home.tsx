import Link from "next/link";
import { HolosLogo } from "@/components/brand/holos-logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { HOLOS_PLAN } from "@/server/billing/plan";

const points = ["Ventas", "Stock", "Clientes", "Pedidos", "Reservas", "Gastos"];

export function MarketingHome({ proof, monthlyArs }: { proof: { users: number; businesses: number } | null; monthlyArs: number }) {
  const price = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(monthlyArs);
  return (
    <div className="marketing">
      <header className="marketing-nav">
        <HolosLogo className="marketing-lockup" />
        <div className="marketing-nav-actions">
          <ThemeToggle />
          <Link className="marketing-nav-link" href="/login">Ingresar</Link>
          <Link className="marketing-cta marketing-cta-primary" href="/register">Empezar</Link>
        </div>
      </header>

      <main className="marketing-stage">
        <section className="marketing-hero" aria-labelledby="marketing-hero-title">
          <img className="marketing-mark" src="/brand/holos-mark.png" alt="" />
          <div className="marketing-hero-copy">
            <p className="eyebrow">Para el local</p>
            <h1 id="marketing-hero-title">El negocio,<span>entero.</span></h1>
            <p className="marketing-lead">Ventas, stock, clientes y el día, en un solo lugar.</p>
            {proof && (
              <ul className="marketing-proof">
                <li><strong>{formatCount(proof.users)}</strong><span>{proof.users === 1 ? "usuario" : "usuarios"}</span></li>
                <li><strong>{formatCount(proof.businesses)}</strong><span>{proof.businesses === 1 ? "negocio" : "negocios"}</span></li>
              </ul>
            )}
            <div className="marketing-actions">
              <Link className="marketing-cta marketing-cta-primary" href="/register">Empezar gratis</Link>
              <Link className="marketing-cta marketing-cta-ghost" href="/login">Ingresar</Link>
            </div>
            <p className="marketing-offer">{HOLOS_PLAN.trialDays} días gratis. Después {price} por mes.</p>
            <ul className="marketing-points">
              {points.map((point) => <li key={point}>{point}</li>)}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}

function formatCount(value: number) {
  return new Intl.NumberFormat("es-AR").format(value);
}
