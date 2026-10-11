import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { OrdersPage } from "@/components/modules/orders-page";
import { ServiceReservationsPage } from "@/components/modules/service-reservations-page";
import { requireBusinessPage } from "@/server/billing/access";

export default async function OrdersRoute({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<{ pedido?: string | string[] }> }) {
  const { businessId } = await params;
  const { pedido } = await searchParams;
  const openOrderId = typeof pedido === "string" ? pedido : undefined;
  const { membership } = await requireBusinessPage(businessId);
  const kind = membership.business.kind;
  return (
    <WorkspaceShell businessId={businessId}>
      {kind === "SERVICE"
        ? <ServiceReservationsPage businessId={businessId} businessName={membership.business.name} />
        : <OrdersPage businessId={businessId} businessKind={kind} openOrderId={openOrderId} />}
    </WorkspaceShell>
  );
}
