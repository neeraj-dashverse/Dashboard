import type { IncomingPromo } from "./tasks";
import type { OpsSnapshot } from "./types";

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
