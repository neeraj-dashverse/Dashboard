"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  animatorProductivity,
  durationProfile,
  formatDuration,
  promoFor,
  qualityForAnimator,
} from "@/lib/ops/selectors";
import type { QualityReview } from "@/lib/ops/types";
import { Kpi } from "./ui";
import { useOps } from "./OpsProvider";

const RECENT_PROMO_COUNT = 3;

function worked(seconds: number): string {
  if (seconds <= 0) return "—";
  return formatDuration(seconds);
}

const TREND_ARROW: Record<string, string> = { up: "↑", down: "↓", flat: "→" };

/** Reads the Duration worked/day bucket into a short "3-5 min ↑" style badge for the Min/day column. */
function RangeBadge({ name, snap }: { name: string; snap: Parameters<typeof durationProfile>[0] }) {
  const profile = durationProfile(snap, name);
  if (!profile.typicalRange) return null;
  const tone =
    profile.typicalRange === "3-5 min"
      ? "text-emerald-300"
      : profile.typicalRange === "<3 min"
        ? "text-amber-300"
        : "text-slate-400";
  const title = `${profile.threeToFive} day(s) at 3-5 min, ${profile.under3} day(s) under 3 min (excludes ${profile.corrections} correction day(s)).${
    profile.trend === "up"
      ? " Trending up — more recent days are in the bigger range."
      : profile.trend === "down"
        ? " Trending down — more recent days are in the smaller range."
        : ""
  }`;
  return (
    <span title={title} className={`mt-0.5 block text-[10px] font-semibold ${tone}`}>
      {profile.typicalRange === "mixed" ? "Mixed" : profile.typicalRange}
      {profile.trend && profile.trend !== "flat" ? ` ${TREND_ARROW[profile.trend]}` : ""}
    </span>
  );
}

/** Last N distinct promos (by sheet order, newest last) shown individually; older ones get one AI summary. */
function splitFeedback(reviews: QualityReview[]): { recent: QualityReview[]; older: QualityReview[] } {
  const order: string[] = [];
  for (const review of reviews) if (!order.includes(review.promoId)) order.push(review.promoId);
  const recentIds = new Set(order.slice(-RECENT_PROMO_COUNT));
  return {
    recent: reviews.filter((review) => recentIds.has(review.promoId)),
    older: reviews.filter((review) => !recentIds.has(review.promoId)),
  };
}

