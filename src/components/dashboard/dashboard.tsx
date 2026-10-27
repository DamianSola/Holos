import { getBusinessDashboard } from "@/server/services/dashboard";
import { MovementPeriod, StatusCard } from "@/components/dashboard/movement-period";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { TasksPanel } from "@/components/dashboard/tasks-panel";
import { orderRowPhrase } from "@/lib/order-progress";

type DashboardProps = { businessId: string; businessName: string; businessImage?: string | null };

export async function Dashboard({ businessId, businessName, businessImage }: DashboardProps) {
  const data = await getBusinessDashboard(businessId);
  const service = data.business?.kind === "SERVICE";
  const productWork = data.openProductOrders.map((order) => {
    const delivered = order.items.filter((item) => item.deliveredAt).length;
    const charge = order.amountMinor ?? order.items.reduce((total, item) => total + item.totalMinor, 0);
    const paid = order.payments.reduce((total, payment) => total + payment.amountMinor, 0);
    return { id: order.id, customerName: order.customer.name, delivered, total: order.items.length, charge, paid, due: Math.max(0, charge - paid), pending: order.items.length === 0 || delivered < order.items.length };
  });
  const dueMinor = service ? data.serviceDueMinor : productWork.reduce((total, order) => total + order.due, 0);
  const toDeliver = productWork.filter((order) => order.pending).length;
  const openWork = productWork.filter((order) => order.pending || order.due > 0).slice(0, 5);
  const todayLabel = data.scheduleMode === "TURN" ? "Turnos de hoy" : "Visitas de hoy";

  return (
    <div className="dashboard">
      <section className="dashboard-intro">
        <div>
          <p className="eyebrow">{service ? "Servicios" : "Venta de productos"}</p>
          <div className="identity-line">{businessImage ? <img className="business-logo" src={businessImage} alt="" /> : null}<h1>{businessName}</h1></div>
        </div>
        <a className="auth-submit" href={service ? `/businesses/${businessId}/orders` : `/businesses/${businessId}/sales`}>{service ? "Nueva reserva" : "Registrar venta"}</a>
      </section>

      <div className="metric-grid">
        <article className="summary-card"><span>Ingresos del mes</span><strong>{formatMoney(data.movement.month.incomeMinor)}</strong><small>Ventas de mostrador y cobros registrados.</small></article>
        <article className="summary-card"><span>Gastos del mes</span><strong>{formatMoney(data.movement.month.expensesMinor)}</strong><small>Los gastos no mueven el stock.</small></article>
        <article className="summary-card"><span>Resultado del mes</span><strong className={data.movement.month.incomeMinor - data.movement.month.expensesMinor >= 0 ? "metric-positive" : "metric-negative"}>{formatMoney(data.movement.month.incomeMinor - data.movement.month.expensesMinor)}</strong><small>Ingresos menos gastos.</small></article>
        <article className="summary-card"><span>Stock bajo</span><strong>{data.criticalCount}</strong><small>{data.emptyProducts} sin existencias · {data.activeProducts} activos</small></article>
      </div>

      <section className="today-work" aria-label="Hoy">
        <div className="status-grid">
          <StatusCard label="Entró hoy" value={formatMoney(data.salesTodayMinor)} tone="ready" />
          <StatusCard label="Por cobrar" value={formatMoney(dueMinor)} tone={dueMinor > 0 ? "pending" : "ready"} />
          <StatusCard label={service ? todayLabel : "Por entregar"} value={String(service ? data.todayVisits.length : toDeliver)} tone="ready" />
        </div>
        {service ? (
          data.todayVisits.length ? <div className="data-list">{data.todayVisits.map((visit) => <a className="data-row" key={visit.id} href={`/businesses/${businessId}/orders?pedido=${visit.id}`}><span>{visitTime(visit.scheduledFor)} · {visit.customer.name}{visit.title.trim() ? ` · ${visit.title.trim()}` : ""}</span></a>)}</div> : <div className="empty-state"><p>Hoy no hay {data.scheduleMode === "TURN" ? "turnos" : "visitas"}.</p></div>
        ) : openWork.length ? <div className="data-list">{openWork.map((order) => <a className="data-row" key={order.id} href={`/businesses/${businessId}/orders?pedido=${order.id}`}><span>{order.customerName}</span><strong>{orderRowPhrase("SCHEDULED", order.delivered, order.total, order.charge, order.paid, formatMoney)}</strong></a>)}</div> : <div className="empty-state"><p>No hay pedidos por entregar ni por cobrar.</p></div>}
      </section>

      <div id="movimiento">
        <MovementPeriod businessId={businessId} service={service} movement={data.movement} />
      </div>
      <div className="dashboard-split">
        <section className="panel">
          <div className="panel-heading"><h2>Ventas del mes por estado</h2></div>
          {data.saleStatuses.length ? <div className="status-pills">{data.saleStatuses.map((row) => <span key={row.status}>{saleStatus(row.status)} · {row.count}</span>)}</div> : <div className="empty-state"><p>Este mes no hay ventas cargadas.</p></div>}
        </section>
        <section className="panel">
          <div className="panel-heading"><h2>Más vendidos</h2></div>
          {data.topProducts.length ? (
            <table className="rank-table">
              <thead><tr><th>Producto</th><th>Unidades</th><th>Importe</th></tr></thead>
              <tbody>
                {data.topProducts.map((product) => <tr key={product.name}><td>{product.name}</td><td>{product.quantity}</td><td>{formatMoney(product.totalMinor)}</td></tr>)}
              </tbody>
            </table>
          ) : <div className="empty-state"><p>Todavía no hay ventas confirmadas este mes.</p></div>}
        </section>
      </div>
      <BusinessMonthChart trend={data.trend} />
      {data.criticalProducts.length > 0 && (
        <ul className="portfolio-alerts">
          {data.criticalProducts.map((product) => (
            <li key={product.id}><a href={`/businesses/${businessId}${service ? "/stock" : "/products"}`}>{product.name} · stock crítico</a></li>
          ))}
        </ul>
      )}

      <section className="panel sales-history">
        <div className="panel-heading"><div><h2>{service ? "Últimos cobros" : "Últimas ventas"}</h2></div></div>
        {service ? <ServiceCollections businessId={businessId} payments={data.recentPayments} sales={data.recentSales} /> : data.recentSales.length ? <div className="data-list">{data.recentSales.map((sale) => <a className="data-row" key={sale.id} href={`/businesses/${businessId}/sales?venta=${sale.id}`}><span>{rowWhen(sale.confirmedAt ?? sale.createdAt)} · {sale.customer?.name ?? "Consumidor final"} · {saleStatus(sale.status)}</span><strong>{formatMoney(sale.totalMinor)}</strong></a>)}</div> : <div className="empty-state"><p>Todavía no hay ventas registradas.</p></div>}
      </section>

      <section className="panel">
        <div className="panel-heading"><h2>Inventario</h2></div>
        <p className="intro-copy">{data.activeProducts} activos · {data.criticalCount} bajo el mínimo · {data.emptyProducts} sin existencias</p>
        {data.recentMovements.length ? <div className="data-list">{data.recentMovements.map((movement) => <div className="data-row" key={movement.id}><span>{movement.product.name} · {movementLabel(movement.type)} {movement.quantity > 0 ? "+" : ""}{movement.quantity}</span><strong>{rowWhen(movement.createdAt)}</strong></div>)}</div> : <div className="empty-state"><p>Todavía no hay movimientos de stock.</p></div>}
      </section>
      <RecentActivity events={data.activity.map((event) => ({ id: event.id, type: event.type, createdAt: event.createdAt.toISOString() }))} />
      <div id="tareas">
        <TasksPanel businessId={businessId} members={data.members.map((membership) => membership.user)} />
      </div>
    </div>
  );
}

