export type ImportMode = "catalog" | "stock";
export type ImportKind = "SUPPLY" | "TOOL";

export type ImportRow = {
  line: number;
  name: string;
  priceMinor: number | null;
  stock: number | null;
  costMinor: number | null;
  minimumStock: number;
  category: string;
  description: string;
  catalogKind: ImportKind | null;
  error: string | null;
};

type ImportField = "name" | "price" | "stock" | "cost" | "minimum" | "description" | "category" | "kind";
type HeaderLabel = ImportField | "details" | null;

const MAX_ROWS = 200;
const MAX_MINOR = 2_147_483_647;

export function parseProductTable(text: string, mode: ImportMode) {
  const lines = text.split(/\r?\n/);
  const filled = lines
    .map((raw, index) => ({ raw, line: index + 1 }))
    .filter((entry) => entry.raw.trim().length > 0);
  const delimiter = detectDelimiter(filled.map((entry) => entry.raw).join("\n"));
  const cells = filled.map((entry) => ({ line: entry.line, cells: splitLine(entry.raw, delimiter) }));
  const header = readHeader(cells[0]?.cells ?? [], mode);
  const body = header ? cells.slice(1) : cells;
  const limited = body.slice(0, MAX_ROWS);
  const rows = limited.map((entry) => header?.mapped ? parseMapped(entry.line, entry.cells, header.indexes, mode) : parseRow(entry.line, entry.cells, mode));
  return { rows: markRepeated(rows), truncated: body.length > MAX_ROWS, ignored: header?.ignored ?? [] };
}

export function markExisting(rows: ImportRow[], names: string[]) {
  const existing = new Set(names.map(nameKey));
  return rows.map((row) => {
    if (row.error || !existing.has(nameKey(row.name))) return row;
    return { ...row, error: "Ya está en el negocio" };
  });
}

export function readyRows(rows: ImportRow[]) {
  return rows.filter((row) => row.error === null);
}

const CATALOG_ORDER: ImportField[] = ["name", "price", "stock", "cost", "minimum", "category"];
const STOCK_ORDER: ImportField[] = ["name", "kind", "stock", "cost", "minimum"];

function readHeader(header: string[], mode: ImportMode) {
  if (header.length < 2) return null;
  const labels = header.map((cell) => ({ cell: cell.trim(), field: classifyHeader(cell, mode) }));
  const indexes: Partial<Record<ImportField, number>> = {};
  let detailsAt: number | undefined;
  labels.forEach((label, index) => {
    if (label.field === "details") {
      if (detailsAt === undefined) detailsAt = index;
      return;
    }
    if (!label.field || indexes[label.field] !== undefined) return;
    indexes[label.field] = index;
  });
  if (indexes.name === undefined && detailsAt !== undefined) indexes.name = detailsAt;
  else if (detailsAt !== undefined && indexes.description === undefined) indexes.description = detailsAt;
  if (indexes.name === undefined || Object.keys(indexes).length < 2) return null;

  const expected = mode === "stock" ? STOCK_ORDER : CATALOG_ORDER;
  const sequence = labels.map((label, index) => {
    if (label.field === "details") return indexes.name === index ? "name" : "description";
    return label.field;
  });
  const aligned = sequence.every((field, index) => field === expected[index]);
  const ignored = labels.filter((label) => label.cell && label.field === null).map((label) => label.cell);
  if (aligned && ignored.length === 0) return { mapped: false, indexes, ignored: [] as string[] };
  return { mapped: true, indexes, ignored };
}

function classifyHeader(raw: string, mode: ImportMode): HeaderLabel {
  const value = raw.trim().toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  if (!value) return null;
  if (value.includes("stock") && value.includes("min")) return "minimum";
  if (value === "minimo" || value === "min") return "minimum";
  if (value.includes("costo")) return "cost";
  if (value.includes("precio") || value === "pvp") return "price";
  if (value.includes("caracter")) return "description";
  if (value === "descripcion" || value === "detalle") return "details";
  if (value === "nombre" || value === "producto" || value === "item" || value === "articulo") return "name";
  if (value === "stock" || value === "cantidad" || value === "existencias" || value === "existencia" || value === "unidades") return "stock";
  if (value === "categoria" || value === "rubro") return "category";
  if (value === "tipo" || value === "clase") return mode === "stock" ? "kind" : "category";
  return null;
}

function parseMapped(line: number, cells: string[], indexes: Partial<Record<ImportField, number>>, mode: ImportMode): ImportRow {
  const read = (field: ImportField) => indexes[field] === undefined ? undefined : cells[indexes[field]];
  const name = read("name")?.trim() ?? "";
  const base = emptyRow(line, name);
  if (!name) return { ...base, error: "Falta el nombre" };
  if (name.length > 160) return { ...base, error: "El nombre es demasiado largo" };
  const description = (read("description") ?? "").trim();
  const category = (read("category") ?? "").trim();
  if (description.length > 2000) return { ...base, error: "Las características son demasiado largas" };
  if (category.length > 120) return { ...base, error: "La categoría es demasiado larga" };

  if (mode === "stock") {
    const catalogKind = indexes.kind === undefined ? null : parseKind(read("kind"));
    const stock = parseCount(read("stock"), 0);
    const costMinor = parseOptionalMoney(read("cost"));
    const minimumStock = parseCount(read("minimum"), 0);
    if (!catalogKind) return { ...base, description, error: "El tipo tiene que ser insumo o herramienta" };
    if (stock === null) return { ...base, catalogKind, description, error: "El stock tiene que ser un número entero" };
    if (costMinor === undefined) return { ...base, catalogKind, stock, description, error: "El costo no se entiende" };
    if (minimumStock === null) return { ...base, catalogKind, stock, description, error: "El mínimo tiene que ser un número entero" };
    return { ...base, catalogKind, stock, costMinor, minimumStock, description };
  }

  const priceMinor = indexes.price === undefined ? null : parseMoney(read("price") ?? "");
  const stock = parseCount(read("stock"), 0);
  const costMinor = parseOptionalMoney(read("cost"));
  const minimumStock = parseCount(read("minimum"), 0);
  if (priceMinor === null) return { ...base, description, error: "Falta el precio o no se entiende" };
  if (stock === null) return { ...base, priceMinor, description, error: "El stock tiene que ser un número entero" };
  if (costMinor === undefined) return { ...base, priceMinor, stock, description, error: "El costo no se entiende" };
  if (minimumStock === null) return { ...base, priceMinor, stock, description, error: "El mínimo tiene que ser un número entero" };
  return { ...base, priceMinor, stock, costMinor, minimumStock, category, description };
}

