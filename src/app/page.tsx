import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { BusinessPage } from "@/components/modules/business-page";
import { getSessionUser } from "@/server/auth/session";
import { getPortfolioDashboard } from "@/server/services/dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const portfolio = await getPortfolioDashboard(user.id);

  return (
    <AppShell businessId={user.memberships[0]?.businessId ?? ""} userName={user.name ?? user.email}>
      <BusinessPage initialPortfolio={portfolio} />
    </AppShell>
  );
}