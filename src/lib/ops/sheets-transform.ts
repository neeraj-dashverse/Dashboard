/**
 * Pure mappers: live sheet grids → ops domain objects.
 * Column indices below reflect the REAL sheet layouts dumped 2026-10-27,
 * not the earlier schema guesses.
 */
import {
  durationToSec,
  normKey,
  num,
  slug,
  splitNames,
  text,
  toIsoDate,
  type Grid,
} from "./sheets-client";
import type {
  Animator,
  AssetTeamRow,
  Part,
  PipelineStage,
  PreProdAssetRow,
  Promo,
  QualityReview,
  TeamKind,
} from "./types";
import { promoJoinKey } from "./types";

const STAGE_MAP: Record<string, PipelineStage> = {
  "planning & plotting": "planning",
  planning: "planning",
  animation: "animation",
  edit: "edit",
  editing: "edit",
  correction: "correction",
  sound: "sound",
  delivered: "delivered",
};

function toStage(raw: string | null, status: string | null): PipelineStage {
  if (status && /^done$/i.test(status.trim())) return "delivered";
  const s = (raw ?? "").trim().toLowerCase();
  return STAGE_MAP[s] ?? "planning";
}

function toTeam(raw: string | null): TeamKind {
  return /agency/i.test(raw ?? "") ? "agency" : "in_house";
}

function priority(raw: string | null): Promo["priority"] {
  const s = (raw ?? "").trim().toUpperCase();
  return s === "P0" || s === "P1" ? (s as Promo["priority"]) : null;
}

// ── Promos (Master Tracker) ──────────────────────────────────────────────────

/** Master Tracker data rows (already sliced past the 2 header rows). A..O. */
export function parsePromos(rows: Grid): Promo[] {
  const promos: Promo[] = [];
  for (const r of rows) {
    const rawShow = text(r[0]);
    const rawPromo = text(r[1]);
    if (!rawShow && !rawPromo) continue;
    // Empty promo stays empty — do not copy Show into Promo.
    const showName = rawShow ?? "";
    const promoName = rawPromo ?? "";
    if (normKey(showName || promoName) === "show_name") continue;

    const initialDurationSec = durationToSec(r[7]);
    const id = promoJoinKey(showName, promoName);
    promos.push({
      id,
      showName,
      scriptName: promoName,
      promoName,
      finalAssetLengthSec: initialDurationSec,
      durationMin: initialDurationSec != null ? Math.round((initialDurationSec / 60) * 100) / 100 : null,
      received: true,
      openFiles: false,
      priority: priority(r[3]),
      masterStage: null,
      canvasCompletionTimeline: null,
      canvasStatus: null,
      fiveMinTimeline: null,
      krockLink5Min: null,
      completeDeliverable: null,
      deliverableWithFinalCorrections: null,
      finalCorrectedFiles: null,
      comments: null,
      scriptLink: text(r[8]),
      scriptFormatDone: null,
      canvasLink: null,
      voSamples: null,
      videoSamples: null,
      showLink: null,
      synopsisLink: null,
      notes: null,
      openFilesReceived: false,
      openFilesReceivedStatus: null,
      status: text(r[2]),
      finalRendersLink: null,
      projectFilesLink: null,
      assetsLink: null,
      perMin: null,
      promoCost: null,
      paymentStatus: null,
      deliveryDate: null,
      trackerStatus: text(r[2]),
      cps: text(r[4]),
      first5MinAnimator: text(r[5]),
      fiveMinStatus: text(r[6]),
      initialDurationSec,
      workingScriptLink: text(r[8]),
      agencyScriptLink: text(r[9]),
      demarcatedScriptLink: text(r[10]),
      remarks: text(r[11]),
      totalAssetMade: num(r[12]),
      totalAssetGenerated: num(r[13]),
      creditPerMinInhouse: num(r[14]),
      lastTrackerUpdateAt: null,
      assetTeam: null,
      preProd: null,
    });
  }
  return promos;
}

