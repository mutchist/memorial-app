-- =====================================================================
-- Testimony site: data model v3, entity–relation–entity (Supabase/Postgres)
-- 2026-11-08. v3 adds the admin vocabulary tables (entity_types,
-- attr_fields, attr_options), the revisions history and site_data().
--
--   ENTITY  --relation-->  ENTITY
--   Jonas Stemmer  --born_in-->      Amsterdam      (1917-11-07, source: tape 1 @ 0:40)
--   David Loeb Stemmer --parent_of--> Jonas Stemmer
--   Tape 1         --mentions-->     Westerbork     (@ 13:53)
--   Escape leg 3   --departs_from--> Bergen op Zoom
--   Westerbork card --about-->       Helena Berglas
--
-- * Everything (person, place, document, photo, event, term, tape,
--   organisation, group) is one row in `entities`.
-- * Every fact that connects two things is one row in `relations`, with
--   optional dates, a role, a certainty, and its evidence (a tape moment
--   or a document).
-- * `relation_types` is the vocabulary. New kinds of relation are rows,
--   not code changes. Allowed subject/object types are enforced.
-- * Type-specific fields live in `attrs` (jsonb); see the comments below.
-- * Files (scans, photos), subtitle lines and scan field boxes are the
--   only side tables, because they are content of an entity, not facts.
-- * Public can read published rows; only admins write.
-- =====================================================================

create extension if not exists pgcrypto;

create type entity_type    as enum ('person', 'group', 'place', 'organisation',
                                    'document', 'photo', 'event', 'journey',
                                    'term', 'tape');
create type publish_status as enum ('draft', 'published');
create type certainty      as enum ('confirmed', 'probable', 'to_verify');
create type lang_code      as enum ('nl', 'en', 'he', 'de', 'fr', 'yi', 'pl');

-- ---------- admin access ---------------------------------------------

create table admins (
  user_id    uuid primary key,              -- = auth.users.id
  name       text not null,
  created_at timestamptz not null default now()
);

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

-- ---------- media (files in Supabase Storage) ------------------------

create table media (
  id                uuid primary key default gen_random_uuid(),
  storage_path      text not null unique,
  mime_type         text not null,
  width_px int, height_px int,
  alt_text          text,
  credit            text,
  original_filename text,
  created_at        timestamptz not null default now()
);

-- ---------- entities -------------------------------------------------
-- Which keys `attrs` may hold per type, and their allowed values, are rows
-- in attr_fields and attr_options (below). The check_attrs trigger enforces
-- them, and the admin builds its forms from them.

create table entities (
  id              uuid primary key default gen_random_uuid(),
  type            entity_type not null,
  slug            text not null unique,
  name            text not null,
  other_names     text[] not null default '{}',   -- spellings, aliases
  summary         text,
  body            text,                            -- longer story, markdown
  -- when (events, documents, photos): fuzzy date range
  date_text       text, date_from date, date_to date,
  -- where (places): coordinates and how sure we are of them
  lat             double precision check (lat between -90 and 90),
  lng             double precision check (lng between -180 and 180),
  coord_precision text,                            -- exact/town/approx/region/unknown
  image_id        uuid references media(id),       -- portrait / thumbnail
  original_file_id uuid references media(id) on delete set null,  -- the file as received, e.g. the archive's PDF
  attrs           jsonb not null default '{}',
  certainty       certainty not null default 'to_verify',
  status          publish_status not null default 'draft',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check ((lat is null) = (lng is null)),
  check (type = 'place' or lat is null),
  check (date_to is null or date_from is null or date_to >= date_from)
);
create index entities_type on entities (type);
create index entities_name on entities using gin (to_tsvector('simple', name));

-- ---------- relation vocabulary --------------------------------------

