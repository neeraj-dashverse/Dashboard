import { byLatestPromo, isOngoingPromo } from "./selectors";
import type { IncomingPromo } from "./tasks";
import type { OpsSnapshot, Promo } from "./types";

function normShow(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function partHasAnimation(stage: string | null, aniStartDate: string | null): boolean {
  if (aniStartDate) return true;
  return Boolean(stage && stage !== "planning");
}

function showAlreadyOnTracker(snap: OpsSnapshot, showName: string): boolean {
  const key = normShow(showName);
  if (!key) return false;
  return snap.promos.some((promo) => normShow(promo.showName) === key);
}

function showHasStartedAnimation(snap: OpsSnapshot, showName: string): boolean {
  const key = normShow(showName);
  if (!key) return false;
  const promoIds = new Set(
    snap.promos.filter((promo) => normShow(promo.showName) === key).map((promo) => promo.id)
  );
  for (const part of snap.parts) {
    const partShow = normShow(part.promoId.split("|")[0] ?? "");
    if (partShow !== key && !promoIds.has(part.promoId)) continue;
    if (partHasAnimation(part.stage, part.aniStartDate) || part.plannedPlottedDate) return true;
  }
  return false;
}

function promoHasStartedAnimation(snap: OpsSnapshot, showName: string, promoName: string): boolean {
  const show = normShow(showName);
  const promo = normShow(promoName);
  const ids = new Set(
    snap.promos
      .filter((row) => normShow(row.showName) === show && normShow(row.promoName) === promo)
      .map((row) => row.id)
  );
  for (const part of snap.parts) {
    const [partShow, partPromo] = part.promoId.split("|");
    const matches =
      ids.has(part.promoId) || (normShow(partShow ?? "") === show && normShow(partPromo ?? "") === promo);
    if (!matches) continue;
    if (partHasAnimation(part.stage, part.aniStartDate)) return true;
  }
  return false;
}

/**
 * Workflow is intake for new PocketFM rows.
 * Skip unnamed PocketFM rows whose show is already on Master Tracker, and skip
 * any promo that already has production / animation started.
 */
export function filterWorkflowIncoming(incoming: IncomingPromo[], snap: OpsSnapshot): IncomingPromo[] {
  return incoming.filter((row) => {
    if (row.needsName || !row.promoName.trim()) {
      if (showAlreadyOnTracker(snap, row.showName)) return false;
      if (showHasStartedAnimation(snap, row.showName)) return false;
      return true;
    }
    return !promoHasStartedAnimation(snap, row.showName, row.promoName);
  });
}

export type HandoffGap = {
  promoId: string;
  showName: string;
  promoName: string;
  sheetIndex: number;
  missing: string[];
  cps: string | null;
  scriptLink: string | null;
  agencyScriptLink: string | null;
  demarcatedScriptLink: string | null;
  /** PocketFM Master Sheet col P title/link — hint only, not a Tracker fill. */
  pocketFmScript: string | null;
  voSamples: string | null;
  videoSamples: string | null;
  canvasLink: string | null;
  showLink: string | null;
  synopsisLink: string | null;
};

function blank(value: string | null | undefined): boolean {
  return !value?.trim();
}

/** True Master Tracker row — not an Assets / Pre-prod stub. */
export function isMasterTrackerPromo(promo: Promo): boolean {
  return promo.sheetIndex >= 0 && Boolean(promo.trackerStatus?.trim());
}

export function handoffGaps(promo: Promo): string[] {
  const missing: string[] = [];
  if (blank(promo.cps)) missing.push("CP name");
  if (blank(promo.workingScriptLink)) missing.push("Original script");
  if (blank(promo.agencyScriptLink)) missing.push("Agency script");
  if (blank(promo.demarcatedScriptLink)) missing.push("Demarcated script");
  return missing;
}

/**
 * Named rows on Neeraj's Master Tracker that still need CP and/or I/J/K.
 * Ignores PocketFM / Assets / Pre-prod stubs — those are not the working sheet.
 */
export function incompleteHandoffs(snap: OpsSnapshot): HandoffGap[] {
  const rows: HandoffGap[] = [];
  for (const promo of snap.promos) {
    if (!isMasterTrackerPromo(promo)) continue;
    if (!promo.promoName.trim()) continue;
    if (/paused/i.test(promo.trackerStatus ?? "")) continue;
    if (!isOngoingPromo(snap, promo)) continue;
    if (promoHasStartedAnimation(snap, promo.showName, promo.promoName)) continue;
    const missing = handoffGaps(promo);
    if (missing.length === 0) continue;
    rows.push({
      promoId: promo.id,
      showName: promo.showName,
      promoName: promo.promoName,
      sheetIndex: promo.sheetIndex,
      missing,
      cps: promo.cps,
      scriptLink: promo.workingScriptLink,
      agencyScriptLink: promo.agencyScriptLink,
      demarcatedScriptLink: promo.demarcatedScriptLink,
      pocketFmScript: promo.scriptLink,
      voSamples: promo.voSamples,
      videoSamples: promo.videoSamples,
      canvasLink: promo.canvasLink,
      showLink: promo.showLink,
      synopsisLink: promo.synopsisLink,
    });
  }
  return rows.sort((a, b) => byLatestPromo(a, b) || a.showName.localeCompare(b.showName));
}
