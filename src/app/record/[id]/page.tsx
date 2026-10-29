import { OpsProvider } from "@/components/ops/OpsProvider";
import { RecordDetail } from "@/components/ops/RecordDetail";
import { opsAdapter } from "@/lib/ops/adapter";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function RecordPromoPage({
  params,
}: {
  params: { id: string };
}) {
  const snap = await opsAdapter.load();
  let promoId = params.id;
  try {
    promoId = decodeURIComponent(params.id);
  } catch {
    /* keep the raw id */
  }
  return (
    <OpsProvider initial={snap}>
      <RecordDetail promoId={promoId} />
    </OpsProvider>
  );
}
