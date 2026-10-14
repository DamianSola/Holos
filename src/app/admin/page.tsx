import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { AdminPage } from "@/components/modules/admin-page";
import { getSessionUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminRoute() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.platformAdmin) redirect("/");
  return (
    <WorkspaceShell>
      <AdminPage />
    </WorkspaceShell>
  );
}