function ServiceCollections({ businessId, payments, sales }: { businessId: string; payments: Array<{ id: string; amountMinor: number; paidAt: Date; order: { id: string; title: string; customer: { name: string } } }>; sales: Array<{ id: string; totalMinor: number; status: string; confirmedAt: Date | null; createdAt: Date; customer: { name: string } | null }> }) {
  const rows = [
    ...payments.map((payment) => ({ id: payment.id, href: `/businesses/${businessId}/orders?pedido=${payment.order.id}`, at: new Date(payment.paidAt).getTime(), label: `${rowWhen(payment.paidAt)} · ${payment.order.customer.name}${payment.order.title.trim() ? ` · ${payment.order.title.trim()}` : ""}`, amountMinor: payment.amountMinor })),
    ...sales.filter((sale) => sale.status === "CONFIRMED").map((sale) => ({ id: sale.id, href: `/businesses/${businessId}/sales?venta=${sale.id}`, at: new Date(sale.confirmedAt ?? sale.createdAt).getTime(), label: `${rowWhen(sale.confirmedAt ?? sale.createdAt)} · ${sale.customer?.name ?? "Cliente"}`, amountMinor: sale.totalMinor })),
  ].sort((left, right) => right.at - left.at).slice(0, 5);
  if (!rows.length) return <div className="empty-state"><p>Todavía no hay cobros registrados.</p></div>;
  return <div className="data-list">{rows.map((row) => <a className="data-row" key={row.id} href={row.href}><span>{row.label}</span><strong>{formatMoney(row.amountMinor)}</strong></a>)}</div>;
}

