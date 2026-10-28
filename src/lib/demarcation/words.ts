import type { BlockKind } from "./types";
import { PACE_WPM } from "./types";

const NON_SPOKEN: BlockKind[] = [
  "slug",
  "cue",
  "marker",
  "ps_hook",
  "parenthetical",
  "other",
];

/** Strip emotion/delivery parentheticals from a line before counting spoken words. */
export function stripParentheticals(s: string): string {
  return s
    .replace(/\([^)]*(?:Emotion|V\.?O\.?|thought|O\.?S\.?|CONT'D)[^)]*\)/gi, " ")
    .replace(/\[[^\]]*Character Asset[^\]]*\]/gi, " ");
}

export function countWords(s: string): number {
  const cleaned = stripParentheticals(s)
    .replace(/[^\w\s'-]/g, " ")
    .trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(Boolean).length;
}

export function isSpokenKind(kind: BlockKind): boolean {
  return kind === "narration" || kind === "dialogue";
}

export function spokenWordsForBlock(kind: BlockKind, body: string, label: string): number {
  if (NON_SPOKEN.includes(kind) || kind === "ps_hook") return 0;
  if (kind === "dialogue") {
    // speaker label is not spoken; body is
    return countWords(body);
  }
  if (kind === "narration") return countWords(body || label);
  return 0;
}

export function wordsToRuntimeSec(words: number): number {
  return Math.round((words / PACE_WPM) * 60);
}

export function formatRuntime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
