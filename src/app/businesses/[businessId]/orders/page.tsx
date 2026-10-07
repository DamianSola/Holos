import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { OrdersPage } from "@/components/modules/orders-page";
import { ServiceReservationsPage } from "@/components/modules/service-reservations-page";
import { requireBusinessPage } from "@/server/billing/access";

export default async function OrdersRoute({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const { membership } = await requireBusinessPage(businessId);
  const kind = membership.business.kind;
  return (
    <WorkspaceShell businessId={businessId}>
      {kind === "SERVICE"
        ? <ServiceReservationsPage businessId={businessId} businessName={membership.business.name} />
        : <OrdersPage businessId={businessId} businessKind={kind} />}
    </WorkspaceShell>
  );
}
