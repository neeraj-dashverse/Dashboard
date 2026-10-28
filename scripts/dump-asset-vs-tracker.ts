import { config } from "dotenv";
config({ path: ".env.local" });
import { google } from "googleapis";

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
  key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});
const sheets = google.sheets({ version: "v4", auth });

(async () => {
  const [assets, tracker] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId: "1_0QMYmGef8A-mckXPWjGKD9_fUvxvzvpk5zvx5NnYQA",
      range: "'Promos - Assets Master Sheet'!A1:AC80",
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId: "1Tm1CLtoJmbUjVXHIpf969Y3RLsbKLaw4HhxDxcJ0wbs",
      range: "'Master Tracker'!A1:C40",
    }),
  ]);
  const arows = assets.data.values || [];
  console.log("=== ASSET SHEET ===");
  console.log("header E status, Y start, Z end, AC corr end");
  for (const r of arows.slice(1)) {
    const show = r[1], script = r[2], st = r[4], y = r[24], z = r[25], ac = r[28];
    if (!show && !script) continue;
    console.log(
      `${String(show ?? "").padEnd(12)} ${String(script ?? "").slice(0, 36).padEnd(38)} | ${String(st ?? "").padEnd(16)} Y=${String(y ?? "-").padEnd(12)} Z=${String(z ?? "-").padEnd(12)} AC=${ac ?? "-"}`
    );
  }
  console.log("\n=== MASTER TRACKER status ===");
  for (const r of (tracker.data.values || []).slice(2)) {
    if (!r[0]) continue;
    console.log(`${String(r[0]).padEnd(12)} ${String(r[1] ?? "").slice(0, 40).padEnd(42)} | ${r[2]}`);
  }
})();
