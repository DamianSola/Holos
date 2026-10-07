import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { FiscalPage } from "@/components/modules/fiscal-page";
import { requireBusinessPage } from "@/server/billing/access";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function FiscalRoute({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const { membership } = await requireBusinessPage(businessId);
  if (membership.role !== "OWNER") redirect(`/businesses/${businessId}`);
  return (
    <WorkspaceShell businessId={businessId}>
      <FiscalPage businessId={businessId} />
    </WorkspaceShell>
  );
}
