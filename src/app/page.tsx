import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { MarketingHome } from "@/components/marketing/marketing-home";
import { BusinessPage } from "@/components/modules/business-page";
import { workspaceIsOpen } from "@/server/billing/access";
import { getSessionUser } from "@/server/auth/session";
import { getPortfolioDashboard } from "@/server/services/dashboard";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const user = await getSessionUser();
  if (user) return { title: "Holos" };
  return {
    title: "Holos — El negocio, entero",
    description: "Holos administra comercios chicos: una venta actualiza stock, cliente, factura y tablero. Varios negocios, equipo con roles, en pesos.",
  };
}

export default async function Home() {
  const user = await getSessionUser();
  if (!user) return <MarketingHome />;
  if (!(await workspaceIsOpen(user))) redirect("/billing");
  const portfolio = await getPortfolioDashboard(user.id);

  return (
    <AppShell businessId={user.memberships[0]?.businessId ?? ""} businessKind={user.memberships[0]?.business.kind ?? "STORE"} userName={user.name ?? user.email}>
      <BusinessPage initialPortfolio={portfolio} />
    </AppShell>
  );
}