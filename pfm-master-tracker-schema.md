# PFM_dashboard_Timeline — Master Tracker schema

Captured 2026-10-27 (updated same day: col F removed). Neeraj’s working copy — **not** PocketFM’s Master Sheet (`pfm-master-tab-schema.md`). Relationship between the two still unconfirmed.

- Spreadsheet: https://docs.google.com/spreadsheets/d/1Tm1CLtoJmbUjVXHIpf969Y3RLsbKLaw4HhxDxcJ0wbs
- Tab: Master Tracker (`gid=1082254307`)
- Join key: `Show_Name` + `Promo Name`

## Workflow (Neeraj)

1. Copy promo name (+ script) from PocketFM’s sheet into this one (safety copy).
2. Strip every “PocketFM” mention from the script.
3. Demarcate into parts — strip PocketFM from the demarcated version too.
4. Agency-facing artifacts must never reveal PocketFM as the client.

→ **Script / Agency script / Demarcated script** are three distinct links. Any agency export must bake in PFM stripping.

## Two-way sync now — A–L (minus F)

| Col | Field | Dashboard |
|-----|--------|-----------|
| A–B | Show_Name, Promo Name | Join |
| C | Status (Closed / WIP / Paused) | Editable |
| D | Priority (P0 / P1) | Editable |
| E | **Cps** | **Creative Producer** (director-like) — Aman / Divakar only. |
| F | ~~First 5min animator~~ | **Removed 2026-10-27.** First 5 min is Part 1 work by Part 1’s artist — derive, don’t track a separate person. |
| G | Status (5-min delivery) | Editable free text on Part 1 early progress (e.g. “1:30min covered by 6pm”). |
| H | Initial Duration | Original planned `hh:mm:ss` |
| I | Script | Safety copy (PFM-stripped) |
| J | Agency script | Sanitized for agency |
| K | Demarcated script | Part-split + sanitized |
| L | Remarks | Editable |

## Read-only for now — M–O

| Col | Field | Notes |
|-----|--------|-------|
| M | Total asset made | May become computed |
| N | Total asset generated | May become computed |
| O | Credit used for 1min content inhouse | May inform credit-split rules |

## Chase-me

Dashboard must nudge Neeraj for missing/stale A–L fields (except removed F) — ops-manager style, not a passive form.

Code: `MASTER_TRACKER_COLUMNS` in `src/lib/ops/sheet-registry.ts`.
