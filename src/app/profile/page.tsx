import { AppShell } from "@/components/layout/app-shell";
import { ProfilePage } from "@/components/modules/profile-page";
import { getSessionUser } from "@/server/auth/session";
import { redirect } from "next/navigation";

export default async function ProfileRoute() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const membership = user.memberships[0];
  return (
    <AppShell businessId={membership?.businessId ?? user.memberships[0]?.businessId ?? ""} userName={user.name ?? user.email}>
      <ProfilePage />
    </AppShell>
  );
}
