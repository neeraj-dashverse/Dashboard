import { AGENCY_SCRIPT_RULES } from "@/lib/ops/sheet-registry";

/** Strip PocketFM client refs — mandatory for agency / demarcated artifacts. */
export function stripPocketFm(text: string): { text: string; count: number } {
  let out = text;
  let count = 0;
  for (const token of AGENCY_SCRIPT_RULES.stripTokens) {
    const re = new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const matches = out.match(re);
    if (matches) count += matches.length;
    out = out.replace(re, "[CLIENT]");
  }
  return { text: out, count };
}
