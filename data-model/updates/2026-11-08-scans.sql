-- Scans (8 Nov 2026). Run once in the Supabase SQL Editor.
-- 1. Storage for scan files
insert into storage.buckets (id, name, public) values ('scans', 'scans', true)
  on conflict (id) do nothing;

create policy "admins add scans" on storage.objects for insert to authenticated
  with check (bucket_id = 'scans' and public.is_admin());
create policy "admins replace scans" on storage.objects for update to authenticated
  using (bucket_id = 'scans' and public.is_admin());
create policy "admins delete scans" on storage.objects for delete to authenticated
  using (bucket_id = 'scans' and public.is_admin());
create policy "admins list scans" on storage.objects for select to authenticated
  using (bucket_id = 'scans' and public.is_admin());

-- 2. Which types have scan pages
alter table entity_types add column has_pages boolean not null default false;
update entity_types set has_pages = true where key in ('document', 'photo');
alter table entity_types alter column has_pages drop default;

-- 3. The public site also gets each document's scan pages
create or replace function site_data() returns json
language sql stable security invoker set search_path = public as $$
select json_build_object(
  'generated', now(),
  'entity_types', to_json(array(select json_build_object('key', key, 'label', label, 'legend', legend_label, 'color', color)
                                from entity_types order by position)),
  'attr_options', to_json(array(select json_build_object('type', entity_type, 'field', attr_key, 'value', value,
                                'label', label, 'display', display) from attr_options order by entity_type, attr_key, position)),
  'relation_types', to_json(array(select json_build_object('key', key, 'label', label, 'inverse', inverse_label)
                                  from relation_types order by key)),
  'entities', to_json(array(select json_strip_nulls(json_build_object(
      'id', id, 'type', type, 'slug', slug, 'name', name, 'summary', summary, 'date_text', date_text,
      'date_from', date_from, 'lat', lat, 'lng', lng, 'precision', coord_precision,
      'attrs', attrs, 'certainty', certainty, 'status', status)) from entities order by name)),
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
      'path', m.storage_path, 'mime', m.mime_type,
      'transcription', p.transcription, 'translation', p.translation_en,
      'certainty', p.transcription_certainty))
    from entity_pages p
    join entities e on e.id = p.entity_id
    join media m on m.id = p.image_id
    order by p.entity_id, p.position))
);
$$;
