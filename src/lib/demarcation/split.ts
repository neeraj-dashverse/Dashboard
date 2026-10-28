import type { PartPlan, SceneRow, SplitCandidate } from "./types";
import {
  CEILING_WORDS,
  FLOOR_WORDS,
  SHORT_WARN_WORDS,
} from "./types";
import { wordsToRuntimeSec } from "./words";

/** Combinations of k indices from 0..n-1 */
function combinations(n: number, k: number): number[][] {
  const out: number[][] = [];
  if (k <= 0 || k > n) return out;
  const idx = Array.from({ length: k }, (_, i) => i);
  const push = () => out.push(idx.slice());
  push();
  while (true) {
    let i = k - 1;
    while (i >= 0 && idx[i] === i + n - k) i--;
    if (i < 0) break;
    idx[i]++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
    push();
  }
  return out;
}

function partsFromCuts(scenes: SceneRow[], cutAfter: number[]): PartPlan[] {
  // cutAfter = scene indices where part ends (inclusive), last always last scene
  const ends = [...cutAfter, scenes.length - 1];
  const parts: PartPlan[] = [];
  let start = 0;
  for (let p = 0; p < ends.length; p++) {
    const end = ends[p];
    let words = 0;
    for (let s = start; s <= end; s++) words += scenes[s].spokenWords;
    const runtimeSec = wordsToRuntimeSec(words);
    parts.push({
      partNo: p + 1,
      sceneFrom: start + 1,
      sceneTo: end + 1,
      spokenWords: words,
      runtimeSec,
      overCeiling: words > CEILING_WORDS,
      underFloor: words < FLOOR_WORDS,
      nearShort: words <= SHORT_WARN_WORDS,
      endsOnSlug: scenes[end].slug,
      title: `Scenes ${start + 1}–${end + 1}`,
    });
    start = end + 1;
  }
  return parts;
}

function scoreParts(parts: PartPlan[]): number {
  let score = 0;
  for (const p of parts) {
    if (p.nearShort) score += 10_000;
    if (p.underFloor) score += 500;
    if (p.overCeiling) score += 50 + (p.spokenWords - CEILING_WORDS);
    // prefer balanced
    score += Math.abs(p.spokenWords - CEILING_WORDS * 0.75) * 0.01;
  }
  return score;
}

/**
 * Exhaustive search over scene-boundary splits for each candidate part count.
 * Never claims impossible without running the full search.
 */
export function exhaustiveSplitSearch(scenes: SceneRow[]): {
  tradeoffs: SplitCandidate[];
  searchedPartCounts: number[];
} {
  const n = scenes.length;
  const tradeoffs: SplitCandidate[] = [];
  const searchedPartCounts: number[] = [];

  if (n === 0) return { tradeoffs, searchedPartCounts };

  const maxParts = Math.min(n, 12);
  for (let partCount = 1; partCount <= maxParts; partCount++) {
    searchedPartCounts.push(partCount);
    if (partCount === 1) {
      const parts = partsFromCuts(scenes, []);
      const runtimes = parts.map((p) => p.runtimeSec);
      tradeoffs.push({
        partCount: 1,
        cuts: [],
        parts,
        shortestSec: Math.min(...runtimes),
        longestSec: Math.max(...runtimes),
        maxOverCeiling: parts.filter((p) => p.overCeiling).length,
        anyNearShort: parts.some((p) => p.nearShort),
        anyUnderFloor: parts.some((p) => p.underFloor),
        score: scoreParts(parts),
      });
      continue;
    }

    // Choose partCount-1 cut points among the n-1 internal boundaries
    // Internal boundaries are after scene 0 .. n-2
    const boundaryCount = n - 1;
    const need = partCount - 1;
    if (need > boundaryCount) continue;

    const combos = combinations(boundaryCount, need);
    let best: SplitCandidate | null = null;

    for (const combo of combos) {
      // combo is indices into boundaries 0..n-2 meaning "cut after scene combo[i]"
      const cutAfter = combo.slice().sort((a, b) => a - b);
      const parts = partsFromCuts(scenes, cutAfter);
      if (parts.some((p) => p.nearShort)) {
        // still record but heavily scored — default rule rejects near-short
      }
      const runtimes = parts.map((p) => p.runtimeSec);
      const cand: SplitCandidate = {
        partCount,
        cuts: cutAfter,
        parts,
        shortestSec: Math.min(...runtimes),
        longestSec: Math.max(...runtimes),
        maxOverCeiling: parts.filter((p) => p.overCeiling).length,
        anyNearShort: parts.some((p) => p.nearShort),
        anyUnderFloor: parts.some((p) => p.underFloor),
        score: scoreParts(parts),
      };
      if (!best || cand.score < best.score) best = cand;
    }

    if (best) tradeoffs.push(best);
  }

  tradeoffs.sort((a, b) => a.score - b.score);
  return { tradeoffs, searchedPartCounts };
}

/** Prefer: no near-short, then fewest overruns, then best score. */
export function pickDefaultSplit(tradeoffs: SplitCandidate[]): SplitCandidate | null {
  const viable = tradeoffs.filter((t) => !t.anyNearShort);
  const pool = viable.length ? viable : tradeoffs;
  if (!pool.length) return null;
  return [...pool].sort(
    (a, b) =>
      a.maxOverCeiling - b.maxOverCeiling ||
      a.score - b.score ||
      a.partCount - b.partCount
  )[0];
}
