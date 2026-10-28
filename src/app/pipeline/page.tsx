import { OpsProvider } from "@/components/ops/OpsProvider";
import { PipelineBoard } from "@/components/ops/PipelineBoard";
import { opsAdapter } from "@/lib/ops/adapter";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const snap = await opsAdapter.load();
  return (
    <OpsProvider initial={snap}>
      <PipelineBoard />
    </OpsProvider>
  );
}
