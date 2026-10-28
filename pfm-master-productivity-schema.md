# PFM_dashboard_Timeline — Master Productivity (quality scoring)

Captured 2026-10-27. **Quality review**, not throughput.

- Spreadsheet: https://docs.google.com/spreadsheets/d/1Tm1CLtoJmbUjVXHIpf969Y3RLsbKLaw4HhxDxcJ0wbs
- Tab: **Master Productivity** (`gid=1806452589`)
- Grain: promo × part × (likely) revision pass — Version/Correction repeats suggest per-pass scoring (confirm)

Neeraj: *“the productivity of editors and animators, on the basis of the feedback from Cps and the link they worked [on].”*

Scored by **Cps** (Aman / Divakar) against work on the **Krock** review link. Complementary to throughput in the stale calc model — **keep Quality and Throughput as separate dimensions.**

## Identifying columns

Show Name, Promo Name, Part, Krock link, Cps, Animators, Editors.

## Animation scoring (1–5 unless noted)

| Field | Notes |
|-------|--------|
| Version/Correction | Which pass (2nd, 3rd, 4th…) |
| Overall Quality | |
| Script Knowledge | |
| All correction where artist able to understand | |
| Skin Textures | |
| Shot/Scene continuity | |
| Camera/shots used | |
| **Weak Areas** | Long free-text, itemized per-shot critique — keep as readable log |
| Remark | |
| Version/Correction | Repeated |

## Editing scoring (1–5 unless noted)

| Field | Notes |
|-------|--------|
| Version/Correction | |
| Storytelling | |
| Preemptive effort | |
| Shot placement/flow | |
| Color Consistency | |
| Technical | |
| Remark | Long free-text critique (narration/audio/pacing/continuity) |

## Build implication

Team view should show **both**:
1. **Throughput** — min closed / active days (calc model; may re-wire later)
2. **Quality** — this rubric + Weak Areas / Remarks as a log per part/artist (not collapsed into one blended score)

Revision count matters: a 4th-pass score ≠ a clean 1st-pass score.

## Open

- Once per part (final) vs once per revision pass (Version/Correction suggests per pass)
- Weak Areas UI — readable log, not summarized away

Code: `MASTER_PRODUCTIVITY_COLUMNS` / `qualityReviews` in ops types + Team board.
