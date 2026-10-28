import { OpsProvider } from "@/components/ops/OpsProvider";
import { PromoDetail } from "@/components/ops/PromoDetail";
import { opsAdapter } from "@/lib/ops/adapter";

export const dynamic = "force-dynamic";

export default async function PromoPage({
  params,
}: {
  params: { id: string };
}) {
  const snap = await opsAdapter.load();
  // Join key is show|script. Next may or may not decode params depending on version.
  let promoId = params.id;
  try {
    promoId = decodeURIComponent(params.id);
  } catch {
    /* keep raw */
  }
  const match =
    snap.promos.find((p) => p.id === promoId) ??
    snap.promos.find((p) => p.id === params.id) ??
    snap.promos.find(
      (p) => encodeURIComponent(p.id) === params.id || p.id === params.id.replace(/%7C/gi, "|")
    );
  return (
    <OpsProvider initial={snap}>
      <PromoDetail promoId={match?.id ?? promoId} />
    </OpsProvider>
  );
}
