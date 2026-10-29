import { OpsProvider } from "@/components/ops/OpsProvider";
import { TasksBoard } from "@/components/ops/TasksBoard";
import { opsAdapter } from "@/lib/ops/adapter";
import { loadNewMasterPromos } from "@/lib/ops/master-incoming";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TasksPage() {
  const snap = await opsAdapter.load();
  const incoming = await loadNewMasterPromos(snap.promos.map((p) => p.id));
  return (
    <OpsProvider initial={snap}>
      <TasksBoard incoming={incoming} />
    </OpsProvider>
  );
}
