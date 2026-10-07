import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { SalesPage } from "@/components/modules/sales-page";
import { requireBusinessPage } from "@/server/billing/access";

export default async function SalesRoute({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const { membership } = await requireBusinessPage(businessId);
  const kind = membership.business.kind;
  if (kind === "SERVICE") redirect(`/businesses/${businessId}/orders` as never);
  return (
    <WorkspaceShell businessId={businessId}>
      <SalesPage businessId={businessId} businessName={membership.business.name} />
    </WorkspaceShell>
  );
}