function emptyRow(line: number, name: string): ImportRow {
  return { line, name, priceMinor: null, stock: null, costMinor: null, minimumStock: 0, category: "", description: "", catalogKind: null, error: null };
}

function parseRow(line: number, cells: string[], mode: ImportMode): ImportRow {
  const name = cells[0]?.trim() ?? "";
  const base = emptyRow(line, name);
  if (!name) return { ...base, error: "Falta el nombre" };
  if (name.length > 160) return { ...base, error: "El nombre es demasiado largo" };

  if (mode === "stock") {
    const catalogKind = parseKind(cells[1]);
    const stock = parseCount(cells[2], 0);
    const costMinor = parseOptionalMoney(cells[3]);
    const minimumStock = parseCount(cells[4], 0);
    if (!catalogKind) return { ...base, error: "El tipo tiene que ser insumo o herramienta" };
    if (stock === null) return { ...base, catalogKind, error: "El stock tiene que ser un número entero" };
    if (costMinor === undefined) return { ...base, catalogKind, stock, error: "El costo no se entiende" };
    if (minimumStock === null) return { ...base, catalogKind, stock, error: "El mínimo tiene que ser un número entero" };
    return { ...base, catalogKind, stock, costMinor, minimumStock };
  }

  const priceMinor = parseMoney(cells[1] ?? "");
  const stock = parseCount(cells[2], 0);
  const costMinor = parseOptionalMoney(cells[3]);
  const minimumStock = parseCount(cells[4], 0);
  const category = (cells[5] ?? "").trim();
  if (priceMinor === null) return { ...base, error: "Falta el precio o no se entiende" };
  if (stock === null) return { ...base, priceMinor, error: "El stock tiene que ser un número entero" };
  if (costMinor === undefined) return { ...base, priceMinor, stock, error: "El costo no se entiende" };
  if (minimumStock === null) return { ...base, priceMinor, stock, error: "El mínimo tiene que ser un número entero" };
  if (category.length > 120) return { ...base, priceMinor, stock, error: "La categoría es demasiado larga" };
  return { ...base, priceMinor, stock, costMinor, minimumStock, category };
}

function markRepeated(rows: ImportRow[]) {
  const seen = new Set<string>();
  return rows.map((row) => {
    if (row.error || !row.name) return row;
    const key = nameKey(row.name);
    if (seen.has(key)) return { ...row, error: "Repetido en la lista" };
    seen.add(key);
    return row;
  });
}

function nameKey(name: string) {
  return name.trim().toLocaleLowerCase("es");
}

function detectDelimiter(sample: string) {
  if (sample.includes("\t")) return "\t";
  const semis = sample.split(";").length;
  const commas = sample.split(",").length;
  if (semis > 1 && semis >= commas) return ";";
  if (commas > 1) return ",";
  if (/ {2,}/.test(sample)) return "  ";
  return ",";
}

function splitLine(line: string, delimiter: string) {
  if (delimiter === "\t" || delimiter === "  ") return line.split(delimiter === "\t" ? "\t" : / {2,}/).map((cell) => cell.trim());
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (const char of line) {
    if (char === "\"") {
      quoted = !quoted;
      continue;
    }
    if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function parseKind(raw: string | undefined): ImportKind | null {
  const value = (raw ?? "").trim().toLocaleLowerCase("es");
  if (value === "insumo" || value === "insumos" || value === "supply") return "SUPPLY";
  if (value === "herramienta" || value === "herramientas" || value === "tool") return "TOOL";
  return null;
}

function parseCount(raw: string | undefined, fallback: number | null) {
  if (raw === undefined || raw.trim() === "") return fallback;
  const rawValue = raw.trim().replace(/\s/g, "");
  const digits = /^\d{1,3}(\.\d{3})+$/.test(rawValue) ? rawValue.replace(/\./g, "") : rawValue;
  if (!/^\d+$/.test(digits)) return null;
  const value = Number(digits);
  if (!Number.isInteger(value) || value > MAX_MINOR) return null;
  return value;
}

function parseOptionalMoney(raw: string | undefined) {
  if (raw === undefined || raw.trim() === "") return null;
  return parseMoney(raw);
}

export function parseMoney(raw: string) {
  const value = raw.trim().replace(/\s/g, "").replace(/\$/g, "");
  if (!value) return null;
  let normalized = value;
  if (value.includes(",") && value.includes(".")) normalized = value.replace(/\./g, "").replace(",", ".");
  else if (value.includes(",")) normalized = value.replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(value)) normalized = value.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const minor = Math.round(amount * 100);
  if (minor > MAX_MINOR) return null;
  return minor;
}
