import { CustomersPage } from "@/components/modules/customers-page";
import { AppShell } from "@/components/layout/app-shell";
import { requireBusinessPage } from "@/server/billing/access";

export default async function CustomersRoute({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const { user, membership } = await requireBusinessPage(businessId);
  return <AppShell businessId={businessId} businessKind={membership.business.kind} userName={user.name ?? user.email}><CustomersPage businessId={businessId} /></AppShell>;
}
