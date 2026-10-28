# PocketFM Ops (Dashverse)

Operations dashboard for PocketFM promos. **Live data from Google Sheets** via service account. No Supabase / old SQL in this repo.

Contact: **neeraj.d@dashverse.ai**

## Run

```bash
npm install
npm run dev -- -p 3000
```

Requires `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY` in `.env.local` (see `.env.example`). Share Timeline / Master / Assets sheets with that service account as Viewer (Editor later for write-back).

Force mock: `OPS_DATA_SOURCE=mock`.

## Surfaces

| Route | Purpose |
|-------|---------|
| `/` | Today — time-aware nudges by role |
| `/pipeline` | Part-stage kanban |
| `/team` | Animator capacity + CPS quality |
| `/promo/[id]` | One promo: tracker + assets + parts |
| `/demarcate` | Script → scene map → splits → QC → `.docx` |

## Data sources (live)

- **PFM_dashboard_Timeline** — Master Tracker, Production Tracker, Pre Production Tracker, Master Productivity
- **Dashverse<>PFM** — Master Sheet (reference)
- **PFM Dashboard - Assets** — Promos - Assets Master Sheet

Join key: `Show_Name + Promo/Script Name` (normalized). Repeated same-name rows (e.g. Closed + WIP runs) stay as separate cards.

## Locked decisions

See `pfm-decisions-locked.md` + eight `pfm-*-schema.md` docs + `pfm-script-demarcation-spec.md`.

## Persistence (Supabase — previous project)

Edits enqueue to `ops_write_queue` so a refresh does not lose them. Sheet write-back (Gap 2) still pending.

**One-time setup:** Supabase Dashboard → SQL Editor → paste & run  
`supabase/migrations/20261028_ops_persistence.sql`

Check: `npx tsx scripts/probe-ops-db.ts` → should print `{ ok: true, ... }`

## Not yet

- Sheets write-back from the queue (Gap 2)
- Master Sheet new-promo watch + completion write-back (Gap 3)
- Calendar planner / daily throughput / Results view
