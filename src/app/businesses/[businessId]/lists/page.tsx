import { ListsPage } from "@/components/modules/lists-page";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { requireBusinessPage } from "@/server/billing/access";

export default async function ListsRoute({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  await requireBusinessPage(businessId);
  return (
    <WorkspaceShell businessId={businessId}>
      <ListsPage businessId={businessId} />
    </WorkspaceShell>
  );
}
