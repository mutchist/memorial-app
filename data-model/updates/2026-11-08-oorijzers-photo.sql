-- Photo of Zeeland ear irons (oorijzers), 8 Nov 2026. Run once in the Supabase SQL Editor.
-- Then upload the file with the admin's "Scan files" tool: choose
--   upload/WLANL_-_Lumperjack_-_Oorijzers,_zilver,_goud_en_verguld,_periode_1830-1870.jpg
-- It is stored as scans/oorijzers-zeeland-photo_01-photo.jpg (naming convention).
insert into entities (type, slug, name, summary, date_text, certainty, status)
select 'photo', 'oorijzers-zeeland-photo', 'Ear irons (oorijzers), 1830–1870',
       'Silver, gold and gilt ear irons from Zeeland traditional dress, 1830–1870. Photo: Jim van der Mee, CC BY-SA 2.0, via Wikimedia Commons.',
       '1830–1870', 'confirmed', t.status
from entities t where t.slug = 'ear-irons-oorijzers'
on conflict (slug) do nothing;

insert into media (storage_path, mime_type, width_px, height_px, alt_text, credit, original_filename)
values ('scans/oorijzers-zeeland-photo_01-photo.jpg', 'image/jpeg', 1024, 682,
        'Pair of silver and gold ear irons (oorijzers) from Zeeland',
        'Jim van der Mee from Netherlands, CC BY-SA 2.0 (https://creativecommons.org/licenses/by-sa/2.0/), via Wikimedia Commons',
        'WLANL_-_Lumperjack_-_Oorijzers,_zilver,_goud_en_verguld,_periode_1830-1870.jpg')
on conflict (storage_path) do nothing;

insert into entity_pages (entity_id, position, label, image_id, transcription_certainty)
select e.id, 1, 'Photo', m.id, 'confirmed'
from entities e, media m
where e.slug = 'oorijzers-zeeland-photo' and m.storage_path = 'scans/oorijzers-zeeland-photo_01-photo.jpg'
  and not exists (select 1 from entity_pages p where p.entity_id = e.id);

insert into relations (subject_id, predicate, object_id, certainty, status, origin)
select p.id, 'depicts', t.id, 'confirmed', p.status, 'photo:oorijzers'
from entities p, entities t
where p.slug = 'oorijzers-zeeland-photo' and t.slug = 'ear-irons-oorijzers'
  and not exists (select 1 from relations r where r.predicate = 'depicts' and r.subject_id = p.id and r.object_id = t.id);

insert into links (entity_id, label, url, position)
select e.id, 'Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:WLANL_-_Lumperjack_-_Oorijzers,_zilver,_goud_en_verguld,_periode_1830-1870.jpg', 0
from entities e where e.slug = 'oorijzers-zeeland-photo'
  and not exists (select 1 from links l where l.entity_id = e.id);
