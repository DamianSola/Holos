import { prisma } from "@/lib/db";
import { authorizeBusiness } from "@/server/auth/authorization";
import { errorResponse, unexpectedError } from "@/server/http";

type Context = { params: Promise<{ businessId: string }> };

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character] ?? character);
}

async function getExportData(businessId: string) {
  return prisma.business.findUnique({
    where: { id: businessId },
    include: {
      memberships: { include: { user: { select: { name: true, email: true, status: true } } } },
      products: { orderBy: { name: "asc" } },
      customers: { orderBy: { name: "asc" } },
      suppliers: { orderBy: { name: "asc" } },
      expenses: { include: { supplier: { select: { name: true } } }, orderBy: { expenseDate: "desc" } },
      sales: { include: { customer: { select: { name: true } }, items: true, invoice: true }, orderBy: { createdAt: "desc" } },
      tasks: { include: { assignee: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" } },
      activities: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function GET(request: Request, context: Context) {
  const { businessId } = await context.params;
  const access = await authorizeBusiness(businessId, ["OWNER"]);
  if ("response" in access) return access.response;

  try {
    const business = await getExportData(businessId);
    if (!business) return errorResponse(404, "BUSINESS_NOT_FOUND", "El negocio no existe.");

    const format = new URL(request.url).searchParams.get("format");
    if (format !== "print") {
      return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), business }), {
        headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${business.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-respaldo.json"` },
      });
    }

    const sections: Array<[string, string[]]> = [
      ["Miembros", business.memberships.map((item) => `${item.user.name ?? item.user.email} - ${item.role} - ${item.user.status}`)],
      ["Productos", business.products.map((item) => `${item.name} | ${item.category ?? "Sin categoría"} | Stock: ${item.stock} | Precio: $${(item.priceMinor / 100).toFixed(2)}`)],
      ["Clientes", business.customers.map((item) => `${item.name} | ${item.email ?? "Sin email"} | ${item.phone ?? "Sin teléfono"}`)],
      ["Proveedores", business.suppliers.map((item) => `${item.name} | ${item.type} | ${item.email ?? "Sin email"}`)],
      ["Gastos", business.expenses.map((item) => `${new Date(item.expenseDate).toLocaleDateString("es-AR")} | ${item.description} | $${(item.amountMinor / 100).toFixed(2)} | ${item.supplier?.name ?? "Sin proveedor"}`)],
      ["Ventas e historial", business.sales.map((item) => `${new Date(item.createdAt).toLocaleDateString("es-AR")} | ${item.customer?.name ?? "Consumidor final"} | ${item.status} | $${(item.totalMinor / 100).toFixed(2)}`)],
      ["Tareas", business.tasks.map((item) => `${item.title} | ${item.status} | ${item.assignee.name ?? item.assignee.email}`)],
      ["Actividad", business.activities.map((item) => `${new Date(item.createdAt).toLocaleString("es-AR")} | ${item.type}`)],
    ];

    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Respaldo - ${escapeHtml(business.name)}</title><style>body{font-family:Arial,sans-serif;color:#17201d;margin:40px;line-height:1.45}h1{font-size:28px;margin-bottom:4px}h2{font-size:18px;margin:28px 0 8px;border-bottom:2px solid #2f6b5d;padding-bottom:5px}p{color:#5f6964}.item{padding:6px 0;border-bottom:1px solid #d9deda;font-size:12px}@media print{body{margin:20px}}</style></head><body><h1>${escapeHtml(business.name)}</h1><p>Respaldo generado el ${escapeHtml(new Date().toLocaleString("es-AR"))}. Este documento conserva el historial del negocio.</p>${sections.map(([title, items]) => `<section><h2>${escapeHtml(title)}</h2>${items.length ? items.map((item) => `<div class="item">${escapeHtml(item)}</div>`).join("") : "<p>Sin registros.</p>"}</section>`).join("")}<script>window.onload=()=>window.print()</script></body></html>`;
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch {
    return unexpectedError();
  }
}
