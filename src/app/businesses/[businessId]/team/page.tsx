import { TeamPage } from "@/components/modules/team-page";
import { AppShell } from "@/components/layout/app-shell";
import { requireBusinessPage } from "@/server/billing/access";

export default async function TeamRoute({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const { user, membership } = await requireBusinessPage(businessId);

  return (
    <AppShell businessId={businessId} businessKind={membership.business.kind} userName={user.name ?? user.email}>
      <TeamPage businessId={businessId} />
    </AppShell>
  );
}
