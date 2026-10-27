import { tableFromPdfItems, type PdfTextItem } from "@/lib/pdf-table";
import { authorizeBusiness } from "@/server/auth/authorization";
import { errorResponse, unexpectedError } from "@/server/http";

type Context = { params: Promise<{ businessId: string }> };

const MAX_BYTES = 4_000_000;

export async function POST(request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId);
  if ("response" in access) return access.response;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return errorResponse(400, "FILE_REQUIRED", "Elegí un archivo.");
  if (file.size > MAX_BYTES) return errorResponse(413, "FILE_TOO_LARGE", "El archivo tiene que pesar menos de 4 MB.");

  const pdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  try {
    const text = pdf ? await textFromPdf(file) : await file.text();
    if (!text.trim()) {
      return errorResponse(422, "FILE_EMPTY", pdf ? "Ese PDF no tiene texto para leer. Copiá la tabla y pegala." : "El archivo está vacío.");
    }
    return Response.json({ text });
  } catch {
    if (pdf) return errorResponse(422, "PDF_UNREADABLE", "No pude leer ese PDF. Copiá la tabla y pegala.");
    return unexpectedError();
  }
}

async function textFromPdf(file: File) {
  const { extractTextItems } = await import("unpdf");
  const extracted = await extractTextItems(new Uint8Array(await file.arrayBuffer()));
  const pages = extracted.items.map((page) => page.flatMap((item) => {
    if (!("str" in item) || typeof item.str !== "string") return [];
    const piece: PdfTextItem = { str: item.str, x: item.x, y: item.y, width: item.width, fontSize: item.fontSize || 12 };
    return [piece];
  }));
  return tableFromPdfItems(pages).trim();
}
