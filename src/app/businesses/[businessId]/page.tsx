import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { Dashboard } from "@/components/dashboard/dashboard";
import { prisma } from "@/lib/db";
import { requireBusinessPage } from "@/server/billing/access";

export const dynamic = "force-dynamic";

export default async function BusinessOverviewRoute({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const { membership } = await requireBusinessPage(businessId);
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { image: true } });

  return (
    <WorkspaceShell businessId={businessId}>
      <Dashboard businessId={businessId} businessName={membership.business.name} businessImage={business?.image} />
    </WorkspaceShell>
  );
}
