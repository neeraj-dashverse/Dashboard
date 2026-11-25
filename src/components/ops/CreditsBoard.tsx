"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  creditStatusTone,
  formatCredits,
  formatMin,
  formatPerMin,
  isCreditInFlight,
  perMinCredits,
  workedDurationMin,
} from "@/lib/ops/credits";
import type { CreditUsage } from "@/lib/ops/types";
import { useOps } from "./OpsProvider";

type Filter = "all" | "tracker" | "open" | "other";

function trackerLabel(snapPromos: { id: string; showName: string; promoName: string }[], usage: CreditUsage) {
  if (!usage.matchedPromoId) return null;
  const promo = snapPromos.find((row) => row.id === usage.matchedPromoId);
  if (!promo) return usage.matchedPromoId;
  return promo.promoName ? `${promo.showName} · ${promo.promoName}` : promo.showName;
}

export function CreditsBoard() {
  const { snap } = useOps();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const usages = snap.creditUsages ?? [];
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return usages.filter((row) => {
      if (filter === "tracker" && !row.matchedPromoId) return false;
      if (filter === "open" && !isCreditInFlight(row.status)) return false;
      if (filter === "other" && row.matchedPromoId) return false;
      if (!q) return true;
      const matched = trackerLabel(snap.promos, row) ?? "";
      return (
        row.label.toLowerCase().includes(q) ||
        (row.status ?? "").toLowerCase().includes(q) ||
        matched.toLowerCase().includes(q)
      );
    });
  }, [usages, snap.promos, query, filter]);

  const matched = usages.filter((row) => row.matchedPromoId);
  const inFlight = usages.filter((row) => isCreditInFlight(row.status));
  const spend = usages.reduce((sum, row) => sum + (row.totalCredits ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-[#152228] to-[#161a26] p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-500/80">Promo credit only</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">Credits</h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-5 text-cyan-100/70">
          Rows that start with PFM and end with Promo. Video, LLM, and image credits, then credits per minute
          against duration worked. Not written into your Timeline sheet.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Kpi label="Promo rows" value={usages.length} />
          <Kpi label="On tracker" value={matched.length} />
          <Kpi label="In production / agency" value={inFlight.length} tone="text-amber-200" />
          <Kpi label="Total credits" value={formatCredits(spend)} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search promo…"
          className="min-w-[220px] flex-1 rounded-lg border border-cyan-500/20 bg-[#152028] px-3 py-2 text-[13px] text-white placeholder:text-slate-500"
        />
        {(
          [
            ["all", "All promo"],
            ["tracker", "On tracker"],
            ["open", "In flight"],
            ["other", "Not on tracker"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-lg px-3 py-2 text-[12px] font-bold ${
              filter === id
                ? "bg-cyan-500/20 text-cyan-100"
                : "border border-white/[0.08] text-slate-400 hover:bg-white/[0.04]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-cyan-500/20 px-4 py-8 text-center text-[13px] text-slate-500">
          No PFM Promo credit rows match this search.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-cyan-500/20">
          <table className="min-w-[1100px] w-full border-collapse text-left">
            <thead className="bg-[#152228] text-[10px] font-bold uppercase tracking-wider text-cyan-500/80">
              <tr>
                <th className="px-3 py-2.5">Promo</th>
                <th className="px-3 py-2.5">Videos</th>
                <th className="px-3 py-2.5">LLM</th>
                <th className="px-3 py-2.5">Images</th>
                <th className="px-3 py-2.5">Total</th>
                <th className="px-3 py-2.5">Credit min</th>
                <th className="px-3 py-2.5">/ min</th>
                <th className="px-3 py-2.5">Worked</th>
                <th className="px-3 py-2.5">Worked / min</th>
                <th className="px-3 py-2.5">Tracker</th>
              </tr>
            </thead>
            <tbody className="bg-[#10161c]">
              {rows.map((row) => {
                const matchedLabel = trackerLabel(snap.promos, row);
                const sheetPerMin = perMinCredits(row.totalCredits, row.durationMin);
                const worked = workedDurationMin(snap, row.matchedPromoId);
                const workedPerMin = perMinCredits(row.totalCredits, worked);
                return (
                  <tr key={row.id} className="border-t border-cyan-500/10 hover:bg-cyan-500/[0.04]">
                    <td className="px-3 py-3 align-top">
                      <p className="font-semibold text-white">{row.label}</p>
                      <p className={`text-[11px] ${creditStatusTone(row.status)}`}>{row.status || "No status"}</p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-top text-[12px] tabular-nums text-slate-200">
                      {formatCredits(row.videos)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-top text-[12px] tabular-nums text-slate-200">
                      {formatCredits(row.llm)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-top text-[12px] tabular-nums text-slate-200">
                      {formatCredits(row.images)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-top text-[13px] font-extrabold tabular-nums text-cyan-100">
                      {formatCredits(row.totalCredits)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-top text-[12px] tabular-nums text-slate-200">
                      {formatMin(row.durationMin)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-top text-[12px] tabular-nums text-slate-200">
                      {formatPerMin(sheetPerMin)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-top text-[12px] tabular-nums text-slate-200">
                      {formatMin(worked)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-top text-[13px] font-extrabold tabular-nums text-cyan-100">
                      {formatPerMin(workedPerMin)}
                    </td>
                    <td className="px-3 py-3 align-top text-[12px]">
                      {row.matchedPromoId ? (
                        <Link
                          href={`/promo/${encodeURIComponent(row.matchedPromoId)}`}
                          className="font-semibold text-cyan-200 hover:underline"
                        >
                          {matchedLabel}
                        </Link>
                      ) : (
                        <span className="text-slate-600">Not on tracker</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  tone = "text-white",
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-cyan-500/20 bg-black/20 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-500/70">{label}</p>
      <p className={`text-xl font-extrabold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}
