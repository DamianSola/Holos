import type { Metadata } from "next";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { MarketingHome } from "@/components/marketing/marketing-home";
import { BusinessPage } from "@/components/modules/business-page";
import { workspaceIsOpen } from "@/server/billing/access";
import { getSessionUser } from "@/server/auth/session";
import { prisma } from "@/lib/db";
import { monthlyAmountArs } from "@/server/billing/plan";
import { getPortfolioDashboard } from "@/server/services/dashboard";
import { getBusinessDirectory } from "@/server/services/directory";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const user = await getSessionUser();
  if (user) return { title: "Holos" };
  return {
    title: "Holos — El negocio, entero",
    description: "Ventas, stock, clientes y el día del negocio, en un solo lugar. 14 días gratis.",
  };
}

export default async function Home() {
  const user = await getSessionUser();
  if (!user) return <MarketingHome proof={await publicProof()} monthlyArs={monthlyAmountArs()} />;
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

async function publicProof() {
  try {
    const [users, businesses] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null, status: "ACTIVE" } }),
      prisma.business.count({ where: { deletedAt: null } }),
    ]);
    return { users, businesses };
  } catch {
    return null;
  }
}
