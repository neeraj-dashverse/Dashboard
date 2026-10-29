"use client";

import Link from "next/link";
import { buildExceptions, teamGroups } from "@/lib/ops/selectors";
import { Kpi } from "./ui";
import { SyncStrip } from "./SyncStrip";
import { useOps } from "./OpsProvider";

const PAGES = [
  {
    href: "/tasks",
    title: "Tasks",
    line: "The alert list. Delays, missing dates, and anything that needs a person.",
  },
  {
    href: "/planner",
    title: "Calendar",
    line: "Planned dates on top. Current status only through today.",
  },
  {
    href: "/plan",
    title: "Plan",
    line: "Set the dates for each promo and part.",
  },
  {
    href: "/pipeline",
    title: "Pipeline",
    line: "Where each part sits, from plotting through sound.",
  },
  {
    href: "/team",
    title: "Team",
    line: "Who is free, and who was supposed to be free but is still in a stage.",
  },
] as const;

export function TodayBoard() {
  const { snap } = useOps();
  const exceptions = buildExceptions(snap);
  const groups = teamGroups(snap);
  const overdue = exceptions.filter(
    (item) => item.kind === "overdue" || item.kind === "delivery-risk"
  ).length;
  const dueToday = exceptions.filter((item) => item.kind === "due-today").length;
  const stillWorking = groups.reduce(
    (count, group) => count + group.people.filter((person) => person.holds.some((hold) => hold.lateDays > 0)).length,
    0
  );
  const freeNow = groups.reduce((count, group) => count + group.freeNow.length, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
            PocketFM · Operations
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">Today</h1>
          <p className="mt-1 max-w-2xl text-[12px] text-slate-500">
            A short look at the day. The full alert list is on Tasks.
          </p>
        </div>
        <p className="text-[12px] tabular-nums text-slate-500">{snap.today}</p>
      </div>

      <SyncStrip />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi label="Overdue" value={overdue} tone={overdue ? "text-rose-300" : "text-white"} />
        <Kpi label="Due today" value={dueToday} tone={dueToday ? "text-[#9bb0ff]" : "text-white"} />
        <Kpi
          label="Supposed to be free"
          value={stillWorking}
          tone={stillWorking ? "text-rose-300" : "text-white"}
        />
        <Kpi label="Free now" value={freeNow} tone="text-emerald-300" />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {PAGES.map((page) => (
          <Link
            key={page.href}
            href={page.href}
            className="rounded-xl border border-white/[0.08] bg-[#121216] px-4 py-3 hover:border-white/[0.16]"
          >
            <p className="text-[14px] font-bold text-white">{page.title}</p>
            <p className="mt-1 text-[12px] leading-5 text-slate-400">{page.line}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
