/** Google Doc / Sheet / Drive file id from a URL or raw id. */
export function googleFileId(value: string | null | undefined): string | null {
  const raw = value?.trim() ?? "";
  if (!raw) return null;
  const nested = raw.match(/\/(?:document|spreadsheets|presentation|file)\/d\/([a-zA-Z0-9_-]+)/);
  if (nested?.[1]) return nested[1];
  const open = raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (open?.[1]) return open[1];
  if (/^[a-zA-Z0-9_-]{25,}$/.test(raw)) return raw;
  return null;
}

export function googleCopyUrl(value: string | null | undefined): string | null {
  const id = googleFileId(value);
  if (!id) return null;
  if (/\/spreadsheets\//i.test(value ?? "")) return `https://docs.google.com/spreadsheets/d/${id}/copy`;
  if (/\/presentation\//i.test(value ?? "")) return `https://docs.google.com/presentation/d/${id}/copy`;
  return `https://docs.google.com/document/d/${id}/copy`;
}

function normText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * same — tracker already has this PocketFM script
 * paste — PocketFM has a script (often a real Doc URL) that is not on Master Tracker yet
 * updated — tracker already has a script, and PocketFM now points at a different file
 */
export function scriptState(
  pfm: string | null | undefined,
  tracker: string | null | undefined
): "same" | "paste" | "updated" {
  const source = pfm?.trim() ?? "";
  const dest = tracker?.trim() ?? "";
  if (!source) return "same";
  if (!dest) return "paste";
  const sourceId = googleFileId(source);
  const destId = googleFileId(dest);
  if (sourceId && destId) return sourceId === destId ? "same" : "updated";
  // Tracker already has a filename/title — not a fresh assignment. Updates need a file id on both sides.
  if (sourceId && !destId) return "same";
  if (!sourceId && destId) return "updated";
  return normText(source) === normText(dest) ? "same" : "updated";
}
