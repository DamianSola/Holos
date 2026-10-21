type StoredListItem = {
  id: string;
  text: string;
  quantity: number | null;
  cells: string[];
  checked: boolean;
  position: number;
};

type StoredList = {
  heading?: string | null;
  columns: string[];
  items: StoredListItem[];
};

export const workListInclude = {
  assignee: { select: { id: true, name: true, email: true } },
  items: { orderBy: { position: "asc" as const }, select: { id: true, text: true, quantity: true, cells: true, checked: true, position: true } },
} as const;

export function presentWorkList<T extends StoredList>(list: T) {
  const legacy = list.columns.length === 0 && list.items.some((item) => item.quantity != null);
  const columns = legacy ? ["Cant."] : list.columns;
  return {
    ...list,
    heading: list.heading?.trim() || "Descripción",
    columns,
    items: list.items.map((item) => ({
      id: item.id,
      text: item.text,
      cells: legacy ? [item.quantity ? String(item.quantity) : ""] : item.cells,
      checked: item.checked,
      position: item.position,
    })),
  };
}
