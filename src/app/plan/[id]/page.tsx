import { OpsProvider } from "@/components/ops/OpsProvider";
import { PromoPlan } from "@/components/ops/PromoPlan";
import { opsAdapter } from "@/lib/ops/adapter";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function PromoPlanPage({ params }: { params: { id: string } }) {
  const snap = await opsAdapter.load();
  let promoId = params.id;
  try {
    promoId = decodeURIComponent(params.id);
  } catch {
    /* keep raw */
  }
  return (
    <OpsProvider initial={snap}>
      <PromoPlan promoId={promoId} />
    </OpsProvider>
  );
}
