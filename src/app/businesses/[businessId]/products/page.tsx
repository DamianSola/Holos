import { redirect } from "next/navigation";
import { ProductsPage } from "@/components/modules/products-page";
import { AppShell } from "@/components/layout/app-shell";
import { requireBusinessPage } from "@/server/billing/access";

export default async function ProductsRoute({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const { user, membership } = await requireBusinessPage(businessId);
  const kind = membership.business.kind;
  if (kind === "SERVICE") redirect(`/businesses/${businessId}/stock` as never);
  return (
    <AppShell businessId={businessId} businessKind={kind} userName={user.name ?? user.email}>
      <ProductsPage businessId={businessId} />
    </AppShell>
  );
}
