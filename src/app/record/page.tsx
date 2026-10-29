import { OpsProvider } from "@/components/ops/OpsProvider";
import { RecordBoard } from "@/components/ops/RecordBoard";
import { opsAdapter } from "@/lib/ops/adapter";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function RecordPage() {
  const snap = await opsAdapter.load();
  return (
    <OpsProvider initial={snap}>
      <RecordBoard />
    </OpsProvider>
  );
}
