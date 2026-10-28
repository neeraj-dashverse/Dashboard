/**
 * Known spreadsheet sources (v11, 2026-10-27).
 * Schema index: README.md + eight pfm-*-schema.md docs.
 *
 * Join across all: Show_Name + Script/Promo Name (normalized).
 *
 * 1. Dashverse<>PFM · Master Sheet — pfm-master-tab-schema.md
 * 2. Timeline · Master Tracker — pfm-master-tracker-schema.md
 * 3. Assets · Promos - Assets Master — pfm-asset-team-sheet-schema.md
 * 4. Timeline · Pre Production Tracker — pfm-my-asset-sheet-schema.md
 * 5. Timeline · Production Tracker — pfm-production-tracker-schema.md
 * 6. Timeline · Planning for promos — DEFERRED — pfm-planning-for-promos-schema.md
 * 7. Timeline · Master Productivity — pfm-master-productivity-schema.md (quality)
 * 8. Animation productivity · Master data — pfm-animation-productivity-schema.md (throughput log)
 *
 * Master Sheet ↔ Master Tracker relationship still unconfirmed.
 * Cps = Creative Producer (Aman | Divakar only). Quality ≠ throughput.
 * Locked decisions: pfm-decisions-locked.md (neeraj.d@dashverse.ai).
 */

/**
 * Intended writers per surface — permissions discussion before live write-back.
 * v1 UI may stay Neeraj-only; do not assume one role forever.
 */
export const WRITE_ROLES = {
  neeraj: {
    surfaces: ["Master Tracker A–L", "Pre Production (my asset sheet)", "planning decisions"],
  },
  coordinator: {
    surfaces: ["Production Tracker day-to-day stage/dates/artist/editor"],
  },
  asset_team: {
    surfaces: ["Promos - Assets Master Sheet (their sheet)"],
  },
  cps_lead: {
    surfaces: ["Master Productivity quality scoring"],
    roster: ["Aman", "Divakar"] as const,
    note: "Creative Producers — not a formal nudge matrix (Neeraj: nothing like that)",
  },
  pod_lead: {
    surfaces: ["Animation productivity · Master data (daily throughput log)"],
  },
} as const;

/** Contact for sheet share / ops. */
export const OPS_CONTACT_EMAIL = "neeraj.d@dashverse.ai";

/**
 * Daily animation throughput log — separate from Timeline Master Productivity (quality).
 * See pfm-animation-productivity-schema.md.
 */
export const ANIMATION_PRODUCTIVITY_SHEET = {
  spreadsheetId: "1U6fvzf9Fe9ydjCP-lbNoQFjklaPt62-ESxG8Ummh7-s",
  spreadsheetName: "Animation productivity",
  url: "https://docs.google.com/spreadsheets/d/1U6fvzf9Fe9ydjCP-lbNoQFjklaPt62-ESxG8Ummh7-s/edit?gid=0",
  tabs: {
    masterData: {
      name: "Master data",
      gid: 0,
      grain: "artist_promo_day" as const,
      role: "throughput_log" as const,
    },
    dropDowns: { name: "Drop downs", gid: null },
    promoNames: { name: "Promo names", gid: null },
    sheet4: { name: "Sheet4", gid: null },
  },
} as const;

export const ANIMATION_PRODUCTIVITY_COLUMNS = [
  { col: "A", key: "date", header: "Date", role: "join" as const, note: "Normalize formats on ingest" },
  { col: "B", key: "podLead", header: "POD lead", role: "read" as const },
  { col: "C", key: "artist", header: "Artist", role: "join" as const },
  { col: "D", key: "showName", header: "Show Name", role: "join" as const },
  { col: "E", key: "promoName", header: "Promo Name", role: "join" as const },
  { col: "F", key: "partsWorked", header: "Parts Worked", role: "read" as const },
  {
    col: "G",
    key: "durationWorkedDay",
    header: "Duration worked/day",
    role: "read" as const,
    note: "Buckets + 'correction' — split workType vs durationBucket in app",
  },
  { col: "H", key: "remarks", header: "Remarks", role: "read" as const },
] as const;

