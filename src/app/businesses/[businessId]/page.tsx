import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { Dashboard } from "@/components/dashboard/dashboard";
import { requireBusinessPage } from "@/server/billing/access";

export const dynamic = "force-dynamic";

export default async function BusinessOverviewRoute({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const { membership } = await requireBusinessPage(businessId);

  return (
    <WorkspaceShell businessId={businessId}>
      <Dashboard businessId={businessId} businessName={membership.business.name} businessImage={membership.business.image} />
    </WorkspaceShell>
  );
}
