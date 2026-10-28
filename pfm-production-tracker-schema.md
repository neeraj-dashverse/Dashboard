# PFM_dashboard_Timeline — Production Tracker (Neeraj’s animation sheet)

Captured 2026-10-27. **Current source of truth for part-level production.** The September `pfm-calculation-model.md` Production Tracker mapping is stale — use this doc instead.

- Spreadsheet: https://docs.google.com/spreadsheets/d/1Tm1CLtoJmbUjVXHIpf969Y3RLsbKLaw4HhxDxcJ0wbs
- Tab: **Production Tracker** (`gid=0`)
- Same spreadsheet as Master Tracker + Pre Production Tracker
- **Grain: one row per promo × part** (not per promo)

Neeraj: *“this is my animation sheet where I fill who all are doing animation, who all are doing editing, dates started and finished each stage, days calculated from start and end date, worked duration — agency is also mentioned here, initial duration we got, etc.”*

Day-to-day fill: **coordinator** (not Neeraj). Dashboard write-back will need manager + coordinator roles.

## Columns (visible; several hidden/collapsed not captured)

| Col | Header | Notes |
|-----|--------|-------|
| A | Show_Name | Join |
| B | Promo Name | Join |
| C | Part | Part number |
| D | Stage | Planning & Plotting / Animation / Edit / Sound / Delivered / Correction |
| E | Status | Separate from Stage — WIP / 1st–5th Correction / Done |
| F | Duration (hr:min:sec) | Per-part planned duration |
| G | Team | In house / Agency |
| H | Artist | Animator on this part |
| I | Editors | New vs Sept schema |
| J | Asset status | **Ignore in app** — same as Pre Production Tracker · Status; source of truth is Pre-Prod |
| K | Deadline | Date |
| L | Planned and plotted date | Date |
| M | Ani start date | Date |
| N | *(hidden)* | Likely planned counterpart — unconfirmed |
| O | Ani close date | Date |
| P, Q | *(hidden)* | Unconfirmed |
| R | Edit close date | Date |
| S | Correction start date | Date |
| T | Correction end date | Date |
| U, V | *(hidden)* | Unconfirmed |
| W | Sound end date | Date |
| … | *(gap not captured)* | Between W and AD |
| AD | Days | Computed span |
| AE | Remarks | Free text |
| AF | Worked Duration | Actual time worked ≠ Duration (F) |

## Dropdowns (from `Dropdowns` tab)

| List | Values |
|------|--------|
| Stage | Planning & Plotting, Animation, Edit, Sound, Delivered, Correction |
| Status post production | WIP, 1st–5th Correction, Done |
| Status pre production | WIP, Correction, Done, Nil |
| Team | In house, Agency |
| Version correction | 1st–5th |
| Overall Quality | 1–5 |
| Asset Artist | Gowtham, Somya, Shirso, Deepthesha, Merlyn |
| **Cps** | **Aman, Divakar only** — confirms CPS = lead/main animator, fixed roster |
| editors | Vicky, Rishi, Soumo, Harsh, Kirsa, Freak House, Parvi, SQB, Smiley Films, Anuprasad, Utkarsha, Ankush, Shivraj |

## Open

- Hidden cols N, P, Q, U, V (likely stage “planned” dates by analogy with Sept schema — not confirmed)
- Asset status here vs Pre Production / asset-team Status — which is authoritative?
- Full columns between W and AD

Code: `PRODUCTION_TRACKER_COLUMNS` / `PFM_DROPDOWNS` in `src/lib/ops/sheet-registry.ts`.
