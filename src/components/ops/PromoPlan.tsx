"use client";

import Link from "next/link";
import { useState } from "react";
import { assetClosedDate, formatDmy } from "@/lib/ops/selectors";
import type { PlannerCell } from "@/lib/ops/types";
import { RemarkBox } from "./PlanBoard";
import { useOps } from "./OpsProvider";

function detail(label: string, value: string | null | undefined) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-0.5 text-[13px] text-slate-200">{value || "—"}</p>
    </div>
  );
}

export function PromoPlan({ promoId }: { promoId: string }) {
  const { snap, act, busy } = useOps();
  const [saveError, setSaveError] = useState<string | null>(null);
  const promo = snap.promos.find((p) => p.id === promoId);
  if (!promo) {
    return (
      <div className="space-y-3">
        <Link href="/plan" className="text-[12px] font-semibold text-[#9bb0ff] hover:underline">
          ← Plan
        </Link>
        <p className="text-[13px] text-slate-400">That promo is not on the sheet right now.</p>
      </div>
    );
  }

  const asset = promo.assetTeam;
  const plotters = [asset?.artist1, asset?.artist2, asset?.artist3].filter(Boolean).join(", ");
  const byPart = new Map<number, (typeof snap.parts)[number]>();
  for (const part of snap.parts) {
    if (part.promoId === promo.id) byPart.set(part.partNo, part);
  }
  const parts = [...byPart.values()].sort((a, b) => a.partNo - b.partNo);
  const animators = [...new Set(parts.map((p) => p.artist).filter(Boolean))].join(", ");
  const editors = [...new Set(parts.map((p) => p.editors).filter(Boolean))].join(", ");

  const save = async (partNo: number, date: string, label: string, re: RegExp) => {
    if (!date) return;
    const existing = snap.plannerCells.filter(
      (c) => c.promoId === promo.id && c.partNo === partNo && re.test(c.text) && c.date
    );
    if (existing.length > 0) return;
    setSaveError(null);
    try {
      await act({
        type: "set_plan_cell",
        promoId: promo.id,
        partNo,
        date,
        text: label,
        showName: promo.showName,
        promoName: promo.promoName,
      });
    } catch {
      setSaveError("That date did not save to the Planner sheet. Try again.");
    }
  };

  const promoClosed = Boolean(promo.trackerStatus && /closed/i.test(promo.trackerStatus));
  const status = (asset?.assetsStatus ?? "").toLowerCase();
  const assetsClosed =
    Boolean(assetClosedDate(promo)) || (status.includes("approved") && !status.includes("send"));

  return (
    <div className="space-y-5">
      <div>
        <Link href="/plan" className="text-[12px] font-semibold text-[#9bb0ff] hover:underline">
          ← Plan
        </Link>
        <p className="mt-3 text-[12px] font-semibold text-slate-400">{promo.showName || "Promo"}</p>
        <h1 className="mt-1 text-2xl font-extrabold text-white">{promo.promoName || promo.showName || "—"}</h1>
        {saveError && <p className="mt-2 text-[12px] text-rose-300">{saveError}</p>}
      </div>

      <section className="grid gap-3 rounded-xl border border-white/[0.08] bg-[#121216] p-4 sm:grid-cols-3 lg:grid-cols-4">
        {detail("Cps", promo.cps)}
        {detail("Status", promo.trackerStatus)}
        {detail("Priority", promo.priority)}
        {detail("Asset status", asset?.assetsStatus)}
        {detail("Asset artists", plotters)}
        {detail("Art lead", asset?.artLead)}
        {detail("Animators", animators)}
        {detail("Editors", editors)}
      </section>

      <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
        <table className="w-full min-w-[880px] text-left text-[12px]">
          <thead className="bg-[#17171d] text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2"> </th>
              <th className="px-3 py-2">Pick date</th>
              <th className="px-3 py-2">Planned / First cut</th>
              <th className="px-3 py-2">Second cut</th>
              <th className="px-3 py-2">Sound</th>
              <th className="px-3 py-2">Remarks</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-white/[0.06]">
              <td className="px-3 py-3 font-semibold text-white">Asset</td>
              <td className="px-3 py-3 text-slate-300">{formatDmy(asset?.startDate)}</td>
              <td className="px-3 py-3">
                <DateCell
                  cells={snap.plannerCells}
                  promoId={promo.id}
                  partNo={0}
                  re={/asset/i}
                  busy={busy}
                  open={!promoClosed && !assetsClosed}
                  onChange={(date) => void save(0, date, "Assets", /asset/i)}
                />
              </td>
              <td className="px-3 py-3 text-slate-600">—</td>
              <td className="px-3 py-3 text-slate-600">—</td>
              <td className="min-w-[220px] px-3 py-3 align-top">
                <RemarkBox promo={promo} partNo={0} />
              </td>
            </tr>
            {parts.map((part) => (
              <tr key={part.id} className="border-t border-white/[0.06]">
                <td className="px-3 py-3">
                  <p className="font-semibold text-white">Part {part.partNo}</p>
                  <p className="text-[11px] text-slate-500">
                    {part.artist || "No animator"}
                    {part.editors ? ` · ${part.editors}` : ""}
                  </p>
                </td>
                <td className="px-3 py-3 text-slate-300">
                  {formatDmy(part.aniStartDate || part.plannedPlottedDate)}
                </td>
                <td className="px-3 py-3">
                  <DateCell
                    cells={snap.plannerCells}
                    promoId={promo.id}
                    partNo={part.partNo}
                    re={/first cut|first animation|first edit/i}
                    busy={busy}
                    open={!promoClosed && part.stage !== "delivered"}
                    onChange={(date) =>
                      void save(part.partNo, date, "First cut", /first cut|first animation|first edit/i)
                    }
                  />
                </td>
                <td className="px-3 py-3">
                  <DateCell
                    cells={snap.plannerCells}
                    promoId={promo.id}
                    partNo={part.partNo}
                    re={/second cut|correction close/i}
                    busy={busy}
                    open={!promoClosed && part.stage !== "delivered"}
                    onChange={(date) =>
                      void save(part.partNo, date, "Second cut", /second cut|correction close/i)
                    }
                  />
                </td>
                <td className="px-3 py-3">
                  <DateCell
                    cells={snap.plannerCells}
                    promoId={promo.id}
                    partNo={part.partNo}
                    re={/sound/i}
                    busy={busy}
                    open={!promoClosed && part.stage !== "delivered"}
                    onChange={(date) => void save(part.partNo, date, "Sound", /sound/i)}
                  />
                </td>
                <td className="min-w-[220px] px-3 py-3 align-top">
                  <RemarkBox promo={promo} partNo={part.partNo} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-600">
        Pick date comes from the sheet. Plan dates are only for WIP work. Once you save a date it
        stays.
      </p>
    </div>
  );
}

function DateCell({
  cells,
  promoId,
  partNo,
  re,
  busy,
  open,
  onChange,
}: {
  cells: PlannerCell[];
  promoId: string;
  partNo: number;
  re: RegExp;
  busy: boolean;
  open: boolean;
  onChange: (date: string) => void;
}) {
  const hit = cells
    .filter((c) => c.promoId === promoId && c.partNo === partNo && re.test(c.text))
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (hit?.date) {
    return <span className="font-semibold text-slate-200">{formatDmy(hit.date)}</span>;
  }
  if (!open) return <span className="text-slate-600">—</span>;
  return (
    <input
      type="date"
      disabled={busy}
      value=""
      onChange={(e) => {
        if (e.target.value) onChange(e.target.value);
      }}
      className="rounded-md border border-white/[0.1] bg-[#0e0e13] px-2 py-1 text-[12px] text-white"
    />
  );
}
