"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { plannerPreprodRows, plannerRows, slotLabel } from "@/lib/ops/selectors";
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

export function RemarkBox({ promo, partNo }: { promo: Promo; partNo: number }) {
  const { snap, act, busy } = useOps();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rows = snap.planRemarks.filter((r) => r.promoId === promo.id && r.partNo === partNo);

  const add = async () => {
    const body = draft.trim();
    if (!body) return;
    setError(null);
    try {
      await act({
        type: "append_plan_remark",
        promoId: promo.id,
        partNo,
        body,
        showName: promo.showName,
        promoName: promo.promoName,
      });
      setDraft("");
    } catch {
      setError("Couldn't save that remark.");
    }
  };

  return (
    <div className="space-y-1.5">
      {rows.length > 0 && (
        <ul className="max-h-28 space-y-1 overflow-y-auto">
          {rows.map((r) => (
            <li key={`${r.at}-${r.body}`} className="text-[11px] leading-4 text-slate-300">
              <span className="text-slate-500">{r.at.slice(0, 16).replace("T", " ")} · </span>
              {r.body}
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <input
          value={draft}
          disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Delay or issue"
          className="min-w-0 flex-1 rounded-md border border-white/[0.1] bg-[#0e0e13] px-2 py-1 text-[12px] text-white placeholder:text-slate-600"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="rounded-md bg-white/[0.08] px-2 py-1 text-[11px] font-bold text-slate-200 disabled:opacity-40"
        >
          Add
        </button>
      </form>
      {error && <p className="text-[11px] text-rose-300">{error}</p>}
    </div>
  );
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
      <RemarkBox promo={promo} partNo={partNo} />
    </div>
  );
}

export function PlanBoard() {
  const { snap } = useOps();

  const assets = useMemo(() => plannerPreprodRows(snap), [snap]);
  const parts = useMemo(() => plannerRows(snap), [snap]);

  const promos = useMemo(() => {
    const map = new Map<string, Promo>();
    for (const r of assets) map.set(r.promo.id, r.promo);
    for (const r of parts) map.set(r.promo.id, r.promo);
    return [...map.values()];
  }, [assets, parts]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
          PocketFM · Planning
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">Plan</h1>
        <p className="mt-1 max-w-3xl text-[13px] leading-5 text-slate-400">
          Open a promo tile to set the date and mark 1st half, 2nd half, or EOD. Those marks show
          on the calendar. Remarks stay on the part. Dates save to the Planner tab, each remark is
          a new row on the Remarks tab, both on {snap.workingSource.spreadsheetName}.
        </p>
        <a
          href={snap.workingSource.url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-[12px] font-semibold text-[#9bb0ff] hover:underline"
        >
          Open {snap.workingSource.spreadsheetName} ↗
        </a>
      </div>

      <section className="space-y-3">
        <h2 className="text-[13px] font-bold text-white">Promos</h2>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {promos.map((promo) => {
            const assetOn = assets.some((r) => r.promo.id === promo.id);
            const partCount = parts.filter((r) => r.promo.id === promo.id).length;
            return (
              <Link
                key={promo.id}
                href={`/plan/${encodeURIComponent(promo.id)}`}
                className="rounded-xl border border-white/[0.08] bg-[#121216] px-3 py-3 hover:border-white/[0.16]"
              >
                <p className="text-[13px] font-bold text-white">{promo.showName || "—"}</p>
                <p className="mt-0.5 truncate text-[12px] text-slate-400">{promo.promoName || "—"}</p>
                <p className="mt-2 text-[11px] text-slate-500">
                  {promo.cps ? `Cps ${promo.cps}` : "No Cps"}
                  {assetOn ? " · assets" : ""}
                  {partCount ? ` · ${partCount} part${partCount > 1 ? "s" : ""}` : ""}
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
