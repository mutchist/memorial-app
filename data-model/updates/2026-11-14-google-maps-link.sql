-- Adds "Google Maps" to the websites offered when adding a link, just before "Other".
-- Safe to run twice.
begin;
update link_sites set position = 7 where label = 'Other' and position = 6;
insert into link_sites (label, url_prefix, position)
values ('Google Maps', 'https://www.google.com/maps/', 6)
on conflict (label) do nothing;
commit;
