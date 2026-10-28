/** Script demarcation domain — base script is the only source of truth. */

export const PACE_WPM = 138;
export const CEILING_WORDS = 1380; // 10:00
export const FLOOR_WORDS = 828; // ~6:00
export const SHORT_WARN_WORDS = 414; // ~3:00 — never allow near this

export type BlockKind =
  | "slug"
  | "narration"
  | "dialogue"
  | "cue"
  | "parenthetical"
  | "marker"
  | "ps_hook"
  | "other";

export type ScriptBlock = {
  id: string;
  kind: BlockKind;
  /** Label prefix taken verbatim from source (may be empty). */
  label: string;
  /** Body after label — verbatim. */
  body: string;
  /** Full line/block as in source: label + body must appear in source. */
  raw: string;
  startOffset: number;
  endOffset: number;
  spokenWords: number;
  sceneIndex: number | null;
};

export type SceneRow = {
  index: number;
  slug: string;
  startBlock: number;
  endBlock: number;
  spokenWords: number;
  runtimeSec: number;
  cumulativeWords: number;
};

export type PartPlan = {
  partNo: number;
  sceneFrom: number;
  sceneTo: number;
  spokenWords: number;
  runtimeSec: number;
  overCeiling: boolean;
  underFloor: boolean;
  nearShort: boolean;
  endsOnSlug: string;
  title: string;
};

export type SplitCandidate = {
  partCount: number;
  cuts: number[]; // scene indices AFTER which a cut falls (0-based scene end indices)
  parts: PartPlan[];
  shortestSec: number;
  longestSec: number;
  maxOverCeiling: number;
  anyNearShort: boolean;
  anyUnderFloor: boolean;
  score: number; // lower better
};

export type Anomaly = {
  id: string;
  kind: string;
  message: string;
  proposedFix: string | null;
  status: "open" | "applied" | "rejected";
  appliedText?: string;
};

export type QcStatus = "Pass" | "Fail" | "N/A" | "FAIL — accepted by direction";

export type QcRow = {
  id: string;
  name: string;
  status: QcStatus;
  detail: string;
  ran: boolean;
};

export type DemarcationResult = {
  scriptName: string;
  epLabel: string;
  sourceText: string;
  strippedText: string;
  pfmStripCount: number;
  hasPsMarker: boolean;
  hasBaseScriptMarker: boolean;
  psSpokenWords: number;
  baseSpokenWords: number;
  totalIfPsIncluded: number;
  blocks: ScriptBlock[];
  scenes: SceneRow[];
  fidelityFailures: number;
  tradeoffs: SplitCandidate[];
  selected: SplitCandidate | null;
  anomalies: Anomaly[];
  qc: QcRow[];
  structuralFinding: string;
  openDecisions: string[];
};
