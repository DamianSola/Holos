import { redirect } from "next/navigation";
import { ProductsPage } from "@/components/modules/products-page";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { requireBusinessPage } from "@/server/billing/access";

export default async function ProductsRoute({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const { membership } = await requireBusinessPage(businessId);
  const kind = membership.business.kind;
  if (kind === "SERVICE") redirect(`/businesses/${businessId}/stock` as never);
  return (
    <WorkspaceShell businessId={businessId}>
      <ProductsPage businessId={businessId} />
    </WorkspaceShell>
  );
}
