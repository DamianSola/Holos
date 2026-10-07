import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { FiscalPage } from "@/components/modules/fiscal-page";
import { requireBusinessPage } from "@/server/billing/access";
import { getFiscalScreen } from "@/server/services/fiscal-screen";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function FiscalRoute({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const { membership } = await requireBusinessPage(businessId);
  if (membership.role !== "OWNER") redirect(`/businesses/${businessId}`);
  const screen = getFiscalScreen(businessId);
  return (
    <WorkspaceShell businessId={businessId}>
      <FiscalForm businessId={businessId} screen={screen} />
    </WorkspaceShell>
  );
}

async function FiscalForm({ businessId, screen }: { businessId: string; screen: ReturnType<typeof getFiscalScreen> }) {
  return <FiscalPage key={businessId} businessId={businessId} initial={await screen} />;
}