create table relation_types (
  key           text primary key,            -- 'born_in'
  label         text not null,               -- 'born in'
  inverse_label text not null,               -- 'birthplace of' (symmetric types repeat the label)
  is_symmetric  boolean not null default false,
  subject_types entity_type[],               -- null = any
  object_types  entity_type[],               -- null = any
  timed         boolean not null default false,  -- needs a tape moment
  needs_end     boolean not null default false,  -- also needs an end time (pictures on screen)
  description   text
);

-- ---------- relations ------------------------------------------------

create table relations (
  id          uuid primary key default gen_random_uuid(),
  subject_id  uuid not null references entities(id) on delete cascade,
  predicate   text not null references relation_types(key) on update cascade,
  object_id   uuid not null references entities(id) on delete cascade,
  role        text,                          -- 'stepmother', 'cousin', 'holder'
  sort_order  int,                           -- e.g. leg 3 of a journey
  date_text   text, date_from date, date_to date,
  -- evidence: a moment in a tape and/or a document
  source_id   uuid references entities(id) on delete set null,
  start_sec   numeric(8,3),
  end_sec     numeric(8,3),
  note        text,
  certainty   certainty not null default 'to_verify',
  status      publish_status not null default 'draft',
  origin      text not null default 'manual',  -- 'manual' / 'batch:tapes' / ...
  on_watch    boolean not null default false,  -- tape moment shown as a card on the Watch page (chosen in the admin)
  created_at  timestamptz not null default now(),
  check (subject_id <> object_id),
  check (end_sec is null or (start_sec is not null and end_sec > start_sec)),
  check (date_to is null or date_from is null or date_to >= date_from)
);
create index relations_subject on relations (subject_id, predicate);
create index relations_object  on relations (object_id, predicate);
create index relations_source  on relations (source_id, start_sec);

-- enforce the vocabulary: subject/object types, and timed relations
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
  if rt.needs_end and (new.end_sec is null or new.end_sec <= new.start_sec) then
    raise exception '"%" needs an end time after the start time', rt.label;
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
create trigger relations_check before insert or update on relations
  for each row execute function check_relation();

-- ---------- admin vocabulary: what each entity type looks like ------
-- Labels and colours per entity type (Watch view legend, admin lists).
create table entity_types (
  key          entity_type primary key,
  label        text not null,               -- 'Person'
  legend_label text not null,               -- 'People'; types sharing it share a legend entry
  color        text not null check (color ~ '^#[0-9a-f]{6}$'),
  has_pages    boolean not null,            -- has scan pages (documents, photos)
  position     int not null unique
);

-- The type-specific fields an entity may hold in `attrs`. The admin builds
-- its forms from these rows; check_attrs rejects anything not listed.
create table attr_fields (
  entity_type entity_type not null references entity_types(key),
  key         text not null,
  label       text not null,
  input       text not null check (input in ('text', 'textarea', 'number', 'select', 'url', 'geojson')),
  when_kind   text,                         -- only for entities whose attrs.kind is this
  required    boolean not null,
  position    int not null,
  help        text,
  primary key (entity_type, key)
);

-- Allowed values of a 'select' field, with how the site shows them.
-- display (per field):
--   place.kind:  {"zoom": map zoom, "show_kind": shown as the card label}
--   event.kind:  {"show_kind": ...}
--   event.mode:  {"color", "width", "dash" (array or null), "legend"}
create table attr_options (
  entity_type entity_type not null,
  attr_key    text not null,
  value       text not null,
  label       text not null,
  position    int not null,
  display     jsonb not null,
  primary key (entity_type, attr_key, value),
  foreign key (entity_type, attr_key) references attr_fields(entity_type, key) on update cascade
);

