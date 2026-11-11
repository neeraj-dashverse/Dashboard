-- Who may open the dashboard, and whether they can edit or only view.
-- Apply in Supabase Dashboard → SQL Editor → Run, OR:
--   npx tsx scripts/apply-ops-migration.ts

create table if not exists allowed_users (
  email text primary key,
  role text not null default 'viewer' check (role in ('admin', 'viewer')),
  added_at timestamptz not null default now(),
  added_by text
);

-- Bootstrap: Neeraj is the only admin until he adds more people from /admin.
insert into allowed_users (email, role, added_by)
values ('neeraj.d@dashverse.ai', 'admin', 'migration')
on conflict (email) do update set role = 'admin';
