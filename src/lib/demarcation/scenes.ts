import type { SceneRow, ScriptBlock } from "./types";
import { wordsToRuntimeSec } from "./words";

export function buildSceneMap(blocks: ScriptBlock[]): SceneRow[] {
  const slugIdxs = blocks
    .map((b, i) => (b.kind === "slug" ? i : -1))
    .filter((i) => i >= 0);

  if (slugIdxs.length === 0) {
    // One synthetic scene covering all spoken content
    const spoken = blocks.reduce((s, b) => s + b.spokenWords, 0);
    return [
      {
        index: 0,
        slug: "(no scene slugs found)",
        startBlock: 0,
        endBlock: Math.max(0, blocks.length - 1),
        spokenWords: spoken,
        runtimeSec: wordsToRuntimeSec(spoken),
        cumulativeWords: spoken,
      },
    ];
  }

  const scenes: SceneRow[] = [];
  let cumulative = 0;
  for (let s = 0; s < slugIdxs.length; s++) {
    const start = slugIdxs[s];
    const end = s + 1 < slugIdxs.length ? slugIdxs[s + 1] - 1 : blocks.length - 1;
    let spoken = 0;
    for (let i = start; i <= end; i++) spoken += blocks[i].spokenWords;
    cumulative += spoken;
    scenes.push({
      index: s,
      slug: blocks[start].label || blocks[start].raw.trim(),
      startBlock: start,
      endBlock: end,
      spokenWords: spoken,
      runtimeSec: wordsToRuntimeSec(spoken),
      cumulativeWords: cumulative,
    });
  }
  return scenes;
}
