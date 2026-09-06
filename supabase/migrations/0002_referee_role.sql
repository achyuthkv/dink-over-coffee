-- Referee role: a second kind of Supabase Auth login, alongside the
-- existing organizer accounts, scoped to scoring only the matches an
-- organizer explicitly assigns them to (a group's round robin, or a
-- category's knockout bracket) -- no access to registrations, categories,
-- payments, or any other admin screen. Mirrors Clutch's separate
-- Organizer/Referee apps.
--
-- IMPORTANT -- read before running: every `admin_all_<table>` policy in
-- this project (per the README: `for all to authenticated using (true)`)
-- previously meant "any authenticated user is an organizer", because only
-- organizers ever had a login. That invariant breaks the moment a referee
-- account exists: without the changes below, a referee would inherit full
-- organizer-level access to sessions/players/shop/waivers/etc, not just
-- tournament scoring. This migration re-authors those policies to gate on
-- `is_organizer()` instead of a bare `true`, for every admin-writable table
-- documented in the README (sessions, players, venues, upi_accounts,
-- session_upis, waivers, shop_orders, plus the tournament_* tables from
-- 0001). It assumes those policies are named exactly `admin_all_<table>` as
-- documented -- if your project's policies ended up named differently,
-- `drop policy if exists` below is a silent no-op and the old permissive
-- policy stays in effect (Postgres OR's multiple permissive policies
-- together, so the more permissive one wins). Verify in the Supabase
-- dashboard (Authentication -> Policies) that no bare `using (true))`
-- policy remains on these tables for the `authenticated` role before
-- relying on the referee role for real access control.

-- ── Role lookup ──────────────────────────────────────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'organizer' check (role in ('organizer', 'referee')),
  name text,
  phone text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
drop policy if exists select_own_profile on profiles;
create policy select_own_profile on profiles for select to authenticated using (id = auth.uid());
drop policy if exists organizer_all_profiles on profiles;
create policy organizer_all_profiles on profiles for all to authenticated using (is_organizer()) with check (is_organizer());

-- A user with no profiles row at all is an organizer by default -- every
-- pre-existing account was created before this table existed, and a
-- referee account is always given a profiles row explicitly (by the
-- 'create-referee' admin action) at creation time, so "no row" only ever
-- means "an existing organizer that predates roles". security definer so
-- the internal lookup runs as the function owner (bypassing this table's
-- own RLS) rather than recursing back through the calling policy.
create or replace function is_organizer()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select not exists (
    select 1 from profiles where id = auth.uid() and role = 'referee'
  );
$$;

-- ── Referee assignments ──────────────────────────────────────────────────
-- A referee is assigned to either one group (scores that group's round
-- robin) or a category's whole knockout bracket ('bracket' scope, group_id
-- null) -- the same two scoring surfaces ScoreMode already covers.
create table tournament_referee_assignments (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references tournament_categories(id) on delete cascade,
  group_id uuid references tournament_groups(id) on delete cascade,
  scope text not null default 'group' check (scope in ('group', 'bracket')),
  referee_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((scope = 'group' and group_id is not null) or (scope = 'bracket' and group_id is null))
);

create index tournament_referee_assignments_referee_id_idx on tournament_referee_assignments(referee_id);
create index tournament_referee_assignments_category_id_idx on tournament_referee_assignments(category_id);

alter table tournament_referee_assignments enable row level security;
create policy organizer_all_referee_assignments on tournament_referee_assignments for all to authenticated using (is_organizer()) with check (is_organizer());
create policy referee_read_own_assignments on tournament_referee_assignments for select to authenticated using (referee_id = auth.uid());

-- ── Re-author tournament_* policies from 0001 ────────────────────────────
-- Organizers keep full read/write; any authenticated user (referee
-- included) gets read-only on the non-sensitive tables so a referee's
-- scoring screen can show tournament/category/team names, but write access
-- to everything except match scores stays organizer-only.
drop policy if exists admin_all_tournament_categories on tournament_categories;
create policy organizer_write_tournament_categories on tournament_categories for all to authenticated using (is_organizer()) with check (is_organizer());
create policy read_tournament_categories_authenticated on tournament_categories for select to authenticated using (true);

