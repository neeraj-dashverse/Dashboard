-- =============================================================================
-- WIPE all existing user objects in the public schema (old PFM sync / registry).
-- Does NOT touch auth, storage, realtime, or other Supabase system schemas.
--
-- Run this FIRST in Supabase Dashboard → SQL Editor.
-- Then run: 20261028_ops_persistence.sql
-- =============================================================================

-- 1) Drop every table in public (CASCADE removes dependent views/FKs)
do $$
declare
  r record;
begin
  for r in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('drop table if exists public.%I cascade', r.tablename);
  end loop;
end $$;

-- 2) Drop leftover views (in case any were not cascaded)
do $$
declare
  r record;
begin
  for r in
    select viewname
    from pg_views
    where schemaname = 'public'
  loop
    execute format('drop view if exists public.%I cascade', r.viewname);
  end loop;
end $$;

-- 3) Drop materialized views
do $$
declare
  r record;
begin
  for r in
    select matviewname
    from pg_matviews
    where schemaname = 'public'
  loop
    execute format('drop materialized view if exists public.%I cascade', r.matviewname);
  end loop;
end $$;

-- 4) Drop custom functions / procedures in public
do $$
declare
  r record;
begin
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('drop function if exists public.%I(%s) cascade', r.proname, r.args);
  end loop;
end $$;

-- 5) Drop custom enum / composite types in public (skip array types)
do $$
declare
  r record;
begin
  for r in
    select t.typname
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typtype in ('e', 'c')  -- enums + composites
  loop
    execute format('drop type if exists public.%I cascade', r.typname);
  end loop;
end $$;

-- 6) Drop leftover sequences in public
do $$
declare
  r record;
begin
  for r in
    select sequencename
    from pg_sequences
    where schemaname = 'public'
  loop
    execute format('drop sequence if exists public.%I cascade', r.sequencename);
  end loop;
end $$;

-- Done. public schema should now be empty of old app objects.
-- Next: run 20261028_ops_persistence.sql
