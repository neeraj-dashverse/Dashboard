import { RecordDetail } from "@/components/ops/RecordDetail";

export default function RecordPromoPage({ params }: { params: { id: string } }) {
  let promoId = params.id;
  try {
    promoId = decodeURIComponent(params.id);
  } catch {
    /* keep the raw id */
  }
  return <RecordDetail promoId={promoId} />;
}
