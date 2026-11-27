import { google } from "googleapis";
import { OPS_CONTACT_EMAIL, SCRIPT_COPIES_FOLDER } from "./sheet-registry";
import { googleFileId } from "./google-file";
import { sanitizeCopiedScript } from "./script-sanitize";
import { googlePrivateKey, hasSheetCredentials } from "./sheets-client";

let driveClient: ReturnType<typeof google.drive> | null = null;

function drive() {
  if (driveClient) return driveClient;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = googlePrivateKey();
  if (!email || !key) throw new Error("Missing Google service-account credentials");
  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  driveClient = google.drive({ version: "v3", auth });
  return driveClient;
}

function copyName(sourceName: string): string {
  const cleaned = sourceName.replace(/pocket\s*fm/gi, "").replace(/\s{2,}/g, " ").trim() || sourceName;
  return /^copy of /i.test(cleaned) ? cleaned : `Copy of ${cleaned}`;
}

function copiesFolderId(): string {
  return (process.env.GOOGLE_SCRIPT_COPIES_FOLDER_ID || "").trim() || SCRIPT_COPIES_FOLDER.id;
}

function quotaHelp(): string {
  const sa = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "the dashboard service account";
  return (
    `Google service accounts have no Drive storage. Create a Shared Drive, add ${sa} as Content manager, ` +
    `make a folder in that drive, and set GOOGLE_SCRIPT_COPIES_FOLDER_ID to the folder id ` +
    `(the last part of the Drive folder URL).`
  );
}

async function shareWriter(fileId: string, email: string): Promise<void> {
  await drive().permissions.create({
    fileId,
    requestBody: { type: "user", role: "writer", emailAddress: email },
    sendNotificationEmail: false,
    supportsAllDrives: true,
  });
}

export async function copyGoogleFile(
  source: string,
  shareWith?: string | null
): Promise<{ url: string; name: string }> {
  if (!hasSheetCredentials()) throw new Error("Google credentials are missing.");
  const fileId = googleFileId(source);
  if (!fileId) throw new Error("That PocketFM cell is not a Google Doc link.");

  const folder = copiesFolderId();
  if (!folder) throw new Error(quotaHelp());

  const client = drive();
  const folderMeta = await client.files.get({
    fileId: folder,
    fields: "id,name,mimeType,driveId",
    supportsAllDrives: true,
  });
  if (!folderMeta.data.driveId) {
    throw new Error(
      `Folder “${folderMeta.data.name || folder}” is in My Drive, not a Shared Drive. ${quotaHelp()}`
    );
  }

  const sourceFile = await client.files.get({
    fileId,
    fields: "id,name,mimeType",
    supportsAllDrives: true,
  });
  const name = copyName(sourceFile.data.name || "script");

  let copied;
  try {
    copied = await client.files.copy({
      fileId,
      requestBody: { name, parents: [folder] },
      fields: "id,name,webViewLink",
      supportsAllDrives: true,
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    if (/storage quota|service accounts do not have storage/i.test(raw)) {
      throw new Error(quotaHelp());
    }
    throw err;
  }

  const copyId = copied.data.id;
  if (!copyId) throw new Error("Google Drive did not return the copied file.");

  try {
    await sanitizeCopiedScript(copyId, sourceFile.data.mimeType, client);
  } catch (err) {
    console.error("[ops] script sanitize failed:", err);
    throw new Error(
      err instanceof Error
        ? `Copied, but could not strip Pocket FM from the file: ${err.message}`
        : "Copied, but could not strip Pocket FM from the file."
    );
  }

  const emails = new Set(
    [shareWith, OPS_CONTACT_EMAIL]
      .map((value) => value?.trim().toLowerCase())
      .filter((value): value is string => Boolean(value))
  );
  for (const email of emails) {
    try {
      await shareWriter(copyId, email);
    } catch (err) {
      console.error("[ops] share script copy failed:", email, err);
    }
  }

  const url =
    copied.data.webViewLink?.trim() ||
    (sourceFile.data.mimeType?.includes("spreadsheet")
      ? `https://docs.google.com/spreadsheets/d/${copyId}/edit`
      : `https://docs.google.com/document/d/${copyId}/edit`);
  return { url, name: copied.data.name || name };
}
