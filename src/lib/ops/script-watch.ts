import { scriptState } from "./google-file";
import { byLatestPromo, isOngoingPromo } from "./selectors";
import type { OpsSnapshot } from "./types";
import { isMasterTrackerPromo } from "./workflow-queue";

export type ScriptAlert = {
  promoId: string;
  showName: string;
  promoName: string;
  sheetIndex: number;
  pfmScript: string | null;
  trackerScript: string | null;
  kind: "paste" | "updated";
};

/** PocketFM Master Sheet script vs Master Tracker column I. */
export function scriptAlerts(snap: OpsSnapshot): ScriptAlert[] {
  const rows: ScriptAlert[] = [];
  for (const promo of snap.promos) {
    if (!isMasterTrackerPromo(promo)) continue;
    if (!isOngoingPromo(snap, promo)) continue;
    const state = scriptState(promo.scriptLink, promo.workingScriptLink);
    if (state === "same") continue;
    rows.push({
      promoId: promo.id,
      showName: promo.showName,
      promoName: promo.promoName,
      sheetIndex: promo.sheetIndex,
      pfmScript: promo.scriptLink,
      trackerScript: promo.workingScriptLink,
      kind: state,
    });
  }
  return rows.sort((a, b) => byLatestPromo(a, b) || a.showName.localeCompare(b.showName));
}
