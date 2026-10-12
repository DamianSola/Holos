"use client";

import { FormEvent } from "react";

type PaymentMethod = "CASH" | "TRANSFER" | "CARD" | "OTHER";

const methods: Array<{ value: PaymentMethod; label: string }> = [
  { value: "CASH", label: "Efectivo" },
  { value: "TRANSFER", label: "Transferencia" },
  { value: "CARD", label: "Tarjeta" },
  { value: "OTHER", label: "Otro" },
];

export function PaymentForm({ balanceMinor, amount, method, saving, onAmount, onMethod, onSubmit }: {
  balanceMinor: number;
  amount: string;
  method: PaymentMethod;
  saving: boolean;
  onAmount: (value: string) => void;
  onMethod: (value: PaymentMethod) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const difference = minorToInput(balanceMinor);
  const usingDifference = amount === difference;
  return (
    <form className="pay-box" onSubmit={onSubmit}>
      <div className="pay-due">
        <span>Falta cobrar</span>
        <strong>{formatMoney(balanceMinor)}</strong>
      </div>
      <button className={usingDifference ? "pay-chip is-on" : "pay-chip"} type="button" disabled={saving} onClick={() => onAmount(difference)}>La diferencia</button>
      <div className="pay-fields">
        <label>Monto
          <input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => onAmount(event.target.value)} required />
        </label>
        <label>Medio
          <select value={method} onChange={(event) => onMethod(event.target.value as PaymentMethod)}>
            {methods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
      </div>
      <button className="auth-submit" type="submit" disabled={saving}>{saving ? "Guardando..." : "Agregar pago"}</button>
    </form>
  );
}

function minorToInput(minor: number) {
  const cents = Math.abs(minor) % 100;
  const whole = Math.trunc(minor / 100);
  if (cents === 0) return String(whole);
  return `${whole}.${String(cents).padStart(2, "0")}`;
}

function formatMoney(valueMinor: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(valueMinor / 100);
}
