"use client";

import Link from "next/link";
import {
  artistName,
  daysLate,
  formatDuration,
  funnelCounts,
  STAGE_LABEL,
  STAGE_ORDER,
} from "@/lib/ops/selectors";
import type { Part, Stage } from "@/lib/ops/types";
import { KindPill, Kpi, SectionTitle, StagePill } from "./ui";
import { PartActions } from "./PartActions";
import { SyncStrip } from "./SyncStrip";
import { useOps } from "./OpsProvider";

export function PipelineBoard() {
  const { snap } = useOps();
  const funnel = funnelCounts(snap);
  const max = Math.max(...funnel.map((f) => f.count), 1);

  const columns = STAGE_ORDER.filter((s) => s !== "delivered").map((stage) => {
    const parts = snap.parts
      .filter((p) => p.stage === stage)
      .sort((a, b) => daysLate(b.plannedDate, snap.today) - daysLate(a.plannedDate, snap.today));
    return { stage, parts };
  });

  const stuckTotal = funnel.reduce((s, f) => s + f.stuck, 0);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
          Pipeline
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">
          Stages as a <span className="gradient-text">funnel</span>
        </h1>
        <p className="mt-1 text-[12px] text-slate-500">
          Asset → Animation → Edit → Correction → Sound → Delivered
        </p>
      </div>

      <SyncStrip />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Kpi label="Open parts" value={snap.parts.filter((p) => p.stage !== "delivered").length} />
        <Kpi label="Stuck ≥2d / blocked" value={stuckTotal} tone={stuckTotal ? "text-amber-300" : "text-white"} />
        <Kpi label="Delivered" value={snap.parts.filter((p) => p.stage === "delivered").length} tone="text-emerald-300" />
      </div>

      <section className="rounded-xl border border-white/[0.08] bg-[#121216] p-4">
        <SectionTitle title="Funnel" />
        <div className="mt-3 space-y-1.5">
          {funnel.map(({ stage, count, stuck }) => (
            <div key={stage} className="grid grid-cols-[7.5rem_1fr_3.5rem] items-center gap-2">
              <span className="truncate text-[12px] text-slate-400">{STAGE_LABEL[stage]}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <span
                  className={`block h-full rounded-full ${stuck ? "bg-amber-400" : "gradient-bar"}`}
                  style={{ width: `${Math.max(6, (count / max) * 100)}%` }}
                />
              </span>
              <span className="text-right text-[13px] font-semibold tabular-nums text-white">
                {count}
                {stuck > 0 && <span className="ml-1 text-[10px] text-amber-400">{stuck}!</span>}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-5">
        {columns.map(({ stage, parts }) => (
          <StageColumn key={stage} stage={stage} parts={parts} />
        ))}
      </div>
    </div>
  );
}

function StageColumn({ stage, parts }: { stage: Stage; parts: Part[] }) {
  const { snap } = useOps();
  return (
    <section className="rounded-xl border border-white/[0.08] bg-[#121216]/80">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
        <StagePill stage={stage} />
        <span className="text-[11px] font-bold tabular-nums text-slate-500">{parts.length}</span>
      </div>
      <div className="max-h-[28rem] space-y-2 overflow-y-auto p-2">
        {parts.length === 0 && (
          <p className="px-2 py-4 text-center text-[11px] text-slate-600">Empty</p>
        )}
        {parts.map((part) => {
          const promo = snap.promos.find((p) => p.id === part.promoId);
          const late = daysLate(part.plannedDate, snap.today);
          return (
            <article
              key={part.id}
              className={`rounded-lg border border-white/[0.07] bg-[#0e0e13] p-2.5 ${
                late > 0
                  ? "border-l-[3px] border-l-rose-500"
                  : part.blocked
                    ? "border-l-[3px] border-l-amber-400"
                    : ""
              }`}
            >
              <Link
                href={`/promo/${part.promoId}`}
                className="text-[12px] font-semibold text-white hover:text-[#9bb0ff]"
              >
                {promo?.showName} · {promo?.promoName}
              </Link>
              <p className="mt-0.5 text-[11px] text-slate-500">
                P{part.partNo} · {formatDuration(part.durationSec)}
              </p>
              <p className="mt-1 truncate text-[11px] text-slate-400">
                {part.artists.length
                  ? part.artists.map((c) => artistName(snap, c.artistId)).join(" + ")
                  : "Unassigned"}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {late > 0 && <KindPill kind="overdue" />}
                {part.blocked && <KindPill kind="blocked" />}
                {late > 0 && (
                  <span className="text-[10px] font-semibold text-rose-300">{late}d</span>
                )}
              </div>
              <div className="mt-2">
                <PartActions partId={part.id} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
