import { PromoDetail } from "@/components/ops/PromoDetail";

export default function PromoPage({ params }: { params: { id: string } }) {
  let promoId = params.id;
  try {
    promoId = decodeURIComponent(params.id);
  } catch {
    /* keep raw */
  }
  return <PromoDetail promoId={promoId} />;
}
