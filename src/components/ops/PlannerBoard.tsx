"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  artistName,
  dayLanes,
  isHoliday,
  plannerDays,
  plannerPreprodRows,
  plannerRows,
  formatDmy,
  type DayLane,
  type PlannerRow,
  type PlannerTab,
} from "@/lib/ops/selectors";
import type { Stage } from "@/lib/ops/types";
import { useOps } from "./OpsProvider";
import { SyncStrip } from "./SyncStrip";

const STAGE_DOT: Record<Stage, string> = {
  planning: "bg-slate-400",
  animation: "bg-[#6d86ff]",
  edit: "bg-amber-400",
  correction: "bg-orange-400",
  sound: "bg-purple-400",
  delivered: "bg-emerald-400",
};

const STAGE_CHIP: Record<string, string> = {
  Assets: "bg-sky-500/25 text-sky-100",
  Plotting: "bg-slate-400/25 text-slate-100",
  Animation: "bg-violet-500/25 text-violet-100",
  "First animation": "bg-amber-400/25 text-amber-100",
  "First edit": "bg-teal-400/25 text-teal-100",
  "First cut": "bg-amber-400/25 text-amber-100",
  "Rough cut": "bg-amber-400/25 text-amber-100",
  "Final cut": "bg-orange-500/25 text-orange-100",
  Edit: "bg-teal-400/25 text-teal-100",
  "Correction close": "bg-orange-500/25 text-orange-100",
  Correction: "bg-orange-500/25 text-orange-100",
  Sound: "bg-fuchsia-500/25 text-fuchsia-100",
};

const STAGE_SOLID: Record<string, string> = {
  Assets: "bg-sky-500 text-white",
  Plotting: "bg-slate-300 text-[#121216]",
  Animation: "bg-violet-500 text-white",
  "First animation": "bg-amber-400 text-[#121216]",
  "First edit": "bg-teal-400 text-[#121216]",
  "First cut": "bg-amber-400 text-[#121216]",
  "Rough cut": "bg-amber-400 text-[#121216]",
  "Final cut": "bg-orange-500 text-white",
  Edit: "bg-teal-400 text-[#121216]",
  "Correction close": "bg-orange-500 text-white",
  Correction: "bg-orange-500 text-white",
  Sound: "bg-fuchsia-500 text-white",
};

function plannedLabel(note: string): string {
  if (/rough cut|first cut|first animation|first edit/i.test(note)) return "Planned first cut";
  if (/final cut|second cut|correction/i.test(note)) return "Planned final cut";
  if (/sound/i.test(note)) return "Planned sound";
  if (/asset/i.test(note)) return "Planned assets";
  return `Planned ${note}`;
}

function chipClass(label: string): string {
  const key = (Object.keys(STAGE_CHIP) as (keyof typeof STAGE_CHIP)[]).find((k) =>
    label === k || label.startsWith(`${k} ·`)
  );
  return (key && STAGE_CHIP[key]) || "bg-white/[0.08] text-slate-200";
}

