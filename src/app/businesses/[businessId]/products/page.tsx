import { ProductsPage } from "@/components/modules/products-page";
import { AppShell } from "@/components/layout/app-shell";
import { requireBusinessPage } from "@/server/billing/access";

export default async function ProductsRoute({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const { user, membership } = await requireBusinessPage(businessId);
  const kind = membership.business.kind;
  return (
    <AppShell businessId={businessId} businessKind={kind} userName={user.name ?? user.email}>
      {kind === "SERVICE" ? (
        <section className="module-page">
          <p className="eyebrow">Operación</p>
          <h1>Este negocio ofrece servicios</h1>
          <p className="module-description">No hay catálogo ni stock. Agendá el trabajo en Reservas y, cuando lo cobrás, cargá la venta con el presupuesto, el lugar y qué incluye.</p>
          <a className="secondary-button" href={`/businesses/${businessId}/sales`}>Ir a ventas</a>
        </section>
      ) : <ProductsPage businessId={businessId} />}
    </AppShell>
  );
}
