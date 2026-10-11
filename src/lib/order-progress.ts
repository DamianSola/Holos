export function productOrderLabel(status: "SCHEDULED" | "DONE" | "CANCELLED", delivered: number, total: number) {
  if (status === "CANCELLED") return "Cancelado";
  if (status === "DONE") return "Cerrado";
  if (total < 1 || delivered < 1) return "Pendiente";
  if (delivered < total) return "Entregado con pendientes";
  return "Entregado";
}

export function orderMoneyPhrase(status: "SCHEDULED" | "DONE" | "CANCELLED", chargeMinor: number, paidMinor: number, money: (value: number) => string) {
  if (paidMinor <= 0) return "Sin pago";
  if (status === "CANCELLED") return `Señó ${money(paidMinor)}`;
  if (chargeMinor > 0 && paidMinor >= chargeMinor) return "Pagado";
  return `Señó ${money(paidMinor)} · debe ${money(Math.max(0, chargeMinor - paidMinor))}`;
}

export function orderShouldClose(allDelivered: boolean, chargeMinor: number, paid: number) {
  return allDelivered && paid >= chargeMinor;
}

export function orderRowPhrase(status: "SCHEDULED" | "DONE" | "CANCELLED", delivered: number, total: number, chargeMinor: number, paidMinor: number, money: (value: number) => string) {
  if (status === "CANCELLED") return paidMinor > 0 ? `Cancelado · Señó ${money(paidMinor)}` : "Cancelado";
  if (status === "DONE") return `Cerrado · ${money(chargeMinor)}`;
  const progress = total < 1 || delivered < 1 ? "Pendiente" : delivered < total ? `Entregado ${delivered} de ${total}` : "Entregado";
  if (chargeMinor > 0 && paidMinor >= chargeMinor) return `${progress} · Pagado`;
  return `${progress} · debe ${money(Math.max(0, chargeMinor - paidMinor))}`;
}
