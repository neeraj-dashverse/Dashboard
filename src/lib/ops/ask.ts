import { creditCompare, formatCredits, formatPerMin, formatUsd } from "./credits";
import type { OpsSnapshot, Part, Promo, QualityReview } from "./types";
import {
  animatorProductivity,
  animatorLeave,
  animatorToday,
  durationProfile,
  durationRanking,
  formatDmy,
  formatDuration,
  findDuration,
  formatClock,
  promoFor,
  qualityForAnimator,
  STAGE_LABEL,
  teamGroups,
  daysLate,
  daysUntil as workingDaysUntil,
  type DurationProfile,
} from "./selectors";
import { DURATION_WORKED_BUCKETS } from "./sheet-registry";

const DURATION_BUCKET_ORDER = ["<3", "3-5", "5-7", ">7"] as const;

/** "5 day(s) at 3 - 5 min, 2 at 5 - 7 min" — only buckets with at least one day. */
function durationCountsLine(profile: DurationProfile): string {
  return DURATION_BUCKET_ORDER.filter((bucket) => profile.counts[bucket] > 0)
    .map((bucket) => `${profile.counts[bucket]} at ${DURATION_WORKED_BUCKETS[bucket].label.toLowerCase()}`)
    .join(", ");
}

/** The mode bucket as a plain sentence — a count, not a fraction (per Neeraj: "no need of fractions"). */
function typicalRangeLine(profile: DurationProfile): string {
  if (!profile.typicalRange) return "No Duration worked/day data yet.";
  const tier = DURATION_WORKED_BUCKETS[profile.typicalRange].tier;
  return `Mostly logs ${DURATION_WORKED_BUCKETS[profile.typicalRange].label.toLowerCase()} (${tier}). ${durationCountsLine(
    profile
  )}.`;
}

export type AskChoice = {
  kind: "person" | "promo";
  id: string;
  label: string;
};

export type AskTable = {
  title?: string;
  columns: string[];
  rows: string[][];
};

export type AskIntent =
  | "availability"
  | "agency_availability"
  | "leave"
  | "open_promos"
  | "delivery"
  | "capacity"
  | "productivity"
  | "avg_promo_time"
  | "person_plot"
  | "person_when_free"
  | "person_promo"
  | "person_rating_feedback"
  | "person_full"
  | "promo_close"
  | "promo_status"
  | "credits"
  | "sheets";

export type AskReply = {
  heading: string;
  lines: string[];
  /** More than one sheet row fits the question. The person picks one. */
  choices?: AskChoice[];
  table?: AskTable;
  tables?: AskTable[];
  /** The promo or person this answer is about, so the next question can follow it. */
  focus?: AskChoice;
  /** So a follow-up like "what about Dhara?" can reuse the same kind of answer. */
  intent?: AskIntent;
  /** Artists this answer was about, so "each of them" can reuse the list. */
  people?: string[];
};

function norm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function mentioned(question: string, name: string): boolean {
  const needle = norm(name);
  if (needle.length < 3) return false;
  const hay = ` ${norm(question)} `;
  if (hay.includes(` ${needle} `)) return true;
  const first = needle.split(" ")[0] ?? "";
  return first.length >= 4 && hay.includes(` ${first} `);
}

function daysUntil(snap: OpsSnapshot, date: string): number {
  return workingDaysUntil(date, snap.today, snap) ?? 0;
}

function uniqueNames(snap: OpsSnapshot): string[] {
  const names = new Set<string>();
  const add = (value: string | null | undefined) => {
    const name = (value ?? "").trim();
    if (name) names.add(name);
  };
  for (const animator of snap.animators) add(animator.name);
  for (const part of snap.parts) {
    for (const piece of `${part.artist ?? ""}, ${part.editors ?? ""}`.split(/[,，;/]|&| and /i)) add(piece);
  }
  for (const review of snap.qualityReviews) {
    review.animators.forEach(add);
    review.editors.forEach(add);
  }
  for (const log of snap.dailyLogs) add(log.artist);
  for (const group of teamGroups(snap)) group.people.forEach((person) => add(person.name));
  return [...names];
}

function peopleInQuestion(snap: OpsSnapshot, question: string): string[] {
  const scored = uniqueNames(snap)
    .map((name) => ({ name, score: Math.max(nameScore(question, name), mentioned(question, name) ? 100 : 0) }))
    .filter((row) => row.score >= 70)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const matched = scored.map((row) => row.name);
  return matched.filter((name) => {
    const key = norm(name);
    return !matched.some((other) => {
      const longer = norm(other);
      return longer !== key && longer.startsWith(`${key} `);
    });
  });
}

function refersToListedPeople(question: string): boolean {
  return /\b(each|all)\b.{0,24}\b(artist|person|name|them|one)|\babove mentioned\b|\bnames? i (have )?given\b|\bthose (names|artists|people)\b|\bthe (same )?names\b/i.test(
    question
  );
}

function hasParts(snap: OpsSnapshot, promo: Promo, openOnly: boolean): boolean {
  const base = promo.id.split("#")[0];
  return snap.parts.some(
    (part) =>
      (part.promoId === base || part.promoId.split("#")[0] === base) &&
      (!openOnly || part.stage !== "delivered")
  );
}

function promosInQuestion(snap: OpsSnapshot, question: string): Promo[] {
  const q = norm(question);
  const hits = snap.promos.filter((promo) => {
    const show = norm(promo.showName);
    const script = norm(promo.promoName);
    return (show.length >= 3 && q.includes(show)) || (script.length >= 3 && q.includes(script));
  });
  const namedScript = hits.filter((promo) => {
    const script = norm(promo.promoName);
    return script.length >= 3 && script !== norm(promo.showName) && q.includes(script);
  });
  const pool = namedScript.length
    ? namedScript
    : hits.filter((promo) => {
        const show = norm(promo.showName);
        return show.length >= 3 && q.includes(show);
      });
  const seen = new Set<string>();
  const unique: Promo[] = [];
  for (const promo of pool) {
    const base = promo.id.split("#")[0];
    if (seen.has(base)) continue;
    seen.add(base);
    unique.push(promo);
  }
  if (namedScript.length) return unique;
  const open = unique.filter((promo) => hasParts(snap, promo, true));
  if (open.length) return open;
  const produced = unique.filter((promo) => hasParts(snap, promo, false));
  return produced.length ? produced : unique.slice(0, 1);
}

function formatPartList(parts: number[]): string {
  const nums = [...new Set(parts)].sort((a, b) => a - b);
  const runs: string[] = [];
  let start = nums[0];
  let prev = nums[0];
  for (const num of nums.slice(1)) {
    if (num === prev + 1) {
      prev = num;
      continue;
    }
    runs.push(start === prev ? String(start) : `${start}–${prev}`);
    start = prev = num;
  }
  if (start != null) runs.push(start === prev ? String(start) : `${start}–${prev}`);
  return runs.join(", ");
}

function editDistance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) rows[i][0] = i;
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] =
        a[i - 1] === b[j - 1]
          ? rows[i - 1][j - 1]
          : 1 + Math.min(rows[i - 1][j], rows[i][j - 1], rows[i - 1][j - 1]);
    }
  }
  return rows[a.length][b.length];
}