/** Sheet dropdown values for Duration worked/day → modeled fields. */
export const DURATION_WORKED_BUCKETS = {
  "<3": { label: "Less than 3 min", workType: "new" as const, midpointMin: 1.5 },
  "3-5": { label: "3 - 5 min", workType: "new" as const, midpointMin: 4 },
  correction: { label: "correction", workType: "correction" as const, midpointMin: 0 },
} as const;

export const DASHVERSE_PFM_SHEET = {
  spreadsheetId: "1-2MmgaVf4-lpJ4vu-p_9TB1J8ig4vn4yvz2K2Mft3vA",
  spreadsheetName: "Dashverse<>PFM",
  url: "https://docs.google.com/spreadsheets/d/1-2MmgaVf4-lpJ4vu-p_9TB1J8ig4vn4yvz2K2Mft3vA/edit",
  tabs: {
    master: { name: "Master Sheet", gid: 0, grain: "promo" as const },
    requirements: { name: "Requirements", gid: null },
    queries: { name: "Queries", gid: null },
    emailIds: { name: "Email_Ids", gid: null },
  },
} as const;

/** Neeraj's working spreadsheet — primary surface for day-to-day ops writes. */
export const PFM_TIMELINE_SHEET = {
  spreadsheetId: "1Tm1CLtoJmbUjVXHIpf969Y3RLsbKLaw4HhxDxcJ0wbs",
  spreadsheetName: "PFM_dashboard_Timeline",
  url: "https://docs.google.com/spreadsheets/d/1Tm1CLtoJmbUjVXHIpf969Y3RLsbKLaw4HhxDxcJ0wbs/edit?gid=1082254307",
  tabs: {
    masterTracker: {
      name: "Master Tracker",
      gid: 1082254307,
      grain: "promo" as const,
      role: "neeraj_working_copy" as const,
    },
    productionTracker: {
      name: "Production Tracker",
      gid: 0,
      grain: "part" as const,
      role: "neeraj_animation_sheet" as const,
      note: "Coordinator day-to-day fill; Neeraj reviews",
    },
    /**
     * Day-by-day Gantt (promo × part × date cells).
     * Deferred — managers should see this in the dashboard later;
     * do not build a full calendar UI until Neeraj revisits design.
     * See pfm-planning-for-promos-schema.md.
     */
    planningForPromos: {
      name: "Planning for promos",
      gid: 732058759,
      grain: "part" as const,
      role: "schedule_grid" as const,
      priority: "deferred" as const,
    },
    timelinePlanning: { name: "Timeline Planning", gid: null },
    partWiseSplit: { name: "Part wise split", gid: null },
    dropdowns: { name: "Dropdowns", gid: null },
    preProductionTracker: {
      name: "Pre Production Tracker",
      gid: 696372285,
      grain: "promo" as const,
      role: "neeraj_asset_sheet" as const,
    },
    files: { name: "Files", gid: null },
    masterProductivity: {
      name: "Master Productivity",
      gid: 1806452589,
      grain: "part" as const,
      role: "quality_scoring" as const,
      note: "CPS-scored quality — separate from throughput",
    },
    creditUsed: { name: "Credit Used", gid: null },
    myDailyUpdates: { name: "My daily updates", gid: null },
    // More tabs exist (Sheet23–25, Plannings, etc.)
  },
} as const;

/**
 * Master Productivity — CPS quality rubric (read for Team view).
 * Do not blend with throughput into a single score.
 */
export const MASTER_PRODUCTIVITY_COLUMNS = {
  identity: [
    "Show Name",
    "Promo Name",
    "Part",
    "Krock link",
    "Cps",
    "Animators",
    "Editors",
  ] as const,
  animation: [
    "Version/Correction",
    "Overall Quality",
    "Script Knowledge",
    "All correction where artist able to understand",
    "Skin Textures",
    "Shot/Scene continuity",
    "Camera/shots used",
    "Weak Areas",
    "Remark",
  ] as const,
  editing: [
    "Version/Correction",
    "Storytelling",
    "Preemptive effort",
    "Shot placement/flow",
    "Color Consistency",
    "Technical",
    "Remark",
  ] as const,
} as const;

/**
 * Neeraj's Pre Production Tracker ("my asset sheet") — same spreadsheet as Master Tracker.
 * Two-way for status / dates / picked / remarks log. Calculated planned is formula (read).
 */
