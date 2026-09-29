"use client";

import { usePathname } from "next/navigation";
import { HolosLogo } from "@/components/brand/holos-logo";

type SidebarProps = {
  businessId: string;
  businessKind?: "STORE" | "SERVICE";
  isOpen: boolean;
  onClose: () => void;
};

type NavItem = { label: string; href: string };

export function Sidebar({ businessId, businessKind = "STORE", isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const service = businessKind === "SERVICE";
  const operation: NavItem[] = businessId
    ? [
        { label: "Tablero", href: "/" },
        { label: "Este negocio", href: `/businesses/${businessId}` },
        { label: "Ventas", href: `/businesses/${businessId}/sales` },
        { label: service ? "Reservas" : "Pedidos", href: `/businesses/${businessId}/orders` },
        ...(service ? [] : [{ label: "Productos", href: `/businesses/${businessId}/products` }]),
        { label: "Clientes", href: `/businesses/${businessId}/customers` },
        { label: "Proveedores", href: `/businesses/${businessId}/suppliers` },
        { label: "Gastos", href: `/businesses/${businessId}/expenses` },
      ]
    : [{ label: "Tablero", href: "/" }];
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
        <NavGroup label="Operación" items={operation} pathname={pathname} onClose={onClose} />
        {admin.length > 0 && <NavGroup label="Administración" items={admin} pathname={pathname} onClose={onClose} />}
        <NavGroup label="Cuenta" items={account} pathname={pathname} onClose={onClose} />
        <div className="sidebar-footer">
          <HolosLogo variant="mark" className="sidebar-footer-mark" />
          <p>{service ? "Una venta cobra el servicio, actualiza al cliente y deja el comprobante." : "Una venta mueve stock, cliente, factura y tablero."}</p>
        </div>
      </aside>
    </>
  );
}

function NavGroup({ label, items, pathname, onClose }: { label: string; items: NavItem[]; pathname: string; onClose: () => void }) {
  return (
    <div className="sidebar-group">
      <div className="sidebar-section-label">{label}</div>
      <nav>
        <ul className="navigation-list">
          {items.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname === item.href;
            return (
              <li key={item.href}>
                <a className={`navigation-link${active ? " is-active" : ""}`} href={item.href} aria-current={active ? "page" : undefined} onClick={onClose}>
                  <span className="nav-mark" aria-hidden="true" />
                  {item.label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
