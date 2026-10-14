"use client";

import { useEffect, useRef, useState } from "react";
import { downloadListPdf, pdfFileName, shellBusinessName, type ListColumn } from "@/lib/list-pdf";

export type DownloadChoice = {
  label: string;
  title: string;
  columns: ListColumn[];
  rows: string[][];
  checkbox?: boolean;
  subtitle?: string;
};

export function DownloadList({ choices, disabled }: { choices: DownloadChoice[]; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const ready = choices.filter((choice) => choice.rows.length > 0);
  const single = choices.length === 1;

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function run(choice: DownloadChoice) {
    setOpen(false);
    setBusy(true);
    try {
      await downloadListPdf({
        title: choice.title,
        filename: pdfFileName(choice.title),
        businessName: shellBusinessName(),
        subtitle: choice.subtitle,
        columns: choice.columns,
        rows: choice.rows,
        checkbox: choice.checkbox,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="download-list" ref={rootRef}>
      <button
        className="secondary-button"
        type="button"
        disabled={disabled || busy || ready.length === 0}
        aria-expanded={single ? undefined : open}
        aria-haspopup={single ? undefined : "menu"}
        onClick={() => {
          if (single && ready[0]) void run(ready[0]);
          else setOpen((value) => !value);
        }}
      >
        {busy ? "Armando PDF..." : "Descargar"}
      </button>
      {open && !single && (
        <div className="download-list-menu" role="menu">
          {choices.map((choice) => (
            <button key={choice.label} className="secondary-button" type="button" role="menuitem" disabled={choice.rows.length === 0} onClick={() => void run(choice)}>
              {choice.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
