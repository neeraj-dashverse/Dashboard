import { OpsProvider } from "@/components/ops/OpsProvider";
import { PlannerBoard } from "@/components/ops/PlannerBoard";
import { opsAdapter } from "@/lib/ops/adapter";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function PlannerPage() {
  const snap = await opsAdapter.load();
  return (
    <OpsProvider initial={snap}>
      <PlannerBoard />
    </OpsProvider>
  );
}
