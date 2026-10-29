"use client";

import Link from "next/link";
import {
  assetDeadlinesToPush,
  formatDmy,
  promoFor,
  teamAvailability,
  type TeamPerson,
} from "@/lib/ops/selectors";
import { Kpi, SectionTitle } from "./ui";
import { SyncStrip } from "./SyncStrip";
import { useOps } from "./OpsProvider";

function whenFree(person: TeamPerson, today: string): string {
  if (person.free) return "Free now";
  if (!person.freeAt) return "No plan date";
  if (person.freeAt < today) return `Still on it · plan was ${formatDmy(person.freeAt)}`;
  if (person.freeAt === today) return "Free today";
  return formatDmy(person.freeAt);
}

export function TeamBoard() {
  const { snap, act, busy } = useOps();
  const people = teamAvailability(snap);
  const free = people.filter((p) => p.free).length;
  const unplanned = people.filter((p) => !p.free && !p.freeAt).length;
  const deadlines = assetDeadlinesToPush(snap);
  const reviewsWithWeak = snap.qualityReviews.filter(
    (r) => r.animation?.weakAreas || r.editing?.remark || r.animation?.remark
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Team</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">
          Who is <span className="gradient-text">free</span>
        </h1>
        <p className="mt-1 text-[12px] text-slate-500">
          From the calendar and plan dates. Free now means no open row. Free on is the latest plan date on the work they still have.
        </p>
      </div>

      <SyncStrip />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Kpi label="People" value={people.length} />
        <Kpi label="Free now" value={free} tone="text-emerald-300" />
        <Kpi label="Busy" value={people.length - free} tone="text-slate-200" />
        <Kpi
          label="No plan date"
          value={unplanned}
          tone={unplanned ? "text-amber-300" : "text-white"}
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
          title="Free and when"
          hint="Open calendar rows only. The date is the latest plan mark on that work."
        />
        <div className="overflow-hidden rounded-xl border border-white/[0.08]">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Person</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Free on</th>
                <th className="px-4 py-3 font-semibold">Holding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {people.map((person) => {
                const label = whenFree(person, snap.today);
                return (
                  <tr key={person.name} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-medium text-white">{person.name}</td>
                    <td className="px-4 py-3 text-[11px] text-slate-400">{person.roles.join(" · ")}</td>
                    <td
                      className={`px-4 py-3 text-[12px] font-semibold ${
                        person.free
                          ? "text-emerald-300"
                          : !person.freeAt || person.freeAt < snap.today
                            ? "text-amber-200"
                            : "text-[#9bb0ff]"
                      }`}
                    >
                      {label}
                    </td>
                    <td className="px-4 py-3">
                      {person.holds.length === 0 ? (
                        <span className="text-slate-600">—</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {person.holds.slice(0, 3).map((hold) => (
                            <Link
                              key={hold.label}
                              href={`/plan/${encodeURIComponent(hold.promoId)}`}
                              className="truncate text-[11px] text-slate-300 hover:text-white"
                              title={hold.label}
                            >
                              {hold.label}
                            </Link>
                          ))}
                          {person.holds.length > 3 && (
                            <p className="text-[11px] text-slate-500">+{person.holds.length - 3} more</p>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
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
