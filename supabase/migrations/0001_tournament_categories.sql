-- Tournament module v2: categories, groups, brackets, direct registration.
--
-- Replaces the old single-flat-tournament schema (tournament_courts /
-- tournament_teams / tournament_matches keyed straight off tournament_id,
-- with courts doubling as both "pool" and "physical court") with a
-- category-based model: a tournament has one or more categories (e.g. "Men's
-- Doubles", "Mixed Doubles"), each with its own format (round robin, single
-- elimination, or group stage into a knockout bracket), its own entry fee /
-- capacity / registration window, and its own teams, groups and matches.
-- Physical courts become tournament-level scheduling metadata only, no
-- longer the same thing as a round-robin pool.
--
-- This is a breaking change to the tournament tables -- run this against a
-- project that's ready to lose any existing tournament_teams/matches rows
-- (export anything worth keeping first). Sessions, players, shop, etc. are
-- untouched.
--
-- IMPORTANT -- admin access model: this project gates admin (organizer)
-- access via a Supabase Auth JWT claim, not "any authenticated user":
-- existing admin_all_<table> policies check
-- `(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'`. is_organizer()
-- below wraps that same check so every policy in this file (and
-- 0002_referee_role.sql) uses the identical rule an organizer account
-- already satisfies -- no backfill needed for existing admins, and no
-- changes needed to any pre-existing table's policies, since a non-admin
-- authenticated user (a referee, or a customer "member" account from the
-- membership feature) was already excluded by that same JWT check before
-- this migration existed.

create or replace function is_organizer()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

-- ── Drop old tournament objects (no-ops on a fresh project with none of this yet) ──
drop trigger if exists players_sync_tournament_team on players;
drop function if exists sync_team_for_player_in_tournament(uuid, bigint);
drop function if exists sync_tournament_team_from_player();
drop table if exists tournament_matches cascade;
drop table if exists tournament_teams cascade;
drop table if exists tournament_courts cascade;

-- Base table, for a project that doesn't have it yet at all. On a project
-- upgrading from the old flat schema this is a no-op and the alters below
-- add the new columns to the existing table.
create table if not exists tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'setup' check (status in ('setup', 'active', 'completed')),
  created_at timestamptz not null default now()
);

alter table tournaments drop column if exists session_id;
alter table tournaments add column if not exists sport text not null default 'pickleball';
alter table tournaments add column if not exists venue text;
alter table tournaments add column if not exists start_date date;
alter table tournaments add column if not exists end_date date;

alter table tournaments enable row level security;
drop policy if exists admin_all_tournaments on tournaments;
create policy admin_all_tournaments on tournaments for all to authenticated using (is_organizer()) with check (is_organizer());
drop policy if exists public_read_tournaments on tournaments;
create policy public_read_tournaments on tournaments for select to anon using (status <> 'setup');
drop policy if exists read_tournaments_authenticated on tournaments;
create policy read_tournaments_authenticated on tournaments for select to authenticated using (true);

