"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HolosLogo } from "@/components/brand/holos-logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NotificationBell } from "@/components/layout/notification-bell";
import type { ShellNotification } from "@/lib/shell-notification";

type HeaderProps = {
  onMenuClick: () => void;
  userName: string;
  businessId: string;
  businessKind?: "STORE" | "SERVICE";
  userImage?: string | null;
  businessImage?: string | null;
  notifications?: ShellNotification[];
};

export function Header({ onMenuClick, userName, businessId, businessKind = "STORE", userImage = "", businessImage = "", notifications = [] }: HeaderProps) {
  const pathname = usePathname();
  const [isUserMenuOpen, setUserMenuOpen] = useState(false);
  const [isLoggingOut, setLoggingOut] = useState(false);
  const section = sectionLabel(pathname, businessKind);
  const showBusinessLogo = Boolean(businessImage) && pathname.startsWith("/businesses/");

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/v1/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <header className="topbar">
      <div className="topbar-leading">
        <button className="menu-button" type="button" aria-label="Abrir navegación" onClick={onMenuClick}>
          Menú
        </button>
        <Link className="topbar-mark" href="/" aria-label="Ir al tablero">
          <HolosLogo variant="mark" />
        </Link>
        {showBusinessLogo ? <img className="business-logo" src={businessImage ?? ""} alt="" /> : null}
        <div className="breadcrumbs" aria-label="Ubicación">
          {section === "Tablero" ? <strong>Tablero</strong> : <><Link href="/">Tablero</Link><span aria-hidden="true">/</span><strong>{section}</strong></>}
        </div>
      </div>
      <div className="topbar-actions">
        <ThemeToggle />
        <NotificationBell key={`${businessId}:${pathname}`} businessId={businessId} initialItems={notifications} />
        <div className="user-menu">
          <button className="current-user" type="button" aria-expanded={isUserMenuOpen} aria-haspopup="menu" aria-label="Abrir menú de usuario" onClick={() => setUserMenuOpen((value) => !value)}>
            <span className="avatar" aria-hidden="true">{userImage ? <img src={userImage} alt="" /> : initials(userName)}</span>
            <span className="current-user-copy">
              <strong>{userName}</strong>
              <small>Sesión activa</small>
            </span>
          </button>
          {isUserMenuOpen && (
            <div className="user-menu-popover" role="menu">
              <Link href="/billing" role="menuitem" onClick={() => setUserMenuOpen(false)}>Plan</Link>
              <Link href="/profile" role="menuitem" onClick={() => setUserMenuOpen(false)}>Ver perfil</Link>
              <button type="button" role="menuitem" onClick={() => void logout()} disabled={isLoggingOut}>{isLoggingOut ? "Cerrando sesión..." : "Cerrar sesión"}</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return letters || "H";
}

function sectionLabel(pathname: string, businessKind: "STORE" | "SERVICE") {
  if (pathname === "/") return "Tablero";
  if (pathname.startsWith("/profile")) return "Perfil";
  if (pathname.startsWith("/billing")) return "Plan";
  if (pathname.endsWith("/fiscal")) return "Facturación";
  if (pathname.endsWith("/sales")) return "Ventas";
  if (pathname.endsWith("/orders")) return businessKind === "SERVICE" ? "Reservas" : "Pedidos";
  if (pathname.endsWith("/products")) return "Productos";
  if (pathname.endsWith("/stock")) return "Stock";
  if (pathname.endsWith("/customers")) return "Clientes";
  if (pathname.endsWith("/suppliers")) return "Proveedores";
  if (pathname.endsWith("/expenses")) return "Gastos";
  if (pathname.endsWith("/team")) return "Equipo";
  if (pathname.startsWith("/businesses/")) return "Negocio";
  return "Holos";
}
