import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { businessContextCookie, type ShellBusiness } from "@/lib/business-context";
import { getSessionUser } from "@/server/auth/session";

export async function WorkspaceShell({ children, businessId }: { children: React.ReactNode; businessId?: string }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const stored = (await cookies()).get(businessContextCookie)?.value;
  const businesses: ShellBusiness[] = user.memberships
    .filter((membership) => !membership.business.deletedAt)
    .map((membership) => ({
      id: membership.business.id,
      name: membership.business.name,
      kind: membership.business.kind,
    }));
  const current =
    businesses.find((business) => business.id === businessId) ??
    businesses.find((business) => business.id === stored) ??
    businesses[0];

  return (
    <AppShell
      businessId={current?.id ?? ""}
      businessKind={current?.kind ?? "STORE"}
      businessName={current?.name ?? ""}
      businesses={businesses}
      userName={user.name ?? user.email}
    >
      {children}
    </AppShell>
  );
}
