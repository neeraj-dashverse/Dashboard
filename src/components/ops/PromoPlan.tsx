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
  embedded = false,
  mode = "plan",
  lane,
}: {
  promoId: string;
  onBack?: () => void;
  embedded?: boolean;
  mode?: "plan" | "update";
  lane?: "asset" | "animation";
}) {
  const { snap } = useOps();
  const [updatePart, setUpdatePart] = useState<number | null>(null);
  const [updateStage, setUpdateStage] = useState("Rough cut");
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
  const chosenPart = parts.find((part) => part.partNo === updatePart) ?? parts[0];

  if (embedded && mode === "update" && lane === "animation") {
    const stageSlots = [
      { label: "Rough cut", match: "rough cut|first cut|first animation|first edit" },
      { label: "Final cut", match: "final cut|second cut|correction close" },
      { label: "Sound", match: "sound" },
    ];
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={chosenPart?.partNo ?? ""}
          onChange={(event) => setUpdatePart(Number(event.target.value))}
          aria-label="Part"
          className="h-7 rounded border border-white/[0.1] bg-[#0e0e13] px-1.5 text-[12px] text-white"
        >
          {parts.map((part) => (
            <option key={part.partNo} value={part.partNo}>
              P{part.partNo}
            </option>
          ))}
        </select>
        <select
          value={updateStage}
          onChange={(event) => setUpdateStage(event.target.value)}
          aria-label="Stage"
          className="h-7 rounded border border-white/[0.1] bg-[#0e0e13] px-1.5 text-[12px] text-white"
        >
          {stageSlots.map((slot) => (
            <option key={slot.label}>{slot.label}</option>
          ))}
        </select>
        {chosenPart ? (
          <PlanDates
            promo={promo}
            partNo={chosenPart.partNo}
            cells={snap.plannerCells}
            embedded
            showTimes
            askDelay
            plannedHint={chosenPart.plannedPlottedDate || chosenPart.deadline || chosenPart.plannedDate}
            open={!promoClosed && chosenPart.stage !== "delivered"}
            slots={stageSlots.map((slot) => ({ ...slot, enabled: slot.label === updateStage }))}
          />
        ) : (
          <p className="text-[12px] text-slate-400">No open animation parts.</p>
        )}
      </div>
    );
  }

  if (embedded) {
    return (
      <div className="space-y-1">
        <p className="text-[11px] leading-4 text-slate-500">
          {mode === "update"
            ? "The planned date stays on the left of each field. If it slipped, set the new date and a short reason."
            : "One date per stage, then Record."}
        </p>
        <div className="divide-y divide-white/[0.06] overflow-hidden rounded-lg border border-white/[0.08]">
          {lane !== "animation" && (
            <PlanDates
              promo={promo}
              partNo={0}
              rowLabel="Asset"
              cells={snap.plannerCells}
              embedded
              showTimes={mode === "update"}
              askDelay={mode === "update"}
              plannedHint={promo.preProd?.plannedDate}
              open={!promoClosed && !assetsClosed}
              slots={[
                { label: "Assets", match: "asset", enabled: true },
                { label: "Rough cut", match: "rough cut|first cut|first animation|first edit", enabled: false },
                { label: "Final cut", match: "final cut|second cut|correction close", enabled: false },
                { label: "Sound", match: "sound", enabled: false },
              ]}
            />
          )}
          {lane !== "asset" &&
            parts.map((part) => (
              <PlanDates
                key={part.id}
                promo={promo}
                partNo={part.partNo}
                rowLabel={`P${part.partNo}`}
                cells={snap.plannerCells}
                embedded
                showTimes={mode === "update"}
                askDelay={mode === "update"}
                plannedHint={part.plannedPlottedDate || part.deadline || part.plannedDate}
                open={!promoClosed && part.stage !== "delivered"}
                slots={[
                  { label: "Assets", match: "asset", enabled: false },
                  { label: "Rough cut", match: "rough cut|first cut|first animation|first edit", enabled: true },
                  { label: "Final cut", match: "final cut|second cut|correction close", enabled: true },
                  { label: "Sound", match: "sound", enabled: true },
                ]}
              />
            ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        {onBack ? (
          <button type="button" onClick={onBack} className="text-[12px] font-semibold text-[#9bb0ff] hover:underline">
            ← Promos
          </button>
        ) : embedded ? null : (
          <Link href="/planner" className="text-[12px] font-semibold text-[#9bb0ff] hover:underline">
            ← Calendar
          </Link>
        )}
        <p className="mt-3 text-[12px] font-semibold text-slate-400">{promo.showName || "Promo"}</p>
        <h1 className={`mt-1 font-extrabold text-white ${onBack ? "text-lg" : "text-2xl"}`}>
          {promo.promoName || promo.showName || "—"}
        </h1>
        <p className="mt-1 text-[12px] text-slate-400">
          {mode === "update"
            ? "This is the check against the planned date. If it slipped, write the reason and the new date. 1st half is by 3:00pm IST, 2nd half by 8:00pm, EOD is 8:00pm."
            : "Set the date and Record. A delay, the reason, and the new date go under Update."}
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
        <table className={`w-full text-left text-[12px] ${embedded || onBack ? "" : "min-w-[760px]"}`}>
          <thead className={`bg-[#17171d] text-[10px] font-bold uppercase tracking-wider text-slate-500 ${embedded || onBack ? "hidden" : ""}`}>
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
            {lane !== "animation" && (
              <tr className="border-t border-white/[0.06]">
                <td className="px-3 py-3 font-semibold text-white">Asset</td>
                <PlanDates
                  promo={promo}
                  partNo={0}
                  cells={snap.plannerCells}
                  embedded={embedded || !!onBack}
                  showTimes={mode === "update"}
                  askDelay={mode === "update"}
                  plannedHint={promo.preProd?.plannedDate}
                  open={!promoClosed && !assetsClosed}
                  slots={[
                    { label: "Assets", match: "asset", enabled: true },
                    { label: "Rough cut", match: "rough cut|first cut|first animation|first edit", enabled: false },
                    { label: "Final cut", match: "final cut|second cut|correction close", enabled: false },
                    { label: "Sound", match: "sound", enabled: false },
                  ]}
                />
              </tr>
            )}
            {lane !== "asset" &&
              parts.map((part) => (
                <tr key={part.id} className="border-t border-white/[0.06]">
                  <td className="px-3 py-3 font-semibold text-white">Part {part.partNo}</td>
                  <PlanDates
                    promo={promo}
                    partNo={part.partNo}
                    cells={snap.plannerCells}
                    embedded={embedded || !!onBack}
                    showTimes={mode === "update"}
                    askDelay={mode === "update"}
                    plannedHint={part.plannedPlottedDate || part.deadline || part.plannedDate}
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
  showTimes = true,
  askDelay = false,
  plannedHint = null,
  rowLabel = "",
  slots,
}: {
  promo: Promo;
  partNo: number;
  cells: PlannerCell[];
  open: boolean;
  embedded?: boolean;
  showTimes?: boolean;
  askDelay?: boolean;
  plannedHint?: string | null;
  rowLabel?: string;
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
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const dirty = slots.some((s) => {
    if (!s.enabled) return false;
    const dateChanged = (draft[s.label] ?? "") !== (savedDates[s.label] ?? "");
    const timeChanged = showTimes && (times[s.label] ?? null) !== (fromSheet[s.label]?.time ?? null);
    const reasonChanged = askDelay && (reasons[s.label] ?? "").trim().length > 0;
    return dateChanged || timeChanged || reasonChanged;
  });

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
        .map((s) => {
          const time = showTimes ? times[s.label] : fromSheet[s.label]?.time;
          const planned = fromSheet[s.label]?.date || plannedHint || "";
          const next = nextDraft[s.label] ?? "";
          const reason = (reasons[s.label] ?? "").trim();
          const moved = planned && next && next !== planned ? `Planned ${planned} → ${next}` : "";
          const note = [moved, reason].filter(Boolean).join(". ");
          return {
            label: time ? `${s.label} · ${time}` : s.label,
            match: s.match,
            date: next,
            note,
          };
        }),
    };
    flight.current = flight.current
      .catch(() => undefined)
      .then(() => act(payload, { quiet: true }))
      .then(() => {
        if (gen.current !== mine) return;
        setReasons({});
      })
      .catch(() => {
        if (gen.current !== mine) return;
        setLocalSaved(null);
        setError("Those dates did not record. Try again.");
      });
  };

  if (embedded) {
    const shown = slots.filter((slot) => slot.enabled);
    const field = "h-7 rounded border border-white/[0.1] bg-[#0e0e13] px-1.5 text-[12px] text-white";
    const shell = rowLabel
      ? "flex flex-wrap items-center gap-1.5 px-2 py-1"
      : "contents";
    return (
      <div className={shell}>
        {rowLabel && <span className="w-10 shrink-0 text-[12px] font-semibold text-white">{rowLabel}</span>}
        {shown.map((slot) => {
          const planned = formatDmy(fromSheet[slot.label]?.date || plannedHint);
          return (
            <div key={slot.label} className="flex items-center gap-1.5">
              {shown.length > 1 && <span className="text-[11px] text-slate-400">{slot.label}</span>}
              {!open ? (
                <span className="text-[12px] text-slate-200">
                  {formatDmy(savedDates[slot.label]) || "—"}
                  {times[slot.label] ? ` · ${slotLabel(times[slot.label] ?? "") ?? ""}` : ""}
                </span>
              ) : (
                <>
                  {askDelay && (
                    <span className="text-[11px] text-slate-500" title="Planned and plotted date on the Production Tracker">
                      Plot {planned}
                    </span>
                  )}
                  <input
                    type="date"
                    aria-label={askDelay ? `${slot.label} update date` : `${slot.label} date`}
                    value={draft[slot.label] ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [slot.label]: e.target.value }))}
                    className={`${field} w-[8.6rem]`}
                  />
                  {askDelay && (
                    <input
                      value={reasons[slot.label] ?? ""}
                      onChange={(e) => setReasons((current) => ({ ...current, [slot.label]: e.target.value }))}
                      placeholder="Reason"
                      aria-label={`${slot.label} delay reason`}
                      className={`${field} w-28 placeholder:text-slate-500`}
                    />
                  )}
                  {showTimes &&
                    TIMES.map((time) => (
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
                        className={`h-7 rounded px-1.5 text-[10px] font-bold ${
                          times[slot.label] === time ? "bg-[#4361ee] text-white" : "bg-white/[0.06] text-slate-400"
                        } disabled:opacity-40`}
                      >
                        {slotLabel(time) ?? time}
                      </button>
                    ))}
                </>
              )}
            </div>
          );
        })}
        {open && (
          <button
            type="button"
            disabled={!dirty}
            onClick={record}
            className="h-7 rounded bg-[#4361ee] px-2.5 text-[11px] font-bold text-white disabled:opacity-40"
          >
            Record
          </button>
        )}
        {error && <p className="text-[11px] text-rose-300">{error}</p>}
      </div>
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
              {askDelay && (
                <p className="text-[11px] text-slate-300">
                  Planned {formatDmy(fromSheet[slot.label]?.date || plannedHint) || "—"}
                </p>
              )}
              {askDelay && (
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Update date</p>
              )}
              <input
                type="date"
                value={draft[slot.label] ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, [slot.label]: e.target.value }))}
                className="rounded-md border border-white/[0.1] bg-[#0e0e13] px-2 py-1 text-[12px] text-white"
              />
              {askDelay && (
                <input
                  value={reasons[slot.label] ?? ""}
                  onChange={(e) => setReasons((current) => ({ ...current, [slot.label]: e.target.value }))}
                  placeholder="Delay reason"
                  className="w-full rounded-md border border-white/[0.1] bg-[#0e0e13] px-2 py-1 text-[12px] text-white placeholder:text-slate-500"
                />
              )}
              {showTimes && (
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
              )}
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
