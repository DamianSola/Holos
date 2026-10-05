import { AppShell } from "@/components/layout/app-shell";
import { ProductsPage } from "@/components/modules/products-page";
import { requireBusinessPage } from "@/server/billing/access";
import { redirect } from "next/navigation";

export default async function StockRoute({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const { user, membership } = await requireBusinessPage(businessId);
  if (membership.business.kind !== "SERVICE") redirect(`/businesses/${businessId}/products` as never);
  return (
    <AppShell businessId={businessId} businessKind={membership.business.kind} userName={user.name ?? user.email}>
      <ProductsPage businessId={businessId} mode="stock" />
    </AppShell>
  );
}
