import {
  ANIMATION_PRODUCTIVITY_SHEET,
  DASHVERSE_PFM_SHEET,
  DURATION_WORKED_BUCKETS,
  PFM_ASSETS_SHEET,
  PFM_TIMELINE_SHEET,
} from "./sheet-registry";
import type {
  Animator,
  AssetTeamRow,
  DailyThroughputLog,
  Part,
  PipelineStage,
  PreProdAssetRow,
  Promo,
  QualityReview,
  SheetSource,
  TeamKind,
} from "./types";
import { promoJoinKey } from "./types";

/** Placeholder snapshot: Master Sheet + Master Tracker + Assets + parts. */
export const MOCK_TODAY = "2026-10-27";

export const MOCK_SOURCE: SheetSource = {
  spreadsheetId: DASHVERSE_PFM_SHEET.spreadsheetId,
  spreadsheetName: DASHVERSE_PFM_SHEET.spreadsheetName,
  masterTab: DASHVERSE_PFM_SHEET.tabs.master.name,
  url: DASHVERSE_PFM_SHEET.url,
};

export const MOCK_WORKING_SOURCE: SheetSource = {
  spreadsheetId: PFM_TIMELINE_SHEET.spreadsheetId,
  spreadsheetName: PFM_TIMELINE_SHEET.spreadsheetName,
  masterTab: PFM_TIMELINE_SHEET.tabs.masterTracker.name,
  url: PFM_TIMELINE_SHEET.url,
};

export const MOCK_ASSETS_SOURCE: SheetSource = {
  spreadsheetId: PFM_ASSETS_SHEET.spreadsheetId,
  spreadsheetName: PFM_ASSETS_SHEET.spreadsheetName,
  masterTab: PFM_ASSETS_SHEET.tabs.promosAssetsMaster.name,
  url: PFM_ASSETS_SHEET.url,
};

export const MOCK_THROUGHPUT_SOURCE: SheetSource = {
  spreadsheetId: ANIMATION_PRODUCTIVITY_SHEET.spreadsheetId,
  spreadsheetName: ANIMATION_PRODUCTIVITY_SHEET.spreadsheetName,
  masterTab: ANIMATION_PRODUCTIVITY_SHEET.tabs.masterData.name,
  url: ANIMATION_PRODUCTIVITY_SHEET.url,
};

/**
 * Normalize sheet Date cells (dd-mm-yyyy, dd/mm/yyyy, typos like 23-09-0206).
 * Returns ISO yyyy-mm-dd or empty if unparseable.
 */
