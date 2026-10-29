import {
  MOCK_ANIMATORS,
  MOCK_ASSETS_SOURCE,
  MOCK_DAILY_LOGS,
  MOCK_PARTS,
  MOCK_PROMOS,
  MOCK_QUALITY_REVIEWS,
  MOCK_SOURCE,
  MOCK_THROUGHPUT_SOURCE,
  MOCK_TODAY,
  MOCK_WORKING_SOURCE,
} from "./mock-data";
import type { OpsAction, OpsSnapshot, PendingWrite } from "./types";

/**
 * In-memory ops store.
 * Day-to-day writes target Master Tracker (workingSource).
 * Master Sheet fields still queue to Dashverse<>PFM.
 */
let snapshot: OpsSnapshot = seed();

function seed(): OpsSnapshot {
  return {
    today: MOCK_TODAY,
    live: false,
    source: structuredClone(MOCK_SOURCE),
    workingSource: structuredClone(MOCK_WORKING_SOURCE),
    assetsSource: structuredClone(MOCK_ASSETS_SOURCE),
    throughputSource: structuredClone(MOCK_THROUGHPUT_SOURCE),
    promos: structuredClone(MOCK_PROMOS),
    parts: structuredClone(MOCK_PARTS),
    animators: structuredClone(MOCK_ANIMATORS),
    qualityReviews: structuredClone(MOCK_QUALITY_REVIEWS),
    dailyLogs: structuredClone(MOCK_DAILY_LOGS),
    pendingWrites: [],
    dismissedNudgeIds: [],
    plannerCells: [],
    planRemarks: [],
    cpsRoster: [
      ...new Set(
        MOCK_PROMOS.map((p) => p.cps).filter((c): c is string => Boolean(c))
      ),
    ].sort(),
  };
}

let liveHydrated = false;

export function markLiveHydrated(): void {
  liveHydrated = true;
  snapshot.live = true;
}

export function hasLiveHydration(): boolean {
  return liveHydrated;
}

export function getSnapshot(): OpsSnapshot {
  return { ...structuredClone(snapshot), live: liveHydrated };
}

/** Replace the live store with a snapshot loaded from Sheets (or elsewhere). */
export function hydrate(next: OpsSnapshot): void {
  snapshot = structuredClone(next);
}

export type ApplyOpts = {
  /**
   * When false, mutate state only (used when replaying DB queue after Sheets load).
   * When true (default), also append a local pending-write row.
   */
  recordWrite?: boolean;
  /** Prefer this id/at when recording (e.g. row already saved in Supabase). */
  writeMeta?: { id: string; at: string };
};

