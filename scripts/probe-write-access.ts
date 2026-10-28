import { config } from "dotenv";
config({ path: ".env.local" });
import { google } from "googleapis";

const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
const key = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
const auth = new google.auth.JWT({
  email,
  key,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

const TARGETS: { name: string; id: string; tab: string; probeCell: string }[] = [
  {
    name: "Timeline",
    id: "1Tm1CLtoJmbUjVXHIpf969Y3RLsbKLaw4HhxDxcJ0wbs",
    tab: "Master Tracker",
    probeCell: "BA1000",
  },
  {
    name: "MasterPFM",
    id: "1-2MmgaVf4-lpJ4vu-p_9TB1J8ig4vn4yvz2K2Mft3vA",
    tab: "Master Sheet",
    probeCell: "AO1900",
  },
  {
    name: "Assets",
    id: "1_0QMYmGef8A-mckXPWjGKD9_fUvxvzvpk5zvx5NnYQA",
    tab: "Promos - Assets Master Sheet",
    probeCell: "AG1000",
  },
];

async function probe(t: (typeof TARGETS)[number]) {
  try {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: t.id,
      fields: "properties.title",
    });
    const range = `'${t.tab}'!${t.probeCell}`;
    try {
      // Read first so we never clobber real data.
      const before = await sheets.spreadsheets.values.get({ spreadsheetId: t.id, range });
      const existing = before.data.values?.[0]?.[0];
      if (existing) {
        console.log(
          `${t.name}: SKIP write probe — ${t.probeCell} already has data: ${String(existing).slice(0, 40)}`
        );
        return;
      }
      await sheets.spreadsheets.values.update({
        spreadsheetId: t.id,
        range,
        valueInputOption: "RAW",
        requestBody: { values: [["__ops_write_probe__"]] },
      });
      await sheets.spreadsheets.values.clear({ spreadsheetId: t.id, range });
      console.log(`${t.name}: READ+WRITE OK (${meta.data.properties?.title} / ${t.tab})`);
    } catch (e: any) {
      const msg = e?.errors?.[0]?.message || e?.message;
      console.log(`${t.name}: READ ok, WRITE FAIL — ${msg}`);
    }
  } catch (e: any) {
    console.log(`${t.name}: FAIL — ${e?.errors?.[0]?.message || e?.message}`);
  }
}

(async () => {
  console.log("SA:", email);
  for (const t of TARGETS) await probe(t);
})();