export const PRE_PRODUCTION_COLUMNS = [
  { col: "A", key: "showName", header: "Show_Name", role: "join" as const },
  { col: "B", key: "promoName", header: "Promo Name", role: "join" as const },
  { col: "C", key: "status", header: "Status", role: "two_way" as const },
  { col: "D", key: "artist", header: "Artist", role: "two_way" as const },
  { col: "E", key: "totalAssets", header: "Total Assets", role: "two_way" as const },
  { col: "F", key: "startDate", header: "Start date", role: "two_way" as const },
  { col: "G", key: "plannedDate", header: "Planned date", role: "two_way" as const },
  { col: "H", key: "closedDate", header: "Closed date", role: "two_way" as const },
  { col: "I", key: "remarks", header: "Remarks", role: "two_way" as const, note: "Append-only log in app" },
  {
    col: "J",
    key: "calculatedPlannedDate",
    header: "Calculated planned date",
    role: "ignore" as const,
    note: "Not needed for now (2026-10-27)",
  },
] as const;

/** Master Sheet columns A→AH (X and AH headers unconfirmed). */
export const MASTER_COLUMNS = [
  { col: "A", key: "showName", header: "Show_Name", role: "join" },
  { col: "B", key: "scriptName", header: "Script Name", role: "join" },
  { col: "C", key: "finalAssetLength", header: "Final asset Length", role: "read" },
  { col: "D", key: "received", header: "Received", role: "two_way" },
  { col: "E", key: "openFiles", header: "Open Files", role: "two_way" },
  { col: "F", key: "priority", header: "Priority", role: "two_way" },
  { col: "G", key: "masterStage", header: "Stage", role: "two_way" },
  { col: "H", key: "canvasCompletionTimeline", header: "Canvas Completion Timeline", role: "two_way" },
  { col: "I", key: "canvasStatus", header: "Canvas Status", role: "two_way" },
  { col: "J", key: "fiveMinTimeline", header: "5 mins timeline", role: "two_way" },
  { col: "K", key: "krockLink5Min", header: "Krock Link - 5 mins", role: "two_way" },
  { col: "L", key: "completeDeliverable", header: "Complete Deliverable", role: "two_way" },
  { col: "M", key: "deliverableWithFinalCorrections", header: "Deliverable with final corrections", role: "two_way" },
  { col: "N", key: "finalCorrectedFiles", header: "Final Corrected files", role: "two_way" },
  { col: "O", key: "comments", header: "Comments", role: "two_way" },
  { col: "P", key: "scriptLink", header: "Script", role: "read" },
  { col: "Q", key: "scriptFormatDone", header: "Script Format Done?", role: "two_way" },
  { col: "R", key: "canvasLink", header: "Canvas", role: "read" },
  { col: "S", key: "voSamples", header: "VO IDs / Samples / Full VO", role: "read" },
  { col: "T", key: "videoSamples", header: "Video Samples", role: "read" },
  { col: "U", key: "showLink", header: "Show Link", role: "read" },
  { col: "V", key: "synopsisLink", header: "Synopsis", role: "read" },
  { col: "W", key: "notes", header: "Notes", role: "two_way" },
  { col: "X", key: "unknownX", header: "(unconfirmed)", role: "unknown" },
  { col: "Y", key: "openFilesReceived", header: "Open Files Received", role: "two_way" },
  { col: "Z", key: "status", header: "Status", role: "two_way" },
  { col: "AA", key: "finalRendersLink", header: "Final Renders", role: "two_way" },
  { col: "AB", key: "projectFilesLink", header: "Project Files", role: "two_way" },
  { col: "AC", key: "assetsLink", header: "Assets", role: "two_way" },
  { col: "AD", key: "perMin", header: "Per Min", role: "read" },
  { col: "AE", key: "durationMin", header: "Min", role: "read" },
  { col: "AF", key: "promoCost", header: "Promo cost", role: "read" },
  { col: "AG", key: "paymentStatus", header: "Payment status", role: "read" },
  { col: "AH", key: "unknownAH", header: "(likely running total)", role: "unknown" },
] as const;

