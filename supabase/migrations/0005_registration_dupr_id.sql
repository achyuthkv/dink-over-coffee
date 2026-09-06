-- DUPR ID is now required at registration time (both the public form and
-- admin bulk import), so it's captured alongside the rest of a
-- registration's contact details -- same table, same organizer-only RLS,
-- since it's collected data about a real person like phone/email.
alter table tournament_registrations add column if not exists dupr_id text;
alter table tournament_registrations add column if not exists partner_dupr_id text;
