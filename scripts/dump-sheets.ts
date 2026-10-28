/**
 * One-off: dump real headers + sample rows from every known tab so we can
 * map the live Sheets layout (not schema guesses) into the ops adapter.
 * Run: npx tsx scripts/dump-sheets.ts > /tmp/sheet-dump.txt 2>&1
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { google } from "googleapis";

const EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
const KEY = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

const auth = new google.auth.JWT({
  email: EMAIL,
  key: KEY,
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});
const sheets = google.sheets({ version: "v4", auth });

const TARGETS: Record<string, { id: string; tabs?: string[] }> = {
  Timeline: {
    id: "1Tm1CLtoJmbUjVXHIpf969Y3RLsbKLaw4HhxDxcJ0wbs",
    tabs: [
      "Master Tracker",
      "Production Tracker",
      "Pre Production Tracker",
      "Master Productivity",
      "Productivity Animation",
      "Productivity Editing",
      "My daily udpates",
    ],
  },
  MasterPFM: { id: "1-2MmgaVf4-lpJ4vu-p_9TB1J8ig4vn4yvz2K2Mft3vA", tabs: ["Master Sheet"] },
  Assets: {
    id: "1_0QMYmGef8A-mckXPWjGKD9_fUvxvzvpk5zvx5NnYQA",
    tabs: ["Promos - Assets Master Sheet"],
  },
};

function cleanRow(r: unknown[]): string {
  return (r || []).map((c) => String(c ?? "").replace(/\s+/g, " ").trim()).join(" | ");
}

async function listTabs(id: string): Promise<string[]> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: id });
  return (meta.data.sheets || []).map((s) => s.properties?.title || "");
}

async function dumpTab(id: string, tab: string) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: id,
      range: `'${tab}'!A1:BZ12`,
    });
    const rows = res.data.values || [];
    console.log(`\n===== TAB: ${tab} (${rows.length} rows read) =====`);
    rows.forEach((r, i) => console.log(`[r${i}] ${cleanRow(r)}`));
  } catch (e: any) {
    console.log(`\n===== TAB: ${tab} — ERROR: ${e?.message} =====`);
  }
}

(async () => {
  for (const [name, t] of Object.entries(TARGETS)) {
    console.log(`\n\n########## ${name} (${t.id}) ##########`);
    try {
      const allTabs = await listTabs(t.id);
      console.log(`ALL TABS: ${allTabs.join(" || ")}`);
    } catch (e: any) {
      console.log(`META ERROR: ${e?.message}`);
      continue;
    }
    for (const tab of t.tabs || []) await dumpTab(t.id, tab);
  }
})();
