"use client";

import { useMemo, useState } from "react";
import {
  animatorProductivity,
  formatDmy,
  formatDuration,
  promoFor,
  qualityForAnimator,
} from "@/lib/ops/selectors";
import { Kpi } from "./ui";
import { SyncStrip } from "./SyncStrip";
import { useOps } from "./OpsProvider";

function worked(seconds: number): string {
  if (seconds <= 0) return "—";
  return formatDuration(seconds);
}

export function ProductivityBoard() {
  const { snap } = useOps();
  const people = useMemo(() => animatorProductivity(snap), [snap]);
  const [open, setOpen] = useState<string | null>(null);
  const asked = people.find((person) => person.name === open) ?? null;
  const feedback = asked ? qualityForAnimator(snap, asked.name) : [];
  const days = asked
    ? snap.dailyLogs
        .filter((log) => log.artist.trim().toLowerCase() === asked.name.trim().toLowerCase())
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
    : [];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
          PocketFM · Operations
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">Productivity</h1>
        <p className="mt-1 max-w-3xl text-[12px] leading-5 text-slate-500">
          Each day comes from the Animation productivity sheet, tab Master data. One row per person, show, and promo: Date, POD lead, Artist, Show Name, Promo Name, Parts Worked, and Duration worked/day (Less than 3 min, 3 - 5 min, or correction). Feedback stays hidden until you ask for that animator.
        </p>
      </div>

      <SyncStrip />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Kpi label="Animators" value={people.length} />
        <Kpi label="Open parts" value={people.reduce((sum, person) => sum + person.openParts, 0)} />
        <Kpi
          label="With feedback"
          value={people.filter((person) => person.reviews > 0).length}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
        <table className="min-w-full border-collapse text-left text-[12px]">
          <thead className="bg-[#222738] text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="whitespace-nowrap px-3 py-2.5">Animator</th>
              <th className="whitespace-nowrap px-3 py-2.5">Open</th>
              <th className="whitespace-nowrap px-3 py-2.5">Delivered</th>
              <th className="whitespace-nowrap px-3 py-2.5">Worked</th>
              <th className="whitespace-nowrap px-3 py-2.5">Days</th>
              <th className="whitespace-nowrap px-3 py-2.5">Min/day</th>
              <th className="whitespace-nowrap px-3 py-2.5">Avg delay</th>
              <th className="whitespace-nowrap px-3 py-2.5">Quality</th>
              <th className="whitespace-nowrap px-3 py-2.5">Feedback</th>
            </tr>
          </thead>
          <tbody>
            {people.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                  No animator work on the sheets.
                </td>
              </tr>
            ) : (
              people.map((person) => (
                <tr key={person.name} className="border-t border-white/[0.06]">
                  <td className="px-3 py-2.5 font-semibold text-white">
                    {person.name}
                    <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-slate-500">
                      {person.team === "agency" ? "Agency" : "In house"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-200">{person.openParts}</td>
                  <td className="px-3 py-2.5 text-slate-200">{person.deliveredParts}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-200">{worked(person.workedSec)}</td>
                  <td className="px-3 py-2.5 text-slate-200">{person.daysWorked || "—"}</td>
                  <td className="px-3 py-2.5 text-slate-200">
                    {person.minutesPerDay == null ? "—" : person.minutesPerDay}
                  </td>
                  <td
                    className={`px-3 py-2.5 font-semibold ${
                      person.avgDelay ? "text-rose-200" : "text-slate-300"
                    }`}
                  >
                    {person.avgDelay == null ? "—" : `${person.avgDelay}d`}
                  </td>
                  <td className="px-3 py-2.5 text-slate-200">
                    {person.qualityAvg == null ? "—" : `${person.qualityAvg}/5`}
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => setOpen((current) => (current === person.name ? null : person.name))}
                      className="rounded-md bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-[#9bb0ff] hover:bg-white/[0.1]"
                    >
                      {open === person.name ? "Hide" : "Days"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {asked && (
        <section className="space-y-2">
          <h2 className="text-[13px] font-bold text-white">Each day · {asked.name}</h2>
          {days.length === 0 ? (
            <p className="rounded-xl border border-white/[0.08] px-4 py-3 text-[12px] text-slate-500">
              No daily rows yet. Add them on Animation productivity → Master data.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
              <table className="min-w-full border-collapse text-left text-[12px]">
                <thead className="bg-[#222738] text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Show</th>
                    <th className="px-3 py-2">Promo</th>
                    <th className="px-3 py-2">Parts</th>
                    <th className="px-3 py-2">Work</th>
                    <th className="px-3 py-2">Minutes</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((log) => (
                    <tr key={log.id} className="border-t border-white/[0.06]">
                      <td className="whitespace-nowrap px-3 py-2 text-slate-200">{formatDmy(log.date)}</td>
                      <td className="px-3 py-2 text-slate-300">{log.showName || "—"}</td>
                      <td className="px-3 py-2 text-slate-300">{log.promoName || "—"}</td>
                      <td className="px-3 py-2 text-slate-300">{log.partsWorked ?? "—"}</td>
                      <td className="px-3 py-2 text-slate-300">
                        {log.workType === "correction" ? "Correction" : log.durationBucket === "3-5" ? "3–5 min" : log.durationBucket === "<3" ? "Under 3 min" : "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-200">{log.outputMinutes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {asked && (
        <section className="space-y-2">
          <h2 className="text-[13px] font-bold text-white">Feedback · {asked.name}</h2>
          {feedback.length === 0 ? (
            <p className="rounded-xl border border-white/[0.08] px-4 py-3 text-[12px] text-slate-500">
              No feedback written for {asked.name}.
            </p>
          ) : (
            <div className="space-y-2">
              {feedback.map((review) => {
                const promo = promoFor(snap, review.promoId);
                const notes = [review.animation?.weakAreas, review.animation?.remark, review.editing?.remark]
                  .map((text) => text?.trim())
                  .filter((text): text is string => !!text);
                return (
                  <article key={review.id} className="rounded-xl border border-white/[0.08] bg-[#222738] p-4">
                    <p className="text-[13px] font-semibold text-white">
                      {promo ? `${promo.showName} · ${promo.promoName}` : review.promoId}
                      <span className="text-slate-500"> · P{review.partNo}</span>
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {review.cps ? `CPS ${review.cps}` : "CPS"}
                      {review.versionCorrection ? ` · ${review.versionCorrection} pass` : ""}
                      {review.animation?.overallQuality != null
                        ? ` · ${review.animation.overallQuality}/5`
                        : ""}
                    </p>
                    {notes.length > 0 ? (
                      notes.map((note) => (
                        <p key={note} className="mt-2 whitespace-pre-wrap text-[12px] leading-5 text-slate-300">
                          {note}
                        </p>
                      ))
                    ) : (
                      <p className="mt-2 text-[12px] text-slate-500">Score only. No written note.</p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
