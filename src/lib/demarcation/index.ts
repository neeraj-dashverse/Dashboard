export { runDemarcation } from "./run";
export { buildDemarcationDocx } from "./docx";
export { buildAnomalyMarkdown } from "./report";
export { formatRuntime, wordsToRuntimeSec } from "./words";
export { PACE_WPM, CEILING_WORDS, FLOOR_WORDS } from "./types";
export type {
  DemarcationResult,
  SplitCandidate,
  SceneRow,
  Anomaly,
  QcRow,
} from "./types";
