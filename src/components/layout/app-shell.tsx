"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

type AppShellProps = Readonly<{ children: React.ReactNode; businessId: string; userName: string; businessKind?: "STORE" | "SERVICE" }>;

export function AppShell({ children, businessId, userName, businessKind = "STORE" }: AppShellProps) {
  const [isNavigationOpen, setNavigationOpen] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar businessId={businessId} businessKind={businessKind} isOpen={isNavigationOpen} onClose={() => setNavigationOpen(false)} />
      <div className="app-frame">
        <Header onMenuClick={() => setNavigationOpen(true)} userName={userName} businessId={businessId} businessKind={businessKind} />
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}