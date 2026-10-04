"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [isDark, setDark] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("holos-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = savedTheme === "dark" || (!savedTheme && prefersDark) ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    setDark(theme === "dark");
  }, []);

  function toggleTheme() {
    const nextTheme = isDark ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("holos-theme", nextTheme);
    setDark(!isDark);
  }

  return (
    <button className="theme-toggle" type="button" onClick={toggleTheme} aria-pressed={isDark} aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}>
      {isDark ? <MoonMark /> : <SunMark />}
    </button>
  );
}

function SunMark() {
  return (
    <svg className="icon-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3.25" />
      <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18" />
    </svg>
  );
}

function MoonMark() {
  return (
    <svg className="icon-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15.6 14.9A5.4 5.4 0 0 1 9.1 5.6 6 6 0 1 0 15.6 14.9z" />
    </svg>
  );
}