/**
 * Master Tracker columns (Neeraj working copy).
 * v8 (2026-10-27): A–L two-way now; M–O read-only (may become computed later).
 *
 * Confidentiality: Script / Agency script / Demarcated script must never
 * carry a "PocketFM" reference when shared with outside agencies.
 */
export const MASTER_TRACKER_COLUMNS = [
  { col: "A", key: "showName", header: "Show_Name", role: "join" as const },
  { col: "B", key: "promoName", header: "Promo Name", role: "join" as const },
  { col: "C", key: "trackerStatus", header: "Status", role: "two_way" as const },
  { col: "D", key: "priority", header: "Priority", role: "two_way" as const },
  { col: "E", key: "cps", header: "Cps", role: "two_way" as const, note: "Creative Producer — Aman | Divakar only" },
  {
    col: "F",
    key: "first5MinAnimator",
    header: "First 5min animator (REMOVED)",
    role: "removed" as const,
    note: "2026-10-27 — derive from Part 1 artist; do not track or write",
  },
  { col: "G", key: "fiveMinStatus", header: "Status (5-min delivery)", role: "ignore" as const, note: "Not needed (Neeraj 2026-10-28) — not shown or written" },
  { col: "H", key: "initialDurationSec", header: "Initial Duration", role: "two_way" as const },
  { col: "I", key: "workingScriptLink", header: "Script", role: "two_way" as const, note: "PFM-stripped safety copy" },
  { col: "J", key: "agencyScriptLink", header: "Agency script", role: "two_way" as const, note: "Sanitized for agency" },
  { col: "K", key: "demarcatedScriptLink", header: "Demarcated script", role: "two_way" as const, note: "Part-split + sanitized" },
  { col: "L", key: "remarks", header: "Remarks", role: "two_way" as const },
  { col: "M", key: "totalAssetMade", header: "Total asset made", role: "read" as const },
  { col: "N", key: "totalAssetGenerated", header: "Total asset generated", role: "read" as const },
  { col: "O", key: "creditPerMinInhouse", header: "Credit used for 1min content inhouse", role: "read" as const },
] as const;

/** Fields editable in the dashboard and written back to Master Tracker (excludes removed F). */
export const TRACKER_TWO_WAY_KEYS = MASTER_TRACKER_COLUMNS.filter(
  (c) => c.role === "two_way" || c.role === "join"
).map((c) => c.key);

/** M–O — display only for now (may become computed). */
export const TRACKER_READ_ONLY_KEYS = MASTER_TRACKER_COLUMNS.filter(
  (c) => c.role === "read"
).map((c) => c.key);

/**
 * Hard rule for any script export / demarcation / agency handoff.
 * Not optional — outside agencies must not learn PocketFM is the client.
 */
export const AGENCY_SCRIPT_RULES = {
  stripTokens: ["PocketFM", "Pocket FM", "pocketfm", "POCKETFM"],
  artifacts: ["script", "agencyScript", "demarcatedScript"] as const,
  rationale:
    "Some parts go to an outside agency; agency-facing scripts must never carry a PocketFM reference.",
} as const;

/**
 * Contract with the Script Demarcation tool (built separately — Claude).
 * Spec: pfm-script-demarcation-spec.md
 */
export const DEMARCATION_INTEGRATION = {
  paceWpm: 138,
  ceilingSec: 600,
  floorSec: 360,
  feeds: {
    workingScript: "Master Tracker col I",
    agencyScript: "Master Tracker col J",
    demarcatedScript: "Master Tracker col K",
    parts: "Production Tracker rows (promo × part) — auto from confirmed split",
  },
  note: "Ops does not re-parse PDFs; it links confirmed deck URLs and materializes Part 1…N after sign-off.",
} as const;

