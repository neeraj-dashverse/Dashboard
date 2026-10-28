# Animation productivity — Master data (daily throughput log)

Captured 2026-10-27. **Separate spreadsheet** from `PFM_dashboard_Timeline`. Raw day-by-day log for the **throughput** half of productivity (quality lives in `pfm-master-productivity-schema.md`).

- Spreadsheet: https://docs.google.com/spreadsheets/d/1U6fvzf9Fe9ydjCP-lbNoQFjklaPt62-ESxG8Ummh7-s
- Spreadsheet name: **Animation productivity**
- Tab: **Master data** (`gid=0`)
- Other tabs: `Drop downs`, `Promo names`, `Sheet4`
- Grain: one row per artist × promo × day

Neeraj: *“this sheet is the daily productivity of animation team.”*

## Columns

| Col | Header | Notes |
|-----|--------|-------|
| A | Date | Inconsistent formats (`16-09-2026`, `16/09/2026`, typo `23-09-0206`) — **normalize on ingest** |
| B | POD lead | e.g. Chhavi; blank for some (Hritik, Dhara) — meaning open |
| C | Artist | Who worked that day |
| D | Show Name | |
| E | Promo Name | |
| F | Parts Worked | Count of parts touched |
| G | Duration worked/day | Dropdown buckets: “Less than 3 min,” “3 - 5 min,” **or “correction.”** Conflates duration vs work-type — model as `workType` + `durationBucket` |
| H | Remarks | Free text (often empty) |

## Modeling note (col G)

On ingest / in app types, split:

- `workType`: `new` | `correction`
- `durationBucket`: `<3` | `3-5` | null (when correction)

Open: whether correction days count toward `active_days` / output for `throughput(a) = output / active_days`.

## Feeds

Team view throughput column — complementary to CPS quality in Master Productivity. Do not blend into one score.

Code: `ANIMATION_PRODUCTIVITY_SHEET` / `dailyLogs` in ops store.
