# Locked decisions (Neeraj · updated 2026-10-28)

| # | Topic | Decision |
|---|--------|----------|
| 1 | Contact / share | `neeraj.d@dashverse.ai` |
| 2 | Production Tracker hidden cols | **Ignore** — not needed |
| 3 | Master Sheet ↔ Master Tracker | Master Sheet = overall PocketFM picture; Master Tracker = Neeraj working copy. New-promo watch + completion write-back planned (Gap 3). |
| 4 | Asset status | **One field** — Pre Production Tracker · Status is source of truth. Production Tracker col J is the same thing → **ignore J** in the dashboard. |
| 5 | Asset team dates → Pre Prod | **Manual** — asset team fills their sheet |
| 6 | Credits | **Later** — no credit split UI for now |
| 7 | Throughput / daily log | Parked until daily-log sheet exists; when live, **include everything** (anim → edit → correction → sound) |
| 8 | Part 1 / first 5‑min | Parts from **demarcated script**; first 5 min = Part 1 artist |
| 9 | Roles / nudges | **Neeraj only** for now — he checks the dashboard and needs the updates |
| 10 | **Cps** | Creative Producer. **Not a hard-coded Aman/Divakar lock** — roster = whoever appears as Cps on Master Tracker (Neeraj updates the sheet; dashboard picks from those names). |
| 11 | Demarcation | Built in `/demarcate` — see `pfm-script-demarcation-spec.md` |
| 12 | Calculated planned date | **Ignored** |
| 13 | Reruns (e.g. two BTR 6.0) | **Separate promos** — two cards; active run owns live Production Tracker parts |
| 14 | Source of truth | **Production Tracker** for productivity / part reality; **Master Sheet** for overall PocketFM picture |
| 15 | Database | Reuse **previous Supabase project** (not a new one) for write queue + sync state |

## Locked 2026-10-28 (follow-up)

- **Q6 new-promo:** **A — alert only** on Today; Neeraj adds Master Tracker row himself (no auto-draft)

## Still open (need Neeraj)

- Write-back cadence: DB immediate + flush Sheets every ~30s + Flush button? (recommended) vs every edit hits Sheets immediately
- Exact Master Sheet **Status/Stage** string to write on full delivery (`Delivered` vs `Completed` vs other)
- Where Final Renders / Project Files / Assets **URLs** come from when we write completion back to Master Sheet
