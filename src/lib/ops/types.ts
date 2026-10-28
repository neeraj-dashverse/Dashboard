/**
 * PocketFM ops domain types.
 *
 * Promo-grain: Master Sheet, Master Tracker, Pre Production, Assets Master.
 * Part-grain: Production Tracker (Neeraj’s animation sheet — coordinator fills).
 */

/**
 * Internal pipeline keys — map 1:1 to Production Tracker Stage dropdown
 * (Planning & Plotting → planning, etc.). See PIPELINE_TO_SHEET_STAGE.
 */
export type PipelineStage =
  | "planning"
  | "animation"
  | "edit"
  | "correction"
  | "sound"
  | "delivered";

/** Legacy alias used by UI. */
export type Stage = PipelineStage;

export type TeamKind = "in_house" | "agency";
export type Priority = "P0" | "P1" | null;
export type PaymentStatus = "Paid" | "Paid Partially" | "Unpaid" | null;
export type TrackerStatus = "Closed" | "WIP" | "Paused" | string | null;

export type CreditShare = {
  artistId: string;
  share: number; // 0–1; shares on a part should sum to 1
};

/**
 * One Production Tracker row — promo × part.
 * Captured 2026-10-27; supersedes September calc-model mapping.
 */
export type Part = {
  id: string;
  /** Joins to Promo.id (Show_Name|Promo Name). */
  promoId: string;
  partNo: number; // C
  durationSec: number; // F Duration (planned)
  stage: PipelineStage; // D
  /** E — post-production status (WIP / nth Correction / Done). */
  status: string | null;
  team: TeamKind; // G
  /** H — animator name (sheet text). */
  artist: string | null;
  editors: string | null; // I
  /** J — reconcile vs Pre Production Status (open). */
  assetStatus: string | null;
  deadline: string | null; // K
  plannedPlottedDate: string | null; // L
  aniStartDate: string | null; // M
  aniCloseDate: string | null; // O
  editCloseDate: string | null; // R
  correctionStartDate: string | null; // S
  correctionEndDate: string | null; // T
  soundEndDate: string | null; // W
  days: number | null; // AD computed
  remarks: string | null; // AE
  workedDurationSec: number | null; // AF actual ≠ F

  /**
   * Credit shares for capacity math (may be multi-artist).
   * Prefer `artist` for the sheet’s single Artist cell.
   */
  artists: CreditShare[];
  /**
   * Pressure date for exceptions — prefers Deadline (K), else Planned plotted (L).
   */
  plannedDate: string | null;
  assignedAt: string | null;
  closedAt: string | null;
  blocked: boolean;
  blockReason: string | null;
  flagged: boolean;
};

/**
 * Master Sheet row — one promo/script.
 * Field names map 1:1 to sheet headers where possible.
 */
