import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

export type ActionIcon = "view" | "edit" | "delete" | "add" | "remove" | "print" | "cancel" | "reopen" | "check" | "whatsapp";

const paths: Record<ActionIcon, string> = {
  view: "M2.5 12S6.2 6.5 12 6.5 21.5 12 21.5 12 17.8 17.5 12 17.5 2.5 12 2.5 12zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  edit: "M4.5 16.8 15.2 6.1a1.6 1.6 0 0 1 2.2 0l.5.5a1.6 1.6 0 0 1 0 2.2L7.2 19.5H4.5zM13.6 7.7l2.7 2.7",
  delete: "M5.5 7.5h13M9.2 7.4V5.8h5.6v1.6M7.2 7.5l.7 11h8.2l.7-11",
  add: "M12 5.5v13M5.5 12h13",
  remove: "M6 12h12",
  print: "M7 9V4.5h10V9M7 16.5H5.5A1.5 1.5 0 0 1 4 15v-4a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 11v4a1.5 1.5 0 0 1-1.5 1.5H17M7 14h10v5.5H7z",
  cancel: "M7 7l10 10M17 7 7 17",
  reopen: "M6.5 12a5.5 5.5 0 1 0 1.4-3.7M6.2 5.2v3.6h3.6",
  check: "M5.5 12.5 10 17l8.5-9",
  whatsapp: "M7.2 18.8 8.4 16A6.6 6.6 0 1 1 12 18.6c-.7 0-1.4-.1-2-.4z",
};

export function ActionGlyph({ name }: { name: ActionIcon }) {
  return (
    <svg className="icon-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

type IconActionProps = {
  label: string;
  icon: ActionIcon;
  danger?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

function actionClass(icon: ActionIcon, danger: boolean | undefined, className: string) {
  const tone = danger || icon === "delete" || icon === "cancel" ? " is-danger" : "";
  return `icon-action${tone}${className ? ` ${className}` : ""}`;
}

export function IconAction({ label, icon, danger, className = "", type = "button", ...props }: IconActionProps) {
  return (
    <button className={actionClass(icon, danger, className)} type={type} title={label} aria-label={label} {...props}>
      <ActionGlyph name={icon} />
      <span className="icon-action-name">{label}</span>
    </button>
  );
}

export function IconLink({ label, icon, href, className = "", ...props }: { label: string; icon: ActionIcon; href: string; className?: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className" | "aria-label" | "title">) {
  return (
    <a className={actionClass(icon, false, className)} href={href} title={label} aria-label={label} {...props}>
      <ActionGlyph name={icon} />
      <span className="icon-action-name">{label}</span>
    </a>
  );
}