/** Dashverse<>PFM Master Sheet — links and delivery fields the tracker does not store. */
export function parseMasterDetails(rows: Grid): Map<string, Partial<Promo>> {
  const map = new Map<string, Partial<Promo>>();
  for (const r of rows) {
    const showName = text(r[0]);
    const scriptName = text(r[1]);
    if (!showName && !scriptName) continue;
    if (normKey(showName || scriptName || "") === "show_name") continue;
    const id = promoJoinKey(showName ?? "", scriptName ?? "");
    if (!id || id === "|") continue;
    const pay = text(r[32]);
    map.set(id, {
      finalAssetLengthSec: durationToSec(r[2]),
      masterStage: text(r[6]),
      canvasCompletionTimeline: toIsoDate(r[7]),
      canvasStatus: text(r[8]),
      fiveMinTimeline: toIsoDate(r[9]),
      krockLink5Min: text(r[10]),
      completeDeliverable: toIsoDate(r[11]) ?? text(r[11]),
      deliverableWithFinalCorrections: text(r[12]),
      finalCorrectedFiles: text(r[13]),
      comments: text(r[14]),
      scriptLink: text(r[15]),
      canvasLink: text(r[17]),
      voSamples: text(r[18]),
      videoSamples: text(r[19]),
      showLink: text(r[20]),
      synopsisLink: text(r[21]),
      notes: text(r[22]),
      finalRendersLink: text(r[26]),
      projectFilesLink: text(r[27]),
      assetsLink: text(r[28]),
      perMin: num(r[29]),
      promoCost: num(r[31]),
      paymentStatus:
        pay === "Paid" || pay === "Paid Partially" || pay === "Unpaid" ? pay : null,
    });
  }
  return map;
}

/** Fill empty promo link fields from the Master Sheet. Does not replace tracker status. */
export function applyMasterDetail(promo: Promo, detail: Partial<Promo>) {
  const fill = <K extends keyof Promo>(key: K) => {
    const incoming = detail[key];
    if (incoming == null || incoming === "") return;
    const current = promo[key];
    if (current == null || current === "" || current === false) {
      promo[key] = incoming as Promo[K];
    }
  };
  if (detail.finalAssetLengthSec) promo.finalAssetLengthSec = detail.finalAssetLengthSec;
  fill("masterStage");
  fill("canvasCompletionTimeline");
  fill("canvasStatus");
  fill("fiveMinTimeline");
  fill("krockLink5Min");
  fill("completeDeliverable");
  fill("deliverableWithFinalCorrections");
  fill("finalCorrectedFiles");
  fill("comments");
  fill("scriptLink");
  fill("canvasLink");
  fill("voSamples");
  fill("videoSamples");
  fill("showLink");
  fill("synopsisLink");
  fill("notes");
  fill("finalRendersLink");
  fill("projectFilesLink");
  fill("assetsLink");
  fill("perMin");
  fill("promoCost");
  fill("paymentStatus");
}

/** Promo stub for an asset-sheet row that isn't on Master Tracker yet. */
export function stubPromoFromAsset(showName: string, scriptName: string, row: AssetTeamRow): Promo {
  const show = showName || "";
  const script = scriptName || "";
  return {
    id: promoJoinKey(show, script),
    showName: show,
    scriptName: script,
    promoName: script,
    finalAssetLengthSec: null,
    durationMin: null,
    received: true,
    openFiles: false,
    priority: null,
    masterStage: null,
    canvasCompletionTimeline: null,
    canvasStatus: null,
    fiveMinTimeline: null,
    krockLink5Min: null,
    completeDeliverable: null,
    deliverableWithFinalCorrections: null,
    finalCorrectedFiles: null,
    comments: null,
    scriptLink: null,
    scriptFormatDone: null,
    canvasLink: null,
    voSamples: null,
    videoSamples: null,
    showLink: null,
    synopsisLink: null,
    notes: null,
    openFilesReceived: false,
    openFilesReceivedStatus: null,
    status: null,
    finalRendersLink: null,
    projectFilesLink: null,
    assetsLink: null,
    perMin: null,
    promoCost: null,
    paymentStatus: null,
    deliveryDate: null,
    trackerStatus: null,
    cps: null,
    fiveMinStatus: null,
    initialDurationSec: null,
    workingScriptLink: null,
    agencyScriptLink: null,
    demarcatedScriptLink: null,
    remarks: null,
    totalAssetMade: null,
    totalAssetGenerated: null,
    creditPerMinInhouse: null,
    lastTrackerUpdateAt: null,
    assetTeam: row,
    preProd: null,
  };
}

// ── Parts (Production Tracker) ────────────────────────────────────────────────