export type Promo = {
  id: string;
  /** Col A — join key with scriptName across every tab. */
  showName: string;
  /** Col B Script Name — join key. */
  scriptName: string;
  /** Alias for UI that still says promoName. */
  promoName: string;

  /** Col C Final asset Length as seconds (parsed from hh:mm:ss). */
  finalAssetLengthSec: number | null;
  /** Col AE Min — decimal minutes when present. */
  durationMin: number | null;

  received: boolean; // D
  openFiles: boolean; // E
  priority: Priority; // F
  /** Col G Stage — sheet language (Completed, YTS, …), not pipeline stage. */
  masterStage: string | null;
  canvasCompletionTimeline: string | null; // H
  canvasStatus: string | null; // I

  /** Col J — first 5-min preview due (milestone 1). */
  fiveMinTimeline: string | null;
  krockLink5Min: string | null; // K
  /** Col L Complete Deliverable — full delivery (milestone 2). */
  completeDeliverable: string | null;
  deliverableWithFinalCorrections: string | null; // M
  finalCorrectedFiles: string | null; // N

  comments: string | null; // O
  scriptLink: string | null; // P
  scriptFormatDone: boolean | null; // Q
  canvasLink: string | null; // R
  voSamples: string | null; // S
  videoSamples: string | null; // T
  showLink: string | null; // U
  synopsisLink: string | null; // V
  notes: string | null; // W

  openFilesReceived: boolean; // Y
  openFilesReceivedStatus: string | null; // Y chip
  status: string | null; // Z e.g. Delivered
  finalRendersLink: string | null; // AA
  projectFilesLink: string | null; // AB
  assetsLink: string | null; // AC
  perMin: number | null; // AD
  promoCost: number | null; // AF
  paymentStatus: PaymentStatus; // AG

  /**
   * @deprecated Prefer fiveMinTimeline / completeDeliverable.
   * Kept as the "next delivery pressure" date for ranking.
   */
  deliveryDate: string | null;

  // ── Master Tracker (Neeraj working copy) ──────────────────────────────
  /** Closed / WIP / Paused — Neeraj's ops status (not Master Sheet Stage). */
  trackerStatus: TrackerStatus;
  /**
   * Cps = Creative Producer (director-like). Only Aman | Divakar.
   * Also scores Master Productivity quality reviews.
   */
  cps: string | null;
  /**
   * @deprecated Removed from Master Tracker 2026-10-27.
   * First 5 min = Part 1 work — use part1Artist() / Part 1 assignment.
   */
  first5MinAnimator?: string | null;
  /** Free-text status of the 5-min delivery on Part 1 ("1:30min covered by 6pm"). */
  fiveMinStatus: string | null;
  /** Original planned duration hh:mm:ss → seconds. */
  initialDurationSec: number | null;
  /**
   * Three distinct script artifacts (all must be PFM-stripped for agency):
   * safety copy, agency-facing sanitized, part-demarcated sanitized.
   */
  workingScriptLink: string | null;
  agencyScriptLink: string | null;
  demarcatedScriptLink: string | null;
  remarks: string | null;
  totalAssetMade: number | null;
  totalAssetGenerated: number | null;
  creditPerMinInhouse: number | null;
  /** ISO date of last tracker field touch — drives "chase me" nudges. */
  lastTrackerUpdateAt: string | null;

  /**
   * Asset team's Promos - Assets Master Sheet row (joined by show|script).
   * Critical handoff for animation: assetMapLink, assetCanvasLink, assetsDriveLink.
   */
  assetTeam: AssetTeamRow | null;

  /**
   * Neeraj's Pre Production Tracker ("my asset sheet") — simplified asset progress
   * used to plan when animation can pick up.
   */
  preProd: PreProdAssetRow | null;
};

/** Append-only remark entry (not a single overwritable cell). */
export type RemarkEntry = {
  id: string;
  at: string; // ISO date or datetime
  body: string;
};

/**
 * PFM_dashboard_Timeline · Pre Production Tracker.
 * Status: Done / WIP / Nil / Correction.
 */
export type PreProdAssetRow = {
  status: "Done" | "WIP" | "Nil" | "Correction" | string | null;
  artist: string | null;
  totalAssets: number | null;
  startDate: string | null;
  plannedDate: string | null;
  closedDate: string | null;
  /** Sheet formula column — read-only. */
  calculatedPlannedDate: string | null;
  /** Running log — multiple entries over time. */
  remarksLog: RemarkEntry[];
  /**
   * When animation actually picked up the assets (dashboard field;
   * write-back target TBD — not a native sheet col yet).
   */
  pickedAt: string | null;
  /** Manual delay flag Neeraj can set. */
  delayFlagged: boolean;
  /**
   * Deadline pushed to asset team from animator free-date
   * ("animation free on X → assets needed by X").
   */
  assetsNeededBy: string | null;
};

/**
 * From PFM Dashboard - Assets · Promos - Assets Master Sheet.
 * Ignore the first Start/End Date pair (cols N–O); use Y–Z only.
 */
export type AssetTeamRow = {
  assetsStatus: string | null;
  remarks: string | null;
  /** Critical for animation handoff. */
  assetMapLink: string | null;
  assetCanvasLink: string | null;
  assetsDriveLink: string | null;
  artist1: string | null;
  artist2: string | null;
  artist3: string | null;
  artLead: string | null;
  /** Authoritative dates (cols Y–Z), not the earlier duplicate pair. */
  startDate: string | null;
  endDate: string | null;
  totalDays: number | null;
  correctionsStartDate: string | null;
  correctionsEndDate: string | null;
  correctionsTotalDays: number | null;
  productionDays: number | null;
  costing: number | null;
  /** Free-text breakdown e.g. "Locations: 23 / Primary Char.: 2 …" */
  assetsCount: string | null;
  dashverseNotes: string | null;
  synopsis: string | null;
  notes: string | null;
};

