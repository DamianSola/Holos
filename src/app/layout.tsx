import type { Metadata } from "next";
import { Manrope, Newsreader } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HOLos",
  description: "The operational workspace for HOLos.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${manrope.variable} ${newsreader.variable}`}>
        <script dangerouslySetInnerHTML={{ __html: `(() => { try { const saved = localStorage.getItem("holos-theme"); const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches; document.documentElement.dataset.theme = saved === "dark" || (!saved && prefersDark) ? "dark" : "light"; } catch {} })();` }} />
        {children}
      </body>
    </html>
  );
}