import { OpsProvider } from "@/components/ops/OpsProvider";
import { PlanBoard } from "@/components/ops/PlanBoard";
import { opsAdapter } from "@/lib/ops/adapter";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function PlanPage() {
  const snap = await opsAdapter.load();
  return (
    <OpsProvider initial={snap}>
      <PlanBoard />
    </OpsProvider>
  );
}
