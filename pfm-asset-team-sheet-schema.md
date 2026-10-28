# PFM Dashboard - Assets — Promos - Assets Master Sheet

Captured 2026-10-27. **The asset team’s own sheet** (producers fill this). Distinct from Neeraj’s Pre Production Tracker (`pfm-my-asset-sheet-schema.md`).

- Spreadsheet: https://docs.google.com/spreadsheets/d/1_0QMYmGef8A-mckXPWjGKD9_fUvxvzvpk5zvx5NnYQA
- Tab: **Promos - Assets Master Sheet** (`gid=0`)
- Join key: `Show_Name` + `Script Name`

## Critical for animation handoff

| Col | Header | Why |
|-----|--------|-----|
| G | Asset Map | Animation consumes this |
| H | Canvas Link | Animation consumes this |
| I | Assets Drive Link | Animation consumes this |

## Date gotcha — non-negotiable

There are **two** Start Date / End Date pairs.

- **Ignore N–O** (first pair).
- Use **Y–Z** only (right before Corrections) as authoritative.

## Also captured

Artist 1–3, ArtLead, Assets Status, Remarks, Script/Canvas (same as PocketFM), Notes, Dashverse Notes, Corrections dates, Costing, Assets Count breakdown.

## Open

- Does `PFM Assets - Tracker` duplicate/supersede this tab?
- Should Y/Z auto-feed Neeraj’s Pre Production Tracker, or stay a manual ask?
- Is Production Days computed or manual?

Code: `src/lib/ops/sheet-registry.ts` → `PFM_ASSETS_SHEET` / `ASSETS_MASTER_COLUMNS`.
