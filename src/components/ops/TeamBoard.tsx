"use client";

import Link from "next/link";
import { useState } from "react";
import { animatorToday, formatDmy, teamGroups, type TeamGroupId } from "@/lib/ops/selectors";
import { SyncStrip } from "./SyncStrip";
import { useOps } from "./OpsProvider";

/** An open production or asset row means the person is still plotted, even after the date. */
function whenFree(until: string | null, today: string, plotted: boolean): string {
  if (!plotted) return "Free now";
  if (!until) return "Still plotted";
  if (until > today) return `Free ${formatDmy(until)}`;
  if (until === today) return "Due today";
  return `Still plotted · due ${formatDmy(until)}`;
}

export function TeamBoard() {
  const { snap } = useOps();
  const groups = teamGroups(snap);
  const [open, setOpen] = useState<TeamGroupId | null>(null);
  const opened = groups.find((group) => group.id === open) ?? null;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Team</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">
          Who is <span className="gradient-text">occupied</span>
        </h1>
        <p className="mt-1 max-w-3xl text-[12px] text-slate-500">
          Open a team to see where each person is plotted and when that plot sets them free.
        </p>
      </div>

      <SyncStrip />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {groups.map((group) => {
          const selected = open === group.id;
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => setOpen(selected ? null : group.id)}
              className={`rounded-xl border px-4 py-4 text-left ${
                selected ? "border-[#4361ee] bg-[#2a3148]" : "border-white/[0.12] bg-[#222738] hover:border-white/[0.24]"
              }`}
            >
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-300">{group.label}</p>
              <p className="mt-2 text-3xl font-extrabold text-white">{group.people.length}</p>
              <p className="mt-1 text-[12px] text-slate-300">
                {group.people.filter((person) => person.holds.length === 0).length} free
                {selected ? " · Hide" : " · Open"}
              </p>
            </button>
          );
        })}
      </div>

      {opened && (
        <section className="space-y-2">
          <h2 className="text-[13px] font-bold text-white">{opened.label}</h2>
          {opened.people.length === 0 ? (
            <p className="rounded-xl border border-white/[0.08] px-4 py-3 text-[12px] text-slate-300">
              Nobody is on this team.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/[0.12]">
              <table className="w-full table-fixed text-left text-[13px]">
                <thead className="text-[10px] uppercase tracking-wider text-slate-300">
                  <tr>
                    <th className="w-[20%] px-4 py-3 font-semibold">Person</th>
                    {opened.id === "animation" && <th className="w-[18%] px-4 py-3 font-semibold">Today</th>}
                    <th className="px-4 py-3 font-semibold">Plotted</th>
                    <th className="w-[24%] px-4 py-3 font-semibold">Free</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.08]">
                  {opened.people.map((person) => {
                    const rows = person.holds.length > 0 ? person.holds : [null];
                    return rows.map((hold, index) => (
                      <tr key={`${person.name}-${hold?.title ?? "free"}`}>
                        {index === 0 && (
                          <td rowSpan={rows.length} className="px-4 py-3 font-semibold text-white">
                            {person.name}
                            <span
                              className={`mt-1 block text-[11px] font-medium ${
                                person.holds.length === 0 ? "text-emerald-200" : "text-slate-300"
                              }`}
                            >
                              {whenFree(person.freeAt, snap.today, person.holds.length > 0)}
                            </span>
                          </td>
                        )}
                        {index === 0 && opened.id === "animation" && (
                          <td rowSpan={rows.length} className="px-4 py-3 text-[12px] font-semibold text-slate-200">
                            {animatorToday(snap, person.name)}
                          </td>
                        )}
                        <td className="px-4 py-3">
                          {hold ? (
                            <>
                              <Link
                                href={`/plan/${encodeURIComponent(hold.promoId)}`}
                                className="text-[12px] font-semibold text-slate-100 hover:underline"
                              >
                                {hold.title}
                              </Link>
                              <p className="mt-0.5 text-[11px] text-slate-300">
                                {hold.doing}
                                {hold.plan && hold.plan !== "Plan" ? ` · ${hold.plan}` : ""}
                              </p>
                            </>
                          ) : (
                            <span className="text-[12px] text-emerald-200">Not plotted</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[12px] font-semibold text-[#c5d4ff]">
                          {whenFree(hold?.until ?? null, snap.today, !!hold)}
                        </td>
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

    </div>
  );
}
