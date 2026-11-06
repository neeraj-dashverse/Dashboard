import { PromoPlan } from "@/components/ops/PromoPlan";

export default function PromoPlanPage({ params }: { params: { id: string } }) {
  let promoId = params.id;
  try {
    promoId = decodeURIComponent(params.id);
  } catch {
    /* keep raw */
  }
  return <PromoPlan promoId={promoId} />;
}
