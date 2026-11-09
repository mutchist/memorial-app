-- Your answers from review-2026-11-08.csv, round 1 (8 Nov 2026).
-- Run once in the Supabase SQL Editor, after 2026-11-08-rosa-example.sql and 2026-11-08-review.sql.
-- Safe to run twice: every step checks before it adds.

-- 1. Everything you answered yes: confirmed
update entities set certainty = 'confirmed' where slug = 'abel-herzberg';   -- R001 Abel Herzberg
update entities set certainty = 'confirmed' where slug = 'augusta-stemmer-better';   -- R002 Augusta Stemmer-Better
update entities set certainty = 'confirmed' where slug = 'berent-bekker';   -- R004 Berent Bekker
update entities set certainty = 'confirmed' where slug = 'bernard-de-leeuw';   -- R005 Bernard de Leeuw
update entities set certainty = 'confirmed' where slug = 'david-loeb-stemmer';   -- R007 David Loeb Stemmer
update entities set certainty = 'confirmed' where slug = 'dora-stemmer';   -- R008 Dora Stemmer
update entities set certainty = 'confirmed' where slug = 'franz-fischer';   -- R009 Franz Fischer
update entities set certainty = 'confirmed' where slug = 'helena-berglas';   -- R010 Helena Berglas
update entities set certainty = 'confirmed' where slug = 'klaus-barbie';   -- R011 Klaus Barbie
update entities set certainty = 'confirmed' where slug = 'malke-berglas';   -- R012 Malke Berglas
update entities set certainty = 'confirmed' where slug = 'marek-radler';   -- R013 Marek Radler
update entities set certainty = 'confirmed' where slug = 'miriam-konig-stemmer';   -- R014 Miriam Konig Stemmer
update entities set certainty = 'confirmed' where slug = 'mordechai-marcus-stemmer';   -- R015 Mordechai (Marcus) Stemmer
update entities set certainty = 'confirmed' where slug = 'moshe-zecharya-warhaftig';   -- R016 Moshe Zecharya Warhaftig
update entities set certainty = 'confirmed' where slug = 'mr-hartog';   -- R017 Mr. Hartog
update entities set certainty = 'confirmed' where slug = 'peter-engelsman';   -- R018 Peter Engelsman
update entities set certainty = 'confirmed' where slug = 'professor-shamir';   -- R020 Professor Shamir
update entities set certainty = 'confirmed' where slug = 'rachelle-radler';   -- R021 Rachelle Radler
update entities set certainty = 'confirmed' where slug = 'sally-noach';   -- R022 Sally Noach
update entities set certainty = 'confirmed' where slug = 'salomon-stemmer';   -- R023 Salomon Stemmer
update entities set certainty = 'confirmed' where slug = 'sara-hana-radler';   -- R024 Sara Hana Radler
update entities set certainty = 'confirmed' where slug = 'second-son-of-jonas';   -- R025 Second son of Jonas
update relations set certainty = 'confirmed' where predicate = 'born_in' and subject_id = (select id from entities where slug = 'david-loeb-stemmer') and object_id = (select id from entities where slug = 'oswiecim-auschwitz');   -- R028 David Loeb Stemmer born in Oświęcim (Auschwitz)
update relations set certainty = 'confirmed' where predicate = 'deported_to' and subject_id = (select id from entities where slug = 'david-loeb-stemmer') and object_id = (select id from entities where slug = 'sobibor');   -- R029 David Loeb Stemmer deported to Sobibor
update relations set certainty = 'confirmed' where predicate = 'spouse_of' and subject_id = (select id from entities where slug = 'david-loeb-stemmer') and object_id = (select id from entities where slug = 'miriam-konig-stemmer');   -- R030 David Loeb Stemmer married to Miriam Konig Stemmer
update relations set certainty = 'confirmed' where predicate = 'about' and subject_id = (select id from entities where slug = 'david-stemmer-card') and object_id = (select id from entities where slug = 'david-loeb-stemmer');   -- R031 David Stemmer, card about David Loeb Stemmer
update relations set certainty = 'confirmed' where predicate = 'about' and subject_id = (select id from entities where slug = 'david-stemmer-second-card') and object_id = (select id from entities where slug = 'david-loeb-stemmer');   -- R032 David Stemmer, second card about David Loeb Stemmer
update relations set certainty = 'confirmed' where predicate = 'interned_at' and subject_id = (select id from entities where slug = 'kern-family-dora-s-cousins') and object_id = (select id from entities where slug = 'venissieux-camp-indochinese-barracks-near-lyon');   -- R033 Kern family (Dora's cousins) interned at Vénissieux camp (Indochinese barracks), near Lyon
update relations set certainty = 'confirmed' where predicate = 'deported_to' and subject_id = (select id from entities where slug = 'rosa-stemmer') and object_id = (select id from entities where slug = 'sobibor');   -- R034 Rosa Stemmer deported to Sobibor
update entities set certainty = 'confirmed' where slug = 'david-stemmer-card';   -- R035 David Stemmer, card
update entities set certainty = 'confirmed' where slug = 'david-stemmer-second-card';   -- R036 David Stemmer, second card
update entities set certainty = 'confirmed' where slug = 'displaced-person-registration-papers';   -- R037 Displaced person registration papers
update entities set certainty = 'confirmed' where slug = 'family-photo-with-marcus-s-family';   -- R038 Family photo with Marcus's family
update entities set certainty = 'confirmed' where slug = 'identity-card-from-the-dutch-consulate-in-bern';   -- R039 Identity card from the Dutch consulate in Bern
update entities set certainty = 'confirmed' where slug = 'letters-from-the-geneva-hospital';   -- R040 Letters from the Geneva hospital
update entities set certainty = 'confirmed' where slug = 'office-neerlandais-pass';   -- R041 Office Néerlandais pass
update entities set certainty = 'confirmed' where slug = 'personal-identity-card-persoonsbewijs-with-j';   -- R042 Personal identity card (persoonsbewijs) with "J"
update entities set certainty = 'confirmed' where slug = 'photo-of-david-loeb-stemmer-c-193536';   -- R043 Photo of David Loeb Stemmer, c. 1935–36
update entities set certainty = 'confirmed' where slug = 'photo-of-david-loeb-and-augusta-stemmer';   -- R044 Photo of David Loeb and Augusta Stemmer
update entities set certainty = 'confirmed' where slug = 'photo-of-le-chaluet';   -- R045 Photo of Le Chaluet
update entities set certainty = 'confirmed' where slug = 'photo-of-marcus-stemmer';   -- R046 Photo of Marcus Stemmer
update entities set certainty = 'confirmed' where slug = 'receipt-for-confiscated-money';   -- R047 Receipt for confiscated money
update entities set certainty = 'confirmed' where slug = 'swiss-refugee-pass';   -- R048 Swiss refugee pass
update entities set certainty = 'confirmed' where slug = 'telegram-from-salomon-in-chile';   -- R049 Telegram from Salomon in Chile
update entities set certainty = 'confirmed' where slug = 'travel-permit-sauf-conduit';   -- R050 Travel permit (sauf-conduit)
update entities set certainty = 'confirmed' where slug = 'hilfspolizei';   -- R054 Hilfspolizei
update entities set certainty = 'confirmed' where slug = 'ig-farben';   -- R055 IG Farben
update entities set certainty = 'confirmed' where slug = 'kern-family-dora-s-cousins';   -- R058 Kern family (Dora's cousins)
update entities set certainty = 'confirmed' where slug = 'siblings-of-jonas';   -- R063 Siblings of Jonas
update entities set certainty = 'confirmed' where slug = 'twin-brothers-from-brussels';   -- R065 Twin brothers from Brussels
update entities set certainty = 'confirmed' where slug = 'jonas-s-birth';   -- R069 Jonas's birth
update relations set note = null where predicate = 'about' and object_id = (select id from entities where slug = 'david-loeb-stemmer') and note = 'Matched by name only';
update relations set certainty = 'confirmed' where predicate = 'about' and object_id in ((select id from entities where slug = 'helena-berglas'), (select id from entities where slug = 'malke-berglas'), (select id from entities where slug = 'marek-radler'), (select id from entities where slug = 'rachelle-radler'), (select id from entities where slug = 'sara-hana-radler'));

-- 2. Names of Jonas's sons (R027, R025). The old description stays as another name, so search still finds them.
update entities set name = 'Mosche Israel Stemmer', slug = 'mosche-israel-stemmer', other_names = array['Son of Jonas'],
  summary = 'Jonas and Dora''s first son, born 15 July 1941', certainty = 'confirmed' where slug = 'son-of-jonas';
update entities set name = 'Simon Stemmer', slug = 'simon-stemmer', other_names = array['Second son of Jonas'],
  summary = 'Jonas and Dora''s second son, born 29 May 1945 in Montreux', certainty = 'confirmed' where slug = 'second-son-of-jonas';
-- the seed had Jonas as father of each son twice: keep one of each
delete from relations r using relations r2
 where r.predicate = 'parent_of' and r2.predicate = 'parent_of' and r.subject_id = r2.subject_id and r.object_id = r2.object_id
   and r.subject_id = (select id from entities where slug = 'jonas-stemmer') and r.id > r2.id;

-- 3. Who is who (your notes)
update entities set summary = 'Jonas''s mother. Collected watches and clocks in the villages (named on tape 4 at 21:32)' where slug = 'augusta-stemmer-better';
update entities set summary = 'Jonas''s father. Watch and gold/silver dealer (named on tape 4 at 21:25)' where slug = 'david-loeb-stemmer';
update entities set summary = 'Jonas''s wife. They met in Scheveningen (named on tape 2 at 0:51)' where slug = 'dora-stemmer';
update entities set summary = 'Jonas''s stepmother, David Loeb Stemmer''s second wife' where slug = 'miriam-konig-stemmer';
update entities set summary = 'Jonas''s brother, the second son, born 1906 in Ludwigshafen' where slug = 'mordechai-marcus-stemmer';
update entities set summary = 'Jonas''s eldest brother, born 1901 (named at 9:22)' where slug = 'salomon-stemmer';
update entities set summary = 'Jonas''s business partner. Rotterdam clothing manufacturer who made Jonas manager in The Hague' where slug = 'mr-hartog';
update entities set summary = 'Son of Jonas''s brother Mordechai (Marcus), later a professor in Jerusalem' where slug = 'professor-shamir';
update entities set summary = 'Dora''s mother, Jonas''s mother-in-law' where slug = 'helena-berglas';
update entities set summary = 'Dora''s father' where slug = 'marek-radler';
update entities set summary = 'Dora''s sister' where slug in ('malke-berglas', 'rachelle-radler', 'sara-hana-radler');

insert into relations (subject_id, predicate, object_id, role, certainty, status, origin)
select (select id from entities where slug = 'helena-berglas'), 'parent_of', (select id from entities where slug = 'dora-stemmer'), 'mother', 'confirmed', (select status from entities where slug = 'helena-berglas'), 'review:2026-11-08'
where not exists (select 1 from relations where predicate = 'parent_of' and ((subject_id = (select id from entities where slug = 'helena-berglas') and object_id = (select id from entities where slug = 'dora-stemmer')) or (subject_id = (select id from entities where slug = 'dora-stemmer') and object_id = (select id from entities where slug = 'helena-berglas') and 'parent_of' <> 'parent_of')));
insert into relations (subject_id, predicate, object_id, role, certainty, status, origin)
select (select id from entities where slug = 'marek-radler'), 'parent_of', (select id from entities where slug = 'dora-stemmer'), 'father', 'confirmed', (select status from entities where slug = 'marek-radler'), 'review:2026-11-08'
where not exists (select 1 from relations where predicate = 'parent_of' and ((subject_id = (select id from entities where slug = 'marek-radler') and object_id = (select id from entities where slug = 'dora-stemmer')) or (subject_id = (select id from entities where slug = 'dora-stemmer') and object_id = (select id from entities where slug = 'marek-radler') and 'parent_of' <> 'parent_of')));
insert into relations (subject_id, predicate, object_id, role, certainty, status, origin)
select (select id from entities where slug = 'malke-berglas'), 'sibling_of', (select id from entities where slug = 'dora-stemmer'), 'sister', 'confirmed', (select status from entities where slug = 'malke-berglas'), 'review:2026-11-08'
where not exists (select 1 from relations where predicate = 'sibling_of' and ((subject_id = (select id from entities where slug = 'malke-berglas') and object_id = (select id from entities where slug = 'dora-stemmer')) or (subject_id = (select id from entities where slug = 'dora-stemmer') and object_id = (select id from entities where slug = 'malke-berglas') and 'sibling_of' <> 'parent_of')));
insert into relations (subject_id, predicate, object_id, role, certainty, status, origin)
select (select id from entities where slug = 'rachelle-radler'), 'sibling_of', (select id from entities where slug = 'dora-stemmer'), 'sister', 'confirmed', (select status from entities where slug = 'rachelle-radler'), 'review:2026-11-08'
where not exists (select 1 from relations where predicate = 'sibling_of' and ((subject_id = (select id from entities where slug = 'rachelle-radler') and object_id = (select id from entities where slug = 'dora-stemmer')) or (subject_id = (select id from entities where slug = 'dora-stemmer') and object_id = (select id from entities where slug = 'rachelle-radler') and 'sibling_of' <> 'parent_of')));
insert into relations (subject_id, predicate, object_id, role, certainty, status, origin)
select (select id from entities where slug = 'sara-hana-radler'), 'sibling_of', (select id from entities where slug = 'dora-stemmer'), 'sister', 'confirmed', (select status from entities where slug = 'sara-hana-radler'), 'review:2026-11-08'
where not exists (select 1 from relations where predicate = 'sibling_of' and ((subject_id = (select id from entities where slug = 'sara-hana-radler') and object_id = (select id from entities where slug = 'dora-stemmer')) or (subject_id = (select id from entities where slug = 'dora-stemmer') and object_id = (select id from entities where slug = 'sara-hana-radler') and 'sibling_of' <> 'parent_of')));
insert into relations (subject_id, predicate, object_id, role, certainty, status, origin)
select (select id from entities where slug = 'mordechai-marcus-stemmer'), 'parent_of', (select id from entities where slug = 'professor-shamir'), 'father', 'confirmed', (select status from entities where slug = 'mordechai-marcus-stemmer'), 'review:2026-11-08'
where not exists (select 1 from relations where predicate = 'parent_of' and ((subject_id = (select id from entities where slug = 'mordechai-marcus-stemmer') and object_id = (select id from entities where slug = 'professor-shamir')) or (subject_id = (select id from entities where slug = 'professor-shamir') and object_id = (select id from entities where slug = 'mordechai-marcus-stemmer') and 'parent_of' <> 'parent_of')));

-- 4. Chaskel Radler (R006): "remove, this is another project". Removes him and his check (its two scan entries).
--    The files stay in storage; the history table keeps a copy of the removed rows.
delete from entities where slug = 'chaskel-radler-check';
delete from entities where slug = 'chaskel-radler';
delete from media where storage_path in ('scans/radler-chaskel-check.pdf', 'scans/radler-chaskel-check-2.pdf')
  and not exists (select 1 from entity_pages p where p.image_id = media.id);