export function ProductivityBoard() {
  const { snap } = useOps();
  const people = useMemo(() => animatorProductivity(snap), [snap]);
  const [open, setOpen] = useState<string | null>(null);
  const [olderSummary, setOlderSummary] = useState<{ name: string; text: string | null; loading: boolean } | null>(
    null
  );
  const asked = people.find((person) => person.name === open) ?? null;
  const feedback = asked ? qualityForAnimator(snap, asked.name) : [];
  const { recent: recentFeedback, older: olderFeedback } = splitFeedback(feedback);

  useEffect(() => {
    if (!asked || olderFeedback.length === 0) return;
    if (olderSummary?.name === asked.name) return;
    const facts = olderFeedback
      .map((review) => {
        const promo = promoFor(snap, review.promoId);
        const title = promo ? `${promo.showName} · ${promo.promoName}` : review.promoId;
        const note = review.animation?.remark || review.animation?.weakAreas || review.editing?.remark || "";
        const rating = review.animation?.overallQuality != null ? `${review.animation.overallQuality}/5` : "—";
        return `${title}, part ${review.partNo}, rating ${rating}. ${note}`.trim();
      })
      .join("\n");
    setOlderSummary({ name: asked.name, text: null, loading: true });
    fetch("/api/ops/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: `Summarize ${asked.name}'s feedback on their ${olderFeedback.length} older, already-closed promos in 2-3 sentences. Call out any repeated strength or repeated issue.`,
        facts,
      }),
    })
      .then((res) => res.json())
      .then((data: { summary?: string | null }) => {
        setOlderSummary({ name: asked.name, text: data.summary ?? null, loading: false });
      })
      .catch(() => setOlderSummary({ name: asked.name, text: null, loading: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asked?.name, olderFeedback.length]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
          PocketFM · Operations
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">Productivity</h1>
        <p className="mt-1 text-[12px] text-slate-500">
          From the Animation productivity sheet. Open an animator for their daily log and feedback.
        </p>
      </div>


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
              <th className="whitespace-nowrap px-3 py-2.5" title="Distinct days this animator has a row on the Animation productivity sheet">
                Days logged
              </th>
              <th className="whitespace-nowrap px-3 py-2.5" title="Average output minutes per logged day, and their typical Duration worked/day range">
                Min/day
              </th>
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
              people.map((person) => {
                const isOpen = open === person.name;
                return (
                  <Fragment key={person.name}>
                    <tr className={`border-t border-white/[0.06] ${isOpen ? "bg-white/[0.02]" : ""}`}>
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
                        <RangeBadge name={person.name} snap={snap} />
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
                          {isOpen ? "Hide" : "Details"}
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-white/[0.02]">
                        <td colSpan={9} className="px-3 pb-4 pt-1">
                          <FeedbackPanel
                            name={person.name}
                            feedback={feedback}
                            recentFeedback={recentFeedback}
                            olderFeedback={olderFeedback}
                            olderSummary={olderSummary}
                            snap={snap}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FeedbackPanel({
  name,
  feedback,
  recentFeedback,
  olderFeedback,
  olderSummary,
  snap,
}: {
  name: string;
  feedback: QualityReview[];
  recentFeedback: QualityReview[];
  olderFeedback: QualityReview[];
  olderSummary: { name: string; text: string | null; loading: boolean } | null;
  snap: Parameters<typeof promoFor>[0];
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-[13px] font-bold text-white">
        Feedback · {name}
        {feedback.length > 0 && (
          <span className="ml-2 text-[11px] font-normal text-slate-500">
            Most recent {Math.min(RECENT_PROMO_COUNT, new Set(feedback.map((r) => r.promoId)).size)} promos shown in
            full · older ones summarized
          </span>
        )}
      </h2>
      {feedback.length === 0 ? (
        <p className="rounded-xl border border-white/[0.08] px-4 py-3 text-[12px] text-slate-500">
          No feedback written for {name}.
        </p>
      ) : (
        <div className="space-y-2">
          {recentFeedback.map((review) => {
            const promo = promoFor(snap, review.promoId);
            const notes = [review.animation?.weakAreas, review.animation?.remark, review.editing?.remark]
              .map((text) => text?.trim())
              .filter((text): text is string => !!text);
            return (
              <article key={review.id} className="rounded-xl border border-white/[0.08] bg-[#1b1f2e] p-4">
                <p className="text-[13px] font-semibold text-white">
                  {promo ? `${promo.showName} · ${promo.promoName}` : review.promoId}
                  <span className="text-slate-500"> · P{review.partNo}</span>
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {review.cps ? `CPS ${review.cps}` : "CPS"}
                  {review.versionCorrection ? ` · ${review.versionCorrection} pass` : ""}
                  {review.animation?.overallQuality != null ? ` · ${review.animation.overallQuality}/5` : ""}
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
          {olderFeedback.length > 0 && (
            <article className="rounded-xl border border-dashed border-white/[0.14] bg-white/[0.02] p-4">
              <p className="text-[13px] font-semibold text-white">
                Older promos — AI summary
                <span className="ml-1.5 text-[11px] font-normal text-slate-500">
                  {new Set(olderFeedback.map((r) => r.promoId)).size} earlier promo
                  {new Set(olderFeedback.map((r) => r.promoId)).size === 1 ? "" : "s"}
                </span>
              </p>
              {olderSummary?.name !== name || olderSummary.loading ? (
                <p className="mt-2 text-[12px] text-slate-500">Reading older feedback…</p>
              ) : olderSummary.text ? (
                <p className="mt-2 whitespace-pre-wrap text-[12px] leading-5 text-slate-300">{olderSummary.text}</p>
              ) : (
                <p className="mt-2 text-[12px] text-slate-500">
                  Couldn&apos;t reach the summarizer. {olderFeedback.length} older review
                  {olderFeedback.length === 1 ? "" : "s"} on file — ask AI for the detail.
                </p>
              )}
            </article>
          )}
        </div>
      )}
    </section>
  );
}