function tokenNear(word: string, token: string): boolean {
  if (word === token) return true;
  if (word.length < 4 || token.length < 4) return false;
  const limit = Math.max(word.length, token.length) >= 8 ? 2 : 1;
  return editDistance(word, token) <= limit;
}

const NAME_STOP = new Set([
  "the",
  "and",
  "for",
  "promo",
  "promos",
  "show",
  "shows",
  "animation",
  "animator",
  "animators",
  "available",
  "availability",
  "free",
  "status",
  "open",
  "part",
  "parts",
  "artist",
  "house",
  "inhouse",
  "working",
  "leave",
  "today",
  "current",
  "deliver",
  "delivery",
  "close",
]);

/** 100 when the name is written out. Lower when only some words, or a spelling, match. */
function nameScore(question: string, name: string): number {
  const label = norm(name);
  if (label.length < 3) return 0;
  const asked = norm(question);
  if (asked.includes(label) && !NAME_STOP.has(label)) return 100;
  const words = asked.split(" ").filter((word) => word.length >= 3 && !NAME_STOP.has(word));
  const tokens = label.split(" ").filter((token) => token.length >= 3 && !NAME_STOP.has(token));
  if (!words.length || !tokens.length) return 0;
  let weight = 0;
  let matched = 0;
  for (const token of tokens) {
    weight += token.length;
    if (words.some((word) => word === token || tokenNear(word, token))) matched += token.length;
  }
  return weight ? Math.min(92, Math.round((matched / weight) * 100)) : 0;
}

function plotDate(part: Part): string | null {
  return part.plannedPlottedDate ?? part.deadline ?? part.plannedDate;
}

function samePerson(a: string, b: string): boolean {
  const left = norm(a);
  const right = norm(b);
  if (!left || !right) return false;
  return left === right || left.startsWith(right) || right.startsWith(left);
}