/** Production Tracker data rows (sliced past 1 header row). A..AF. */
export function parseParts(rows: Grid, animatorIdByName: Map<string, string>): Part[] {
  const parts: Part[] = [];
  let seq = 0;
  for (const r of rows) {
    const showName = text(r[0]);
    const promoName = text(r[1]);
    const partNo = num(r[2]);
    if (!showName || !promoName || partNo == null) continue;
    if (normKey(showName) === "show_name") continue;

    const promoId = promoJoinKey(showName, promoName);
    const status = text(r[4]);
    const stage = toStage(text(r[3]), status);
    const team = toTeam(r[6]);
    const artistRaw = text(r[7]);
    const names = splitNames(artistRaw);
    const share = names.length ? 1 / names.length : 0;
    const artists = names.map((n) => ({
      artistId: animatorIdByName.get(normKey(n)) ?? `a:${slug(n)}`,
      share,
    }));

    const deadline = toIsoDate(r[10]);
    const plannedPlottedDate = toIsoDate(r[11]);
    const aniStartDate = toIsoDate(r[12]);
    const aniCloseDate = toIsoDate(r[14]);
    const editCloseDate = toIsoDate(r[17]);
    const correctionStartDate = toIsoDate(r[18]);
    const correctionEndDate = toIsoDate(r[19]);
    const soundEndDate = toIsoDate(r[22]);
    const plannedDate = deadline ?? plannedPlottedDate ?? null;

    parts.push({
      id: `pt-${promoId}-${partNo}-${seq++}`,
      promoId,
      partNo,
      durationSec: durationToSec(r[5]) ?? 0,
      stage,
      status,
      team,
      artist: artistRaw,
      editors: text(r[8]),
      assetStatus: text(r[9]),
      deadline,
      plannedPlottedDate,
      aniStartDate,
      aniCloseDate,
      editCloseDate,
      correctionStartDate,
      correctionEndDate,
      soundEndDate,
      days: num(r[29]),
      remarks: text(r[30]),
      workedDurationSec: durationToSec(r[31]),
      artists,
      plannedDate,
      assignedAt: aniStartDate,
      closedAt: stage === "delivered" ? soundEndDate ?? aniCloseDate : null,
      blocked: false,
      blockReason: null,
      flagged: false,
    });
  }
  return parts;
}

// ── Pre Production Tracker → preProd per promo ────────────────────────────────

export function parsePreProd(rows: Grid): Map<string, PreProdAssetRow> {
  const map = new Map<string, PreProdAssetRow>();
  for (const r of rows) {
    const showName = text(r[0]);
    const promoName = text(r[1]);
    if (!showName || !promoName) continue;
    if (normKey(showName) === "show_name") continue;
    const id = promoJoinKey(showName, promoName);
    const remark = text(r[8]);
    map.set(id, {
      status: text(r[2]),
      artist: text(r[3]),
      totalAssets: num(r[4]),
      startDate: toIsoDate(r[5]),
      plannedDate: toIsoDate(r[6]),
      closedDate: toIsoDate(r[7]),
      calculatedPlannedDate: toIsoDate(r[9]),
      remarksLog: remark
        ? [{ id: `pr-${id}`, at: toIsoDate(r[7]) ?? toIsoDate(r[6]) ?? "", body: remark }]
        : [],
      pickedAt: null,
      delayFlagged: false,
      assetsNeededBy: null,
    });
  }
  return map;
}

// ── Master Productivity → quality reviews ─────────────────────────────────────

/** Master Productivity data rows (sliced past 2 header rows). A..W. */
export function parseQuality(rows: Grid): QualityReview[] {
  const out: QualityReview[] = [];
  let seq = 0;
  for (const r of rows) {
    const showName = text(r[0]);
    const promoName = text(r[1]);
    const partNo = num(r[2]);
    if (!showName || !promoName || partNo == null) continue;
    if (normKey(showName) === "show name") continue;

    const promoId = promoJoinKey(showName, promoName);
    const animators = splitNames(r[5]);
    const editors = splitNames(r[6]);
    const hasAnim = [8, 9, 10, 11, 12, 13].some((i) => num(r[i]) != null) || text(r[14]);
    const hasEdit = [17, 18, 19, 20, 21].some((i) => num(r[i]) != null) || text(r[22]);

    out.push({
      id: `qr-${promoId}-${partNo}-${seq++}`,
      promoId,
      partNo,
      krockLink: text(r[3]),
      cps: text(r[4]) ?? "",
      animators,
      editors,
      versionCorrection: text(r[7]),
      animation: hasAnim
        ? {
            overallQuality: num(r[8]),
            scriptKnowledge: num(r[9]),
            correctionsUnderstood: num(r[10]),
            skinTextures: num(r[11]),
            shotContinuity: num(r[12]),
            cameraShots: num(r[13]),
            weakAreas: text(r[14]),
            remark: text(r[15]),
          }
        : null,
      editing: hasEdit
        ? {
            storytelling: num(r[17]),
            preemptiveEffort: num(r[18]),
            shotPlacementFlow: num(r[19]),
            colorConsistency: num(r[20]),
            technical: num(r[21]),
            remark: text(r[22]),
          }
        : null,
    });
  }
  return out;
}

