import { getBusinessDashboard } from "@/server/services/dashboard";
import { MovementPeriod, StatusCard } from "@/components/dashboard/movement-period";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { TasksPanel } from "@/components/dashboard/tasks-panel";

type DashboardProps = { businessId: string; businessName: string; businessImage?: string | null };

export async function Dashboard({ businessId, businessName, businessImage }: DashboardProps) {
  const data = await getBusinessDashboard(businessId);
  const service = data.business?.kind === "SERVICE";

  return (
    <div className="dashboard">
      <section className="dashboard-intro">
        <div>
          <p className="eyebrow">Este negocio</p>
          <div className="identity-line">{businessImage ? <img className="business-logo" src={businessImage} alt="" /> : null}<h1>{businessName}</h1></div>
        </div>
        <span className="phase-badge">Negocio activo</span>
      </section>

      <MovementPeriod businessId={businessId} service={service} movement={data.movement} pulseHeading={service ? `${data.scheduledServices} reservas próximas y ${data.supplierCount} proveedores.` : `${data.productCount} productos y ${data.supplierCount} proveedores.`} activity={<RecentActivity events={data.activity.map((event) => ({ id: event.id, type: event.type, createdAt: event.createdAt.toISOString() }))} />}>
        {service ? <StatusCard label="Reservas próximas" value={String(data.scheduledServices)} tone="ready" /> : null}
        <StatusCard label="Stock crítico" value={String(data.criticalProducts)} tone={data.criticalProducts ? "pending" : "ready"} />
        <StatusCard label="Clientes" value={String(data.customers)} tone="ready" />
        <StatusCard label="Equipo" value={String(data.memberCount)} tone="ready" />
      </MovementPeriod>

      <section className="panel sales-history">
        <div className="panel-heading"><div><p className="eyebrow">Historial</p><h2>{service ? "Últimos cobros" : "Últimas ventas"}</h2></div><span className="panel-count">Historial permanente</span></div>
        {service ? <ServiceCollections payments={data.recentPayments} sales={data.recentSales} /> : data.recentSales.length ? <div className="data-list">{data.recentSales.map((sale) => <div className="data-row" key={sale.id}><span>{sale.customer?.name ?? "Consumidor final"} · {sale.status}</span><strong>{formatMoney(sale.totalMinor)}</strong></div>)}</div> : <div className="empty-state"><p>Todavía no hay ventas registradas.</p></div>}
      </section>

      <TasksPanel businessId={businessId} members={data.members.map((membership) => membership.user)} />
    </div>
  );
}

function ServiceCollections({ payments, sales }: { payments: Array<{ id: string; amountMinor: number; paidAt: Date; order: { title: string; customer: { name: string } } }>; sales: Array<{ id: string; totalMinor: number; status: string; confirmedAt: Date | null; createdAt: Date; customer: { name: string } | null }> }) {
  const rows = [
    ...payments.map((payment) => ({ id: payment.id, at: new Date(payment.paidAt).getTime(), label: payment.order.title.trim() ? `${payment.order.customer.name} · ${payment.order.title.trim()}` : payment.order.customer.name, amountMinor: payment.amountMinor })),
    ...sales.filter((sale) => sale.status === "CONFIRMED").map((sale) => ({ id: sale.id, at: new Date(sale.confirmedAt ?? sale.createdAt).getTime(), label: `${sale.customer?.name ?? "Cliente"} · venta anterior`, amountMinor: sale.totalMinor })),
  ].sort((left, right) => right.at - left.at).slice(0, 8);
  if (!rows.length) return <div className="empty-state"><p>Todavía no hay cobros registrados.</p></div>;
  return <div className="data-list">{rows.map((row) => <div className="data-row" key={row.id}><span>{row.label}</span><strong>{formatMoney(row.amountMinor)}</strong></div>)}</div>;
}

function formatMoney(valueMinor: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(valueMinor / 100);
}