function sameTitle(a: string, b: string): boolean {
  const left = norm(a);
  const right = norm(b);
  if (!left || !right || left.length < 3 || right.length < 3) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function productivityFor(snap: OpsSnapshot, name: string, showName: string, promoName: string) {
  const logs = snap.dailyLogs.filter(
    (log) =>
      samePerson(log.artist, name) &&
      (sameTitle(log.showName, showName) || sameTitle(log.promoName, promoName) || sameTitle(log.promoName, showName))
  );
  const days = new Set(logs.map((log) => log.date)).size;
  const minutes = logs.reduce((sum, log) => sum + log.outputMinutes, 0);
  return {
    days: days ? String(days) : "—",
    minutes: minutes ? String(Math.round(minutes)) : "—",
  };
}

function qualityFor(snap: OpsSnapshot, name: string, promoId: string): string {
  const reviews = qualityForAnimator(snap, name).filter(
    (review) => review.promoId === promoId || review.promoId.split("#")[0] === promoId.split("#")[0]
  );
  const scores = reviews
    .map((review) => review.animation?.overallQuality)
    .filter((score): score is number => score != null);
  if (!scores.length) return "—";
  return `${scores[scores.length - 1]}/5`;
}

/** Production Tracker artist joined to that show on the Animation productivity sheet. */
function personWorkTable(snap: OpsSnapshot, name: string): AskTable {
  const rows: string[][] = [];
  const seen = new Set<string>();
  for (const part of snap.parts) {
    const names = `${part.artist ?? ""}, ${part.editors ?? ""}`
      .split(/[,，;/]|&| and /i)
      .map((item) => item.trim())
      .filter((item) => samePerson(item, name));
    if (!names.length) continue;
    const promo = snap.promos.find((item) => item.id === part.promoId || item.id.split("#")[0] === part.promoId);
    const show = promo?.showName || part.promoId.split("|")[0] || "—";
    const script = promo?.promoName || part.promoId.split("|")[1] || "—";
    const key = `${show}|${script}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const work = productivityFor(snap, name, show, script);
    rows.push([
      show,
      script || "—",
      STAGE_LABEL[part.stage] ?? part.stage,
      plotDate(part) ? formatDmy(plotDate(part)) : "—",
      work.days,
      work.minutes,
      qualityFor(snap, name, part.promoId),
    ]);
  }
  return {
    columns: ["Show", "Promo", "Stage", "Plot", "Days", "Minutes", "Quality"],
    rows: rows.slice(0, 8),
    title: "Matched to the productivity sheet",
  };
}

/** Quality reviews for this person, including promos that are already delivered. */
function personFeedbackTable(snap: OpsSnapshot, name: string): AskTable {
  const rows = qualityForAnimator(snap, name).map((review) => {
    const promo = promoFor(snap, review.promoId);
    const note = review.animation?.remark || review.animation?.weakAreas || review.editing?.remark || "—";
    return [
      promo?.showName || review.promoId.split("|")[0] || "—",
      promo?.promoName || "—",
      `P${review.partNo}`,
      review.animation?.overallQuality != null ? `${review.animation.overallQuality}/5` : "—",
      note.length > 140 ? `${note.slice(0, 140)}…` : note,
    ];
  });
  return {
    title: "Feedback, including older promos",
    columns: ["Show", "Promo", "Part", "Rating", "Feedback"],
    rows: rows.slice(0, 12),
  };
}

function promoWorkTable(snap: OpsSnapshot, promo: Promo): AskTable {
  const base = promo.id.split("#")[0];
  const parts = snap.parts
    .filter((part) => part.promoId === base || part.promoId.split("#")[0] === base)
    .filter((part) => part.stage !== "delivered" && part.team !== "agency")
    .sort((a, b) => a.partNo - b.partNo);
  const rows = parts.map((part) => {
    const artist = part.artist?.trim() || "—";
    const work = artist === "—" ? { days: "—", minutes: "—" } : productivityFor(snap, artist, promo.showName, promo.promoName);
    return [
      `P${part.partNo}`,
      artist,
      part.team === "agency" ? "Agency" : "In house",
      STAGE_LABEL[part.stage] ?? part.stage,
      plotDate(part) ? formatDmy(plotDate(part)) : "—",
      work.days,
      work.minutes,
      artist === "—" ? "—" : qualityFor(snap, artist, promo.id),
    ];
  });
  return {
    columns: ["Part", "Artist", "Team", "Stage", "Plot", "Days", "Minutes", "Quality"],
    rows,
    title: "Parts and the productivity logged for each artist",
  };
}

const RECENT_FEEDBACK_PROMOS = 3;

function onLeaveToday(snap: OpsSnapshot, name: string): boolean {
  return /leave/i.test(animatorToday(snap, name));
}

function holdPromo(title: string): string {
  return title.replace(/\s*·\s*P\d+$/, "");
}

function plotLinesForPerson(snap: OpsSnapshot, name: string): string[] {
  const lines: string[] = [];
  const placements = teamGroups(snap).flatMap((group) =>
    group.people
      .filter((person) => norm(person.name) === norm(name))
      .map((person) => ({ group: group.label, person }))
  );
  const open = placements.filter((place) => place.person.holds.length > 0);
  if (open.length === 0) {
    lines.push(`${name} is not plotted on an open part.`);
    return lines;
  }
  for (const place of open) {
    if (place.group !== "Animation" && place.group !== "Agency") continue;
    const buckets = new Map<string, { promo: string; until: string | null; doing: string; parts: number[] }>();
    for (const hold of place.person.holds) {
      const partNo = Number(hold.title.match(/P(\d+)$/)?.[1]);
      const promo = holdPromo(hold.title);
      const key = `${promo}|${hold.until ?? ""}|${hold.doing}`;
      const bucket = buckets.get(key) ?? { promo, until: hold.until, doing: hold.doing, parts: [] };
      if (!Number.isNaN(partNo)) bucket.parts.push(partNo);
      buckets.set(key, bucket);
    }
    for (const bucket of buckets.values()) {
      const when = bucket.until ? formatDmy(bucket.until) : "no plotted date";
      const same =
        bucket.parts.length > 1
          ? `Parts ${formatPartList(bucket.parts)} of ${bucket.promo} share ${when}`
          : `Part ${bucket.parts[0] ?? "—"} of ${bucket.promo} is on ${when}`;
      const late =
        bucket.until && bucket.until < snap.today
          ? ` Should already be free since ${when}, still on ${bucket.promo}.`
          : "";
      lines.push(`${same}. ${bucket.doing}.${late}`);
    }
  }
  if (lines.length === 0) lines.push(`${name} is not plotted on an open in-house part.`);
  return lines;
}

function whenFreeLines(snap: OpsSnapshot, name: string): string[] {
  const today = animatorToday(snap, name);
  const animation = teamGroups(snap).find((group) => group.id === "animation");
  const person = animation?.people.find((row) => norm(row.name) === norm(name));
  const holds = person?.holds ?? [];
  const lines: string[] = [];
  if (onLeaveToday(snap, name)) lines.push(`${name} is on leave today (${today}).`);
  if (holds.length === 0) {
    lines.push(onLeaveToday(snap, name) ? `${name} has no open plot — free for work after leave.` : `${name} is free now.`);
    return lines;
  }
  const overdue = holds.filter((hold) => hold.until && hold.until < snap.today);
  const upcoming = holds.filter((hold) => !hold.until || hold.until >= snap.today);
  for (const hold of overdue) {
    lines.push(
      `Should already be free since ${formatDmy(hold.until)}, still on ${holdPromo(hold.title)}.`
    );
  }
  const last = upcoming
    .map((hold) => hold.until)
    .filter((date): date is string => !!date)
    .sort()
    .at(-1);
  if (last) {
    const promo = holdPromo(upcoming.find((hold) => hold.until === last)?.title ?? holds[0].title);
    lines.push(`Free after ${formatDmy(last)} (${promo}).`);
  } else if (!overdue.length) {
    lines.push(`${name} is plotted with no date on the sheet.`);
  }
  return lines;
}

function latestRatingLine(snap: OpsSnapshot, name: string): string | null {
  const reviews = qualityForAnimator(snap, name);
  for (let i = reviews.length - 1; i >= 0; i--) {
    const score = reviews[i]?.animation?.overallQuality;
    if (score != null) {
      const promo = promoFor(snap, reviews[i].promoId);
      const title = promo ? `${promo.showName} · ${promo.promoName}` : reviews[i].promoId;
      return `Latest rating ${score}/5 on ${title} P${reviews[i].partNo}.`;
    }
  }
  return null;
}

function feedbackForPerson(snap: OpsSnapshot, name: string): { recent: string[]; older: string[] } {
  const reviews = qualityForAnimator(snap, name);
  const order: string[] = [];
  for (const review of reviews) {
    const key = review.promoId.split("#")[0];
    if (!order.includes(key)) order.push(key);
  }
  const recentIds = new Set(order.slice(-RECENT_FEEDBACK_PROMOS));
  const recent = feedbackLines(
    snap,
    reviews.filter((review) => recentIds.has(review.promoId.split("#")[0])),
    "animation"
  );
  const olderReviews = reviews.filter((review) => !recentIds.has(review.promoId.split("#")[0]));
  const olderTitles = [
    ...new Set(
      olderReviews.map((review) => {
        const promo = promoFor(snap, review.promoId);
        return promo ? `${promo.showName} · ${promo.promoName}` : review.promoId.split("|")[0];
      })
    ),
  ];
  const olderNotes = olderReviews
    .map((review) => (review.animation?.remark || review.animation?.weakAreas || review.editing?.remark || "").trim())
    .filter(Boolean);
  const older =
    olderTitles.length === 0
      ? []
      : [
          `Older promos: ${olderTitles.join("; ")}.${
            olderNotes.length ? ` Repeated notes: ${olderNotes.slice(0, 2).map((note) => (note.length > 160 ? `${note.slice(0, 160)}…` : note)).join(" ")}` : ""
          }`,
        ];
  return { recent, older };
}

function answerPerson(snap: OpsSnapshot, name: string, intent: AskIntent): { lines: string[]; tables?: AskTable[] } {
  if (intent === "person_promo") {
    const plots = plotLinesForPerson(snap, name);
    return {
      lines:
        plots[0]?.includes("not plotted")
          ? [`${name} is not on an open promo.`]
          : plots,
    };
  }
  if (intent === "person_when_free") {
    const lines = [...plotLinesForPerson(snap, name), ...whenFreeLines(snap, name)];
    return { lines: [...new Set(lines)] };
  }
  if (intent === "person_plot") return { lines: plotLinesForPerson(snap, name) };
  if (intent === "person_rating_feedback") {
    const lines: string[] = [];
    const rating = latestRatingLine(snap, name);
    if (rating) lines.push(rating);
    const { recent, older } = feedbackForPerson(snap, name);
    if (recent.length) {
      lines.push("Recent feedback:");
      lines.push(...recent.slice(0, 6));
    }
    lines.push(...older);
    if (lines.length === 0) lines.push(`No rating or written feedback for ${name} on recent promos.`);
    const table = personFeedbackTable(snap, name);
    const recentRows = table.rows.slice(0, 6);
    return { lines, tables: recentRows.length ? [{ ...table, rows: recentRows, title: "Recent feedback" }] : undefined };
  }
  if (intent === "productivity") {
    const lines = [
      ...productivityLines(snap, name).filter((line) => !/min\/day/i.test(line)),
      ...workedDaysLines(snap, name),
    ];
    return { lines: lines.length ? lines : [`No productivity rows for ${name}.`] };
  }

  const plots = plotLinesForPerson(snap, name);
  const lines: string[] = [...plots];
  for (const line of whenFreeLines(snap, name)) {
    if (!lines.includes(line)) lines.push(line);
  }
  const rating = latestRatingLine(snap, name);
  if (rating) lines.push(rating);
  const { recent, older } = feedbackForPerson(snap, name);
  if (recent.length) {
    lines.push("Recent feedback:");
    lines.push(...recent.slice(0, 4));
  }
  lines.push(...older);
  const today = animatorToday(snap, name);
  if (today !== "—") lines.push(`${name} is marked ${today} today.`);
  const leaves = animatorLeave(snap, name);
  if (leaves) lines.push(`Leave this month: ${leaves}.`);
  const tables = [personWorkTable(snap, name), personFeedbackTable(snap, name)].filter((table) => table.rows.length > 0);
  return { lines: [...new Set(lines)], tables: tables.length ? tables : undefined };
}

/** Compresses a sorted list of ISO dates into "3, 4, 5 Nov" style runs, split by month. */
function formatDateList(dates: string[]): string {
  const sorted = [...new Set(dates)].sort();
  const byMonth = new Map<string, number[]>();
  for (const iso of sorted) {
    const [, month, day] = iso.split("-");
    const label = new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
    const key = `${label}`;
    const list = byMonth.get(key) ?? [];
    list.push(Number(day));
    byMonth.set(key, list);
    void month;
  }
  const chunks: string[] = [];
  for (const [month, days] of byMonth) {
    chunks.push(`${formatPartList(days)} ${month}`);
  }
  return chunks.join(", ");
}

/** Worked days from the Animation productivity daily log, with a Production Tracker fallback. */
function workedDaysLines(snap: OpsSnapshot, name: string): string[] {
  const logs = snap.dailyLogs
    .filter((log) => samePerson(log.artist, name))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (logs.length > 0) {
    const byShow = new Map<string, { show: string; promo: string; dates: string[]; minutes: number }>();
    for (const log of logs) {
      const key = `${log.showName}|${log.promoName}`;
      const bucket = byShow.get(key) ?? { show: log.showName, promo: log.promoName, dates: [], minutes: 0 };
      bucket.dates.push(log.date);
      bucket.minutes += log.outputMinutes || 0;
      byShow.set(key, bucket);
    }
    const allDates = [...new Set(logs.map((log) => log.date))];
    const lines = [
      `${name} has ${allDates.length} logged work day${allDates.length === 1 ? "" : "s"} on the Animation productivity sheet: ${formatDateList(allDates)}.`,
    ];
    for (const bucket of byShow.values()) {
      const title = bucket.promo ? `${bucket.show} · ${bucket.promo}` : bucket.show;
      lines.push(
        `${title}: ${bucket.dates.length} day${bucket.dates.length === 1 ? "" : "s"} (${formatDateList(bucket.dates)}), ${Math.round(bucket.minutes)} min.`
      );
    }
    return lines;
  }
  // Fallback: the Animation productivity sheet is empty, so read activity off the parts this person holds.
  const events = new Map<string, string>();
  for (const part of snap.parts) {
    const names = `${part.artist ?? ""}, ${part.editors ?? ""}`.split(/[,，;/]|&| and /i).map((item) => item.trim());
    if (!names.some((item) => samePerson(item, name))) continue;
    for (const date of [part.aniStartDate, part.aniCloseDate, part.plannedPlottedDate]) {
      if (!date) continue;
      const promo = snap.promos.find((item) => item.id === part.promoId || item.id.split("#")[0] === part.promoId);
      events.set(date, promo?.showName || part.promoId.split("|")[0] || "—");
    }
  }
  if (events.size === 0) return [`No daily log or plotted dates found for ${name}.`];
  const dates = [...events.keys()].sort();
  return [
    `The Animation productivity sheet has no rows for ${name} yet, so this is from the Production Tracker's start, close, and plot dates instead.`,
    `Active on: ${formatDateList(dates)} (${dates.length} date${dates.length === 1 ? "" : "s"}).`,
  ];
}

function productivityLines(snap: OpsSnapshot, name: string): string[] {
  const person = animatorProductivity(snap).find((row) => norm(row.name) === norm(name));
  const lines: string[] = [];
  if (!person) {
    lines.push(`No productivity row for ${name}.`);
    return lines;
  }
  lines.push(
    `Productivity: ${person.openParts} open part${person.openParts === 1 ? "" : "s"}, ${person.deliveredParts} delivered.`
  );
  if (person.daysWorked > 0) {
    lines.push(
      `Animation productivity sheet: ${person.daysWorked} day${person.daysWorked === 1 ? "" : "s"} logged.`
    );
  } else {
    lines.push("The Animation productivity sheet has no daily rows for this name.");
  }
  if (person.avgDelay != null) {
    lines.push(`Average delay against the rough-cut plan is ${person.avgDelay} day${person.avgDelay === 1 ? "" : "s"}.`);
  }
  const notes = snap.dailyLogs
    .filter((log) => norm(log.artist) === norm(name) && log.remarks?.trim())
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  for (const note of notes) {
    lines.push(`Daily note ${formatDmy(note.date)}: ${note.remarks}`);
  }
  const profile = durationProfile(snap, name);
  if (profile.totalRangedDays > 0) {
    const trendText =
      profile.trend === "up"
        ? " Trending up — recent days have moved to a more productive range than earlier days."
        : profile.trend === "down"
          ? " Trending down — recent days have moved to a less productive range than earlier days."
          : "";
    lines.push(
      `${typicalRangeLine(profile)}${trendText}`
    );
  }
  return lines;
}

function feedbackLines(snap: OpsSnapshot, reviews: QualityReview[], kind: "animation" | "edit"): string[] {
  return reviews.flatMap((review) => {
    const block = kind === "animation" ? review.animation : review.editing;
    // Same fallback order as personFeedbackTable: a note can land under editing.remark even on a
    // review matched by animator, so check it too before calling feedback "missing".
    const bits = [
      block?.remark,
      kind === "animation" ? review.animation?.weakAreas : null,
      kind === "animation" ? review.editing?.remark : null,
    ].filter((bit): bit is string => !!bit && bit.trim().length > 0);
    const score = kind === "animation" ? review.animation?.overallQuality : null;
    if (bits.length === 0 && score == null) return [];
    const promo = promoFor(snap, review.promoId);
    const title = promo
      ? `${promo.showName}${promo.promoName ? ` · ${promo.promoName}` : ""}`
      : review.promoId.replace("|", " · ");
    const pass = review.versionCorrection ? ` ${review.versionCorrection}` : "";
    const rated = score != null ? ` Rating ${score}/5.` : "";
    const text = bits.length ? ` ${bits.join(" ")}` : "";
    return [`${title}, part ${review.partNo}${pass}.${rated}${text}`];
  });
}

function powerStartFacts(snap: OpsSnapshot, promo: Promo): string[] {
  const row = findDuration(snap, promo.id);
  const title = promo.promoName ? `${promo.showName} · ${promo.promoName}` : promo.showName;
  if (!row) return [`The Duration tab has no row for ${title}.`];
  if (row.powerStarts.length === 0) {
    return [
      `No power start is filled for ${title}. Total duration is ${formatClock(row.totalSec)}.`,
    ];
  }
  const each = row.powerStarts
    .map((start) => {
      const length = start.lengthSec == null ? "unknown" : `${start.lengthSec} sec`;
      return `${start.label} is ${length} (${formatClock(start.withCtaSec)} minus the CTA ${formatClock(row.workedWithCtaSec)})`;
    })
    .join("; ");
  return [
    `${title} has ${row.powerStarts.length} power start${row.powerStarts.length === 1 ? "" : "s"}, one for each filled PS column on the Duration tab.`,
    `Power start length is that column minus Worked duration with CTA. ${each}.`,
    `Total duration is ${formatClock(row.totalSec)}.`,
  ];
}

function wantsPowerStart(question: string): boolean {
  return /\bpower\s*starts?\b/i.test(question);
}

function answerPromo(snap: OpsSnapshot, promo: Promo, question = ""): string[] {
  const base = promo.id.split("#")[0];
  const includeAgency = /\bagency\b/i.test(question);
  const parts = snap.parts
    .filter((part) => part.promoId === base || part.promoId.split("#")[0] === base)
    .filter((part) => includeAgency || part.team !== "agency")
    .sort((a, b) => a.partNo - b.partNo);
  const title = promo.promoName ? `${promo.showName} · ${promo.promoName}` : promo.showName;
  if (parts.length === 0) {
    const status = promo.assetTeam?.assetsStatus || promo.preProd?.status;
    return [
      `${title} has no production parts yet.`,
      status ? `Pre-production status is ${status}.` : "It is not on the production tracker.",
      ...(wantsPowerStart(question) ? powerStartFacts(snap, promo) : []),
      ...sheetFacts(snap, promo),
    ];
  }
  const open = parts.filter((part) => part.stage !== "delivered");
  if (open.length === 0) {
    return [
      `${title} is closed. All ${parts.length} parts are delivered.`,
      ...whoAndDuration(snap, promo, parts),
      ...(wantsPowerStart(question) ? powerStartFacts(snap, promo) : []),
      ...sheetFacts(snap, promo),
    ];
  }

  const stages = [...new Set(open.map((part) => STAGE_LABEL[part.stage] ?? part.stage))];
  const lines = [
    `${title} has ${open.length} open part${open.length === 1 ? "" : "s"} out of ${parts.length}. Still in ${stages.join(", ")}.`,
  ];
  const buckets = new Map<string, { stage: string; team: string; who: string; date: string; parts: number[] }>();
  for (const part of open) {
    const date = plotDate(part) ?? "";
    const team = part.team === "agency" ? "Agency" : "In house";
    const who = part.artist?.trim() || "No artist";
    const stage = STAGE_LABEL[part.stage] ?? part.stage;
    const key = `${stage}|${team}|${who}|${date}`;
    const bucket = buckets.get(key) ?? { stage, team, who, date, parts: [] };
    bucket.parts.push(part.partNo);
    buckets.set(key, bucket);
  }
  for (const bucket of buckets.values()) {
    const partsLabel = bucket.parts.length > 1 ? `Parts ${formatPartList(bucket.parts)}` : `Part ${bucket.parts[0]}`;
    const when = bucket.date ? formatDmy(bucket.date) : "no plotted date";
    const shared = bucket.parts.length > 1 ? " are all on " : " is on ";
    lines.push(`${partsLabel} (${bucket.stage}, ${bucket.team}, ${bucket.who})${shared}${when}.`);
  }

  const dates = open.map(plotDate).filter((date): date is string => !!date).sort();
  const last = dates[dates.length - 1] ?? null;
  if (!last) {
    lines.push("The sheet has no plotted close date, so it does not say when this promo will finish.");
  } else if (last > snap.today) {
    const left = daysUntil(snap, last);
    lines.push(
      `The latest plotted date is ${formatDmy(last)}, ${left} day${left === 1 ? "" : "s"} from today. That is the close date on the sheet if the open parts finish on that plot.`
    );
  } else if (last === snap.today) {
    lines.push(`The latest plotted date is today, ${formatDmy(last)}. It is still open.`);
  } else {
    lines.push(`Should have closed on ${formatDmy(last)}, still open.`);
  }
  const remain = open.reduce((sum, part) => sum + (part.durationSec || 0), 0);
  if (remain > 0) lines.push(`Open parts still add up to ${formatDuration(remain)}.`);
  lines.push(...whoAndDuration(snap, promo, parts));
  if (wantsPowerStart(question)) lines.push(...powerStartFacts(snap, promo));
  lines.push(...sheetFacts(snap, promo));
  return lines;
}

/** Artists on the parts, and the Duration tab total. Power start is left out unless asked. */
function whoAndDuration(snap: OpsSnapshot, promo: Promo, parts: Part[]): string[] {
  const lines: string[] = [];
  const artists = [...new Set(parts.map((part) => part.artist?.trim()).filter((name): name is string => !!name))];
  if (artists.length) lines.push(`Worked on it: ${artists.join(", ")}.`);
  const row = findDuration(snap, promo.id);
  if (row?.totalSec != null && row.totalSec > 0) lines.push(`Total duration ${formatClock(row.totalSec)}.`);
  return lines;
}

function sheetFacts(snap: OpsSnapshot, promo: Promo): string[] {
  const lines: string[] = [];
  const tracker = [promo.trackerStatus, promo.priority, promo.cps ? `CPS ${promo.cps}` : ""]
    .filter(Boolean)
    .join(", ");
  if (tracker) lines.push(`Master Tracker: ${tracker}.`);
  if (promo.preProd?.status) lines.push(`Pre Production Tracker: ${promo.preProd.status}.`);
  if (promo.assetTeam?.assetsStatus) lines.push(`Assets Master: ${promo.assetTeam.assetsStatus}.`);
  const master = [promo.masterStage && `stage ${promo.masterStage}`, promo.canvasStatus && `canvas ${promo.canvasStatus}`, promo.paymentStatus && `payment ${promo.paymentStatus}`]
    .filter(Boolean)
    .join(", ");
  if (master) lines.push(`Dashverse Master Sheet: ${master}.`);
  if (promo.creditUsage) {
    const credit = promo.creditUsage;
    const compare = creditCompare(snap, promo.id, credit);
    const inHouseBit =
      compare.inHousePerMin != null
        ? `, ${formatPerMin(compare.inHousePerMin)} on in-house minutes`
        : "";
    lines.push(
      `In-house credits (PFM … Promo): videos ${formatCredits(credit.videos)}, LLM ${formatCredits(credit.llm)}, images ${formatCredits(credit.images)}, total ${formatCredits(credit.totalCredits)}${inHouseBit}.`
    );
    if (compare.agencyMin && compare.agencyMin > 0) {
      lines.push(
        `Agency is paid per min, not credits: ${Number(compare.agencyMin.toFixed(1))} min${compare.agencyPayPerMin != null ? ` at ${formatUsd(compare.agencyPayPerMin)}/min` : ""}${compare.agencyPay != null ? ` = ${formatUsd(compare.agencyPay)}` : ""}.`
      );
    }
  }
  const base = promo.id.split("#")[0];
  const plans = snap.plannerCells
    .filter((cell) => cell.promoId === promo.id || cell.promoId.split("#")[0] === base)
    .filter((cell) => cell.date && cell.text)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);
  if (plans.length) {
    lines.push(
      `Planner: ${plans
        .map((cell) => `${cell.partNo === 0 ? "asset" : `part ${cell.partNo}`} ${cell.text} on ${formatDmy(cell.date)}`)
        .join("; ")}.`
    );
  }
  return lines;
}

