import { describe, expect, it } from "vitest";
import { shortageQuantity } from "@/lib/shopping-lines";

describe("shortageQuantity", () => {
  it("pide lo que falta para llegar al mínimo", () => {
    expect(shortageQuantity(2, 6)).toBe(4);
  });

  it("pide uno cuando el stock está justo en el mínimo", () => {
    expect(shortageQuantity(5, 5)).toBe(1);
    expect(shortageQuantity(0, 0)).toBe(1);
  });

  it("no incluye lo que está por encima del mínimo", () => {
    expect(shortageQuantity(6, 5)).toBe(0);
  });
});
