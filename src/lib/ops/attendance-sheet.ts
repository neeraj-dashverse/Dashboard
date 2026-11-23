/**
 * The live tab is spelled "Attendence" and only keeps the current month.
 * Each person-day is copied to "Attendance log" so a month is still there after the sheet rolls forward.
 * A later change on the live tab (Working → Leave) updates that same day. Days no longer on the live tab stay.
 */
import { google } from "googleapis";
import { PFM_TIMELINE_SHEET } from "./sheet-registry";
import { googlePrivateKey, text, toIsoDate, type Grid } from "./sheets-client";
import type { AttendanceDay } from "./types";

const LIVE_TAB = "Attendence";
const LOG_TAB = "Attendance log";
const HEADER = ["Name", "Date", "Status"];
const SHEET_ID = PFM_TIMELINE_SHEET.spreadsheetId;

let client: ReturnType<typeof google.sheets> | null = null;
function sheets() {
  if (client) return client;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = googlePrivateKey();
  if (!email || !key) throw new Error("Missing Google service-account credentials");
  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  client = google.sheets({ version: "v4", auth });
  return client;
}

function personKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function dayKey(name: string, date: string): string {
  return `${personKey(name)}|${date}`;
}

/** Working and Leave are personal; anything else on Attendence is an org holiday (Diwali, Sunday, …). */
function isNamedHolidayStatus(status: string | null | undefined): status is string {
  const value = (status ?? "").trim();
  return Boolean(value) && !/^working$/i.test(value) && !/^leave$/i.test(value);
}

export function parseAttendance(rows: Grid): AttendanceDay[] {
  const header = rows[0] ?? [];
  const dates = header.map((cell, index) => ({ index, date: toIsoDate(cell, "dmy") }));
  const out: AttendanceDay[] = [];
  for (const row of rows.slice(1)) {
    const name = text(row[0]);
    if (!name || personKey(name) === "name") continue;
    for (const column of dates) {
      if (!column.date) continue;
      const status = text(row[column.index]);
      if (!status) continue;
      out.push({ name, date: column.date, status });
    }
  }
  return out;
}

async function ensureLog(): Promise<void> {
  const api = sheets();
  const meta = await api.spreadsheets.get({
    spreadsheetId: SHEET_ID,
    fields: "sheets.properties.title",
  });
  const has = (meta.data.sheets ?? []).some((sheet) => sheet.properties?.title === LOG_TAB);
  if (has) return;
  await api.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: LOG_TAB,
              gridProperties: { frozenRowCount: 1, columnCount: 3 },
            },
          },
        },
      ],
    },
  });
  await api.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'${LOG_TAB}'!A1:C1`,
    valueInputOption: "RAW",
    requestBody: { values: [HEADER] },
  });
}

async function read(range: string): Promise<Grid> {
  const res = await sheets().spreadsheets.values.get({ spreadsheetId: SHEET_ID, range });
  return (res.data.values as Grid | undefined) ?? [];
}

/** Live Attendence first. Archiving to the log must not wipe Diwali / Sunday if the write fails. */
export async function syncAttendance(): Promise<AttendanceDay[]> {
  const live = await read(`'${LIVE_TAB}'!A1:CZ200`);
  const current = parseAttendance(live);
  try {
    await ensureLog();
    const log = await read(`'${LOG_TAB}'!A:C`);
    const saved = new Map<string, { row: number; status: string }>();
    for (let i = 1; i < log.length; i++) {
      const name = text(log[i][0]);
      const date = text(log[i][1]);
      const status = text(log[i][2]);
      if (!name || !date || !status) continue;
      saved.set(dayKey(name, date), { row: i + 1, status });
    }

    const appends: string[][] = [];
    const updates: { row: number; status: string }[] = [];
    for (const day of current) {
      const prev = saved.get(dayKey(day.name, day.date));
      if (!prev) {
        appends.push([day.name, day.date, day.status]);
        continue;
      }
      if (prev.status !== day.status) updates.push({ row: prev.row, status: day.status });
    }

    const api = sheets();
    if (updates.length) {
      await api.spreadsheets.values.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          valueInputOption: "RAW",
          data: updates.map((update) => ({
            range: `'${LOG_TAB}'!C${update.row}`,
            values: [[update.status]],
          })),
        },
      });
    }
    if (appends.length) {
      await api.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: `'${LOG_TAB}'!A1:C1`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: appends },
      });
    }

    const liveKeys = new Set(current.map((day) => dayKey(day.name, day.date)));
    const holidaysFromLog: AttendanceDay[] = [];
    for (const row of log.slice(1)) {
      const name = text(row[0]);
      const date = logDate(row[1]);
      const status = text(row[2]);
      if (!name || !date || !isNamedHolidayStatus(status)) continue;
      if (liveKeys.has(dayKey(name, date))) continue;
      holidaysFromLog.push({ name, date, status });
    }
    return [...current, ...holidaysFromLog];
  } catch (err) {
    console.error("[ops] Attendance log archive failed:", err);
    return current;
  }
}

function logDate(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return toIsoDate(raw);
}

function nextIso(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** Leave stretches from the Google Sheet log, including months no longer on the live tab. */
export async function leaveHistoryText(): Promise<string> {
  const days = await readAttendanceLog();
  const byName = new Map<string, string[]>();
  for (const day of days) {
    if (!/^leave$/i.test(day.status)) continue;
    const list = byName.get(day.name) ?? [];
    list.push(day.date);
    byName.set(day.name, list);
  }
  const lines: string[] = [];
  for (const [name, dates] of [...byName.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const sorted = [...new Set(dates)].sort();
    const runs: { start: string; end: string }[] = [];
    for (const date of sorted) {
      const last = runs[runs.length - 1];
      if (last && nextIso(last.end) === date) last.end = date;
      else runs.push({ start: date, end: date });
    }
    const text = runs.map((run) => (run.start === run.end ? run.start : `${run.start} to ${run.end}`)).join(", ");
    lines.push(`${name}: ${text}`);
  }
  return lines.join("\n");
}

/** Full history, read only when someone asks. Not loaded with the dashboard. */
export async function readAttendanceLog(): Promise<AttendanceDay[]> {
  await ensureLog();
  const log = await read(`'${LOG_TAB}'!A:C`);
  const out: AttendanceDay[] = [];
  for (const row of log.slice(1)) {
    const name = text(row[0]);
    const date = text(row[1]);
    const status = text(row[2]);
    if (!name || !date || !status) continue;
    out.push({ name, date, status });
  }
  return out;
}
