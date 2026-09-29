import { prisma } from "@/lib/db";

export function loadBusinessExport(businessId: string) {
  return prisma.business.findUnique({
    where: { id: businessId },
    include: {
      memberships: { include: { user: { select: { name: true, email: true, status: true } } } },
      products: { orderBy: { name: "asc" } },
      customers: { orderBy: { name: "asc" } },
      suppliers: { orderBy: { name: "asc" } },
      expenses: { include: { supplier: { select: { name: true } } }, orderBy: { expenseDate: "desc" } },
      sales: { include: { customer: { select: { name: true } }, items: true, invoice: true }, orderBy: { createdAt: "desc" } },
      orders: { include: { customer: { select: { name: true } }, product: { select: { name: true } } }, orderBy: { scheduledFor: "asc" } },
      tasks: { include: { assignee: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" } },
      activities: { orderBy: { createdAt: "desc" } },
    },
  });
}