export type Animator = {
  id: string;
  name: string;
  team: TeamKind;
  minutesPerWeek: number;
  onTimePct: number;
};

export type OpsAction =
  | { type: "reassign"; partId: string; toArtistId: string }
  | { type: "flag"; partId: string; flagged: boolean }
  | { type: "escalate"; partId: string; note: string }
  | { type: "unblock"; partId: string }
  | { type: "set_master_status"; promoId: string; status: string }
  | { type: "set_priority"; promoId: string; priority: Priority }
  | { type: "append_comment"; promoId: string; comment: string }
  | { type: "set_tracker_status"; promoId: string; status: string }
  | { type: "set_cps"; promoId: string; cps: string }
  | { type: "append_remarks"; promoId: string; remarks: string }
  | { type: "set_initial_duration"; promoId: string; durationSec: number | null }
  | {
      type: "set_script_link";
      promoId: string;
      which: "working" | "agency" | "demarcated";
      url: string;
    }
  | { type: "dismiss_nudge"; nudgeId: string }
  | { type: "set_preprod_status"; promoId: string; status: string }
  | { type: "set_preprod_artist"; promoId: string; artist: string }
  | {
      type: "set_preprod_dates";
      promoId: string;
      startDate?: string | null;
      plannedDate?: string | null;
      closedDate?: string | null;
    }
  | { type: "mark_assets_picked"; promoId: string; pickedAt: string | null }
  | { type: "set_delay_flag"; promoId: string; flagged: boolean }
  | { type: "set_assets_needed_by"; promoId: string; date: string | null }
  | { type: "append_preprod_remark"; promoId: string; body: string }
  | { type: "set_part_stage"; partId: string; stage: PipelineStage }
  | { type: "set_part_status"; partId: string; status: string }
  | { type: "set_part_team"; partId: string; team: TeamKind }
  | { type: "set_part_artist"; partId: string; artist: string }
  | { type: "set_part_editor"; partId: string; editors: string }
  | {
      type: "set_part_dates";
      partId: string;
      deadline?: string | null;
      plannedPlottedDate?: string | null;
      aniStartDate?: string | null;
      aniCloseDate?: string | null;
      editCloseDate?: string | null;
      correctionStartDate?: string | null;
      correctionEndDate?: string | null;
      soundEndDate?: string | null;
    }
  | { type: "set_part_remarks"; partId: string; remarks: string }
  | {
      type: "set_plan_cell";
      promoId: string;
      partNo: number;
      date: string;
      text: string;
      showName?: string;
      promoName?: string;
    }
  /** Append one remark. Stored as its own row on the Remarks tab. */
  | {
      type: "append_plan_remark";
      promoId: string;
      partNo: number;
      body: string;
      at?: string;
      showName?: string;
      promoName?: string;
    };

/**
 * One planner grid cell Neeraj fills ("assets", "first cut", "R&C"…) after
 * talking to the asset / animation teams. Persisted to the `Planner` tab.
 */
export type PlannerCell = {
  promoId: string;
  /** 0 = promo-level row (promo has no Production Tracker parts yet). */
  partNo: number;
  /** ISO yyyy-mm-dd */
  date: string;
  text: string;
  updatedAt: string;
};

/** One saved remark. Append-only — delays and issues stack, they don't replace. */
export type PlanRemark = {
  promoId: string;
  partNo: number;
  body: string;
  at: string;
};

export type PendingWrite = {
  id: string;
  at: string;
  action: OpsAction;
  /** Real tab/column target once Sheets write-back is wired. */
  target: string;
  status: "pending" | "synced" | "error";
};

export type SheetSource = {
  spreadsheetId: string;
  spreadsheetName: string;
  masterTab: string;
  url: string;
};

/** Time-aware chase prompts — anchored to real dates when possible. */
export type NudgeKind =
  | "missing_cps"
  | "missing_part1_artist"
  | "stale_status"
  | "missing_five_min_status"
  | "missing_remarks"
  | "missing_initial_duration"
  | "missing_working_script"
  | "missing_agency_script"
  | "missing_demarcated_script"
  | "missing_asset_handoff"
  | "missing_preprod_planned"
  | "assets_delay"
  | "assets_needed_by"
  | "five_min_due"
  | "complete_due"
  | "part_deadline"
  | "check_tomorrow";

