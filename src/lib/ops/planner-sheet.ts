/**
 * Planner tab (PFM_dashboard_Timeline → "Planner") — read/write.
 *
 * Long format so new promos/parts/days never need new columns:
 *   A Show_Name | B Promo Name | C Part ("All" = promo-level) | D Date (ISO)
 *   E Plan (free text: "Assets", "First cut", "R&C"…) | F Updated | G Promo ID
 *
 * Server-only. Uses a write-scoped service-account client.
 */
import { google } from "googleapis";
import { PFM_TIMELINE_SHEET } from "./sheet-registry";
import { googlePrivateKey, text } from "./sheets-client";
import type { PlannerCell } from "./types";
import { promoJoinKey } from "./types";

export const PLANNER_TAB = "Planner";
const HEADER = ["Show_Name", "Promo Name", "Part", "Date", "Plan", "Updated", "Promo ID"];
const SHEET_ID = PFM_TIMELINE_SHEET.spreadsheetId;
export const PLANNER_RANGE = `'${PLANNER_TAB}'!A:G`;

let writeClient: ReturnType<typeof google.sheets> | null = null;
function sheets() {
  if (writeClient) return writeClient;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = googlePrivateKey();
  if (!email || !key) throw new Error("Missing Google service-account credentials");
  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  writeClient = google.sheets({ version: "v4", auth });
  return writeClient;
}

/** Create the Planner tab (with header) if it doesn't exist yet. Idempotent. */
export async function ensurePlannerTab(): Promise<"exists" | "created"> {
  const api = sheets();
  const meta = await api.spreadsheets.get({
    spreadsheetId: SHEET_ID,
    fields: "sheets.properties.title",
  });
  const has = (meta.data.sheets ?? []).some((s) => s.properties?.title === PLANNER_TAB);
  if (has) return "exists";
  try {
    await api.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: PLANNER_TAB,
                gridProperties: { rowCount: 2000, columnCount: 8, frozenRowCount: 1 },
              },
            },
          },
        ],
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/already exists/i.test(msg)) return "exists";
    throw err;
  }
  await api.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'${PLANNER_TAB}'!A1:G1`,
    valueInputOption: "RAW",
    requestBody: { values: [HEADER] },
  });
  return "created";
}

/** Planner tab rows (already fetched via batchGet) → cells. Header row skipped. */
export function parsePlanner(rows: string[][]): PlannerCell[] {
  const out: PlannerCell[] = [];
  for (const r of rows.slice(1)) {
    const show = text(r[0]);
    const promo = text(r[1]);
    const date = text(r[3]);
    const plan = text(r[4]);
    if (!date || !plan || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const promoId = text(r[6]) ?? (show && promo ? promoJoinKey(show, promo) : null);
    if (!promoId) continue;
    const partRaw = text(r[2]);
    const partNo = !partRaw || /^all$/i.test(partRaw) ? 0 : Number(partRaw.replace(/\D/g, "")) || 0;
    out.push({ promoId, partNo, date, text: plan, updatedAt: text(r[5]) ?? "" });
  }
  return out;
}

// Serialize writes so two quick edits can never both append the same new row.
let chain: Promise<unknown> = Promise.resolve();

/** Upsert (or clear, when `plan` is empty) one planner cell on the sheet. */
export function writePlannerCell(args: {
  showName: string;
  promoName: string;
  promoId: string;
  partNo: number;
  date: string;
  plan: string;
  updatedAt: string;
}): Promise<void> {
  const run = async () => {
    await ensurePlannerTab();
    const api = sheets();
    const res = await api.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: PLANNER_RANGE,
    });
    const rows = (res.data.values as string[][] | undefined) ?? [];
    const partLabel = args.partNo === 0 ? "All" : `Part ${args.partNo}`;

    let rowIdx = -1; // 0-based index into rows
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const id = text(r[6]) ?? promoJoinKey(String(r[0] ?? ""), String(r[1] ?? ""));
      const part = text(r[2]);
      const pNo = !part || /^all$/i.test(part) ? 0 : Number(part.replace(/\D/g, "")) || 0;
      if (id === args.promoId && pNo === args.partNo && text(r[3]) === args.date) {
        rowIdx = i;
        break;
      }
    }

    const values = [
      [args.showName, args.promoName, partLabel, args.date, args.plan, args.updatedAt, args.promoId],
    ];
    if (!args.plan.trim()) {
      if (rowIdx >= 0) {
        await api.spreadsheets.values.clear({
          spreadsheetId: SHEET_ID,
          range: `'${PLANNER_TAB}'!A${rowIdx + 1}:G${rowIdx + 1}`,
        });
      }
      return;
    }
    if (rowIdx >= 0) {
      await api.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `'${PLANNER_TAB}'!A${rowIdx + 1}:G${rowIdx + 1}`,
        valueInputOption: "RAW",
        requestBody: { values },
      });
    } else {
      await api.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: `'${PLANNER_TAB}'!A1:G1`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values },
      });
    }
  };
  const next = chain.then(run, run);
  chain = next.catch(() => undefined);
  return next as Promise<void>;
}

/** Replace every plan date for one part. One sheet read, then one batch of writes. */
export function syncPlanPart(args: {
  showName: string;
  promoName: string;
  promoId: string;
  partNo: number;
  updatedAt: string;
  slots: { label: string; date: string; match: string }[];
}): Promise<void> {
  const run = async () => {
    await ensurePlannerTab();
    const api = sheets();
    const res = await api.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: PLANNER_RANGE,
    });
    const rows = (res.data.values as string[][] | undefined) ?? [];
    const partLabel = args.partNo === 0 ? "All" : `Part ${args.partNo}`;
    const owned = (r: string[]) => {
      const id = text(r[6]) ?? promoJoinKey(String(r[0] ?? ""), String(r[1] ?? ""));
      const part = text(r[2]);
      const pNo = !part || /^all$/i.test(part) ? 0 : Number(part.replace(/\D/g, "")) || 0;
      return id === args.promoId && pNo === args.partNo;
    };

    const clears: number[] = [];
    const updates: { row: number; values: string[] }[] = [];
    const appends: string[][] = [];

    for (const slot of args.slots) {
      const re = new RegExp(slot.match, "i");
      const hits: number[] = [];
      for (let i = 1; i < rows.length; i++) {
        if (!owned(rows[i])) continue;
        if (re.test(String(rows[i][4] ?? ""))) hits.push(i);
      }
      const values = [
        args.showName,
        args.promoName,
        partLabel,
        slot.date,
        slot.label,
        args.updatedAt,
        args.promoId,
      ];
      if (!slot.date.trim()) {
        clears.push(...hits);
        continue;
      }
      if (hits.length === 0) appends.push(values);
      else {
        updates.push({ row: hits[0], values });
        clears.push(...hits.slice(1));
        rows[hits[0]] = values;
      }
    }

    if (updates.length) {
      await api.spreadsheets.values.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          valueInputOption: "RAW",
          data: updates.map((u) => ({
            range: `'${PLANNER_TAB}'!A${u.row + 1}:G${u.row + 1}`,
            values: [u.values],
          })),
        },
      });
    }
    if (clears.length) {
      await api.spreadsheets.values.batchClear({
        spreadsheetId: SHEET_ID,
        requestBody: {
          ranges: clears.map((i) => `'${PLANNER_TAB}'!A${i + 1}:G${i + 1}`),
        },
      });
    }
    if (appends.length) {
      await api.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: `'${PLANNER_TAB}'!A1:G1`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: appends },
      });
    }
  };
  const next = chain.then(run, run);
  chain = next.catch(() => undefined);
  return next as Promise<void>;
}

export const REMARKS_TAB = "Remarks";
const REMARKS_HEADER = ["Show_Name", "Promo Name", "Part", "Remark", "At", "Promo ID"];
export const REMARKS_RANGE = `'${REMARKS_TAB}'!A:F`;

/** Create the Remarks tab if needed. Each remark is one new row. */
export async function ensureRemarksTab(): Promise<"exists" | "created"> {
  const api = sheets();
  const meta = await api.spreadsheets.get({
    spreadsheetId: SHEET_ID,
    fields: "sheets.properties.title",
  });
  const has = (meta.data.sheets ?? []).some((s) => s.properties?.title === REMARKS_TAB);
  if (has) return "exists";
  try {
    await api.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: REMARKS_TAB,
                gridProperties: { rowCount: 2000, columnCount: 6, frozenRowCount: 1 },
              },
            },
          },
        ],
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/already exists/i.test(msg)) return "exists";
    throw err;
  }
  await api.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'${REMARKS_TAB}'!A1:F1`,
    valueInputOption: "RAW",
    requestBody: { values: [REMARKS_HEADER] },
  });
  return "created";
}

