/**
 * Write-scoped Google Sheets client. Reads stay on the readonly client.
 */
import { google } from "googleapis";
import { googlePrivateKey } from "./sheets-client";

let writeClient: ReturnType<typeof google.sheets> | null = null;

export function sheetsWriteClient() {
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

export async function updateSheetValues(
  spreadsheetId: string,
  range: string,
  values: (string | number | null)[][]
): Promise<void> {
  await sheetsWriteClient().spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

export async function appendSheetRow(
  spreadsheetId: string,
  range: string,
  values: (string | number | null)[]
): Promise<void> {
  await sheetsWriteClient().spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });
}
