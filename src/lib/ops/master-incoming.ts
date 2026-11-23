import { DASHVERSE_PFM_SHEET } from "./sheet-registry";
import { batchGet, hasSheetCredentials, text } from "./sheets-client";
import type { IncomingPromo } from "./tasks";
import { promoJoinKey } from "./types";

export type MasterIncoming = {
  /** Every Master Sheet join key (used to ignore historical rows on first look). */
  catalog: string[];
  /** Open, named rows that are not on Master Tracker. */
  incoming: IncomingPromo[];
};

function isFinishedMaster(stage: string | null, status: string | null): boolean {
  return /delivered|completed|closed/i.test(`${stage ?? ""} ${status ?? ""}`);
}

/** PocketFM Master Sheet vs Master Tracker. Old completed / blank rows stay off the Home list. */
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
    for (const r of rows) {
      const showName = text(r[0]) ?? "";
      const promoName = text(r[1]) ?? "";
      if (!showName && !promoName) continue;
      if (/^show[_\s]?name$/i.test(showName)) continue;
      const id = promoJoinKey(showName, promoName);
      if (!id || id === "|" || seen.has(id)) continue;
      seen.add(id);
      catalog.push(id);
      const stage = text(r[6]);
      const status = text(r[25]);
      if (!showName || !promoName) continue;
      if (known.has(id) || isFinishedMaster(stage, status)) continue;
      incoming.push({ id, showName, promoName, stage, status });
    }
    return { catalog, incoming };
  } catch (err) {
    console.error("[ops] Master Sheet new-promo read failed:", err);
    return { catalog: [], incoming: [] };
  }
}