create or replace function check_attrs() returns trigger
language plpgsql as $$
declare f attr_fields; k text; v jsonb;
begin
  if jsonb_typeof(new.attrs) <> 'object' then
    raise exception 'entity %: attrs must be an object', new.slug;
  end if;
  for k, v in select * from jsonb_each(new.attrs) loop
    select * into f from attr_fields where entity_type = new.type and key = k;
    if not found then
      raise exception 'entity %: field "%" is not defined for type % (see attr_fields)', new.slug, k, new.type;
    end if;
    if f.when_kind is not null and new.attrs->>'kind' is distinct from f.when_kind then
      raise exception 'entity %: field "%" only applies when kind = %', new.slug, k, f.when_kind;
    end if;
    continue when jsonb_typeof(v) = 'null';
    if f.input = 'number' and jsonb_typeof(v) <> 'number' then
      raise exception 'entity %: field "%" must be a number', new.slug, k;
    end if;
    if f.input = 'select' and not exists (select 1 from attr_options o
        where o.entity_type = new.type and o.attr_key = k and o.value = v #>> '{}') then
      raise exception 'entity %: "%" is not an allowed value for % (see attr_options)', new.slug, v #>> '{}', k;
    end if;
  end loop;
  for f in select * from attr_fields where entity_type = new.type and required
           and (when_kind is null or when_kind = new.attrs->>'kind') loop
    if jsonb_typeof(new.attrs->f.key) is null or jsonb_typeof(new.attrs->f.key) = 'null' then
      raise exception 'entity %: field "%" is required for type %', new.slug, f.key, new.type;
    end if;
  end loop;
  return new;
end $$;
create trigger entities_attrs_check before insert or update on entities
  for each row execute function check_attrs();

-- ---------- change history ------------------------------------------
-- Every insert, change and delete of content, with the old and new row,
-- so the admin can show history and undo. by_user is null for setup scripts.
create table revisions (
  id         bigint generated always as identity primary key,
  table_name text not null,
  row_id     text not null,
  op         text not null check (op in ('INSERT', 'UPDATE', 'DELETE')),
  old_row    jsonb,
  new_row    jsonb,
  by_user    uuid,
  at         timestamptz not null default now()
);
create index revisions_row on revisions (table_name, row_id, at desc);

create or replace function log_revision() returns trigger
language plpgsql security definer set search_path = public as $$
declare o jsonb; n jsonb;
begin
  if tg_op <> 'INSERT' then o := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then n := to_jsonb(new); end if;
  insert into revisions (table_name, row_id, op, old_row, new_row, by_user)
  values (tg_table_name, (case when tg_op = 'DELETE' then o else n end)->>tg_argv[0], tg_op, o, n, auth.uid());
  return null;
end $$;

-- ---------- side tables: content of an entity ------------------------

-- Subtitle lines of a tape entity. One track per language.
create table cues (
  id        uuid primary key default gen_random_uuid(),
  tape_id   uuid not null references entities(id) on delete cascade,
  lang      lang_code not null,
  seq       int not null,
  start_sec numeric(8,3) not null check (start_sec >= 0),
  end_sec   numeric(8,3) not null,
  text      text not null,
  speaker   text,
  unique (tape_id, lang, seq),
  check (end_sec > start_sec)
);

-- Story dates: when in Jonas's life the tape is at, set by hand per stretch of tape.
-- From start_sec until the next story date of the same tape, the Watch page shows
-- date_text on the map and puts the "now" marker of the year strip at date_from.
create table story_dates (
  id         uuid primary key default gen_random_uuid(),
  tape_id    uuid not null references entities(id) on delete cascade,
  start_sec  numeric(8,3) not null check (start_sec >= 0),
  date_text  text not null check (date_text <> ''),   -- as shown, e.g. "Summer 1942"
  date_from  date not null,                           -- for the year strip, e.g. 1942-06-01
  note       text,
  unique (tape_id, start_sec)
);
create index cues_time on cues (tape_id, lang, start_sec);

-- Scan sides of a document or photo entity.
create table entity_pages (
  id            uuid primary key default gen_random_uuid(),
  entity_id     uuid not null references entities(id) on delete cascade,
  position      int not null default 1,
  label         text not null,               -- 'Front', 'Back', 'Page 2'
  image_id      uuid not null references media(id),
  transcription text,
  translation_en text,
  transcription_certainty certainty not null default 'to_verify',
  unique (entity_id, position)
);

-- Fields on a form scan: hover label + highlight box (0..1 of the image).
-- refers_to links the value to an entity; the fact itself still goes in
-- relations with this document as source.
create table page_fields (
  id             uuid primary key default gen_random_uuid(),
  page_id        uuid not null references entity_pages(id) on delete cascade,
  label_original text not null,
  label_en       text,
  value_original text,
  value_en       text,
  refers_to      uuid references entities(id) on delete set null,
  box_x real, box_y real, box_w real, box_h real,
  check (box_x is null or (box_x between 0 and 1 and box_y between 0 and 1
                           and box_w > 0 and box_h > 0))
);

-- External links (Wikipedia, archives, Joods Monument, Yad Vashem...)
create table links (
  id        uuid primary key default gen_random_uuid(),
  entity_id uuid not null references entities(id) on delete cascade,
  label     text not null,
  url       text not null check (url ~* '^https?://'),
  position  int not null default 0
);

-- Websites offered when adding a link (the admin's dropdown, in this order;
-- the first one is preselected). url_prefix starts the address; null = type it all.
create table link_sites (
  label      text primary key,
  url_prefix text check (url_prefix ~* '^https?://'),
  position   int not null unique
);

-- Free pages: About, content note, memorial.
create table pages (
  slug       text primary key,
  title      text not null,
  body       text not null,
  status     publish_status not null default 'draft',
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- Vocabulary
-- =====================================================================
insert into relation_types (key, label, inverse_label, is_symmetric, subject_types, object_types, timed, description) values
 -- family and social
 ('parent_of',   'parent of',   'child of',      false, '{person}', '{person}', false, 'role: father / mother / stepmother'),
 ('spouse_of',   'married to',  'married to',    true,  '{person}', '{person}', false, 'date = wedding'),
 ('sibling_of',  'sibling of',  'sibling of',    true,  '{person}', '{person}', false, null),
 ('relative_of', 'relative of', 'relative of',   true,  '{person,group}', '{person,group}', false, 'role: cousin / niece / nephew / brother-in-law ...'),
 ('member_of',   'member of',   'has member',    false, '{person}', '{group,organisation}', false, 'e.g. person in a family group'),
 ('friend_of',   'friend of',   'friend of',     true,  '{person}', '{person}', false, null),
 ('helped',      'helped',      'helped by',     false, '{person,organisation}', '{person,group}', false, null),
 ('worked_for',  'worked for',  'employer of',   false, '{person}', '{person,organisation}', false, null),
 ('arrested',    'arrested',    'arrested by',   false, '{person,organisation}', '{person,group}', false, null),
 ('interviewed', 'interviewed', 'interviewed by',false, '{person}', '{person}', false, null),
 -- people and places
 ('born_in',     'born in',     'birthplace of', false, '{person}', '{place}', false, null),
 ('died_in',     'died in',     'place of death of', false, '{person,group}', '{place}', false, null),
 ('lived_at',    'lived at',    'home of',       false, '{person,group}', '{place}', false, null),
 ('worked_at',   'worked at',   'workplace of',  false, '{person}', '{place}', false, null),
 ('studied_at',  'studied at',  'school of',     false, '{person}', '{place}', false, null),
 ('interned_at', 'interned at', 'internment place of', false, '{person,group}', '{place}', false, null),
 ('deported_to', 'deported to', 'destination of deportation of', false, '{person,group}', '{place}', false, null),
 ('emigrated_to','emigrated to','destination of', false, '{person,group}', '{place}', false, null),
 ('located_in',  'located in',  'contains',      false, '{place,organisation}', '{place}', false, null),
 -- events and journeys
 ('participant_in','took part in','participant',  false, '{person,group,organisation}', '{event,journey}', false, 'role: e.g. refugee, smuggler'),
 ('took_place_at','took place at','scene of',     false, '{event}', '{place}', false, null),
 ('departs_from','departs from','departure point of', false, '{event}', '{place}', false, 'journey leg start'),
 ('arrives_at',  'arrives at',  'arrival point of',   false, '{event}', '{place}', false, 'journey leg end'),
 ('part_of',     'part of',     'consists of',   false, '{event}', '{event,journey}', false, 'sort_order = leg number'),
 -- documents and photos
 ('about',       'about',       'documented in', false, '{document,photo}', null, false, 'role: holder / sender / addressee'),
 ('depicts',     'shows',       'shown in',      false, '{photo}', null, false, 'role: position in photo'),
 ('issued_by',   'issued by',   'issued',        false, '{document}', '{organisation,person}', false, null),
 ('issued_at',   'issued at',   'place of issue of', false, '{document}', '{place}', false, null),
 ('held_by',     'held by',     'holds',         false, '{document,photo}', '{organisation,person}', false, 'archive or family member'),
 -- tapes
 ('mentions',    'mentions',    'mentioned in',  false, '{tape}', null, true,  'a moment in a tape'),
 ('shows',       'shows on camera','shown in tape', false, '{tape}', '{document,photo}', true, null),
 ('illustrates', 'shows on screen','shown on screen in', false, '{tape}', '{photo,document}', true, 'a picture shown over the video from the start time until the end time'),
 ('animates',    'animates route','animated in tape', false, '{tape}', '{event,journey}', true, 'when a route leg draws on the map'),
 -- catch-all
 ('related_to',  'related to',  'related to',    true,  null, null, false, 'use sparingly');
update relation_types set needs_end = true where key = 'illustrates';

insert into link_sites (label, url_prefix, position) values
 ('Wikipedia',         'https://en.wikipedia.org/wiki/', 1),
 ('Arolsen Archives',  'https://collections.arolsen-archives.org/en/document/', 2),
 ('Joods Monument',    'https://www.joodsmonument.nl/', 3),
 ('Yad Vashem',        'https://collections.yadvashem.org/', 4),
 ('Wikimedia Commons', 'https://commons.wikimedia.org/wiki/', 5),
 ('Google Maps',       'https://www.google.com/maps/', 6),
 ('Other',             null, 7);

-- =====================================================================
-- Admin vocabulary rows
-- =====================================================================
insert into entity_types (key, label, legend_label, color, has_pages, position) values
 ('place',        'Place',          'Places',               '#e2a95b', false, 1),
 ('person',       'Person',         'People',               '#d79a8f', false, 2),
 ('group',        'Family & group', 'People',               '#d79a8f', false, 3),
 ('document',     'Document',       'Documents & photos',   '#9db8c2', true, 4),
 ('photo',        'Photo',          'Documents & photos',   '#9db8c2', true, 5),
 ('event',        'Event',          'Events',               '#b6c49a', false, 6),
 ('journey',      'Journey',        'Events',               '#b6c49a', false, 7),
 ('term',         'Term',           'Terms & organisations','#8d877f', false, 8),
 ('organisation', 'Organisation',   'Terms & organisations','#8d877f', false, 9),
 ('tape',         'Tape',           'Tapes',                '#ede6da', false, 10);

insert into attr_fields (entity_type, key, label, input, when_kind, required, position, help) values
 ('person',       'given_names',   'Given names',        'text',     null, false, 1, null),
 ('person',       'family_name',   'Family name',        'text',     null, false, 2, null),
 ('person',       'birth_name',    'Birth name',         'text',     null, false, 3, 'Family name at birth, if different'),
 ('person',       'gender',        'Gender',             'text',     null, false, 4, null),
 ('place',        'kind',          'Kind of place',      'select',   null, true,  1, null),
 ('place',        'historic_name', 'Historic name',      'text',     null, false, 2, 'Name used at the time, e.g. Auschwitz for Oświęcim'),
 ('place',        'address',       'Street address',     'text',     null, false, 3, 'e.g. Maxstraße 7, 67059 Ludwigshafen am Rhein'),
 ('place',        'area',          'Area outline',       'geojson',  null, false, 4, 'For a neighbourhood or other area. Use "Import from a KML file…" below.'),
 ('organisation', 'kind',          'Kind of organisation','select',  null, false, 1, null),
 ('document',     'kind',          'Kind of document',   'select',   null, false, 1, null),
 ('document',     'archive_ref',   'Archive reference',  'text',     null, false, 2, null),
 ('document',     'archive_url',   'Archive link',       'url',      null, false, 3, null),
 ('document',     'original_lang', 'Language',           'text',     null, false, 4, null),
 ('event',        'kind',          'Kind of event',      'select',   null, false, 1, null),
 ('event',        'mode',          'Travelled by',       'select',   'journey_leg', true,  2, null),
 ('event',        'drawing',       'Route drawing',      'select',   'journey_leg', true,  3, 'How the line on the map is drawn'),
 ('event',        'path',          'Drawn path',         'geojson',  'journey_leg', false, 4, 'GeoJSON LineString; empty = straight line between the places'),
 ('tape',         'number',        'Tape number',        'number',   null, true,  1, null),
 ('tape',         'youtube_id',    'YouTube video ID',   'text',     null, false, 2, 'The part after watch?v= in the YouTube link'),
 ('tape',         'duration_sec',  'Length (seconds)',   'number',   null, true,  3, null),
 ('tape',         'recorded_note', 'Recording note',     'textarea', null, false, 4, null),
 ('term',         'lang',          'Language of the term','text',    null, false, 1, null);

insert into attr_options (entity_type, attr_key, value, label, position, display) values
 ('place', 'kind', 'address', 'Address', 1, '{"zoom": 16, "show_kind": true}'),
 ('place', 'kind', 'neighbourhood', 'Neighbourhood', 2, '{"zoom": 14, "show_kind": true}'),
 ('place', 'kind', 'station', 'Station', 3, '{"zoom": 14, "show_kind": true}'),
 ('place', 'kind', 'camp',    'Camp',    4, '{"zoom": 9,    "show_kind": true}'),
 ('place', 'kind', 'port',    'Port',    5, '{"zoom": 7.5,  "show_kind": true}'),
 ('place', 'kind', 'border',  'Border',  6, '{"zoom": 7.5,  "show_kind": true}'),
 ('place', 'kind', 'village', 'Village', 7, '{"zoom": 7.5,  "show_kind": true}'),
 ('place', 'kind', 'city',    'City',    8, '{"zoom": 7.5,  "show_kind": false}'),
 ('place', 'kind', 'region',  'Region',  9, '{"zoom": 5.5,  "show_kind": true}'),
 ('place', 'kind', 'country', 'Country', 10, '{"zoom": 4,    "show_kind": true}'),
 ('place', 'kind', 'other',   'Other',  11, '{"zoom": 16, "show_kind": false}'),
 ('organisation', 'kind', 'archive',   'Archive',   1, '{}'),
 ('organisation', 'kind', 'agency',    'Agency',    2, '{}'),
 ('organisation', 'kind', 'company',   'Company',   3, '{}'),
 ('organisation', 'kind', 'community', 'Community', 4, '{}'),
 ('organisation', 'kind', 'military',  'Military or police', 5, '{}'),
 ('organisation', 'kind', 'aid',       'Aid organisation', 6, '{}'),
 ('document', 'kind', 'camp_card',         'Camp card',         1, '{}'),
 ('document', 'kind', 'registration_card', 'Registration card', 2, '{}'),
 ('document', 'kind', 'letter',            'Letter',            3, '{}'),
 ('document', 'kind', 'certificate',       'Certificate',       4, '{}'),
 ('document', 'kind', 'list',              'List or register',  5, '{}'),
 ('document', 'kind', 'other',             'Other document',    6, '{}'),
 ('event', 'kind', 'journey_leg', 'Route',       1, '{"show_kind": true}'),
 ('event', 'kind', 'birth',       'Birth',       2, '{"show_kind": false}'),
 ('event', 'kind', 'wedding',     'Wedding',     3, '{"show_kind": false}'),
 ('event', 'kind', 'flight',      'Flight',      4, '{"show_kind": false}'),
 ('event', 'kind', 'arrest',      'Arrest',      5, '{"show_kind": false}'),
 ('event', 'kind', 'deportation', 'Deportation', 6, '{"show_kind": false}'),
 ('event', 'mode', 'train',      'Train',      1, '{"color": "#e2a95b", "width": 2.6, "dash": null, "legend": "train"}'),
 ('event', 'mode', 'walk',       'On foot',    2, '{"color": "#e5806f", "width": 2.6, "dash": null, "legend": "on foot"}'),
 ('event', 'mode', 'car',        'Car',        3, '{"color": "#9fcb7c", "width": 2.4, "dash": null, "legend": "road"}'),
 ('event', 'mode', 'bus',        'Bus',        4, '{"color": "#9fcb7c", "width": 2.4, "dash": null, "legend": "road"}'),
 ('event', 'mode', 'truck',      'Truck',      5, '{"color": "#9fcb7c", "width": 2.4, "dash": null, "legend": "road"}'),
 ('event', 'mode', 'horse_cart', 'Horse cart', 6, '{"color": "#b99ae0", "width": 2.4, "dash": null, "legend": "horse cart"}'),
 ('event', 'mode', 'ship',       'Ship',       7, '{"color": "#6fb7dd", "width": 2.4, "dash": null, "legend": "ship"}'),
 ('event', 'mode', 'unknown',    'Not known',  8, '{"color": "#7d766d", "width": 1.8, "dash": null, "legend": "not known"}'),
 ('event', 'drawing', 'straight',      'Straight line',      1, '{}'),
 ('event', 'drawing', 'manual',        'Drawn by hand',      2, '{}'),
 ('event', 'drawing', 'snap_to_roads', 'Follow the roads',   3, '{}');

-- history on content tables (argument = primary key column)
create trigger history after insert or update or delete on entities     for each row execute function log_revision('id');
create trigger history after insert or update or delete on relations    for each row execute function log_revision('id');
create trigger history after insert or update or delete on entity_pages for each row execute function log_revision('id');
create trigger history after insert or update or delete on page_fields  for each row execute function log_revision('id');
create trigger history after insert or update or delete on links        for each row execute function log_revision('id');
create trigger history after insert or update or delete on media        for each row execute function log_revision('id');
create trigger history after insert or update or delete on story_dates  for each row execute function log_revision('id');
create trigger history after insert or update or delete on pages        for each row execute function log_revision('slug');

-- =====================================================================
-- site_data(): everything the public site needs, as one JSON object.
-- Runs with the caller's rights, so visitors get published rows only and
-- a signed-in admin also gets drafts (for preview). Relations are only
-- included when both ends are visible. Collections are arrays (an empty
-- collection is an empty array).
-- =====================================================================
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
      'note', r.note, 'certainty', r.certainty, 'status', r.status, 'watch', r.on_watch))
    from relations r
    join entities s on s.id = r.subject_id
    join entities o on o.id = r.object_id
    left join entities src on src.id = r.source_id)),
  'tapes', to_json(array(select json_build_object(
      'id', e.id, 'number', (e.attrs->>'number')::int, 'name', e.name,
      'youtube_id', e.attrs->>'youtube_id', 'duration', (e.attrs->>'duration_sec')::numeric,
      'cues', to_json(array(select json_build_array(c.start_sec, c.end_sec, c.text)
                            from cues c where c.tape_id = e.id and c.lang = 'en' order by c.seq)),
      'story_dates', to_json(array(select json_build_object('t', d.start_sec, 'text', d.date_text, 'from', d.date_from)
                            from story_dates d where d.tape_id = e.id order by d.start_sec)))
    from entities e where e.type = 'tape' order by (e.attrs->>'number')::int)),
  'pages', to_json(array(select json_strip_nulls(json_build_object(
      'entity', p.entity_id, 'position', p.position, 'label', p.label,
      'path', m.storage_path, 'mime', m.mime_type, 'w', m.width_px, 'h', m.height_px, 'alt', m.alt_text, 'credit', m.credit,
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

-- The admin reads the allowed values of the fixed lists from here.
create or replace function admin_vocab() returns json
language sql stable security invoker set search_path = public as $$
select json_build_object(
  'certainty',   to_json(enum_range(null::certainty)),
  'status',      to_json(enum_range(null::publish_status)),
  'entity_type', to_json(enum_range(null::entity_type)));
$$;
grant execute on function admin_vocab() to authenticated;

-- =====================================================================
-- Convenience views
-- =====================================================================

-- Every relation readable in both directions, for entity pages:
-- "Amsterdam: birthplace of Jonas Stemmer".
create view entity_facts with (security_invoker = true) as
select r.id as relation_id, r.subject_id as entity_id, rt.label as label,
       r.object_id as other_id, o.name as other_name, o.type as other_type,
       r.role, r.date_text, r.date_from, r.source_id, r.start_sec, r.certainty, r.status
from relations r join relation_types rt on rt.key = r.predicate
join entities o on o.id = r.object_id
union all
select r.id, r.object_id, rt.inverse_label,
       r.subject_id, s.name, s.type,
       r.role, r.date_text, r.date_from, r.source_id, r.start_sec, r.certainty, r.status
from relations r join relation_types rt on rt.key = r.predicate
join entities s on s.id = r.subject_id;

-- Watch view: everything tied to a moment in a tape, in order. Covers
-- tape-as-subject (mentions/shows/animates) and facts whose evidence is
-- a tape moment (born_in with source tape 1 @ 0:40).
create view tape_timeline with (security_invoker = true) as
select case when s.type = 'tape' then r.subject_id else r.source_id end as tape_id,
       r.start_sec, r.end_sec, r.predicate,
       case when s.type = 'tape' then r.object_id else r.subject_id end as entity_id,
       case when s.type = 'tape' then o.name else s.name || ' ' || rt.label || ' ' || o.name end as title,
       case when s.type = 'tape' then o.type else s.type end as entity_type,
       r.status
from relations r
join relation_types rt on rt.key = r.predicate
join entities s on s.id = r.subject_id
join entities o on o.id = r.object_id
where r.start_sec is not null;

-- =====================================================================
-- Row level security
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['entities','relations','pages'] loop
    execute format('alter table %I enable row level security', t);
    execute format($p$create policy public_read on %I for select using (status = 'published' or is_admin())$p$, t);
    execute format($p$create policy admin_write on %I for all using (is_admin()) with check (is_admin())$p$, t);
  end loop;
  foreach t in array array['relation_types','entity_types','attr_fields','attr_options','media','cues','entity_pages','page_fields','links','link_sites','story_dates'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy public_read on %I for select using (true)', t);
    execute format($p$create policy admin_write on %I for all using (is_admin()) with check (is_admin())$p$, t);
  end loop;
  alter table admins enable row level security;
  alter table revisions enable row level security;
  create policy admin_only on revisions for select using (is_admin());
  create policy admin_only on admins for all using (is_admin()) with check (is_admin());
end $$;

create or replace function touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger touch before update on entities for each row execute function touch_updated_at();
create trigger touch before update on pages    for each row execute function touch_updated_at();