/** Asset team's spreadsheet — critical handoff for animation. */
export const PFM_ASSETS_SHEET = {
  spreadsheetId: "1_0QMYmGef8A-mckXPWjGKD9_fUvxvzvpk5zvx5NnYQA",
  spreadsheetName: "PFM Dashboard - Assets",
  url: "https://docs.google.com/spreadsheets/d/1_0QMYmGef8A-mckXPWjGKD9_fUvxvzvpk5zvx5NnYQA/edit?gid=0",
  tabs: {
    promosAssetsMaster: {
      name: "Promos - Assets Master Sheet",
      gid: 0,
      grain: "promo" as const,
      role: "asset_team" as const,
    },
    planning: { name: "Planning", gid: null },
    pfmFantasyMaster: { name: "PFM Fantasy - Master Sheet", gid: null },
    pfmAssetsTracker: { name: "PFM Assets - Tracker", gid: null },
    pfmAssetMoms: { name: "PFM Asset MOMs", gid: null },
    pfmAssetChecklist: { name: "PFM Asset Check list", gid: null },
  },
} as const;

/**
 * Promos - Assets Master Sheet columns.
 * CRITICAL for animation: Asset Map, Canvas Link, Assets Drive Link.
 * Ignore first Start/End Date pair (N–O); use Y–Z only.
 */
export const ASSETS_MASTER_COLUMNS = [
  { col: "B", key: "showName", header: "Show_Name", role: "join" as const },
  { col: "C", key: "scriptName", header: "Script Name", role: "join" as const },
  { col: "D", key: "priority", header: "Priority", role: "read" as const },
  { col: "E", key: "assetsStatus", header: "Assets Status", role: "read" as const },
  { col: "F", key: "remarks", header: "Remarks", role: "read" as const },
  { col: "G", key: "assetMapLink", header: "Asset Map", role: "read" as const, critical: true },
  { col: "H", key: "assetCanvasLink", header: "Canvas Link", role: "read" as const, critical: true },
  { col: "I", key: "assetsDriveLink", header: "Assets Drive Link", role: "read" as const, critical: true },
  { col: "J", key: "artist1", header: "Artist 1", role: "read" as const },
  { col: "K", key: "artist2", header: "Artist 2", role: "read" as const },
  { col: "L", key: "artist3", header: "Artist 3", role: "read" as const },
  { col: "M", key: "artLead", header: "ArtLead", role: "read" as const },
  { col: "N", key: "startDateIgnored", header: "Start Date (IGNORE)", role: "ignore" as const },
  { col: "O", key: "endDateIgnored", header: "End Date (IGNORE)", role: "ignore" as const },
  { col: "P", key: "scriptLink", header: "Script", role: "read" as const },
  { col: "Q", key: "scriptFormatDone", header: "Script Format Done?", role: "read" as const },
  { col: "R", key: "canvas", header: "Canvas", role: "read" as const },
  { col: "S", key: "videoSamples", header: "Video Samples", role: "read" as const },
  { col: "T", key: "showLink", header: "Show Link", role: "read" as const },
  { col: "U", key: "synopsis", header: "Synopsis", role: "read" as const },
  { col: "V", key: "notes", header: "Notes", role: "read" as const },
  { col: "W", key: "dashverseNotes", header: "Dashverse Notes", role: "read" as const },
  { col: "Y", key: "startDate", header: "Start Date", role: "read" as const, note: "Authoritative" },
  { col: "Z", key: "endDate", header: "End Date", role: "read" as const, note: "Authoritative" },
  { col: "AA", key: "totalDays", header: "Total Days", role: "read" as const },
  { col: "AB", key: "correctionsStartDate", header: "Corrections Start Date", role: "read" as const },
  { col: "AC", key: "correctionsEndDate", header: "Corrections End Date", role: "read" as const },
  { col: "AD", key: "correctionsTotalDays", header: "Total Days (corrections)", role: "read" as const },
  { col: "AE", key: "productionDays", header: "Production Days", role: "read" as const },
  { col: "AF", key: "costing", header: "Costing", role: "read" as const },
  { col: "AG", key: "assetsCount", header: "Assets Count", role: "read" as const },
] as const;

/** Links animation cannot start without. */
export const ASSET_HANDOFF_CRITICAL = [
  "assetMapLink",
  "assetCanvasLink",
  "assetsDriveLink",
] as const;

/**
 * Production Tracker — Neeraj’s animation sheet (promo × part grain).
 * Coordinator fills day-to-day; Neeraj reviews. Hidden cols N/P/Q/U/V + gap W→AD TBD.
 * Captured 2026-10-27 — supersedes September calc-model column map.
 */
