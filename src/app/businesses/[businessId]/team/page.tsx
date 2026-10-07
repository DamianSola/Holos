import { TeamPage } from "@/components/modules/team-page";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { requireBusinessPage } from "@/server/billing/access";
import { getTeamScreen } from "@/server/services/team";

export const dynamic = "force-dynamic";

export default async function TeamRoute({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const { membership } = await requireBusinessPage(businessId);
  const screen = getTeamScreen(businessId);

  return (
    <WorkspaceShell businessId={businessId}>
      <TeamList businessId={businessId} role={membership.role} screen={screen} />
    </WorkspaceShell>
  );
}

async function TeamList({ businessId, role, screen }: { businessId: string; role: "OWNER" | "EMPLOYEE"; screen: ReturnType<typeof getTeamScreen> }) {
  const team = await screen;
  return <TeamPage key={businessId} businessId={businessId} initialRole={role} initialMemberships={team.memberships} initialInvitations={team.invitations} />;
}
