/**
 * Credit Consumption Analysis · PFM tab.
 * Parsed and joined in the dashboard only — never written to Timeline / Master Tracker.
 */
import { findDuration } from "./selectors";
import type { CreditUsage, OpsSnapshot, Promo } from "./types";

/**
 * Promo credit rows only: "PFM - Wedding Day Disaster-Promo"
 * or the reverse wrap "Hired love-Promo-PFM". In-app / bulk / R&D stay out.
 */
export function isPromoCreditLabel(label: string): boolean {
  const value = label.trim();
  if (!value) return false;
  if (/\b(in-?app|bulk|training|testing|samples?|stills?)\b/i.test(value)) return false;
  if (/r\s*&\s*d/i.test(value)) return false;
  const trimmed = value.replace(/[-–—\s]+$/g, "");
  if (/^pfm\b/i.test(trimmed) && /promo$/i.test(trimmed)) return true;
  if (/promo[\s\-]*pfm$/i.test(trimmed)) return true;
  return false;
}

const NOISE = new Set([
  "pfm",
  "promo",
  "inapp",
  "animation",
  "aniamtion",
  "genai",
  "bulk",
  "romantasy",
  "diverse",
  "training",
  "testing",
  "correction",
  "corrections",
  "still",
  "stills",
  "sample",
  "samples",
  "open",
  "opens",
  "dc",
  "dr",
  "fantasy",
  "motion",
  "lq",
  "and",
  "the",
  "of",
  "in",
  "to",
  "a",
  "on",
  "my",
]);

function compact(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/(\d)\.o\b/g, "$10")
    .replace(/[^a-z0-9]+/g, "")
    .replace(/(\d)o/g, "$10")
    .replace(/o(\d)/g, "0$1");
}

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/(\d)\.o\b/g, "$1 0")
    .split(/[^a-z0-9]+/)
    .map((token) => token.replace(/^0+(\d)/, "$1"))
    .filter((token) => token.length >= 2 && !NOISE.has(token));
}

function stripCreditLabel(name: string): string {
  return name
    .replace(/^pfm[\s<>\-–—]*/i, "")
    .replace(/[\s\-]*pfm$/i, "")
    .replace(/\b(in-?app|animation|aniamtion|gen-?ai|promo|romantasy|fantasy|bulk)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, row[j], row[j - 1]);
      prev = cur;
    }
  }
  return row[b.length];
}

function fuzzyEq(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const ac = compact(a);
  const bc = compact(b);
  if (ac === bc) return true;
  if (ac.length >= 5 && bc.length >= 5 && (ac.includes(bc) || bc.includes(ac))) return true;
  const max = Math.max(ac.length, bc.length);
  if (max < 6) return false;
  return levenshtein(ac, bc) <= (max >= 10 ? 2 : 1);
}

function versionLike(promoName: string): boolean {
  const words = tokens(promoName);
  if (words.length === 0) return true;
  return words.every((word) => /^\d+$/.test(word) || compact(word).length <= 5);
}

function tokenHits(needles: string[], haystack: string[]): number {
  return needles.filter((needle) =>
    haystack.some((item) => {
      if (fuzzyEq(needle, item)) return true;
      const a = compact(needle);
      const b = compact(item);
      if (Math.min(a.length, b.length) < 4) return a === b;
      return a.includes(b) || b.includes(a);
    })
  ).length;
}

function creditPriority(label: string): number {
  const lower = label.toLowerCase();
  if (/\bbulk\b|in-?app/.test(lower)) return 0;
  if (/\bpromo\b/.test(lower)) return 2;
  return 1;
}

export function scoreCreditToPromo(label: string, showName: string, promoName: string): number {
  const stripped = stripCreditLabel(label);
  const needle = compact(stripped);
  const showC = compact(showName);
  const promoC = compact(promoName);
  if (!needle || needle.length < 3) return 0;
  if (needle === showC + promoC) return 100;
  if (promoC.length >= 5 && (needle === promoC || promoC.includes(needle) || needle.includes(promoC))) return 94;
  const acronym = label.match(/\(([A-Za-z]{2,8})\)/)?.[1];
  if (acronym && compact(acronym) === showC) return versionLike(promoName) ? 88 : 74;
  if (needle === showC) return versionLike(promoName) ? 88 : 72;

  let score = 0;
  if (showC.length >= 3 && (needle.startsWith(showC) || needle.includes(showC))) {
    score += 42;
    const rest = needle.replace(showC, "");
    if (!rest) score += versionLike(promoName) ? 40 : 12;
    else if (promoC && (fuzzyEq(rest, promoC) || promoC.includes(rest) || rest.includes(promoC))) score += 50;
    else {
      const creditRest = tokens(stripped).filter((token) => compact(token) !== showC && !showC.includes(compact(token)));
      const promoTokens = tokens(promoName);
      const hits = tokenHits(creditRest, promoTokens);
      if (hits) score += Math.min(50, 18 * hits);
    }
  } else {
    const showTokens = tokens(showName);
    const creditTokens = tokens(stripped);
    const showHits = tokenHits(showTokens, creditTokens);
    if (showTokens.length && showHits === showTokens.length) {
      score += 52;
      const promoTokens = tokens(promoName).filter((token) => compact(token).length >= 3);
      if (!promoTokens.length || versionLike(promoName)) score += 36;
      else {
        const hits = tokenHits(promoTokens, creditTokens);
        if (hits) score += Math.min(45, 16 * hits);
      }
    } else if (showC.length >= 6 && (needle.includes(showC) || showC.includes(needle))) {
      score += 48;
    }
  }

  const combo = showC + promoC;
  if (combo.length >= 8 && (needle.includes(combo) || combo.includes(needle))) score = Math.max(score, 90);
  return Math.min(100, score);
}

