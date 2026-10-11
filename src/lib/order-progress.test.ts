import { describe, expect, it } from "vitest";
import { orderMoneyPhrase, orderRowPhrase, orderShouldClose, productOrderLabel } from "@/lib/order-progress";

const money = (value: number) => `$${value / 100}`;

describe("product order progress", () => {
  it("names the order from what was delivered and closes only when nothing is owed", () => {
    expect(productOrderLabel("SCHEDULED", 0, 3)).toBe("Pendiente");
    expect(productOrderLabel("SCHEDULED", 2, 3)).toBe("Entregado con pendientes");
    expect(productOrderLabel("SCHEDULED", 3, 3)).toBe("Entregado");
    expect(productOrderLabel("DONE", 3, 3)).toBe("Cerrado");
    expect(productOrderLabel("CANCELLED", 0, 3)).toBe("Cancelado");
    expect(orderShouldClose(true, 350000, 350000)).toBe(true);
    expect(orderShouldClose(true, 350000, 100000)).toBe(false);
    expect(orderShouldClose(false, 350000, 350000)).toBe(false);
    expect(orderMoneyPhrase("SCHEDULED", 350000, 100000, money)).toBe("Señó $1000 · debe $2500");
    expect(orderMoneyPhrase("SCHEDULED", 350000, 0, money)).toBe("Sin pago");
    expect(orderMoneyPhrase("SCHEDULED", 350000, 350000, money)).toBe("Pagado");
    expect(orderMoneyPhrase("CANCELLED", 350000, 100000, money)).toBe("Señó $1000");
    expect(orderRowPhrase("SCHEDULED", 1, 2, 225000, 100000, money)).toBe("Entregado 1 de 2 · debe $1250");
    expect(orderRowPhrase("SCHEDULED", 0, 2, 50000, 0, money)).toBe("Pendiente · debe $500");
    expect(orderRowPhrase("SCHEDULED", 1, 2, 50000, 50000, money)).toBe("Entregado 1 de 2 · Pagado");
    expect(orderRowPhrase("DONE", 1, 1, 50000, 50000, money)).toBe("Cerrado · $500");
    expect(orderRowPhrase("CANCELLED", 0, 1, 50000, 10000, money)).toBe("Cancelado · Señó $100");
  });
});