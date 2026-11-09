-- 2026-11-09: new kind of place "Neighbourhood" (e.g. the Jewish quarter of Amsterdam).
-- On the map it is a pin like any place; when it comes up the map zooms to 14,
-- close enough to see the whole quarter (addresses and stations use 12.5).
-- Safe to run twice: does nothing if the kind is already there.
update attr_options set position = position + 1
 where entity_type = 'place' and attr_key = 'kind' and position >= 2
   and not exists (select 1 from attr_options where entity_type = 'place' and attr_key = 'kind' and value = 'neighbourhood');
insert into attr_options (entity_type, attr_key, value, label, position, display)
values ('place', 'kind', 'neighbourhood', 'Neighbourhood', 2, '{"zoom": 14, "show_kind": true}')
on conflict (entity_type, attr_key, value) do nothing;
select value, label, position, display from attr_options where entity_type = 'place' and attr_key = 'kind' order by position;