const MATCH_FLOOR = 70;

function isClosed(status: string | null | undefined): boolean {
  return Boolean(status && /closed/i.test(status));
}

export function attachCreditsToPromos(promos: Promo[], usages: CreditUsage[]): void {
  for (const usage of usages) {
    usage.matchedPromoId = null;
    usage.matchScore = 0;
  }
  for (const promo of promos) promo.creditUsage = null;

  const pairs: { usage: CreditUsage; promo: Promo; score: number }[] = [];
  for (const usage of usages) {
    if (!isPromoCreditLabel(usage.label)) continue;
    for (const promo of promos) {
      const score = scoreCreditToPromo(usage.label, promo.showName, promo.promoName);
      if (score < MATCH_FLOOR) continue;
      pairs.push({ usage, promo, score });
    }
  }

  pairs.sort(
    (a, b) =>
      b.score - a.score ||
      creditPriority(b.usage.label) - creditPriority(a.usage.label) ||
      Number(isClosed(a.promo.trackerStatus)) - Number(isClosed(b.promo.trackerStatus)) ||
      (b.promo.sheetIndex ?? -1) - (a.promo.sheetIndex ?? -1)
  );

  const usedCredits = new Set<string>();
  const usedPromos = new Set<string>();
  for (const pair of pairs) {
    if (usedCredits.has(pair.usage.id) || usedPromos.has(pair.promo.id)) continue;
    usedCredits.add(pair.usage.id);
    usedPromos.add(pair.promo.id);
    pair.usage.matchedPromoId = pair.promo.id;
    pair.usage.matchScore = pair.score;
    pair.promo.creditUsage = pair.usage;
  }
}

export function findCreditForNames(
  usages: CreditUsage[],
  showName: string,
  promoName = ""
): CreditUsage | null {
  let best: CreditUsage | null = null;
  let bestScore = 0;
  for (const usage of usages) {
    if (!isPromoCreditLabel(usage.label)) continue;
    const score = scoreCreditToPromo(usage.label, showName, promoName);
    if (score < MATCH_FLOOR || score <= bestScore) continue;
    best = usage;
    bestScore = score;
  }
  return best;
}

export function perMinCredits(total: number | null | undefined, minutes: number | null | undefined): number | null {
  if (total == null || minutes == null || !Number.isFinite(total) || !Number.isFinite(minutes) || minutes <= 0) {
    return null;
  }
  return total / minutes;
}

/** Duration tab first, then tracker initial duration, then production part lengths. */
export function workedDurationMin(snap: OpsSnapshot, promoId: string | null | undefined): number | null {
  if (!promoId) return null;
  const row = findDuration(snap, promoId);
  if (row?.totalSec && row.totalSec > 0) return row.totalSec / 60;
  if (row?.workedWithCtaSec && row.workedWithCtaSec > 0) return row.workedWithCtaSec / 60;
  const promo = snap.promos.find((item) => item.id === promoId || item.id.split("#")[0] === promoId.split("#")[0]);
  if (promo?.durationMin && promo.durationMin > 0) return promo.durationMin;
  if (promo?.initialDurationSec && promo.initialDurationSec > 0) return promo.initialDurationSec / 60;
  const base = promoId.split("#")[0];
  const sec = snap.parts
    .filter((part) => part.promoId === promoId || part.promoId.split("#")[0] === base)
    .reduce((sum, part) => sum + (part.durationSec || 0), 0);
  return sec > 0 ? sec / 60 : null;
}

function parseNum(value: unknown): number | null {
  const raw = String(value ?? "").replace(/[,$%\s]/g, "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseText(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return s ? s : null;
}

export function parseCreditUsages(rows: string[][]): CreditUsage[] {
  const out: CreditUsage[] = [];
  rows.forEach((row, index) => {
    const label = parseText(row[2]);
    if (!label) return;
    if (/^show name$/i.test(label)) return;
    if (!isPromoCreditLabel(label)) return;
    const showId1 = parseText(row[0]);
    out.push({
      id: showId1 || `credit-${index}-${compact(label) || index}`,
      showId1,
      showId2: parseText(row[1]),
      label,
      conceptType: parseText(row[3]),
      videos: parseNum(row[4]),
      llm: parseNum(row[5]),
      images: parseNum(row[6]),
      audio: parseNum(row[7]),
      lipSync: parseNum(row[8]),
      totalCredits: parseNum(row[9]),
      costUsd: parseNum(row[10]),
      videoSavedCount: parseNum(row[11]),
      durationMin: parseNum(row[12]),
      productionCostPerMin: parseNum(row[13]),
      partsCompleted: parseNum(row[14]),
      partsInProduction: parseNum(row[15]),
      status: parseText(row[16]),
      runtime: parseNum(row[17]),
      runtimeCostPerMin: parseNum(row[18]),
      yieldPct: parseNum(row[19]),
      matchedPromoId: null,
      matchScore: 0,
    });
  });
  return out;
}

export function formatCredits(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return Math.round(value).toLocaleString("en-IN");
}

export function formatUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function formatMin(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Number(value.toFixed(value >= 10 ? 0 : 1))} min`;
}

export function formatPerMin(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${formatCredits(value)} / min`;
}

export function creditStatusTone(status: string | null | undefined): string {
  const s = (status ?? "").toLowerCase();
  if (s.includes("production") || s.includes("agency")) return "text-amber-200";
  if (s.includes("complete")) return "text-emerald-300";
  return "text-slate-300";
}

export function isCreditInFlight(status: string | null | undefined): boolean {
  const s = (status ?? "").toLowerCase();
  return s.includes("production") || s.includes("agency") || s.includes("wip");
}
