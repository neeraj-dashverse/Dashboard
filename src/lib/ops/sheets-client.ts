/**
 * Google Sheets read client + cell parsers.
 * Server-only (uses service-account JWT). Never import from a client component.
 */
import { google } from "googleapis";

export type Grid = string[][];

let cachedClient: ReturnType<typeof google.sheets> | null = null;

export function hasSheetCredentials(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY
  );
}

function sheetsClient() {
  if (cachedClient) return cachedClient;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!email || !key) throw new Error("Missing Google service-account credentials");
  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  cachedClient = google.sheets({ version: "v4", auth });
  return cachedClient;
}

/** Read several A1 ranges from one spreadsheet in a single call. */
export async function batchGet(
  spreadsheetId: string,
  ranges: string[]
): Promise<Record<string, Grid>> {
  const sheets = sheetsClient();
  const res = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges });
  const out: Record<string, Grid> = {};
  const valueRanges = res.data.valueRanges || [];
  ranges.forEach((range, i) => {
    out[range] = (valueRanges[i]?.values as Grid) || [];
  });
  return out;
}

// ── Cell parsers ────────────────────────────────────────────────────────────

export function text(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

/** "8,150" / "132" → number; blank/garbage → null. */
export function num(v: unknown): number | null {
  const s = String(v ?? "").replace(/[, ]/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** "00:49:27" → 2967 sec. Also tolerates "~6min", "6 min", "15min content". */
export function durationToSec(v: unknown): number | null {
  const raw = String(v ?? "").trim();
  if (!raw) return null;
  const hms = raw.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (hms) return Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3]);
  const ms = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (ms) return Number(ms[1]) * 60 + Number(ms[2]);
  const mins = raw.match(/~?\s*(\d+(?:\.\d+)?)\s*min/i);
  if (mins) return Math.round(Number(mins[1]) * 60);
  return null;
}

/**
 * Sheet date → ISO yyyy-mm-dd.
 * `order` picks interpretation for slash/dash numeric dates:
 *  - "dmy" (Production/Pre-Production tabs, e.g. 02/09/2026)
 *  - "mdy" (Assets tab, e.g. 7/8/2026)
 * Also handles "17-July" style (assumes current ops year).
 */
export function toIsoDate(v: unknown, order: "dmy" | "mdy" = "dmy"): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;

  const numeric = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (numeric) {
    let [, a, b, y] = numeric;
    let dd: number;
    let mm: number;
    if (order === "mdy") {
      mm = Number(a);
      dd = Number(b);
    } else {
      dd = Number(a);
      mm = Number(b);
    }
    // Guard: if the "month" is >12 the order was wrong — swap.
    if (mm > 12 && dd <= 12) {
      const t = mm;
      mm = dd;
      dd = t;
    }
    let year = Number(y);
    if (year < 100) year += 2000;
    if (year < 1900) year = 2000 + (year % 100);
    if (!dd || !mm || dd > 31 || mm > 12) return null;
    return `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }

  const MONTHS: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };
  const named = s.match(/^(\d{1,2})[-\s]+([A-Za-z]{3,})/);
  if (named) {
    const dd = Number(named[1]);
    const mm = MONTHS[named[2].slice(0, 3).toLowerCase()];
    if (dd && mm) {
      const year = 2026; // current ops window
      return `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }
  }
  return null;
}

/** Header/placeholder words that are not real people. */
const NAME_STOPWORDS = new Set([
  "artist", "artists", "editor", "editors", "team", "animator", "animators",
  "tbd", "na", "n/a", "nil", "none", "-", "show_name", "promo name",
]);

/** Split a multi-name cell ("Rahul Mittal, Vedika Beniwal") into clean names. */
export function splitNames(v: unknown): string[] {
  return String(v ?? "")
    .split(/[,/]|&| and /i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !NAME_STOPWORDS.has(s.toLowerCase()));
}

export function slug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Normalize a free-text key for cross-tab joins. */
export function normKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}
