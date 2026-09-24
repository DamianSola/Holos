import { AppShell } from "@/components/layout/app-shell";
import { Dashboard } from "@/components/dashboard/dashboard";
import { getSessionUser } from "@/server/auth/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function BusinessOverviewRoute({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const user = await getSessionUser();
  const membership = user?.memberships.find((item) => item.businessId === businessId);
  if (!user || !membership) redirect("/login");

  return (
    <AppShell businessId={businessId} userName={user.name ?? user.email}>
      <Dashboard businessId={businessId} businessName={membership.business.name} />
    </AppShell>
  );
}
