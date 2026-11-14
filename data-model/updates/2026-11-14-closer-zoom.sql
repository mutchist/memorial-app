-- Watch map: zoom in closer on streets, buildings and stations (map zoom per kind of place).
-- Safe to run twice.
update attr_options set display = jsonb_set(display, '{zoom}', '16')
 where entity_type = 'place' and attr_key = 'kind' and value in ('address', 'other');
update attr_options set display = jsonb_set(display, '{zoom}', '14')
 where entity_type = 'place' and attr_key = 'kind' and value = 'station';
