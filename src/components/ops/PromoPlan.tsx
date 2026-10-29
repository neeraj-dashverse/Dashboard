"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { assetClosedDate, formatDmy } from "@/lib/ops/selectors";
import type { PlannerCell, Promo } from "@/lib/ops/types";
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
  const { snap } = useOps();
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
              <th className="px-3 py-2">Rough cut</th>
              <th className="px-3 py-2">Final cut</th>
              <th className="px-3 py-2">Sound</th>
              <th className="px-3 py-2">Record</th>
              <th className="px-3 py-2">Remarks</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-white/[0.06]">
              <td className="px-3 py-3 font-semibold text-white">Asset</td>
              <td className="px-3 py-3 text-slate-300">{formatDmy(asset?.startDate)}</td>
              <PlanDates
                promo={promo}
                partNo={0}
                cells={snap.plannerCells}
                open={!promoClosed && !assetsClosed}
                slots={[
                  { label: "Assets", match: "asset", enabled: true },
                  { label: "Final cut", match: "final cut|second cut|correction close", enabled: false },
                  { label: "Sound", match: "sound", enabled: false },
                ]}
              />
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
                <PlanDates
                  promo={promo}
                  partNo={part.partNo}
                  cells={snap.plannerCells}
                  open={!promoClosed && part.stage !== "delivered"}
                  slots={[
                    { label: "Rough cut", match: "rough cut|first cut|first animation|first edit", enabled: true },
                    { label: "Final cut", match: "final cut|second cut|correction close", enabled: true },
                    { label: "Sound", match: "sound", enabled: true },
                  ]}
                />
                <td className="min-w-[220px] px-3 py-3 align-top">
                  <RemarkBox promo={promo} partNo={part.partNo} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-600">
        Type the dates for a part, then Record. That writes them to the sheet. Change a date and
        Record again if it was typed wrong. Remarks sit beside Record.
      </p>
    </div>
  );
}

function savedDate(cells: PlannerCell[], promoId: string, partNo: number, match: string): string {
  const re = new RegExp(match, "i");
  const hit = cells
    .filter((c) => c.promoId === promoId && c.partNo === partNo && c.date && re.test(c.text))
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  return hit?.date ?? "";
}

function PlanDates({
  promo,
  partNo,
  cells,
  open,
  slots,
}: {
  promo: Promo;
  partNo: number;
  cells: PlannerCell[];
  open: boolean;
  slots: { label: string; match: string; enabled: boolean }[];
}) {
  const { act } = useOps();
  const [error, setError] = useState<string | null>(null);
  const [localSaved, setLocalSaved] = useState<Record<string, string> | null>(null);
  const flight = useRef(Promise.resolve());
  const gen = useRef(0);
  const fromSheet = Object.fromEntries(
    slots.map((s) => [s.label, savedDate(cells, promo.id, partNo, s.match)])
  );
  const saved = localSaved ?? fromSheet;
  const [draft, setDraft] = useState<Record<string, string>>(fromSheet);
  const dirty = slots.some((s) => s.enabled && (draft[s.label] ?? "") !== (saved[s.label] ?? ""));

  const record = () => {
    const mine = ++gen.current;
    const nextDraft = { ...draft };
    setLocalSaved(nextDraft);
    setError(null);
    const payload = {
      type: "record_plan_part" as const,
      promoId: promo.id,
      partNo,
      showName: promo.showName,
      promoName: promo.promoName,
      slots: slots
        .filter((s) => s.enabled)
        .map((s) => ({ label: s.label, match: s.match, date: nextDraft[s.label] ?? "" })),
    };
    flight.current = flight.current
      .catch(() => undefined)
      .then(() => act(payload, { quiet: true }))
      .catch(() => {
        if (gen.current !== mine) return;
        setLocalSaved(null);
        setError("Those dates did not record. Try again.");
      });
  };

  return (
    <>
      {slots.map((slot) => (
        <td key={slot.label} className="px-3 py-3">
          {!slot.enabled || !open ? (
            <span className={slot.enabled ? "font-semibold text-slate-200" : "text-slate-600"}>
              {slot.enabled ? formatDmy(saved[slot.label]) || "—" : "—"}
            </span>
          ) : (
            <input
              type="date"
              value={draft[slot.label] ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, [slot.label]: e.target.value }))}
              className="rounded-md border border-white/[0.1] bg-[#0e0e13] px-2 py-1 text-[12px] text-white"
            />
          )}
        </td>
      ))}
      <td className="px-3 py-3 align-top">
        {open && (
          <button
            type="button"
            disabled={!dirty}
            onClick={record}
            className="rounded-md bg-[#4361ee] px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-40"
          >
            Record
          </button>
        )}
        {error && <p className="mt-1 text-[11px] text-rose-300">{error}</p>}
      </td>
    </>
  );
}
