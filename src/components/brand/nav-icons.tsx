import type { ReactNode } from "react";

export type NavIconName =
  | "board"
  | "sale"
  | "order"
  | "calendar"
  | "product"
  | "stock"
  | "customer"
  | "supplier"
  | "expense"
  | "list"
  | "invoice"
  | "team"
  | "plan"
  | "profile"
  | "store";

const glyphs: Record<NavIconName, ReactNode> = {
  board: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.2" />
    </>
  ),
  sale: (
    <>
      <path d="M7 4.5h10v15l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2V4.5z" />
      <path d="M9.5 9h5M9.5 12.5h5" />
    </>
  ),
  order: (
    <>
      <path d="M3.8 8.2 12 4.5l8.2 3.7L12 11.8z" />
      <path d="M3.8 8.2v7.6L12 19.5l8.2-3.7V8.2" />
      <path d="M12 11.8v7.7" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="14" rx="1.5" />
      <path d="M4 10h16M8 3.5v4M16 3.5v4" />
    </>
  ),
  product: (
    <>
      <path d="M12.2 4.2h5.6v5.6L10.4 17.2a1.4 1.4 0 0 1-2 0l-1.6-1.6a1.4 1.4 0 0 1 0-2z" />
      <circle cx="15.8" cy="8" r="1.1" />
    </>
  ),
  stock: (
    <>
      <path d="m12 4 8 4-8 4-8-4z" />
      <path d="m4 12 8 4 8-4" />
      <path d="m4 16 8 4 8-4" />
    </>
  ),
  customer: (
    <>
      <circle cx="12" cy="8" r="3" />
      <path d="M5.5 19.2c1.2-3 3.4-4.5 6.5-4.5s5.3 1.5 6.5 4.5" />
    </>
  ),
  supplier: (
    <>
      <path d="M4 19.5V9.2L12 5l8 4.2v10.3" />
      <path d="M10 19.5v-5h4v5M4 19.5h16" />
    </>
  ),
  expense: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M8.5 12h7" />
    </>
  ),
  list: (
    <>
      <rect x="4" y="5" width="3.2" height="3.2" rx="0.4" />
      <rect x="4" y="10.4" width="3.2" height="3.2" rx="0.4" />
      <rect x="4" y="15.8" width="3.2" height="3.2" rx="0.4" />
      <path d="M10 6.6h9.2M10 12h9.2M10 17.4h9.2" />
    </>
  ),
  invoice: (
    <>
      <path d="M7 3.5h7l4 4V20.5H7z" />
      <path d="M14 3.5V8h4M9.5 12.5h5M9.5 16h5" />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="8.2" r="2.4" />
      <circle cx="16" cy="9.2" r="2" />
      <path d="M4.6 18.4c.8-2.5 2.5-3.8 4.4-3.8s3.6 1.3 4.4 3.8" />
      <path d="M13.2 14.8c1.1-.4 2.2-.5 3.3-.1 1.5.5 2.4 1.8 2.8 3.7" />
    </>
  ),
  plan: (
    <>
      <rect x="3.5" y="6" width="17" height="12" rx="1.5" />
      <path d="M3.5 10h17M7 14.5h4" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="10" r="2.2" />
      <path d="M8 16.8c.8-1.6 2.2-2.4 4-2.4s3.2.8 4 2.4" />
    </>
  ),
  store: (
    <>
      <path d="M4 10.5 6.2 5h11.6L20 10.5" />
      <path d="M4 10.5h16V19H4z" />
      <path d="M10 19v-4.2h4V19" />
    </>
  ),
};

export function NavIcon({ name }: { name: NavIconName }) {
  return (
    <svg className="icon-glyph nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      {glyphs[name]}
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg className="icon-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5.5v13M5.5 12h13" />
    </svg>
  );
}
