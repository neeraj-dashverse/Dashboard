# PFM_dashboard_Timeline — Planning for promos (day-by-day schedule grid)

Captured 2026-10-27. **Deferred for detailed design** — Neeraj: *“will sit on this after the rough idea we make.”* Note in the build; do not over-invest until he revisits.

- Spreadsheet: https://docs.google.com/spreadsheets/d/1Tm1CLtoJmbUjVXHIpf969Y3RLsbKLaw4HhxDxcJ0wbs
- Tab: **Planning for promos** (`gid=732058759`)
- Grain: one row per promo × part (same as Production Tracker)

## What it is today

A Gantt/calendar grid:

| Fixed columns | Then… |
|---------------|--------|
| Show Name, Promo Name, Part, Duration, Start Date, Artist, Editor | One column per calendar date (7 Oct, 8 Oct, …) |

Day-cells name what happens that day — e.g. “First Animation & First cut,” “R&C,” “Sound & Delivery,” “Second cut & Sound.” Green/pink highlighting on some cells (meaning unconfirmed).

Neeraj uses it to **check** the schedule at a glance (first animation → first edit → corrections → sound), not to fill a form from scratch.

## What he wants instead

1. Ask the animation lead for dates (esp. first cut) — same manual-ask pattern as asset dates (`pfm-my-asset-sheet-schema.md`).
2. Dashboard shows a calendar/schedule managers can see, built from those dates.
3. He does **not** want to keep maintaining this hand-built grid.

Likely future source: Production Tracker stage dates and/or structured “ask the lead” dates — open which.

## Open (when he revisits)

- Exact day-cell stage labels vs Production Tracker Stage/Status dropdown vocabulary
- Green/pink cell highlighting meaning
- Auto-generate from Production Tracker vs separate lead-asked dates

Code: tab stub only in `PFM_TIMELINE_SHEET.tabs.planningForPromos` — no schedule UI yet.
