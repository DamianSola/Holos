"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { businessContextCookie, rememberBusiness, type ShellBusiness } from "@/lib/business-context";

type AppShellProps = Readonly<{
  children: React.ReactNode;
  businessId: string;
  userName: string;
  businessKind?: "STORE" | "SERVICE";
  businessName?: string;
  businesses?: ShellBusiness[];
}>;

export function AppShell({ children, businessId, userName, businessKind = "STORE", businessName = "", businesses = [] }: AppShellProps) {
  const pathname = usePathname();
  const [isNavigationOpen, setNavigationOpen] = useState(false);

  useEffect(() => {
    const match = pathname.match(/^\/businesses\/([^/]+)/);
    if (!match?.[1]) return;
    const saved = document.cookie.split("; ").find((part) => part.startsWith(`${businessContextCookie}=`))?.slice(businessContextCookie.length + 1);
    if (saved === match[1]) return;
    rememberBusiness(match[1]);
  }, [pathname]);

  return (
    <div className="app-shell">
      <Sidebar
        businessId={businessId}
        businessKind={businessKind}
        businessName={businessName}
        businesses={businesses}
        isOpen={isNavigationOpen}
        onClose={() => setNavigationOpen(false)}
      />
      <div className="app-frame">
        <Header onMenuClick={() => setNavigationOpen(true)} userName={userName} businessId={businessId} businessKind={businessKind} />
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}