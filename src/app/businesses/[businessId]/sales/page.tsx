import { AppShell } from "@/components/layout/app-shell";
import { SalesPage } from "@/components/modules/sales-page";
import { ServiceSalesPage } from "@/components/modules/service-sales-page";
import { requireBusinessPage } from "@/server/billing/access";

export default async function SalesRoute({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const { user, membership } = await requireBusinessPage(businessId);
  const kind = membership.business.kind;
  return (
    <AppShell businessId={businessId} businessKind={kind} userName={user.name ?? user.email}>
      {kind === "SERVICE" ? <ServiceSalesPage businessId={businessId} /> : <SalesPage businessId={businessId} />}
    </AppShell>
  );
}
