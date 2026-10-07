import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { coversPeriod, movementWindows, type MovementPeriod } from "@/lib/movement-period";

export async function getPortfolioDashboard(userId: string) {
  const memberships = await prisma.membership.findMany({
    where: { userId, deletedAt: null, business: { deletedAt: null } },
    select: { role: true, businessId: true, business: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  const businessIds = memberships.map((membership) => membership.businessId);
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const trendStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const months = Array.from({ length: 6 }, (_, index) => {
    const start = new Date(trendStart.getFullYear(), trendStart.getMonth() + index, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    return {
      label: start.toLocaleDateString("es-AR", { month: "short" }).replace(".", ""),
      start,
      end,
      current: start.getFullYear() === now.getFullYear() && start.getMonth() === now.getMonth(),
    };
  });

  if (!businessIds.length) {
    return { businesses: [], totals: emptyPortfolioTotals(), trend: buildTrend(months.map((month) => ({ ...month, incomeMinor: 0, expensesMinor: 0 }))) };
  }

  const ranges = [
    ...months.map((month) => ({ start: month.start, end: month.end as Date | null })),
    { start: startOfMonth, end: null },
    { start: startOfToday, end: null },
  ];
  const [saleSums, paymentSums, expenseSums, customerCount, productCount, criticalProducts] = await Promise.all([
    sumRanges(businessIds, "sale", ranges),
    sumRanges(businessIds, "payment", ranges),
    sumRanges(businessIds, "expense", ranges),
    prisma.customer.count({ where: { businessId: { in: businessIds }, deletedAt: null } }),
    prisma.product.count({ where: { businessId: { in: businessIds }, status: "ACTIVE", deletedAt: null } }),
    prisma.product.count({ where: { businessId: { in: businessIds }, status: "ACTIVE", deletedAt: null, stock: { lte: prisma.product.fields.minimumStock } } }),
  ]);

  const salesMonthMinor = (saleSums[6] ?? 0) + (paymentSums[6] ?? 0);
  const salesTodayMinor = (saleSums[7] ?? 0) + (paymentSums[7] ?? 0);
  const expensesMonthMinor = expenseSums[6] ?? 0;

  return {
    businesses: memberships.map((membership) => ({ id: membership.business.id, name: membership.business.name, role: membership.role })),
    totals: { businessCount: memberships.length, customerCount, productCount, criticalProducts, salesMonthMinor, salesTodayMinor, expensesMonthMinor, netMonthMinor: salesMonthMinor - expensesMonthMinor },
    trend: buildTrend(months.map((month, index) => ({
      label: month.label,
      current: month.current,
      incomeMinor: (saleSums[index] ?? 0) + (paymentSums[index] ?? 0),
      expensesMinor: expenseSums[index] ?? 0,
    }))),
  };
}

async function sumRanges(businessIds: string[], kind: "sale" | "payment" | "expense", ranges: Array<{ start: Date; end: Date | null }>) {
  const stamp = kind === "expense" ? Prisma.sql`"expenseDate"` : kind === "payment" ? Prisma.sql`"paidAt"` : Prisma.sql`"confirmedAt"`;
  const amount = kind === "sale" ? Prisma.sql`"totalMinor"` : Prisma.sql`"amountMinor"`;
  const from = kind === "sale" ? Prisma.sql`"Sale"` : kind === "payment" ? Prisma.sql`"OrderPayment"` : Prisma.sql`"Expense"`;
  const filter = kind === "sale"
    ? Prisma.sql`status = 'CONFIRMED' AND "confirmedAt" IS NOT NULL`
    : kind === "expense"
      ? Prisma.sql`"deletedAt" IS NULL`
      : Prisma.sql`TRUE`;
  const pieces = ranges.map((range) => {
    const upper = range.end ? Prisma.sql`AND ${stamp} < ${range.end}` : Prisma.empty;
    return Prisma.sql`COALESCE(SUM(CASE WHEN ${stamp} >= ${range.start} ${upper} THEN ${amount} ELSE 0 END), 0)::int`;
  });
  const rows = await prisma.$queryRaw<Array<{ totals: number[] }>>(Prisma.sql`
    SELECT json_build_array(${Prisma.join(pieces)}) AS totals
    FROM ${from}
    WHERE "businessId" IN (${Prisma.join(businessIds.map((id) => Prisma.sql`${id}::uuid`))}) AND ${filter}
  `);
  const totals = rows[0]?.totals ?? [];
  return ranges.map((_, index) => Number(totals[index] ?? 0));
}

function emptyPortfolioTotals() {
  return { businessCount: 0, customerCount: 0, productCount: 0, criticalProducts: 0, salesMonthMinor: 0, salesTodayMinor: 0, expensesMonthMinor: 0, netMonthMinor: 0 };
}

function buildTrend(periods: Array<{ label: string; incomeMinor: number; expensesMinor: number; current: boolean }>) {
  const withNet = periods.map((period) => ({ ...period, netMinor: period.incomeMinor - period.expensesMinor }));
  return withNet.map((period, index) => ({
    ...period,
    incomeDeltaPercent: index === 0 ? null : changePercent(period.incomeMinor, periods[index - 1].incomeMinor),
    expensesDeltaPercent: index === 0 ? null : changePercent(period.expensesMinor, periods[index - 1].expensesMinor),
    netDeltaPercent: index === 0 ? null : changePercent(period.netMinor, withNet[index - 1].netMinor),
  }));
}

function changePercent(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

export async function getMovement(businessId: string, now = new Date()) {
  const windows = movementWindows(now);
  const rangeStart = earliest(windows.month.start, windows.week.start);
  const rangeEnd = latest(windows.month.end, windows.week.end);
  const [periodSales, periodPayments, periodExpenses] = await Promise.all([
    prisma.sale.findMany({ where: { businessId, status: "CONFIRMED", confirmedAt: { gte: rangeStart, lt: rangeEnd } }, select: { totalMinor: true, confirmedAt: true, items: { select: { quantity: true } } } }),
    prisma.orderPayment.findMany({ where: { businessId, paidAt: { gte: rangeStart, lt: rangeEnd } }, select: { amountMinor: true, paidAt: true } }),
    prisma.expense.findMany({ where: { businessId, deletedAt: null, expenseDate: { gte: rangeStart, lt: rangeEnd } }, select: { amountMinor: true, expenseDate: true } }),
  ]);

  function movementTotals(period: MovementPeriod) {
    const window = windows[period];
    const sales = periodSales.filter((sale) => sale.confirmedAt && coversPeriod(sale.confirmedAt, window));
    const payments = periodPayments.filter((payment) => coversPeriod(payment.paidAt, window));
    const expenses = periodExpenses.filter((expense) => coversPeriod(expense.expenseDate, window));
    return {
      incomeMinor: sales.reduce((total, sale) => total + sale.totalMinor, 0) + payments.reduce((total, payment) => total + payment.amountMinor, 0),
      expensesMinor: expenses.reduce((total, expense) => total + expense.amountMinor, 0),
      productsSold: sales.reduce((total, sale) => total + sale.items.reduce((units, item) => units + item.quantity, 0), 0),
    };
  }

  return { month: movementTotals("month"), week: movementTotals("week"), day: movementTotals("day") };
}

export async function getBusinessDashboard(businessId: string, now = new Date()) {
  const [movement, customers, criticalProducts, activity, productCount, supplierCount, memberCount, recentSales, recentPayments, scheduledServices, business, members] = await Promise.all([
    getMovement(businessId, now),
    prisma.customer.count({ where: { businessId, deletedAt: null } }),
    prisma.product.count({ where: { businessId, status: "ACTIVE", deletedAt: null, stock: { lte: prisma.product.fields.minimumStock } } }),
    prisma.activityEvent.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.product.count({ where: { businessId, status: "ACTIVE", deletedAt: null } }),
    prisma.supplier.count({ where: { businessId, deletedAt: null } }),
    prisma.membership.count({ where: { businessId, deletedAt: null } }),
    prisma.sale.findMany({ where: { businessId }, select: { id: true, totalMinor: true, status: true, confirmedAt: true, createdAt: true, customer: { select: { name: true } }, invoice: { select: { number: true } } }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.orderPayment.findMany({ where: { businessId }, select: { id: true, amountMinor: true, paidAt: true, order: { select: { title: true, customer: { select: { name: true } } } } }, orderBy: { paidAt: "desc" }, take: 8 }),
    prisma.customerOrder.count({ where: { businessId, kind: "SERVICE", status: "SCHEDULED" } }),
    prisma.business.findUnique({ where: { id: businessId }, select: { id: true, name: true, legalName: true, taxId: true, kind: true } }),
    prisma.membership.findMany({ where: { businessId, deletedAt: null }, select: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } }),
  ]);

  return {
    movement,
    salesMonthMinor: movement.month.incomeMinor,
    salesTodayMinor: movement.day.incomeMinor,
    productsSold: movement.month.productsSold,
    customers,
    criticalProducts,
    activity,
    productCount,
    supplierCount,
    memberCount,
    expensesMonthMinor: movement.month.expensesMinor,
    scheduledServices,
    recentSales,
    recentPayments,
    business,
    members,
  };
}

function earliest(left: Date, right: Date) {
  return left < right ? left : right;
}

function latest(left: Date, right: Date) {
  return left > right ? left : right;
}