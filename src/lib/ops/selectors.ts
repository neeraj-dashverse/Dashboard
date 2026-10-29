import type {
  Animator,
  NudgeAudience,
  NudgeKind,
  OpsNudge,
  OpsSnapshot,
  Part,
  Promo,
  QualityReview,
  Stage,
} from "./types";

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Matches Production Tracker Stage dropdown order (ops kanban). */
export const STAGE_ORDER: Stage[] = [
  "planning",
  "animation",
  "edit",
  "correction",
  "sound",
  "delivered",
];

export const STAGE_LABEL: Record<Stage, string> = {
  planning: "Planning & Plotting",
  animation: "Animation",
  edit: "Edit",
  correction: "Correction",
  sound: "Sound",
  delivered: "Delivered",
};

export function daysLate(planned: string | null, today: string): number {
  if (!planned || planned >= today) return 0;
  const a = new Date(`${planned}T00:00:00Z`).getTime();
  const b = new Date(`${today}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

/** Days until a future date (0 if today, negative if past). */
export function daysUntil(iso: string | null, today: string): number | null {
  if (!iso) return null;
  const a = new Date(`${today}T00:00:00Z`).getTime();
  const b = new Date(`${iso}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

export function formatDuration(sec: number): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function promoFor(snap: OpsSnapshot, promoId: string): Promo | undefined {
  return snap.promos.find((p) => p.id === promoId);
}

export function artistName(snap: OpsSnapshot, artistId: string): string {
  return snap.animators.find((a) => a.id === artistId)?.name ?? artistId;
}

/** First 5 min is Part 1 work — derive artist from Part 1 (col F removed). */
export function part1Artist(snap: OpsSnapshot, promoId: string): string | null {
  const p1 = snap.parts.find((p) => p.promoId === promoId && p.partNo === 1);
  if (!p1) return null;
  if (p1.artist) return p1.artist;
  if (p1.artists[0]) return artistName(snap, p1.artists[0].artistId);
  return null;
}

export type PromoPartRecord = {
  partNo: number;
  artist: string;
  editor: string;
  stage: string;
  /** Part length from Production Tracker column F. */
  lengthSec: number;
  /** Worked time from column AF, when the sheet has it. */
  workedSec: number | null;
  days: number | null;
};

export type PromoRecord = {
  id: string;
  showName: string;
  promoName: string;
  status: string;
  /** Master Tracker initial duration. */
  initialSec: number | null;
  /** Sum of part lengths. */
  finalSec: number | null;
  assetPeople: string;
  assetDays: number | null;
  days: number | null;
  parts: PromoPartRecord[];
};

function daySpan(start: string | null | undefined, end: string | null | undefined): number | null {
  const a = toIsoLoose(start);
  const b = toIsoLoose(end);
  if (!a || !b || b < a) return null;
  return daysLate(a, b);
}

/** Every promo on the tracker or production sheet, including closed ones. */
export function promoRecords(snap: OpsSnapshot): PromoRecord[] {
  const byId = new Map(snap.promos.map((promo) => [promo.id, promo]));
  const partGroups = new Map<string, Part[]>();
  for (const part of snap.parts) {
    const list = partGroups.get(part.promoId) ?? [];
    list.push(part);
    partGroups.set(part.promoId, list);
  }

  const ids = new Set<string>([...byId.keys(), ...partGroups.keys()]);
  const records: PromoRecord[] = [];
  for (const id of ids) {
    const promo = byId.get(id);
    const parts = (partGroups.get(id) ?? []).slice().sort((a, b) => a.partNo - b.partNo);
    const [showFallback, nameFallback] = id.split("|");
    const asset = promo?.assetTeam;
    const assetPeople = [asset?.artist1, asset?.artist2, asset?.artist3, asset?.artLead]
      .map((name) => name?.trim())
      .filter((name): name is string => !!name)
      .join(", ");
    const assetDays =
      asset?.totalDays ??
      asset?.productionDays ??
      daySpan(asset?.startDate, asset?.correctionsEndDate || asset?.endDate);

    const partRows: PromoPartRecord[] = parts.map((part) => ({
      partNo: part.partNo,
      artist: part.artist?.trim() || "—",
      editor: part.editors?.trim() || "—",
      stage: STAGE_LABEL[part.stage] ?? part.stage,
      lengthSec: part.durationSec,
      workedSec: part.workedDurationSec,
      days:
        part.days ??
        daySpan(
          part.aniStartDate ?? part.plannedPlottedDate,
          part.soundEndDate ?? part.correctionEndDate ?? part.editCloseDate ?? part.aniCloseDate
        ),
    }));

    const lengths = partRows.map((part) => part.lengthSec).filter((seconds) => seconds > 0);
    const starts = parts
      .map((part) => part.aniStartDate ?? part.plannedPlottedDate)
      .filter((date): date is string => !!date)
      .sort();
    const ends = parts
      .map((part) => part.soundEndDate ?? part.correctionEndDate ?? part.editCloseDate ?? part.aniCloseDate)
      .filter((date): date is string => !!date)
      .sort();
    const delivered = parts.length > 0 && parts.every((part) => part.stage === "delivered");

    records.push({
      id,
      showName: promo?.showName || showFallback || "—",
      promoName: promo?.promoName || nameFallback || "—",
      status: promo?.trackerStatus || promo?.status || (delivered ? "Delivered" : parts.length ? "WIP" : "—"),
      initialSec: promo?.initialDurationSec ?? null,
      finalSec: lengths.length ? lengths.reduce((sum, seconds) => sum + seconds, 0) : null,
      assetPeople,
      assetDays,
      days: daySpan(starts[0], ends[ends.length - 1]) ?? assetDays,
      parts: partRows,
    });
  }

  return records.sort(
    (a, b) => a.showName.localeCompare(b.showName) || a.promoName.localeCompare(b.promoName)
  );
}

export function partLabel(snap: OpsSnapshot, part: Part): string {
  const promo = promoFor(snap, part.promoId);
  if (!promo) return `Part ${part.partNo}`;
  return `${promo.showName} · ${promo.promoName} · P${part.partNo}`;
}

export type ExceptionItem = {
  part: Part;
  promo: Promo;
  kind: "overdue" | "blocked" | "due-today" | "delivery-risk" | "five-min-due";
  hurt: number; // ranking weight = overdue days * duration minutes
  daysLate: number;
  /** Which Master milestone is pressuring this row. */
  milestone?: "five-min" | "complete";
};

/** Master has two delivery milestones — 5-min preview, then complete deliverable. */
export function nextMilestone(promo: Promo): {
  kind: "five-min" | "complete";
  date: string;
} | null {
  if (promo.fiveMinTimeline) {
    return { kind: "five-min", date: promo.fiveMinTimeline };
  }
  if (promo.completeDeliverable) {
    return { kind: "complete", date: promo.completeDeliverable };
  }
  return null;
}

export function buildExceptions(snap: OpsSnapshot): ExceptionItem[] {
  const items: ExceptionItem[] = [];

  for (const part of snap.parts) {
    if (part.stage === "delivered") continue;
    const promo = promoFor(snap, part.promoId);
    if (!promo) continue;
    const late = daysLate(part.plannedDate, snap.today);
    const minutes = part.durationSec / 60;
    const p0Boost = promo.priority === "P0" ? 1.4 : 1;

    if (part.blocked) {
      items.push({
        part,
        promo,
        kind: "blocked",
        hurt: (late + 2) * Math.max(minutes, 5) * 1.5 * p0Boost,
        daysLate: late,
      });
    } else if (late > 0) {
      items.push({
        part,
        promo,
        kind: "overdue",
        hurt: late * Math.max(minutes, 5) * p0Boost,
        daysLate: late,
      });
    } else if (part.plannedDate === snap.today) {
      items.push({
        part,
        promo,
        kind: "due-today",
        hurt: Math.max(minutes, 5) * 0.5 * p0Boost,
        daysLate: 0,
      });
    }
  }

  for (const promo of snap.promos) {
    if (promo.status && /delivered|completed/i.test(promo.status)) continue;
    const openParts = snap.parts.filter(
      (p) => p.promoId === promo.id && p.stage !== "delivered"
    );
    const runtime =
      (promo.finalAssetLengthSec ?? 0) / 60 ||
      openParts.reduce((s, p) => s + p.durationSec / 60, 0);
    const p0Boost = promo.priority === "P0" ? 1.4 : 1;
    const anchorPart = openParts[0] ?? snap.parts.find((p) => p.promoId === promo.id);
    if (!anchorPart) continue;

    // Milestone 1 — 5-min preview
    if (promo.fiveMinTimeline && promo.fiveMinTimeline <= snap.today) {
      const late = daysLate(promo.fiveMinTimeline, snap.today);
      items.push({
        part: anchorPart,
        promo,
        kind: late > 0 ? "delivery-risk" : "five-min-due",
        hurt: (late + 1) * Math.max(runtime, 8) * 1.8 * p0Boost,
        daysLate: late,
        milestone: "five-min",
      });
    }

    // Milestone 2 — complete deliverable
    if (promo.completeDeliverable && promo.completeDeliverable <= snap.today) {
      const late = daysLate(promo.completeDeliverable, snap.today);
      items.push({
        part: anchorPart,
        promo,
        kind: "delivery-risk",
        hurt: (late + 1) * Math.max(runtime, 8) * 2.2 * p0Boost,
        daysLate: late,
        milestone: "complete",
      });
    }
  }

  const best = new Map<string, ExceptionItem>();
  for (const item of items) {
    const key =
      item.kind === "delivery-risk" || item.kind === "five-min-due"
        ? `promo-${item.promo.id}-${item.milestone ?? "x"}`
        : `part-${item.part.id}`;
    const prev = best.get(key);
    if (!prev || item.hurt > prev.hurt) best.set(key, item);
  }

  return Array.from(best.values()).sort((a, b) => b.hurt - a.hurt);
}

export function funnelCounts(snap: OpsSnapshot): Array<{ stage: Stage; count: number; stuck: number }> {
  return STAGE_ORDER.map((stage) => {
    const inStage = snap.parts.filter((p) => p.stage === stage);
    const stuck = inStage.filter((p) => daysLate(p.plannedDate, snap.today) >= 2 || p.blocked).length;
    return { stage, count: inStage.length, stuck };
  });
}

export type AnimatorLoad = Animator & {
  openParts: Part[];
  openMinutes: number;
  free: boolean;
  /**
   * Earliest date this animator can take new work.
   * Drives the outward “assets needed by” deadline (v9 principle 10).
   */
  freeAt: string;
  /** Promos where this person is Master Tracker CPS (main animator). */
  asCps: Promo[];
  /**
   * Promos where they are Part 1 artist (first 5 min is their work —
   * no separate First 5min animator field).
   */
  asPart1: Promo[];
  /**
   * Avg Overall Quality (1–5) from Master Productivity — separate from throughput.
   */
  qualityAvg: number | null;
  qualityReviews: number;
  /**
   * From Animation productivity · Master data:
   * throughput ≈ sum(new output midpoints) / distinct active days (new only for now;
   * correction days counted in correctionDays, excluded from output — policy open).
   */
  throughputMinPerDay: number | null;
  activeDays: number;
  correctionDays: number;
  outputMinutesLogged: number;
};

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10;
}

/** Quality reviews naming this person as animator. */
export function qualityForAnimator(
  snap: OpsSnapshot,
  name: string
): QualityReview[] {
  const n = name.trim().toLowerCase();
  return snap.qualityReviews.filter((r) =>
    r.animators.some((a) => a.toLowerCase() === n || a.toLowerCase().includes(n.split(" ")[0] ?? ""))
  );
}

/** Quality reviews naming this person as editor. */
export function qualityForEditor(
  snap: OpsSnapshot,
  name: string
): QualityReview[] {
  const n = name.trim().toLowerCase();
  return snap.qualityReviews.filter((r) =>
    r.editors.some((e) => e.toLowerCase() === n)
  );
}

function nameMatch(a: string, b: string | null): boolean {
  if (!b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase() ||
    b.toLowerCase().includes(a.toLowerCase().split(" ")[0] ?? "");
}

export function animatorLoads(snap: OpsSnapshot): AnimatorLoad[] {
  return snap.animators
    .map((a) => {
      const openParts = snap.parts.filter(
        (p) =>
          p.stage !== "delivered" &&
          p.artists.some((c) => c.artistId === a.id)
      );
      const openMinutes = openParts.reduce(
        (s, p) =>
          s +
          (p.durationSec / 60) *
            (p.artists.find((c) => c.artistId === a.id)?.share ?? 0),
        0
      );
      const asCps = snap.promos.filter(
        (p) => p.trackerStatus !== "Closed" && nameMatch(a.name, p.cps)
      );
      const asPart1 = snap.promos.filter(
        (p) =>
          p.trackerStatus !== "Closed" && nameMatch(a.name, part1Artist(snap, p.id))
      );
      const free = openParts.length === 0 && asCps.length === 0;
      const dates: string[] = [];
      for (const p of openParts) {
        if (p.plannedDate) dates.push(p.plannedDate);
      }
      for (const promo of asCps) {
        if (promo.preProd?.closedDate) continue;
        if (promo.preProd?.plannedDate) dates.push(promo.preProd.plannedDate);
        if (promo.preProd?.assetsNeededBy) dates.push(promo.preProd.assetsNeededBy);
      }
      const freeAt = free
        ? snap.today
        : dates.length === 0
          ? snap.today
          : (dates.sort().at(-1) ?? snap.today);
      const reviews = qualityForAnimator(snap, a.name);
      const qualityAvg = avg(
        reviews
          .map((r) => r.animation?.overallQuality)
          .filter((n): n is number => n != null)
      );
      // Include everything: new + correction days (anim → edit → correction → sound flow)
      const logs = snap.dailyLogs.filter((l) => nameMatch(a.name, l.artist));
      const correctionDays = new Set(
        logs.filter((l) => l.workType === "correction").map((l) => l.date)
      ).size;
      const activeDaySet = new Set(logs.map((l) => l.date));
      const activeDays = activeDaySet.size;
      const outputMinutesLogged = logs.reduce((s, l) => s + l.outputMinutes, 0);
      const throughputMinPerDay =
        activeDays > 0
          ? Math.round((outputMinutesLogged / activeDays) * 10) / 10
          : null;
      return {
        ...a,
        openParts,
        openMinutes,
        free,
        freeAt,
        asCps,
        asPart1,
        qualityAvg,
        qualityReviews: reviews.length,
        throughputMinPerDay,
        activeDays,
        correctionDays,
        outputMinutesLogged,
      };
    })
    .sort((a, b) => Number(b.free) - Number(a.free) || a.openMinutes - b.openMinutes);
}

/**
 * Promos where animator free-date should drive an outward asset deadline
 * (assets not done, and needed-by missing or earlier than free-at).
 */
export function assetDeadlinesToPush(snap: OpsSnapshot): {
  promo: Promo;
  freeAt: string;
  cps: string;
}[] {
  const out: { promo: Promo; freeAt: string; cps: string }[] = [];
  for (const promo of snap.promos) {
    if (promo.trackerStatus === "Closed") continue;
    if (promo.preProd?.status === "Done" || promo.preProd?.closedDate || assetClosedDate(promo))
      continue;
    const freeAt = assetsNeededBySuggestion(snap, promo);
    if (!freeAt) continue;
    const set = promo.preProd?.assetsNeededBy;
    if (set && set >= freeAt) continue;
    if (!promo.cps) continue;
    out.push({ promo, freeAt, cps: promo.cps });
  }
  return out.sort((a, b) => a.freeAt.localeCompare(b.freeAt));
}

export function overnightBlockers(snap: OpsSnapshot): ExceptionItem[] {
  return buildExceptions(snap).filter((i) => i.kind === "blocked");
}

// ── Planner grid (one row per ongoing promo part × one column per day) ───────

export type PlannerRow = {
  key: string;
  promo: Promo;
  /** 0 = promo-level row (promo has no Production Tracker parts yet). */
  partNo: number;
  part: Part | null;
  /** First visible row of this promo — draws the group divider + promo markers. */
  firstOfPromo: boolean;
  /**
   * Agreed day for this row: Pre-prod = asset close, Production = first cut.
   * Prefers the date clicked on the calendar (Planner tab), then sheet columns.
   */
  plannedDate: string | null;
  /** Planned marks for this row (date + label), including the half of day. */
  planMarks: { date: string; note: string }[];
};

/** A promo is "ongoing" until Closed / delivered / every part is delivered. */
export function isOngoingPromo(snap: OpsSnapshot, promo: Promo): boolean {
  if (promo.trackerStatus && /closed/i.test(promo.trackerStatus)) return false;
  if (promo.status && /delivered|completed/i.test(promo.status)) return false;
  const parts = snap.parts.filter((p) => p.promoId === promo.id);
  if (parts.length === 0) return true; // brand-new promo — no parts yet
  return parts.some((p) => p.stage !== "delivered");
}

function cellPlan(
  snap: OpsSnapshot,
  promoId: string,
  partNo: number,
  re: RegExp
): { date: string; text: string } | null {
  const hits = snap.plannerCells
    .filter((c) => c.promoId === promoId && c.partNo === partNo && re.test(c.text))
    .sort((a, b) => a.date.localeCompare(b.date));
  const hit = hits[0];
  return hit ? { date: hit.date, text: hit.text } : null;
}

/** Earliest Planner-tab date whose text matches `re` for this promo/part. */
function cellPlanDate(
  snap: OpsSnapshot,
  promoId: string,
  partNo: number,
  re: RegExp
): string | null {
  return cellPlan(snap, promoId, partNo, re)?.date ?? null;
}

export function slotLabel(text: string): string | null {
  if (/first half/i.test(text)) return "1st half";
  if (/second half/i.test(text)) return "2nd half";
  if (/\beod\b/i.test(text)) return "EOD";
  return null;
}

function marksFor(
  snap: OpsSnapshot,
  promoId: string,
  partNo: number,
  kind: "asset" | "production"
): { date: string; note: string }[] {
  const out: { date: string; note: string }[] = [];
  for (const cell of snap.plannerCells) {
    if (cell.promoId !== promoId || cell.partNo !== partNo || !cell.date) continue;
    const text = cell.text;
    let note: string | null = null;
    if (kind === "asset") {
      if (/asset/i.test(text)) note = "Assets";
    } else if (/sound/i.test(text)) note = "Sound";
    else if (/final cut|second cut|correction close/i.test(text)) note = "Final cut";
    else if (/rough cut|first cut|first animation|first edit/i.test(text)) note = "Rough cut";
    if (note) out.push({ date: cell.date, note });
  }
  return out;
}

function productionPlannedDate(snap: OpsSnapshot, promo: Promo, part: Part): string | null {
  return (
    cellPlanDate(snap, promo.id, part.partNo, /rough cut|first animation|first\s*cut/i) ??
    part.deadline
  );
}

function assetPlannedDate(snap: OpsSnapshot, promo: Promo): string | null {
  return cellPlanDate(snap, promo.id, 0, /asset/i) ?? promo.preProd?.plannedDate ?? null;
}

/**
 * Production tab: only promos that already have rows on Production Tracker.
 * New work stays on Pre-production until assets close and animation is added
 * to that sheet (~5–6 days later).
 */
export function plannerRows(snap: OpsSnapshot): PlannerRow[] {
  const prio = (p: Promo) => (p.priority === "P0" ? 0 : p.priority === "P1" ? 1 : 2);
  const promos = snap.promos
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => isOngoingPromo(snap, p))
    .sort((a, b) => prio(a.p) - prio(b.p) || a.i - b.i)
    .map(({ p }) => p);

  const rows: PlannerRow[] = [];
  for (const promo of promos) {
    const open = snap.parts
      .filter((p) => p.promoId === promo.id && p.stage !== "delivered")
      .sort((a, b) => a.partNo - b.partNo);
    if (open.length === 0) continue;
    open.forEach((part, i) =>
      rows.push({
        key: `${promo.id}|${part.partNo}|${part.id}`,
        promo,
        partNo: part.partNo,
        part,
        firstOfPromo: i === 0,
        plannedDate: productionPlannedDate(snap, promo, part),
        planMarks: marksFor(snap, promo.id, part.partNo, "production"),
      })
    );
  }
  return rows;
}

/** "7/14/2026", "10/19/26", "10/6/26" (asset sheet) or ISO → ISO. */
function toIsoLoose(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!m) return null;
  let year = m[3];
  if (year.length === 2) year = `20${year}`;
  return `${year}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

/** Sheet or ISO date → dd/mm/yyyy. US sheet order (10/13/26) stays 13/10/2026. */
export function formatDmy(v: string | null | undefined): string {
  const raw = (v ?? "").trim();
  if (!raw) return "—";
  const iso = toIsoLoose(raw);
  if (!iso) return raw;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export type Timing = "early" | "on_time" | "late";

export type DayLane = {
  lane: "asset" | "production";
  label: string;
  /** This day is the close-column date for that stage. */
  closed: boolean;
  /** vs planned close: asset Planned date (G) or part Deadline (K). */
  timing: Timing;
};

export type PlannerTab = "preprod" | "production";

/**
 * Pre-production calendar: asset sheet Status (col E) must be WIP.
 * Send for Approval, Approved, Dropped, blank — all stay off.
 */
export function isAssetOpen(promo: Promo): boolean {
  if (!promo.assetTeam) return false;
  if (assetClosedDate(promo)) return false;
  const st = (promo.assetTeam.assetsStatus ?? "").toLowerCase().trim();
  if (!/\bwip\b/.test(st)) return false;
  if (st.includes("approved") || st.includes("send for") || st.includes("dropped")) return false;
  const remarks = [
    promo.assetTeam.remarks,
    promo.assetTeam.dashverseNotes,
    promo.assetTeam.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (/\bdropped\b/.test(remarks)) return false;
  return true;
}

export type TeamGroupId = "assets" | "animator" | "editor" | "agency";

export type TeamHold = {
  promoId: string;
  title: string;
  /** Current calendar status for this row. */
  doing: string;
  plan: string;
  until: string | null;
  /** Days past the plan while the row is still open. */
  lateDays: number;
};

export type TeamPerson = {
  name: string;
  /** Latest plan date across the open rows in this group. */
  freeAt: string | null;
  holds: TeamHold[];
};

export type TeamGroup = {
  id: TeamGroupId;
  label: string;
  people: TeamPerson[];
  freeNow: string[];
};

const TEAM_GROUP_ORDER: { id: TeamGroupId; label: string }[] = [
  { id: "assets", label: "Assets" },
  { id: "animator", label: "Animators" },
  { id: "editor", label: "Editors" },
  { id: "agency", label: "Agency" },
];

function personKey(name: string): string {
  return name.trim().toLowerCase();
}

function splitPersonNames(v: string | null | undefined): string[] {
  return String(v ?? "")
    .split(/[,/]|&| and /i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^(tbd|n\/a|na|nil|none|-)$/i.test(s));
}

/** Latest planned mark on the row, else the row's planned date. */
function rowRelease(row: PlannerRow): { until: string | null; plan: string } {
  const marks = [...row.planMarks].sort((a, b) => a.date.localeCompare(b.date));
  const last = marks[marks.length - 1];
  if (last) return { until: last.date, plan: last.note };
  if (row.plannedDate) return { until: row.plannedDate, plan: "Plan" };
  return { until: null, plan: "No plan date" };
}

function currentDoing(row: PlannerRow, today: string, tab: PlannerTab): string {
  const now = dayLanes(row, today, today, tab);
  if (now[0]?.label) return now[0].label;
  if (tab === "preprod") return row.promo.assetTeam?.assetsStatus?.trim() || "Assets";
  if (row.part) return STAGE_LABEL[row.part.stage] ?? row.part.stage;
  return "—";
}

/**
 * Ongoing calendar work, split by assets, in-house animators, editors, and agency.
 * Each open row says what they are doing and, if the plan date has passed, that they were supposed to be free.
 */
export function teamGroups(snap: OpsSnapshot): TeamGroup[] {
  const buckets = new Map<TeamGroupId, Map<string, TeamPerson>>();
  for (const group of TEAM_GROUP_ORDER) buckets.set(group.id, new Map());

  const addHold = (group: TeamGroupId, raw: string, row: PlannerRow, title: string, tab: PlannerTab) => {
    const name = raw.trim();
    const key = personKey(name);
    if (!key || key.startsWith("a:")) return;
    const people = buckets.get(group)!;
    let person = people.get(key);
    if (!person) {
      person = { name, freeAt: null, holds: [] };
      people.set(key, person);
    }
    const rel = rowRelease(row);
    if (person.holds.some((h) => h.title === title)) return;
    person.holds.push({
      promoId: row.promo.id,
      title,
      doing: currentDoing(row, snap.today, tab),
      plan: rel.plan,
      until: rel.until,
      lateDays:
        row.plannedDate && row.plannedDate < snap.today ? daysLate(row.plannedDate, snap.today) : 0,
    });
  };

  for (const row of plannerRows(snap)) {
    const title = `${row.promo.showName || "—"} · ${row.promo.promoName || "—"} · P${row.partNo}`;
    const artists = splitPersonNames(row.part?.artist);
    if (artists.length === 0 && row.part) {
      for (const credit of row.part.artists) {
        const named = artistName(snap, credit.artistId);
        if (named) artists.push(named);
      }
    }
    const group: TeamGroupId = row.part?.team === "agency" ? "agency" : "animator";
    for (const name of artists) addHold(group, name, row, title, "production");
    for (const name of splitPersonNames(row.part?.editors)) addHold("editor", name, row, title, "production");
  }

  for (const row of plannerPreprodRows(snap)) {
    const title = `${row.promo.showName || "—"} · ${row.promo.promoName || "—"}`;
    const team = row.promo.assetTeam;
    const names = [team?.artist1, team?.artist2, team?.artist3, team?.artLead].flatMap((n) =>
      splitPersonNames(n)
    );
    for (const name of names) addHold("assets", name, row, title, "preprod");
  }

  const busyEverywhere = new Set<string>();
  for (const people of buckets.values()) {
    for (const person of people.values()) busyEverywhere.add(personKey(person.name));
  }

  const sortPeople = (people: TeamPerson[]) =>
    people.sort((a, b) => {
      const lateA = Math.max(0, ...a.holds.map((h) => h.lateDays));
      const lateB = Math.max(0, ...b.holds.map((h) => h.lateDays));
      if (lateA !== lateB) return lateB - lateA;
      if (a.freeAt && b.freeAt) return a.freeAt.localeCompare(b.freeAt);
      if (a.freeAt) return -1;
      if (b.freeAt) return 1;
      return a.name.localeCompare(b.name);
    });

  return TEAM_GROUP_ORDER.map((group) => {
    const people = [...(buckets.get(group.id)?.values() ?? [])];
    for (const person of people) {
      const dates = person.holds.map((h) => h.until).filter((d): d is string => !!d);
      person.freeAt = dates.length === person.holds.length ? dates.sort().at(-1) ?? null : null;
      person.holds.sort((a, b) => b.lateDays - a.lateDays || (a.until ?? "").localeCompare(b.until ?? ""));
    }
    const roster =
      group.id === "animator"
        ? snap.animators.filter((a) => a.team !== "agency")
        : group.id === "agency"
          ? snap.animators.filter((a) => a.team === "agency")
          : [];
    const freeNow = roster
      .map((a) => a.name.trim())
      .filter((name) => name && !busyEverywhere.has(personKey(name)))
      .sort((a, b) => a.localeCompare(b));
    return { ...group, people: sortPeople(people), freeNow };
  });
}

/** One row per OPEN asset-sheet promo — not Master Tracker closed runs. */
export function plannerPreprodRows(snap: OpsSnapshot): PlannerRow[] {
  const seen = new Set<string>();
  const out: PlannerRow[] = [];
  for (const promo of snap.promos) {
    if (!isAssetOpen(promo)) continue;
    const base = promo.id.split("#")[0];
    if (seen.has(base)) continue;
    seen.add(base);
    out.push({
      key: `${promo.id}|asset`,
      promo,
      partNo: 0,
      part: null,
      firstOfPromo: true,
      plannedDate: assetPlannedDate(snap, promo),
      planMarks: marksFor(snap, promo.id, 0, "asset"),
    });
  }
  return out;
}

/** Asset sheet Start Date (col Y). Empty stays empty — WIP alone does not paint today. */
export function assetStartDate(promo: Promo, _today: string): string | null {
  return toIsoLoose(promo.assetTeam?.startDate) ?? promo.preProd?.startDate ?? null;
}

/** Earliest animation start for a part: Planning & Plotting (L), else Ani start (M). */
export function animationStartDate(part: Part | null): string | null {
  if (!part) return null;
  return part.plannedPlottedDate ?? part.aniStartDate;
}

function vsPlan(planned: string | null, actual: string | null, today: string): Timing {
  if (!planned) return "on_time";
  if (actual) {
    if (actual < planned) return "early";
    if (actual > planned) return "late";
    return "on_time";
  }
  return today > planned ? "late" : "on_time";
}

export function assetTiming(promo: Promo, today: string): Timing {
  return vsPlan(promo.preProd?.plannedDate ?? null, assetClosedDate(promo), today);
}

export function productionTiming(part: Part, today: string): Timing {
  const actual =
    part.soundEndDate ?? part.correctionEndDate ?? part.editCloseDate ?? part.aniCloseDate;
  return vsPlan(part.deadline, actual, today);
}

/**
 * Pre-production stage for one day, from the asset sheet only:
 * Y Start → Z End = Assets. AB Corrections Start → AC Corrections End = Correction.
 * Open spans stop at today. Future days stay empty so only planned dates show ahead.
 */
function assetLaneOn(
  promo: Promo,
  day: string,
  today: string,
  planned: string | null
): DayLane | null {
  const a = promo.assetTeam;
  const Y = toIsoLoose(a?.startDate);
  const Z = toIsoLoose(a?.endDate);
  const AB = toIsoLoose(a?.correctionsStartDate);
  const AC = toIsoLoose(a?.correctionsEndDate);
  const timing = vsPlan(planned, AC ?? Z, today);
  const mk = (label: string, closed: boolean): DayLane => ({
    lane: "asset",
    label,
    closed,
    timing,
  });

  if (day > today) return null;

  if (AC && day > AC) return null;
  if (AC && day === AC) return mk("Correction", true);
  if (AB && day >= AB && (!AC || day < AC)) return mk("Correction", false);

  if (Z && day > Z) return null;
  if (Z && day === Z) return mk("Assets", true);
  if (Y && day >= Y && (!Z || day < Z) && (!AB || day < AB)) return mk("Assets", false);
  if (!Y && planned === day) return mk("Assets", false);
  return null;
}

/**
 * Production stage occupying `day`. A filled close column ends that stage on
 * that day: O first cut · R edit received · T correction · W sound.
 * Sound is drawn only when W has a date. Animation timeline starts on Planning & Plotting (L).
 */
function productionLaneOn(
  part: Part,
  day: string,
  today: string,
  _planned: string | null
): DayLane | null {
  const mk = (label: string, closed = false): DayLane => ({
    lane: "production",
    label,
    closed,
    timing: "on_time",
  });
  const L = part.plannedPlottedDate;
  const M = part.aniStartDate;
  const O = part.aniCloseDate;
  const R = part.editCloseDate;
  const S = part.correctionStartDate;
  const T = part.correctionEndDate;
  const W = part.soundEndDate;

  // Actual close-column days (pins, not spans).
  if (W && day === W) return mk("Sound", true);
  if (T && day === T) return mk("Correction", true);
  if (R && day === R) return mk("Edit", true);
  if (O && day === O) return mk("Animation", true);

  // Current status never runs past today. Planned marks for later days are separate.
  if (day > today) return null;

  // Sound only when column W is filled. Do not invent it after edit or correction.
  const soundFrom = T ?? R;
  if (W && soundFrom && day > soundFrom && day < W) return mk("Sound");
  if (W && day > W) return null;

  if (S && day >= S && (!T || day < T)) return mk("Correction");
  if (!S && R && T && day > R && day < T) return mk("Correction");

  if (O && day > O && (!R || day < R) && (!S || day < S)) return mk("Edit");

  if (M && day >= M && (!O || day < O)) return mk("Animation");
  if (!M && L && day >= L && (!O || day < O) && part.stage !== "planning") return mk("Animation");

  if (L && day >= L && (!M || day < M) && (!O || day < O)) return mk("Plotting");
  if (L && !M && !O && day >= L && part.stage === "planning") return mk("Plotting");

  return null;
}

/** Lanes for one cell on the active tab. Nothing after today — that space is for planned dates. */
export function dayLanes(
  row: PlannerRow,
  day: string,
  today: string,
  tab: PlannerTab
): DayLane[] {
  if (day > today) return [];
  if (tab === "preprod") {
    const asset = assetLaneOn(row.promo, day, today, row.plannedDate);
    return asset ? [asset] : [];
  }
  if (!row.part) {
    if (row.plannedDate === day) {
      return [
        {
          lane: "production",
          label: "First animation",
          closed: false,
          timing: vsPlan(row.plannedDate, null, today),
        },
      ];
    }
    return [];
  }
  const prod = productionLaneOn(row.part, day, today, row.plannedDate);
  if (!prod) return [];
  return [{ ...prod, timing: vsPlan(row.plannedDate, row.part.aniCloseDate, today) }];
}

/** First day this row's phase actually began. Pre-prod is asset start; production is plotting or ani start. */
function phaseStartDate(row: PlannerRow, tab: PlannerTab, today: string): string | null {
  if (tab === "preprod") return assetStartDate(row.promo, today);
  return animationStartDate(row.part);
}

/** Dates that should pull the calendar window open for this row, on this tab only. */
function occupancyDates(row: PlannerRow, today: string, tab: PlannerTab): string[] {
  const dates: string[] = [];
  const push = (d: string | null | undefined) => {
    if (d) dates.push(d);
  };
  push(row.plannedDate);
  for (const m of row.planMarks) push(m.date);

  if (tab === "preprod") {
    push(assetStartDate(row.promo, today));
    push(toIsoLoose(row.promo.assetTeam?.endDate));
    push(toIsoLoose(row.promo.assetTeam?.correctionsStartDate));
    push(assetClosedDate(row.promo));
    push(row.promo.preProd?.plannedDate);
    if (assetStartDate(row.promo, today) && !assetClosedDate(row.promo)) push(today);
    return dates;
  }

  push(animationStartDate(row.part));
  const p = row.part;
  if (p) {
    push(p.deadline);
    push(p.plannedPlottedDate);
    push(p.aniStartDate);
    push(p.aniCloseDate);
    push(p.editCloseDate);
    push(p.correctionStartDate);
    push(p.correctionEndDate);
    push(p.soundEndDate);
    if ((p.plannedPlottedDate || p.aniStartDate) && !p.soundEndDate && p.stage !== "delivered") {
      push(today);
    }
  }
  return dates;
}

/**
 * Is a planned entry on a PAST day still waiting on what it promised?
 * "assets" → asset sheet End (AC) empty · "first cut / first animation" →
 * Production Tracker O (first animation received) empty.
 */
export function plannerCellOverdue(row: PlannerRow, plan: string, date: string, today: string): boolean {
  if (date >= today) return false;
  const t = plan.toLowerCase();
  if (/asset/.test(t) && !assetClosedDate(row.promo)) return true;
  if (/first (cut|animation)/.test(t) && row.part && !row.part.aniCloseDate) return true;
  return false;
}

/** Extra off days (ISO). Sundays and the 2nd Saturday are already holidays. */
const EXTRA_HOLIDAYS = new Set<string>([
  // e.g. "2026-11-01",
]);

/** Sunday, or the second Saturday of the month (date 8–14). */
export function isHoliday(iso: string): boolean {
  if (EXTRA_HOLIDAYS.has(iso)) return true;
  const wd = new Date(`${iso}T00:00:00Z`).getUTCDay();
  if (wd === 0) return true;
  if (wd !== 6) return false;
  const day = Number(iso.slice(8, 10));
  return day >= 8 && day <= 14;
}

function enumerateDays(start: string, end: string): string[] {
  const out: string[] = [];
  let d = start;
  while (d <= end) {
    out.push(d);
    d = addDaysIso(d, 1);
  }
  return out;
}

/**
 * Date columns for one tab. The left edge is the earliest start of that phase
 * (asset start on Pre-production, plotting / ani start on Production), then
 * through the last date still on that tab.
 */
export function plannerDays(snap: OpsSnapshot, tab: PlannerTab): string[] {
  const rows = tab === "preprod" ? plannerPreprodRows(snap) : plannerRows(snap);
  const dates = new Set<string>();
  const starts: string[] = [];
  for (const r of rows) {
    const started = phaseStartDate(r, tab, snap.today);
    if (started) starts.push(started);
    for (const d of occupancyDates(r, snap.today, tab)) dates.add(d);
  }
  for (const c of snap.plannerCells) {
    if (rows.some((r) => r.promo.id === c.promoId && r.partNo === c.partNo)) dates.add(c.date);
  }
  if (dates.size === 0 && starts.length === 0) {
    return enumerateDays(snap.today, addDaysIso(snap.today, 14));
  }
  const sorted = [...dates].sort();
  const start = [...starts].sort()[0] ?? sorted[0] ?? snap.today;
  const afterStart = sorted.filter((d) => d >= start);
  let end = afterStart[afterStart.length - 1] ?? start;
  if (snap.today > end && snap.today >= start) end = snap.today;
  if (end < start) end = start;
  return enumerateDays(start, addDaysIso(end, 1));
}

const STALE_DAYS = 2;

/**
 * Time-aware ops nudges — tied to real dates (due today / in 2d / free-at),
 * with audience so coordinator / CPS / asset team / Neeraj each see their part.
 */
export function buildNudges(snap: OpsSnapshot): OpsNudge[] {
  const nudges: OpsNudge[] = [];
  const dismissed = new Set(snap.dismissedNudgeIds);
  const horizon = addDaysIso(snap.today, 2);

  for (const promo of snap.promos) {
    if (promo.trackerStatus === "Closed") continue;
    const label = `${promo.showName} · ${promo.scriptName}`;
    const open = snap.parts.some(
      (p) => p.promoId === promo.id && p.stage !== "delivered"
    );

    const push = (
      kind: NudgeKind,
      prompt: string,
      severity: OpsNudge["severity"],
      opts: {
        when: string | null;
        whyNow: string;
        audience: NudgeAudience[];
      }
    ) => {
      const id = `${promo.id}:${kind}`;
      if (dismissed.has(id)) return;
      nudges.push({
        id,
        promoId: promo.id,
        kind,
        prompt,
        severity,
        when: opts.when,
        whyNow: opts.whyNow,
        audience: opts.audience,
      });
    };

    // —— Date-triggered delivery milestone (complete deliverable only) ——
    if (promo.completeDeliverable) {
      const due = promo.completeDeliverable;
      if (due <= horizon) {
        const late = daysLate(due, snap.today);
        push(
          "complete_due",
          late > 0
            ? `Complete deliverable on ${label} was due ${due} (${late}d late).`
            : due === snap.today
              ? `Complete deliverable on ${label} is due today.`
              : `Complete deliverable on ${label} due ${due} — check pipeline.`,
          late > 0 || due === snap.today ? "high" : "medium",
          {
            when: due,
            whyNow:
              late > 0
                ? `Final delivery ${late}d late`
                : due === snap.today
                  ? "Final delivery today"
                  : `Final delivery in ${daysUntil(due, snap.today)}d`,
            audience: ["neeraj", "coordinator", "cps_lead"],
          }
        );
      }
    }

    for (const part of snap.parts) {
      if (part.promoId !== promo.id || part.stage === "delivered" || !part.deadline)
        continue;
      if (part.deadline > horizon) continue;
      const late = daysLate(part.deadline, snap.today);
      push(
        "part_deadline",
        `Part ${part.partNo} on ${label} deadline ${part.deadline}${
          late > 0 ? ` · ${late}d late` : part.deadline === snap.today ? " · today" : ""
        }.`,
        late > 0 || part.deadline === snap.today ? "high" : "medium",
        {
          when: part.deadline,
          whyNow:
            late > 0
              ? `Part deadline ${late}d past`
              : part.deadline === snap.today
                ? "Part deadline today"
                : `Part deadline in ${daysUntil(part.deadline, snap.today)}d`,
          audience: ["coordinator", "neeraj"],
        }
      );
    }

    // —— Assignment gaps that block dated work ——
    if (!promo.cps && open) {
      push(
        "missing_cps",
        `Assign Creative Producer (Cps) on ${label}.`,
        "high",
        {
          when: promo.fiveMinTimeline ?? promo.completeDeliverable,
          whyNow: "Open promo with no Creative Producer",
          audience: ["neeraj"],
        }
      );
    }

    if (open && promo.initialDurationSec == null) {
      push(
        "missing_initial_duration",
        `Set Initial Duration on ${label} — original planned length.`,
        "medium",
        {
          when: null,
          whyNow: "Needed before duration vs actual comparisons",
          audience: ["neeraj"],
        }
      );
    }

    if (open && !promo.workingScriptLink && !promo.scriptLink) {
      push(
        "missing_working_script",
        `Link safety Script for ${label} (PocketFM refs stripped).`,
        "medium",
        {
          when: null,
          whyNow: "No script artifact linked",
          audience: ["neeraj"],
        }
      );
    }

    const agencyPart = snap.parts.some(
      (p) => p.promoId === promo.id && p.team === "agency"
    );
    if (
      (agencyPart || promo.notes?.toLowerCase().includes("agency")) &&
      !promo.agencyScriptLink
    ) {
      push(
        "missing_agency_script",
        `Agency script missing for ${label} — strip PocketFM before handoff.`,
        "high",
        {
          when: null,
          whyNow: "Agency part in pipeline without sanitized script",
          audience: ["neeraj"],
        }
      );
    }

    if (open && promo.cps && !promo.demarcatedScriptLink) {
      push(
        "missing_demarcated_script",
        `Demarcated script not linked for ${label}.`,
        "medium",
        {
          when: null,
          whyNow: "CPS assigned but no part-split script",
          audience: ["neeraj"],
        }
      );
    }

    // Asset handoff before animation can start
    const needsAnim = snap.parts.some(
      (p) =>
        p.promoId === promo.id &&
        (p.stage === "planning" || p.stage === "animation")
    );
    if (needsAnim) {
      const handoff = assetHandoffReady(promo);
      if (!handoff.ready) {
        push(
          "missing_asset_handoff",
          `${label} missing for animation: ${handoff.missing.join(", ")}.`,
          "high",
          {
            when: promo.preProd?.plannedDate ?? null,
            whyNow: "Animation stage waiting on asset links",
            audience: ["asset_team", "neeraj"],
          }
        );
      }
    }

    // My asset sheet — date-driven
    const pp = promo.preProd;
    if (pp && pp.status !== "Done" && pp.status !== "Nil") {
      if (!pp.plannedDate) {
        push(
          "missing_preprod_planned",
          `Set asset Planned date on ${label} so plotting can land.`,
          "high",
          {
            when: null,
            whyNow: "Cannot schedule animation without asset plan date",
            audience: ["neeraj", "asset_team"],
          }
        );
      }
      const closedOn = assetClosedDate(promo);
      const delay = preProdDelayDays(promo, snap.today);
      if (!closedOn && (delay > 0 || pp.delayFlagged) && pp.plannedDate) {
        push(
          "assets_delay",
          `${label} assets ${
            pp.delayFlagged ? "flagged delayed" : `${delay}d past planned ${pp.plannedDate}`
          } — not yet closed by asset team.`,
          "high",
          {
            when: pp.plannedDate,
            whyNow: `Planned ${pp.plannedDate} passed · asset End Date (AC) still empty`,
            audience: ["neeraj", "asset_team"],
          }
        );
      }
      const needed = assetsNeededBySuggestion(snap, promo);
      if (needed && (!pp.assetsNeededBy || pp.assetsNeededBy < needed)) {
        const imminent = needed <= horizon;
        push(
          "assets_needed_by",
          `${label}: animation free ~${needed} — tell asset team assets needed by then.`,
          imminent ? "high" : "medium",
          {
            when: needed,
            whyNow: imminent
              ? `Animator frees within 2 days (${needed})`
              : `Animator free-at ${needed} — set outward deadline`,
            audience: ["neeraj", "asset_team"],
          }
        );
      }
    }

    const last = promo.lastTrackerUpdateAt;
    if (
      open &&
      (!last || daysLate(last, snap.today) >= STALE_DAYS) &&
      promo.trackerStatus === "WIP"
    ) {
      push(
        "stale_status",
        `Check in on ${label} — no tracker update in ${
          last ? `${daysLate(last, snap.today)}d` : "a while"
        }. Still WIP?`,
        "medium",
        {
          when: last ? addDaysIso(last, STALE_DAYS) : snap.today,
          whyNow: "Stale past 2-day check cadence",
          audience: ["neeraj", "coordinator"],
        }
      );
    }
  }

  const rank = { high: 0, medium: 1 };
  return nudges.sort((a, b) => {
    const sa = rank[a.severity] - rank[b.severity];
    if (sa !== 0) return sa;
    const wa = a.when ?? "9999";
    const wb = b.when ?? "9999";
    return wa.localeCompare(wb);
  });
}

export const AUDIENCE_LABEL: Record<NudgeAudience, string> = {
  neeraj: "Planning",
  coordinator: "Coordinator",
  asset_team: "Assets",
  cps_lead: "Cps",
  pod_lead: "POD",
};

/** Strip PocketFM tokens from text before agency export. */
export function stripPocketFmRefs(text: string): string {
  return text
    .replace(/pocket\s*fm/gi, "[CLIENT]")
    .replace(/pocketfm/gi, "[CLIENT]");
}

/** Animation cannot start without these three asset-team links. */
export function assetHandoffReady(promo: Promo): {
  ready: boolean;
  missing: string[];
} {
  const a = promo.assetTeam;
  if (!a) return { ready: false, missing: ["Asset Map", "Canvas Link", "Assets Drive"] };
  const missing: string[] = [];
  if (!a.assetMapLink) missing.push("Asset Map");
  if (!a.assetCanvasLink) missing.push("Canvas Link");
  if (!a.assetsDriveLink) missing.push("Assets Drive");
  return { ready: missing.length === 0, missing };
}

/**
 * Asset team's AUTHORITATIVE close = Corrections End Date (col AC) on the
 * Promos - Assets Master Sheet. Empty → asset work is not yet actually closed.
 * Spreadsheet epoch junk (e.g. 1/5/1900) is treated as empty.
 */
export function assetClosedDate(promo: Promo): string | null {
  const ac = promo.assetTeam?.correctionsEndDate?.trim();
  if (!ac) return null;
  if (/18\d\d|1900/.test(ac)) return null;
  return toIsoLoose(ac);
}

/**
 * Days late vs Neeraj's planned close (Pre Production Tracker), but only while
 * the asset team hasn't actually closed it (AC empty). Once AC is set, 0.
 */
export function preProdDelayDays(promo: Promo, today: string): number {
  const pp = promo.preProd;
  if (promo.trackerStatus === "Closed") return 0; // promo wrapped up
  if (!pp?.plannedDate || pp.status === "Done" || pp.closedDate) return 0;
  if (assetClosedDate(promo)) return 0; // asset team has actually closed it
  return daysLate(pp.plannedDate, today);
}

/**
 * When the promo's CPS (main animator) is free enough to pick this up —
 * max planned date across their other open CPS promos' asset closed/planned,
 * or today if they're free.
 */
export function animationFreeDate(snap: OpsSnapshot, promo: Promo): string | null {
  const cps = promo.cps;
  if (!cps) return null;
  const other = snap.promos.filter(
    (p) =>
      p.id !== promo.id &&
      p.trackerStatus !== "Closed" &&
      p.cps &&
      p.cps.toLowerCase() === cps.toLowerCase()
  );
  const dates: string[] = [];
  for (const p of other) {
    if (p.preProd?.closedDate || assetClosedDate(p)) continue; // assets done
    if (p.preProd?.plannedDate) dates.push(p.preProd.plannedDate);
    for (const part of snap.parts) {
      if (part.promoId === p.id && part.stage !== "delivered" && part.plannedDate) {
        dates.push(part.plannedDate);
      }
    }
  }
  if (dates.length === 0) return snap.today;
  return dates.sort().at(-1) ?? snap.today;
}

/** Planning signal: animation free on X → ask assets by X. */
export function assetsNeededBySuggestion(
  snap: OpsSnapshot,
  promo: Promo
): string | null {
  if (promo.preProd?.status === "Done" || promo.preProd?.closedDate || assetClosedDate(promo))
    return null;
  return animationFreeDate(snap, promo);
}