const SHEET_GUIDE = [
  "Master Tracker, on PFM_dashboard_Timeline: the promo list, status, priority, and CPS.",
  "Production Tracker: each part, its stage, in-house or agency, artist, editor, and plotted date.",
  "Pre Production Tracker: the asset plan, status, artist, and start date.",
  "Promos - Assets Master Sheet: the asset team's own status. The calendar keeps a promo only when this is WIP.",
  "Master Productivity: CPS rating and written feedback. This is separate from how many minutes someone worked.",
  "Animation productivity, Master data: one row per artist per day. Date, artist, show, promo, parts worked, and duration worked that day — under 3 min (low), 3-5 min (avg), 5-7 min (high), more than 7 min (highly productive), or correction (ignored).",
  "Dashverse Master Sheet: canvas, delivery files, script links, cost, and payment.",
  "Credit Consumption Analysis, PFM tab: only PFM … Promo rows. In-house: video, LLM, image credits vs in-house minutes. Agency: paid per min from Master Sheet Per Min × agency minutes on Production Tracker. Dashboard only — not copied into Timeline.",
  "Planner tab: the revised date, and first half, second half, or EOD.",
  "Remarks tab: every time a plan is recorded, kept as its own row.",
];

function animationPeople(snap: OpsSnapshot) {
  return teamGroups(snap).find((group) => group.id === "animation")?.people ?? [];
}

