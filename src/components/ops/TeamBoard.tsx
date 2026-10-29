"use client";

import Link from "next/link";
import {
  assetDeadlinesToPush,
  formatDmy,
  promoFor,
  teamGroups,
  type TeamGroupId,
  type TeamHold,
  type TeamPerson,
} from "@/lib/ops/selectors";
import { Kpi, SectionTitle } from "./ui";
import { SyncStrip } from "./SyncStrip";
import { useOps } from "./OpsProvider";

function whenFree(person: TeamPerson, today: string): string {
  if (!person.freeAt) return "No plan date";
  if (person.freeAt < today) return `Supposed to be free ${formatDmy(person.freeAt)}`;
  if (person.freeAt === today) return "Free today";
  return formatDmy(person.freeAt);
}

/** Stage this role is still responsible for, once their plan date has passed. */
function stuckStage(group: TeamGroupId, doing: string): string | null {
  const stage = doing.toLowerCase();
  if (group === "editor") {
    if (/correction/.test(stage)) return "Correction";
    if (/edit/.test(stage)) return "Edit";
    return null;
  }
  if (group === "assets") {
    if (/correction/.test(stage)) return "Correction";
    if (/asset/.test(stage)) return "Assets";
    return null;
  }
  if (/correction/.test(stage)) return "Correction";
  if (/anim|plot/.test(stage)) return "Animation";
  return null;
}

function holdNotice(group: TeamGroupId, hold: TeamHold): string | null {
  if (hold.lateDays <= 0) return null;
  const stage = stuckStage(group, hold.doing);
  return stage ? `Supposed to be free, still in ${stage}` : "Supposed to be free";
}

export function TeamBoard() {
  const { snap, act, busy } = useOps();
  const groups = teamGroups(snap);
  const delayed = groups.reduce(
    (n, group) => n + group.people.filter((p) => p.holds.some((h) => h.lateDays > 0)).length,
    0
  );
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
        <p className="mt-1 max-w-3xl text-[12px] text-slate-500">
          Ongoing calendar work, split by assets, animators, editors, and agency. If a plan date has passed, the note says they were supposed to be free and which stage they are still in.
        </p>
      </div>

      <SyncStrip />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {groups.map((group) => (
          <Kpi key={group.id} label={group.label} value={group.people.length} />
        ))}
        <Kpi
          label="Supposed to be free"
          value={delayed}
          tone={delayed ? "text-rose-300" : "text-emerald-300"}
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

      {groups.map((group) => (
        <section key={group.id} className="space-y-2">
          <SectionTitle
            title={group.label}
            hint={
              group.id === "animator" || group.id === "agency"
                ? group.freeNow.length
                  ? `Free now: ${group.freeNow.join(", ")}`
                  : "No one in this group is free right now."
                : "If the plan date has passed, the note says the stage they are still in."
            }
          />
          {group.people.length === 0 ? (
            <p className="rounded-xl border border-white/[0.08] px-4 py-3 text-[12px] text-slate-500">
              No ongoing work.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/[0.08]">
              <table className="w-full table-fixed text-left text-[13px]">
                <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="w-[16%] px-4 py-3 font-semibold">Person</th>
                    <th className="w-[34%] px-4 py-3 font-semibold">Doing now</th>
                    <th className="w-[18%] px-4 py-3 font-semibold">Free on</th>
                    <th className="w-[32%] px-4 py-3 font-semibold">Notice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {group.people.map((person) =>
                    person.holds.map((hold, index) => {
                      const notice = holdNotice(group.id, hold);
                      return (
                      <tr key={`${person.name}-${hold.title}`} className="align-top hover:bg-white/[0.02]">
                        {index === 0 && (
                          <td rowSpan={person.holds.length} className="px-4 py-3 font-medium text-white">
                            {person.name}
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <Link
                            href={`/plan/${encodeURIComponent(hold.promoId)}`}
                            className="block text-[12px] font-semibold text-slate-200 hover:text-white"
                          >
                            {hold.title}
                          </Link>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {hold.doing}
                            {hold.until ? ` · plan ${formatDmy(hold.until)}` : ""}
                            {hold.plan && hold.plan !== "Plan" ? ` · ${hold.plan}` : ""}
                          </p>
                        </td>
                        {index === 0 && (
                          <td
                            rowSpan={person.holds.length}
                            className={`px-4 py-3 text-[12px] font-semibold ${
                              !person.freeAt || person.freeAt < snap.today
                                ? "text-amber-200"
                                : "text-[#9bb0ff]"
                            }`}
                          >
                            {whenFree(person, snap.today)}
                          </td>
                        )}
                        <td className="px-4 py-3 text-[12px] leading-snug">
                          {notice ? (
                            <span className="font-semibold text-rose-200">{notice}</span>
                          ) : (
                            <span className="text-slate-500">{hold.until ? "As planned" : "No plan date"}</span>
                          )}
                        </td>
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}

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
