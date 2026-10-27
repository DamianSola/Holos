"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { HolosLogo } from "@/components/brand/holos-logo";
import { NavIcon, type NavIconName } from "@/components/brand/nav-icons";
import { rememberBusiness, type ShellBusiness } from "@/lib/business-context";

type SidebarProps = {
  businessId: string;
  businessKind?: "STORE" | "SERVICE";
  businessName?: string;
  businesses?: ShellBusiness[];
  platformAdmin?: boolean;
  userName?: string;
  isOpen: boolean;
  onClose: () => void;
};

type NavItem = { label: string; href: string; icon: NavIconName };

export function Sidebar({ businessId, businessKind = "STORE", businessName = "", businesses = [], platformAdmin = false, userName = "", isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const routeId = pathname.match(/^\/businesses\/([^/]+)/)?.[1] ?? "";
  const inside = Boolean(routeId);
  const active = businesses.find((business) => business.id === routeId);
  const service = (active?.kind ?? businessKind) === "SERVICE";
  const currentId = routeId || businessId;
  const name = active?.name || businessName || "Este negocio";
  const isOwner = active?.role === "OWNER";
  const operation: NavItem[] = inside
    ? [
        { label: "Inicio", href: `/businesses/${currentId}`, icon: "board" },
        { label: "Tareas", href: `/businesses/${currentId}#tareas`, icon: "list" },
        ...(service ? [] : [{ label: "Ventas", href: `/businesses/${currentId}/sales`, icon: "sale" as const }]),
        { label: service ? "Reservas" : "Pedidos", href: `/businesses/${currentId}/orders`, icon: service ? "calendar" as const : "order" as const },
        ...(service ? [{ label: "Stock", href: `/businesses/${currentId}/stock`, icon: "stock" as const }] : [{ label: "Productos", href: `/businesses/${currentId}/products`, icon: "product" as const }]),
        { label: "Clientes", href: `/businesses/${currentId}/customers`, icon: "customer" as const },
        { label: "Proveedores", href: `/businesses/${currentId}/suppliers`, icon: "supplier" as const },
        { label: "Gastos", href: `/businesses/${currentId}/expenses`, icon: "expense" as const },
        { label: "Listas", href: `/businesses/${currentId}/lists`, icon: "list" as const },
      ]
    : [{ label: "Inicio", href: "/", icon: "board" }];
  const admin: NavItem[] = inside
    ? [
        ...(isOwner ? [{ label: "Facturación", href: `/businesses/${currentId}/fiscal`, icon: "invoice" as const }] : []),
        { label: "Equipo", href: `/businesses/${currentId}/team`, icon: "team" as const },
      ]
    : [];
  const account: NavItem[] = [
    ...(platformAdmin ? [{ label: "Admin", href: "/admin", icon: "admin" as const }] : []),
    { label: "Plan", href: "/billing", icon: "plan" },
    { label: "Perfil", href: "/profile", icon: "profile" },
  ];

  return (
    <>
      <button
        className={`navigation-backdrop${isOpen ? " is-visible" : ""}`}
        type="button"
        aria-label="Cerrar navegación"
        onClick={onClose}
      />
      <aside className={`sidebar${isOpen ? " is-open" : ""}`} aria-label="Navegación principal">
        <a className="sidebar-brand" href="/" onClick={onClose}>
          <HolosLogo />
        </a>
        <div className="sidebar-group">
          <div className="sidebar-section-label">{inside ? "Este negocio" : "General"}</div>
          <nav>
            <ul className="navigation-list">
              {inside ? (
                <BusinessSwitch
                  businessId={currentId}
                  name={name}
                  businesses={businesses}
                  pathname={pathname}
                  onClose={onClose}
                />
              ) : null}
              {operation.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} onClose={onClose} />
              ))}
              {inside ? null : businesses.map((business) => (
                <li key={business.id}>
                  <a className="navigation-link" href={`/businesses/${business.id}`} onClick={() => { rememberBusiness(business.id); onClose(); }}>
                    <NavIcon name="store" />
                    <span className="business-switch-name">{business.name}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        {admin.length > 0 && <NavGroup label="Administración" items={admin} pathname={pathname} onClose={onClose} />}
        <NavGroup label="Cuenta" items={account} pathname={pathname} onClose={onClose} />
        {inside ? <a className="sidebar-back" href="/" onClick={onClose}>Volver al resumen general</a> : null}
        <div className="sidebar-user">
          <span className="avatar" aria-hidden="true">{initials(userName)}</span>
          <div>
            <strong>{userName || "Tu cuenta"}</strong>
            <button type="button" onClick={() => void logout()}>Cerrar sesión</button>
          </div>
        </div>
      </aside>
    </>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toLocaleUpperCase("es-AR") ?? "").join("") || "H";
}

async function logout() {
  await fetch("/api/v1/auth/logout", { method: "POST" });
  window.location.href = "/login";
}

function BusinessSwitch({
  businessId,
  name,
  businesses,
  pathname,
  onClose,
}: {
  businessId: string;
  name: string;
  businesses: ShellBusiness[];
  pathname: string;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLLIElement>(null);
  const others = businesses.filter((business) => business.id !== businessId);
  const href = `/businesses/${businessId}`;
  const active = pathname === href;

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <li className={`business-switch${open ? " is-open" : ""}`} ref={rootRef}>
      <a className={`navigation-link${active ? " is-active" : ""}`} href={href} aria-current={active ? "page" : undefined} onClick={onClose}>
        <NavIcon name="store" />
        <span className="business-switch-name">{name}</span>
      </a>
      {others.length > 0 && (
        <button
          className="business-switch-toggle"
          type="button"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="Otros negocios"
          onClick={() => setOpen((value) => !value)}
        />
      )}
      {open && others.length > 0 && (
        <ul className="business-switch-menu" role="menu">
          {others.map((business) => (
            <li key={business.id} role="none">
              <a
                role="menuitem"
                href={`/businesses/${business.id}`}
                onClick={() => {
                  rememberBusiness(business.id);
                  onClose();
                }}
              >
                {business.name}
              </a>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function NavGroup({ label, items, pathname, onClose }: { label: string; items: NavItem[]; pathname: string; onClose: () => void }) {
  return (
    <div className="sidebar-group">
      <div className="sidebar-section-label">{label}</div>
      <nav>
        <ul className="navigation-list">
          {items.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} onClose={onClose} />
          ))}
        </ul>
      </nav>
    </div>
  );
}

function NavLink({ item, pathname, onClose }: { item: NavItem; pathname: string; onClose: () => void }) {
  const active = item.href === "/" ? pathname === "/" : pathname === item.href;
  return (
    <li>
      <a className={`navigation-link${active ? " is-active" : ""}`} href={item.href} aria-current={active ? "page" : undefined} onClick={onClose}>
        <NavIcon name={item.icon} />
        {item.label}
      </a>
    </li>
  );
}
