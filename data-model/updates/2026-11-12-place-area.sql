-- 2026-11-12: places can have an outline (e.g. the Jewish quarter of Amsterdam).
-- Stored as GeoJSON (Polygon or MultiPolygon) in attrs.area. In the admin, the field has
-- "Import from a KML file…"; on the Watch page the outline shows on the map while the place is mentioned.
-- Safe to run twice.
insert into attr_fields (entity_type, key, label, input, when_kind, required, position, help)
values ('place', 'area', 'Area outline', 'geojson', null, false, 4, 'For a neighbourhood or other area. Use "Import from a KML file…" below.')
on conflict (entity_type, key) do nothing;
select entity_type, key, label, input, position from attr_fields where entity_type = 'place' order by position;
