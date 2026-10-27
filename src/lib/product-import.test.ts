import { describe, expect, it } from "vitest";
import { markExisting, parseMoney, parseProductTable, readyRows } from "@/lib/product-import";

describe("product import", () => {
  it("reads an Argentine price and a pasted table", () => {
    expect(parseMoney("3.500")).toBe(350000);
    expect(parseMoney("3500,50")).toBe(350050);
    expect(parseMoney("3.500,50")).toBe(350050);
    const parsed = parseProductTable("Nombre\tPrecio\tStock\nYerba 1kg\t3.500\t12\nAzúcar\t1800\t20\t900\t5\tAlmacén", "catalog");
    expect(parsed.truncated).toBe(false);
    expect(readyRows(parsed.rows)).toHaveLength(2);
    expect(parsed.rows[1].category).toBe("Almacén");
    expect(parsed.rows[1].costMinor).toBe(90000);
    expect(parsed.rows[1].minimumStock).toBe(5);
  });

  it("skips a repeated name and one that already exists", () => {
    const parsed = parseProductTable("Yerba\t100\t1\nyerba\t200\t2", "catalog");
    expect(parsed.rows[1].error).toBe("Repetido en la lista");
    const marked = markExisting(parsed.rows, ["Yerba"]);
    expect(marked[0].error).toBe("Ya está en el negocio");
  });

  it("keeps only the columns stored for a wide table", () => {
    const parsed = parseProductTable("Código\tMarca\tNombre\tPrecio\tIVA\tStock\tCaracterísticas\tCosto\tStock mín\tProveedor\nA1\tPlayadito\tYerba 1kg\t3.500\t21%\t12\tCon palo\t900\t5\tMayorista", "catalog");
    expect(parsed.ignored).toEqual(["Código", "Marca", "IVA", "Proveedor"]);
    expect(parsed.rows[0]).toMatchObject({ name: "Yerba 1kg", priceMinor: 350000, stock: 12, description: "Con palo", costMinor: 90000, minimumStock: 5, error: null });
    const stock = parseProductTable("Código\tNombre\tTipo\tStock\tCosto\n1\tBolsa\tinsumo\t4\t20", "stock");
    expect(stock.ignored).toEqual(["Código"]);
    expect(stock.rows[0]).toMatchObject({ name: "Bolsa", catalogKind: "SUPPLY", stock: 4, costMinor: 2000, error: null });
  });

  it("reads stock rows and rejects a broken stock", () => {
    const parsed = parseProductTable("Bolsa;insumo;4\nClavo;herramienta;2,5", "stock");
    expect(parsed.rows[0].catalogKind).toBe("SUPPLY");
    expect(parsed.rows[0].stock).toBe(4);
    expect(parsed.rows[1].error).toBe("El stock tiene que ser un número entero");
    expect(parseProductTable("Tornillo;insumo;1.000", "stock").rows[0].stock).toBe(1000);
    expect(parseProductTable("Yerba 1kg  3500  12", "catalog").rows[0].priceMinor).toBe(350000);
    expect(parseProductTable("Tornillo;insumo;1.000", "stock").rows[0].stock).toBe(1000);
    expect(parseProductTable("Yerba 1kg  3500  12", "catalog").rows[0].priceMinor).toBe(350000);
  });
});
