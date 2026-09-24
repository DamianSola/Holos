import { TeamPage } from "@/components/modules/team-page";
import { AppShell } from "@/components/layout/app-shell";
import { getSessionUser } from "@/server/auth/session";
import { redirect } from "next/navigation";

export default async function TeamRoute({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const user = await getSessionUser();
  const membership = user?.memberships.find((item) => item.businessId === businessId);
  if (!user || !membership) redirect("/login");

  return (
    <AppShell businessId={businessId} userName={user.name ?? user.email}>
      <TeamPage businessId={businessId} />
    </AppShell>
  );
}