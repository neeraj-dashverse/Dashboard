import type { OpsSnapshot, Part, Promo, QualityReview } from "./types";
import {
  daysLate,
  formatDmy,
  formatDuration,
  promoFor,
  qualityForAnimator,
  qualityForEditor,
  STAGE_LABEL,
  teamGroups,
} from "./selectors";

export type AskReply = {
  heading: string;
  lines: string[];
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
      for (const hold of place.person.holds) {
        const when = hold.until ? `Plotted ${formatDmy(hold.until)}` : "The sheet has no plotted date";
        const late =
          hold.until && hold.until < snap.today
            ? ` That date has passed by ${daysLate(hold.until, snap.today)} day${daysLate(hold.until, snap.today) === 1 ? "" : "s"}, and the part is still open.`
            : "";
        lines.push(`${hold.title}. ${hold.doing}. ${when}.${late}`);
      }
    }
  }

  const reviews = qualityForAnimator(snap, name);
  const scores = reviews
    .map((review) => review.animation?.overallQuality)
    .filter((score): score is number => score != null);
  if (scores.length === 0) {
    lines.push(`No animation rating is recorded for ${name}.`);
  } else {
    const average = Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10;
    lines.push(`Animation rating is ${average}/5 across ${scores.length} review${scores.length === 1 ? "" : "s"}.`);
  }

  const notes = feedbackLines(snap, reviews, "animation");
  const editorNotes = feedbackLines(snap, qualityForEditor(snap, name), "edit");
  const allNotes = [...notes, ...editorNotes];
  if (allNotes.length === 0) {
    lines.push(`No written feedback is on the quality sheet for ${name}.`);
  } else {
    lines.push("Feedback:");
    lines.push(...allNotes.slice(0, 6));
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
  for (const part of open) {
    const team = part.team === "agency" ? "Agency" : "In house";
    const who = part.artist?.trim() || "No artist";
    const editor = part.editors?.trim();
    const plot = plotDate(part);
    const when = plot ? `plotted ${formatDmy(plot)}` : "no plotted date";
    lines.push(
      `Part ${part.partNo}: ${STAGE_LABEL[part.stage] ?? part.stage}${part.status ? ` ${part.status}` : ""}. ${team}, ${who}${editor ? `, editor ${editor}` : ""}, ${when}.`
    );
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
  return lines;
}

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

/** Answer from the sheets already loaded in the dashboard. */
export function answerOps(snap: OpsSnapshot, question: string): AskReply {
  const asked = question.trim();
  if (!asked) {
    return { heading: "Ask about the sheets", lines: ["Name an artist or a show."] };
  }
  const people = peopleInQuestion(snap, asked);
  const promos = promosInQuestion(snap, asked).filter(
    (promo) => !people.some((name) => norm(name) === norm(promo.showName) || norm(name) === norm(promo.promoName))
  );
  if (people.length === 0 && promos.length === 0) return answerSummary(snap, asked);

  const lines = [
    ...people.flatMap((name) => answerPerson(snap, name)),
    ...promos.flatMap((promo) => answerPromo(snap, promo)),
  ];
  const heading = people[0] ?? (promos[0] ? promos[0].showName : "Sheets");
  return { heading, lines };
}
