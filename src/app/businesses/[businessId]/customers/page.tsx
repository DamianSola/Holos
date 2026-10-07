import { CustomersPage } from "@/components/modules/customers-page";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { requireBusinessPage } from "@/server/billing/access";

export default async function CustomersRoute({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  await requireBusinessPage(businessId);
  return <WorkspaceShell businessId={businessId}><CustomersPage businessId={businessId} /></WorkspaceShell>;
}
