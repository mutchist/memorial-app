begin;
insert into relations (subject_id, predicate, object_id, role, sort_order, date_text, date_from, date_to, source_id, start_sec, end_sec, note, certainty, origin) values ((select id from entities where slug = 'westerbork-card-malke-berglas'), 'about', (select id from entities where slug = 'malke-berglas'), 'holder', null, null, null, null, null, null, null, null, 'confirmed'::certainty, 'batch:facts');
insert into relations (subject_id, predicate, object_id, role, sort_order, date_text, date_from, date_to, source_id, start_sec, end_sec, note, certainty, origin) values ((select id from entities where slug = 'marek-radler-card'), 'about', (select id from entities where slug = 'marek-radler'), 'holder', null, null, null, null, null, null, null, null, 'confirmed'::certainty, 'batch:facts');
insert into relations (subject_id, predicate, object_id, role, sort_order, date_text, date_from, date_to, source_id, start_sec, end_sec, note, certainty, origin) values ((select id from entities where slug = 'rachelle-radler-card'), 'about', (select id from entities where slug = 'rachelle-radler'), 'holder', null, null, null, null, null, null, null, null, 'confirmed'::certainty, 'batch:facts');
insert into relations (subject_id, predicate, object_id, role, sort_order, date_text, date_from, date_to, source_id, start_sec, end_sec, note, certainty, origin) values ((select id from entities where slug = 'chaskel-radler-check'), 'about', (select id from entities where slug = 'chaskel-radler'), 'holder', null, null, null, null, null, null, null, null, 'confirmed'::certainty, 'batch:facts');
insert into relations (subject_id, predicate, object_id, role, sort_order, date_text, date_from, date_to, source_id, start_sec, end_sec, note, certainty, origin) values ((select id from entities where slug = 'rosa-stemmer-card'), 'about', (select id from entities where slug = 'rosa-stemmer'), 'holder', null, null, null, null, null, null, null, 'Matched by name only', 'probable'::certainty, 'batch:facts');
insert into relations (subject_id, predicate, object_id, role, sort_order, date_text, date_from, date_to, source_id, start_sec, end_sec, note, certainty, origin) values ((select id from entities where slug = 'sara-hana-radler-card'), 'about', (select id from entities where slug = 'sara-hana-radler'), 'holder', null, null, null, null, null, null, null, null, 'confirmed'::certainty, 'batch:facts');
insert into media (storage_path, mime_type, original_filename) values
  ('scans/2721ca3fcb56dbb89e53a4435e2af019.jpg', 'image/jpeg', '2721ca3fcb56dbb89e53a4435e2af019.jpg'),
  ('scans/31-494-0-1-156-9558596.jpg', 'image/jpeg', '31_494_0_1_156_9558596.jpg'),
  ('scans/33-276-0-14-9572231.jpg', 'image/jpeg', '33_276_0_-_14_9572231.jpg'),
  ('scans/33-276-0-158-62788821.jpg', 'image/jpeg', '33_276_0_-_158_62788821.jpg'),
  ('scans/david-stemmer-2.pdf', 'application/pdf', 'david stemmer 2.pdf'),
  ('scans/david-stemmer-3.pdf', 'application/pdf', 'david stemmer 3.pdf'),
  ('scans/david-stemmer-4.pdf', 'application/pdf', 'david stemmer 4.pdf'),
  ('scans/david-stemmer-5.pdf', 'application/pdf', 'david stemmer 5.pdf'),
  ('scans/david-stemmer-other-card-1.pdf', 'application/pdf', 'david stemmer other card 1.pdf'),
  ('scans/david-stemmer-other-card-2.pdf', 'application/pdf', 'david stemmer other card 2.pdf'),
  ('scans/david-stemmer-other-card-3.pdf', 'application/pdf', 'david stemmer other card 3.pdf'),
  ('scans/david-stemmer.pdf', 'application/pdf', 'david stemmer.pdf'),
  ('scans/helena-berglas-concentration.pdf', 'application/pdf', 'helena berglas concentration.pdf'),
  ('scans/helena-berglas-westerbork-back.pdf', 'application/pdf', 'helena berglas westerbork back.pdf'),
  ('scans/helena-berglas-westerbork-back2.pdf', 'application/pdf', 'helena berglas westerbork back2.pdf'),
  ('scans/helena-berglas-westerbork-second-copy.pdf', 'application/pdf', 'helena berglas westerbork second copy.pdf'),
  ('scans/malke-berglas-westerbork-back.pdf', 'application/pdf', 'malke berglas westerbork back.pdf'),
  ('scans/malke-berglas-westerbork.pdf', 'application/pdf', 'malke berglas westerbork.pdf'),
  ('scans/marek-radler.pdf', 'application/pdf', 'marek radler.pdf'),
  ('scans/mlr-austor-hungarian.jpg', 'image/jpeg', 'MLR austor hungarian.jpg'),
  ('scans/mrek-radler.pdf', 'application/pdf', 'mrek radler.pdf'),
  ('scans/nl-hahga-0335-01-1665-2307-30.jpg', 'image/jpeg', 'NL-HaHGA_0335-01_1665_2307.30.jpg'),
  ('scans/nl-hahga-0335-01-1708-2443-39.jpg', 'image/jpeg', 'NL-HaHGA_0335-01_1708_2443.39.jpg'),
  ('scans/nl-hahga-0354-01-128-0124.jpg', 'image/jpeg', 'NL-HaHGA_0354-01_128_0124.jpg'),
  ('scans/nl-hahga-0354-01-1410-0169.jpg', 'image/jpeg', 'NL-HaHGA_0354-01_1410_0169.jpg'),
  ('scans/nl-hahga-0354-01-3104-0036.jpg', 'image/jpeg', 'NL-HaHGA_0354-01_3104_0036.jpg'),
  ('scans/rachelle-radler.pdf', 'application/pdf', 'rachelle radler.pdf'),
  ('scans/radler-chaskel-check-2.pdf', 'application/pdf', 'radler chaskel check 2.pdf'),
  ('scans/radler-chaskel-check.pdf', 'application/pdf', 'radler chaskel check.pdf'),
  ('scans/rosa-stemmer.pdf', 'application/pdf', 'rosa stemmer.pdf'),
  ('scans/sara-hana-cc.pdf', 'application/pdf', 'sara hana cc.pdf'),
  ('scans/sara-hana-radler.pdf', 'application/pdf', 'sara hana radler.pdf');
