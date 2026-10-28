"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  animatorLoads,
  artistName,
  buildExceptions,
  buildNudges,
  daysUntil,
  formatDuration,
  overnightBlockers,
  type ExceptionItem,
} from "@/lib/ops/selectors";
import type { NudgeKind, OpsNudge } from "@/lib/ops/types";
import { Kpi, PriorityPill, SectionTitle, StagePill, Tag } from "./ui";
import { PartActions } from "./PartActions";
import { SyncStrip } from "./SyncStrip";
import { useOps } from "./OpsProvider";

/** Urgency buckets — the only grouping on this page. */
const BUCKETS = [
  { id: "overdue", label: "Overdue", accent: "border-l-rose-500", dot: "bg-rose-400" },
  { id: "today", label: "Today", accent: "border-l-[#4361ee]", dot: "bg-[#6d86ff]" },
  { id: "soon", label: "Next 2 days", accent: "border-l-amber-400", dot: "bg-amber-400" },
  { id: "anytime", label: "When you can", accent: "border-l-white/15", dot: "bg-slate-500" },
] as const;
type BucketId = (typeof BUCKETS)[number]["id"];

const NUDGE_TAG: Record<NudgeKind, { label: string; tone: string }> = {
  missing_cps: { label: "Assign Cps", tone: "bg-[#4361ee]/20 text-[#9bb0ff]" },
  missing_part1_artist: { label: "Part 1 artist", tone: "bg-[#4361ee]/20 text-[#9bb0ff]" },
  stale_status: { label: "Check-in", tone: "bg-white/[0.08] text-slate-300" },
  missing_five_min_status: { label: "5-min status", tone: "bg-purple-500/20 text-purple-200" },
  missing_remarks: { label: "Remarks", tone: "bg-white/[0.08] text-slate-300" },
  missing_initial_duration: { label: "Duration", tone: "bg-white/[0.08] text-slate-300" },
  missing_working_script: { label: "Script", tone: "bg-white/[0.08] text-slate-300" },
  missing_agency_script: { label: "Agency script", tone: "bg-amber-500/20 text-amber-200" },
  missing_demarcated_script: { label: "Demarcate", tone: "bg-white/[0.08] text-slate-300" },
  missing_asset_handoff: { label: "Asset links", tone: "bg-amber-500/20 text-amber-200" },
  missing_preprod_planned: { label: "Plan date", tone: "bg-amber-500/20 text-amber-200" },
  assets_delay: { label: "Assets late", tone: "bg-rose-500/20 text-rose-200" },
  assets_needed_by: { label: "Assets by", tone: "bg-emerald-500/20 text-emerald-200" },
  five_min_due: { label: "5-min", tone: "bg-purple-500/20 text-purple-200" },
  complete_due: { label: "Delivery", tone: "bg-[#d6293d]/25 text-[#ff8a98]" },
  part_deadline: { label: "Part due", tone: "bg-[#4361ee]/20 text-[#9bb0ff]" },
  check_tomorrow: { label: "Tomorrow", tone: "bg-white/[0.08] text-slate-300" },
};

type FeedItem = {
  key: string;
  bucket: BucketId;
  rank: number;
  tag: { label: string; tone: string };
  main: ReactNode;
  sub: string;
  action: ReactNode;
};

