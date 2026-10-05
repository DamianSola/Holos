import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { SalesPage } from "@/components/modules/sales-page";
import { requireBusinessPage } from "@/server/billing/access";

export default async function SalesRoute({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const { user, membership } = await requireBusinessPage(businessId);
  const kind = membership.business.kind;
  if (kind === "SERVICE") redirect(`/businesses/${businessId}/orders` as never);
  return (
    <AppShell businessId={businessId} businessKind={kind} userName={user.name ?? user.email}>
      <SalesPage businessId={businessId} businessName={membership.business.name} />
    </AppShell>
  );
}
