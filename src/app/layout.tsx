import type { Metadata } from "next";
import { IBM_Plex_Mono, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

const sans = Schibsted_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Holos",
  description: "Holos administra el negocio entero: una venta actualiza stock, cliente, factura y tablero.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${sans.variable} ${mono.variable}`}>
        <script dangerouslySetInnerHTML={{ __html: `(() => { try { const saved = localStorage.getItem("holos-theme"); const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches; document.documentElement.dataset.theme = saved === "dark" || (!saved && prefersDark) ? "dark" : "light"; } catch {} })();` }} />
        {children}
      </body>
    </html>
  );
}
