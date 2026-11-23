"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { homeDelays, homeFree, homeLeaves } from "@/lib/ops/home";
import { formatDmy } from "@/lib/ops/selectors";
import type { IncomingPromo } from "@/lib/ops/tasks";
import { Kpi, SectionTitle } from "./ui";
import { useOps } from "./OpsProvider";

export function HomeBoard() {
  const { snap } = useOps();
  const [incoming, setIncoming] = useState<IncomingPromo[] | null>(null);
  const leaves = useMemo(() => homeLeaves(snap), [snap]);
  const delays = useMemo(() => homeDelays(snap), [snap]);
  const free = useMemo(() => homeFree(snap), [snap]);
  const running = delays.filter((row) => row.bucket === "running");
  const upcoming = delays.filter((row) => row.bucket === "upcoming");
  const freeNow = free.filter((row) => row.kind === "free").length;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ops/incoming", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ knownIds: snap.promos.map((promo) => promo.id) }),
    })
      .then((res) => res.json())
      .then((data: { incoming?: IncomingPromo[] }) => {
        if (!cancelled) setIncoming(data.incoming ?? []);
      })
      .catch(() => {
        if (!cancelled) setIncoming([]);
      });
    return () => {
      cancelled = true;
    };
  }, [snap.promos, snap.live]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">PocketFM · Operations</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">Home</h1>
          <p className="mt-1 max-w-2xl text-[12px] text-slate-500">
            Leaves, new PocketFM promos, delays on running and upcoming work, and who can take a plot.
          </p>
        </div>
        <p className="text-[12px] tabular-nums text-slate-500">{formatDmy(snap.today)}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi label="Upcoming leave" value={leaves.length} tone={leaves.length ? "text-amber-300" : "text-white"} />
        <Kpi
          label="New from PocketFM"
          value={incoming == null ? "…" : incoming.length}
          tone={incoming && incoming.length ? "text-[#9bb0ff]" : "text-white"}
        />
        <Kpi label="Delayed" value={delays.length} tone={delays.length ? "text-rose-300" : "text-white"} />
        <Kpi label="Free now" value={freeNow} tone="text-emerald-300" />
      </div>

      <section className="space-y-2">
        <SectionTitle title="Upcoming leave" hint="Who is off, and where they are plotted now" count={leaves.length} />
        {leaves.length === 0 ? (
          <Empty>Nobody is on leave in the coming days.</Empty>
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/[0.12]">
            <table className="w-full text-left text-[13px]">
              <thead className="text-[10px] uppercase tracking-wider text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-semibold">Person</th>
                  <th className="px-4 py-3 font-semibold">Leave</th>
                  <th className="px-4 py-3 font-semibold">Plotted now</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.08]">
                {leaves.map((row) => (
                  <tr key={row.name}>
                    <td className="px-4 py-3 font-semibold text-white">{row.name}</td>
                    <td className="px-4 py-3 text-[12px] font-semibold text-amber-200">{row.when}</td>
                    <td className="px-4 py-3">
                      {row.holds.length === 0 ? (
                        <span className="text-[12px] text-slate-300">Not plotted</span>
                      ) : (
                        <div className="space-y-1">
                          {row.holds.map((hold) => (
                            <p key={hold.title} className="text-[12px] text-slate-200">
                              <Link
                                href={`/promo/${encodeURIComponent(hold.promoId)}`}
                                className="font-semibold hover:underline"
                              >
                                {hold.title}
                              </Link>
                              <span className="text-slate-400">
                                {" "}
                                · {hold.doing}
                                {hold.until
                                  ? hold.until > snap.today
                                    ? ` · till ${formatDmy(hold.until)}`
                                    : hold.until === snap.today
                                      ? " · due today"
                                      : ` · due ${formatDmy(hold.until)}`
                                  : ""}
                              </span>
                            </p>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <SectionTitle
          title="New promos on PocketFM"
          hint="On the Master Sheet, not yet on Master Tracker"
          count={incoming?.length}
        />
        {incoming == null ? (
          <Empty>Checking the Master Sheet…</Empty>
        ) : incoming.length === 0 ? (
          <Empty>No new promo on the PocketFM sheet.</Empty>
        ) : (
          <ul className="space-y-2">
            {incoming.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-[#222738] px-4 py-3"
              >
                <div>
                  <p className="text-[13px] font-semibold text-white">
                    {row.showName}
                    {row.promoName ? ` · ${row.promoName}` : ""}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">New on Dashverse↔PFM Master Sheet</p>
                </div>
                <a
                  href={snap.source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md bg-white/[0.08] px-2.5 py-1 text-[11px] font-bold text-slate-200"
                >
                  Open sheet
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle title="Delayed projects" hint="Where it is stuck, for running and upcoming promos" count={delays.length} />
        <DelayGroup title="Running" rows={running} />
        <DelayGroup title="Upcoming" rows={upcoming} />
      </section>

      <section className="space-y-2">
        <SectionTitle
          title="Who is free"
          hint="In-house animation. If they are on another show, plotted till that day"
          count={free.length}
        />
        {free.length === 0 ? (
          <Empty>Nobody is free, and nobody has a plotted end date yet.</Empty>
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/[0.12]">
            <table className="w-full text-left text-[13px]">
              <thead className="text-[10px] uppercase tracking-wider text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-semibold">Artist</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.08]">
                {free.map((row) => (
                  <tr key={row.name}>
                    <td className="px-4 py-3 font-semibold text-white">{row.name}</td>
                    <td className="px-4 py-3 text-[12px]">
                      {row.href ? (
                        <Link
                          href={row.href}
                          className={
                            row.kind === "free"
                              ? "font-semibold text-emerald-200 hover:underline"
                              : row.kind === "overdue"
                                ? "font-semibold text-rose-200 hover:underline"
                                : "font-semibold text-[#c5d4ff] hover:underline"
                          }
                        >
                          {row.line}
                        </Link>
                      ) : (
                        <span className="font-semibold text-emerald-200">{row.line}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Empty({ children }: { children: string }) {
  return (
    <p className="rounded-xl border border-dashed border-white/[0.1] px-4 py-6 text-center text-[12px] text-slate-400">
      {children}
    </p>
  );
}

function DelayGroup({
  title,
  rows,
}: {
  title: string;
  rows: ReturnType<typeof homeDelays>;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
        {title}
        <span className="ml-2 text-slate-600">{rows.length}</span>
      </h3>
      {rows.length === 0 ? (
        <Empty>None delayed.</Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/[0.12]">
          <table className="w-full text-left text-[13px]">
            <thead className="text-[10px] uppercase tracking-wider text-slate-300">
              <tr>
                <th className="px-4 py-3 font-semibold">Promo</th>
                <th className="px-4 py-3 font-semibold">Where</th>
                <th className="px-4 py-3 font-semibold">Artist</th>
                <th className="px-4 py-3 font-semibold">Late</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.08]">
              {rows.map((row) => (
                <tr key={row.key}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/promo/${encodeURIComponent(row.promoId)}`}
                      className="font-semibold text-white hover:underline"
                    >
                      {row.title}
                    </Link>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {[row.parts, row.planned ? `plan ${formatDmy(row.planned)}` : ""]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-[12px] font-semibold text-rose-200">{row.where}</td>
                  <td className="px-4 py-3 text-[12px] text-slate-200">{row.artist}</td>
                  <td className={`px-4 py-3 text-[12px] font-bold tabular-nums ${row.extreme ? "text-rose-300" : "text-amber-200"}`}>
                    {row.daysLate}d
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