export function TodayBoard() {
  const { snap, act, busy } = useOps();
  const today = snap.today;

  const exceptions = buildExceptions(snap);
  const nudges = buildNudges(snap);
  const blocked = overnightBlockers(snap);
  const loads = animatorLoads(snap);
  const free = loads.filter((a) => a.free);

  const overdueCount = exceptions.filter(
    (e) => e.kind === "overdue" || e.kind === "delivery-risk"
  ).length;
  const dueTodayCount = exceptions.filter((e) => e.kind === "due-today").length;

  // ── Build one unified, ranked feed ───────────────────────────────────────
  const feed: FeedItem[] = [];

  const exBucket = (e: ExceptionItem): BucketId => {
    if (e.kind === "overdue" || e.kind === "delivery-risk") return "overdue";
    if (e.kind === "blocked") return e.daysLate > 0 ? "overdue" : "today";
    return "today";
  };
  const exTag = (e: ExceptionItem): { label: string; tone: string } => {
    switch (e.kind) {
      case "blocked":
        return { label: "Blocked", tone: "bg-amber-500/20 text-amber-200" };
      case "due-today":
        return { label: "Due today", tone: "bg-[#4361ee]/20 text-[#9bb0ff]" };
      case "delivery-risk":
        return { label: "Delivery", tone: "bg-[#d6293d]/25 text-[#ff8a98]" };
      default:
        return { label: "Overdue", tone: "bg-rose-500/20 text-rose-200" };
    }
  };

  for (const e of exceptions) {
    const bucket = exBucket(e);
    const artists = e.part.artists.length
      ? e.part.artists.map((c) => artistName(snap, c.artistId)).join(", ")
      : "unassigned";
    feed.push({
      key: `ex-${e.kind}-${e.part.id}-${e.promo.id}`,
      bucket,
      rank: bucket === "overdue" ? 0 : 1,
      tag: exTag(e),
      main: (
        <span className="flex flex-wrap items-center gap-2">
          <PriorityPill priority={e.promo.priority} />
          <StagePill stage={e.part.stage} />
          <Link
            href={`/promo/${e.promo.id}`}
            className="text-[13px] font-semibold text-white hover:underline"
          >
            {e.promo.showName} · {e.promo.promoName} · P{e.part.partNo}
          </Link>
        </span>
      ),
      sub:
        `${formatDuration(e.part.durationSec)}` +
        (e.part.plannedDate ? ` · planned ${e.part.plannedDate}` : "") +
        (e.daysLate > 0 ? ` · ${e.daysLate}d late` : "") +
        ` · ${artists}` +
        (e.part.blockReason ? ` · ${e.part.blockReason}` : ""),
      action: <PartActions partId={e.part.id} />,
    });
  }

  const nudgeBucket = (n: OpsNudge): BucketId => {
    if (!n.when) return "anytime";
    if (n.when < today) return "overdue";
    if (n.when === today) return "today";
    return "soon";
  };

  for (const n of nudges) {
    const bucket = nudgeBucket(n);
    const until = n.when ? daysUntil(n.when, today) : null;
    feed.push({
      key: `nu-${n.id}`,
      bucket,
      rank: n.severity === "high" ? 2 : 3,
      tag: NUDGE_TAG[n.kind] ?? { label: n.kind, tone: "bg-white/[0.08] text-slate-300" },
      main: <span className="text-[13px] text-white">{n.prompt}</span>,
      sub:
        n.whyNow +
        (n.when
          ? ` · ${n.when}${until != null && until > 0 ? ` (in ${until}d)` : ""}`
          : ""),
      action: (
        <div className="flex shrink-0 gap-1.5">
          <Link
            href={`/promo/${n.promoId}`}
            className="rounded-md bg-gradient-to-r from-[#4361ee]/30 to-[#d6293d]/25 px-2.5 py-1 text-[11px] font-bold text-white"
          >
            Open
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={() => act({ type: "dismiss_nudge", nudgeId: n.id })}
            className="rounded-md bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-slate-400 hover:text-white"
          >
            Later
          </button>
        </div>
      ),
    });
  }

  const grouped = BUCKETS.map((b) => ({
    ...b,
    items: feed
      .filter((f) => f.bucket === b.id)
      .sort((a, c) => a.rank - c.rank)
      .slice(0, 14),
  })).filter((b) => b.items.length > 0);

  const totalTodo = feed.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
            PocketFM · Operations
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">
            Today
          </h1>
          <p className="mt-1 text-[12px] text-slate-500">
            Everything that needs you, newest pressure first.
          </p>
        </div>
        <p className="text-[12px] tabular-nums text-slate-500">{today}</p>
      </div>

      <SyncStrip />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi
          label="Overdue / at risk"
          value={overdueCount}
          tone={overdueCount ? "text-rose-300" : "text-white"}
        />
        <Kpi
          label="Due today"
          value={dueTodayCount}
          tone={dueTodayCount ? "text-[#9bb0ff]" : "text-white"}
        />
        <Kpi
          label="Blocked"
          value={blocked.length}
          tone={blocked.length ? "text-amber-300" : "text-white"}
        />
        <Kpi label="Free to assign" value={free.length} tone="text-emerald-300" />
      </div>

      <section className="space-y-4">
        <SectionTitle title="To do" count={totalTodo} hint="Grouped by urgency" />

        {grouped.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/[0.1] px-4 py-10 text-center text-[13px] text-slate-600">
            Nothing needs you right now. Pipeline is quiet.
          </p>
        ) : (
          grouped.map((b) => (
            <div key={b.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${b.dot}`} />
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {b.label}
                </h3>
                <span className="text-[11px] tabular-nums text-slate-600">
                  {b.items.length}
                </span>
              </div>
              <div className="divide-y divide-white/[0.05] overflow-hidden rounded-xl border border-white/[0.08] bg-[#121216]">
                {b.items.map((item) => (
                  <div
                    key={item.key}
                    className={`flex flex-wrap items-start gap-3 border-l-[3px] px-3.5 py-2.5 ${b.accent}`}
                  >
                    <Tag label={item.tag.label} tone={item.tag.tone} />
                    <div className="min-w-0 flex-1">
                      {item.main}
                      <p className="mt-0.5 text-[11px] text-slate-500">{item.sub}</p>
                    </div>
                    {item.action}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      {free.length > 0 && (
        <section className="space-y-2">
          <SectionTitle title="Free to assign" count={free.length} />
          <div className="flex flex-wrap gap-2">
            {free.map((a) => (
              <span
                key={a.id}
                className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[12px] font-semibold text-emerald-200"
              >
                {a.name}
                <span className="ml-1.5 font-normal text-emerald-400/70">
                  {a.team === "agency" ? "agency" : "in-house"}
                </span>
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
