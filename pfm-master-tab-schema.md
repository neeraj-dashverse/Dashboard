# Dashverse<>PFM — Master Sheet schema

Captured 2026-10-27. PocketFM’s shared data (separate from Neeraj’s Master Tracker).

- Spreadsheet: https://docs.google.com/spreadsheets/d/1-2MmgaVf4-lpJ4vu-p_9TB1J8ig4vn4yvz2K2Mft3vA
- Tab: Master Sheet (`gid=0`)
- Grain: one row per promo
- Join key: `Show_Name` + `Script Name`

## Highlights

- Two delivery milestones: **5 mins timeline** → **Complete Deliverable**
- Priority P0/P1, Stage, Canvas status, links (Script, Canvas, VO, Samples, Final Renders, …)
- Cost block: Per Min × Min → Promo cost, Payment status

Relationship to `PFM_dashboard_Timeline` · Master Tracker is **not yet confirmed**.

Code mirror: `src/lib/ops/sheet-registry.ts` → `MASTER_COLUMNS` / `DASHVERSE_PFM_SHEET`.
