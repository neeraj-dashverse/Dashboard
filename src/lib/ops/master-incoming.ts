import { DASHVERSE_PFM_SHEET } from "./sheet-registry";
import { batchGet, hasSheetCredentials, text } from "./sheets-client";
import type { IncomingPromo } from "./tasks";
import { promoJoinKey } from "./types";

/** Master Sheet rows that are not on Master Tracker yet. Read-only. */
export async function loadNewMasterPromos(knownIds: string[]): Promise<IncomingPromo[]> {
  if (!hasSheetCredentials()) return [];
  const known = new Set(knownIds.map((id) => id.split("#")[0]));
  try {
    const range = `'${DASHVERSE_PFM_SHEET.tabs.master.name}'!A1:B3000`;
    const book = await batchGet(DASHVERSE_PFM_SHEET.spreadsheetId, [range]);
    const rows = book[range] ?? [];
    const out: IncomingPromo[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      const showName = text(r[0]) ?? "";
      const promoName = text(r[1]) ?? "";
      if (!showName && !promoName) continue;
      if (/^show[_\s]?name$/i.test(showName)) continue;
      const id = promoJoinKey(showName, promoName);
      if (!id || id === "|" || known.has(id) || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, showName, promoName });
    }
    return out;
  } catch (err) {
    console.error("[ops] Master Sheet new-promo read failed:", err);
    return [];
  }
}
