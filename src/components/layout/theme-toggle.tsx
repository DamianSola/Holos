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
      <span className="theme-toggle-mark" aria-hidden="true" />
      {isDark ? "Oscuro" : "Claro"}
    </button>
  );
}