function agencyPeople(snap: OpsSnapshot) {
  return teamGroups(snap).find((group) => group.id === "agency")?.people ?? [];
}

function availabilityReply(snap: OpsSnapshot, agency: boolean): AskReply {
  const people = agency ? agencyPeople(snap) : animationPeople(snap);
  const free: string[] = [];
  const leave: string[] = [];
  const plotted: string[] = [];
  const overdue: string[] = [];
  for (const person of people) {
    const off = onLeaveToday(snap, person.name);
    if (off) leave.push(`${person.name} (${animatorToday(snap, person.name)})`);
    const lateHolds = person.holds.filter((hold) => hold.until && hold.until < snap.today);
    const futureHolds = person.holds.filter((hold) => !hold.until || hold.until >= snap.today);
    if (lateHolds.length) {
      overdue.push(
        `${person.name} — ${lateHolds.map((hold) => `${holdPromo(hold.title)} since ${formatDmy(hold.until)}`).join("; ")}`
      );
    }
    if (futureHolds.length) {
      const last = futureHolds
        .map((hold) => hold.until)
        .filter((date): date is string => !!date)
        .sort()
        .at(-1);
      plotted.push(last ? `${person.name} until ${formatDmy(last)}` : person.name);
    }
    if (person.holds.length === 0 && !off) free.push(person.name);
  }
  const who = agency ? "Agency" : "In-house animators";
  const lines = [
    `${who} free for new work: ${free.length ? free.join(", ") : "nobody"}.`,
    `On leave today: ${leave.length ? leave.join("; ") : "nobody"}.`,
    `Still plotted: ${plotted.length ? plotted.join("; ") : "nobody"}.`,
    `Should be free / overdue: ${overdue.length ? overdue.join("; ") : "nobody"}.`,
  ];
  if (!agency) lines.push("Want agency availability as well?");
  return { heading: agency ? "Agency availability" : "Animator availability", lines, intent: agency ? "agency_availability" : "availability" };
}

