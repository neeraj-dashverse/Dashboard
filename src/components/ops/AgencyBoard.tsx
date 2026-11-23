"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { agencyHandoffs, agencySummary, type AgencyHandoff } from "@/lib/ops/agency";
import { formatClock, formatDmy, STAGE_LABEL } from "@/lib/ops/selectors";
import { Kpi, PriorityPill, SectionTitle } from "./ui";
import { useOps } from "./OpsProvider";

function LinkChip({ href, label }: { href: string | null; label: string }) {
  if (!href) {
    return (
      <span className="rounded-md border border-dashed border-white/[0.08] px-2.5 py-1 text-[11px] text-slate-600">
        {label} —
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="rounded-md border border-[#4361ee]/30 bg-[#4361ee]/10 px-2.5 py-1 text-[11px] font-semibold text-[#9bb0ff] hover:bg-[#4361ee]/20"
    >
      {label} ↗
    </a>
  );
}

function partList(row: AgencyHandoff): string {
  if (row.agencyParts.length === 0) return "None assigned";
  return row.agencyParts.map((part) => `P${part.partNo}`).join(", ");
}

function HandoffCard({ row }: { row: AgencyHandoff }) {
  return (
    <article className="rounded-xl border border-white/[0.08] bg-[#161a26] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityPill priority={row.priority} />
            <Link href={`/promo/${encodeURIComponent(row.promoId)}`} className="truncate font-semibold text-white hover:underline">
              {row.showName}
              <span className="ml-1.5 font-normal text-slate-400">· {row.promoName}</span>
            </Link>
          </div>
          <p className="mt-1 text-[12px] text-slate-400">
            Give agency <span className="font-semibold tabular-nums text-white">{row.agencyParts.length}</span>
            {row.totalParts > 0 ? (
              <span> of {row.totalParts} parts</span>
            ) : null}
            {row.agencyParts.length > 0 ? <span> · {partList(row)}</span> : null}
            {row.agencyDurationSec > 0 ? (
              <span> · {formatClock(row.agencyDurationSec)}</span>
            ) : null}
          </p>
        </div>
        <div className="text-right text-[12px] text-slate-400">
          <p>
            CP <span className="font-semibold text-slate-200">{row.cps ?? "—"}</span>
          </p>
          <p className="tabular-nums">
            Deadline <span className="font-semibold text-slate-200">{formatDmy(row.deadline)}</span>
          </p>
        </div>
      </div>

      {row.agencyParts.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-[12px]">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="pb-1 pr-3 font-bold">Part</th>
                <th className="pb-1 pr-3 font-bold">Duration</th>
                <th className="pb-1 pr-3 font-bold">Agency</th>
                <th className="pb-1 pr-3 font-bold">Deadline</th>
                <th className="pb-1 font-bold">Stage</th>
              </tr>
            </thead>
            <tbody>
              {row.agencyParts.map((part) => (
                <tr key={part.partNo} className="border-t border-white/[0.05] text-slate-300">
                  <td className="py-1.5 pr-3 font-semibold tabular-nums text-white">P{part.partNo}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{formatClock(part.durationSec)}</td>
                  <td className="py-1.5 pr-3">{part.artist ?? "—"}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{formatDmy(part.deadline)}</td>
                  <td className="py-1.5">{STAGE_LABEL[part.stage]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <LinkChip href={row.scriptLink} label="Script" />
        <LinkChip href={row.agencyScriptLink} label="Agency script" />
        <LinkChip href={row.demarcatedScriptLink} label="Demarcated script" />
        <LinkChip href={row.frameioLink} label="Frame.io" />
        <LinkChip href={row.assetsDriveLink} label="Asset drive" />
        <LinkChip href={row.assetMapLink} label="Asset map" />
      </div>

      {row.missing.length > 0 && (
        <p className="mt-2 text-[11px] text-rose-300">Missing: {row.missing.join(", ")}</p>
      )}
    </article>
  );
}

export function AgencyBoard() {
  const { snap } = useOps();
  const [query, setQuery] = useState("");
  const [allOpen, setAllOpen] = useState(false);

  const rows = useMemo(() => agencyHandoffs(snap, { allOpen }), [snap, allOpen]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.showName.toLowerCase().includes(q) ||
        row.promoName.toLowerCase().includes(q) ||
        (row.cps ?? "").toLowerCase().includes(q) ||
        partList(row).toLowerCase().includes(q)
    );
  }, [rows, query]);
  const summary = useMemo(() => agencySummary(filtered), [filtered]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-white">Agency</h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-5 text-slate-400">
          Parts to hand to agency, with original / agency / demarcated scripts from Master Tracker,
          plus Frame.io, asset drive, asset map, CP, and deadline.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Agency parts" value={summary.agencyParts} />
        <Kpi label="Still open" value={summary.openAgencyParts} tone="text-amber-200" />
        <Kpi label="Promos" value={summary.promos} />
        <Kpi
          label="Next deadline"
          value={summary.nextDeadline ? formatDmy(summary.nextDeadline) : "—"}
          tone="text-slate-100"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search show, promo, CP…"
          className="min-w-[220px] flex-1 rounded-lg border border-white/[0.1] bg-[#222738] px-3 py-2 text-[13px] text-white placeholder:text-slate-500"
        />
        <label className="flex items-center gap-2 rounded-lg border border-white/[0.1] bg-[#222738] px-3 py-2 text-[12px] text-slate-300">
          <input
            type="checkbox"
            checked={allOpen}
            onChange={(event) => setAllOpen(event.target.checked)}
            className="accent-[#4361ee]"
          />
          Include open promos with no agency parts yet
        </label>
      </div>

      <SectionTitle
        title={allOpen ? "Open promos" : "Agency handoff"}
        hint="Script = original · Agency + Demarcated = send to agency"
        count={filtered.length}
      />

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/[0.1] px-4 py-8 text-center text-[13px] text-slate-500">
          {allOpen
            ? "No open promos match this search."
            : "No Production Tracker rows are marked Agency yet. Tick the filter to see all open promos."}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => (
            <HandoffCard key={row.promoId} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}
