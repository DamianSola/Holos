import { TeamPage } from "@/components/modules/team-page";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { requireBusinessPage } from "@/server/billing/access";

export default async function TeamRoute({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  await requireBusinessPage(businessId);

  return (
    <WorkspaceShell businessId={businessId}>
      <TeamPage businessId={businessId} />
    </WorkspaceShell>
  );
}
