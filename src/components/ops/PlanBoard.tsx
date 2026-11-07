"use client";

import Link from "next/link";
import { useMemo } from "react";
import { assetStartDate, formatDmy, plannerPreprodRows, plannerRows, slotLabel } from "@/lib/ops/selectors";
import type { PlannerCell, Promo } from "@/lib/ops/types";
import { useOps } from "./OpsProvider";

const SLOTS = ["First half", "Second half", "EOD"] as const;
type Slot = (typeof SLOTS)[number];

function readPlan(
  cells: PlannerCell[],
  promoId: string,
  partNo: number,
  re: RegExp
): { date: string; slot: Slot | null } {
  const hit = cells
    .filter((c) => c.promoId === promoId && c.partNo === partNo && re.test(c.text))
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!hit) return { date: "", slot: null };
  const slot = SLOTS.find((s) => hit.text.toLowerCase().includes(s.toLowerCase())) ?? null;
  return { date: hit.date, slot };
}

export function PlanWhen({
  promo,
  partNo,
  base,
  re,
  busy,
  cells,
  onSave,
}: {
  promo: Promo;
  partNo: number;
  base: string;
  re: RegExp;
  busy: boolean;
  cells: PlannerCell[];
  onSave: (promo: Promo, partNo: number, date: string, base: string, slot: Slot | null, re: RegExp) => void;
}) {
  const saved = readPlan(cells, promo.id, partNo, re);
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{base}</p>
      <input
        type="date"
        disabled={busy}
        value={saved.date}
        onChange={(e) => onSave(promo, partNo, e.target.value, base, saved.slot, re)}
        className="rounded-md border border-white/[0.1] bg-[#0e0e13] px-2 py-1 text-[12px] text-white"
      />
      <div className="flex flex-wrap gap-1.5">
        {SLOTS.map((slot) => (
          <button
            key={slot}
            type="button"
            disabled={busy || !saved.date}
            onClick={() => onSave(promo, partNo, saved.date, base, saved.slot === slot ? null : slot, re)}
            className={`rounded-md px-2 py-1 text-[11px] font-bold ${
              saved.slot === slot
                ? "bg-[#4361ee]/40 text-white"
                : "bg-white/[0.06] text-slate-400 hover:text-white"
            } disabled:opacity-40`}
          >
            {slotLabel(`${base} · ${slot}`) ?? slot}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PlanBoard() {
  const { snap } = useOps();

  const promos = useMemo(() => {
    const map = new Map<string, Promo>();
    for (const row of plannerPreprodRows(snap)) map.set(row.promo.id, row.promo);
    for (const row of plannerRows(snap)) map.set(row.promo.id, row.promo);
    return [...map.values()].sort((a, b) => {
      const startA = assetStartDate(a, snap.today) ?? "";
      const startB = assetStartDate(b, snap.today) ?? "";
      if (startA !== startB) return startB.localeCompare(startA);
      return (a.showName || "").localeCompare(b.showName || "");
    });
  }, [snap]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Plan</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">Promos</h1>
        <p className="mt-1 max-w-3xl text-[12px] leading-5 text-slate-400">
          Newest asset start date first. Open a promo to set the plan and record it. First half is by 3:00pm IST,
          second half by 8:00pm, and EOD is 8:00pm.
        </p>
      </div>
      <div className="overflow-hidden rounded-xl border border-white/[0.12]">
        <table className="w-full text-left text-[13px]">
          <thead className="text-[10px] uppercase tracking-wider text-slate-300">
            <tr>
              <th className="px-4 py-3 font-semibold">Promo</th>
              <th className="px-4 py-3 font-semibold">Show</th>
              <th className="px-4 py-3 font-semibold">Asset start</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.08]">
            {promos.map((promo) => (
              <tr key={promo.id}>
                <td className="px-4 py-3">
                  <Link
                    href={`/plan/${encodeURIComponent(promo.id)}`}
                    className="font-semibold text-white hover:underline"
                  >
                    {promo.promoName || promo.showName || "—"}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-300">{promo.showName || "—"}</td>
                <td className="px-4 py-3 text-slate-300">
                  {formatDmy(assetStartDate(promo, snap.today)) || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
