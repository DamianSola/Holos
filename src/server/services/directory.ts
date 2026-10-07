import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type DirectoryBusiness = {
  id: string;
  name: string;
  kind: "STORE" | "SERVICE";
  image: string | null;
  role: "OWNER" | "EMPLOYEE";
  customerCount: number;
  productCount: number;
  criticalProducts: number;
  salesMonthMinor: number;
  salesTodayMinor: number;
};

export async function getBusinessDirectory(userId: string): Promise<DirectoryBusiness[]> {
  const memberships = await prisma.membership.findMany({
    where: { userId, deletedAt: null, business: { deletedAt: null } },
    select: { role: true, business: { select: { id: true, name: true, kind: true, image: true } } },
    orderBy: { createdAt: "asc" },
  });
  const ids = memberships.map((membership) => membership.business.id);
  if (!ids.length) return [];

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const idList = Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`));

  const [customers, products, salesMonth, salesToday, paymentsMonth, paymentsToday, critical] = await Promise.all([
    prisma.customer.groupBy({ by: ["businessId"], where: { businessId: { in: ids }, deletedAt: null }, _count: { _all: true } }),
    prisma.product.groupBy({ by: ["businessId"], where: { businessId: { in: ids }, status: "ACTIVE", deletedAt: null }, _count: { _all: true } }),
    prisma.sale.groupBy({ by: ["businessId"], where: { businessId: { in: ids }, status: "CONFIRMED", confirmedAt: { gte: startOfMonth } }, _sum: { totalMinor: true } }),
    prisma.sale.groupBy({ by: ["businessId"], where: { businessId: { in: ids }, status: "CONFIRMED", confirmedAt: { gte: startOfDay } }, _sum: { totalMinor: true } }),
    prisma.orderPayment.groupBy({ by: ["businessId"], where: { businessId: { in: ids }, paidAt: { gte: startOfMonth } }, _sum: { amountMinor: true } }),
    prisma.orderPayment.groupBy({ by: ["businessId"], where: { businessId: { in: ids }, paidAt: { gte: startOfDay } }, _sum: { amountMinor: true } }),
    prisma.$queryRaw<Array<{ businessId: string; total: number }>>(Prisma.sql`
      SELECT "businessId", COUNT(*)::int AS total
      FROM "Product"
      WHERE "deletedAt" IS NULL
        AND status = 'ACTIVE'::"ProductStatus"
        AND stock <= "minimumStock"
        AND "businessId" IN (${idList})
      GROUP BY "businessId"
    `),
  ]);

  const customerCount = new Map(customers.map((row) => [row.businessId, row._count._all]));
  const productCount = new Map(products.map((row) => [row.businessId, row._count._all]));
  const monthSales = new Map(salesMonth.map((row) => [row.businessId, row._sum.totalMinor ?? 0]));
  const todaySales = new Map(salesToday.map((row) => [row.businessId, row._sum.totalMinor ?? 0]));
  const monthPayments = new Map(paymentsMonth.map((row) => [row.businessId, row._sum.amountMinor ?? 0]));
  const todayPayments = new Map(paymentsToday.map((row) => [row.businessId, row._sum.amountMinor ?? 0]));
  const criticalCount = new Map(critical.map((row) => [row.businessId, Number(row.total)]));

  return memberships.map(({ role, business }) => ({
    id: business.id,
    name: business.name,
    kind: business.kind,
    image: business.image,
    role,
    customerCount: customerCount.get(business.id) ?? 0,
    productCount: productCount.get(business.id) ?? 0,
    criticalProducts: criticalCount.get(business.id) ?? 0,
    salesMonthMinor: (monthSales.get(business.id) ?? 0) + (monthPayments.get(business.id) ?? 0),
    salesTodayMinor: (todaySales.get(business.id) ?? 0) + (todayPayments.get(business.id) ?? 0),
  }));
}