function openPromoRows(snap: OpsSnapshot, includeAgency: boolean) {
  const seen = new Set<string>();
  const rows: { promo: Promo; parts: Part[]; last: string | null; overdue: boolean }[] = [];
  for (const promo of snap.promos) {
    const base = promo.id.split("#")[0];
    if (seen.has(base)) continue;
    const parts = snap.parts
      .filter((part) => (part.promoId === base || part.promoId.split("#")[0] === base) && part.stage !== "delivered")
      .filter((part) => includeAgency || part.team !== "agency");
    if (parts.length === 0) continue;
    seen.add(base);
    const dates = parts.map(plotDate).filter((date): date is string => !!date).sort();
    const last = dates.at(-1) ?? null;
    rows.push({ promo, parts, last, overdue: !!last && last < snap.today });
  }
  return rows;
}

function openPromosReply(snap: OpsSnapshot): AskReply {
  const rows = openPromoRows(snap, false);
  const lines = rows.length
    ? rows.map((row) => {
        const title = row.promo.promoName ? `${row.promo.showName} · ${row.promo.promoName}` : row.promo.showName;
        const stages = [...new Set(row.parts.map((part) => STAGE_LABEL[part.stage] ?? part.stage))].join(", ");
        const who = [...new Set(row.parts.map((part) => part.artist?.trim()).filter(Boolean))].join(", ") || "unassigned";
        if (!row.last) return `${title}: ${row.parts.length} open part(s), ${stages}, ${who}. No plotted close date.`;
        if (row.overdue) return `${title}: ${row.parts.length} open part(s), ${stages}, ${who}. Should have closed on ${formatDmy(row.last)}, still open.`;
        return `${title}: ${row.parts.length} open part(s), ${stages}, ${who}. Plotted ${formatDmy(row.last)}.`;
      })
    : ["No in-house production parts are open."];
  return { heading: "Current promos", lines, intent: "open_promos" };
}

function deliveryReply(snap: OpsSnapshot): AskReply {
  const rows = openPromoRows(snap, false);
  const lines = rows.length
    ? rows.map((row) => {
        const title = row.promo.promoName ? `${row.promo.showName} · ${row.promo.promoName}` : row.promo.showName;
        if (!row.last) return `${title}: no plotted close date.`;
        if (row.overdue) return `${title}: should have closed on ${formatDmy(row.last)}, still open.`;
        const left = daysUntil(snap, row.last);
        return `${title}: plotted ${formatDmy(row.last)} (${left} day${left === 1 ? "" : "s"} left).`;
      })
    : ["No in-house open promos to deliver."];
  return { heading: "Delivery dates", lines, intent: "delivery" };
}

function capacityReply(snap: OpsSnapshot): AskReply {
  const availability = availabilityReply(snap, false);
  return {
    heading: "When new promos can start",
    lines: [
      ...availability.lines,
      "New in-house work can go to anyone in the free-for-new-work list. Overdue people should already be free but are still on an open part.",
    ],
    intent: "capacity",
  };
}

function coveringLine(snap: OpsSnapshot, name: string): string {
  const profile = durationProfile(snap, name);
  if (profile.totalRangedDays === 0) return `${name}: no Duration worked/day rows yet.`;
  const trendText =
    profile.trend === "up"
      ? " Recent days have moved to a more productive range."
      : profile.trend === "down"
        ? " Recent days have moved to a less productive range."
        : "";
  return `${name}: ${typicalRangeLine(profile)}${trendText}`;
}

function productivityPeopleReply(snap: OpsSnapshot, names: string[]): AskReply {
  const lines = names.map((name) => coveringLine(snap, name));
  const tableRows = names.map((name) => {
    const profile = durationProfile(snap, name);
    return [
      name,
      profile.typicalRange
        ? `${DURATION_WORKED_BUCKETS[profile.typicalRange].label} (${DURATION_WORKED_BUCKETS[profile.typicalRange].tier})`
        : "—",
      String(profile.totalRangedDays),
      ...DURATION_BUCKET_ORDER.map((bucket) => `${profile.counts[bucket]}`),
    ];
  });
  return {
    heading: names.length === 1 ? names[0] : "Productivity",
    lines,
    tables: [
      {
        title: "Duration worked/day — how much they cover each day",
        columns: ["Artist", "Typical day", "Days", "<3 min", "3-5 min", "5-7 min", ">7 min"],
        rows: tableRows,
      },
    ],
    intent: "productivity",
    people: names,
    focus: names.length === 1 ? { kind: "person", id: names[0], label: names[0] } : undefined,
  };
}