export type PlanRemarkRow = {
  promoId: string;
  partNo: number;
  body: string;
  at: string;
};

/** Remarks tab → newest last in the sheet; caller can reverse for display. */
export function parseRemarks(rows: string[][]): PlanRemarkRow[] {
  const out: PlanRemarkRow[] = [];
  for (const r of rows.slice(1)) {
    const show = text(r[0]);
    const promo = text(r[1]);
    const body = text(r[3]);
    const at = text(r[4]);
    if (!body) continue;
    const promoId = text(r[5]) ?? (show && promo ? promoJoinKey(show, promo) : null);
    if (!promoId) continue;
    const partRaw = text(r[2]);
    const partNo = !partRaw || /^all$/i.test(partRaw) ? 0 : Number(partRaw.replace(/\D/g, "")) || 0;
    out.push({ promoId, partNo, body, at: at ?? "" });
  }
  return out;
}

/** Append one remark. Never updates an older row. */
export function appendPlanRemark(args: {
  showName: string;
  promoName: string;
  promoId: string;
  partNo: number;
  body: string;
  at: string;
}): Promise<void> {
  const run = async () => {
    await ensureRemarksTab();
    const partLabel = args.partNo === 0 ? "All" : `Part ${args.partNo}`;
    await sheets().spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `'${REMARKS_TAB}'!A1:F1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[args.showName, args.promoName, partLabel, args.body, args.at, args.promoId]],
      },
    });
  };
  const next = chain.then(run, run);
  chain = next.catch(() => undefined);
  return next as Promise<void>;
}