function solidClass(label: string): string {
  const key = (Object.keys(STAGE_SOLID) as (keyof typeof STAGE_SOLID)[]).find((k) =>
    label === k || label.startsWith(`${k} ·`)
  );
  return (key && STAGE_SOLID[key]) || "bg-white text-[#121216]";
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const dow = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();
function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Sticky left columns — Production keeps Artist and Editor apart. */
const W_PROD = { show: 120, promo: 140, part: 44, artist: 110, editor: 110 };
const W_ASSET = { show: 180, promo: 140, people: 150 };
const LEFT_PROD = {
  show: 0,
  promo: W_PROD.show,
  part: W_PROD.show + W_PROD.promo,
  artist: W_PROD.show + W_PROD.promo + W_PROD.part,
  editor: W_PROD.show + W_PROD.promo + W_PROD.part + W_PROD.artist,
};
const LEFT_ASSET = {
  show: 0,
  promo: W_ASSET.show,
  people: W_ASSET.show + W_ASSET.promo,
};

export function PlannerBoard() {
  const { snap } = useOps();
  const [tab, setTab] = useState<PlannerTab>("preprod");
  const [shift, setShift] = useState(0);

  const rows = useMemo(
    () => (tab === "preprod" ? plannerPreprodRows(snap) : plannerRows(snap)),
    [snap, tab]
  );
  const days = useMemo(() => {
    const base = plannerDays(snap);
    if (shift === 0 || base.length === 0) return base;
    const first = addDays(base[0], shift);
    const last = addDays(base[base.length - 1], shift);
    const out: string[] = [];
    let d = first;
    while (d <= last) {
      out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }, [snap, shift]);

  const promoCount = new Set(rows.map((r) => r.promo.id)).size;

  const fmtDay = (iso: string) => {
    return { label: formatDmy(iso), wd: WEEKDAYS[dow(iso)] };
  };

  const peopleOf = (r: PlannerRow) => {
    if (tab === "preprod") {
      const a = r.promo.assetTeam;
      const names = [a?.artist1, a?.artist2, a?.artist3].filter(Boolean).join(", ");
      return { artist: names || r.promo.preProd?.artist || null, editor: a?.artLead ?? null };
    }
    const p = r.part;
    if (!p) {
      return { artist: r.promo.cps ? `Cps ${r.promo.cps}` : null, editor: null as string | null };
    }
    const artist = p.artist ?? (p.artists[0] ? artistName(snap, p.artists[0].artistId) : null);
    return { artist, editor: p.editors };
  };

  const laneChip = (l: DayLane) => (
    <div
      key={`${l.lane}-${l.label}`}
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight ${
        l.closed ? solidClass(l.label) : chipClass(l.label)
      }`}
    >
      {l.label}
    </div>
  );

  return (
    <div className="space-y-4">
      <SyncStrip />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
            PocketFM · Operations
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">Calendar</h1>
          <p className="mt-1 text-[12px] text-slate-500">
            {promoCount} ongoing promos
            {tab === "production" ? ` · ${rows.length} parts` : ""}. Read-only Gantt from Sheets.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShift((s) => s - 7)}
            className="rounded-md bg-white/[0.05] px-2.5 py-1.5 text-[13px] font-bold text-slate-300 hover:text-white"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => setShift(0)}
            className="rounded-md bg-white/[0.05] px-2.5 py-1.5 text-[12px] font-semibold text-slate-300 hover:text-white"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setShift((s) => s + 7)}
            className="rounded-md bg-white/[0.05] px-2.5 py-1.5 text-[13px] font-bold text-slate-300 hover:text-white"
          >
            →
          </button>
        </div>
      </div>

      <div className="flex gap-1 rounded-xl border border-white/[0.08] bg-[#121216] p-1">
        {(
          [
            ["preprod", "Pre-production"],
            ["production", "Production"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 rounded-lg px-3 py-2 text-[13px] font-bold ${
              tab === id
                ? "bg-gradient-to-r from-[#4361ee]/40 to-[#d6293d]/30 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
        {(
          [
            ["Assets", "Assets"],
            ["Animation", "Animation"],
            ["Edit", "Edit"],
            ["Correction", "Correction"],
            ["Sound", "Sound"],
          ] as const
        ).map(([label]) => (
          <span key={label} className={`rounded px-1.5 py-0.5 font-semibold ${chipClass(label)}`}>
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="rounded border border-dashed border-white/30 px-1.5 py-0.5 font-semibold text-slate-200">
            Planned first cut
          </span>
          date you set
        </span>
        <span className="flex items-center gap-1.5">
          <span className="rounded bg-violet-500 px-1.5 py-0.5 font-semibold text-white">Animation</span>
          finished that day
        </span>
        <span className="flex items-center gap-1.5">
          <span className="rounded bg-rose-500/20 px-1.5 py-0.5 font-semibold text-rose-100 ring-1 ring-rose-400/70">
            Delay
          </span>
          box in red
        </span>
        <span className="flex items-center gap-1.5">
          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-semibold text-amber-100">Holiday</span>
          Sunday · 2nd Saturday
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/[0.1] px-4 py-10 text-center text-[13px] text-slate-600">
          No ongoing {tab === "preprod" ? "asset" : "production"} work right now.
        </p>
      ) : (
        <Grid
          days={days}
          rows={rows}
          snapToday={snap.today}
          tab={tab}
          fmtDay={fmtDay}
          peopleOf={peopleOf}
          laneChip={laneChip}
        />
      )}

      <p className="text-[11px] text-slate-600">
        {tab === "preprod"
          ? "WIP only. Assets fill from Start (Y) through End (Z), or through today if Z is empty. Correction fills from AB through AC."
          : "Read-only from Production Tracker. Artist (H) and Editor (I) stay in separate columns. Stages from L / M / O / R / T / W."}
      </p>
    </div>
  );
}

function Grid({
  days,
  rows,
  snapToday,
  tab,
  fmtDay,
  peopleOf,
  laneChip,
}: {
  days: string[];
  rows: PlannerRow[];
  snapToday: string;
  tab: PlannerTab;
  fmtDay: (iso: string) => { label: string; wd: string };
  peopleOf: (r: PlannerRow) => { artist: string | null; editor: string | null };
  laneChip: (l: DayLane) => ReactNode;
}) {
  const isAsset = tab === "preprod";
  const stick = "sticky z-10 bg-[#121216] border-b border-white/[0.05] px-2 py-1.5 align-top";
  const head =
    "sticky top-0 z-40 border-b border-white/[0.08] bg-[#17171d] px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500";

  return (
    <div className="max-h-[calc(100dvh-15rem)] overflow-auto rounded-xl border border-white/[0.08] bg-[#121216]">
      <table className="border-separate border-spacing-0 text-left">
        <thead>
          <tr>
            <th
              style={{
                left: isAsset ? LEFT_ASSET.show : LEFT_PROD.show,
                width: isAsset ? W_ASSET.show : W_PROD.show,
                minWidth: isAsset ? W_ASSET.show : W_PROD.show,
              }}
              className={head}
            >
              Show
            </th>
            <th
              style={{
                left: isAsset ? LEFT_ASSET.promo : LEFT_PROD.promo,
                width: isAsset ? W_ASSET.promo : W_PROD.promo,
                minWidth: isAsset ? W_ASSET.promo : W_PROD.promo,
              }}
              className={head}
            >
              Promo
            </th>
            {isAsset ? (
              <th
                style={{ left: LEFT_ASSET.people, width: W_ASSET.people, minWidth: W_ASSET.people }}
                className={`${head} border-r border-r-white/[0.08]`}
              >
                Asset artists
              </th>
            ) : (
              <>
                <th
                  style={{ left: LEFT_PROD.part, width: W_PROD.part, minWidth: W_PROD.part }}
                  className={head}
                >
                  Part
                </th>
                <th
                  style={{ left: LEFT_PROD.artist, width: W_PROD.artist, minWidth: W_PROD.artist }}
                  className={head}
                >
                  Animator
                </th>
                <th
                  style={{ left: LEFT_PROD.editor, width: W_PROD.editor, minWidth: W_PROD.editor }}
                  className={`${head} border-r border-r-white/[0.08]`}
                >
                  Editor
                </th>
              </>
            )}
            {days.map((d) => {
              const f = fmtDay(d);
              const today = d === snapToday;
              const holiday = isHoliday(d);
              return (
                <th
                  key={d}
                  className={`sticky top-0 z-30 min-w-[108px] border-b border-white/[0.08] px-1.5 py-2 text-[11px] font-bold ${
                    holiday
                      ? "bg-[#2a2218] text-amber-100/90"
                      : today
                        ? "bg-[#1d2447] text-[#9bb0ff]"
                        : "bg-[#17171d] text-slate-400"
                  }`}
                >
                  {f.label}
                  <span
                    className={`ml-1.5 text-[10px] font-medium ${holiday ? "text-amber-200/80" : "text-slate-600"}`}
                  >
                    {holiday ? "Holiday" : f.wd}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            const { artist, editor } = peopleOf(r);
            const divider = r.firstOfPromo && idx > 0 ? "border-t-2 border-t-white/[0.12]" : "";
            return (
              <tr key={r.key} className={divider}>
                <td
                  style={{
                    left: isAsset ? LEFT_ASSET.show : LEFT_PROD.show,
                    width: isAsset ? W_ASSET.show : W_PROD.show,
                    minWidth: isAsset ? W_ASSET.show : W_PROD.show,
                  }}
                  className={stick}
                >
                  {(isAsset || r.firstOfPromo) && (
                    <Link
                      href={`/plan/${encodeURIComponent(r.promo.id)}`}
                      className="block truncate text-[12px] font-bold text-white hover:underline"
                      title={r.promo.showName || "Open promo"}
                    >
                      {r.promo.showName || "—"}
                    </Link>
                  )}
                </td>
                <td
                  style={{
                    left: isAsset ? LEFT_ASSET.promo : LEFT_PROD.promo,
                    width: isAsset ? W_ASSET.promo : W_PROD.promo,
                    minWidth: isAsset ? W_ASSET.promo : W_PROD.promo,
                  }}
                  className={stick}
                >
                  {(isAsset || r.firstOfPromo) && (
                    <Link
                      href={`/plan/${encodeURIComponent(r.promo.id)}`}
                      className="block max-w-full truncate text-left text-[12px] font-semibold text-slate-200 hover:underline"
                      title="Open promo"
                    >
                      {r.promo.promoName || "—"}
                    </Link>
                  )}
                </td>
                {isAsset ? (
                  <td
                    style={{
                      left: LEFT_ASSET.people,
                      width: W_ASSET.people,
                      minWidth: W_ASSET.people,
                    }}
                    className={`${stick} border-r border-r-white/[0.08]`}
                  >
                    <p className="truncate text-[11px] text-slate-300">{artist ?? "—"}</p>
                    {editor && <p className="truncate text-[10px] text-slate-500">{editor}</p>}
                  </td>
                ) : (
                  <>
                    <td
                      style={{ left: LEFT_PROD.part, width: W_PROD.part, minWidth: W_PROD.part }}
                      className={stick}
                    >
                      <Link
                        href={`/plan/${encodeURIComponent(r.promo.id)}`}
                        className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-300 hover:text-white"
                        title="Open promo"
                      >
                        {r.part ? (
                          <>
                            <span className={`h-2 w-2 rounded-full ${STAGE_DOT[r.part.stage]}`} />P
                            {r.partNo}
                          </>
                        ) : (
                          "—"
                        )}
                      </Link>
                    </td>
                    <td
                      style={{
                        left: LEFT_PROD.artist,
                        width: W_PROD.artist,
                        minWidth: W_PROD.artist,
                      }}
                      className={stick}
                    >
                      <p className="truncate text-[11px] text-slate-300" title={artist ?? undefined}>
                        {artist ?? "—"}
                      </p>
                    </td>
                    <td
                      style={{
                        left: LEFT_PROD.editor,
                        width: W_PROD.editor,
                        minWidth: W_PROD.editor,
                      }}
                      className={`${stick} border-r border-r-white/[0.08]`}
                    >
                      <p className="truncate text-[11px] text-slate-300" title={editor ?? undefined}>
                        {editor ?? "—"}
                      </p>
                    </td>
                  </>
                )}
                {days.map((d) => {
                  const holiday = isHoliday(d);
                  const lanes = dayLanes(r, d, snapToday, tab).filter(
                    (l) => !holiday || l.closed
                  );
                  const delayed =
                    !!r.plannedDate &&
                    d > r.plannedDate &&
                    lanes.some((l) => l.timing === "late");
                  return (
                    <td
                      key={d}
                      className={`min-w-[92px] border-b border-white/[0.05] p-1 align-top ${
                        delayed
                          ? "bg-rose-500/20 ring-1 ring-inset ring-rose-400/80"
                          : holiday
                            ? "bg-[repeating-linear-gradient(135deg,rgba(245,158,11,0.07)_0_6px,transparent_6px_12px)]"
                            : d === snapToday
                              ? "bg-[#4361ee]/[0.06]"
                              : ""
                      }`}
                    >
                      <div className="min-h-[34px] space-y-1">
                        {r.planMarks
                          .filter((m) => m.date === d)
                          .map((m) => (
                            <div
                              key={m.note}
                              className={`rounded border border-dashed border-white/20 px-1.5 py-0.5 text-[10px] font-semibold leading-tight ${chipClass(m.note)}`}
                            >
                              {plannedLabel(m.note)}
                            </div>
                          ))}
                        {lanes
                          .filter(
                            (l) => !r.planMarks.some((m) => m.date === d && m.note.startsWith(l.label))
                          )
                          .map(laneChip)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
