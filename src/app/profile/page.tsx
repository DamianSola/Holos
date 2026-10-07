import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { ProfilePage } from "@/components/modules/profile-page";
import { getSessionUser } from "@/server/auth/session";
import { redirect } from "next/navigation";

export default async function ProfileRoute() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <WorkspaceShell>
      <ProfilePage />
    </WorkspaceShell>
  );
}