function queueWrite(
  action: OpsAction,
  target: string,
  opts?: ApplyOpts
): PendingWrite | null {
  if (opts?.recordWrite === false) return null;
  const write: PendingWrite = {
    id: opts?.writeMeta?.id ?? `w-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: opts?.writeMeta?.at ?? new Date().toISOString(),
    action,
    target,
    status: "pending",
  };
  snapshot.pendingWrites = [write, ...snapshot.pendingWrites].slice(0, 80);
  return write;
}

/** Last sheet target string used by applyAction — for DB enqueue. */
let lastWriteTarget: string | null = null;
export function consumeLastWriteTarget(): string | null {
  const t = lastWriteTarget;
  lastWriteTarget = null;
  return t;
}

function touchTracker(promoId: string) {
  const promo = snapshot.promos.find((p) => p.id === promoId);
  if (promo) promo.lastTrackerUpdateAt = snapshot.today;
}

function ensurePreProd(promoId: string) {
  const promo = snapshot.promos.find((p) => p.id === promoId);
  if (!promo) return null;
  if (!promo.preProd) {
    promo.preProd = {
      status: "WIP",
      artist: null,
      totalAssets: null,
      startDate: null,
      plannedDate: null,
      closedDate: null,
      calculatedPlannedDate: null,
      remarksLog: [],
      pickedAt: null,
      delayFlagged: false,
      assetsNeededBy: null,
    };
  }
  return promo;
}

export function applyAction(action: OpsAction, opts: ApplyOpts = {}): OpsSnapshot {
  const q = (target: string) => {
    lastWriteTarget = target;
    queueWrite(action, target, opts);
  };
  switch (action.type) {
    case "reassign": {
      const part = snapshot.parts.find((p) => p.id === action.partId);
      if (part) {
        part.artists = [{ artistId: action.toArtistId, share: 1 }];
        part.artist =
          snapshot.animators.find((a) => a.id === action.toArtistId)?.name ?? part.artist;
        part.assignedAt = snapshot.today;
        q("Production Tracker · Artist (col H)");
      }
      break;
    }
    case "flag": {
      const part = snapshot.parts.find((p) => p.id === action.partId);
      if (part) {
        part.flagged = action.flagged;
        q("Master Tracker · Flag");
      }
      break;
    }
    case "escalate": {
      const part = snapshot.parts.find((p) => p.id === action.partId);
      if (part) {
        part.flagged = true;
        part.blocked = true;
        part.blockReason = action.note || part.blockReason || "Escalated";
        const promo = snapshot.promos.find((p) => p.id === part.promoId);
        if (promo) {
          promo.remarks = promo.remarks
            ? `${promo.remarks}\n[escalate] ${action.note}`
            : `[escalate] ${action.note}`;
          touchTracker(promo.id);
        }
        q("Master Tracker · Remarks");
      }
      break;
    }
    case "unblock": {
      const part = snapshot.parts.find((p) => p.id === action.partId);
      if (part) {
        part.blocked = false;
        part.blockReason = null;
        q("Master Tracker · Unblock");
      }
      break;
    }
    case "set_master_status": {
      const promo = snapshot.promos.find((p) => p.id === action.promoId);
      if (promo) {
        promo.status = action.status;
        q("Master Sheet · Status (col Z)");
      }
      break;
    }
    case "set_priority": {
      const promo = snapshot.promos.find((p) => p.id === action.promoId);
      if (promo) {
        promo.priority = action.priority;
        q("Master Tracker · Priority");
        touchTracker(promo.id);
      }
      break;
    }
    case "append_comment": {
      const promo = snapshot.promos.find((p) => p.id === action.promoId);
      if (promo) {
        const stamp = snapshot.today;
        promo.comments = promo.comments
          ? `${promo.comments}\n[${stamp}] ${action.comment}`
          : `[${stamp}] ${action.comment}`;
        q("Master Sheet · Comments (col O)");
      }
      break;
    }
    case "set_tracker_status": {
      const promo = snapshot.promos.find((p) => p.id === action.promoId);
      if (promo) {
        promo.trackerStatus = action.status;
        touchTracker(promo.id);
        q("Master Tracker · Status");
      }
      break;
    }
    case "set_cps": {
      const promo = snapshot.promos.find((p) => p.id === action.promoId);
      if (promo) {
        promo.cps = action.cps;
        touchTracker(promo.id);
        q("Master Tracker · Cps");
      }
      break;
    }
    case "append_remarks": {
      const promo = snapshot.promos.find((p) => p.id === action.promoId);
      if (promo) {
        const stamp = snapshot.today;
        promo.remarks = promo.remarks
          ? `${promo.remarks}\n[${stamp}] ${action.remarks}`
          : `[${stamp}] ${action.remarks}`;
        touchTracker(promo.id);
        q("Master Tracker · Remarks (col L)");
      }
      break;
    }
    case "set_initial_duration": {
      const promo = snapshot.promos.find((p) => p.id === action.promoId);
      if (promo) {
        promo.initialDurationSec = action.durationSec;
        touchTracker(promo.id);
        q("Master Tracker · Initial Duration (col H)");
      }
      break;
    }
    case "set_script_link": {
      const promo = snapshot.promos.find((p) => p.id === action.promoId);
      if (promo) {
        if (action.which === "working") promo.workingScriptLink = action.url || null;
        if (action.which === "agency") promo.agencyScriptLink = action.url || null;
        if (action.which === "demarcated") promo.demarcatedScriptLink = action.url || null;
        touchTracker(promo.id);
        const col =
          action.which === "working" ? "I · Script" : action.which === "agency" ? "J · Agency script" : "K · Demarcated";
        q(`Master Tracker · ${col}`);
      }
      break;
    }
    case "dismiss_nudge": {
      if (!snapshot.dismissedNudgeIds.includes(action.nudgeId)) {
        snapshot.dismissedNudgeIds = [...snapshot.dismissedNudgeIds, action.nudgeId];
      }
      break;
    }
    case "set_preprod_status": {
      const promo = ensurePreProd(action.promoId);
      if (promo?.preProd) {
        // Single asset-status field — Pre Production Tracker · Status (col C).
        // Production Tracker col J is the same concept; we do not write/read it.
        promo.preProd.status = action.status;
        q("Pre Production Tracker · Status (col C)");
      }
      break;
    }
    case "set_preprod_artist": {
      const promo = ensurePreProd(action.promoId);
      if (promo?.preProd) {
        promo.preProd.artist = action.artist;
        q("Pre Production Tracker · Artist (col D)");
      }
      break;
    }
    case "set_preprod_dates": {
      const promo = ensurePreProd(action.promoId);
      if (promo?.preProd) {
        if (action.startDate !== undefined) promo.preProd.startDate = action.startDate;
        if (action.plannedDate !== undefined) promo.preProd.plannedDate = action.plannedDate;
        if (action.closedDate !== undefined) promo.preProd.closedDate = action.closedDate;
        // calculated planned ignored for now (Neeraj 2026-10-27)
        q("Pre Production Tracker · Dates (F–H)");
      }
      break;
    }
    case "mark_assets_picked": {
      const promo = ensurePreProd(action.promoId);
      if (promo?.preProd) {
        promo.preProd.pickedAt = action.pickedAt;
        q("Pre Production Tracker · Picked (dashboard → sheet TBD)");
      }
      break;
    }
    case "set_delay_flag": {
      const promo = ensurePreProd(action.promoId);
      if (promo?.preProd) {
        promo.preProd.delayFlagged = action.flagged;
        q("Pre Production Tracker · Delay flag");
      }
      break;
    }
    case "set_assets_needed_by": {
      const promo = ensurePreProd(action.promoId);
      if (promo?.preProd) {
        promo.preProd.assetsNeededBy = action.date;
        q("Pre Production Tracker · Assets needed by (from anim free)");
      }
      break;
    }
    case "append_preprod_remark": {
      const promo = ensurePreProd(action.promoId);
      if (promo?.preProd) {
        promo.preProd.remarksLog = [
          ...promo.preProd.remarksLog,
          {
            id: `pr-${Date.now()}`,
            at: snapshot.today,
            body: action.body,
          },
        ];
        q("Pre Production Tracker · Remarks (col I, append)");
      }
      break;
    }
    case "set_part_stage": {
      const part = snapshot.parts.find((p) => p.id === action.partId);
      if (part) {
        part.stage = action.stage;
        if (action.stage === "delivered") {
          part.closedAt = snapshot.today;
          part.status = part.status === "Done" ? part.status : "Done";
        }
        q("Production Tracker · Stage (col D)");
      }
      break;
    }
    case "set_part_status": {
      const part = snapshot.parts.find((p) => p.id === action.partId);
      if (part) {
        part.status = action.status;
        q("Production Tracker · Status (col E)");
      }
      break;
    }
    case "set_part_team": {
      const part = snapshot.parts.find((p) => p.id === action.partId);
      if (part) {
        part.team = action.team;
        q("Production Tracker · Team (col G)");
      }
      break;
    }
    case "set_part_artist": {
      const part = snapshot.parts.find((p) => p.id === action.partId);
      if (part) {
        part.artist = action.artist;
        const match = snapshot.animators.find(
          (a) => a.name.toLowerCase() === action.artist.toLowerCase()
        );
        if (match) part.artists = [{ artistId: match.id, share: 1 }];
        part.assignedAt = snapshot.today;
        q("Production Tracker · Artist (col H)");
      }
      break;
    }
    case "set_part_editor": {
      const part = snapshot.parts.find((p) => p.id === action.partId);
      if (part) {
        part.editors = action.editors;
        q("Production Tracker · Editors (col I)");
      }
      break;
    }
    case "set_part_dates": {
      const part = snapshot.parts.find((p) => p.id === action.partId);
      if (part) {
        if (action.deadline !== undefined) part.deadline = action.deadline;
        if (action.plannedPlottedDate !== undefined)
          part.plannedPlottedDate = action.plannedPlottedDate;
        if (action.aniStartDate !== undefined) part.aniStartDate = action.aniStartDate;
        if (action.aniCloseDate !== undefined) part.aniCloseDate = action.aniCloseDate;
        if (action.editCloseDate !== undefined) part.editCloseDate = action.editCloseDate;
        if (action.correctionStartDate !== undefined)
          part.correctionStartDate = action.correctionStartDate;
        if (action.correctionEndDate !== undefined)
          part.correctionEndDate = action.correctionEndDate;
        if (action.soundEndDate !== undefined) part.soundEndDate = action.soundEndDate;
        part.plannedDate = part.deadline ?? part.plannedPlottedDate;
        if (part.aniStartDate && part.aniCloseDate) {
          const a = new Date(`${part.aniStartDate}T00:00:00Z`).getTime();
          const b = new Date(`${part.aniCloseDate}T00:00:00Z`).getTime();
          part.days = Math.max(0, Math.round((b - a) / 86400000));
        }
        q("Production Tracker · Stage dates");
      }
      break;
    }
    case "set_part_remarks": {
      const part = snapshot.parts.find((p) => p.id === action.partId);
      if (part) {
        part.remarks = action.remarks;
        q("Production Tracker · Remarks (col AE)");
      }
      break;
    }
    case "record_plan_part":
      break;
    case "set_plan_cell": {
      // Persisted straight to the Planner tab by the adapter (not the write queue).
      const text = action.text.trim();
      const same = (c: (typeof snapshot.plannerCells)[number]) =>
        c.promoId === action.promoId && c.partNo === action.partNo && c.date === action.date;
      const rest = snapshot.plannerCells.filter((c) => !same(c));
      snapshot.plannerCells = text
        ? [
            ...rest,
            {
              promoId: action.promoId,
              partNo: action.partNo,
              date: action.date,
              text,
              updatedAt: snapshot.today,
            },
          ]
        : rest;
      break;
    }
    case "append_plan_remark": {
      const body = action.body.trim();
      if (!body) break;
      snapshot.planRemarks = [
        {
          promoId: action.promoId,
          partNo: action.partNo,
          body,
          at: action.at ?? new Date().toISOString(),
        },
        ...snapshot.planRemarks,
      ];
      break;
    }
  }
  return getSnapshot();
}

export function dropPlanRemark(promoId: string, at: string): void {
  snapshot.planRemarks = snapshot.planRemarks.filter(
    (r) => !(r.promoId === promoId && r.at === at)
  );
}

export function flushPendingWrites(): OpsSnapshot {
  snapshot.pendingWrites = snapshot.pendingWrites.map((w) =>
    w.status === "pending" ? { ...w, status: "synced" as const } : w
  );
  return getSnapshot();
}

export function setPendingWrites(writes: PendingWrite[]): void {
  snapshot.pendingWrites = writes;
}

export function setDismissedNudgeIds(ids: string[]): void {
  snapshot.dismissedNudgeIds = ids;
}

export function resetToMock(): OpsSnapshot {
  liveHydrated = false;
  snapshot = seed();
  return getSnapshot();
}