export const PRODUCTION_TRACKER_COLUMNS = [
  { col: "A", key: "showName", header: "Show_Name", role: "join" as const },
  { col: "B", key: "promoName", header: "Promo Name", role: "join" as const },
  { col: "C", key: "partNo", header: "Part", role: "join" as const },
  { col: "D", key: "stage", header: "Stage", role: "two_way" as const },
  { col: "E", key: "status", header: "Status", role: "two_way" as const },
  { col: "F", key: "durationSec", header: "Duration (hr:min:sec)", role: "two_way" as const },
  { col: "G", key: "team", header: "Team", role: "two_way" as const },
  { col: "H", key: "artist", header: "Artist", role: "two_way" as const },
  { col: "I", key: "editors", header: "Editors", role: "two_way" as const },
  {
    col: "J",
    key: "assetStatus",
    header: "Asset status",
    role: "ignore" as const,
    note: "Same as Pre Production Tracker · Status — dashboard uses Pre-Prod only; do not treat J as a second field",
  },
  { col: "K", key: "deadline", header: "Deadline", role: "two_way" as const },
  { col: "L", key: "plannedPlottedDate", header: "Planned and plotted date", role: "two_way" as const },
  { col: "M", key: "aniStartDate", header: "Ani start date", role: "two_way" as const },
  { col: "O", key: "aniCloseDate", header: "Ani close date", role: "two_way" as const },
  { col: "R", key: "editCloseDate", header: "Edit close date", role: "two_way" as const },
  { col: "S", key: "correctionStartDate", header: "Correction start date", role: "two_way" as const },
  { col: "T", key: "correctionEndDate", header: "Correction end date", role: "two_way" as const },
  { col: "W", key: "soundEndDate", header: "Sound end date", role: "two_way" as const },
  { col: "AD", key: "days", header: "Days", role: "read" as const, note: "Computed span" },
  { col: "AE", key: "remarks", header: "Remarks", role: "two_way" as const },
  { col: "AF", key: "workedDurationSec", header: "Worked Duration", role: "two_way" as const },
] as const;

/** From Dropdowns tab — fixed rosters for form controls. */
export const PFM_DROPDOWNS = {
  stage: [
    "Planning & Plotting",
    "Animation",
    "Edit",
    "Sound",
    "Delivered",
    "Correction",
  ] as const,
  statusPostProduction: [
    "WIP",
    "1st Correction",
    "2nd Correction",
    "3rd Correction",
    "4th Correction",
    "5th Correction",
    "Done",
  ] as const,
  statusPreProduction: ["WIP", "Correction", "Done", "Nil"] as const,
  team: ["In house", "Agency"] as const,
  versionCorrection: ["1st", "2nd", "3rd", "4th", "5th"] as const,
  overallQuality: [1, 2, 3, 4, 5] as const,
  assetArtist: ["Gowtham", "Somya", "Shirso", "Deepthesha", "Merlyn"] as const,
  /**
   * Fallback only — live roster comes from distinct Master Tracker · Cps values
   * (OpsSnapshot.cpsRoster). Neeraj updates who is Cps on the sheet.
   */
  cps: ["Aman", "Divakar"] as const,
  editors: [
    "Vicky",
    "Rishi",
    "Soumo",
    "Harsh",
    "Kirsa",
    "Freak House",
    "Parvi",
    "SQB",
    "Smiley Films",
    "Anuprasad",
    "Utkarsha",
    "Ankush",
    "Shivraj",
  ] as const,
} as const;

/** Sheet Stage label → internal pipeline key. */
export const SHEET_STAGE_TO_PIPELINE: Record<
  (typeof PFM_DROPDOWNS.stage)[number],
  "planning" | "animation" | "edit" | "sound" | "delivered" | "correction"
> = {
  "Planning & Plotting": "planning",
  Animation: "animation",
  Edit: "edit",
  Sound: "sound",
  Delivered: "delivered",
  Correction: "correction",
};

export const PIPELINE_TO_SHEET_STAGE = {
  planning: "Planning & Plotting",
  animation: "Animation",
  edit: "Edit",
  sound: "Sound",
  delivered: "Delivered",
  correction: "Correction",
} as const;
