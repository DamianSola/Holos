export const workListInclude = {
  assignee: { select: { id: true, name: true, email: true } },
  items: { orderBy: { position: "asc" as const }, select: { id: true, text: true, quantity: true, position: true } },
} as const;