// ── Assets Master → assetTeam per promo (fuzzy show+script join) ──────────────

export type AssetRow = {
  showName: string;
  scriptName: string;
  showKey: string;
  scriptKey: string;
  row: AssetTeamRow;
};

export function parseAssets(rows: Grid): AssetRow[] {
  const out: AssetRow[] = [];
  for (const r of rows) {
    // col A is a serial number; show/script start at index 1/2.
    const rawShow = text(r[1]);
    const rawScript = text(r[2]);
    if (!rawShow && !rawScript) continue;
    // Empty Script Name stays empty — do not copy Show into it.
    const showName = rawShow ?? "";
    const scriptName = rawScript ?? "";
    if (normKey(showName || scriptName) === "show_name") continue;
    out.push({
      showName,
      scriptName,
      showKey: normKey(showName),
      scriptKey: normKey(scriptName),
      row: {
        assetsStatus: text(r[4]),
        remarks: text(r[5]),
        assetMapLink: text(r[6]),
        assetCanvasLink: text(r[7]),
        assetsDriveLink: text(r[8]),
        artist1: text(r[9]),
        artist2: text(r[10]),
        artist3: text(r[11]),
        artLead: text(r[12]),
        startDate: text(r[24]),
        endDate: text(r[25]),
        totalDays: num(r[26]),
        correctionsStartDate: text(r[27]),
        correctionsEndDate: text(r[28]),
        correctionsTotalDays: num(r[29]),
        productionDays: num(r[30]),
        costing: num(r[31]),
        assetsCount: text(r[32]),
        dashverseNotes: text(r[22]),
        synopsis: text(r[20]),
        notes: text(r[21]),
      },
    });
  }
  return out;
}

/** Best-effort: match a promo to an asset row by show + overlapping script/promo tokens. */
export function matchAsset(promo: Promo, assets: AssetRow[]): AssetTeamRow | null {
  const showKey = normKey(promo.showName).replace(/\s+animation$/, "");
  const promoKey = normKey(promo.promoName);
  const promoTokens = promoKey.split(/[^a-z0-9]+/).filter((t) => t.length >= 3);

  const sameShow = assets.filter(
    (a) => a.showKey === showKey || a.showKey.startsWith(showKey) || showKey.startsWith(a.showKey)
  );
  if (sameShow.length === 0) return null;

  // Exact script/promo name first — don't let "Alt World EXT" steal "Alt World".
  const exact = sameShow.filter((a) => a.scriptKey === promoKey);
  if (exact.length) return exact[exact.length - 1].row;

  // Exact-ish: script contains promo name or vice-versa. Last row wins (newest).
  const contained = sameShow.filter(
    (a) => a.scriptKey.includes(promoKey) || promoKey.includes(a.scriptKey)
  );
  if (contained.length) return contained[contained.length - 1].row;

  // Token overlap score; last highest score wins.
  let best: { score: number; row: AssetTeamRow } | null = null;
  for (const a of sameShow) {
    const tokens = a.scriptKey.split(/[^a-z0-9]+/);
    const score = promoTokens.filter((t) => tokens.includes(t)).length;
    if (score > 0 && (!best || score >= best.score)) best = { score, row: a.row };
  }
  return best?.row ?? null;
}

// ── Animators (derived from parts + quality) ──────────────────────────────────

export function buildAnimators(
  partArtistCells: { names: string[]; team: TeamKind }[],
  qualityAnimators: string[]
): Animator[] {
  const teamByName = new Map<string, TeamKind>();
  for (const cell of partArtistCells) {
    for (const n of cell.names) {
      const k = normKey(n);
      // agency wins if ever marked agency
      if (cell.team === "agency" || !teamByName.has(k)) teamByName.set(k, cell.team);
    }
  }
  for (const n of qualityAnimators) {
    const k = normKey(n);
    if (!teamByName.has(k)) teamByName.set(k, "in_house");
  }

  const seen = new Map<string, Animator>();
  for (const [k, team] of teamByName) {
    // reconstruct a display name from the first occurrence
    const display = displayNameFor(k, partArtistCells, qualityAnimators);
    if (!display) continue;
    seen.set(k, {
      id: `a:${slug(display)}`,
      name: display,
      team,
      minutesPerWeek: 0,
      onTimePct: 0,
    });
  }
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function displayNameFor(
  key: string,
  partArtistCells: { names: string[] }[],
  qualityAnimators: string[]
): string | null {
  for (const cell of partArtistCells) {
    const hit = cell.names.find((n) => normKey(n) === key);
    if (hit) return hit;
  }
  const q = qualityAnimators.find((n) => normKey(n) === key);
  return q ?? null;
}
