import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type ListColumn = { label: string; weight: number };

export type ListPdf = {
  title: string;
  filename: string;
  businessName: string;
  subtitle?: string;
  columns: ListColumn[];
  rows: string[][];
  checkbox?: boolean;
  marks?: boolean[];
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;

function pdfText(value: string) {
  return value.replace(/[\u202f\u00a0]/g, " ").replace(/[^\n\x20-\x7e\u00a1-\u00ff]/g, "");
}

function fit(text: string, font: PDFFont, size: number, maxWidth: number) {
  let value = pdfText(text);
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value;
  while (value.length > 1 && font.widthOfTextAtSize(`${value}...`, size) > maxWidth) value = value.slice(0, -1);
  return `${value}...`;
}

export function shellBusinessName() {
  return document.querySelector("[data-business-name]")?.getAttribute("data-business-name")?.trim() || "Negocio";
}

export function pdfFileName(title: string) {
  const slug = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${slug || "lista"}.pdf`;
}

export async function downloadListPdf(input: ListPdf) {
  const doc = await PDFDocument.create();
  doc.setTitle(pdfText(input.title) || "Lista");
  doc.setAuthor("Holos");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.09, 0.14, 0.2);
  const muted = rgb(0.38, 0.45, 0.52);
  const line = rgb(0.78, 0.82, 0.86);
  const when = new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
  const meta = [input.businessName, when, input.subtitle].filter(Boolean).join("  ·  ");
  const check = input.checkbox ? 18 : 0;
  const tableWidth = PAGE_W - MARGIN * 2 - check;
  const weightTotal = input.columns.reduce((sum, column) => sum + column.weight, 0) || 1;
  const widths = input.columns.map((column) => (column.weight / weightTotal) * tableWidth);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  function drawColumns(target: PDFPage, top: number) {
    let x = MARGIN + check;
    input.columns.forEach((column, index) => {
      target.drawText(fit(column.label, bold, 8, Math.max(8, widths[index] - 8)), { x, y: top - 10, size: 8, font: bold, color: muted });
      x += widths[index];
    });
    const rule = top - 16;
    target.drawLine({ start: { x: MARGIN, y: rule }, end: { x: PAGE_W - MARGIN, y: rule }, thickness: 0.6, color: line });
    return rule - 8;
  }

  page.drawText(fit(input.title, bold, 16, PAGE_W - MARGIN * 2), { x: MARGIN, y: y - 16, size: 16, font: bold, color: ink });
  y -= 24;
  page.drawText(fit(meta, font, 9, PAGE_W - MARGIN * 2), { x: MARGIN, y: y - 9, size: 9, font, color: muted });
  y -= 22;
  y = drawColumns(page, y);

  function nextPage() {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = drawColumns(page, PAGE_H - MARGIN);
  }

  const rows = input.rows.length ? input.rows : [input.columns.map(() => "")];
  rows.forEach((row, rowIndex) => {
    if (y < MARGIN + 18) nextPage();
    if (input.checkbox && input.rows.length > 0) {
      page.drawRectangle({ x: MARGIN, y: y - 11, width: 9, height: 9, borderWidth: 0.8, borderColor: ink });
      if (input.marks?.[rowIndex]) {
        page.drawLine({ start: { x: MARGIN + 2, y: y - 6 }, end: { x: MARGIN + 7, y: y - 10 }, thickness: 1, color: ink });
        page.drawLine({ start: { x: MARGIN + 2, y: y - 10 }, end: { x: MARGIN + 7, y: y - 4 }, thickness: 1, color: ink });
      }
    }
    let x = MARGIN + check;
    input.columns.forEach((_, index) => {
      page.drawText(fit(row[index] ?? "", font, 10, Math.max(8, widths[index] - 8)), { x, y: y - 11, size: 10, font, color: ink });
      x += widths[index];
    });
    y -= 20;
  });

  const bytes = await doc.save();
  const blob = new Blob([Uint8Array.from(bytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = input.filename.endsWith(".pdf") ? input.filename : pdfFileName(input.filename);
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
