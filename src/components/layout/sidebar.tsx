"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { HolosLogo } from "@/components/brand/holos-logo";
import { rememberBusiness, type ShellBusiness } from "@/lib/business-context";

type SidebarProps = {
  businessId: string;
  businessKind?: "STORE" | "SERVICE";
  businessName?: string;
  businesses?: ShellBusiness[];
  isOpen: boolean;
  onClose: () => void;
};

type NavItem = { label: string; href: string };

export function Sidebar({ businessId, businessKind = "STORE", businessName = "", businesses = [], isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const service = businessKind === "SERVICE";
  const name = businessName || businesses.find((business) => business.id === businessId)?.name || "Este negocio";
  const operation: NavItem[] = businessId
    ? [
        ...(service ? [] : [{ label: "Ventas", href: `/businesses/${businessId}/sales` }]),
        { label: service ? "Reservas" : "Pedidos", href: `/businesses/${businessId}/orders` },
        ...(service ? [{ label: "Stock", href: `/businesses/${businessId}/stock` }] : [{ label: "Productos", href: `/businesses/${businessId}/products` }]),
        { label: "Clientes", href: `/businesses/${businessId}/customers` },
        { label: "Proveedores", href: `/businesses/${businessId}/suppliers` },
        { label: "Gastos", href: `/businesses/${businessId}/expenses` },
      ]
    : [];
  const admin: NavItem[] = businessId
    ? [
        { label: "Facturación", href: `/businesses/${businessId}/fiscal` },
        { label: "Equipo", href: `/businesses/${businessId}/team` },
      ]
    : [];
  const account: NavItem[] = [
    { label: "Plan", href: "/billing" },
    { label: "Perfil", href: "/profile" },
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
          <div className="sidebar-section-label">Operación</div>
          <nav>
            <ul className="navigation-list">
              <NavLink item={{ label: "Tablero", href: "/" }} pathname={pathname} onClose={onClose} />
              {businessId ? (
                <BusinessSwitch
                  businessId={businessId}
                  name={name}
                  businesses={businesses}
                  pathname={pathname}
                  onClose={onClose}
                />
              ) : null}
              {operation.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} onClose={onClose} />
              ))}
            </ul>
          </nav>
        </div>
        {admin.length > 0 && <NavGroup label="Administración" items={admin} pathname={pathname} onClose={onClose} />}
        <NavGroup label="Cuenta" items={account} pathname={pathname} onClose={onClose} />
        <div className="sidebar-footer">
          <HolosLogo variant="mark" className="sidebar-footer-mark" />
          <p>{service ? "La reserva cobra el servicio. El stock de insumos y herramientas se mueve aparte." : "Una venta mueve stock, cliente, factura y tablero."}</p>
        </div>
      </aside>
    </>
  );
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
        <span className="nav-mark" aria-hidden="true" />
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
        <span className="nav-mark" aria-hidden="true" />
        {item.label}
      </a>
    </li>
  );
}
