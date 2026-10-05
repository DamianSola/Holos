import { prisma } from "@/lib/db";

export async function getPortfolioDashboard(userId: string) {
  const memberships = await prisma.membership.findMany({
    where: { userId, deletedAt: null, business: { deletedAt: null } },
    include: { business: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  const businessIds = memberships.map((membership) => membership.businessId);
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const trendStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  if (!businessIds.length) {
    return { businesses: [], totals: emptyPortfolioTotals(), trend: buildTrend([], [], trendStart, now) };
  }

  const [sales, reservationPayments, expenses, customerCount, productCount, criticalProducts] = await prisma.$transaction([
    prisma.sale.findMany({ where: { businessId: { in: businessIds }, status: "CONFIRMED", confirmedAt: { gte: trendStart } }, select: { businessId: true, totalMinor: true, confirmedAt: true } }),
    prisma.orderPayment.findMany({ where: { businessId: { in: businessIds }, paidAt: { gte: trendStart } }, select: { amountMinor: true, paidAt: true } }),
    prisma.expense.findMany({ where: { businessId: { in: businessIds }, deletedAt: null, expenseDate: { gte: trendStart } }, select: { businessId: true, amountMinor: true, expenseDate: true } }),
    prisma.customer.count({ where: { businessId: { in: businessIds }, deletedAt: null } }),
    prisma.product.count({ where: { businessId: { in: businessIds }, status: "ACTIVE", deletedAt: null } }),
    prisma.product.count({ where: { businessId: { in: businessIds }, status: "ACTIVE", deletedAt: null, stock: { lte: prisma.product.fields.minimumStock } } }),
  ]);

  const income = incomeEvents(sales, reservationPayments);
  const salesMonthMinor = sumSince(income, startOfMonth);
  const salesTodayMinor = sumSince(income, startOfToday);
  const expensesMonthMinor = expenses.filter((expense) => expense.expenseDate >= startOfMonth).reduce((total, expense) => total + expense.amountMinor, 0);

  return {
    businesses: memberships.map((membership) => ({ id: membership.business.id, name: membership.business.name, role: membership.role })),
    totals: { businessCount: memberships.length, customerCount, productCount, criticalProducts, salesMonthMinor, salesTodayMinor, expensesMonthMinor, netMonthMinor: salesMonthMinor - expensesMonthMinor },
    trend: buildTrend(income, expenses, trendStart, now),
  };
}

function emptyPortfolioTotals() {
  return { businessCount: 0, customerCount: 0, productCount: 0, criticalProducts: 0, salesMonthMinor: 0, salesTodayMinor: 0, expensesMonthMinor: 0, netMonthMinor: 0 };
}

function incomeEvents(sales: Array<{ totalMinor: number; confirmedAt: Date | null }>, payments: Array<{ amountMinor: number; paidAt: Date }>) {
  return [
    ...sales.flatMap((sale) => (sale.confirmedAt ? [{ amountMinor: sale.totalMinor, at: sale.confirmedAt }] : [])),
    ...payments.map((payment) => ({ amountMinor: payment.amountMinor, at: payment.paidAt })),
  ];
}

function sumSince(items: Array<{ amountMinor: number; at: Date }>, since: Date) {
  return items.filter((item) => item.at >= since).reduce((total, item) => total + item.amountMinor, 0);
}

function buildTrend(income: Array<{ amountMinor: number; at: Date }>, expenses: Array<{ amountMinor: number; expenseDate: Date }>, start: Date, now: Date) {
  const periods = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth() + index, 1);
    const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    const periodIncome = income.filter((item) => item.at >= date && item.at < next).reduce((total, item) => total + item.amountMinor, 0);
    const costs = expenses.filter((expense) => expense.expenseDate >= date && expense.expenseDate < next).reduce((total, expense) => total + expense.amountMinor, 0);
    return { label: date.toLocaleDateString("es-AR", { month: "short" }).replace(".", ""), incomeMinor: periodIncome, expensesMinor: costs, netMinor: periodIncome - costs, current: date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() };
  });
  return periods.map((period, index) => ({
    ...period,
    incomeDeltaPercent: index === 0 ? null : changePercent(period.incomeMinor, periods[index - 1].incomeMinor),
    expensesDeltaPercent: index === 0 ? null : changePercent(period.expensesMinor, periods[index - 1].expensesMinor),
    netDeltaPercent: index === 0 ? null : changePercent(period.netMinor, periods[index - 1].netMinor),
  }));
}

function changePercent(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

export async function getBusinessDashboard(businessId: string) {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [monthSales, todaySales, monthPayments, todayPayments, productsSold, customers, criticalProducts, activity, productCount, supplierCount, memberCount, monthExpenses, recentSales, recentPayments, scheduledServices, business, members] = await prisma.$transaction([
    prisma.sale.aggregate({ where: { businessId, status: "CONFIRMED", confirmedAt: { gte: startOfMonth } }, _sum: { totalMinor: true } }),
    prisma.sale.aggregate({ where: { businessId, status: "CONFIRMED", confirmedAt: { gte: startOfDay } }, _sum: { totalMinor: true } }),
    prisma.orderPayment.aggregate({ where: { businessId, paidAt: { gte: startOfMonth } }, _sum: { amountMinor: true } }),
    prisma.orderPayment.aggregate({ where: { businessId, paidAt: { gte: startOfDay } }, _sum: { amountMinor: true } }),
    prisma.saleItem.aggregate({ where: { sale: { businessId, status: "CONFIRMED", confirmedAt: { gte: startOfMonth } } }, _sum: { quantity: true } }),
    prisma.customer.count({ where: { businessId, deletedAt: null } }),
    prisma.product.count({ where: { businessId, status: "ACTIVE", deletedAt: null, stock: { lte: prisma.product.fields.minimumStock } } }),
    prisma.activityEvent.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.product.count({ where: { businessId, status: "ACTIVE", deletedAt: null } }),
    prisma.supplier.count({ where: { businessId, deletedAt: null } }),
    prisma.membership.count({ where: { businessId, deletedAt: null } }),
    prisma.expense.aggregate({ where: { businessId, deletedAt: null, expenseDate: { gte: startOfMonth } }, _sum: { amountMinor: true } }),
    prisma.sale.findMany({ where: { businessId }, include: { customer: { select: { name: true } }, invoice: { select: { number: true } } }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.orderPayment.findMany({ where: { businessId }, include: { order: { select: { title: true, customer: { select: { name: true } } } } }, orderBy: { paidAt: "desc" }, take: 8 }),
    prisma.customerOrder.count({ where: { businessId, kind: "SERVICE", status: "SCHEDULED" } }),
    prisma.business.findUnique({ where: { id: businessId }, select: { id: true, name: true, legalName: true, taxId: true, kind: true } }),
    prisma.membership.findMany({ where: { businessId, deletedAt: null }, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } }),
  ]);

  return {
    salesMonthMinor: (monthSales._sum.totalMinor ?? 0) + (monthPayments._sum.amountMinor ?? 0),
    salesTodayMinor: (todaySales._sum.totalMinor ?? 0) + (todayPayments._sum.amountMinor ?? 0),
    productsSold: productsSold._sum.quantity ?? 0,
    customers,
    criticalProducts,
    activity,
    productCount,
    supplierCount,
    memberCount,
    expensesMonthMinor: monthExpenses._sum.amountMinor ?? 0,
    scheduledServices,
    recentSales,
    recentPayments,
    business,
    members,
  };
}