insert into entity_pages (entity_id, position, label, image_id) select (select id from entities where slug = 'david-stemmer-card'), 1, 'david stemmer 2', (select id from media where storage_path = 'scans/david-stemmer-2.pdf');
insert into entity_pages (entity_id, position, label, image_id) select (select id from entities where slug = 'david-stemmer-card'), 2, 'david stemmer 3', (select id from media where storage_path = 'scans/david-stemmer-3.pdf');
insert into entity_pages (entity_id, position, label, image_id) select (select id from entities where slug = 'david-stemmer-card'), 3, 'david stemmer 4', (select id from media where storage_path = 'scans/david-stemmer-4.pdf');
insert into entity_pages (entity_id, position, label, image_id) select (select id from entities where slug = 'david-stemmer-card'), 4, 'david stemmer 5', (select id from media where storage_path = 'scans/david-stemmer-5.pdf');
insert into entity_pages (entity_id, position, label, image_id) select (select id from entities where slug = 'david-stemmer-second-card'), 1, 'david stemmer other card 1', (select id from media where storage_path = 'scans/david-stemmer-other-card-1.pdf');
insert into entity_pages (entity_id, position, label, image_id) select (select id from entities where slug = 'david-stemmer-second-card'), 2, 'david stemmer other card 2', (select id from media where storage_path = 'scans/david-stemmer-other-card-2.pdf');
insert into entity_pages (entity_id, position, label, image_id) select (select id from entities where slug = 'david-stemmer-second-card'), 3, 'david stemmer other card 3', (select id from media where storage_path = 'scans/david-stemmer-other-card-3.pdf');
insert into entity_pages (entity_id, position, label, image_id) select (select id from entities where slug = 'david-stemmer-card'), 5, 'david stemmer', (select id from media where storage_path = 'scans/david-stemmer.pdf');
insert into entity_pages (entity_id, position, label, image_id) select (select id from entities where slug = 'camp-card-helena-berglas'), 1, 'helena berglas concentration', (select id from media where storage_path = 'scans/helena-berglas-concentration.pdf');
insert into entity_pages (entity_id, position, label, image_id) select (select id from entities where slug = 'westerbork-card-helena-berglas'), 1, 'helena berglas westerbork back', (select id from media where storage_path = 'scans/helena-berglas-westerbork-back.pdf');
insert into entity_pages (entity_id, position, label, image_id) select (select id from entities where slug = 'westerbork-card-helena-berglas'), 2, 'helena berglas westerbork back2', (select id from media where storage_path = 'scans/helena-berglas-westerbork-back2.pdf');
insert into entity_pages (entity_id, position, label, image_id) select (select id from entities where slug = 'westerbork-card-helena-berglas'), 3, 'helena berglas westerbork second copy', (select id from media where storage_path = 'scans/helena-berglas-westerbork-second-copy.pdf');
insert into entity_pages (entity_id, position, label, image_id) select (select id from entities where slug = 'westerbork-card-malke-berglas'), 1, 'malke berglas westerbork back', (select id from media where storage_path = 'scans/malke-berglas-westerbork-back.pdf');
insert into entity_pages (entity_id, position, label, image_id) select (select id from entities where slug = 'westerbork-card-malke-berglas'), 2, 'malke berglas westerbork', (select id from media where storage_path = 'scans/malke-berglas-westerbork.pdf');
insert into entity_pages (entity_id, position, label, image_id) select (select id from entities where slug = 'marek-radler-card'), 1, 'marek radler', (select id from media where storage_path = 'scans/marek-radler.pdf');
insert into entity_pages (entity_id, position, label, image_id) select (select id from entities where slug = 'marek-radler-card'), 2, 'mrek radler', (select id from media where storage_path = 'scans/mrek-radler.pdf');
insert into entity_pages (entity_id, position, label, image_id) select (select id from entities where slug = 'rachelle-radler-card'), 1, 'rachelle radler', (select id from media where storage_path = 'scans/rachelle-radler.pdf');
insert into entity_pages (entity_id, position, label, image_id) select (select id from entities where slug = 'chaskel-radler-check'), 1, 'radler chaskel check 2', (select id from media where storage_path = 'scans/radler-chaskel-check-2.pdf');
insert into entity_pages (entity_id, position, label, image_id) select (select id from entities where slug = 'chaskel-radler-check'), 2, 'radler chaskel check', (select id from media where storage_path = 'scans/radler-chaskel-check.pdf');
insert into entity_pages (entity_id, position, label, image_id) select (select id from entities where slug = 'rosa-stemmer-card'), 1, 'rosa stemmer', (select id from media where storage_path = 'scans/rosa-stemmer.pdf');
insert into entity_pages (entity_id, position, label, image_id) select (select id from entities where slug = 'sara-hana-radler-card'), 1, 'sara hana cc', (select id from media where storage_path = 'scans/sara-hana-cc.pdf');
insert into entity_pages (entity_id, position, label, image_id) select (select id from entities where slug = 'sara-hana-radler-card'), 2, 'sara hana radler', (select id from media where storage_path = 'scans/sara-hana-radler.pdf');
commit;
