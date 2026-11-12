-- 2026-11-12: story dates. Run once in the Supabase SQL Editor (safe to run twice).
-- You set "where in Jonas's life the tape is" per stretch of tape in the admin (Tape moments, "Story date").
-- The Watch page shows it on the map and on the year strip.
create table if not exists story_dates (
  id         uuid primary key default gen_random_uuid(),
  tape_id    uuid not null references entities(id) on delete cascade,
  start_sec  numeric(8,3) not null check (start_sec >= 0),
  date_text  text not null check (date_text <> ''),
  date_from  date not null,
  note       text,
  unique (tape_id, start_sec)
);
drop trigger if exists history on story_dates;
create trigger history after insert or update or delete on story_dates for each row execute function log_revision('id');
alter table story_dates enable row level security;
drop policy if exists public_read on story_dates;
drop policy if exists admin_write on story_dates;
create policy public_read on story_dates for select using (true);
create policy admin_write on story_dates for all using (is_admin()) with check (is_admin());
grant select on story_dates to anon;
grant all on story_dates to authenticated;

-- the site gets the story dates with each tape
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
      'note', r.note, 'certainty', r.certainty, 'status', r.status, 'watch', r.on_watch))
    from relations r
    join entities s on s.id = r.subject_id
    join entities o on o.id = r.object_id
    left join entities src on src.id = r.source_id)),
  'tapes', to_json(array(select json_build_object(
      'id', e.id, 'number', (e.attrs->>'number')::int, 'name', e.name,
      'youtube_id', e.attrs->>'youtube_id', 'duration', (e.attrs->>'duration_sec')::numeric,
      'cues', to_json(array(select json_build_array(c.start_sec, c.end_sec, c.text)
                            from cues c where c.tape_id = e.id and c.lang = 'en' order by c.seq)),
      'story_dates', to_json(array(select json_build_object('t', d.start_sec, 'text', d.date_text, 'from', d.date_from)
                            from story_dates d where d.tape_id = e.id order by d.start_sec)))
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
