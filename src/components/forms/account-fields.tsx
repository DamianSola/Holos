"use client";

import { useState } from "react";

type PasswordFieldProps = {
  label: string;
  name?: string;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  autoComplete?: string;
  placeholder?: string;
};

export function PasswordField({ label, name, value, onChange, required, minLength, maxLength, autoComplete, placeholder }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const controlled = value !== undefined;
  return (
    <label className="password-field">
      {label}
      <span className="password-field-row">
        <input
          name={name}
          type={visible ? "text" : "password"}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={controlled ? value : undefined}
          onChange={controlled ? (event) => onChange?.(event.target.value) : undefined}
        />
        <button className="text-button password-toggle" type="button" onClick={() => setVisible((current) => !current)} aria-pressed={visible}>
          {visible ? "Ocultar" : "Ver"}
        </button>
      </span>
    </label>
  );
}

type ImagePickerProps = {
  label: string;
  name?: string;
  value?: string;
  onChange?: (value: string) => void;
};

export function ImagePicker({ label, name, value, onChange }: ImagePickerProps) {
  const [internal, setInternal] = useState("");
  const [error, setError] = useState("");
  const current = value ?? internal;

  function setImage(next: string) {
    if (value === undefined) setInternal(next);
    onChange?.(next);
  }

  async function choose(file: File | undefined) {
    setError("");
    if (!file) return;
    try {
      setImage(await readImageFile(file));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo leer la imagen.");
    }
  }

  return (
    <div className="image-picker">
      {current ? <img src={current} alt="" /> : <span className="image-picker-empty" aria-hidden="true" />}
      <label>
        {label}
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void choose(event.target.files?.[0])} />
      </label>
      {current && <button className="text-button" type="button" onClick={() => setImage("")}>Quitar</button>}
      {name && <input type="hidden" name={name} value={current} />}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}

async function readImageFile(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Elegí una imagen JPG, PNG o WebP.");
  const bitmap = await createImageBitmap(file);
  const max = 512;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo leer la imagen.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const data = canvas.toDataURL("image/jpeg", 0.82);
  if (data.length > 400_000) throw new Error("La imagen es demasiado pesada.");
  return data;
}
