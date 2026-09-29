import { AppShell } from "@/components/layout/app-shell";
import { SuppliersPage } from "@/components/modules/suppliers-page";
import { requireBusinessPage } from "@/server/billing/access";

export default async function SuppliersRoute({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const { user, membership } = await requireBusinessPage(businessId);
  return <AppShell businessId={businessId} businessKind={membership.business.kind} userName={user.name ?? user.email}><SuppliersPage businessId={businessId} /></AppShell>;
}
