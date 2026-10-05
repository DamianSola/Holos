export function paidMinor(payments: Array<{ amountMinor: number }>) {
  return payments.reduce((total, payment) => total + payment.amountMinor, 0);
}

export function remainingMinor(budgetMinor: number, payments: Array<{ amountMinor: number }>) {
  return budgetMinor - paidMinor(payments);
}

export function paymentFits(budgetMinor: number, alreadyPaidMinor: number, nextMinor: number) {
  return nextMinor > 0 && alreadyPaidMinor + nextMinor <= budgetMinor;
}

export function collectionLabel(budgetMinor: number, alreadyPaidMinor: number) {
  if (alreadyPaidMinor <= 0) return "Sin pago";
  if (alreadyPaidMinor >= budgetMinor) return "Pagada";
  return "Seña";
}
