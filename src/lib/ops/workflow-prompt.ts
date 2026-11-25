/** Copy-paste prompt for making the demarcated script from the agency copy. */
export const DEMARCATE_PROMPT = `Demarcate this agency animation script into parts.

Source: the agency copy only (PocketFM already stripped). Do not put PocketFM, Pocket FM, or the client name anywhere.

Rules:
- 138 words per minute spoken (narration + dialogue only)
- Each part 6:00–10:00. Never a ~3:00 part
- Split only on scene slugs
- Number parts 1, 2, 3… and keep the script text verbatim inside each part
- End parts on complete scenes; prefer a hook at the cut

Output a demarcated script (part-split deck) ready to share with the agency.`;
