-- Documents (8 Nov 2026). Run once in the Supabase SQL Editor, AFTER 2026-11-08-scans.sql.
-- 1. A document can keep the file as it came from the archive (e.g. the PDF), next to its page images.
alter table entities add column original_file_id uuid references media(id) on delete set null;

-- 2. New kind of document
update attr_options set position = 6 where entity_type = 'document' and attr_key = 'kind' and value = 'other';
insert into attr_options (entity_type, attr_key, value, label, position, display)
values ('document', 'kind', 'list', 'List or register', 5, '{}');

-- 3. The public site also gets the field labels (attr_fields), each item's longer text (body), each page's hover labels (page_fields) and image size, and the original file.
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
      'path', m.storage_path, 'mime', m.mime_type, 'w', m.width_px, 'h', m.height_px,
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
