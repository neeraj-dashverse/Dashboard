import { OpsProvider } from "@/components/ops/OpsProvider";
import { TodayBoard } from "@/components/ops/TodayBoard";
import { opsAdapter } from "@/lib/ops/adapter";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const snap = await opsAdapter.load();
  return (
    <OpsProvider initial={snap}>
      <TodayBoard />
    </OpsProvider>
  );
}
