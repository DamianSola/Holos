import { AppShell } from "@/components/layout/app-shell";
import { FiscalPage } from "@/components/modules/fiscal-page";
import { requireBusinessPage } from "@/server/billing/access";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function FiscalRoute({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const { user, membership } = await requireBusinessPage(businessId);
  if (membership.role !== "OWNER") redirect(`/businesses/${businessId}`);
  return (
    <AppShell businessId={businessId} businessKind={membership.business.kind} userName={user.name ?? user.email}>
      <FiscalPage businessId={businessId} />
    </AppShell>
  );
}
