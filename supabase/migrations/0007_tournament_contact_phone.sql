-- A per-tournament contact number, shown on the public registration form
-- for players who run into issues -- editable per event from /admin instead
-- of being a single site-wide number.
alter table tournaments add column if not exists contact_phone text;
