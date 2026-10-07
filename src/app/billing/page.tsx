import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { BillingPage } from "@/components/modules/billing-page";
import { getSessionUser } from "@/server/auth/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function BillingRoute({ searchParams }: { searchParams: Promise<{ bloqueado?: string; pago?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const query = await searchParams;
  return (
    <WorkspaceShell>
      <BillingPage ownerBlocked={query.bloqueado === "dueno"} paymentState={query.pago ?? ""} />
    </WorkspaceShell>
  );
}
