-- Referee role: a second kind of Supabase Auth login, alongside the
-- existing organizer accounts, scoped to scoring only the matches an
-- organizer explicitly assigns them to (a group's round robin, or a
-- category's knockout bracket) -- no access to registrations, categories,
-- payments, or any other admin screen. Mirrors Clutch's separate
-- Organizer/Referee apps.
--
-- Role check: this project's admin_all_<table> policies gate on a JWT
-- claim (`(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'`), not "any
-- authenticated user" -- is_organizer() (0001_tournament_categories.sql)
-- already wraps that check. A referee account is created with
-- app_metadata.role = 'referee' instead (set via the service-role admin
-- API in api/tournament.js's create-referee action -- app_metadata is not
-- user-editable, unlike user_metadata, which matters since this is the
-- security-relevant claim). Because every pre-existing admin_all_<table>
-- policy in this project already requires role = 'admin' specifically
-- (rather than "not a referee"), a referee -- like the "member" customer
-- accounts from the membership feature -- is automatically excluded from
-- all of them with no changes needed to sessions/players/venues/etc.
create or replace function is_referee()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'referee', false);
$$;

-- Display metadata for the admin's Referees list (name/phone) -- there's no
-- client-callable "list users" API, so this is what /admin queries instead
-- of the service-role-only auth admin API. Not used for role checks (the
-- JWT claim is authoritative for that); existence of a row here is purely
-- for the UI.
create table referees (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  created_at timestamptz not null default now()
);

alter table referees enable row level security;
create policy organizer_all_referees on referees for all to authenticated using (is_organizer()) with check (is_organizer());
create policy referee_read_own_row on referees for select to authenticated using (id = auth.uid());

-- ── Referee assignments ──────────────────────────────────────────────────
-- A referee is assigned to either one group (scores that group's round
-- robin) or a category's whole knockout bracket ('bracket' scope, group_id
-- null) -- the same two scoring surfaces ScoreMode already covers.
create table tournament_referee_assignments (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references tournament_categories(id) on delete cascade,
  group_id uuid references tournament_groups(id) on delete cascade,
  scope text not null default 'group' check (scope in ('group', 'bracket')),
  referee_id uuid not null references referees(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((scope = 'group' and group_id is not null) or (scope = 'bracket' and group_id is null))
);

create index tournament_referee_assignments_referee_id_idx on tournament_referee_assignments(referee_id);
create index tournament_referee_assignments_category_id_idx on tournament_referee_assignments(category_id);

alter table tournament_referee_assignments enable row level security;
create policy organizer_all_referee_assignments on tournament_referee_assignments for all to authenticated using (is_organizer()) with check (is_organizer());
create policy referee_read_own_assignments on tournament_referee_assignments for select to authenticated using (referee_id = auth.uid());

-- A referee may additionally update a match that falls within one of their
-- assignments -- their group's round-robin matches (round = 0), or every
-- knockout match in a category they're assigned to for 'bracket' scope.
-- (The organizer's own admin_all_tournament_matches policy from 0001
-- already covers every other case.)
create policy referee_score_assigned_matches on tournament_matches for update to authenticated
  using (
    is_referee() and exists (
      select 1 from tournament_referee_assignments a
      where a.referee_id = auth.uid()
        and a.category_id = tournament_matches.category_id
        and (
          (a.scope = 'group' and a.group_id = tournament_matches.group_id)
          or (a.scope = 'bracket' and tournament_matches.round > 0)
        )
    )
  )
  with check (
    is_referee() and exists (
      select 1 from tournament_referee_assignments a
      where a.referee_id = auth.uid()
        and a.category_id = tournament_matches.category_id
        and (
          (a.scope = 'group' and a.group_id = tournament_matches.group_id)
          or (a.scope = 'bracket' and tournament_matches.round > 0)
        )
    )
  );