export function normalizeSheetDate(raw: string): string {
  const s = raw.trim();
  const m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (!m) return "";
  const [, dd, mm, yyyy] = m;
  let y = Number(yyyy);
  if (y < 100) y += 2000;
  // 0206 → 206 → last2 06 → prefer 2026 over 2006 for this ops window
  if (y < 1900) {
    const last2 = Number(String(yyyy).slice(-2));
    y = 2000 + last2;
    if (y < 2018) y = 2020 + last2;
  }
  const d = String(dd).padStart(2, "0");
  const mo = String(mm).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

function dailyLog(
  partial: Omit<DailyThroughputLog, "outputMinutes" | "workType" | "durationBucket"> & {
    durationRaw: keyof typeof DURATION_WORKED_BUCKETS | "Less than 3 min" | "3 - 5 min" | "correction";
  }
): DailyThroughputLog {
  const key =
    partial.durationRaw === "Less than 3 min"
      ? "<3"
      : partial.durationRaw === "3 - 5 min"
        ? "3-5"
        : partial.durationRaw === "correction"
          ? "correction"
          : partial.durationRaw;
  const bucket = DURATION_WORKED_BUCKETS[key];
  return {
    id: partial.id,
    date: partial.date,
    dateRaw: partial.dateRaw,
    podLead: partial.podLead,
    artist: partial.artist,
    showName: partial.showName,
    promoName: partial.promoName,
    partsWorked: partial.partsWorked,
    workType: bucket.workType,
    durationBucket: key === "correction" ? null : key,
    outputMinutes: bucket.midpointMin,
    remarks: partial.remarks,
  };
}

export const MOCK_ANIMATORS: Animator[] = [
  { id: "a1", name: "Moumitha", team: "in_house", minutesPerWeek: 48, onTimePct: 86 },
  { id: "a2", name: "Rahul Mittal", team: "in_house", minutesPerWeek: 52, onTimePct: 78 },
  { id: "a3", name: "Vedika Beniwal", team: "in_house", minutesPerWeek: 41, onTimePct: 91 },
  { id: "a4", name: "Anushyam", team: "in_house", minutesPerWeek: 55, onTimePct: 72 },
  { id: "a5", name: "Chhavi Sharma", team: "in_house", minutesPerWeek: 38, onTimePct: 88 },
  { id: "a6", name: "SQB", team: "agency", minutesPerWeek: 60, onTimePct: 65 },
  { id: "a7", name: "Angela Nigam", team: "in_house", minutesPerWeek: 44, onTimePct: 80 },
];

function promo(
  showName: string,
  scriptName: string,
  fields: Partial<Promo> & {
    finalAssetLengthSec?: number | null;
    fiveMinTimeline?: string | null;
    completeDeliverable?: string | null;
  }
): Promo {
  const id = promoJoinKey(showName, scriptName);
  const complete = fields.completeDeliverable ?? null;
  const five = fields.fiveMinTimeline ?? null;
  // Next pressure date = earlier of the two open milestones
  const deliveryDate =
    fields.deliveryDate ??
    [five, complete].filter(Boolean).sort()[0] ??
    null;

  return {
    id,
    showName,
    scriptName,
    promoName: scriptName,
    finalAssetLengthSec: fields.finalAssetLengthSec ?? null,
    durationMin: fields.durationMin ?? (fields.finalAssetLengthSec != null
      ? Math.round((fields.finalAssetLengthSec / 60) * 100) / 100
      : null),
    received: fields.received ?? true,
    openFiles: fields.openFiles ?? false,
    priority: fields.priority ?? "P1",
    masterStage: fields.masterStage ?? "YTS",
    canvasCompletionTimeline: fields.canvasCompletionTimeline ?? null,
    canvasStatus: fields.canvasStatus ?? null,
    fiveMinTimeline: five,
    krockLink5Min: fields.krockLink5Min ?? null,
    completeDeliverable: complete,
    deliverableWithFinalCorrections: fields.deliverableWithFinalCorrections ?? null,
    finalCorrectedFiles: fields.finalCorrectedFiles ?? null,
    comments: fields.comments ?? null,
    scriptLink: fields.scriptLink ?? null,
    scriptFormatDone: fields.scriptFormatDone ?? null,
    canvasLink: fields.canvasLink ?? null,
    voSamples: fields.voSamples ?? null,
    videoSamples: fields.videoSamples ?? null,
    showLink: fields.showLink ?? null,
    synopsisLink: fields.synopsisLink ?? null,
    notes: fields.notes ?? null,
    openFilesReceived: fields.openFilesReceived ?? false,
    openFilesReceivedStatus: fields.openFilesReceivedStatus ?? null,
    status: fields.status ?? null,
    finalRendersLink: fields.finalRendersLink ?? null,
    projectFilesLink: fields.projectFilesLink ?? null,
    assetsLink: fields.assetsLink ?? null,
    perMin: fields.perMin ?? null,
    promoCost: fields.promoCost ?? null,
    paymentStatus: fields.paymentStatus ?? null,
    deliveryDate,
    trackerStatus: fields.trackerStatus ?? "WIP",
    cps: fields.cps ?? null,
    fiveMinStatus: fields.fiveMinStatus ?? null,
    initialDurationSec: fields.initialDurationSec ?? fields.finalAssetLengthSec ?? null,
    workingScriptLink: fields.workingScriptLink ?? null,
    agencyScriptLink: fields.agencyScriptLink ?? null,
    demarcatedScriptLink: fields.demarcatedScriptLink ?? null,
    remarks: fields.remarks ?? null,
    totalAssetMade: fields.totalAssetMade ?? null,
    totalAssetGenerated: fields.totalAssetGenerated ?? null,
    creditPerMinInhouse: fields.creditPerMinInhouse ?? null,
    lastTrackerUpdateAt: fields.lastTrackerUpdateAt ?? null,
    assetTeam: fields.assetTeam ?? null,
    preProd: fields.preProd ?? null,
  };
}

function preProd(partial: Partial<PreProdAssetRow>): PreProdAssetRow {
  return {
    status: partial.status ?? "WIP",
    artist: partial.artist ?? null,
    totalAssets: partial.totalAssets ?? null,
    startDate: partial.startDate ?? null,
    plannedDate: partial.plannedDate ?? null,
    closedDate: partial.closedDate ?? null,
    calculatedPlannedDate:
      partial.calculatedPlannedDate ??
      (partial.startDate
        ? addDays(partial.startDate, 5)
        : null),
    remarksLog: partial.remarksLog ?? [],
    pickedAt: partial.pickedAt ?? null,
    delayFlagged: partial.delayFlagged ?? false,
    assetsNeededBy: partial.assetsNeededBy ?? null,
  };
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function assets(partial: Partial<AssetTeamRow> & {
  assetMapLink?: string | null;
  assetCanvasLink?: string | null;
  assetsDriveLink?: string | null;
}): AssetTeamRow {
  return {
    assetsStatus: partial.assetsStatus ?? "Approved",
    remarks: partial.remarks ?? null,
    assetMapLink: partial.assetMapLink ?? null,
    assetCanvasLink: partial.assetCanvasLink ?? null,
    assetsDriveLink: partial.assetsDriveLink ?? null,
    artist1: partial.artist1 ?? null,
    artist2: partial.artist2 ?? null,
    artist3: partial.artist3 ?? null,
    artLead: partial.artLead ?? null,
    startDate: partial.startDate ?? null,
    endDate: partial.endDate ?? null,
    totalDays: partial.totalDays ?? null,
    correctionsStartDate: partial.correctionsStartDate ?? null,
    correctionsEndDate: partial.correctionsEndDate ?? null,
    correctionsTotalDays: partial.correctionsTotalDays ?? null,
    productionDays: partial.productionDays ?? null,
    costing: partial.costing ?? null,
    assetsCount: partial.assetsCount ?? null,
    dashverseNotes: partial.dashverseNotes ?? null,
    synopsis: partial.synopsis ?? null,
    notes: partial.notes ?? null,
  };
}

export const MOCK_PROMOS: Promo[] = [
  promo("HCQ", "House Party Wait", {
    finalAssetLengthSec: 881,
    priority: "P0",
    masterStage: "In Progress",
    canvasStatus: "Completed",
    fiveMinTimeline: "2026-10-26",
    completeDeliverable: "2026-10-28",
    comments: "CP review pending on P2",
    notes: "Party location — keep lighting warm",
    scriptFormatDone: true,
    perMin: 140,
    status: null,
    trackerStatus: "WIP",
    cps: "Divakar",
    fiveMinStatus: "1:30min covered by 6pm",
    initialDurationSec: 900,
    remarks: "CP still pending on part 2",
    totalAssetMade: 132,
    creditPerMinInhouse: 8.1,
    lastTrackerUpdateAt: "2026-10-26",
    workingScriptLink: "https://docs.google.com/document/d/mock-hcq-script",
    agencyScriptLink: null, // nudge: missing agency script
    demarcatedScriptLink: "https://docs.google.com/document/d/mock-hcq-demarcated",
    assetTeam: assets({
      assetsStatus: "Approved",
      remarks: "Familiar world — same approach as prior HCQ rescue work.",
      assetMapLink: "https://drive.google.com/mock-hcq-asset-map",
      assetCanvasLink: "https://platform.ai/create/canvas/show/mock-hcq",
      assetsDriveLink: "https://drive.google.com/drive/folders/mock-hcq-assets",
      artist1: "Shirso",
      artist2: "Somya",
      artLead: "Neetha",
      startDate: "2026-10-12",
      endDate: "2026-10-18",
      totalDays: 6,
      costing: 44660,
      assetsCount: "Locations: 12 / Primary Char.: 3 / Secondary Char: 5",
    }),
    preProd: preProd({
      status: "Done",
      artist: "Shirso",
      totalAssets: 150,
      startDate: "2026-10-12",
      plannedDate: "2026-10-17",
      closedDate: "2026-10-18",
      pickedAt: "2026-10-19",
      remarksLog: [
        {
          id: "r1",
          at: "2026-10-15",
          body: "Canvas shared late — names got confused at first, resolved.",
        },
      ],
    }),
  }),
  promo("MLK", "Broken Contract", {
    finalAssetLengthSec: 810,
    priority: "P0",
    masterStage: "In Progress",
    canvasStatus: "Completed",
    fiveMinTimeline: "2026-10-27",
    completeDeliverable: "2026-10-30",
    notes: null,
    scriptFormatDone: true,
    perMin: 140,
    trackerStatus: "WIP",
    cps: "Aman",
    fiveMinStatus: null, // nudge — 5-min due today
    lastTrackerUpdateAt: "2026-10-24",
    assetTeam: assets({
      assetsStatus: "Approved",
      assetMapLink: "https://drive.google.com/mock-mlk-map",
      assetCanvasLink: "https://platform.ai/create/canvas/show/mock-mlk",
      assetsDriveLink: "https://drive.google.com/drive/folders/mock-mlk",
      artist1: "Gowtham",
      startDate: "2026-10-14",
      endDate: "2026-10-21",
      totalDays: 7,
      costing: 26627,
    }),
    preProd: preProd({
      status: "WIP",
      artist: "Gowtham",
      totalAssets: 117,
      startDate: "2026-10-14",
      plannedDate: "2026-10-26",
      closedDate: null,
      delayFlagged: true,
      assetsNeededBy: "2026-10-27",
      remarksLog: [
        {
          id: "r2",
          at: "2026-10-20",
          body: "Saum was confused, since tanya gave the first ref.",
        },
        {
          id: "r3",
          at: "2026-10-25",
          body: "Still WIP — need assets before Aman (CPS) frees for 5‑min.",
        },
      ],
    }),
  }),
  promo("TDMB", "Rescue Masked", {
    finalAssetLengthSec: 480,
    priority: "P1",
    masterStage: "YTS",
    canvasStatus: "WIP",
    fiveMinTimeline: "2026-10-30",
    completeDeliverable: "2026-11-02",
    scriptFormatDone: false,
    perMin: 125,
    trackerStatus: "WIP",
    cps: null, // nudge
    lastTrackerUpdateAt: null,
    // Missing critical handoff — animation cannot start cleanly
    assetTeam: assets({
      assetsStatus: "WIP",
      artist1: "Vineeth",
      assetMapLink: null,
      assetCanvasLink: null,
      assetsDriveLink: null,
      startDate: "2026-10-22",
      endDate: null,
      notes: "Need to create Motion for the first quarter only - 15 Minutes.",
    }),
    preProd: preProd({
      status: "WIP",
      artist: "Vineeth",
      totalAssets: 108,
      startDate: "2026-10-22",
      plannedDate: null, // nudge
      closedDate: null,
      remarksLog: [
        {
          id: "r4",
          at: "2026-10-23",
          body: "Ref and canvases misaligned, Canvas not shared by PFM team. Names got confused. Instead of TDMB rescue took HCQ rescue.",
        },
      ],
    }),
  }),
  promo("BTR", "6.0 - Contract Marriage", {
    finalAssetLengthSec: 1055,
    priority: "P0",
    masterStage: "In Progress",
    canvasStatus: "Completed",
    fiveMinTimeline: "2026-10-24",
    completeDeliverable: "2026-10-27",
    notes: "Agency part — watch credit split",
    scriptFormatDone: true,
    perMin: 140,
    trackerStatus: "WIP",
    cps: "Divakar",
    fiveMinStatus: "2min around 8pm",
    remarks: "Agency holding part 1 — no PocketFM refs in agency script",
    agencyScriptLink: "https://docs.google.com/document/d/mock-btr-agency",
    demarcatedScriptLink: null, // nudge
    creditPerMinInhouse: 10.2,
    lastTrackerUpdateAt: "2026-10-25",
    assetTeam: assets({
      assetsStatus: "Approved",
      assetMapLink: "https://drive.google.com/mock-btr-map",
      assetCanvasLink: "https://platform.ai/create/canvas/show/mock-btr",
      assetsDriveLink: "https://drive.google.com/drive/folders/mock-btr",
      artist1: "Khyathi",
      artist2: "Somya",
      startDate: "2026-10-08",
      endDate: "2026-10-16",
      totalDays: 8,
      correctionsStartDate: "2026-10-17",
      correctionsEndDate: "2026-10-19",
      correctionsTotalDays: 2,
      costing: 9439,
      assetsCount: "Locations: 23 / Primary Char.: 2 / Secondary Char: 6 / Tertiary Char: 24",
    }),
    preProd: preProd({
      status: "Done",
      artist: "Somya",
      totalAssets: 133,
      startDate: "2026-10-08",
      plannedDate: "2026-10-15",
      closedDate: "2026-10-16",
      pickedAt: "2026-10-17",
      remarksLog: [],
    }),
  }),
  promo("IMTS", "3.0 New world", {
    finalAssetLengthSec: 330,
    priority: "P1",
    masterStage: "YTS",
    canvasStatus: null,
    fiveMinTimeline: "2026-11-01",
    completeDeliverable: "2026-11-05",
    scriptFormatDone: false,
    perMin: 125,
    trackerStatus: "Paused",
    cps: "Aman",
    lastTrackerUpdateAt: "2026-10-20", // stale
  }),
  promo("TWT", "1.0", {
    finalAssetLengthSec: 950,
    priority: "P0",
    masterStage: "In Progress",
    canvasStatus: "Completed",
    fiveMinTimeline: "2026-10-22",
    completeDeliverable: "2026-10-26",
    comments: "Script change overnight",
    notes: "Missed PocketFM window risk",
    scriptFormatDone: true,
    openFilesReceived: true,
    openFilesReceivedStatus: "Partial",
    perMin: 140,
    trackerStatus: "WIP",
    cps: "Divakar",
    fiveMinStatus: "Update when log off",
    remarks: "divakar added extra ~2:30 min to part 3 removed from part4 for continuity",
    totalAssetMade: 75,
    lastTrackerUpdateAt: "2026-10-27",
  }),
];

const id = (show: string, script: string) => promoJoinKey(show, script);

function artistName(artistId: string | null): string | null {
  if (!artistId) return null;
  return MOCK_ANIMATORS.find((a) => a.id === artistId)?.name ?? null;
}

/** Production Tracker row factory (promo × part). */
function part(
  partial: Partial<Part> & {
    id: string;
    promoId: string;
    partNo: number;
    durationSec: number;
    stage: PipelineStage;
  }
): Part {
  const artists = partial.artists ?? [];
  const team: TeamKind =
    partial.team ??
    (artists.some((c) => MOCK_ANIMATORS.find((a) => a.id === c.artistId)?.team === "agency")
      ? "agency"
      : "in_house");
  const deadline = partial.deadline ?? partial.plannedDate ?? null;
  const plannedPlotted = partial.plannedPlottedDate ?? deadline;
  return {
    id: partial.id,
    promoId: partial.promoId,
    partNo: partial.partNo,
    durationSec: partial.durationSec,
    stage: partial.stage,
    status: partial.status ?? (partial.stage === "delivered" ? "Done" : "WIP"),
    team,
    artist:
      partial.artist ??
      (artists[0] ? artistName(artists[0].artistId) : null),
    editors: partial.editors ?? null,
    assetStatus: partial.assetStatus ?? null,
    deadline,
    plannedPlottedDate: plannedPlotted,
    aniStartDate: partial.aniStartDate ?? partial.assignedAt ?? null,
    aniCloseDate: partial.aniCloseDate ?? null,
    editCloseDate: partial.editCloseDate ?? null,
    correctionStartDate: partial.correctionStartDate ?? null,
    correctionEndDate: partial.correctionEndDate ?? null,
    soundEndDate: partial.soundEndDate ?? null,
    days: partial.days ?? null,
    remarks: partial.remarks ?? null,
    workedDurationSec: partial.workedDurationSec ?? null,
    artists,
    plannedDate: deadline ?? plannedPlotted,
    assignedAt: partial.assignedAt ?? null,
    closedAt: partial.closedAt ?? null,
    blocked: partial.blocked ?? false,
    blockReason: partial.blockReason ?? null,
    flagged: partial.flagged ?? false,
  };
}

export const MOCK_PARTS: Part[] = [
  part({
    id: "pt1",
    promoId: id("HCQ", "House Party Wait"),
    partNo: 1,
    durationSec: 369,
    stage: "sound",
    artists: [{ artistId: "a1", share: 1 }],
    editors: "Vicky",
    assetStatus: "Closed",
    plannedDate: "2026-10-26",
    assignedAt: "2026-10-20",
    aniCloseDate: "2026-10-24",
    editCloseDate: "2026-10-25",
    workedDurationSec: 400,
    days: 4,
  }),
  part({
    id: "pt2",
    promoId: id("HCQ", "House Party Wait"),
    partNo: 2,
    durationSec: 512,
    stage: "correction",
    status: "2nd Correction",
    artists: [
      { artistId: "a2", share: 0.5 },
      { artistId: "a3", share: 0.5 },
    ],
    editors: "Rishi",
    assetStatus: "Closed",
    plannedDate: "2026-10-25",
    assignedAt: "2026-10-19",
    correctionStartDate: "2026-10-26",
    blocked: true,
    blockReason: "Waiting on CP review",
    flagged: true,
    remarks: "CP holding notes",
  }),
  part({
    id: "pt3",
    promoId: id("MLK", "Broken Contract"),
    partNo: 1,
    durationSec: 420,
    stage: "edit",
    artists: [{ artistId: "a4", share: 1 }],
    editors: "Soumo",
    assetStatus: "Closed",
    plannedDate: "2026-10-27",
    assignedAt: "2026-10-22",
    aniCloseDate: "2026-10-26",
  }),
  part({
    id: "pt4",
    promoId: id("MLK", "Broken Contract"),
    partNo: 2,
    durationSec: 390,
    stage: "animation",
    artists: [{ artistId: "a5", share: 1 }],
    editors: "Harsh",
    assetStatus: "Closed",
    plannedDate: "2026-10-28",
    assignedAt: "2026-10-23",
  }),
  part({
    id: "pt5",
    promoId: id("TDMB", "Rescue Masked"),
    partNo: 1,
    durationSec: 480,
    stage: "planning",
    artists: [{ artistId: "a3", share: 1 }],
    assetStatus: "WIP",
    plannedDate: "2026-10-27",
    assignedAt: "2026-10-24",
    plannedPlottedDate: "2026-10-27",
  }),
  part({
    id: "pt6",
    promoId: id("BTR", "6.0 - Contract Marriage"),
    partNo: 1,
    durationSec: 600,
    stage: "sound",
    team: "agency",
    artists: [{ artistId: "a6", share: 1 }],
    editors: "SQB",
    assetStatus: "Closed",
    plannedDate: "2026-10-24",
    assignedAt: "2026-10-16",
    aniCloseDate: "2026-10-20",
    editCloseDate: "2026-10-22",
    flagged: true,
    remarks: "Agency part — no PocketFM refs in script",
  }),
  part({
    id: "pt7",
    promoId: id("BTR", "6.0 - Contract Marriage"),
    partNo: 2,
    durationSec: 455,
    stage: "edit",
    team: "agency",
    artists: [
      { artistId: "a7", share: 0.6 },
      { artistId: "a6", share: 0.4 },
    ],
    editors: "Smiley Films",
    assetStatus: "Closed",
    plannedDate: "2026-10-27",
    assignedAt: "2026-10-18",
  }),
  part({
    id: "pt8",
    promoId: id("IMTS", "3.0 New world"),
    partNo: 1,
    durationSec: 330,
    stage: "animation",
    artists: [{ artistId: "a1", share: 1 }],
    editors: "Parvi",
    assetStatus: "Closed",
    plannedDate: "2026-10-29",
    assignedAt: "2026-10-25",
  }),
  part({
    id: "pt9",
    promoId: id("TWT", "1.0"),
    partNo: 1,
    durationSec: 540,
    stage: "correction",
    status: "1st Correction",
    artists: [{ artistId: "a2", share: 1 }],
    editors: "Kirsa",
    assetStatus: "Closed",
    plannedDate: "2026-10-23",
    assignedAt: "2026-10-15",
    correctionStartDate: "2026-10-24",
    blocked: true,
    blockReason: "Script change overnight",
    flagged: true,
  }),
  part({
    id: "pt10",
    promoId: id("TWT", "1.0"),
    partNo: 2,
    durationSec: 410,
    stage: "delivered",
    status: "Done",
    artists: [{ artistId: "a4", share: 1 }],
    editors: "Ankush",
    assetStatus: "Closed",
    plannedDate: "2026-10-22",
    assignedAt: "2026-10-14",
    closedAt: "2026-10-22",
    aniCloseDate: "2026-10-18",
    editCloseDate: "2026-10-20",
    soundEndDate: "2026-10-22",
    workedDurationSec: 450,
    days: 8,
  }),
  part({
    id: "pt11",
    promoId: id("TDMB", "Rescue Masked"),
    partNo: 2,
    durationSec: 0,
    stage: "planning",
    artists: [],
    assetStatus: "Nil",
    plannedDate: "2026-10-30",
  }),
];

/** Master Productivity — CPS quality reviews (separate from throughput). */
export const MOCK_QUALITY_REVIEWS: QualityReview[] = [
  {
    id: "qr1",
    promoId: id("HCQ", "House Party Wait"),
    partNo: 1,
    krockLink: "https://krock.io/mock-hcq-p1",
    cps: "Divakar",
    animators: ["Moumitha"],
    editors: ["Vicky"],
    versionCorrection: "1st",
    animation: {
      overallQuality: 4,
      scriptKnowledge: 4,
      correctionsUnderstood: 5,
      skinTextures: 3,
      shotContinuity: 4,
      cameraShots: 4,
      weakAreas:
        "• Shot 12 — missing reaction beat\n• Shot 18 — prop handoff continuity\n• Skin on close-up feels plastic",
      remark: "Strong first pass; texture polish next.",
    },
    editing: {
      storytelling: 4,
      preemptiveEffort: 3,
      shotPlacementFlow: 4,
      colorConsistency: 5,
      technical: 4,
      remark: "Pacing good; VO duck under SFX at 1:12.",
    },
  },
  {
    id: "qr2",
    promoId: id("HCQ", "House Party Wait"),
    partNo: 2,
    krockLink: "https://krock.io/mock-hcq-p2",
    cps: "Divakar",
    animators: ["Rahul Mittal", "Vedika Beniwal"],
    editors: ["Rishi"],
    versionCorrection: "2nd",
    animation: {
      overallQuality: 3,
      scriptKnowledge: 3,
      correctionsUnderstood: 2,
      skinTextures: 3,
      shotContinuity: 2,
      cameraShots: 3,
      weakAreas:
        "• Still missing shot 7 hold\n• Framing crops character feet\n• 2nd pass did not address prior notes on eyeline",
      remark: "Corrections not fully absorbed — walk through notes with artist.",
    },
    editing: {
      storytelling: 3,
      preemptiveEffort: 2,
      shotPlacementFlow: 3,
      colorConsistency: 4,
      technical: 3,
      remark: "Jump cut at party entrance; narration lags visual by ~0.5s.",
    },
  },
  {
    id: "qr3",
    promoId: id("MLK", "Broken Contract"),
    partNo: 1,
    krockLink: "https://krock.io/mock-mlk-p1",
    cps: "Aman",
    animators: ["Anushyam"],
    editors: ["Soumo"],
    versionCorrection: "1st",
    animation: {
      overallQuality: 5,
      scriptKnowledge: 5,
      correctionsUnderstood: 5,
      skinTextures: 4,
      shotContinuity: 5,
      cameraShots: 4,
      weakAreas: "• Minor: camera settle on final wide",
      remark: "Clean first pass — ready for sound.",
    },
    editing: {
      storytelling: 5,
      preemptiveEffort: 4,
      shotPlacementFlow: 5,
      colorConsistency: 4,
      technical: 5,
      remark: null,
    },
  },
  {
    id: "qr4",
    promoId: id("TWT", "1.0"),
    partNo: 1,
    krockLink: "https://krock.io/mock-twt-p1",
    cps: "Aman",
    animators: ["Rahul Mittal"],
    editors: ["Kirsa"],
    versionCorrection: "4th",
    animation: {
      overallQuality: 2,
      scriptKnowledge: 2,
      correctionsUnderstood: 2,
      skinTextures: 3,
      shotContinuity: 2,
      cameraShots: 2,
      weakAreas:
        "• 4th pass still missing key establishing shot\n• Character position drifts across cuts\n• Camera language inconsistent with script beats",
      remark: "High revision count — quality signal weighted carefully vs 1st-pass peers.",
    },
    editing: {
      storytelling: 2,
      preemptiveEffort: 2,
      shotPlacementFlow: 2,
      colorConsistency: 3,
      technical: 3,
      remark: "Continuity breaks in hallway sequence; audio sync drift.",
    },
  },
];

/** Animation productivity · Master data — sample daily throughput rows. */
export const MOCK_DAILY_LOGS: DailyThroughputLog[] = [
  dailyLog({
    id: "dl1",
    date: normalizeSheetDate("16-09-2026"),
    dateRaw: "16-09-2026",
    podLead: "Chhavi",
    artist: "Moumitha",
    showName: "HCQ",
    promoName: "House Party Wait",
    partsWorked: 1,
    durationRaw: "3 - 5 min",
    remarks: null,
  }),
  dailyLog({
    id: "dl2",
    date: normalizeSheetDate("16/09/2026"),
    dateRaw: "16/09/2026",
    podLead: "Chhavi",
    artist: "Rahul Mittal",
    showName: "HCQ",
    promoName: "House Party Wait",
    partsWorked: 1,
    durationRaw: "Less than 3 min",
    remarks: null,
  }),
  dailyLog({
    id: "dl3",
    date: normalizeSheetDate("23-09-0206"),
    dateRaw: "23-09-0206",
    podLead: "Chhavi",
    artist: "Rahul Mittal",
    showName: "TWT",
    promoName: "1.0",
    partsWorked: 1,
    durationRaw: "correction",
    remarks: null,
  }),
  dailyLog({
    id: "dl4",
    date: "2026-10-20",
    dateRaw: "20-10-2026",
    podLead: "Chhavi",
    artist: "Anushyam",
    showName: "MLK",
    promoName: "Broken Contract",
    partsWorked: 1,
    durationRaw: "3 - 5 min",
    remarks: null,
  }),
  dailyLog({
    id: "dl5",
    date: "2026-10-21",
    dateRaw: "21-10-2026",
    podLead: "Chhavi",
    artist: "Anushyam",
    showName: "MLK",
    promoName: "Broken Contract",
    partsWorked: 1,
    durationRaw: "3 - 5 min",
    remarks: null,
  }),
  dailyLog({
    id: "dl6",
    date: "2026-10-22",
    dateRaw: "22/10/2026",
    podLead: null,
    artist: "Hritik",
    showName: "IMTS",
    promoName: "3.0 New world",
    partsWorked: 1,
    durationRaw: "Less than 3 min",
    remarks: null,
  }),
  dailyLog({
    id: "dl7",
    date: "2026-10-23",
    dateRaw: "23-10-2026",
    podLead: null,
    artist: "Dhara",
    showName: "TWT",
    promoName: "1.0",
    partsWorked: 1,
    durationRaw: "correction",
    remarks: null,
  }),
  dailyLog({
    id: "dl8",
    date: "2026-10-24",
    dateRaw: "24-10-2026",
    podLead: "Chhavi",
    artist: "Moumitha",
    showName: "HCQ",
    promoName: "House Party Wait",
    partsWorked: 1,
    durationRaw: "Less than 3 min",
    remarks: null,
  }),
  dailyLog({
    id: "dl9",
    date: "2026-10-25",
    dateRaw: "25-10-2026",
    podLead: "Chhavi",
    artist: "Vedika Beniwal",
    showName: "HCQ",
    promoName: "House Party Wait",
    partsWorked: 1,
    durationRaw: "3 - 5 min",
    remarks: null,
  }),
  dailyLog({
    id: "dl10",
    date: "2026-10-26",
    dateRaw: "26-10-2026",
    podLead: "Chhavi",
    artist: "Chhavi Sharma",
    showName: "MLK",
    promoName: "Broken Contract",
    partsWorked: 1,
    durationRaw: "3 - 5 min",
    remarks: null,
  }),
];
