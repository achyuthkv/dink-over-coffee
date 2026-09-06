-- Removes the session auto-sync feature entirely: tournament registration
-- is category-based only now (public self-registration, admin bulk CSV
-- import, or adding a team by hand) -- there's no reason for a category to
-- reference a `sessions` row at all, and the trigger that auto-created
-- teams from a linked session's registrations goes with it.

drop trigger if exists players_sync_tournament_team on players;
drop function if exists sync_tournament_team_from_player();
drop function if exists sync_team_for_player_in_category(uuid, bigint);

alter table tournament_categories drop column if exists session_id;
alter table tournament_teams drop column if exists source_player_id;
