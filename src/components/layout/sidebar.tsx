type SidebarProps = {
  businessId: string;
  isOpen: boolean;
  onClose: () => void;
};

const navigationItems = (businessId: string) => [
  { label: "Dashboard general", href: "/", active: false },
  { label: "Overview del negocio", href: `/businesses/${businessId}`, active: true },
  { label: "Sales", href: `/businesses/${businessId}/sales`, active: false },
  { label: "Products", href: `/businesses/${businessId}/products`, active: false },
  { label: "Customers", href: `/businesses/${businessId}/customers`, active: false },
  { label: "Suppliers", href: `/businesses/${businessId}/suppliers`, active: false },
  { label: "Expenses", href: `/businesses/${businessId}/expenses`, active: false },
  { label: "Team", href: `/businesses/${businessId}/team`, active: false },
  { label: "Profile", href: "/profile", active: false },
] as const;

export function Sidebar({ businessId, isOpen, onClose }: SidebarProps) {
  const items = businessId ? navigationItems(businessId) : [{ label: "Business", href: "/", active: true }, { label: "Profile", href: "/profile", active: false }];

  return (
    <>
      <button
        className={`navigation-backdrop${isOpen ? " is-visible" : ""}`}
        type="button"
        aria-label="Close navigation"
        onClick={onClose}
      />
      <aside className={`sidebar${isOpen ? " is-open" : ""}`} aria-label="Primary navigation">
        <div className="sidebar-brand">
          <span className="brand-mark" aria-hidden="true">H</span>
          <span className="brand-name">HOLos</span>
        </div>
        <div className="sidebar-section-label">Workspace</div>
        <nav>
          <ul className="navigation-list">
            {items.map((item) => (
              <li key={item.label}>
                <a className={`navigation-link${item.active ? " is-active" : ""}`} href={item.href} onClick={onClose}>
                  <span className="navigation-indicator" aria-hidden="true" />
                  {item.label}
                  {!item.active && businessId && <span className="navigation-soon">Soon</span>}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="sidebar-footer">
          <span className="status-dot" aria-hidden="true" />
          <div>
            <strong>Foundation</strong>
            <span>Build phase</span>
          </div>
        </div>
      </aside>
    </>
  );
}