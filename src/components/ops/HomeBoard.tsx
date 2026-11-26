"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { homeDelays, homeFree, homeLeaves, type HomeFree } from "@/lib/ops/home";
import { loadOutsidePlots, saveOutsidePlots, plotForName, type OutsidePlot } from "@/lib/ops/outside-plots";
import { formatDmy } from "@/lib/ops/selectors";
import type { IncomingPromo } from "@/lib/ops/tasks";
import { fetchIncoming } from "@/lib/ops/incoming-client";
import { filterWorkflowIncoming, incompleteHandoffs } from "@/lib/ops/workflow-queue";
import { Kpi, SectionTitle } from "./ui";
import { useOps } from "./OpsProvider";

export function HomeBoard() {
  const { snap } = useOps();
  const [incoming, setIncoming] = useState<IncomingPromo[] | null>(null);
  const [plots, setPlots] = useState<OutsidePlot[]>([]);
  const [form, setForm] = useState({ name: "", until: "", remark: "" });
  const [formError, setFormError] = useState("");
  const leaves = useMemo(() => homeLeaves(snap), [snap]);
  const delays = useMemo(() => homeDelays(snap), [snap]);
  const gaps = useMemo(() => incompleteHandoffs(snap), [snap]);
  const sheetFree = useMemo(() => homeFree(snap), [snap]);
  const followUp = useMemo(
    () => plots.filter((plot) => plot.until <= snap.today),
    [plots, snap.today]
  );
  const free = useMemo(() => {
    return sheetFree
      .map((row) => overlayPlot(row, plots, snap.today))
      .filter((row): row is HomeFree => row != null);
  }, [sheetFree, plots, snap.today]);
  const artistNames = useMemo(() => {
    const names = new Set<string>();
    for (const animator of snap.animators) {
      if (animator.team !== "agency" && animator.name.trim()) names.add(animator.name.trim());
    }
    for (const row of sheetFree) names.add(row.name);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [snap.animators, sheetFree]);
  const running = delays.filter((row) => row.bucket === "running");
  const upcoming = delays.filter((row) => row.bucket === "upcoming");
  const freeNow = free.filter((row) => row.kind === "free").length;

  useEffect(() => {
    setPlots(loadOutsidePlots());
  }, []);

  useEffect(() => {
    if (!snap.live) return;
    let cancelled = false;
    fetchIncoming(snap.promos.map((promo) => promo.id))
      .then((rows) => {
        if (cancelled) return;
        setIncoming(filterWorkflowIncoming(rows, snap));
      })
      .catch(() => {
        if (!cancelled) setIncoming([]);
      });
    return () => {
      cancelled = true;
    };
  }, [snap.promos, snap.live]);

  function persistPlots(next: OutsidePlot[]) {
    setPlots(next);
    saveOutsidePlots(next);
  }

  function savePlot() {
    const name = form.name.trim();
    const remark = form.remark.trim();
    if (!name || !form.until || !remark) {
      setFormError("Artist, other show, and till-when are all needed.");
      return;
    }
    const next: OutsidePlot = {
      id: `${name.toLowerCase()}|${form.until}|${Date.now()}`,
      name,
      until: form.until,
      remark,
    };
    persistPlots([...plots.filter((plot) => plot.name.trim().toLowerCase() !== name.toLowerCase()), next]);
    setForm({ name: "", until: "", remark: "" });
    setFormError("");
  }

  function fillPlot(name: string, until?: string | null, remark?: string) {
    setFormError("");
    setForm({
      name,
      until: until && until > snap.today ? until : snap.today,
      remark: remark ?? plotForName(plots, name)?.remark ?? "",
    });
  }

  function clearPlot(id: string) {
    persistPlots(plots.filter((plot) => plot.id !== id));
  }

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
        {followUp.length > 0 && (
          <Kpi label="Follow up" value={followUp.length} tone="text-amber-300" />
        )}
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

      {gaps.length > 0 && (
        <section className="space-y-2">
          <SectionTitle
            title="Named, still missing CP / scripts"
            hint="Paste the missing CP and links in Workflow — I upload them to Master Tracker"
            count={gaps.length}
          />
          <div className="rounded-xl border border-amber-500/20 bg-[#1b1814] px-4 py-3">
            <ul className="space-y-1.5">
              {gaps.slice(0, 6).map((row) => (
                <li key={row.promoId} className="text-[13px] text-slate-200">
                  <span className="font-semibold text-white">
                    {row.showName} · {row.promoName}
                  </span>
                  <span className="text-amber-200/80"> · need {row.missing.join(", ")}</span>
                </li>
              ))}
            </ul>
            {gaps.length > 6 && (
              <p className="mt-1 text-[11px] text-slate-500">+{gaps.length - 6} more</p>
            )}
            <Link
              href="/workflow"
              className="mt-3 inline-block rounded-md bg-[#4361ee] px-3 py-1.5 text-[12px] font-bold text-white hover:bg-[#5470f0]"
            >
              Paste and upload
            </Link>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <SectionTitle
          title="New promos on PocketFM"
          hint="Workflow: PocketFM script → Google agency copy → demarcate → CP → Master Tracker"
          count={incoming?.length}
        />
        {incoming == null ? (
          <Empty>Checking the Master Sheet…</Empty>
        ) : incoming.length === 0 ? (
          <Empty>No new promo is waiting in Workflow.</Empty>
        ) : (
          <div className="rounded-xl border border-white/[0.08] bg-[#222738] px-4 py-3">
            <ul className="space-y-1.5">
              {incoming.slice(0, 4).map((row) => (
                <li key={row.id} className="text-[13px] text-slate-200">
                  <span className="font-semibold text-white">{row.showName}</span>
                  <span className="text-slate-400">
                    {row.needsName ? " · needs a promo name" : row.promoName ? ` · ${row.promoName}` : ""}
                  </span>
                </li>
              ))}
            </ul>
            {incoming.length > 4 && (
              <p className="mt-1 text-[11px] text-slate-500">+{incoming.length - 4} more</p>
            )}
            <Link
              href="/workflow"
              className="mt-3 inline-block rounded-md bg-[#4361ee] px-3 py-1.5 text-[12px] font-bold text-white hover:bg-[#5470f0]"
            >
              Open Workflow
            </Link>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle title="Delayed projects" hint="Where it is stuck, for running and upcoming promos" count={delays.length} />
        <DelayGroup title="Running" rows={running} />
        <DelayGroup title="Upcoming" rows={upcoming} />
      </section>

      {followUp.length > 0 && (
        <section className="space-y-2">
          <SectionTitle
            title="Follow up — should be free"
            hint="Other in-house plot date has passed. Ask the team if they are free."
            count={followUp.length}
          />
          <ul className="space-y-2">
            {followUp.map((plot) => (
              <li
                key={plot.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3"
              >
                <div>
                  <p className="text-[13px] font-semibold text-white">{plot.name}</p>
                  <p className="mt-0.5 text-[12px] text-amber-100">
                    Should be free since {formatDmy(plot.until)}
                    {plot.remark ? ` · ${plot.remark}` : " · other in-house"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => fillPlot(plot.name, plot.until, plot.remark)}
                    className="rounded-md bg-white/[0.08] px-2.5 py-1 text-[11px] font-bold text-slate-200"
                  >
                    Still plotted
                  </button>
                  <button
                    type="button"
                    onClick={() => clearPlot(plot.id)}
                    className="rounded-md border border-emerald-400/40 bg-emerald-400/15 px-2.5 py-1 text-[11px] font-bold text-emerald-200"
                  >
                    Free now
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <SectionTitle
          title="Who is free"
          hint="PocketFM only. If they are on another show that is not yours, mark it here."
          count={free.length}
        />
        <div className="rounded-xl border border-[#4361ee]/35 bg-[#222738] px-4 py-4">
          <p className="text-[13px] font-bold text-white">Plotted on another show</p>
          <p className="mt-0.5 text-[12px] text-slate-400">
            Not a PocketFM promo — other in-house work. They leave the free list until that date, then Home asks you to follow up.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[12rem_1fr_10rem_auto]">
            <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Artist
              <input
                list="home-artists"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Name"
                className="mt-1 w-full rounded-md border border-white/[0.12] px-2 py-2 text-[13px] text-white"
              />
            </label>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Other show
              <input
                value={form.remark}
                onChange={(event) => setForm({ ...form, remark: event.target.value })}
                placeholder="Show / promo that is not under you"
                className="mt-1 w-full rounded-md border border-white/[0.12] px-2 py-2 text-[13px] text-white"
              />
            </label>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Plotted till
              <input
                type="date"
                value={form.until}
                onChange={(event) => setForm({ ...form, until: event.target.value })}
                className="mt-1 w-full rounded-md border border-white/[0.12] px-2 py-2 text-[13px] text-white"
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={savePlot}
                className="w-full rounded-md bg-[#4361ee] px-4 py-2 text-[12px] font-bold text-white hover:bg-[#5470f0]"
              >
                Save plot
              </button>
            </div>
          </div>
          {formError && <p className="mt-2 text-[12px] text-rose-300">{formError}</p>}
          <datalist id="home-artists">
            {artistNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>
        {free.length === 0 ? (
          <Empty>Nobody is free, and nobody has a plotted end date yet.</Empty>
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/[0.12]">
            <table className="w-full text-left text-[13px]">
              <thead className="text-[10px] uppercase tracking-wider text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-semibold">Artist</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="w-28 px-4 py-3 font-semibold" />
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
                        <span
                          className={
                            row.kind === "free"
                              ? "font-semibold text-emerald-200"
                              : row.kind === "overdue"
                                ? "font-semibold text-rose-200"
                                : "font-semibold text-[#c5d4ff]"
                          }
                        >
                          {row.line}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => fillPlot(row.name, row.until, plotForName(plots, row.name)?.remark)}
                        className="rounded-md bg-white/[0.08] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-300 hover:text-white"
                      >
                        Add plot
                      </button>
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

function overlayPlot(row: HomeFree, plots: OutsidePlot[], today: string): HomeFree | null {
  const plot = plotForName(plots, row.name);
  if (!plot) return row;
  if (plot.until <= today) return null;
  const note = plot.remark ? ` · ${plot.remark}` : " · other in-house";
  return {
    ...row,
    kind: "plotted",
    line: `Plotted till ${formatDmy(plot.until)}${note}`,
    until: plot.until,
    href: null,
  };
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