function peopleReply(snap: OpsSnapshot, names: string[], intent: AskIntent): AskReply {
  if (intent === "productivity") return productivityPeopleReply(snap, names);
  if (names.length === 1) {
    return { ...replyFor(snap, { kind: "person", id: names[0], label: names[0] }, "", intent), people: names };
  }
  const personIntent: AskIntent = intent.startsWith("person") ? intent : "person_full";
  const lines: string[] = [];
  const tables: AskTable[] = [];
  for (const name of names) {
    const answered = answerPerson(snap, name, personIntent);
    lines.push(`${name}: ${answered.lines.join(" ")}`);
    for (const table of answered.tables ?? []) {
      tables.push({ ...table, title: `${name} · ${table.title ?? "Details"}` });
    }
  }
  return {
    heading: names.join(", "),
    lines,
    tables: tables.length ? tables : undefined,
    intent: personIntent,
    people: names,
  };
}

function productivityAllReply(snap: OpsSnapshot): AskReply {
  const names = animationPeople(snap).map((person) => person.name);
  const ranked = durationRanking(snap).filter((row) => names.some((name) => norm(name) === norm(row.name)));
  return productivityPeopleReply(
    snap,
    ranked.length ? ranked.map((row) => row.name) : names
  );
}

function isoDiffDays(start: string, end: string, snap: OpsSnapshot): number {
  return daysLate(start, end, snap);
}

function avgPromoTimeReply(snap: OpsSnapshot): AskReply {
  const groups = new Map<string, Part[]>();
  for (const part of snap.parts) {
    if (part.team === "agency") continue;
    const base = part.promoId.split("#")[0];
    const list = groups.get(base) ?? [];
    list.push(part);
    groups.set(base, list);
  }
  const durations: number[] = [];
  for (const parts of groups.values()) {
    if (!parts.length || parts.some((part) => part.stage !== "delivered")) continue;
    const starts = parts.map((part) => part.aniStartDate).filter((date): date is string => !!date).sort();
    const ends = parts
      .map((part) => part.soundEndDate || part.aniCloseDate || part.editCloseDate)
      .filter((date): date is string => !!date)
      .sort();
    if (!starts.length || !ends.length) continue;
    const days = isoDiffDays(starts[0], ends[ends.length - 1], snap);
    if (days >= 0) durations.push(days);
  }
  if (!durations.length) {
    return {
      heading: "Average promo time",
      lines: ["Not enough closed in-house promos with start and close dates to average."],
      intent: "avg_promo_time",
    };
  }
  const avg = Math.round(durations.reduce((sum, n) => sum + n, 0) / durations.length);
  return {
    heading: "Average promo time",
    lines: [
      `Closed in-house promos average ${avg} day${avg === 1 ? "" : "s"} from animation start to close (${durations.length} promo${durations.length === 1 ? "" : "s"}).`,
    ],
    intent: "avg_promo_time",
  };
}

function leaveReply(snap: OpsSnapshot): AskReply {
  const names = animationPeople(snap).map((person) => person.name);
  const rows = names.map((name) => [name, animatorToday(snap, name), animatorLeave(snap, name) || "—"]);
  const working = rows.filter((row) => /^working$/i.test(row[1])).map((row) => row[0]);
  const leave = rows.filter((row) => /leave/i.test(row[1]));
  const lines = [
    working.length ? `Working today: ${working.join(", ")}.` : "Nobody is marked Working today.",
    leave.length ? `On leave today: ${leave.map((row) => `${row[0]} (${row[1]})`).join("; ")}.` : "Nobody on leave today.",
  ];
  return {
    heading: "Attendance today",
    lines,
    tables: [{ title: "Attendance", columns: ["Animator", "Today", "Leave"], rows }],
    intent: "leave",
  };
}

function rankedChoices(snap: OpsSnapshot, question: string): { score: number; choice: AskChoice }[] {
  const found: { score: number; choice: AskChoice }[] = [];
  for (const name of uniqueNames(snap)) {
    const score = nameScore(question, name);
    if (score >= 55) found.push({ score, choice: { kind: "person", id: name, label: name } });
  }
  const seen = new Set<string>();
  for (const promo of snap.promos) {
    const base = promo.id.split("#")[0];
    if (seen.has(base)) continue;
    seen.add(base);
    const score = Math.max(
      nameScore(question, promo.showName),
      nameScore(question, promo.promoName),
      nameScore(question, `${promo.showName} ${promo.promoName}`)
    );
    if (score < 55) continue;
    const label = promo.promoName ? `${promo.showName} · ${promo.promoName}` : promo.showName;
    found.push({ score, choice: { kind: "promo", id: promo.id, label } });
  }
  return found.sort((a, b) => b.score - a.score || a.choice.label.localeCompare(b.choice.label));
}

function replyFor(snap: OpsSnapshot, choice: AskChoice, question = "", intent: AskIntent = "person_full"): AskReply {
  if (choice.kind === "person") {
    const personIntent: AskIntent = intent.startsWith("person") || intent === "productivity" ? intent : "person_full";
    const answered = answerPerson(snap, choice.id, personIntent);
    return {
      heading: choice.label,
      lines: answered.lines,
      table: answered.tables?.[0],
      tables: answered.tables,
      focus: choice,
      intent: personIntent,
      people: [choice.id],
    };
  }
  const promo = snap.promos.find((item) => item.id === choice.id);
  if (!promo) return { heading: choice.label, lines: ["That promo is not on the sheets."], intent: "promo_status" };
  const table = promoWorkTable(snap, promo);
  const promoIntent: AskIntent = intent === "promo_close" ? "promo_close" : "promo_status";
  return {
    heading: promo.showName || choice.label,
    lines: answerPromo(snap, promo, question),
    table: table.rows.length ? table : undefined,
    focus: choice,
    intent: promoIntent,
  };
}

const PERSON_INTENTS: AskIntent[] = [
  "person_plot",
  "person_when_free",
  "person_promo",
  "person_rating_feedback",
  "person_full",
];

function hasPronoun(question: string): boolean {
  return /\b(she|he|her|him|they|them|their)\b/i.test(question);
}

