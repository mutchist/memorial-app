-- Merge the four tapes into one video (12 Nov 2026). Run once in the Supabase SQL Editor,
-- after the joined video is on YouTube. Fill in the three values marked FILL IN first.
--
-- Tape 1 stays and becomes "the testimony". Everything on tapes 2-4 (subtitle lines,
-- tape moments, facts with a tape moment as evidence, story dates, pictures, links)
-- moves onto it, shifted by the length of the tapes before it. Tapes 2-4 are then deleted.
-- The shift is exact only if the tapes were joined end to end (ffmpeg concat, no gaps or fades).

begin;

create temp table merge_params on commit drop as
select 'FILL IN'::text                  as youtube_id,    -- new video ID, the part after watch?v=
       array[1787, 1825, 1869, 1850]::numeric[] as durations;  -- length of each tape's clip in the joined video, seconds (29:47, 30:25, 31:09, 30:50)

do $$
begin
  if (select youtube_id = 'FILL IN' or 0 = any(durations) from merge_params) then
    raise exception 'Fill in the new YouTube ID at the top of this script first';
  end if;
  if (select count(*) from entities where type = 'tape') <> 4 then
    raise exception 'Expected 4 tapes in the database; has this already been run?';
  end if;
end $$;

-- each tape with its offset in the joined video
create temp table tape_map on commit drop as
select e.id as old_id,
       (e.attrs->>'number')::int as num,
       coalesce((select sum(d) from unnest((select durations from merge_params)[1:(e.attrs->>'number')::int - 1]) d), 0) as offset_sec,
       (select id from entities where type = 'tape' and attrs->>'number' = '1') as new_id
from entities e where e.type = 'tape';

-- subtitle lines: shift, then renumber in time order
update cues c set start_sec = c.start_sec + m.offset_sec, end_sec = c.end_sec + m.offset_sec,
                  tape_id = m.new_id, seq = c.seq + m.num * 100000
from tape_map m where c.tape_id = m.old_id;
update cues c set seq = n.rn
from (select id, row_number() over (partition by lang order by start_sec, seq) as rn from cues) n
where c.id = n.id;

-- story dates
update story_dates s set start_sec = s.start_sec + m.offset_sec, tape_id = m.new_id
from tape_map m where s.tape_id = m.old_id;

-- tape moments (tape is the subject) and facts whose evidence is a tape moment (tape is the
-- source): one update, so a relation with the tape in both places is shifted once
update relations r set
  subject_id = coalesce(ms.new_id, r.subject_id),
  source_id  = case when mo.old_id is not null then mo.new_id else r.source_id end,
  start_sec  = r.start_sec + coalesce(ms.offset_sec, mo.offset_sec),
  end_sec    = r.end_sec   + coalesce(ms.offset_sec, mo.offset_sec)
from relations r0
left join tape_map ms on ms.old_id = r0.subject_id and ms.num > 1
left join tape_map mo on mo.old_id = r0.source_id  and mo.num > 1
where r.id = r0.id and (ms.old_id is not null or mo.old_id is not null);
-- anything else pointing at tapes 2-4 (e.g. a person recorded in a tape): repoint, drop exact duplicates
update relations r set object_id = m.new_id
from tape_map m where r.object_id = m.old_id and m.num > 1;
delete from relations a using relations b
where a.id > b.id and a.subject_id = b.subject_id and a.predicate = b.predicate and a.object_id = b.object_id
  and a.start_sec is null and b.start_sec is null and a.source_id is not distinct from b.source_id
  and (select distinct new_id from tape_map) in (a.subject_id, a.object_id);

-- links of tapes 2-4 go to the testimony too
update links l set entity_id = m.new_id from tape_map m where l.entity_id = m.old_id and m.num > 1;

-- the testimony itself; the note keeps where each old tape starts, for old "tape 2 @ 5:10" references
update entities set name = 'Testimony of Jonas Stemmer',
       attrs = attrs || jsonb_build_object(
         'youtube_id', (select youtube_id from merge_params),
         'duration_sec', (select sum(d) from unnest((select durations from merge_params)) d),
         'recorded_note', concat_ws(E'\n', nullif(attrs->>'recorded_note', ''),
           'Joined from four tapes. ' || (select string_agg(format('Tape %s starts at %s.', num,
               to_char(make_interval(secs => offset_sec), 'HH24:MI:SS')), ' ' order by num) from tape_map)))
where id = (select distinct new_id from tape_map);

delete from entities where id in (select old_id from tape_map where num > 1);

commit;

-- Check: one tape, its length, and counts per kind of thing on it
select name, attrs->>'youtube_id' as youtube_id, attrs->>'duration_sec' as length_sec,
       (select count(*) from cues c where c.tape_id = e.id) as subtitle_lines,
       (select count(*) from relations r where r.subject_id = e.id or r.source_id = e.id) as moments,
       (select count(*) from story_dates s where s.tape_id = e.id) as story_dates
from entities e where type = 'tape';
