import { describe, expect, it } from "vitest";
import { tableFromPdfItems } from "@/lib/pdf-table";

describe("pdf table", () => {
  it("keeps words together and separates distant columns", () => {
    const text = tableFromPdfItems([[
      { str: "Yerba", x: 10, y: 700, width: 40, fontSize: 12 },
      { str: "1kg", x: 54, y: 700, width: 20, fontSize: 12 },
      { str: "3500", x: 300, y: 700, width: 30, fontSize: 12 },
      { str: "Azúcar", x: 10, y: 680, width: 40, fontSize: 12 },
      { str: "1800", x: 300, y: 680, width: 30, fontSize: 12 },
    ]]);
    expect(text).toBe("Yerba 1kg\t3500\nAzúcar\t1800");
  });
});