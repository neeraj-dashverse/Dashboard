import { PFM_TIMELINE_SHEET } from "./sheet-registry";
import { batchGet, hasSheetCredentials, text } from "./sheets-client";
import { appendSheetRow, updateSheetValues } from "./sheets-write";
import { promoJoinKey } from "./types";

export type WorkflowIntake = {
  showName: string;
  promoName: string;
  cps: string;
  script: string;
  agencyScript: string;
  demarcatedScript: string;
};

function same(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

async function findTrackerRow(showName: string, promoName: string): Promise<number | null> {
  const tab = PFM_TIMELINE_SHEET.tabs.masterTracker.name;
  const range = `'${tab}'!A1:B3000`;
  const book = await batchGet(PFM_TIMELINE_SHEET.spreadsheetId, [range]);
  const rows = book[range] ?? [];
  for (let i = 0; i < rows.length; i++) {
    const show = text(rows[i][0]) ?? "";
    const promo = text(rows[i][1]) ?? "";
    if (/^show[_\s]?name$/i.test(show)) continue;
    if (same(show, showName) && same(promo, promoName)) return i + 1;
  }
  return null;
}

/** Write show + promo name onto Master Tracker (never the PocketFM sheet). */
export async function writeTrackerPromoName(showName: string, promoName: string): Promise<{ trackerRow: number }> {
  if (!hasSheetCredentials()) throw new Error("Google Sheets credentials are missing.");
  const show = showName.trim();
  const promo = promoName.trim();
  if (!show) throw new Error("Show name is missing.");
  if (!promo) throw new Error("Promo name is empty.");
  const tab = PFM_TIMELINE_SHEET.tabs.masterTracker.name;
  const existing = await findTrackerRow(show, promo);
  if (existing) {
    await updateSheetValues(PFM_TIMELINE_SHEET.spreadsheetId, `'${tab}'!A${existing}:C${existing}`, [
      [show, promo, "WIP"],
    ]);
    return { trackerRow: existing };
  }
  await appendSheetRow(PFM_TIMELINE_SHEET.spreadsheetId, `'${tab}'!A:C`, [show, promo, "WIP"]);
  const row = await findTrackerRow(show, promo);
  return { trackerRow: row ?? 0 };
}

/** Create or update the Master Tracker row: show, promo, WIP, CP, three script links. */
export async function writeTrackerIntake(
  intake: WorkflowIntake
): Promise<{ trackerRow: number; promoId: string }> {
  if (!hasSheetCredentials()) throw new Error("Google Sheets credentials are missing.");
  const showName = intake.showName.trim();
  const promoName = intake.promoName.trim();
  const cps = intake.cps.trim();
  const script = intake.script.trim();
  const agencyScript = intake.agencyScript.trim();
  const demarcatedScript = intake.demarcatedScript.trim();
  if (!showName) throw new Error("Show name is missing.");
  if (!promoName) throw new Error("Add a promo name first.");
  if (!cps) throw new Error("Pick a CP.");
  if (!agencyScript || !demarcatedScript) {
    throw new Error("Paste the agency script and the demarcated script before assigning a CP.");
  }

  const tab = PFM_TIMELINE_SHEET.tabs.masterTracker.name;
  const existing = await findTrackerRow(showName, promoName);
  if (existing) {
    await updateSheetValues(PFM_TIMELINE_SHEET.spreadsheetId, `'${tab}'!A${existing}:K${existing}`, [
      [showName, promoName, "WIP", "", cps, "", "", "", script, agencyScript, demarcatedScript],
    ]);
    return { trackerRow: existing, promoId: promoJoinKey(showName, promoName) };
  }

  await appendSheetRow(PFM_TIMELINE_SHEET.spreadsheetId, `'${tab}'!A:K`, [
    showName,
    promoName,
    "WIP",
    "",
    cps,
    "",
    "",
    "",
    script,
    agencyScript,
    demarcatedScript,
  ]);
  const after = await findTrackerRow(showName, promoName);
  return { trackerRow: after ?? 0, promoId: promoJoinKey(showName, promoName) };
}

export type TrackerHandoffPatch = {
  showName: string;
  promoName: string;
  cps?: string;
  script?: string;
  agencyScript?: string;
  demarcatedScript?: string;
};

/** Fill CP and script links on an already-named Master Tracker row. Only writes what was pasted. */
export async function writeTrackerHandoff(
  patch: TrackerHandoffPatch
): Promise<{ trackerRow: number; promoId: string }> {
  if (!hasSheetCredentials()) throw new Error("Google Sheets credentials are missing.");
  const showName = patch.showName.trim();
  const promoName = patch.promoName.trim();
  const cps = patch.cps?.trim() ?? "";
  const script = patch.script?.trim() ?? "";
  const agencyScript = patch.agencyScript?.trim() ?? "";
  const demarcatedScript = patch.demarcatedScript?.trim() ?? "";
  if (!showName || !promoName) throw new Error("Show and promo name are required.");
  if (!cps && !script && !agencyScript && !demarcatedScript) {
    throw new Error("Paste a CP name or a script link first.");
  }

  const tab = PFM_TIMELINE_SHEET.tabs.masterTracker.name;
  const existing = await findTrackerRow(showName, promoName);
  if (!existing) throw new Error("This promo is not on Master Tracker yet. Save the name first.");

  const range = `'${tab}'!A${existing}:K${existing}`;
  const book = await batchGet(PFM_TIMELINE_SHEET.spreadsheetId, [range]);
  const current = [...(book[range]?.[0] ?? [])];
  while (current.length < 11) current.push("");
  current[0] = showName;
  current[1] = promoName;
  if (!String(current[2] ?? "").trim()) current[2] = "WIP";
  if (cps) current[4] = cps;
  if (script) current[8] = script;
  if (agencyScript) current[9] = agencyScript;
  if (demarcatedScript) current[10] = demarcatedScript;

  await updateSheetValues(PFM_TIMELINE_SHEET.spreadsheetId, range, [current]);
  return { trackerRow: existing, promoId: promoJoinKey(showName, promoName) };
}
