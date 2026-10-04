"use client";

import { useEffect, useId, useRef } from "react";

export function matchesQuery(query: string, ...parts: Array<string | null | undefined>) {
  const needle = normalize(query);
  if (!needle) return true;
  return normalize(parts.filter(Boolean).join(" ")).includes(needle);
}

export function ListSearch({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) return;
      }
      event.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="list-search">
      <label htmlFor={id}>
        Buscar
        <kbd>/</kbd>
      </label>
      <input
        id={id}
        ref={inputRef}
        type="search"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          onChange("");
          event.currentTarget.blur();
        }}
      />
    </div>
  );
}

export function SearchMiss({ query }: { query: string }) {
  return <div className="module-state" role="status">Nada coincide con «{query.trim()}».</div>;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}
