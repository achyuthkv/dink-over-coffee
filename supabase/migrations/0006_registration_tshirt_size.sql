-- T-shirt size is now collected for every player at registration time (same
-- as DUPR ID), so it's captured alongside the rest of a registration's
-- contact details on the same table with the same organizer-only RLS.
alter table tournament_registrations add column if not exists tshirt_size text;
alter table tournament_registrations add column if not exists partner_tshirt_size text;
