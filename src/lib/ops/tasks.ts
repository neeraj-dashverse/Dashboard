import {
  assetClosedDate,
  buildNudges,
  dayLanes,
  plannerCellOverdue,
  plannerPreprodRows,
  plannerRows,
  preProdDelayDays,
} from "./selectors";
import type { OpsSnapshot, Part } from "./types";

export type IncomingPromo = {
  id: string;
  showName: string;
  promoName: string;
};

export type TaskGroup = "new" | "delay" | "match" | "writeback" | "nudge";

export type TaskItem = {
  id: string;
  group: TaskGroup;
  severity: "high" | "medium";
  title: string;
  detail: string;
  when: string | null;
  href: string | null;
};

function blankArtist(part: Part): boolean {
  const name = (part.artist ?? "").trim();
  if (name && !/^[-—]+$/.test(name) && !/^n\/?a$/i.test(name)) return false;
  return part.artists.length === 0;
}

function confirmedFree(snap: OpsSnapshot): { name: string; close: string }[] {
  const out: { name: string; close: string }[] = [];
  for (const animator of snap.animators) {
    const mine = snap.parts.filter(
      (p) =>
        p.artists.some((c) => c.artistId === animator.id) ||
        (p.artist ?? "").trim().toLowerCase() === animator.name.trim().toLowerCase()
    );
    if (mine.length === 0) continue;
    if (mine.some((p) => p.stage !== "delivered")) continue;
    const closes = mine
      .map((p) => p.soundEndDate || p.aniCloseDate)
      .filter((d): d is string => Boolean(d && d <= snap.today))
      .sort();
    const close = closes.at(-1);
    if (!close) continue;
    out.push({ name: animator.name, close });
  }
  return out.sort((a, b) => a.close.localeCompare(b.close));
}

/**
 * Full notification list. Reads Calendar and Plan results; does not recompute them.
 * Today stays the day glance — this page is the complete list beside it.
 */
export function buildTasks(snap: OpsSnapshot, incoming: IncomingPromo[]): TaskItem[] {
  const dismissed = new Set(snap.dismissedNudgeIds);
  const items: TaskItem[] = [];
  const seen = new Set<string>();
  const push = (item: TaskItem) => {
    if (dismissed.has(item.id) || seen.has(item.id)) return;
    seen.add(item.id);
    items.push(item);
  };

  for (const row of incoming) {
    const name = [row.showName, row.promoName].filter(Boolean).join(" / ") || row.id;
    push({
      id: `new:${row.id}`,
      group: "new",
      severity: "high",
      title: `New promo from PocketFM: ${name}`,
      detail: "On the Master Sheet, not yet on Master Tracker. Notify only — nothing is created.",
      when: null,
      href: snap.source.url,
    });
  }

  for (const row of plannerRows(snap)) {
    if (!row.part || !row.plannedDate || row.plannedDate >= snap.today) continue;
    const late = dayLanes(row, snap.today, snap.today, "production").some((l) => l.timing === "late");
    if (!late) continue;
    const name = [row.promo.showName, row.promo.promoName].filter(Boolean).join(" ");
    push({
      id: `cal-delay:${row.promo.id}:${row.part.partNo}`,
      group: "delay",
      severity: "high",
      title: `Part ${row.part.partNo} of ${name} is delayed`,
      detail: `Same delay as the red box on Calendar. Planned ${row.plannedDate} has passed and the part is still open.`,
      when: row.plannedDate,
      href: `/promo/${encodeURIComponent(row.promo.id)}`,
    });
  }

  for (const row of plannerPreprodRows(snap)) {
    const planned = row.plannedDate;
    const closed = assetClosedDate(row.promo);
    const lateDays = preProdDelayDays(row.promo, snap.today);
    const overduePlan = row.planMarks.some((m) =>
      plannerCellOverdue(row, m.note, m.date, snap.today)
    );
    if (!planned || (lateDays <= 0 && !overduePlan && !(planned < snap.today && !closed))) continue;
    if (closed) continue;
    const name = [row.promo.showName, row.promo.promoName].filter(Boolean).join(" ");
    push({
      id: `asset-open:${row.promo.id}`,
      group: "delay",
      severity: "high",
      title: `${name} assets are still open`,
      detail: `Planned ${planned}. Asset sheet close (AC) is empty, so this is not closed.${
        lateDays > 0 ? ` ${lateDays}d past plan.` : ""
      }`,
      when: planned,
      href: `/promo/${encodeURIComponent(row.promo.id)}`,
    });
  }

  const free = confirmedFree(snap);
  const waiting = snap.parts.filter((p) => p.stage !== "delivered" && blankArtist(p));
  if (free.length > 0) {
    for (const part of waiting) {
      const promo = snap.promos.find((p) => p.id === part.promoId);
      if (!promo) continue;
      const who = free[0];
      const name = [promo.showName, promo.promoName].filter(Boolean).join(" ");
      push({
        id: `match:${part.id}`,
        group: "match",
        severity: "high",
        title: `${who.name} is free — Part ${part.partNo} of ${name} has no artist`,
        detail: `Last part closed ${who.close}, and nothing else is queued. Only a confirmed close counts, not a planned date.`,
        when: who.close,
        href: `/promo/${encodeURIComponent(promo.id)}`,
      });
    }
  }

  for (const promo of snap.promos) {
    const parts = snap.parts.filter((p) => p.promoId === promo.id);
    if (parts.length === 0 || parts.some((p) => p.stage !== "delivered")) continue;
    const name = [promo.showName, promo.promoName].filter(Boolean).join(" ");
    push({
      id: `writeback:${promo.id}`,
      group: "writeback",
      severity: "medium",
      title: `${name} is delivered, Master Sheet write-back is waiting`,
      detail:
        "Stage and delivery links should go back to Dashverse<>PFM. That sheet is still Viewer-only, so nothing has been written.",
      when: null,
      href: snap.source.url,
    });
  }

  for (const n of buildNudges(snap)) {
    if (n.kind === "assets_delay" && seen.has(`asset-open:${n.promoId}`)) continue;
    push({
      id: n.id,
      group: "nudge",
      severity: n.severity,
      title: n.prompt,
      detail: n.whyNow,
      when: n.when,
      href: `/promo/${encodeURIComponent(n.promoId)}`,
    });
  }

  const rank = { high: 0, medium: 1 };
  const groupOrder: Record<TaskGroup, number> = {
    new: 0,
    delay: 1,
    match: 2,
    writeback: 3,
    nudge: 4,
  };
  return items.sort((a, b) => {
    const g = groupOrder[a.group] - groupOrder[b.group];
    if (g !== 0) return g;
    const s = rank[a.severity] - rank[b.severity];
    if (s !== 0) return s;
    return (a.when ?? "9999").localeCompare(b.when ?? "9999");
  });
}

export const TASK_GROUPS: { id: TaskGroup; label: string }[] = [
  { id: "new", label: "New from PocketFM" },
  { id: "delay", label: "Delays" },
  { id: "match", label: "Someone is free" },
  { id: "writeback", label: "Master Sheet write-back" },
  { id: "nudge", label: "Everything else due" },
];
