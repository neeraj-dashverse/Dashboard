import { OpsProvider } from "@/components/ops/OpsProvider";
import { ProductivityBoard } from "@/components/ops/ProductivityBoard";
import { opsAdapter } from "@/lib/ops/adapter";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function ProductivityPage() {
  const snap = await opsAdapter.load();
  return (
    <OpsProvider initial={snap}>
      <ProductivityBoard />
    </OpsProvider>
  );
}
