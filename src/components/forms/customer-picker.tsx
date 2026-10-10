"use client";

import { KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type CustomerChoice = { id: string; name: string; phone?: string | null };

type Option =
  | { kind: "walkin" }
  | { kind: "customer"; customer: CustomerChoice }
  | { kind: "add" };

export function CustomerPicker({
  businessId,
  customers,
  value,
  onChange,
  onCreated,
  onUncommitted,
  allowWalkIn = false,
  disabled = false,
}: {
  businessId: string;
  customers: CustomerChoice[];
  value: string;
  onChange: (customerId: string) => void;
  onCreated: (customer: CustomerChoice) => void;
  onUncommitted?: (name: string | null) => void;
  allowWalkIn?: boolean;
  disabled?: boolean;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const onUncommittedRef = useRef(onUncommitted);
  const [text, setText] = useState(() => customers.find((customer) => customer.id === value)?.name ?? "");
  const [phone, setPhone] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [moved, setMoved] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [box, setBox] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null);
  const selected = customers.find((customer) => customer.id === value) ?? null;
  const trimmed = text.trim();
  const matches = useMemo(() => {
    const needle = normalize(trimmed);
    if (!needle) return customers;
    return customers.filter((customer) => normalize(customer.name).includes(needle));
  }, [customers, trimmed]);
  const options = useMemo<Option[]>(() => {
    const items: Option[] = [];
    if (allowWalkIn) items.push({ kind: "walkin" });
    for (const customer of matches) items.push({ kind: "customer", customer });
    if (trimmed) items.push({ kind: "add" });
    return items;
  }, [allowWalkIn, matches, trimmed]);
  const active = options.length ? Math.min(activeIndex, options.length - 1) : 0;

  useEffect(() => {
    onUncommittedRef.current = onUncommitted;
  }, [onUncommitted]);

  useEffect(() => {
    const pending = trimmed && normalize(trimmed) !== normalize(selected?.name ?? "") ? trimmed : null;
    onUncommittedRef.current?.(pending);
    return () => onUncommittedRef.current?.(null);
  }, [trimmed, selected?.name]);

  useEffect(() => {
    setActiveIndex(preferredIndex(options, trimmed));
  }, [options, trimmed]);

  useEffect(() => {
    if (!open) return;
    function place() {
      const input = inputRef.current;
      if (!input) return;
      const rect = input.getBoundingClientRect();
      const width = Math.min(Math.max(rect.width, 460), window.innerWidth - 16);
      let left = rect.left;
      if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
      const spaceBelow = window.innerHeight - rect.bottom;
      const upward = spaceBelow < 240 && rect.top > spaceBelow;
      setBox({ left, width, top: upward ? undefined : rect.bottom + 4, bottom: upward ? window.innerHeight - rect.top + 4 : undefined });
    }
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, trimmed, phone, error]);

  function chooseWalkIn() {
    setText("");
    setPhone("");
    setError("");
    setOpen(false);
    onChange("");
  }

  function chooseCustomer(customer: CustomerChoice) {
    setText(customer.name);
    setPhone("");
    setError("");
    setOpen(false);
    onChange(customer.id);
  }

  async function createCustomer() {
    if (creating || !trimmed) return;
    if (trimmed.length > 160) {
      setError("El nombre puede tener hasta 160 caracteres.");
      return;
    }
    const phoneValue = phone.trim();
    if (phoneValue.length > 40) {
      setError("El teléfono puede tener hasta 40 caracteres.");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/businesses/${businessId}/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, ...(phoneValue ? { phone: phoneValue } : {}) }),
      });
      const payload = await response.json().catch(() => null) as { id?: string; name?: string; phone?: string | null; message?: string } | null;
      if (!response.ok || !payload?.id || !payload.name) {
        setError(payload?.message ?? "No se pudo agregar el cliente.");
        return;
      }
      const customer = { id: payload.id, name: payload.name, phone: payload.phone ?? null };
      onCreated(customer);
      chooseCustomer(customer);
    } finally {
      setCreating(false);
    }
  }

  function activate(option: Option | undefined) {
    if (!option || creating) return;
    if (option.kind === "walkin") chooseWalkIn();
    else if (option.kind === "customer") chooseCustomer(option.customer);
    else void createCustomer();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setMoved(true);
      if (!options.length) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => (current + step + options.length) % options.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      if (!open) setOpen(true);
      if (!trimmed && !moved) return;
      activate(options[active]);
    }
  }

  const menu = open && box && options.length > 0 && typeof document !== "undefined" ? createPortal(
    <div
      ref={menuRef}
      className="customer-picker-menu"
      style={{ left: box.left, width: box.width, top: box.top, bottom: box.bottom }}
      onMouseDown={(event) => {
        if (event.target instanceof HTMLInputElement) return;
        event.preventDefault();
      }}
    >
      <div id={listId} role="listbox" className="customer-picker-options">
        {options.map((option, index) => option.kind === "add" ? null : (
          <button
            className={`customer-picker-option${index === active ? " is-active" : ""}`}
            id={`${listId}-${index}`}
            key={option.kind === "customer" ? option.customer.id : "walkin"}
            role="option"
            type="button"
            aria-selected={index === active}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => activate(option)}
          >
            {option.kind === "walkin" ? "Consumidor final" : option.customer.name}
          </button>
        ))}
        {!options.some((option) => option.kind === "customer") && trimmed && <p className="customer-picker-empty">Ningún cliente coincide.</p>}
      </div>
      {trimmed && (
        <div className={`customer-picker-add${options[active]?.kind === "add" ? " is-active" : ""}`}>
          <button type="button" disabled={creating || disabled} onClick={() => void createCustomer()} onMouseEnter={() => setActiveIndex(options.findIndex((option) => option.kind === "add"))}>
            {creating ? "Agregando..." : `Agregar «${trimmed}»`}
          </button>
          <input
            type="tel"
            value={phone}
            maxLength={40}
            placeholder="Teléfono"
            aria-label="Teléfono, opcional"
            disabled={creating || disabled}
            onChange={(event) => setPhone(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              event.stopPropagation();
              void createCustomer();
            }}
          />
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>,
    document.body,
  ) : null;

  return (
    <div className="customer-picker">
      <label>
        Cliente
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && options[active] && options[active].kind !== "add" ? `${listId}-${active}` : undefined}
          value={text}
          disabled={disabled}
          placeholder={allowWalkIn ? "Consumidor final" : "Nombre"}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onBlur={(event) => {
            const next = event.relatedTarget;
            if (next instanceof Node && menuRef.current?.contains(next)) return;
            setOpen(false);
          }}
          onChange={(event) => {
            setText(event.target.value);
            setMoved(false);
            setError("");
            setOpen(true);
            if (value) onChange("");
          }}
          onKeyDown={onKeyDown}
        />
      </label>
      {menu}
    </div>
  );
}

function preferredIndex(options: Option[], typed: string) {
  if (!typed) return 0;
  const exact = options.findIndex((option) => option.kind === "customer" && normalize(option.customer.name) === normalize(typed));
  if (exact >= 0) return exact;
  const addAt = options.findIndex((option) => option.kind === "add");
  return addAt >= 0 ? addAt : 0;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}
