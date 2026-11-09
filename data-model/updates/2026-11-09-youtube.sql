-- YouTube videos for the four tapes (9 Nov 2026). Run once in the Supabase SQL Editor.
update entities set attrs = attrs || jsonb_build_object('youtube_id', v.id)
from (values ('tape-1', 'DkhEP2iWcqk'), ('tape-2', 'XU_YHZV8nu4'), ('tape-3', 'RAhOPSqvwYY'), ('tape-4', 'QN2pySMHZBY')) as v(slug, id)
where entities.slug = v.slug and entities.type = 'tape';
-- Check: should list the four tapes with their video IDs
select name, attrs->>'youtube_id' as youtube_id from entities where type = 'tape' order by (attrs->>'number')::int;
