import { parseScript } from "./parse";
import { buildSceneMap } from "./scenes";
import { exhaustiveSplitSearch, pickDefaultSplit } from "./split";
import { runQc, structuralFinding } from "./qc";
import { stripPocketFm } from "./strip";
import type { DemarcationResult, SplitCandidate } from "./types";
import { wordsToRuntimeSec } from "./words";

export function runDemarcation(args: {
  sourceText: string;
  scriptName?: string;
  epLabel?: string;
  selectedPartCount?: number | null;
}): DemarcationResult {
  const scriptName = args.scriptName?.trim() || "UNTITLED SCRIPT";
  const epLabel = args.epLabel?.trim() || "EP 01";

  const { text: strippedText, count: pfmStripCount } = stripPocketFm(args.sourceText);
  // Parse the ORIGINAL for fidelity; use stripped only for export copy
  const parsed = parseScript(args.sourceText);
  const scenes = buildSceneMap(parsed.blocks);

  let psSpokenWords = 0;
  let baseSpokenWords = 0;
  let seenBase = false;
  for (const b of parsed.blocks) {
    if (b.kind === "marker" && /Base Script/i.test(b.label + b.body)) seenBase = true;
    if (b.kind === "ps_hook") psSpokenWords += b.spokenWords;
    else if (seenBase || !parsed.hasBaseScriptMarker) baseSpokenWords += b.spokenWords;
  }
  // If no base marker: all non-PS spoken counts as base, PS separate when detected
  if (!parsed.hasBaseScriptMarker) {
    baseSpokenWords = parsed.blocks
      .filter((b) => b.kind !== "ps_hook")
      .reduce((s, b) => s + b.spokenWords, 0);
    psSpokenWords = parsed.blocks
      .filter((b) => b.kind === "ps_hook")
      .reduce((s, b) => s + b.spokenWords, 0);
  }

  const { tradeoffs, searchedPartCounts } = exhaustiveSplitSearch(scenes);
  void searchedPartCounts;

  let selected: SplitCandidate | null = pickDefaultSplit(tradeoffs);
  if (args.selectedPartCount != null) {
    const match = tradeoffs.find((t) => t.partCount === args.selectedPartCount && !t.anyNearShort)
      ?? tradeoffs.find((t) => t.partCount === args.selectedPartCount)
      ?? null;
    if (match) selected = match;
  }

  const { qc, anomalies, openDecisions } = runQc({
    sourceText: args.sourceText,
    blocks: parsed.blocks,
    fidelityFailures: parsed.fidelityFailures,
    selected,
    baseSpokenWords,
  });

  if (!parsed.hasBaseScriptMarker && !parsed.hasPsMarker) {
    openDecisions.unshift(
      "Script has no PS marker and no Base Script marker — decide how the opening is treated (do not assume)."
    );
  }
  if (pfmStripCount > 0) {
    openDecisions.push(
      `${pfmStripCount} PocketFM mention(s) proposed as [CLIENT] on agency/demarcated export — confirm APPLIED or reject.`
    );
  }

  const result: DemarcationResult = {
    scriptName,
    epLabel,
    sourceText: args.sourceText,
    strippedText,
    pfmStripCount,
    hasPsMarker: parsed.hasPsMarker,
    hasBaseScriptMarker: parsed.hasBaseScriptMarker,
    psSpokenWords,
    baseSpokenWords,
    totalIfPsIncluded: baseSpokenWords + psSpokenWords,
    blocks: parsed.blocks,
    scenes,
    fidelityFailures: parsed.fidelityFailures,
    tradeoffs,
    selected,
    anomalies,
    qc,
    structuralFinding: "",
    openDecisions,
  };
  result.structuralFinding = structuralFinding(result);

  void wordsToRuntimeSec;
  return result;
}
