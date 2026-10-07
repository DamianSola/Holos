import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { ProductsPage } from "@/components/modules/products-page";
import { requireBusinessPage } from "@/server/billing/access";
import { redirect } from "next/navigation";

export default async function StockRoute({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const { membership } = await requireBusinessPage(businessId);
  if (membership.business.kind !== "SERVICE") redirect(`/businesses/${businessId}/products` as never);
  return (
    <WorkspaceShell businessId={businessId}>
      <ProductsPage businessId={businessId} mode="stock" />
    </WorkspaceShell>
  );
}
