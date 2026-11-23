import type { OpsSnapshot } from "./types";
import {
  calendarDelay,
  dayLanes,
  daysLate,
  formatDmy,
  missedPlanDate,
  plannerPreprodRows,
  plannerRows,
  STAGE_LABEL,
  teamGroups,
  type PlannerRow,
  type TeamHold,
} from "./selectors";

function personKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function nextIso(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function leaveRuns(dates: string[]): { start: string; end: string }[] {
  const sorted = [...new Set(dates)].sort();
  const runs: { start: string; end: string }[] = [];
  for (const date of sorted) {
    const last = runs[runs.length - 1];
    if (last && nextIso(last.end) === date) last.end = date;
    else runs.push({ start: date, end: date });
  }
  return runs;
}

function rangeLabel(start: string, end: string): string {
  return start === end ? formatDmy(start) : `${formatDmy(start)} – ${formatDmy(end)}`;
}

function holdShow(title: string): string {
  return title.replace(/\s*·\s*P\d+$/, "");
}

function holdsForName(groups: ReturnType<typeof teamGroups>, name: string): TeamHold[] {
  const key = personKey(name);
  const seen = new Set<string>();
  const out: TeamHold[] = [];
  for (const group of groups) {
    for (const person of group.people) {
      if (personKey(person.name) !== key) continue;
      for (const hold of person.holds) {
        if (seen.has(hold.title)) continue;
        seen.add(hold.title);
        out.push(hold);
      }
    }
  }
  return out;
}

function plottedLine(holds: TeamHold[], today: string): string {
  if (holds.length === 0) return "Not plotted";
  const dated = [...holds].sort((a, b) => (b.until ?? "").localeCompare(a.until ?? ""));
  const top = dated[0];
  const show = holdShow(top.title);
  const extra = holds.length > 1 ? ` · +${holds.length - 1} more` : "";
  if (!top.until) return `Plotted now on ${show}${extra}`;
  if (top.until > today) return `Plotted now on ${show} till ${formatDmy(top.until)}${extra}`;
  if (top.until === today) return `Plotted now on ${show} · due today${extra}`;
  return `Still plotted on ${show} · due ${formatDmy(top.until)}${extra}`;
}

export type HomeLeave = {
  name: string;
  when: string;
  start: string;
  plotted: string;
  holds: TeamHold[];
};

/** Leave today or later, with where that person is plotted right now. */
export function homeLeaves(snap: OpsSnapshot): HomeLeave[] {
  const byName = new Map<string, { name: string; dates: string[] }>();
  for (const day of snap.attendance ?? []) {
    if (!/^leave$/i.test(day.status)) continue;
    if (!day.date || day.date < snap.today) continue;
    const name = day.name.trim();
    if (!name || /@/.test(name)) continue;
    const key = personKey(name);
    const row = byName.get(key) ?? { name, dates: [] };
    row.dates.push(day.date);
    byName.set(key, row);
  }
  const groups = teamGroups(snap);
  const out: HomeLeave[] = [];
  for (const row of byName.values()) {
    const runs = leaveRuns(row.dates);
    if (!runs.length) continue;
    const holds = holdsForName(groups, row.name);
    out.push({
      name: row.name,
      when: runs.map((run) => rangeLabel(run.start, run.end)).join(", "),
      start: runs[0].start,
      plotted: plottedLine(holds, snap.today),
      holds,
    });
  }
  return out.sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name));
}

export type HomeDelay = {
  key: string;
  bucket: "running" | "upcoming";
  promoId: string;
  sheetIndex: number;
  title: string;
  where: string;
  planned: string | null;
  daysLate: number;
  artist: string;
  parts: string;
  extreme: boolean;
};

function productionStarted(row: PlannerRow, today: string): boolean {
  const part = row.part;
  if (!part) return false;
  if (part.aniStartDate && part.aniStartDate <= today) return true;
  if (part.stage && part.stage !== "planning") return true;
  const lane = (dayLanes(row, today, today, "production")[0]?.label ?? "").toLowerCase();
  return /anim|edit|correction|sound/.test(lane);
}

