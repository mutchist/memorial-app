-- Rosa Stemmer confirmed as Jonas's sister (8 Nov 2026). Run once in the Supabase SQL Editor,
-- after 2026-11-08-rosa-example.sql. The rest of the review is in review-2026-11-08.csv.

-- =====================================================================
-- 0. ROSA STEMMER: you confirmed she is Jonas's sister (these lines are switched ON).
--    Run this file after 2026-11-08-rosa-example.sql.
-- =====================================================================
update entities set certainty = 'confirmed', summary = 'Sister, born 1910 in Ludwigshafen' where slug = 'rosa-stemmer';
update relations set certainty = 'confirmed', note = 'Listed as Stemmer, Rosa; Polish; civilian worker, deportee. Confirmed by the family as Jonas''s sister.'
 where predicate = 'about' and subject_id = (select id from entities where slug = 'stemmer-rosa-police-list-ludwigshafen') and object_id = (select id from entities where slug = 'rosa-stemmer');
update relations set note = 'Sister, born 1910 in Ludwigshafen'
 where predicate = 'mentions' and object_id = (select id from entities where slug = 'rosa-stemmer') and note like '%Possibly the Rosa Stemmer scan%';
update entities set
  body = replace(body, 'Is this Jonas''s sister? His sister Rosa was born in 1910 in Ludwigshafen, so the name and the town fit, but the list gives no birth date. To verify against the residence registration itself, which the Arolsen Archives may hold in the same collection.',
                       'The family confirms that this is Jonas''s sister Rosa, born in 1910 in Ludwigshafen.')
 where slug = 'stemmer-rosa-police-list-ludwigshafen';