drop policy if exists admin_all_tournament_groups on tournament_groups;
create policy organizer_write_tournament_groups on tournament_groups for all to authenticated using (is_organizer()) with check (is_organizer());
create policy read_tournament_groups_authenticated on tournament_groups for select to authenticated using (true);

drop policy if exists admin_all_tournament_courts on tournament_courts;
create policy organizer_write_tournament_courts on tournament_courts for all to authenticated using (is_organizer()) with check (is_organizer());
create policy read_tournament_courts_authenticated on tournament_courts for select to authenticated using (true);

drop policy if exists admin_all_tournament_teams on tournament_teams;
create policy organizer_write_tournament_teams on tournament_teams for all to authenticated using (is_organizer()) with check (is_organizer());
create policy read_tournament_teams_authenticated on tournament_teams for select to authenticated using (true);

-- Contact/payment details stay organizer-only -- a referee scoring a match
-- has no reason to see a team's phone number or payment status.
drop policy if exists admin_all_tournament_registrations on tournament_registrations;
create policy organizer_all_tournament_registrations on tournament_registrations for all to authenticated using (is_organizer()) with check (is_organizer());

drop policy if exists admin_all_tournament_holds on tournament_holds;
create policy organizer_all_tournament_holds on tournament_holds for all to authenticated using (is_organizer()) with check (is_organizer());

drop policy if exists admin_all_tournament_matches on tournament_matches;
create policy organizer_write_tournament_matches on tournament_matches for all to authenticated using (is_organizer()) with check (is_organizer());
create policy read_tournament_matches_authenticated on tournament_matches for select to authenticated using (true);
-- A referee may only update a match that falls within one of their
-- assignments -- their group's round-robin matches (round = 0), or every
-- knockout match in a category they're assigned to for 'bracket' scope.
create policy referee_score_assigned_matches on tournament_matches for update to authenticated
  using (
    exists (
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
    exists (
      select 1 from tournament_referee_assignments a
      where a.referee_id = auth.uid()
        and a.category_id = tournament_matches.category_id
        and (
          (a.scope = 'group' and a.group_id = tournament_matches.group_id)
          or (a.scope = 'bracket' and tournament_matches.round > 0)
        )
    )
  );

drop policy if exists admin_all_tournaments on tournaments;
create policy organizer_write_tournaments on tournaments for all to authenticated using (is_organizer()) with check (is_organizer());
create policy read_tournaments_authenticated on tournaments for select to authenticated using (true);

-- ── Best-effort lockdown of pre-existing admin tables ────────────────────
-- See the note at the top of this file -- these assume the documented
-- `admin_all_<table>` naming. Re-run manually with the real policy name if
-- your project's differs.
drop policy if exists admin_all_sessions on sessions;
create policy admin_all_sessions on sessions for all to authenticated using (is_organizer()) with check (is_organizer());

drop policy if exists admin_all_players on players;
create policy admin_all_players on players for all to authenticated using (is_organizer()) with check (is_organizer());

drop policy if exists admin_all_venues on venues;
create policy admin_all_venues on venues for all to authenticated using (is_organizer()) with check (is_organizer());

drop policy if exists admin_all_upi_accounts on upi_accounts;
create policy admin_all_upi_accounts on upi_accounts for all to authenticated using (is_organizer()) with check (is_organizer());

drop policy if exists admin_all_session_upis on session_upis;
create policy admin_all_session_upis on session_upis for all to authenticated using (is_organizer()) with check (is_organizer());

drop policy if exists admin_all_waivers on waivers;
create policy admin_all_waivers on waivers for all to authenticated using (is_organizer()) with check (is_organizer());

drop policy if exists admin_all_shop_orders on shop_orders;
create policy admin_all_shop_orders on shop_orders for all to authenticated using (is_organizer()) with check (is_organizer());
