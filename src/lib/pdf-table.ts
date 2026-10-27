export type PdfTextItem = { str: string; x: number; y: number; width: number; fontSize: number };

export function tableFromPdfItems(pages: PdfTextItem[][]) {
  const lines: string[] = [];
  for (const page of pages) {
    const rows: { y: number; cells: PdfTextItem[] }[] = [];
    const sorted = [...page].sort((a, b) => b.y - a.y || a.x - b.x);
    for (const item of sorted) {
      if (!item.str.trim()) continue;
      const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= Math.max(2, item.fontSize * 0.35));
      if (row) row.cells.push(item);
      else rows.push({ y: item.y, cells: [item] });
    }
    for (const row of rows) {
      const cells = joinCells(row.cells);
      if (cells.length) lines.push(cells.join("\t"));
    }
  }
  return lines.join("\n");
}

function joinCells(items: PdfTextItem[]) {
  const ordered = [...items].sort((a, b) => a.x - b.x);
  const cells: string[] = [];
  let current = "";
  let lastRight = Number.NEGATIVE_INFINITY;
  for (const item of ordered) {
    const piece = item.str.trim();
    if (!piece) continue;
    const gap = item.x - lastRight;
    if (current && gap > Math.max(8, item.fontSize * 0.8)) {
      cells.push(current);
      current = piece;
    } else current = current ? `${current} ${piece}` : piece;
    lastRight = item.x + Math.max(item.width, 0);
  }
  if (current) cells.push(current);
  return cells;
}
