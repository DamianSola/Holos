import { describe, expect, it } from "vitest";
import { presentWorkList } from "@/server/services/work-lists";

const item = { id: "1", text: "Yerba", quantity: 2, cells: [] as string[], checked: false, position: 0 };

describe("presentWorkList", () => {
  it("keeps a saved quantity as a Cant. column", () => {
    const list = presentWorkList({ columns: [], withChecks: false, items: [item] });
    expect(list.heading).toBe("Descripción");
    expect(list.columns).toEqual(["Cant."]);
    expect(list.items[0].cells).toEqual(["2"]);
  });

  it("uses the columns saved on the list", () => {
    const list = presentWorkList({
      columns: ["Dirección"],
      withChecks: true,
      items: [{ ...item, quantity: null, cells: ["San Martín 10"], checked: true }],
    });
    expect(list.columns).toEqual(["Dirección"]);
    expect(list.items[0].cells).toEqual(["San Martín 10"]);
    expect(list.items[0].checked).toBe(true);
  });
});
