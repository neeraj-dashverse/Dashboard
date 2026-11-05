"use client";

import Link from "next/link";
import {
  assetDeadlinesToPush,
  daysUntil,
  formatDmy,
  teamGroups,
  type TeamPerson,
} from "@/lib/ops/selectors";
import { Kpi, SectionTitle } from "./ui";
import { SyncStrip } from "./SyncStrip";
import { useOps } from "./OpsProvider";

/** Days from today until the plotted plan date. A past plot does not extend occupation. */
function occupiedDays(until: string | null, today: string): string {
  const days = daysUntil(until, today);
  if (days == null) return "—";
  if (days < 0) return "0";
  return String(days);
}

function occupiedUntil(person: TeamPerson, today: string): string {
  if (!person.freeAt) return "No plan date";
  const days = occupiedDays(person.freeAt, today);
  return days === "0" ? `Plot was ${formatDmy(person.freeAt)}` : `${days} days · until ${formatDmy(person.freeAt)}`;
}

export function TeamBoard() {
  const { snap, act, busy } = useOps();
  const groups = teamGroups(snap);
  const deadlines = assetDeadlinesToPush(snap);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Team</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">
          Who is <span className="gradient-text">occupied</span>
        </h1>
        <p className="mt-1 max-w-3xl text-[12px] text-slate-500">
          Days left until the latest date currently plotted for each person. A plot that has already passed does not add more days.
        </p>
      </div>

      <SyncStrip />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {groups.map((group) => (
          <Kpi key={group.id} label={group.label} value={group.people.length} />
        ))}
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
                  ? `No open row: ${group.freeNow.join(", ")}`
                  : "Everyone here has a plotted row."
                : "Days run from today to the date plotted on that row."
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
                    <th className="w-[18%] px-4 py-3 font-semibold">Person</th>
                    <th className="w-[42%] px-4 py-3 font-semibold">Plotted work</th>
                    <th className="w-[22%] px-4 py-3 font-semibold">Occupied</th>
                    <th className="w-[18%] px-4 py-3 font-semibold">Days</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {group.people.map((person) =>
                    person.holds.map((hold, index) => (
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
                            {hold.plan && hold.plan !== "Plan" ? ` · ${hold.plan}` : ""}
                          </p>
                        </td>
                        {index === 0 && (
                          <td
                            rowSpan={person.holds.length}
                            className="px-4 py-3 text-[12px] font-semibold text-[#9bb0ff]"
                          >
                            {occupiedUntil(person, snap.today)}
                          </td>
                        )}
                        <td className="px-4 py-3 text-[12px] font-semibold text-slate-200">
                          {occupiedDays(hold.until, snap.today)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}

    </div>
  );
}
