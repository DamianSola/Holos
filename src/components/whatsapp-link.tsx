"use client";

import { useState } from "react";
import { whatsappHref } from "@/lib/whatsapp";

export function WhatsappLink({ phone, text }: { phone?: string | null; text?: string }) {
  if (!phone) return null;
  const href = whatsappHref(phone, text);
  if (!href) return null;
  return <a className="secondary-button" href={href} target="_blank" rel="noreferrer" aria-label={text ? "Enviar comprobante por WhatsApp" : "Abrir WhatsApp"}>WhatsApp</a>;
}

export function SendReceiptWhatsapp({ phone, text, pdfUrl, fileName }: { phone?: string | null; text: string; pdfUrl: string; fileName: string }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const href = phone ? whatsappHref(phone, text) : null;
  if (!href) return null;

  async function send() {
    setBusy(true);
    setNote("");
    try {
      const response = await fetch(pdfUrl, { cache: "no-store" });
      if (!response.ok || !response.headers.get("content-type")?.includes("application/pdf")) {
        setNote("No se pudo armar el PDF.");
        return;
      }
      const blob = await response.blob();
      const safeName = fileName.toLowerCase().endsWith(".pdf") ? fileName : `${fileName}.pdf`;
      const file = new File([blob], safeName, { type: "application/pdf" });
      const payload = { files: [file], text, title: safeName };
      if (navigator.canShare?.(payload)) {
        await navigator.share(payload);
        return;
      }
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = safeName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      if (href) window.open(href, "_blank", "noopener,noreferrer");
      setNote("Se descargó el PDF. Adjuntalo en el chat de WhatsApp.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setNote("No se pudo compartir el comprobante.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="secondary-button" type="button" onClick={() => void send()} disabled={busy} aria-label="Enviar el comprobante en PDF por WhatsApp">{busy ? "Armando PDF..." : "WhatsApp"}</button>
      {note ? <small role="status">{note}</small> : null}
    </>
  );
}
