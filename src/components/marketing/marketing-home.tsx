import Link from "next/link";
import { HolosLogo } from "@/components/brand/holos-logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const operation = [
  { step: "01", title: "Venta", detail: "Confirmás productos, cliente y cobro." },
  { step: "02", title: "Stock", detail: "Las unidades salen del inventario." },
  { step: "03", title: "Cliente", detail: "La compra queda en su historial." },
  { step: "04", title: "Factura", detail: "La venta deja su comprobante." },
  { step: "05", title: "Tablero", detail: "El día y el mes reflejan el movimiento." },
];

export function MarketingHome() {
  return (
    <div className="marketing">
      <header className="marketing-nav">
        <HolosLogo className="marketing-lockup" />
        <div className="marketing-nav-actions">
          <ThemeToggle />
          <Link className="marketing-nav-link" href="/login">Ingresar</Link>
          <Link className="marketing-cta marketing-cta-primary" href="/register">Crear cuenta</Link>
        </div>
      </header>

      <main>
        <div className="marketing-stage">
        <section className="marketing-hero" aria-labelledby="marketing-hero-title">
          <img className="marketing-mark" src="/brand/holos-mark.png" alt="" />
          <div className="marketing-hero-copy">
            <p className="eyebrow">Para comercios chicos</p>
            <h1 id="marketing-hero-title">El negocio,<span>entero.</span></h1>
            <p className="marketing-lead">
              Holos es la plataforma de gestión para quien atiende un local y también lo administra. Una venta actualiza stock, cliente, factura y tablero en la misma operación.
            </p>
            <div className="marketing-actions">
              <Link className="marketing-cta marketing-cta-primary" href="/register">Crear cuenta</Link>
              <Link className="marketing-cta marketing-cta-ghost" href="/login">Ingresar</Link>
            </div>
            <p className="marketing-audience">Dueños de indumentaria y retail chico en Argentina, y el equipo que trabaja con ellos.</p>
          </div>
        </section>

        <section className="marketing-operation" aria-labelledby="marketing-operation-title">
          <p className="eyebrow" id="marketing-operation-title">Una sola operación</p>
          <ol className="marketing-chain">
            {operation.map((item) => (
              <li key={item.step}>
                <span>{item.step}</span>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </li>
            ))}
          </ol>
        </section>
        </div>

        <section className="marketing-story" aria-labelledby="marketing-story-title">
          <div className="marketing-story-intro">
            <p className="eyebrow">Por qué Holos</p>
            <h2 id="marketing-story-title">Menos herramientas sueltas. Más negocio a la vista.</h2>
          </div>

          <div className="marketing-grid">
            <article>
              <p className="eyebrow">Qué hace</p>
              <h3>El día del local, en un solo lugar.</h3>
              <p>Productos, stock, clientes, ventas, proveedores, gastos y equipo. El tablero muestra las ventas de hoy, las del mes y el stock crítico. Si tenés más de un negocio, cada uno vive aparte.</p>
            </article>
            <article>
              <p className="eyebrow">Por qué es distinto</p>
              <h3>La venta mueve todo lo demás.</h3>
              <p>Otras herramientas guardan cada cosa en su cajón. Holos parte de la venta: descuenta stock, suma la compra al cliente, deja el comprobante y actualiza los números. No hay que reconciliarlos después.</p>
            </article>
            <article>
              <p className="eyebrow">Por qué es mejor</p>
              <h3>El dueño ve el todo. El equipo, su parte.</h3>
              <p>Un colaborador entra con un rol y no con las llaves del negocio. Los montos están en pesos. Una cuenta alcanza para más de un local, sin mezclar los datos de uno con los del otro.</p>
            </article>
            <article>
              <p className="eyebrow">Para quién</p>
              <h3>Quien vende y también cierra la caja.</h3>
              <p>Dueños de comercios chicos, sobre todo indumentaria y retail, que reponen, atienden y miran los números ellos mismos. También para quien lleva más de una marca y quiere un solo acceso.</p>
            </article>
            <article className="marketing-vision">
              <p className="eyebrow">Visión</p>
              <h3>Que cerrar el día sea ver el todo.</h3>
              <p>Un comercio chico no debería armar cinco sistemas para saber si el negocio está bien. Holos toma el nombre de esa idea: ver el local entero, de la venta al número del mes.</p>
              <Link className="marketing-cta marketing-cta-primary" href="/register">Empezar con una cuenta</Link>
              <p className="marketing-vision-note">Podés registrarte ahora y crear el primer negocio cuando quieras.</p>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
