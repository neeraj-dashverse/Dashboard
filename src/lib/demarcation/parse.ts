import type { BlockKind, ScriptBlock } from "./types";
import { spokenWordsForBlock } from "./words";

const SLUG_RE =
  /^(INT\.|EXT\.|I\/E\.|EST\.|SCENE\s+\d+)/i;
const CUE_RE =
  /^(Visual Cue|Audio Cue|SFX|On[- ]screen text)\s*:/i;
const MARKER_RE =
  /^(Base Script\s*:|Powerstart|Document Header|Production)/i;
const PS_RE = /^PS\s*\d+/i;
const SPEAKER_RE =
  /^([A-Z][A-Z0-9 .'-]{0,40}|Narrator|NARRATOR)\s*(?:\([^)]*\))?\s*:\s*(.*)$/;

function classifyLine(line: string): { kind: BlockKind; label: string; body: string } {
  const trimmed = line; // keep exact — we use character index from original
  const t = trimmed.trimEnd();
  if (!t.trim()) return { kind: "other", label: "", body: trimmed };

  if (PS_RE.test(t.trim()) && !/Base Script/i.test(t)) {
    return { kind: "ps_hook", label: t.trim().slice(0, 12), body: t };
  }
  if (MARKER_RE.test(t.trim())) {
    const idx = t.indexOf(":");
    if (idx >= 0) {
      return { kind: "marker", label: t.slice(0, idx + 1), body: t.slice(idx + 1) };
    }
    return { kind: "marker", label: t, body: "" };
  }
  if (CUE_RE.test(t.trim())) {
    const idx = t.indexOf(":");
    return {
      kind: "cue",
      label: idx >= 0 ? t.slice(0, idx + 1) : t,
      body: idx >= 0 ? t.slice(idx + 1) : "",
    };
  }
  if (SLUG_RE.test(t.trim())) {
    return { kind: "slug", label: t.trim(), body: "" };
  }
  const sp = t.match(SPEAKER_RE);
  if (sp) {
    // Verbatim label from character index on the line
    const colon = t.indexOf(":");
    return {
      kind: "dialogue",
      label: t.slice(0, colon + 1),
      body: t.slice(colon + 1),
    };
  }
  // Narration / action-ish: if looks like action (starts with verb or ALL CAPS short) treat as cue/other
  if (/^\(.*\)$/.test(t.trim())) {
    return { kind: "parenthetical", label: "", body: t };
  }
  return { kind: "narration", label: "", body: t };
}

/**
 * Parse script text into blocks. Labels taken by character index from source lines.
 * Does not auto-correct spelling/grammar.
 */
export function parseScript(sourceText: string): {
  blocks: ScriptBlock[];
  fidelityFailures: number;
  hasPsMarker: boolean;
  hasBaseScriptMarker: boolean;
} {
  const lines = sourceText.split(/\r?\n/);
  const blocks: ScriptBlock[] = [];
  let offset = 0;
  let sceneIndex: number | null = null;
  let sceneCount = -1;
  let inBase = false;
  let hasPsMarker = false;
  let hasBaseScriptMarker = false;
  let fidelityFailures = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineStart = offset;
    const lineEnd = offset + line.length;
    offset = lineEnd + 1; // + newline

    if (!line.trim()) continue;

    if (/Base Script\s*:/i.test(line)) {
      hasBaseScriptMarker = true;
      inBase = true;
    }
    if (/^PS\s*\d+/i.test(line.trim())) hasPsMarker = true;

    const { kind, label, body } = classifyLine(line);

    // PS hooks above Base Script stay ps_hook; after Base Script treat as content
    let finalKind = kind;
    if (kind === "ps_hook" && inBase) finalKind = "narration";
    if (!inBase && hasBaseScriptMarker === false && kind === "ps_hook") {
      finalKind = "ps_hook";
    }

    if (finalKind === "slug") {
      sceneCount += 1;
      sceneIndex = sceneCount;
    }

    const raw = line;
    const id = `b${blocks.length}`;
    const block: ScriptBlock = {
      id,
      kind: finalKind,
      label,
      body,
      raw,
      startOffset: lineStart,
      endOffset: lineEnd,
      spokenWords: spokenWordsForBlock(finalKind, body, label),
      sceneIndex: sceneIndex,
    };

    // Fidelity: label+body must appear in source (for dialogue/cues with split)
    const reassembled = label + body;
    if (reassembled && !sourceText.includes(reassembled) && reassembled !== raw) {
      // Prefer raw line presence
      if (!sourceText.includes(raw)) fidelityFailures += 1;
    } else if (!sourceText.includes(raw)) {
      fidelityFailures += 1;
    }

    blocks.push(block);
  }

  // If never saw Base Script marker, still parse — flag later
  return { blocks, fidelityFailures, hasPsMarker, hasBaseScriptMarker };
}
