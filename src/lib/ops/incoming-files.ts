import type { IncomingPromo } from "./tasks";

export function cellHref(value: string | null | undefined): string | null {
  const raw = value?.trim() ?? "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return null;
}

export type IncomingFileKind = "script" | "vo" | "video" | "canvas" | "show" | "synopsis";

export type IncomingFile = {
  key: IncomingFileKind;
  label: string;
  value: string | null;
  href: string | null;
  added: boolean;
};

function pack(key: IncomingFileKind, label: string, value: string | null | undefined): IncomingFile {
  const trimmed = value?.trim() || null;
  return { key, label, value: trimmed, href: cellHref(trimmed), added: Boolean(trimmed) };
}

/** What PocketFM put on the Master Sheet for a newly assigned promo. */
export function incomingFiles(row: IncomingPromo): IncomingFile[] {
  return [
    pack("script", "Script", row.scriptLink),
    pack("vo", "VO samples", row.voSamples),
    pack("video", "Video samples", row.videoSamples),
    pack("canvas", "Canvas", row.canvasLink),
    pack("show", "Show link", row.showLink),
    pack("synopsis", "Synopsis", row.synopsisLink),
  ];
}

export function incomingFileSummary(row: IncomingPromo): string {
  const files = incomingFiles(row);
  const added = files.filter((file) => file.added).map((file) => file.label);
  const missing = files.filter((file) => !file.added).map((file) => file.label);
  const bits: string[] = [];
  if (files.some((file) => file.key === "script" && file.added)) {
    bits.push("Script is on the PocketFM sheet — make a Google copy for the agency.");
  } else {
    bits.push("No script on the PocketFM sheet yet.");
  }
  if (added.length) bits.push(`Added: ${added.join(", ")}.`);
  if (missing.length) bits.push(`Not added: ${missing.join(", ")}.`);
  return bits.join(" ");
}
