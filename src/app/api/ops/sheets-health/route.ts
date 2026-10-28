import { NextResponse } from "next/server";
import { googlePrivateKey, hasSheetCredentials } from "@/lib/ops/sheets-client";
import { PFM_TIMELINE_SHEET } from "@/lib/ops/sheet-registry";

export const dynamic = "force-dynamic";

/** Diagnose Google Sheets credentials without exposing secrets. */
export async function GET() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || null;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY || "";
  const key = googlePrivateKey();
  const hasCreds = hasSheetCredentials();

  if (!hasCreds) {
    return NextResponse.json(
      {
        ok: false,
        hasCreds: false,
        emailPresent: Boolean(email),
        keyPresent: Boolean(rawKey),
        keyLooksQuoted: rawKey.trim().startsWith('"') || rawKey.trim().startsWith("'"),
        keyStartsWithBegin: key.includes("BEGIN PRIVATE KEY"),
        detail: "Google env vars missing or empty after cleanup",
      },
      { status: 503 }
    );
  }

  try {
    const { batchGet } = await import("@/lib/ops/sheets-client");
    const range = `'${PFM_TIMELINE_SHEET.tabs.masterTracker.name}'!A1:A2`;
    await batchGet(PFM_TIMELINE_SHEET.spreadsheetId, [range]);
    return NextResponse.json({
      ok: true,
      hasCreds: true,
      email,
      spreadsheet: PFM_TIMELINE_SHEET.spreadsheetName,
      detail: "Sheets read succeeded",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        ok: false,
        hasCreds: true,
        email,
        keyLooksQuoted: rawKey.trim().startsWith('"') || rawKey.trim().startsWith("'"),
        keyStartsWithBegin: key.includes("BEGIN PRIVATE KEY"),
        detail: message,
        hint:
          "Share PFM_dashboard_Timeline with the service account as Editor, and confirm GOOGLE_PRIVATE_KEY is the full key (quotes are OK — they are stripped).",
      },
      { status: 503 }
    );
  }
}
