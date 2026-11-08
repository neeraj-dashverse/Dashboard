"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { assetClosedDate, formatDmy, slotLabel } from "@/lib/ops/selectors";
import type { PlannerCell, Promo } from "@/lib/ops/types";
import { useOps } from "./OpsProvider";

const TIMES = ["First half", "Second half", "EOD"] as const;
type TimeSlot = (typeof TIMES)[number];

export function PromoPlan({
  promoId,
  onBack,
}: {
  promoId: string;
  onBack?: () => void;
}) {
  const { snap } = useOps();
  const promo = snap.promos.find((p) => p.id === promoId);
  if (!promo) {
    return (
      <div className="space-y-3">
        {onBack ? (
          <button type="button" onClick={onBack} className="text-[12px] font-semibold text-[#9bb0ff] hover:underline">
            ← Plan
          </button>
        ) : (
          <Link href="/planner" className="text-[12px] font-semibold text-[#9bb0ff] hover:underline">
            ← Calendar
          </Link>
        )}
        <p className="text-[13px] text-slate-400">That promo is not on the sheet right now.</p>
      </div>
    );
  }

  const asset = promo.assetTeam;
  const byPart = new Map<number, (typeof snap.parts)[number]>();
  for (const part of snap.parts) {
    if (part.promoId === promo.id || part.promoId.split("#")[0] === promo.id.split("#")[0]) {
      byPart.set(part.partNo, part);
    }
  }
  const parts = [...byPart.values()].sort((a, b) => a.partNo - b.partNo);

  const promoClosed = Boolean(promo.trackerStatus && /closed/i.test(promo.trackerStatus));
  const status = (asset?.assetsStatus ?? "").toLowerCase();
  const assetsClosed =
    Boolean(assetClosedDate(promo)) || (status.includes("approved") && !status.includes("send"));

  return (
    <div className="space-y-5">
      <div>
        {onBack ? (
          <button type="button" onClick={onBack} className="text-[12px] font-semibold text-[#9bb0ff] hover:underline">
            ← Promos
          </button>
        ) : (
          <Link href="/planner" className="text-[12px] font-semibold text-[#9bb0ff] hover:underline">
            ← Calendar
          </Link>
        )}
        <p className="mt-3 text-[12px] font-semibold text-slate-400">{promo.showName || "Promo"}</p>
        <h1 className={`mt-1 font-extrabold text-white ${onBack ? "text-lg" : "text-2xl"}`}>
          {promo.promoName || promo.showName || "—"}
        </h1>
        <p className="mt-1 text-[12px] text-slate-400">
          First half is by 3:00pm IST. Second half is by 8:00pm. EOD is 8:00pm. Record saves the date and the time.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
        <table className={`w-full text-left text-[12px] ${onBack ? "" : "min-w-[760px]"}`}>
          <thead className={`bg-[#17171d] text-[10px] font-bold uppercase tracking-wider text-slate-500 ${onBack ? "hidden" : ""}`}>
            <tr>
              <th className="px-3 py-2"> </th>
              <th className="px-3 py-2">Assets</th>
              <th className="px-3 py-2">Rough cut</th>
              <th className="px-3 py-2">Final cut</th>
              <th className="px-3 py-2">Sound</th>
              <th className="px-3 py-2">Record</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-white/[0.06]">
              <td className="px-3 py-3 font-semibold text-white">Asset</td>
              <PlanDates
                promo={promo}
                partNo={0}
                cells={snap.plannerCells}
                embedded={!!onBack}
                open={!promoClosed && !assetsClosed}
                slots={[
                  { label: "Assets", match: "asset", enabled: true },
                  { label: "Rough cut", match: "rough cut|first cut|first animation|first edit", enabled: false },
                  { label: "Final cut", match: "final cut|second cut|correction close", enabled: false },
                  { label: "Sound", match: "sound", enabled: false },
                ]}
              />
            </tr>
            {parts.map((part) => (
              <tr key={part.id} className="border-t border-white/[0.06]">
                <td className="px-3 py-3 font-semibold text-white">Part {part.partNo}</td>
                <PlanDates
                  promo={promo}
                  partNo={part.partNo}
                  cells={snap.plannerCells}
                  embedded={!!onBack}
                  open={!promoClosed && part.stage !== "delivered"}
                  slots={[
                    { label: "Assets", match: "asset", enabled: false },
                    { label: "Rough cut", match: "rough cut|first cut|first animation|first edit", enabled: true },
                    { label: "Final cut", match: "final cut|second cut|correction close", enabled: true },
                    { label: "Sound", match: "sound", enabled: true },
                  ]}
                />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function savedPlan(
  cells: PlannerCell[],
  promoId: string,
  partNo: number,
  match: string
): { date: string; time: TimeSlot | null } {
  const re = new RegExp(match, "i");
  const hit = cells
    .filter((c) => c.promoId === promoId && c.partNo === partNo && c.date && re.test(c.text))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const time = TIMES.find((slot) => slotLabel(hit?.text ?? "") === slotLabel(slot)) ?? null;
  return { date: hit?.date ?? "", time };
}

function PlanDates({
  promo,
  partNo,
  cells,
  open,
  embedded = false,
  slots,
}: {
  promo: Promo;
  partNo: number;
  cells: PlannerCell[];
  open: boolean;
  embedded?: boolean;
  slots: { label: string; match: string; enabled: boolean }[];
}) {
  const { act } = useOps();
  const [error, setError] = useState<string | null>(null);
  const [localSaved, setLocalSaved] = useState<Record<string, string> | null>(null);
  const flight = useRef(Promise.resolve());
  const gen = useRef(0);
  const fromSheet = Object.fromEntries(slots.map((s) => [s.label, savedPlan(cells, promo.id, partNo, s.match)]));
  const savedDates = localSaved ?? Object.fromEntries(slots.map((s) => [s.label, fromSheet[s.label]?.date ?? ""]));
  const [draft, setDraft] = useState<Record<string, string>>(
    Object.fromEntries(slots.map((s) => [s.label, fromSheet[s.label]?.date ?? ""]))
  );
  const [times, setTimes] = useState<Record<string, TimeSlot | null>>(
    Object.fromEntries(slots.map((s) => [s.label, fromSheet[s.label]?.time ?? null]))
  );
  const dirty = slots.some(
    (s) =>
      s.enabled &&
      ((draft[s.label] ?? "") !== (savedDates[s.label] ?? "") ||
        (times[s.label] ?? null) !== (fromSheet[s.label]?.time ?? null))
  );

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
        .map((s) => ({
          label: times[s.label] ? `${s.label} · ${times[s.label]}` : s.label,
          match: s.match,
          date: nextDraft[s.label] ?? "",
        })),
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

  if (embedded) {
    const shown = slots.filter((slot) => slot.enabled);
    return (
      <td colSpan={5} className="px-3 py-3">
        <div className="space-y-3">
          {shown.map((slot) => (
            <div key={slot.label}>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{slot.label}</p>
              {!open ? (
                <p className="mt-1 font-semibold text-slate-200">
                  {formatDmy(savedDates[slot.label]) || "—"}
                  {times[slot.label] ? ` · ${slotLabel(times[slot.label] ?? "") ?? times[slot.label]}` : ""}
                </p>
              ) : (
                <div className="mt-1 space-y-1.5">
                  <input
                    type="date"
                    value={draft[slot.label] ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [slot.label]: e.target.value }))}
                    className="w-full rounded-md border border-white/[0.1] bg-[#0e0e13] px-2 py-1 text-[12px] text-white"
                  />
                  <div className="flex flex-wrap gap-1">
                    {TIMES.map((time) => (
                      <button
                        key={time}
                        type="button"
                        disabled={!draft[slot.label]}
                        onClick={() =>
                          setTimes((current) => ({
                            ...current,
                            [slot.label]: current[slot.label] === time ? null : time,
                          }))
                        }
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                          times[slot.label] === time ? "bg-[#4361ee]/40 text-white" : "bg-white/[0.06] text-slate-400"
                        } disabled:opacity-40`}
                      >
                        {slotLabel(time) ?? time}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
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
          {error && <p className="text-[11px] text-rose-300">{error}</p>}
        </div>
      </td>
    );
  }

  return (
    <>
      {slots.map((slot) => (
        <td key={slot.label} className="px-3 py-3">
          {!slot.enabled || !open ? (
            <span className={slot.enabled ? "font-semibold text-slate-200" : "text-slate-600"}>
              {slot.enabled
                ? `${formatDmy(savedDates[slot.label]) || "—"}${times[slot.label] ? ` · ${slotLabel(times[slot.label] ?? "") ?? times[slot.label]}` : ""}`
                : "—"}
            </span>
          ) : (
            <div className="space-y-1.5">
              <input
                type="date"
                value={draft[slot.label] ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, [slot.label]: e.target.value }))}
                className="rounded-md border border-white/[0.1] bg-[#0e0e13] px-2 py-1 text-[12px] text-white"
              />
              <div className="flex flex-wrap gap-1">
                {TIMES.map((time) => (
                  <button
                    key={time}
                    type="button"
                    disabled={!draft[slot.label]}
                    onClick={() =>
                      setTimes((current) => ({
                        ...current,
                        [slot.label]: current[slot.label] === time ? null : time,
                      }))
                    }
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                      times[slot.label] === time
                        ? "bg-[#4361ee]/40 text-white"
                        : "bg-white/[0.06] text-slate-400"
                    } disabled:opacity-40`}
                  >
                    {slotLabel(time) ?? time}
                  </button>
                ))}
              </div>
            </div>
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
