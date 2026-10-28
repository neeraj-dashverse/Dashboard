import { OpsProvider } from "@/components/ops/OpsProvider";
import { TeamBoard } from "@/components/ops/TeamBoard";
import { opsAdapter } from "@/lib/ops/adapter";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const snap = await opsAdapter.load();
  return (
    <OpsProvider initial={snap}>
      <TeamBoard />
    </OpsProvider>
  );
}
