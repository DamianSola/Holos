import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getSessionUser } from "@/server/auth/session";
import { SalesPage } from "@/components/modules/sales-page";

export default async function SalesRoute({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const user = await getSessionUser();
  const membership = user?.memberships.find((item) => item.businessId === businessId);
  if (!user || !membership) redirect("/login");
  return <AppShell businessId={businessId} userName={user.name ?? user.email}><SalesPage businessId={businessId} /></AppShell>;
}