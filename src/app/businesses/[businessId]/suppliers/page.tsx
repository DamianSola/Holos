import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { SuppliersPage } from "@/components/modules/suppliers-page";
import { requireBusinessPage } from "@/server/billing/access";

export default async function SuppliersRoute({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  await requireBusinessPage(businessId);
  return <WorkspaceShell businessId={businessId}><SuppliersPage businessId={businessId} /></WorkspaceShell>;
}
