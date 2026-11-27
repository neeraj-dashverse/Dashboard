import { google } from "googleapis";
import { sheetsWriteClient } from "./sheets-write";
import { googlePrivateKey } from "./sheets-client";

const POCKET_FM_TEXT =
  /pocket(?:\s|&nbsp;|&#160;|\u00a0|\.)*fm/gi;
const POCKET_FM_COMPACT = /pocketfm/gi;
const LOGO_IMG = /<img\b[^>]*(?:pocket|logo|brand|watermark)[^>]*>/gi;

let docsClient: ReturnType<typeof google.docs> | null = null;
let docsApiReady: boolean | null = null;

function docs() {
  if (docsClient) return docsClient;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = googlePrivateKey();
  if (!email || !key) throw new Error("Missing Google service-account credentials");
  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/documents", "https://www.googleapis.com/auth/drive"],
  });
  docsClient = google.docs({ version: "v1", auth });
  return docsClient;
}

/** Remove Pocket FM wording from plain text, HTML, or XML. */
export function stripPocketFmText(value: string): string {
  return value
    .replace(POCKET_FM_TEXT, "")
    .replace(POCKET_FM_COMPACT, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +\n/g, "\n");
}

export function stripPocketFmHtml(html: string): string {
  const withoutLogos = html.replace(LOGO_IMG, "");
  return stripPocketFmText(withoutLogos);
}

function isLogoObject(title?: string | null, description?: string | null): boolean {
  return /pocket|logo|brand|watermark/i.test(`${title ?? ""} ${description ?? ""}`);
}

async function sanitizeGoogleDoc(documentId: string): Promise<void> {
  const client = docs();
  const doc = await client.documents.get({ documentId }, { retry: false });
  const requests: Array<Record<string, unknown>> = [];

  for (const token of ["Pocket FM", "PocketFM", "Pocket.fm", "POCKET FM"]) {
    requests.push({
      replaceAllText: {
        containsText: { text: token, matchCase: false },
        replaceText: "",
      },
    });
  }

  for (const headerId of Object.keys(doc.data.headers ?? {})) {
    requests.push({ deleteHeader: { headerId } });
  }
  for (const footerId of Object.keys(doc.data.footers ?? {})) {
    requests.push({ deleteFooter: { footerId } });
  }

  for (const [id, obj] of Object.entries(doc.data.positionedObjects ?? {})) {
    const embedded = obj.positionedObjectProperties?.embeddedObject;
    if (!isLogoObject(embedded?.title, embedded?.description)) continue;
    requests.push({ deletePositionedObject: { objectId: id } });
  }

  if (requests.length === 0) return;
  await client.documents.batchUpdate({
    documentId,
    requestBody: { requests },
  });
}

async function sanitizeViaHtml(
  fileId: string,
  drive: ReturnType<typeof google.drive>
): Promise<void> {
  const exported = await drive.files.export(
    { fileId, mimeType: "text/html" },
    { responseType: "text" }
  );
  const html = stripPocketFmHtml(String(exported.data ?? ""));
  await drive.files.update({
    fileId,
    media: { mimeType: "text/html", body: html },
    supportsAllDrives: true,
  });
}

async function sanitizeGoogleSheet(spreadsheetId: string): Promise<void> {
  const sheets = sheetsWriteClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "A1:ZZ4000",
  });
  const rows = res.data.values ?? [];
  let changed = false;
  const next = rows.map((row) =>
    row.map((cell) => {
      const raw = String(cell ?? "");
      const cleaned = stripPocketFmText(raw);
      if (cleaned !== raw) changed = true;
      return cleaned;
    })
  );
  if (!changed) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "A1",
    valueInputOption: "RAW",
    requestBody: { values: next },
  });
}

/** Strip Pocket FM text and logos from a copied Google Doc or Sheet. */
export async function sanitizeCopiedScript(
  fileId: string,
  mimeType: string | null | undefined,
  drive: ReturnType<typeof google.drive>
): Promise<void> {
  if (mimeType?.includes("spreadsheet")) {
    await sanitizeGoogleSheet(fileId);
    return;
  }
  if (mimeType && !mimeType.includes("document") && !mimeType.includes("kix")) return;

  if (docsApiReady !== false) {
    try {
      await sanitizeGoogleDoc(fileId);
      docsApiReady = true;
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/accessNotConfigured|has not been used/i.test(message)) docsApiReady = false;
      else console.error("[ops] Docs API sanitize failed, using HTML fallback:", message.slice(0, 200));
    }
  }
  await sanitizeViaHtml(fileId, drive);
}
