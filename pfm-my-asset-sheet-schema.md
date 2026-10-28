# PFM_dashboard_Timeline — Pre Production Tracker (“my asset sheet”)

Captured 2026-10-27. **Neeraj’s simplified asset-progress tracker** — distinct from the asset team’s own sheet (`pfm-asset-team-sheet-schema.md`).

- Spreadsheet: https://docs.google.com/spreadsheets/d/1Tm1CLtoJmbUjVXHIpf969Y3RLsbKLaw4HhxDxcJ0wbs
- Tab: **Pre Production Tracker** (`gid=696372285`)
- Same spreadsheet as Master Tracker
- Join: `Show_Name` + `Promo Name`

## Columns

| Col | Header | Role in app |
|-----|--------|-------------|
| A–B | Show_Name, Promo Name | Join |
| C | Status (Done / WIP / Nil / Correction) | Two-way |
| D | Artist | Two-way |
| E | Total Assets | Two-way |
| F | Start date | Two-way |
| G | Planned date | Two-way |
| H | Closed date | Two-way |
| I | Remarks | Two-way — **append-only log in app** (not a single overwrite) |
| J | Calculated planned date | Read (formula ≈ start + 5 calendar days) |

## Dashboard-only ops fields (resolves asset-picked tracking)

| Field | Meaning |
|-------|---------|
| **Picked** | Boolean/date — when animation actually picked up the assets |
| **Planned date** | Same as col G; editable in dashboard |
| **Delay** | Computed late-vs-planned and/or a flag Neeraj sets |
| **Remarks log** | Append-only entries over time |
| **Assets needed by** | Deadline pushed to asset team from animator free-date |

## Workflow (Neeraj)

1. Ask asset team for start / planned / closed (or later auto-feed from their Y/Z — open).
2. Use those dates to plot when CPS can take the promo.
3. Reverse: “animation free by X → assets needed by X” — bidirectional planning.
4. Fill all of this in the **dashboard**, not by re-typing the sheet.

## Open

- Reconcile col J with `stage_start_date + 5d` in stale `pfm-calculation-model.md`.
- Auto-feed from asset team Start/End (Y/Z) vs keep manual ask.

Code: `PRE_PRODUCTION_COLUMNS` in `src/lib/ops/sheet-registry.ts`.