-- ── Categories ───────────────────────────────────────────────────────────
-- One tournament can run several categories in parallel (Men's Doubles,
-- Women's Doubles, Mixed, skill brackets, ...), each its own bracket.
-- session_id is `text` (not uuid) -- sessions.id is a short opaque string
-- id in this project, not a uuid.
create table tournament_categories (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name text not null,
  format text not null default 'round_robin' check (format in ('round_robin', 'single_elim', 'group_knockout')),
  team_size smallint not null default 2 check (team_size in (1, 2)),
  max_teams int,
  entry_fee numeric not null default 0,
  early_bird_fee numeric,
  early_bird_deadline date,
  advance_per_group smallint not null default 2,
  session_id text references sessions(id) on delete set null,
  status text not null default 'setup' check (status in ('setup', 'registration_open', 'registration_closed', 'active', 'completed')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ── Groups (round-robin pools within a category) ─────────────────────────
create table tournament_groups (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references tournament_categories(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ── Physical courts (tournament-level scheduling metadata only) ──────────
create table tournament_courts (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ── Teams (public-safe fields only -- see tournament_registrations for
-- contact details, kept out of this table so the public live-standings/
-- bracket page can safely select every column of this one) ──────────────
create table tournament_teams (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references tournament_categories(id) on delete cascade,
  group_id uuid references tournament_groups(id) on delete set null,
  name text not null,
  player1_name text not null,
  player2_name text,
  seed int,
  status text not null default 'confirmed' check (status in ('confirmed', 'waitlisted', 'withdrawn')),
  source_player_id bigint references players(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Contact + payment details for a team's registration -- locked down like
-- upi_accounts (no anon policy at all); the public page never needs these
-- columns, only api/tournament.js (service role) and /admin (authenticated).
create table tournament_registrations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null unique references tournament_teams(id) on delete cascade,
  phone text,
  player2_phone text,
  email text,
  amount numeric not null default 0,
  payment_status text not null default 'free' check (payment_status in ('free', 'pending', 'paid', 'refunded')),
  razorpay_order_id text,
  razorpay_payment_id text,
  created_at timestamptz not null default now()
);

-- Hold-then-confirm for paid category entry, mirroring `holds`/`shop_holds`.
create table tournament_holds (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references tournament_categories(id) on delete cascade,
  razorpay_order_id text not null,
  team jsonb not null,
  amount numeric not null,
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'consumed')),
  created_at timestamptz not null default now()
);

-- ── Matches ────────────────────────────────────────────────────────────
-- `round` + `bracket_slot` encode the elimination-bracket tree: the winner
-- of round r / slot s feeds into round r+1 / slot floor(s/2) -- so
-- advancement is a pure computation (see computeAdvancement in
-- frontend/src/lib/tournament.js), no next_match_id column needed. Group
-- (round-robin) matches leave both at their defaults (round 0).
create table tournament_matches (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references tournament_categories(id) on delete cascade,
  group_id uuid references tournament_groups(id) on delete set null,
  court_id uuid references tournament_courts(id) on delete set null,
  stage text not null default 'group' check (stage in ('group', 'round_of_32', 'round_of_16', 'quarterfinal', 'semifinal', 'final')),
  round int not null default 0,
  bracket_slot int not null default 0,
  match_number int not null default 0,
  team_a_id uuid references tournament_teams(id) on delete set null,
  team_b_id uuid references tournament_teams(id) on delete set null,
  team_a_score int,
  team_b_score int,
  winner_team_id uuid references tournament_teams(id) on delete set null,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'walkover')),
  scheduled_time timestamptz,
  created_at timestamptz not null default now()
);

create index tournament_categories_tournament_id_idx on tournament_categories(tournament_id);
create index tournament_groups_category_id_idx on tournament_groups(category_id);
create index tournament_courts_tournament_id_idx on tournament_courts(tournament_id);
create index tournament_teams_category_id_idx on tournament_teams(category_id);
create index tournament_teams_group_id_idx on tournament_teams(group_id);
create index tournament_registrations_team_id_idx on tournament_registrations(team_id);
create index tournament_holds_category_id_idx on tournament_holds(category_id);
create index tournament_matches_category_id_idx on tournament_matches(category_id);
create index tournament_matches_group_id_idx on tournament_matches(group_id);
create index tournament_matches_round_idx on tournament_matches(category_id, round, bracket_slot);

-- ── RLS ────────────────────────────────────────────────────────────────
alter table tournament_categories enable row level security;
alter table tournament_groups enable row level security;
alter table tournament_courts enable row level security;
alter table tournament_teams enable row level security;
alter table tournament_registrations enable row level security;
alter table tournament_holds enable row level security;
alter table tournament_matches enable row level security;

create policy admin_all_tournament_categories on tournament_categories for all to authenticated using (is_organizer()) with check (is_organizer());
create policy admin_all_tournament_groups on tournament_groups for all to authenticated using (is_organizer()) with check (is_organizer());
create policy admin_all_tournament_courts on tournament_courts for all to authenticated using (is_organizer()) with check (is_organizer());
create policy admin_all_tournament_teams on tournament_teams for all to authenticated using (is_organizer()) with check (is_organizer());
create policy admin_all_tournament_registrations on tournament_registrations for all to authenticated using (is_organizer()) with check (is_organizer());
create policy admin_all_tournament_holds on tournament_holds for all to authenticated using (is_organizer()) with check (is_organizer());
create policy admin_all_tournament_matches on tournament_matches for all to authenticated using (is_organizer()) with check (is_organizer());

-- Any authenticated principal (organizer, referee, or a customer "member"
-- account) can read the non-sensitive structural tables -- none of this is
-- more sensitive than what's about to go public anyway, and referees need
-- it to render their scoring screen. tournament_registrations/
-- tournament_holds get no such policy -- contact/payment details stay
-- organizer-only.
create policy read_tournament_categories_authenticated on tournament_categories for select to authenticated using (true);
create policy read_tournament_groups_authenticated on tournament_groups for select to authenticated using (true);
create policy read_tournament_courts_authenticated on tournament_courts for select to authenticated using (true);
create policy read_tournament_teams_authenticated on tournament_teams for select to authenticated using (true);
create policy read_tournament_matches_authenticated on tournament_matches for select to authenticated using (true);

-- Public (anon) read access for the live bracket/standings page and the
-- category picker on the registration form -- mirrors the existing
-- public_read_tournaments convention of hiding 'setup'-status rows at the
-- RLS layer itself (not just via client-side query filtering), extended
-- down through category status too, since a category has its own
-- setup/registration_open/... lifecycle independent of its tournament's.
create policy public_read_tournament_categories on tournament_categories for select to anon using (
  status <> 'setup'
  and exists (select 1 from tournaments t where t.id = tournament_categories.tournament_id and t.status <> 'setup')
);
create policy public_read_tournament_groups on tournament_groups for select to anon using (
  exists (
    select 1 from tournament_categories c join tournaments t on t.id = c.tournament_id
    where c.id = tournament_groups.category_id and c.status <> 'setup' and t.status <> 'setup'
  )
);
create policy public_read_tournament_courts on tournament_courts for select to anon using (
  exists (select 1 from tournaments t where t.id = tournament_courts.tournament_id and t.status <> 'setup')
);
create policy public_read_tournament_teams on tournament_teams for select to anon using (
  exists (
    select 1 from tournament_categories c join tournaments t on t.id = c.tournament_id
    where c.id = tournament_teams.category_id and c.status <> 'setup' and t.status <> 'setup'
  )
);
create policy public_read_tournament_matches on tournament_matches for select to anon using (
  exists (
    select 1 from tournament_categories c join tournaments t on t.id = c.tournament_id
    where c.id = tournament_matches.category_id and c.status <> 'setup' and t.status <> 'setup'
  )
);

-- ── Auto-sync from a category's linked session ──────────────────────────
-- Mirrors the old tournament-level trigger, scoped to a category: when a
-- category has session_id set, a confirmed doubles/singles registration on
-- that session gets a team the moment it's written, placed on whichever of
-- the category's groups currently has the fewest teams (ties broken by
-- group sort_order). Categories with team_size = 1 sync from players who
-- don't need a partner at all; team_size = 2 requires a partner_name.
create or replace function sync_team_for_player_in_category(p_category_id uuid, p_player_id bigint)
returns void as $$
declare
  v_category record;
  v_player record;
  v_group_id uuid;
  v_team_name text;
begin
  select id, team_size, session_id, status into v_category from tournament_categories where id = p_category_id;
  if v_category is null or v_category.session_id is null or v_category.status not in ('setup', 'registration_open', 'registration_closed', 'active') then
    return;
  end if;

  select id, name, partner_name, status, needs_partner into v_player from players where id = p_player_id;
  if v_player is null or v_player.status <> 'confirmed' then
    return;
  end if;
  if v_category.team_size = 2 and (v_player.needs_partner or v_player.partner_name is null or btrim(v_player.partner_name) = '') then
    return;
  end if;

  if exists (select 1 from tournament_teams where category_id = p_category_id and source_player_id = p_player_id) then
    return;
  end if;

  select g.id into v_group_id
  from tournament_groups g
  left join tournament_teams t on t.group_id = g.id
  where g.category_id = p_category_id
  group by g.id, g.sort_order
  order by count(t.id) asc, g.sort_order asc
  limit 1;

  v_team_name := case when v_category.team_size = 2 then v_player.name || ' & ' || v_player.partner_name else v_player.name end;

  insert into tournament_teams (category_id, group_id, name, player1_name, player2_name, source_player_id)
  values (p_category_id, v_group_id, v_team_name, v_player.name, case when v_category.team_size = 2 then v_player.partner_name else null end, p_player_id);
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function sync_tournament_team_from_player()
returns trigger as $$
declare
  v_category_id uuid;
begin
  for v_category_id in select id from tournament_categories where session_id = new.session_id loop
    perform sync_team_for_player_in_category(v_category_id, new.id);
  end loop;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create trigger players_sync_tournament_team
after insert or update on players
for each row execute function sync_tournament_team_from_player();
