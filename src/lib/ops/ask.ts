import type { OpsSnapshot, Part, Promo, QualityReview } from "./types";
import {
  animatorProductivity,
  daysLate,
  formatDmy,
  formatDuration,
  promoFor,
  qualityForAnimator,
  qualityForEditor,
  STAGE_LABEL,
  teamGroups,
} from "./selectors";

export type AskChoice = {
  kind: "person" | "promo";
  id: string;
  label: string;
};

export type AskReply = {
  heading: string;
  lines: string[];
  /** More than one sheet row fits the question. The person picks one. */
  choices?: AskChoice[];
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

function daysUntil(today: string, date: string): number {
  const a = new Date(`${today}T00:00:00Z`).getTime();
  const b = new Date(`${date}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
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
  const matched = uniqueNames(snap).filter((name) => mentioned(question, name));
  return matched.filter((name) => {
    const key = norm(name);
    return !matched.some((other) => {
      const longer = norm(other);
      return longer.length > key.length && longer.startsWith(`${key} `) && norm(question).includes(longer);
    });
  });
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

/** 100 when the name is written out. Lower when only some words, or a spelling, match. */
function nameScore(question: string, name: string): number {
  const label = norm(name);
  if (label.length < 3) return 0;
  const asked = norm(question);
  if (asked.includes(label)) return 100;
  const words = asked.split(" ").filter((word) => word.length >= 3);
  const tokens = label.split(" ").filter((token) => token.length >= 3);
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

function answerPerson(snap: OpsSnapshot, name: string): string[] {
  const lines: string[] = [];
  const placements = teamGroups(snap).flatMap((group) =>
    group.people
      .filter((person) => norm(person.name) === norm(name))
      .map((person) => ({ group: group.label, person }))
  );
  const open = placements.filter((place) => place.person.holds.length > 0);
  if (open.length === 0) {
    lines.push(`${name} is not plotted on an open part. They show as free.`);
  } else {
    for (const place of open) {
      lines.push(`${name} is in ${place.group}.`);
      const buckets = new Map<string, { until: string | null; doing: string; parts: number[] }>();
      for (const hold of place.person.holds) {
        const partNo = Number(hold.title.match(/P(\d+)$/)?.[1]);
        const key = `${hold.until ?? ""}|${hold.doing}`;
        const bucket = buckets.get(key) ?? { until: hold.until, doing: hold.doing, parts: [] };
        if (!Number.isNaN(partNo)) bucket.parts.push(partNo);
        buckets.set(key, bucket);
      }
      for (const bucket of buckets.values()) {
        const when = bucket.until ? formatDmy(bucket.until) : "no plotted date";
        const same = bucket.parts.length > 1 ? `Parts ${formatPartList(bucket.parts)} share ${when}` : `Part ${bucket.parts[0] ?? "—"} is on ${when}`;
        const late =
          bucket.until && bucket.until < snap.today
            ? ` That day is ${daysLate(bucket.until, snap.today)} day${daysLate(bucket.until, snap.today) === 1 ? "" : "s"} past, and the work is still open.`
            : "";
        lines.push(`${same}. ${bucket.doing}.${late}`);
      }
    }
  }

  const reviews = qualityForAnimator(snap, name);
  const scores = reviews
    .map((review) => review.animation?.overallQuality)
    .filter((score): score is number => score != null);
  if (scores.length === 0) {
    lines.push(`Master Productivity has no animation rating for ${name}.`);
  } else {
    const average = Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10;
    lines.push(
      `Master Productivity rating is ${average}/5 across ${scores.length} review${scores.length === 1 ? "" : "s"}.`
    );
  }

  const notes = feedbackLines(snap, reviews, "animation");
  const editorNotes = feedbackLines(snap, qualityForEditor(snap, name), "edit");
  const allNotes = [...notes, ...editorNotes];
  if (allNotes.length === 0) {
    lines.push(`Master Productivity has no written feedback for ${name}.`);
  } else {
    lines.push("Feedback:");
    lines.push(...allNotes.slice(0, 6));
  }
  lines.push(...productivityLines(snap, name));
  return lines;
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
      `Animation productivity sheet: ${person.daysWorked} day${person.daysWorked === 1 ? "" : "s"}${
        person.minutesPerDay != null ? `, about ${person.minutesPerDay} min/day` : ""
      }.`
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
  return lines;
}

function feedbackLines(snap: OpsSnapshot, reviews: QualityReview[], kind: "animation" | "edit"): string[] {
  return reviews.flatMap((review) => {
    const block = kind === "animation" ? review.animation : review.editing;
    const bits = [block?.remark, kind === "animation" ? review.animation?.weakAreas : null].filter(
      (bit): bit is string => !!bit && bit.trim().length > 0
    );
    if (bits.length === 0 && block == null) return [];
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

function answerPromo(snap: OpsSnapshot, promo: Promo): string[] {
  const base = promo.id.split("#")[0];
  const parts = snap.parts
    .filter((part) => part.promoId === base || part.promoId.split("#")[0] === base)
    .sort((a, b) => a.partNo - b.partNo);
  const title = promo.promoName ? `${promo.showName} · ${promo.promoName}` : promo.showName;
  if (parts.length === 0) {
    const status = promo.assetTeam?.assetsStatus || promo.preProd?.status;
    return [
      `${title} has no production parts yet.`,
      status ? `Pre-production status is ${status}.` : "It is not on the production tracker.",
    ];
  }
  const open = parts.filter((part) => part.stage !== "delivered");
  if (open.length === 0) {
    return [`${title} is closed on the production sheet. All ${parts.length} parts are Delivered.`];
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
    const left = daysUntil(snap.today, last);
    lines.push(
      `The latest plotted date is ${formatDmy(last)}, ${left} day${left === 1 ? "" : "s"} from today. That is the close date on the sheet if the open parts finish on that plot.`
    );
  } else if (last === snap.today) {
    lines.push(`The latest plotted date is today, ${formatDmy(last)}. It is still open.`);
  } else {
    const late = daysLate(last, snap.today);
    lines.push(
      `The latest plotted date was ${formatDmy(last)}, ${late} day${late === 1 ? "" : "s"} ago. The parts are still open, so it has not closed. The sheet does not have a new close date.`
    );
  }
  const remain = open.reduce((sum, part) => sum + (part.durationSec || 0), 0);
  if (remain > 0) lines.push(`Open parts still add up to ${formatDuration(remain)} of duration.`);
  lines.push(...sheetFacts(snap, promo));
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
  "Animation productivity, Master data: one row per artist per day, with minutes and a remark. That file is not shared yet, so those minutes are empty.",
  "Dashverse Master Sheet: canvas, delivery files, script links, cost, and payment.",
  "Planner tab: the revised date, and first half, second half, or EOD.",
  "Remarks tab: every time a plan is recorded, kept as its own row.",
];

function answerSummary(snap: OpsSnapshot, question: string): AskReply {
  const groups = teamGroups(snap);
  const q = norm(question);
  const wantFree = /\bfree\b/.test(q);
  const wantLate = /\blate|delay|overdue|slipped\b/.test(q);
  const groupWanted = groups.find((group) => q.includes(norm(group.label)) || (group.id === "animation" && /\banimator|in house|inhouse\b/.test(q)));

  if (groupWanted && !wantFree && !wantLate) {
    const busy = groupWanted.people.filter((person) => person.holds.length > 0);
    const free = groupWanted.people.filter((person) => person.holds.length === 0);
    return {
      heading: groupWanted.label,
      lines: [
        busy.length
          ? `${busy.length} ${groupWanted.label} ${busy.length === 1 ? "person is" : "people are"} still plotted: ${busy.map((person) => person.name).join(", ")}.`
          : `Nobody in ${groupWanted.label} is on an open plot.`,
        free.length ? `${free.length} show as free: ${free.map((person) => person.name).join(", ")}.` : "",
      ].filter(Boolean),
    };
  }

  if (wantFree) {
    const lines = groups
      .map((group) => {
        const free = group.people.filter((person) => person.holds.length === 0).map((person) => person.name);
        return free.length ? `${group.label}: ${free.join(", ")}.` : "";
      })
      .filter(Boolean);
    return { heading: "Who is free", lines: lines.length ? lines : ["Nobody on the team list is free."] };
  }

  if (wantLate) {
    const lines: string[] = [];
    for (const group of groups) {
      for (const person of group.people) {
        const late = person.holds.filter((hold) => hold.until && hold.until < snap.today);
        if (late.length === 0) continue;
        lines.push(
          `${person.name} (${group.label}) is still plotted past ${late.map((hold) => formatDmy(hold.until)).join(", ")}.`
        );
      }
    }
    return {
      heading: "Past the plotted date",
      lines: lines.length ? lines : ["No open plot is past its date."],
    };
  }

  const openParts = snap.parts.filter((part) => part.stage !== "delivered");
  const shows = new Set(openParts.map((part) => part.promoId.split("|")[0]));
  const occupied = groups
    .filter((group) => group.id === "animation" || group.id === "agency")
    .flatMap((group) =>
      group.people
        .filter((person) => person.holds.length > 0)
        .map((person) => `${person.name} (${group.label})`)
    );
  return {
    heading: "What is open",
    lines: [
      `${openParts.length} production parts are still open across ${shows.size} shows.`,
      occupied.length ? `Still plotted: ${occupied.join(", ")}.` : "No animator or agency is on an open part.",
      "Ask for a person to see where they are plotted, their rating, and feedback. Ask for a show to see when it is plotted to close.",
    ],
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

/** Answer from the sheets already loaded in the dashboard. */
export function answerOps(
  snap: OpsSnapshot,
  question: string,
  pick?: AskChoice
): AskReply {
  const asked = question.trim();
  if (!asked && !pick) {
    return { heading: "Ask about the sheets", lines: ["Name an artist or a show."] };
  }
  if (pick?.kind === "person") {
    return { heading: pick.label, lines: answerPerson(snap, pick.id) };
  }
  if (pick?.kind === "promo") {
    const promo = snap.promos.find((item) => item.id === pick.id);
    if (!promo) return { heading: pick.label, lines: ["That promo is not on the sheets."] };
    return { heading: promo.showName || pick.label, lines: answerPromo(snap, promo) };
  }
  const ranked = rankedChoices(snap, asked);
  const best = ranked[0];
  if (!best) {
    if (/\bsheet|spreadsheet|which tab|where .*(from|stored|saved)|what do you (read|use)|source\b/i.test(asked)) {
      return { heading: "Sheets I use", lines: SHEET_GUIDE };
    }
    return answerSummary(snap, asked);
  }
  const close = ranked.filter((item) => item.score >= best.score - 12);
  const exact = close.filter((item) => item.score >= 100);
  if (exact.length === 1) {
    return answerOps(snap, asked, exact[0].choice);
  }
  return {
    heading: "Which one?",
    lines: [
      exact.length > 1
        ? "More than one promo or person matches. Select the one you mean."
        : `Nothing matches that spelling exactly. Select the closest: ${close[0]?.choice.label ?? ""}.`,
    ],
    choices: (exact.length > 1 ? exact : close).slice(0, 6).map((item) => item.choice),
  };
}
