import { getBusinessDashboard } from "@/server/services/dashboard";
import { TasksPanel } from "@/components/dashboard/tasks-panel";

type DashboardProps = { businessId: string; businessName: string };

export async function Dashboard({ businessId, businessName }: DashboardProps) {
  const data = await getBusinessDashboard(businessId);
  const service = data.business?.kind === "SERVICE";

  return (
    <div className="dashboard">
      <section className="dashboard-intro">
        <div>
          <p className="eyebrow">Este negocio</p>
          <h1>{businessName}</h1>
          <p className="intro-copy">Una visión conectada de tu negocio, con cada operación reflejada en el resto del sistema.</p>
        </div>
        <span className="phase-badge">Negocio activo</span>
      </section>

      <section className="status-grid" aria-label="Business metrics">
        <StatusCard label="Ventas del mes" value={formatMoney(data.salesMonthMinor)} detail="Ventas confirmadas este mes." tone="ready" />
        <StatusCard label="Gastos del mes" value={formatMoney(data.expensesMonthMinor)} detail="Gastos registrados este mes." tone="pending" />
        <StatusCard label="Ventas de hoy" value={formatMoney(data.salesTodayMinor)} detail="Ventas confirmadas desde medianoche." tone="ready" />
        {service ? <StatusCard label="Reservas próximas" value={String(data.scheduledServices)} detail="Servicios agendados que todavía no se cumplieron." tone="ready" /> : <StatusCard label="Stock crítico" value={String(data.criticalProducts)} detail="Productos en stock mínimo o inferior." tone={data.criticalProducts ? "pending" : "ready"} />}
        <StatusCard label="Clientes" value={String(data.customers)} detail="Clientes activos del negocio." tone="ready" />
        <StatusCard label="Equipo" value={String(data.memberCount)} detail="Miembros con acceso a este negocio." tone="ready" />
      </section>

      <section className="dashboard-lower-grid">
        <div className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Actividad</p>
              <h2>Movimientos recientes</h2>
            </div>
            <span className="panel-count">{data.activity.length}</span>
          </div>
          {data.activity.length ? <div className="data-list">{data.activity.map((event) => <div className="data-row" key={event.id}><span>{event.type}</span><span>{new Date(event.createdAt).toLocaleString("es-AR")}</span></div>)}</div> : <div className="empty-state"><span className="empty-state-mark" aria-hidden="true">—</span><p>Todavía no hay actividad registrada.</p></div>}
        </div>

        <div className="panel next-panel">
          <p className="eyebrow">Pulso</p>
          <h2>{service ? `${data.scheduledServices} reservas próximas y ${data.supplierCount} proveedores.` : `${data.productCount} productos y ${data.supplierCount} proveedores.`}</h2>
          <p>{service ? `Los gastos del período suman ${formatMoney(data.expensesMonthMinor)}.` : `${data.productsSold} unidades vendidas este mes. Los gastos del período suman ${formatMoney(data.expensesMonthMinor)}.`}</p>
          <span className="panel-note">Datos actualizados desde PostgreSQL</span>
        </div>
      </section>

      <section className="panel sales-history">
        <div className="panel-heading"><div><p className="eyebrow">Historial</p><h2>Últimas ventas</h2></div><span className="panel-count">Historial permanente</span></div>
        {data.recentSales.length ? <div className="data-list">{data.recentSales.map((sale) => <div className="data-row" key={sale.id}><span>{sale.customer?.name ?? "Consumidor final"} · {sale.status}</span><strong>{formatMoney(sale.totalMinor)}</strong></div>)}</div> : <div className="empty-state"><p>Todavía no hay ventas registradas.</p></div>}
      </section>

      <TasksPanel businessId={businessId} members={data.members.map((membership) => membership.user)} />
    </div>
  );
}

type StatusCardProps = {
  label: string;
  value: string;
  detail: string;
  tone: "ready" | "pending";
};

function StatusCard({ label, value, detail, tone }: StatusCardProps) {
  return (
    <article className="status-card">
      <div className="status-card-topline">
        <span className="status-label">{label}</span>
        <span className={`status-dot status-dot-${tone}`} aria-label={tone === "ready" ? "Ready" : "Pending"} />
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function formatMoney(valueMinor: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(valueMinor / 100);
}