function delayRow(
  snap: OpsSnapshot,
  row: PlannerRow,
  tab: "preprod" | "production"
): HomeDelay | null {
  const mark = calendarDelay(row, snap.today, snap.today, tab, snap);
  const missed = missedPlanDate(row, snap.today, tab);
  if (mark === "none" && !missed) return null;
  const planned = missed ?? row.plannedDate;
  const late = daysLate(planned, snap.today, snap);
  if (late <= 0 && mark === "none") return null;
  const lane =
    tab === "preprod"
      ? "Assets"
      : dayLanes(row, snap.today, snap.today, tab)[0]?.label ??
        (row.part ? STAGE_LABEL[row.part.stage] ?? row.part.stage : "Plotting");
  const title = `${row.promo.showName || "—"} · ${row.promo.promoName || "—"}`;
  const artist = (row.part?.artist ?? row.promo.assetTeam?.artist1 ?? "").trim() || "—";
  return {
    key: `${tab}:${row.promo.id}:${lane}`,
    bucket: tab === "preprod" || !productionStarted(row, snap.today) ? "upcoming" : "running",
    promoId: row.promo.id,
    sheetIndex: row.promo.sheetIndex ?? -1,
    title,
    where: lane,
    planned,
    daysLate: late,
    artist,
    parts: row.partNo > 0 ? `P${row.partNo}` : "",
    extreme: mark === "extreme" || late >= 3,
  };
}

function mergeDelay(into: HomeDelay, extra: HomeDelay): void {
  if (extra.daysLate > into.daysLate) {
    into.daysLate = extra.daysLate;
    into.planned = extra.planned;
  }
  into.extreme = into.extreme || extra.extreme;
  const artists = new Set(
    [...into.artist.split(","), ...extra.artist.split(",")]
      .map((name) => name.trim())
      .filter((name) => name && name !== "—")
  );
  into.artist = [...artists].join(", ") || "—";
  const parts = [...new Set([...into.parts.split(", "), extra.parts].filter(Boolean))].sort(
    (a, b) => Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, ""))
  );
  into.parts = parts.join(", ");
}

/** Calendar delays on running production and on upcoming (assets / not started) promos. */
export function homeDelays(snap: OpsSnapshot): HomeDelay[] {
  const grouped = new Map<string, HomeDelay>();
  const push = (item: HomeDelay | null) => {
    if (!item) return;
    const prev = grouped.get(item.key);
    if (prev) mergeDelay(prev, item);
    else grouped.set(item.key, { ...item });
  };
  for (const row of plannerRows(snap)) push(delayRow(snap, row, "production"));
  for (const row of plannerPreprodRows(snap)) push(delayRow(snap, row, "preprod"));
  return [...grouped.values()].sort((a, b) => {
    if (a.extreme !== b.extreme) return a.extreme ? -1 : 1;
    if (a.daysLate !== b.daysLate) return b.daysLate - a.daysLate;
    return b.sheetIndex - a.sheetIndex || a.title.localeCompare(b.title);
  });
}

export type HomeFree = {
  name: string;
  kind: "free" | "plotted" | "overdue";
  line: string;
  until: string | null;
  href: string | null;
};

/** In-house animators who are free now, or plotted on another show until a date. */
export function homeFree(snap: OpsSnapshot): HomeFree[] {
  const onLeave = new Set(homeLeaves(snap).map((row) => personKey(row.name)));
  const animation = teamGroups(snap).find((group) => group.id === "animation");
  const out: HomeFree[] = [];
  for (const person of animation?.people ?? []) {
    if (onLeave.has(personKey(person.name))) continue;
    if (person.holds.length === 0) {
      out.push({ name: person.name, kind: "free", line: "Free now", until: null, href: null });
      continue;
    }
    const latest = [...person.holds].sort((a, b) => (b.until ?? "").localeCompare(a.until ?? ""))[0];
    const show = holdShow(latest.title);
    const extra = person.holds.length > 1 ? ` · +${person.holds.length - 1} more` : "";
    const href = `/promo/${encodeURIComponent(latest.promoId)}`;
    if (!latest.until) continue;
    if (latest.until > snap.today) {
      out.push({
        name: person.name,
        kind: "plotted",
        line: `Plotted till ${formatDmy(latest.until)} · ${show}${extra}`,
        until: latest.until,
        href,
      });
      continue;
    }
    if (latest.until === snap.today) {
      out.push({
        name: person.name,
        kind: "plotted",
        line: `Due today · ${show}${extra}`,
        until: latest.until,
        href,
      });
      continue;
    }
    out.push({
      name: person.name,
      kind: "overdue",
      line: `Should be free since ${formatDmy(latest.until)} · still on ${show}${extra}`,
      until: latest.until,
      href,
    });
  }
  const rank = { free: 0, overdue: 1, plotted: 2 };
  return out.sort((a, b) => {
    const r = rank[a.kind] - rank[b.kind];
    if (r !== 0) return r;
    if (a.until && b.until && a.until !== b.until) return a.until.localeCompare(b.until);
    return a.name.localeCompare(b.name);
  });
}
