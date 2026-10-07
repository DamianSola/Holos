import type { Metadata } from "next";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { MarketingHome } from "@/components/marketing/marketing-home";
import { BusinessPage } from "@/components/modules/business-page";
import { workspaceIsOpen } from "@/server/billing/access";
import { getSessionUser } from "@/server/auth/session";
import { getPortfolioDashboard } from "@/server/services/dashboard";
import { getBusinessDirectory } from "@/server/services/directory";
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
  const [portfolio, directory] = await Promise.all([
    getPortfolioDashboard(user.id),
    getBusinessDirectory(user.id),
  ]);

  return (
    <WorkspaceShell>
      <BusinessPage initialPortfolio={portfolio} initialBusinesses={directory} />
    </WorkspaceShell>
  );
}