function BusinessMonthChart({ trend }: { trend: Array<{ label: string; current: boolean; incomeMinor: number; expensesMinor: number }> }) {
  const peak = Math.max(...trend.flatMap((period) => [period.incomeMinor, period.expensesMinor]), 1);
  const currentIndex = trend.findIndex((period) => period.current);
  const current = currentIndex >= 0 ? trend[currentIndex] : undefined;
  const previous = currentIndex > 0 ? trend[currentIndex - 1].incomeMinor : null;
  const phrase = incomePhrase(current?.incomeMinor ?? 0, previous);
  return (
    <section className="portfolio-chart panel" aria-label="Ingresos y gastos de los últimos 6 meses">
      <div className="panel-heading">
        <h2>Ingresos y gastos</h2>
        {phrase && <p className={deltaClass(previous === null || previous === 0 ? 0 : (current?.incomeMinor ?? 0) - previous)}>{phrase}</p>}
      </div>
      <div className="chart-legend">
        <span className="trend-income"><i className="trend-dot trend-income" />Ingresos</span>
        <span className="trend-expenses"><i className="trend-dot trend-expenses" />Gastos</span>
      </div>
      <div className="month-chart">
        {trend.map((period) => (
          <div className={period.current ? "month-chart-col is-current" : "month-chart-col"} key={`${period.label}-${period.current}`} aria-label={`${period.label}: ingresos ${formatMoney(period.incomeMinor)}, gastos ${formatMoney(period.expensesMinor)}`}>
            <div className="month-chart-bars" aria-hidden="true">
              <span className="month-bar income" style={{ height: `${barHeight(period.incomeMinor, peak)}%` }} />
              <span className="month-bar expense" style={{ height: `${barHeight(period.expensesMinor, peak)}%` }} />
            </div>
            <span className="month-chart-label">{period.label}{period.current ? " · actual" : ""}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function barHeight(value: number, peak: number) {
  if (value <= 0) return 0;
  return Math.max(8, Math.round((value / peak) * 100));
}

function incomePhrase(current: number, previous: number | null) {
  if (previous === null) return "";
  if (previous === 0) return current === 0 ? "Ingresos iguales al mes pasado" : "El mes pasado no hubo ingresos";
  const delta = Math.round(((current - previous) / Math.abs(previous)) * 100);
  if (delta === 0) return "Ingresos iguales al mes pasado";
  return `Ingresos ${delta > 0 ? "+" : ""}${delta}% respecto al mes pasado`;
}

function deltaClass(value: number | null) {
  if (value === null || value === 0) return "delta-flat";
  return value > 0 ? "delta-up" : "delta-down";
}

function rowWhen(value: Date) {
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(value).replace(".", "");
}

function saleStatus(status: string) {
  if (status === "CONFIRMED") return "Confirmada";
  if (status === "CANCELLED") return "Cancelada";
  return "Borrador";
}

function movementLabel(type: string) {
  if (type === "INITIAL") return "Inicial";
  if (type === "SALE") return "Venta";
  if (type === "RESTOCK") return "Ingreso";
  return "Ajuste";
}

function visitTime(value: Date) {
  return new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(value);
}

function formatMoney(valueMinor: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(valueMinor / 100);
}