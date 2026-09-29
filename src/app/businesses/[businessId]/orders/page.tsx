import { AppShell } from "@/components/layout/app-shell";
import { OrdersPage } from "@/components/modules/orders-page";
import { requireBusinessPage } from "@/server/billing/access";

export default async function OrdersRoute({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const { user, membership } = await requireBusinessPage(businessId);
  const kind = membership.business.kind;
  return (
    <AppShell businessId={businessId} businessKind={kind} userName={user.name ?? user.email}>
      <OrdersPage businessId={businessId} businessKind={kind} />
    </AppShell>
  );
}
