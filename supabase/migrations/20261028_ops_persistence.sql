-- PocketFM Ops persistence (reuse existing Supabase project).
-- Safe to re-run: IF NOT EXISTS throughout.
-- Apply in Supabase Dashboard → SQL Editor → Run, OR:
--   npx tsx scripts/apply-ops-migration.ts

create extension if not exists "pgcrypto";

-- Every dashboard edit lands here immediately (survives refresh).
-- Sheet sync (Gap 2) drains rows with status = 'pending'.
create table if not exists ops_write_queue (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  action jsonb not null,
  target text not null,
  spreadsheet_id text,
  tab_name text,
  status text not null default 'pending'
    check (status in ('pending', 'syncing', 'synced', 'error', 'cancelled')),
  error text,
  attempts int not null default 0,
  synced_at timestamptz
);

create index if not exists ops_write_queue_status_created_idx
  on ops_write_queue (status, created_at);

-- Nudges Neeraj dismissed (Today "Later").
create table if not exists ops_dismissed_nudges (
  nudge_id text primary key,
  dismissed_at timestamptz not null default now()
);

-- Sync cursors / fingerprints (Master Sheet new-promo watch, last flush, etc.).
create table if not exists ops_sync_cursors (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Master Sheet rows we've seen — drives "new promo not in tracker" nudges.
create table if not exists ops_known_master_promos (
  join_key text primary key,
  show_name text not null,
  promo_name text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  notified_at timestamptz,
  in_tracker boolean not null default false
);

create index if not exists ops_known_master_promos_tracker_idx
  on ops_known_master_promos (in_tracker, notified_at);

-- Room for daily throughput later (Gap parked).
create table if not exists ops_daily_throughput (
  id uuid primary key default gen_random_uuid(),
  log_date date not null,
  artist text not null,
  show_name text,
  promo_name text,
  parts_worked numeric,
  work_type text,
  duration_bucket text,
  output_minutes numeric not null default 0,
  remarks text,
  source_row_hash text,
  ingested_at timestamptz not null default now(),
  unique (log_date, artist, show_name, promo_name, source_row_hash)
);
