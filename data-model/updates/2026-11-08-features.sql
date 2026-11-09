-- New features (8 Nov 2026): street address, link sites, pictures on screen.
-- Run once in the Supabase SQL Editor, after the earlier 2026-11-08 files.

-- 1. Street address on places (the admin form and the site read it from attr_fields)
insert into attr_fields (entity_type, key, label, input, when_kind, required, position, help)
values ('place', 'address', 'Street address', 'text', null, false, 3, 'e.g. Maxstraße 7, 67059 Ludwigshafen am Rhein')
on conflict (entity_type, key) do nothing;

-- 2. Websites for the link dropdown (Wikipedia first, so it is preselected)
create table if not exists link_sites (
  label      text primary key,
  url_prefix text check (url_prefix ~* '^https?://'),
  position   int not null unique
);
alter table link_sites enable row level security;
drop policy if exists public_read on link_sites;
drop policy if exists admin_write on link_sites;
create policy public_read on link_sites for select using (true);
create policy admin_write on link_sites for all using (is_admin()) with check (is_admin());
insert into link_sites (label, url_prefix, position) values
 ('Wikipedia',         'https://en.wikipedia.org/wiki/', 1),
 ('Arolsen Archives',  'https://collections.arolsen-archives.org/en/document/', 2),
 ('Joods Monument',    'https://www.joodsmonument.nl/', 3),
 ('Yad Vashem',        'https://collections.yadvashem.org/', 4),
 ('Wikimedia Commons', 'https://commons.wikimedia.org/wiki/', 5),
 ('Other',             null, 6)
on conflict (label) do nothing;

-- 3. Pictures on screen while Jonas speaks: tape -> photo/document, with a start AND end time
alter table relation_types add column if not exists needs_end boolean not null default false;
insert into relation_types (key, label, inverse_label, is_symmetric, subject_types, object_types, timed, description)
values ('illustrates', 'shows on screen', 'shown on screen in', false, '{tape}', '{photo,document}', true,
        'a picture shown over the video from the start time until the end time')
on conflict (key) do nothing;
update relation_types set needs_end = true where key = 'illustrates';

create or replace function check_relation() returns trigger
language plpgsql as $$
declare rt relation_types; st entity_type; ot entity_type; srct entity_type;
begin
  select * into rt from relation_types where key = new.predicate;
  select type into st from entities where id = new.subject_id;
  select type into ot from entities where id = new.object_id;
  if rt.subject_types is not null and not st = any(rt.subject_types) then
    raise exception '"%" can only start from: % (not a %)', rt.label, array_to_string(rt.subject_types, ', '), st;
  end if;
  if rt.object_types is not null and not ot = any(rt.object_types) then
    raise exception '"%" can only point to: % (not a %)', rt.label, array_to_string(rt.object_types, ', '), ot;
  end if;
  if rt.timed and new.start_sec is null then
    raise exception '"%" needs a time in the tape', rt.label;
  end if;
  if rt.needs_end and (new.end_sec is null or new.end_sec <= new.start_sec) then
    raise exception '"%" needs an end time after the start time', rt.label;
  end if;
  if new.start_sec is not null then
    select type into srct from entities
      where id = case when st = 'tape' then new.subject_id else new.source_id end;
    if srct is distinct from 'tape' then
      raise exception 'A time in the tape needs a tape: pick the tape as the source';
    end if;
  end if;
  return new;
end $$;

-- 4. The site also gets each picture's description and credit
create or replace function site_data() returns json
language sql stable security invoker set search_path = public as $$
select json_build_object(
  'generated', now(),
  'entity_types', to_json(array(select json_build_object('key', key, 'label', label, 'legend', legend_label, 'color', color)
                                from entity_types order by position)),
  'attr_fields', to_json(array(select json_build_object('type', entity_type, 'key', key, 'label', label, 'input', input)
                               from attr_fields order by entity_type, position)),
  'attr_options', to_json(array(select json_build_object('type', entity_type, 'field', attr_key, 'value', value,
                                'label', label, 'display', display) from attr_options order by entity_type, attr_key, position)),
  'relation_types', to_json(array(select json_build_object('key', key, 'label', label, 'inverse', inverse_label)
                                  from relation_types order by key)),
  'entities', to_json(array(select json_strip_nulls(json_build_object(
      'id', e.id, 'type', e.type, 'slug', e.slug, 'name', e.name, 'summary', e.summary, 'body', e.body, 'date_text', e.date_text,
      'date_from', e.date_from, 'lat', e.lat, 'lng', e.lng, 'precision', e.coord_precision,
      'attrs', e.attrs, 'certainty', e.certainty, 'status', e.status,
      'file', (select json_build_object('path', m.storage_path, 'mime', m.mime_type, 'name', m.original_filename)
               from media m where m.id = e.original_file_id)))
    from entities e order by e.name)),
  'relations', to_json(array(select json_strip_nulls(json_build_object(
      's', r.subject_id, 'p', r.predicate, 'o', r.object_id, 'role', r.role, 'order', r.sort_order,
      'date_text', r.date_text, 'src', src.id, 't0', r.start_sec, 't1', r.end_sec,
      'note', r.note, 'certainty', r.certainty, 'status', r.status))
    from relations r
    join entities s on s.id = r.subject_id
    join entities o on o.id = r.object_id
    left join entities src on src.id = r.source_id)),
  'tapes', to_json(array(select json_build_object(
      'id', e.id, 'number', (e.attrs->>'number')::int, 'name', e.name,
      'youtube_id', e.attrs->>'youtube_id', 'duration', (e.attrs->>'duration_sec')::numeric,
      'cues', to_json(array(select json_build_array(c.start_sec, c.end_sec, c.text)
                            from cues c where c.tape_id = e.id and c.lang = 'en' order by c.seq)))
    from entities e where e.type = 'tape' order by (e.attrs->>'number')::int)),
  'pages', to_json(array(select json_strip_nulls(json_build_object(
      'entity', p.entity_id, 'position', p.position, 'label', p.label,
      'path', m.storage_path, 'mime', m.mime_type, 'w', m.width_px, 'h', m.height_px, 'alt', m.alt_text, 'credit', m.credit,
      'transcription', p.transcription, 'translation', p.translation_en,
      'certainty', p.transcription_certainty,
      'fields', to_json(array(select json_build_object(
          'label', f.label_en, 'label_original', f.label_original, 'value', f.value_en, 'value_original', f.value_original,
          'refers_to', f.refers_to,
          'box', case when f.box_x is null then null else json_build_array(f.box_x, f.box_y, f.box_w, f.box_h) end)
        from page_fields f where f.page_id = p.id order by f.box_y nulls last, f.box_x))))
    from entity_pages p
    join entities e on e.id = p.entity_id
    join media m on m.id = p.image_id
    order by p.entity_id, p.position))
);
$$;
grant execute on function site_data() to anon, authenticated;

-- 5. First picture: the oorijzers photo while Jonas talks about them (tape 1, 10:00 to 10:15).
--    Needs 2026-11-08-oorijzers-photo.sql to have run first; change the times in the admin if you like.
insert into relations (subject_id, predicate, object_id, start_sec, end_sec, note, certainty, status, origin)
select t.id, 'illustrates', p.id, 600.5, 615, 'Zeeland ear irons, as Jonas describes them', 'confirmed', p.status, 'picture:oorijzers'
from entities t, entities p
where t.slug = 'tape-1' and p.slug = 'oorijzers-zeeland-photo'
  and not exists (select 1 from relations r where r.predicate = 'illustrates' and r.subject_id = t.id and r.object_id = p.id);
