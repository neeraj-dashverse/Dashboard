import { config } from "dotenv";
config({ path: ".env.local" });
import { google } from "googleapis";

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
  key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});
const sheets = google.sheets({ version: "v4", auth });
const col = (i: number) => {
  let s = "";
  i += 1;
  while (i > 0) {
    const m = (i - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
};

(async () => {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: "1_0QMYmGef8A-mckXPWjGKD9_fUvxvzvpk5zvx5NnYQA",
    range: "'Promos - Assets Master Sheet'!A1:AG3",
  });
  const rows = res.data.values || [];
  const header = rows[0] || [];
  const sample = rows[1] || [];
  header.forEach((h, i) => {
    console.log(`${col(i).padEnd(3)} ${String(h).slice(0, 36).padEnd(38)} | ${String(sample[i] ?? "").slice(0, 30)}`);
  });
})();
