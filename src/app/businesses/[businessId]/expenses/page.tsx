import { AppShell } from "@/components/layout/app-shell";
import { ExpensesPage } from "@/components/modules/expenses-page";
import { requireBusinessPage } from "@/server/billing/access";

export default async function ExpensesRoute({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const { user, membership } = await requireBusinessPage(businessId);
  return <AppShell businessId={businessId} businessKind={membership.business.kind} userName={user.name ?? user.email}><ExpensesPage businessId={businessId} /></AppShell>;
}
