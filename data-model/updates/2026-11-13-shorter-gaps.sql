-- Re-time the testimony for the new joined video with shorter gaps between the tapes (13 Nov 2026).
-- Run once in the Supabase SQL Editor, after 2026-11-12-merge-tapes.sql.
--
-- Old video (nBBQwgoklSI) clip lengths: 29:47, 30:25, 31:09, 30:50 -> tapes start at 0, 1787, 3612, 5481 s.
-- New video clip lengths:               28:46, 29:24, 30:09, 30:49 -> tapes start at 0, 1726, 3490, 5299 s.
-- Every subtitle line, tape moment and story date moves back by the gaps cut before its tape.

do $retime$
declare
  yt      text      := 'tPrsyLITNZk';                   -- the new video (shorter gaps)
  old_at  numeric[] := array[0, 1787, 3612, 5481];      -- where each tape started in the old video
  new_at  numeric[] := array[0, 1726, 3490, 5299];      -- where each tape starts in the new video
  new_len numeric   := 1726 + 1764 + 1809 + 1849;
  tape    uuid;
begin
  if yt = 'FILL IN' then
    raise exception 'Fill in the new YouTube ID at the top of this script first';
  end if;
  select id into tape from entities where type = 'tape' and attrs->>'youtube_id' = 'nBBQwgoklSI';
  if tape is null then
    raise exception 'The testimony is not on video nBBQwgoklSI; has this already been run?';
  end if;

  -- shift of a time in the old video: by the tape it falls in
  create temp table shift_at (from_sec numeric, shift numeric);
  insert into shift_at select old_at[i], new_at[i] - old_at[i] from generate_subscripts(old_at, 1) i;

  update cues c set start_sec = c.start_sec + s.shift, end_sec = c.end_sec + s.shift
  from (select c2.id, (select shift from shift_at where from_sec <= c2.start_sec order by from_sec desc limit 1) as shift
        from cues c2 where c2.tape_id = tape) s
  where c.id = s.id;

  update story_dates d set start_sec = d.start_sec + s.shift
  from (select d2.id, (select shift from shift_at where from_sec <= d2.start_sec order by from_sec desc limit 1) as shift
        from story_dates d2 where d2.tape_id = tape) s
  where d.id = s.id;

  update relations r set start_sec = r.start_sec + s.shift, end_sec = r.end_sec + s.shift
  from (select r2.id, (select shift from shift_at where from_sec <= r2.start_sec order by from_sec desc limit 1) as shift
        from relations r2 where r2.start_sec is not null and tape in (r2.subject_id, r2.source_id)) s
  where r.id = s.id;

  update entities set attrs = attrs || jsonb_build_object(
      'youtube_id', yt,
      'duration_sec', new_len,
      'recorded_note', regexp_replace(attrs->>'recorded_note', 'Joined from four tapes\..*$',
        'Joined from four tapes. Tape 1 starts at 00:00:00. Tape 2 starts at 00:28:46. Tape 3 starts at 00:58:10. Tape 4 starts at 01:28:19.'))
  where id = tape;

  drop table shift_at;
end $retime$;

-- Check: the new video ID, 7148 seconds, 908 subtitle lines, the last one ending at 6719.404 (1:51:59)
select name, attrs->>'youtube_id' as youtube_id, attrs->>'duration_sec' as length_sec,
       (select count(*) from cues c where c.tape_id = e.id) as subtitle_lines,
       (select max(end_sec) from cues c where c.tape_id = e.id) as last_line_ends
from entities e where type = 'tape';
