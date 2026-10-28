import { config } from "dotenv";
config({ path: ".env.local" });
import { google } from "googleapis";

const EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
const KEY = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
const auth = new google.auth.JWT({ email: EMAIL, key: KEY, scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
const sheets = google.sheets({ version: "v4", auth });
const ID = "1Tm1CLtoJmbUjVXHIpf969Y3RLsbKLaw4HhxDxcJ0wbs";

async function dump(tab: string, range = "A1:BA20") {
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: ID, range: `'${tab}'!${range}` });
    const rows = res.data.values || [];
    console.log(`\n===== ${tab} (${rows.length} rows) =====`);
    rows.forEach((r, i) => console.log(`[r${i}] ${(r || []).map((c) => String(c ?? "").replace(/\s+/g, " ").trim()).join(" | ")}`));
  } catch (e: any) {
    console.log(`\n===== ${tab} ERROR: ${e?.message} =====`);
  }
}
(async () => {
  await dump("Planning for promos");
  await dump("Timeline Planning");
  await dump("Plannings");
})();
