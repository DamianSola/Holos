export const businessContextCookie = "holos_business";

export type ShellBusiness = {
  id: string;
  name: string;
  kind: "STORE" | "SERVICE";
};

export function rememberBusiness(id: string) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${businessContextCookie}=${encodeURIComponent(id)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}
