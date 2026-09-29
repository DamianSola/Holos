import { AppShell } from "@/components/layout/app-shell";
import { Dashboard } from "@/components/dashboard/dashboard";
import { requireBusinessPage } from "@/server/billing/access";

export const dynamic = "force-dynamic";

export default async function BusinessOverviewRoute({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const { user, membership } = await requireBusinessPage(businessId);

  return (
    <AppShell businessId={businessId} businessKind={membership.business.kind} userName={user.name ?? user.email}>
      <Dashboard businessId={businessId} businessName={membership.business.name} />
    </AppShell>
  );
}
