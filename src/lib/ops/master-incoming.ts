import { DASHVERSE_PFM_SHEET } from "./sheet-registry";
import { batchGet, hasSheetCredentials, text } from "./sheets-client";
import type { IncomingPromo } from "./tasks";
import { promoJoinKey } from "./types";

export type MasterIncoming = {
  /** Every Master Sheet join key (used to ignore historical rows on first look). */
  catalog: string[];
  /** Open PocketFM rows that are not on Master Tracker yet, latest first. */
  incoming: IncomingPromo[];
};

function isFinishedMaster(stage: string | null, status: string | null): boolean {
  return /delivered|completed|closed/i.test(`${stage ?? ""} ${status ?? ""}`);
}

/** PocketFM Master Sheet vs Master Tracker. Blank promo names stay in the queue so they can be named. */
export async function loadNewMasterPromos(knownIds: string[]): Promise<MasterIncoming> {
  if (!hasSheetCredentials()) return { catalog: [], incoming: [] };
  const known = new Set(knownIds.map((id) => id.split("#")[0]));
  try {
    const range = `'${DASHVERSE_PFM_SHEET.tabs.master.name}'!A1:Z3000`;
    const book = await batchGet(DASHVERSE_PFM_SHEET.spreadsheetId, [range]);
    const rows = book[range] ?? [];
    const catalog: string[] = [];
    const incoming: IncomingPromo[] = [];
    const seen = new Set<string>();
    rows.forEach((r, index) => {
      const masterRow = index + 1;
      const showName = text(r[0]) ?? "";
      const promoName = text(r[1]) ?? "";
      if (!showName && !promoName) return;
      if (/^show[_\s]?name$/i.test(showName)) return;
      const needsName = !promoName;
      const join = promoJoinKey(showName, promoName);
      const id = `row:${masterRow}`;
      if (seen.has(id)) return;
      seen.add(id);
      if (!needsName && join && join !== "|") catalog.push(join);
      const stage = text(r[6]);
      const status = text(r[25]);
      if (!showName) return;
      if (isFinishedMaster(stage, status)) return;
      if (!needsName && known.has(join)) return;
      incoming.push({
        id,
        showName,
        promoName,
        stage,
        status,
        masterRow,
        needsName,
        scriptLink: text(r[15]),
        canvasLink: text(r[17]),
        voSamples: text(r[18]),
        videoSamples: text(r[19]),
        showLink: text(r[20]),
        synopsisLink: text(r[21]),
      });
    });
    return { catalog, incoming: incoming.slice().reverse() };
  } catch (err) {
    console.error("[ops] Master Sheet new-promo read failed:", err);
    return { catalog: [], incoming: [] };
  }
}
