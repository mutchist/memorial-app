-- For the admin (8 Nov 2026). Run once in the Supabase SQL Editor.

-- The admin reads the allowed values of the database's fixed lists
-- (certainty, publish status, entity types) from here, so they are not
-- repeated in the admin code.
create or replace function admin_vocab() returns json
language sql stable security invoker set search_path = public as $$
select json_build_object(
  'certainty',   to_json(enum_range(null::certainty)),
  'status',      to_json(enum_range(null::publish_status)),
  'entity_type', to_json(enum_range(null::entity_type)));
$$;
grant execute on function admin_vocab() to authenticated;

-- Clearer messages when a connection breaks the rules.
create or replace function check_relation() returns trigger
language plpgsql as $$
declare rt relation_types; st entity_type; ot entity_type; srct entity_type;
begin
  select * into rt from relation_types where key = new.predicate;
  select type into st from entities where id = new.subject_id;
  select type into ot from entities where id = new.object_id;
  if rt.subject_types is not null and not st = any(rt.subject_types) then
    raise exception '"%" can only start from: % (not a %)', rt.label, array_to_string(rt.subject_types, ', '), st;
  end if;
  if rt.object_types is not null and not ot = any(rt.object_types) then
    raise exception '"%" can only point to: % (not a %)', rt.label, array_to_string(rt.object_types, ', '), ot;
  end if;
  if rt.timed and new.start_sec is null then
    raise exception '"%" needs a time in the tape', rt.label;
  end if;
  if new.start_sec is not null then
    select type into srct from entities
      where id = case when st = 'tape' then new.subject_id else new.source_id end;
    if srct is distinct from 'tape' then
      raise exception 'A time in the tape needs a tape: pick the tape as the source';
    end if;
  end if;
  return new;
end $$;
