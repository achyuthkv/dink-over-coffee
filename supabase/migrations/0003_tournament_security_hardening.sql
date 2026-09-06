-- Follow-up hardening flagged by the Supabase security advisor after
-- 0001_tournament_categories.sql / 0002_referee_role.sql:
--
-- 1. is_organizer()/is_referee() lacked `set search_path`, unlike the sync
--    functions -- fixed here (defends against search_path hijacking in a
--    security-relevant function, even though these two never touch a table).
-- 2. sync_team_for_player_in_category() never verified the player actually
--    belongs to the category's linked session -- it only checked
--    status/partner, relying entirely on its caller (the trigger) having
--    already filtered by session_id. Direct RPC callers bypass that. Adds
--    the check inside the function itself as well.
-- 3. Both sync functions are SECURITY DEFINER and, by default, callable
--    directly via PostgREST RPC by anon/authenticated -- not needed, since
--    they're only meant to run from the AFTER INSERT/UPDATE trigger on
--    players (which doesn't require the triggering role to hold EXECUTE on
--    the trigger function). The default EXECUTE grant is to the `public`
--    pseudo-role (which anon/authenticated inherit from), so revoking it
--    from those two roles specifically is a no-op -- it has to be revoked
--    from `public` itself.

create or replace function is_organizer()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

create or replace function is_referee()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'referee', false);
$$;

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

  select id, name, partner_name, status, needs_partner, session_id into v_player from players where id = p_player_id;
  if v_player is null or v_player.status <> 'confirmed' or v_player.session_id is distinct from v_category.session_id then
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

revoke execute on function sync_team_for_player_in_category(uuid, bigint) from public;
revoke execute on function sync_tournament_team_from_player() from public;
