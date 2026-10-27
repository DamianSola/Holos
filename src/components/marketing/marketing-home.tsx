import Link from "next/link";
import { HolosLogo } from "@/components/brand/holos-logo";

const exampleBars = [42, 58, 46, 72, 63, 84, 76];
const exampleDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function MarketingHome({ proof, monthlyArs, trialDays }: { proof: { users: number; businesses: number } | null; monthlyArs: number; trialDays: number }) {
  const price = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(monthlyArs);
  const trialLine = trialDays > 0 ? `${trialDays} días de prueba. Después ${price} por mes.` : `Después ${price} por mes.`;

  return (
    <div className="marketing">
      <header className="marketing-nav">
        <Link href="/" aria-label="Holos">
          <HolosLogo className="marketing-lockup" />
        </Link>
        <div className="marketing-nav-actions">
          <Link className="marketing-nav-link" href="/login">Ingresar</Link>
          <Link className="marketing-cta marketing-cta-primary" href="/register">Empezar gratis</Link>
        </div>
      </header>

      <main>
        <section className="marketing-hero" aria-labelledby="marketing-hero-title">
          <div className="marketing-hero-copy">
            <p className="marketing-kicker">Gestión integral para tu negocio</p>
            <h1 id="marketing-hero-title">Tu negocio tiene muchas partes. <span className="title-break">Gestionarlas debería ser <em>más simple</em>.</span></h1>
            <p className="marketing-lead">Clientes, ventas, stock, tareas y equipo, conectados en una sola plataforma para que tengas todo bajo control y puedas dedicarte a hacer crecer tu negocio.</p>
            <div className="marketing-actions">
              <Link className="marketing-cta marketing-cta-primary" href="/register">Empezar gratis</Link>
              <a className="marketing-cta marketing-cta-secondary" href="#como-funciona">Descubrir cómo funciona</a>
            </div>
            <p className="marketing-trust">Pensado para emprendedores y negocios reales.</p>
            <p className="marketing-offer">{trialLine}</p>
          </div>
          <HeroDemo />
        </section>

        {proof ? (
          <section className="marketing-proof" aria-label="Holos en números">
            <p>Una comunidad que sigue creciendo</p>
            <ul>
              <li><strong>{formatCount(proof.users)}</strong><span>{proof.users === 1 ? "usuario registrado" : "usuarios registrados"}</span></li>
              <li><strong>{formatCount(proof.businesses)}</strong><span>{proof.businesses === 1 ? "negocio en Holos" : "negocios en Holos"}</span></li>
            </ul>
          </section>
        ) : null}

        <section className="marketing-how" id="como-funciona" aria-labelledby="como-funciona-title">
          <div className="marketing-how-copy">
            <p className="marketing-kicker">Cómo funciona</p>
            <h2 id="como-funciona-title">Una operación, y el resto del negocio se entera.</h2>
          </div>
          <ol>
            <li>
              <strong>Creás el negocio</strong>
              <span>Un local que vende productos, o un servicio que agenda turnos y cobra seña y saldo.</span>
            </li>
            <li>
              <strong>Registrás lo que pasa</strong>
              <span>Clientes, ventas, stock, gastos y tareas quedan en el mismo lugar.</span>
            </li>
            <li>
              <strong>Ves el conjunto</strong>
              <span>El tablero muestra el mes, lo que falta y en qué conviene mirar primero.</span>
            </li>
          </ol>
        </section>
      </main>

      <footer className="marketing-foot">
        <a href="/terminos">Términos</a>
        <a href="/privacidad">Privacidad</a>
      </footer>
    </div>
  );
}

function HeroDemo() {
  return (
    <div className="hero-demo">
      <div className="hero-window" aria-label="Ejemplo de la pantalla de un negocio. Los importes no son reales.">
        <div className="hero-side">
          <HolosLogo variant="mark" className="hero-mark" />
          <strong>Almacén Norte</strong>
          <span>Ejemplo</span>
          <ul className="hero-side-nav">
            <li className="is-on">Inicio</li>
            <li>Ventas</li>
            <li>Productos</li>
            <li>Tareas</li>
          </ul>
        </div>
        <div className="hero-main">
          <div>
            <p className="hero-kicker">Hoy en el negocio</p>
            <h2>Almacén Norte</h2>
          </div>
          <div className="hero-metrics">
            <article><span>Ingresos del mes</span><strong>$ 186.400</strong></article>
            <article><span>Ventas</span><strong>24</strong></article>
            <article><span>Stock bajo</span><strong>3</strong></article>
            <article><span>Tareas abiertas</span><strong>5</strong></article>
          </div>
          <div className="hero-chart" aria-hidden="true">
            {exampleBars.map((height, index) => <span key={exampleDays[index]} style={{ height: `${height}%` }} />)}
          </div>
          <p className="hero-chart-caption">Evolución de la semana, a modo de ejemplo.</p>
          <ul className="hero-activity">
            <li><span>Venta</span>Yerba 1 kg</li>
            <li><span>Cliente</span>Ana López</li>
            <li><span>Stock</span>Azúcar bajo el mínimo</li>
          </ul>
        </div>
      </div>
      <ul className="hero-modules">
        <li><strong>Clientes</strong><span>Quedan en la cuenta</span></li>
        <li><strong>Ventas</strong><span>Mueven el stock</span></li>
        <li><strong>Inventario</strong><span>Avisa lo que falta</span></li>
        <li><strong>Tareas</strong><span>Siguen a la vista</span></li>
        <li><strong>Equipo</strong><span>Comparte el negocio</span></li>
      </ul>
    </div>
  );
}

function formatCount(value: number) {
  return new Intl.NumberFormat("es-AR").format(value);
}