function detectIntent(question: string, lastIntent?: AskIntent | null): AskIntent {
  const q = question.toLowerCase();
  if (/\bagency\b/.test(q) && /\b(free|available|availability)\b/.test(q)) return "agency_availability";
  if (/\b(on leave|who is working|attendance)\b/.test(q) && !hasPronoun(q)) return "leave";
  if (/\bavg(erage)?\s*time\b|\bhow long\b.{0,40}\bpromo|\btime taking to complete\b|\bcomplete 1 promo\b|\bone promo\b/.test(q)) {
    return "avg_promo_time";
  }
  if (/\btake new promo|\bnew promos?\b|\bcapacity\b|\bwho can take\b/.test(q)) return "capacity";
  if (
    /\bproductiv|\btypical range\b|\bduration worked\b|\beach day\b.{0,40}\bcover|\bhow muchj?\b.{0,24}\bcover|\bwho (is |are )?(more |most )?productive\b/.test(
      q
    )
  ) {
    return "productivity";
  }
  if (/\bquick status\b|\bcurrent promo|\bwhat( is|'s)? open\b|\bstatus of (the )?(current )?promos?\b/.test(q)) {
    return "open_promos";
  }
  if (/\bwhen will.{0,30}(deliver|close)|\bdelivering the promo|\bwhen.{0,20}promos?.{0,16}(close|deliver)/.test(q)) {
    return "delivery";
  }
  if (
    !hasPronoun(q) &&
    (/\bwho is free\b/.test(q) ||
      /\banimators?\b/.test(q) && /\b(free|available|availability)\b/.test(q) ||
      /\bavailability\b/.test(q) ||
      /\bwho( is|'s)? available\b/.test(q) ||
      (/\bfree\b/.test(q) && !/\bwhat about\b/.test(q)))
  ) {
    return "availability";
  }
  if (/\bsheet|spreadsheet|which tab|what do you (read|use)\b/.test(q)) return "sheets";
  if (/\bcredits?\b|\byield\b|\bcost in \$|\bcredit consumption\b/.test(q)) return "credits";

  if (/\bwhen.{0,16}(free|available)\b/.test(q)) return "person_when_free";
  if (/\bwhich promo\b|\bworking on\b|\bwhat promo\b|\bwhich show\b|\bshe is in\b|\bhe is in\b/.test(q)) return "person_promo";
  if (/\b(rating|feedback)\b/.test(q) && /\b(plotted|where)\b/.test(q)) return "person_full";
  if (/\b(rating|feedback)\b/.test(q)) return "person_rating_feedback";
  if (/\bplotted\b|\bwhere is\b/.test(q)) return "person_plot";
  if (/\bwhat about\b/.test(q) && lastIntent && PERSON_INTENTS.includes(lastIntent)) return lastIntent;
  if (hasPronoun(q) && lastIntent && PERSON_INTENTS.includes(lastIntent)) return lastIntent;
  if (/\btell me about\b|\boverview\b/.test(q)) return "person_full";
  if (/\bwhen\b/.test(q) && /\b(close|deliver|finish)\b/.test(q)) return "promo_close";
  return lastIntent ?? "person_full";
}

const TEAM_INTENTS: AskIntent[] = [
  "availability",
  "agency_availability",
  "leave",
  "open_promos",
  "delivery",
  "capacity",
  "productivity",
  "avg_promo_time",
  "credits",
  "sheets",
];

function teamReply(snap: OpsSnapshot, intent: AskIntent): AskReply {
  if (intent === "agency_availability") return availabilityReply(snap, true);
  if (intent === "availability") return availabilityReply(snap, false);
  if (intent === "leave") return leaveReply(snap);
  if (intent === "open_promos") return openPromosReply(snap);
  if (intent === "delivery") return deliveryReply(snap);
  if (intent === "capacity") return capacityReply(snap);
  if (intent === "productivity") return productivityAllReply(snap);
  if (intent === "avg_promo_time") return avgPromoTimeReply(snap);
  if (intent === "credits") return creditsReply(snap);
  return { heading: "Sheets I use", lines: SHEET_GUIDE, intent: "sheets" };
}

function creditsReply(snap: OpsSnapshot): AskReply {
  const rows = [...(snap.creditUsages ?? [])].sort((a, b) => (b.totalCredits ?? 0) - (a.totalCredits ?? 0));
  if (rows.length === 0) {
    return {
      heading: "Credits",
      lines: [
        "No PFM … Promo credit rows yet. Open Credits — it stays in the dashboard, not in your Timeline sheet.",
      ],
      intent: "credits",
    };
  }
  return {
    heading: "Promo credits",
    lines: [
      `${rows.length} PFM Promo row${rows.length === 1 ? "" : "s"}. In-house credits vs in-house minutes; agency is pay per min. Not written into your sheet.`,
    ],
    table: {
      title: "PFM Promo credits",
      columns: ["Promo", "Videos", "LLM", "Images", "In-house / min", "Agency pay"],
      rows: rows.slice(0, 12).map((row) => {
        const compare = creditCompare(snap, row.matchedPromoId, row);
        return [
          row.label,
          formatCredits(row.videos),
          formatCredits(row.llm),
          formatCredits(row.images),
          formatPerMin(compare.inHousePerMin),
          formatUsd(compare.agencyPay),
        ];
      }),
    },
    intent: "credits",
  };
}

/** Answer from the sheets already loaded in the dashboard. */
export function answerOps(
  snap: OpsSnapshot,
  question: string,
  pick?: AskChoice,
  follow?: AskChoice,
  lastIntent?: AskIntent | null,
  lastPeople?: string[]
): AskReply {
  const asked = question.trim();
  if (!asked && !pick) {
    return { heading: "Ask about the sheets", lines: ["Name an artist or a show."] };
  }
  const intent = detectIntent(asked, lastIntent);
  if (pick) return replyFor(snap, pick, asked, intent);

  let named = peopleInQuestion(snap, asked);
  if (!named.length && refersToListedPeople(asked) && lastPeople?.length) named = lastPeople;

  const personLike =
    intent === "productivity" || PERSON_INTENTS.includes(intent) || intent === "person_full";
  if (named.length >= 1 && (personLike || !TEAM_INTENTS.includes(intent))) {
    return peopleReply(snap, named, personLike ? intent : "person_full");
  }

  if (intent === "credits") {
    const rankedCredits = rankedChoices(snap, asked);
    const promoHit = rankedCredits.find((item) => item.choice.kind === "promo" && item.score >= 70);
    if (promoHit) return replyFor(snap, promoHit.choice, asked, "credits");
    return creditsReply(snap);
  }

  if (TEAM_INTENTS.includes(intent)) return teamReply(snap, intent);

  const ranked = rankedChoices(snap, asked);
  const best = ranked[0];
  const followUp = /\b(she|he|him|her|their|they|them|that|this|same|also|too|again|his|its|it's|what about|how about)\b/i.test(
    asked
  );
  if (follow && followUp) return { ...replyFor(snap, follow, asked, intent), people: follow.kind === "person" ? [follow.id] : lastPeople };

  if (best && best.choice.kind === "promo" && best.score >= 70) {
    const promoIntent: AskIntent = intent === "promo_close" || intent === "delivery" ? "promo_close" : "promo_status";
    return replyFor(snap, best.choice, asked, promoIntent);
  }
  if (!best) {
    if (lastPeople?.length && (refersToListedPeople(asked) || followUp)) {
      return peopleReply(snap, lastPeople, lastIntent && personLike ? lastIntent : "person_full");
    }
    if (intent === "sheets") return teamReply(snap, "sheets");
    if (TEAM_INTENTS.includes(intent)) return teamReply(snap, intent);
    return { heading: "Ask about the sheets", lines: ["Name the artists or the promo."], intent };
  }
  const peopleHits = ranked.filter((item) => item.choice.kind === "person" && item.score >= 70);
  if (peopleHits.length >= 2) {
    return peopleReply(
      snap,
      peopleHits.map((item) => item.choice.id),
      personLike ? intent : "person_full"
    );
  }
  const close = ranked.filter((item) => item.score >= best.score - 12);
  const exact = close.filter((item) => item.score >= 100);
  if (exact.length === 1) return replyFor(snap, exact[0].choice, asked, intent);
  return {
    heading: "Which one?",
    lines: [
      exact.length > 1
        ? "More than one promo matches. Select the one you mean."
        : `Nothing matches that spelling exactly. Select the closest: ${close[0]?.choice.label ?? ""}.`,
    ],
    choices: (exact.length > 1 ? exact : close).slice(0, 6).map((item) => item.choice),
    intent,
    people: lastPeople,
  };
}
