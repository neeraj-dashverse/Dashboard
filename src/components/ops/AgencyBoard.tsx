"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { agencyHandoffs, agencySummary, type AgencyHandoff } from "@/lib/ops/agency";
import { creditCompare } from "@/lib/ops/credits";
import { formatClock, formatDmy, STAGE_LABEL } from "@/lib/ops/selectors";
import { CreditStats } from "./CreditStats";
import { useOps } from "./OpsProvider";

function FileCell({ href, label }: { href: string | null; label: string }) {
  if (!href) {
    return (
      <span className="inline-flex rounded border border-dashed border-amber-500/25 px-1.5 py-0.5 text-[10px] text-amber-700/80">
        {label}
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-500/20"
    >
      {label}
    </a>
  );
}

function partList(row: AgencyHandoff): string {
  if (row.agencyParts.length === 0) return "None yet";
  return row.agencyParts.map((part) => `P${part.partNo}`).join(" · ");
}

function HandoffRow({
  row,
  open,
  onToggle,
}: {
  row: AgencyHandoff;
  open: boolean;
  onToggle: () => void;
}) {
  const { snap } = useOps();
  const ready = row.missing.length === 0;
  return (
    <>
      <tr className="border-t border-amber-500/10 hover:bg-amber-500/[0.04]">
        <td className="px-3 py-3 align-top">
          <button
            type="button"
            onClick={onToggle}
            className="mr-1 text-[11px] text-amber-400/80"
            aria-expanded={open}
          >
            {open ? "▾" : "▸"}
          </button>
          <Link
            href={`/promo/${encodeURIComponent(row.promoId)}`}
            className="font-semibold text-white hover:underline"
          >
            {row.showName}
          </Link>
          <p className="pl-5 text-[12px] text-slate-400">{row.promoName}</p>
        </td>
        <td className="px-3 py-3 align-top">
          <p className="text-[15px] font-extrabold tabular-nums text-amber-100">
            {row.agencyParts.length}
            <span className="ml-1 text-[11px] font-semibold text-slate-500">
              of {row.totalParts || "—"}
            </span>
          </p>
          <p className="text-[11px] text-slate-400">{partList(row)}</p>
          {row.agencyDurationSec > 0 && (
            <p className="text-[11px] tabular-nums text-slate-500">{formatClock(row.agencyDurationSec)}</p>
          )}
        </td>
        <td className="whitespace-nowrap px-3 py-3 align-top text-[12px] text-slate-200">{row.cps ?? "—"}</td>
        <td className="whitespace-nowrap px-3 py-3 align-top text-[12px] tabular-nums text-slate-200">
          {formatDmy(row.deadline)}
        </td>
        <td className="px-3 py-3 align-top">
          <CreditStats
            usage={row.creditUsage}
            compact
            compare={creditCompare(snap, row.promoId, row.creditUsage)}
          />
        </td>
        <td className="px-3 py-3 align-top">
          <div className="flex flex-wrap gap-1">
            <FileCell href={row.scriptLink} label="Script" />
            <FileCell href={row.agencyScriptLink} label="Agency" />
            <FileCell href={row.demarcatedScriptLink} label="Demarcated" />
            <FileCell href={row.frameioLink} label="Frame.io" />
            <FileCell href={row.assetsDriveLink} label="Drive" />
            <FileCell href={row.assetMapLink} label="Map" />
          </div>
          {!ready && <p className="mt-1 text-[10px] text-rose-300">Need {row.missing.join(" · ")}</p>}
        </td>
      </tr>
      {open && (
        <tr className="bg-black/20">
          <td colSpan={6} className="px-3 pb-3 pt-0">
            {row.agencyParts.length === 0 ? (
              <p className="pl-5 text-[12px] text-slate-500">No Production Tracker rows marked Agency yet.</p>
            ) : (
              <table className="ml-5 mt-1 w-[calc(100%-1.25rem)] text-left text-[12px]">
                <thead>
                  <tr className="text-[10px] font-bold uppercase tracking-wider text-amber-500/70">
                    <th className="py-1 pr-3">Part</th>
                    <th className="py-1 pr-3">Duration</th>
                    <th className="py-1 pr-3">Agency</th>
                    <th className="py-1 pr-3">Deadline</th>
                    <th className="py-1">Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {row.agencyParts.map((part) => (
                    <tr key={part.partNo} className="text-slate-300">
                      <td className="py-1 pr-3 font-semibold tabular-nums text-amber-100">P{part.partNo}</td>
                      <td className="py-1 pr-3 tabular-nums">{formatClock(part.durationSec)}</td>
                      <td className="py-1 pr-3">{part.artist ?? "—"}</td>
                      <td className="py-1 pr-3 tabular-nums">{formatDmy(part.deadline)}</td>
                      <td className="py-1">{STAGE_LABEL[part.stage]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export function AgencyBoard() {
  const { snap } = useOps();
  const [query, setQuery] = useState("");
  const [allOpen, setAllOpen] = useState(false);
  const [openIds, setOpenIds] = useState<string[]>([]);

  const rows = useMemo(() => agencyHandoffs(snap, { allOpen }), [snap, allOpen]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.showName.toLowerCase().includes(q) ||
        row.promoName.toLowerCase().includes(q) ||
        (row.cps ?? "").toLowerCase().includes(q) ||
        (row.creditUsage?.label ?? "").toLowerCase().includes(q) ||
        partList(row).toLowerCase().includes(q)
    );
  }, [rows, query]);
  const summary = useMemo(() => agencySummary(filtered), [filtered]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-[#2a2218] to-[#161a26] p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/80">Outside handoff</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">Agency pack</h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-5 text-amber-100/70">
          One row per promo: how many parts to give the agency, and the files they need.
          Latest Master Tracker promo is on top.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-amber-500/20 bg-black/20 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500/70">Agency parts</p>
            <p className="text-xl font-extrabold tabular-nums text-white">{summary.agencyParts}</p>
          </div>
          <div className="rounded-lg border border-amber-500/20 bg-black/20 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500/70">Still open</p>
            <p className="text-xl font-extrabold tabular-nums text-amber-200">{summary.openAgencyParts}</p>
          </div>
          <div className="rounded-lg border border-amber-500/20 bg-black/20 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500/70">Promos</p>
            <p className="text-xl font-extrabold tabular-nums text-white">{summary.promos}</p>
          </div>
          <div className="rounded-lg border border-amber-500/20 bg-black/20 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500/70">Next deadline</p>
            <p className="text-xl font-extrabold tabular-nums text-white">
              {summary.nextDeadline ? formatDmy(summary.nextDeadline) : "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-amber-500/15 bg-[#1b1814] px-4 py-3 text-[12px] leading-5 text-slate-400">
        <p className="font-semibold text-amber-200/90">Where this is collected</p>
        <p className="mt-1">
          <span className="text-slate-300">Master Tracker</span> · Script (I original) · Agency script (J) ·
          Demarcated script (K) · CP (E).{" "}
          <span className="text-slate-300">Production Tracker</span> · team Agency (G) · part · duration ·
          artist · deadline (K).{" "}
          <span className="text-slate-300">Assets Master</span> · Asset map (G) · Assets drive (I).{" "}
          <span className="text-slate-300">Frame.io</span> · Master Sheet / Assets canvas or Krock when that is
          the review link.{" "}
          <span className="text-slate-300">Credits</span> · Credit Consumption Analysis · PFM tab, shown here
          only.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search show, promo, CP…"
          className="min-w-[220px] flex-1 rounded-lg border border-amber-500/20 bg-[#221c16] px-3 py-2 text-[13px] text-white placeholder:text-slate-500"
        />
        <label className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-[#221c16] px-3 py-2 text-[12px] text-slate-300">
          <input
            type="checkbox"
            checked={allOpen}
            onChange={(event) => setAllOpen(event.target.checked)}
            className="accent-amber-500"
          />
          Include open promos with no agency parts yet
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-amber-500/20 px-4 py-8 text-center text-[13px] text-slate-500">
          {allOpen
            ? "No open promos match this search."
            : "No Production Tracker rows are marked Agency yet. Tick the filter to see all open promos."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-amber-500/20">
          <table className="min-w-[760px] w-full border-collapse text-left">
            <thead className="bg-[#2a2218] text-[10px] font-bold uppercase tracking-wider text-amber-500/80">
              <tr>
                <th className="px-3 py-2.5">Promo</th>
                <th className="px-3 py-2.5">Give agency</th>
                <th className="px-3 py-2.5">CP</th>
                <th className="px-3 py-2.5">Deadline</th>
                <th className="px-3 py-2.5">Credits</th>
                <th className="px-3 py-2.5">Files</th>
              </tr>
            </thead>
            <tbody className="bg-[#14110e]">
              {filtered.map((row) => (
                <HandoffRow
                  key={row.promoId}
                  row={row}
                  open={openIds.includes(row.promoId)}
                  onToggle={() =>
                    setOpenIds((current) =>
                      current.includes(row.promoId)
                        ? current.filter((id) => id !== row.promoId)
                        : [...current, row.promoId]
                    )
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
