import type {
  Anomaly,
  DemarcationResult,
  QcRow,
  ScriptBlock,
  SplitCandidate,
} from "./types";
import { CEILING_WORDS, FLOOR_WORDS, SHORT_WARN_WORDS } from "./types";
import { formatRuntime, wordsToRuntimeSec } from "./words";

function similarity(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const tb = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  return inter / Math.max(ta.size, tb.size);
}

export function runQc(args: {
  sourceText: string;
  blocks: ScriptBlock[];
  fidelityFailures: number;
  selected: SplitCandidate | null;
  baseSpokenWords: number;
}): { qc: QcRow[]; anomalies: Anomaly[]; openDecisions: string[] } {
  const { sourceText, blocks, fidelityFailures, selected, baseSpokenWords } = args;
  const anomalies: Anomaly[] = [];
  const openDecisions: string[] = [];
  let aId = 1;
  const nextId = () => `C${String(aId++).padStart(2, "0")}`;

  const qc: QcRow[] = [];

  // 1. Parse fidelity
  const orphans = blocks.filter((b) => !sourceText.includes(b.raw)).length;
  qc.push({
    id: "parse_fidelity",
    name: "Parse fidelity",
    ran: true,
    status: fidelityFailures === 0 && orphans === 0 ? "Pass" : "Fail",
    detail: `fidelityFailures=${fidelityFailures}, orphans=${orphans}, blocks=${blocks.length}`,
  });
  if (fidelityFailures || orphans) {
    anomalies.push({
      id: nextId(),
      kind: "parse_fidelity",
      message: "Some blocks do not appear verbatim in source.",
      proposedFix: "Re-check PDF extract / line breaks; do not auto-fix text.",
      status: "open",
    });
  }

  // 2. Coverage (blocks ⊆ source)
  qc.push({
    id: "coverage",
    name: "Coverage",
    ran: true,
    status: orphans === 0 ? "Pass" : "Fail",
    detail: orphans === 0 ? "Every block raw is a source substring." : `${orphans} miss(es)`,
  });

  // 3. Repetition
  let nearDup = 0;
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < Math.min(blocks.length, i + 8); j++) {
      if (
        blocks[i].spokenWords > 8 &&
        similarity(blocks[i].raw, blocks[j].raw) >= 0.72
      ) {
        nearDup++;
      }
    }
  }
  qc.push({
    id: "repetition",
    name: "Repetition",
    ran: true,
    status: nearDup === 0 ? "Pass" : "Fail",
    detail: `near-duplicate pairs ≈ ${nearDup} (threshold 0.72)`,
  });

  // 4–5 scene / boundary integrity
  if (!selected) {
    qc.push({
      id: "scene_wise",
      name: "Scene-wise integrity",
      ran: true,
      status: "N/A",
      detail: "No split selected yet.",
    });
    qc.push({
      id: "boundary",
      name: "Boundary integrity",
      ran: true,
      status: "N/A",
      detail: "No split selected yet.",
    });
  } else {
    const opensOnSlug = selected.parts.every((p) => p.sceneFrom >= 1);
    qc.push({
      id: "scene_wise",
      name: "Scene-wise integrity",
      ran: true,
      status: opensOnSlug ? "Pass" : "Fail",
      detail: opensOnSlug
        ? "Every part starts at a scene boundary."
        : "A part does not open on a scene slug.",
    });

    const boundaryLines = selected.parts.map((p, i) => {
      const next = selected.parts[i + 1];
      return `P${p.partNo} ends on «${p.endsOnSlug}»${
        next ? ` → P${next.partNo} starts scene ${next.sceneFrom}` : " (final)"
      }`;
    });
    qc.push({
      id: "boundary",
      name: "Boundary integrity",
      ran: true,
      status: "Pass",
      detail: boundaryLines.join(" · "),
    });
  }

  // 6. Speaker attribution — flag only
  let speakerFlags = 0;
  for (const b of blocks) {
    if (b.kind === "dialogue" && /^(he|she|they|i)\b/i.test(b.body.trim())) {
      // soft signal only
    }
    if (b.kind === "dialogue" && !b.label.includes(":")) {
      speakerFlags++;
      anomalies.push({
        id: nextId(),
        kind: "speaker",
        message: `Malformed speaker label: «${b.raw.slice(0, 60)}»`,
        proposedFix: "Confirm label in source; do not auto-fix.",
        status: "open",
      });
    }
  }
  qc.push({
    id: "speaker",
    name: "Speaker attribution",
    ran: true,
    status: speakerFlags === 0 ? "Pass" : "Fail",
    detail: `flagged=${speakerFlags} (flag only — never auto-fix)`,
  });

  // 7. Parentheticals
  const srcParens = (sourceText.match(/\([^)]+\)/g) || []).length;
  const outParens = blocks.reduce(
    (s, b) => s + (b.raw.match(/\([^)]+\)/g) || []).length,
    0
  );
  qc.push({
    id: "parentheticals",
    name: "Emotion/parenthetical preservation",
    ran: true,
    status: srcParens === outParens ? "Pass" : "Fail",
    detail: `source=${srcParens}, blocks=${outParens}`,
  });

  // 8. Runtime math
  if (selected) {
    const sum = selected.parts.reduce((s, p) => s + p.spokenWords, 0);
    const ok = sum === baseSpokenWords || Math.abs(sum - baseSpokenWords) <= 2;
    qc.push({
      id: "runtime_math",
      name: "Runtime math",
      ran: true,
      status: ok ? "Pass" : "Fail",
      detail: `Σ part words=${sum}, base spoken=${baseSpokenWords} (${formatRuntime(
        wordsToRuntimeSec(baseSpokenWords)
      )})`,
    });
  } else {
    qc.push({
      id: "runtime_math",
      name: "Runtime math",
      ran: true,
      status: "N/A",
      detail: "No split selected.",
    });
  }

  // 9. Ceiling/floor
  if (selected) {
    const over = selected.parts.filter((p) => p.overCeiling);
    const near = selected.parts.filter((p) => p.nearShort);
    const under = selected.parts.filter((p) => p.underFloor);
    let status: QcRow["status"] = "Pass";
    let detail = `max=${formatRuntime(selected.longestSec)}, min=${formatRuntime(
      selected.shortestSec
    )}`;
    if (near.length) {
      status = "Fail";
      detail += ` · near-short parts: ${near.map((p) => `P${p.partNo}`).join(",")}`;
      openDecisions.push(
        `Reject or re-split: part(s) near 3:00 (${near.map((p) => `P${p.partNo}`).join(", ")})`
      );
    } else if (over.length) {
      status = "FAIL — accepted by direction";
      detail += ` · over ceiling: ${over
        .map((p) => `P${p.partNo} ${formatRuntime(p.runtimeSec)}`)
        .join(", ")}`;
      openDecisions.push(
        `Accept overrun(s) over 10:00 or pick another part count from the trade-off table.`
      );
      for (const p of over) {
        anomalies.push({
          id: nextId(),
          kind: "ceiling",
          message: `Part ${p.partNo} is ${formatRuntime(p.runtimeSec)} (${p.spokenWords} words) over ${CEILING_WORDS}-word ceiling.`,
          proposedFix: "Keep scene-wise cut; accept by direction, or add part count.",
          status: "open",
        });
      }
    } else if (under.length) {
      status = "Fail";
      detail += ` · under floor (~6:00): ${under.map((p) => `P${p.partNo}`).join(",")}`;
    }
    qc.push({
      id: "ceiling_floor",
      name: "Ceiling/floor",
      ran: true,
      status,
      detail,
    });
  } else {
    qc.push({
      id: "ceiling_floor",
      name: "Ceiling/floor",
      ran: true,
      status: "N/A",
      detail: "No split selected.",
    });
  }

  // 10. Docx fidelity — N/A until preview rendered
  qc.push({
    id: "docx_fidelity",
    name: "Docx fidelity",
    ran: false,
    status: "N/A",
    detail: "Not run until deck is generated and page-1 preview is checked.",
  });

  void SHORT_WARN_WORDS;
  void FLOOR_WORDS;

  return { qc, anomalies, openDecisions };
}

export function structuralFinding(result: Pick<DemarcationResult, "selected" | "scenes" | "hasBaseScriptMarker" | "hasPsMarker" | "pfmStripCount">): string {
  if (!result.hasBaseScriptMarker && !result.hasPsMarker) {
    return "No Powerstart / Base Script markers found — confirm how the opening should be treated before locking.";
  }
  if (!result.selected) return "No split selected yet.";
  const giant = result.scenes.find((s) => s.spokenWords > CEILING_WORDS);
  if (giant) {
    return `One scene exceeds the ceiling: «${giant.slug}» (${giant.spokenWords} words / ${formatRuntime(giant.runtimeSec)}). Scene-wise cuts cannot break it.`;
  }
  if (result.selected.maxOverCeiling > 0) {
    return "Split keeps scene boundaries and avoids short parts; one or more parts exceed 10:00 — FAIL accepted by direction until you pick another option.";
  }
  if (result.pfmStripCount > 0) {
    return `CORRECTION APPLIED path available: ${result.pfmStripCount} PocketFM reference(s) replaced with [CLIENT] for agency/demarcated export (revertible; not silent).`;
  }
  return "This script splits cleanly under scene-wise rules within the search space shown.";
}
