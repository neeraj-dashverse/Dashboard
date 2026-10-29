"use client";

import Link from "next/link";
import { buildTasks, TASK_GROUPS, type IncomingPromo, type TaskItem } from "@/lib/ops/tasks";
import { SyncStrip } from "./SyncStrip";
import { useOps } from "./OpsProvider";

export function TasksBoard({ incoming }: { incoming: IncomingPromo[] }) {
  const { snap, act, busy } = useOps();
  const tasks = buildTasks(snap, incoming);
  const groups = TASK_GROUPS.map((g) => ({
    ...g,
    items: tasks.filter((t) => t.group === g.id),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-5">
      <SyncStrip />
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
          PocketFM · Operations
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">Tasks</h1>
        <p className="mt-1 max-w-3xl text-[13px] leading-5 text-slate-400">
          The only alert list. Today is the short summary.{" "}
          {tasks.length === 0 ? "Nothing needs you right now." : `${tasks.length} open.`}
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/[0.1] px-4 py-10 text-center text-[13px] text-slate-500">
          No open tasks.
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.id} className="space-y-2">
            <h2 className="text-[12px] font-bold uppercase tracking-wider text-slate-400">
              {group.label}
              <span className="ml-2 text-slate-600">{group.items.length}</span>
            </h2>
            <ul className="space-y-2">
              {group.items.map((task) => (
                <TaskRow key={task.id} task={task} busy={busy} onLater={() => act({ type: "dismiss_nudge", nudgeId: task.id })} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function TaskRow({
  task,
  busy,
  onLater,
}: {
  task: TaskItem;
  busy: boolean;
  onLater: () => void;
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#121216] px-3 py-3">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-white">{task.title}</p>
        <p className="mt-1 text-[12px] leading-5 text-slate-400">{task.detail}</p>
        {task.when && <p className="mt-1 text-[11px] text-slate-500">{task.when}</p>}
      </div>
      <div className="flex shrink-0 gap-1.5">
        {task.href && (
          <Link
            href={task.href}
            className="rounded-md bg-white/[0.08] px-2.5 py-1 text-[11px] font-bold text-slate-200"
          >
            Open
          </Link>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={onLater}
          className="rounded-md bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-slate-400 hover:text-white disabled:opacity-40"
        >
          Later
        </button>
      </div>
    </li>
  );
}
