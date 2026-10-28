"use client";

import Link from "next/link";
import {
  animatorLoads,
  assetDeadlinesToPush,
  formatDuration,
  promoFor,
} from "@/lib/ops/selectors";
import { Kpi, SectionTitle, StagePill } from "./ui";
import { SyncStrip } from "./SyncStrip";
import { useOps } from "./OpsProvider";

export function TeamBoard() {
  const { snap, act, busy } = useOps();
  const loads = animatorLoads(snap);
  const free = loads.filter((a) => a.free).length;
  const agency = loads.filter((a) => a.team === "agency").length;
  const deadlines = assetDeadlinesToPush(snap);
  const reviewsWithWeak = snap.qualityReviews.filter(
    (r) => r.animation?.weakAreas || r.editing?.remark || r.animation?.remark
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Team</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">
          Capacity & <span className="gradient-text">productivity</span>
        </h1>
        <p className="mt-1 text-[12px] text-slate-500">
          Live roster from Production Tracker · quality from CPS rubric (Master Productivity)
        </p>
      </div>

      <SyncStrip />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Kpi label="Animators" value={loads.length} />
        <Kpi label="Free now" value={free} tone="text-emerald-300" />
        <Kpi label="Agency" value={agency} tone="text-purple-300" />
        <Kpi
          label="Quality reviews"
          value={snap.qualityReviews.length}
          tone="text-[#9bb0ff]"
        />
        <Kpi
          label="Asset deadlines to push"
          value={deadlines.length}
          tone={deadlines.length ? "text-amber-300" : "text-white"}
        />
      </div>

      {deadlines.length > 0 && (
        <section className="space-y-2">
          <SectionTitle
            title="Push asset deadlines"
            hint="Animation free on X → tell asset team assets needed by X"
          />
          <div className="divide-y divide-white/[0.05] overflow-hidden rounded-xl border border-[#4361ee]/30 bg-[#4361ee]/[0.06]">
            {deadlines.map(({ promo, freeAt, cps }) => (
              <div
                key={promo.id}
                className="flex flex-wrap items-center gap-3 px-3.5 py-2.5 border-l-[3px] border-l-[#4361ee]"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-white">
                    {promo.showName} · {promo.scriptName}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    CPS {cps} free ~{freeAt}
                    {promo.preProd?.assetsNeededBy
                      ? ` · currently set ${promo.preProd.assetsNeededBy}`
                      : " · no deadline set yet"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      act({
                        type: "set_assets_needed_by",
                        promoId: promo.id,
                        date: freeAt,
                      })
                    }
                    className="rounded-md bg-gradient-to-r from-[#4361ee] to-[#d6293d] px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-40"
                  >
                    Set assets by {freeAt}
                  </button>
                  <Link
                    href={`/promo/${promo.id}`}
                    className="rounded-md bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white"
                  >
                    Open
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <SectionTitle
          title="Animator board"
          hint="Throughput = Σ day midpoints / all active days (incl. correction) · Quality = Cps rubric · flow anim→edit→correction→sound"
        />
        <div className="overflow-hidden rounded-xl border border-white/[0.08]">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Artist</th>
                <th className="px-4 py-3 font-semibold">As Cps</th>
                <th className="px-4 py-3 font-semibold">As Part 1</th>
                <th className="px-4 py-3 text-right font-semibold">Load</th>
                <th className="px-4 py-3 text-right font-semibold">Free at</th>
                <th className="px-4 py-3 text-right font-semibold">Throughput</th>
                <th className="px-4 py-3 text-right font-semibold">Quality</th>
                <th className="px-4 py-3 font-semibold">Part work</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {loads.map((a) => (
                <tr key={a.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{a.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {a.team === "agency" ? "Agency" : "In-house"}
                      {a.free ? " · Free" : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-slate-300">
                    {a.asCps.length === 0
                      ? "—"
                      : a.asCps.map((p) => (
                          <Link
                            key={p.id}
                            href={`/promo/${p.id}`}
                            className="block truncate hover:text-white"
                          >
                            {p.showName} · {p.scriptName}
                          </Link>
                        ))}
                  </td>
                  <td className="px-4 py-3 text-[11px] text-slate-300">
                    {a.asPart1.length === 0
                      ? "—"
                      : a.asPart1.map((p) => (
                          <Link
                            key={p.id}
                            href={`/promo/${p.id}`}
                            className="block truncate hover:text-white"
                            title="First 5‑min = Part 1 work"
                          >
                            {p.showName} · {p.scriptName}
                          </Link>
                        ))}
                  </td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums font-semibold ${
                      a.free ? "text-emerald-300" : "text-slate-200"
                    }`}
                  >
                    {a.free ? "Free" : `${a.openMinutes.toFixed(0)}m`}
                  </td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums text-[12px] ${
                      a.free ? "text-emerald-300" : "text-[#9bb0ff]"
                    }`}
                  >
                    {a.freeAt}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {a.throughputMinPerDay == null ? (
                      <span className="text-slate-600">—</span>
                    ) : (
                      <span
                        className="tabular-nums font-semibold text-slate-200"
                        title={`${a.outputMinutesLogged}m over ${a.activeDays} active day(s)${
                          a.correctionDays
                            ? ` · includes ${a.correctionDays} correction day(s)`
                            : ""
                        }`}
                      >
                        {a.throughputMinPerDay}
                        <span className="ml-0.5 text-[10px] font-normal text-slate-500">
                          m/d
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {a.qualityAvg == null ? (
                      <span className="text-slate-600">—</span>
                    ) : (
                      <span
                        className={`tabular-nums font-semibold ${
                          a.qualityAvg >= 4
                            ? "text-emerald-300"
                            : a.qualityAvg >= 3
                              ? "text-amber-300"
                              : "text-rose-300"
                        }`}
                        title={`${a.qualityReviews} CPS review(s)`}
                      >
                        {a.qualityAvg}
                        <span className="ml-0.5 text-[10px] font-normal text-slate-500">
                          /5
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {a.openParts.length === 0 ? (
                      <span className="text-slate-600">—</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {a.openParts.slice(0, 3).map((p) => {
                          const promo = promoFor(snap, p.promoId);
                          return (
                            <Link
                              key={p.id}
                              href={`/promo/${p.promoId}`}
                              className="flex items-center gap-2 text-[11px] text-slate-300 hover:text-white"
                            >
                              <StagePill stage={p.stage} />
                              <span className="truncate">
                                {promo?.showName} · P{p.partNo} · {formatDuration(p.durationSec)}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {reviewsWithWeak.length > 0 && (
        <section className="space-y-2">
          <SectionTitle
            title="CPS quality feedback"
            hint="Weak Areas / remarks — readable log, not summarized · pass count matters"
          />
          <div className="space-y-2">
            {reviewsWithWeak.map((r) => {
              const promo = promoFor(snap, r.promoId);
              return (
                <article
                  key={r.id}
                  className="rounded-xl border border-white/[0.08] bg-[#121216] p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-[13px] font-medium text-white">
                      {promo ? `${promo.showName} · ${promo.scriptName}` : r.promoId}
                      <span className="text-slate-500"> · P{r.partNo}</span>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      CPS {r.cps}
                      {r.versionCorrection ? ` · ${r.versionCorrection} pass` : ""}
                      {r.animation?.overallQuality != null
                        ? ` · anim ${r.animation.overallQuality}/5`
                        : ""}
                    </p>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Anim: {r.animators.join(", ") || "—"}
                    {" · "}
                    Edit: {r.editors.join(", ") || "—"}
                    {r.krockLink && (
                      <>
                        {" · "}
                        <a
                          href={r.krockLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#9bb0ff] hover:underline"
                        >
                          Krock ↗
                        </a>
                      </>
                    )}
                  </p>
                  {r.animation?.weakAreas && (
                    <pre className="mt-2 whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-slate-300">
                      {r.animation.weakAreas}
                    </pre>
                  )}
                  {(r.animation?.remark || r.editing?.remark) && (
                    <p className="mt-2 text-[12px] text-slate-400">
                      {r.animation?.remark}
                      {r.animation?.remark && r.editing?.remark ? " · " : ""}
                      {r.editing?.remark}
                    </p>
                  )}
                  {promo && (
                    <Link
                      href={`/promo/${promo.id}`}
                      className="mt-2 inline-block text-[11px] font-semibold text-[#9bb0ff] hover:underline"
                    >
                      Open promo →
                    </Link>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
