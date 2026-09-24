"use client";

import { useState } from "react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NotificationBell } from "@/components/layout/notification-bell";

type HeaderProps = {
  onMenuClick: () => void;
  userName: string;
  businessId: string;
};

export function Header({ onMenuClick, userName, businessId }: HeaderProps) {
  const [isUserMenuOpen, setUserMenuOpen] = useState(false);
  const [isLoggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/v1/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <header className="topbar">
      <button className="menu-button" type="button" aria-label="Open navigation" onClick={onMenuClick}>
        <span aria-hidden="true">Menu</span>
      </button>
      <div className="breadcrumbs" aria-label="Breadcrumb">
        <span>Workspace</span>
        <span aria-hidden="true">/</span>
        <strong>Overview</strong>
      </div>
      <div className="topbar-actions">
        <ThemeToggle />
        <NotificationBell businessId={businessId} />
        <div className="user-menu">
          <button className="current-user" type="button" aria-expanded={isUserMenuOpen} aria-haspopup="menu" aria-label="Abrir menú de usuario" onClick={() => setUserMenuOpen((value) => !value)}>
          <span className="avatar" aria-hidden="true">?</span>
          <span className="current-user-copy">
            <strong>{userName}</strong>
            <small>Authenticated</small>
          </span>
          </button>
          {isUserMenuOpen && <div className="user-menu-popover" role="menu">
            <a href="/profile" role="menuitem" onClick={() => setUserMenuOpen(false)}>Ver perfil</a>
            <button type="button" role="menuitem" onClick={() => void logout()} disabled={isLoggingOut}>{isLoggingOut ? "Cerrando sesión..." : "Cerrar sesión"}</button>
          </div>}
        </div>
      </div>
    </header>
  );
}