/** Who should act — multi-role dashboard, not Neeraj-only. */
export type NudgeAudience =
  | "neeraj"
  | "coordinator"
  | "asset_team"
  | "cps_lead"
  | "pod_lead";

export type OpsNudge = {
  id: string;
  promoId: string;
  kind: NudgeKind;
  prompt: string;
  severity: "high" | "medium";
  /** ISO date this prompt is about (deadline / free-at / planned). */
  when: string | null;
  /** One-line: why this is relevant *now*. */
  whyNow: string;
  audience: NudgeAudience[];
};

/**
 * One Animation productivity · Master data row (artist × promo × day).
 * Throughput source — separate from QualityReview (CPS rubric).
 */
export type DailyThroughputLog = {
  id: string;
  /** ISO yyyy-mm-dd after normalize. */
  date: string;
  /** Raw date cell before normalize (audit). */
  dateRaw: string;
  podLead: string | null;
  artist: string;
  showName: string;
  promoName: string;
  partsWorked: number | null;
  /**
   * Split from sheet col G (was one conflated dropdown).
   * correction days: durationBucket null, midpointMin 0 — active_days policy open.
   */
  workType: "new" | "correction";
  durationBucket: "<3" | "3-5" | null;
  /** Midpoint minutes for throughput math (0 for correction until policy set). */
  outputMinutes: number;
  remarks: string | null;
};

/**
 * One Master Productivity row — CPS quality review of a part (often per revision pass).
 * Throughput stays separate (daily log / calc model); do not blend into one score.
 */
export type QualityReview = {
  id: string;
  promoId: string;
  partNo: number;
  krockLink: string | null;
  /** Who scored — Aman or Divakar. */
  cps: string;
  animators: string[];
  editors: string[];
  /** e.g. "1st", "2nd", "4th" — pass matters for interpreting scores. */
  versionCorrection: string | null;
  animation: {
    overallQuality: number | null; // 1–5
    scriptKnowledge: number | null;
    correctionsUnderstood: number | null;
    skinTextures: number | null;
    shotContinuity: number | null;
    cameraShots: number | null;
    /** Itemized per-shot critique — keep as log, do not summarize away. */
    weakAreas: string | null;
    remark: string | null;
  } | null;
  editing: {
    storytelling: number | null;
    preemptiveEffort: number | null;
    shotPlacementFlow: number | null;
    colorConsistency: number | null;
    technical: number | null;
    remark: string | null;
  } | null;
};

export type OpsSnapshot = {
  today: string;
  /** True when this snapshot was hydrated from Google Sheets. */
  live: boolean;
  /** Dashverse<>PFM Master Sheet */
  source: SheetSource;
  /** Neeraj Master Tracker — primary write target for day-to-day ops */
  workingSource: SheetSource;
  /** Asset team's Promos - Assets Master Sheet */
  assetsSource: SheetSource;
  promos: Promo[];
  parts: Part[];
  animators: Animator[];
  /** Master Productivity — CPS quality reviews (read). */
  qualityReviews: QualityReview[];
  /** Animation productivity · Master data — daily throughput log (read). */
  dailyLogs: DailyThroughputLog[];
  /** Animation productivity spreadsheet meta. */
  throughputSource: SheetSource;
  pendingWrites: PendingWrite[];
  dismissedNudgeIds: string[];
  /**
   * Distinct Cps names seen on Master Tracker (not a hard-coded roster).
   * Neeraj updates who is Cps on the sheet — UI picks from this list.
   */
  cpsRoster: string[];
  /** Planner grid entries (Planner tab in the Timeline sheet). */
  plannerCells: PlannerCell[];
  /** One row each on the Timeline sheet's Remarks tab. Never overwritten. */
  planRemarks: PlanRemark[];
};

/** Stable join key — must match across Master / PocketFM / Assets. */
export function promoJoinKey(showName: string, scriptName: string): string {
  return `${showName.trim().toLowerCase()}|${scriptName.trim().toLowerCase()}`;
}
