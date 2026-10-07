import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { ExpensesPage } from "@/components/modules/expenses-page";
import { requireBusinessPage } from "@/server/billing/access";

export default async function ExpensesRoute({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  await requireBusinessPage(businessId);
  return <WorkspaceShell businessId={businessId}><ExpensesPage businessId={businessId} /></WorkspaceShell>;
}
