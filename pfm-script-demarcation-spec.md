# Script Demarcation Dashboard — spec (source of truth for Claude build)

Captured 2026-10-27. Neeraj builds this with Claude as a **separate** demarcation tool. Ops dashboard consumes its outputs — does not re-implement the PDF→docx pipeline here unless asked.

## Goal

Upload script PDF → parse → scene map → propose part splits (strict timing) → QC → user confirm → export formatted `.docx` deck + anomaly/QC report.

**Out of scope for that tool:** asset tables, B-roll maps, shot suggestions. Demarcation only.

## Ops integration (this PocketFM Ops repo)

| Demarcation output | Lands in Ops |
|--------------------|--------------|
| Formatted demarcated `.docx` | Master Tracker **col K · Demarcated script** link |
| Agency-facing sanitized copy (PFM stripped) | **col J · Agency script** |
| Safety / base copy (PFM stripped) | **col I · Script** |
| Part boundaries (scene ranges, runtimes) | **Production Tracker** rows — Part 1…N auto-feed |
| Part 1 artist owns first 5‑min | Derived from Part 1 assignment (col F removed) |

**Confidentiality:** PocketFM-reference stripping is mandatory on any agency/demarcated artifact (already `AGENCY_SCRIPT_RULES` in ops). Demarcation tool must bake strip-in; ops must never hand an unstripped doc to agency.

## Core principle

Base script is the only source of truth — reproduce verbatim; anomalies proposed, never auto-applied until user confirms; applied fixes disclosed on cover + revertible + logged APPLIED.

## Timing

- 138 wpm · ceiling 10:00 = 1,380 spoken words · floor ~6:00 · never ~3:00
- Spoken = narration + dialogue only (exclusions: cues, SFX, slugs, parentheticals, asset lines, PS hooks above Base Script marker)
- Show PS word count separately + total if PS included
- No PS / no Base Script marker → flag, don’t assume

## Split algorithm (exact order)

1. Scene map table first (slug, cumulative words, length mm:ss)
2. Exhaustive combinations per candidate part count — never claim impossible without full search
3. Rules: (a) boundaries on scene slugs only (b) no short parts (c) under 10:00 when possible
4. Conflicts → trade-off table; default strict scene-wise + no short parts, allow overruns as **FAIL — accepted by direction**
5. Unslugged scene changes only if slug-only fails — quote line, classify, propose inserts
6. End on complete blocks; prefer hooks; validate last/first lines

## Deck / QC / deliverables

See Neeraj’s Claude prompt for full styling (Navy #1F2A44, Crimson #B3123C, Cream #F7F2E7), cover order, QC Pass/Fail/N/A checklist, docx preview before export, anomaly IDs (C01…).

## Suggested stack (Claude build)

PDF extract → parse JSON → combinatorial split + QC (Python) · docx (Node or python-docx) · LibreOffice preview page 1 · dashboard UI for upload / scene map / trade-offs / anomalies / QC / download.
