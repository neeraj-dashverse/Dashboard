import type { DemarcationResult } from "./types";
import { formatRuntime, wordsToRuntimeSec } from "./words";
import { PACE_WPM, CEILING_WORDS } from "./types";

export function buildAnomalyMarkdown(result: DemarcationResult): string {
  const lines: string[] = [];
  lines.push(`# Demarcation anomaly log — ${result.scriptName} · ${result.epLabel}`);
  lines.push("");
  lines.push(`- Pace: ${PACE_WPM} wpm · Ceiling: ${CEILING_WORDS} words (10:00)`);
  lines.push(
    `- Base spoken words: ${result.baseSpokenWords} (${formatRuntime(
      wordsToRuntimeSec(result.baseSpokenWords)
    )})`
  );
  lines.push(`- PS spoken words (separate): ${result.psSpokenWords}`);
  lines.push(`- Total if PS included: ${result.totalIfPsIncluded}`);
  lines.push(`- PFM strip count (proposed/applied on export): ${result.pfmStripCount}`);
  lines.push("");
  lines.push("## Structural finding");
  lines.push(result.structuralFinding);
  lines.push("");
  lines.push("## Part table");
  if (result.selected) {
    lines.push("| Part | Scenes | Run | Words | Ends on | Flags |");
    lines.push("|------|--------|-----|-------|---------|-------|");
    for (const p of result.selected.parts) {
      const flags = [
        p.overCeiling ? "OVER" : "",
        p.nearShort ? "NEAR-SHORT" : "",
        p.underFloor ? "UNDER-FLOOR" : "",
      ]
        .filter(Boolean)
        .join(",");
      lines.push(
        `| ${p.partNo} | ${p.sceneFrom}–${p.sceneTo} | ${formatRuntime(p.runtimeSec)} | ${p.spokenWords} | ${p.endsOnSlug.replace(/\|/g, "/")} | ${flags || "—"} |`
      );
    }
  } else {
    lines.push("_No split selected._");
  }
  lines.push("");
  lines.push("## Trade-off table (exhaustive best per part count)");
  lines.push("| Parts | Shortest | Longest | Over ceiling | Near short | Score |");
  lines.push("|-------|----------|---------|--------------|------------|-------|");
  for (const t of result.tradeoffs) {
    lines.push(
      `| ${t.partCount} | ${formatRuntime(t.shortestSec)} | ${formatRuntime(t.longestSec)} | ${t.maxOverCeiling} | ${t.anyNearShort ? "yes" : "no"} | ${t.score.toFixed(1)} |`
    );
  }
  lines.push("");
  lines.push("## Anomalies");
  if (!result.anomalies.length) lines.push("_None open._");
  for (const a of result.anomalies) {
    lines.push(`### ${a.id} — ${a.kind} (${a.status})`);
    lines.push(a.message);
    if (a.proposedFix) lines.push(`Proposed fix: ${a.proposedFix}`);
    lines.push("");
  }
  lines.push("## QC");
  lines.push("| Check | Status | Ran | Detail |");
  lines.push("|-------|--------|-----|--------|");
  for (const q of result.qc) {
    lines.push(
      `| ${q.name} | ${q.status} | ${q.ran ? "yes" : "no"} | ${q.detail.replace(/\|/g, "/")} |`
    );
  }
  lines.push("");
  lines.push("## Open decisions");
  result.openDecisions.forEach((d, i) => lines.push(`${i + 1}. ${d}`));
  return lines.join("\n");
}
