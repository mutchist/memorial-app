# Testimony site: data model v3 (entity–relation–entity)

_8 November 2026. v3 adds the admin vocabulary, change history and `site_data()`. The data now lives in Supabase._

## The idea

Everything is an **entity**, and every fact is a **relation** between two entities.

```
Jonas Stemmer       --born in-->        Amsterdam          7 Nov 1917 · source: tape 1 @ 0:40
David Loeb Stemmer  --parent of-->      Jonas Stemmer      role: father
Tape 2              --mentions-->       Bergen op Zoom     @ 12:04
Escape 1942, leg 3  --departs from-->   Bergen op Zoom
Westerbork card     --about-->          Helena Berglas     role: holder
```

Each relation can be read both ways: on Amsterdam's page it shows up as "birthplace of Jonas Stemmer". A relation can also carry dates, a role, a certainty (confirmed / probable / to verify) and its evidence: a moment in a tape or a document. The Swiss archive files will slot in the same way. Each file becomes a document entity, and each fact taken from it becomes a relation with that document as its source.

## Entity types

person · group (e.g. "Parents-in-law of Jonas") · place · organisation · document · photo · event · journey · term · tape

All of them share one table (`entities`). Fields that only apply to one type, such as a place's kind, a document's archive reference, or a route leg's mode and drawn path, sit in a flexible `attrs` field.

## Relation vocabulary

The kinds of relation are rows in `relation_types`, so adding a new one doesn't need code. The database also checks that each relation connects the right types (a place can't be "born in" anything). The current list:

| Group | Relations |
|---|---|
| Family and social | parent of, married to, sibling of, relative of, member of, friend of, helped, worked for, arrested, interviewed |
| People and places | born in, died in, lived at, worked at, studied at, interned at, deported to, emigrated to, located in |
| Events and journeys | took part in, took place at, departs from, arrives at, part of |
| Documents and photos | about, shows, issued by, issued at, held by |
| Tapes (with a time) | mentions, shows on camera, animates route |
| Catch-all | related to |

## Side tables

These hold the content of one entity rather than facts:
- `cues`: a tape's subtitle lines
- `entity_pages`: scan sides with transcription and translation
- `page_fields`: card fields with their hover label and highlight box
- `media`: stored files
- `links`: Wikipedia and archive links
- `pages`: About, content note, memorial

## Admin vocabulary (new in v3)

What the admin shows and what the site looks like comes from rows, not code:

| Table | What it holds |
|---|---|
| `entity_types` | Label, legend label and colour of each type (Place, Person…). Drives the timeline colours and legend. |
| `attr_fields` | The extra fields each type has (a place's kind, a document's archive reference, a route leg's mode). The admin builds its forms from it, and the database refuses fields that aren't listed. |
| `attr_options` | The allowed choices for those fields, with how they show: map zoom per kind of place, line colour and dash per travel mode. |
| `revisions` | Every change and delete, with the old and new values and who made it. For history and undo. |

`entity_types.has_pages` marks the types that have scan pages (documents, photos). Scan files live in Supabase Storage, bucket `scans` (`storage.sql`); `media.storage_path` is `scans/<file>`.

`site_data()` returns everything the public site needs in one call. Visitors only get published rows; a signed-in admin also gets drafts.

## How the data gets in

**From now on the Supabase database is the source of truth.** Edit in the admin. The CSVs and scripts below were the one-time import and are kept as a record.

One-time setup of a new Supabase project: run `python data-model/tools/build_setup.py` and paste `data-model/supabase-setup.sql` into the Supabase SQL editor.

How the import was built (history):

You edit spreadsheets, and a script turns them into the database. It's re-runnable, so changing a CSV and running it again is all it takes.

| File (in `tagging/`) | Becomes |
|---|---|
| `tape-tags.csv` (your corrected version) | 258 "Tape mentions X" relations, plus the people, terms, documents and events they name |
| `places.csv` (your corrected version) | 99 places with coordinates |
| `people.csv` (your relationship column) | family relations to Jonas |
| `facts.csv` **(new)** | 46 facts in subject / relation / object form, each with its tape moment |
| `journeys.csv` **(new)** | 4 journeys made of 23 legs, each with a mode and the moment the leg animates on the map |

`build_seed.py` turned these into `seed.sql`; `build_setup.py` combines `schema.sql`, `tapes.sql` and `seed.sql`. Don't re-run them against the live database.

The current result is 272 entities and 439 relations, plus 908 subtitle lines and 32 scans. All are drafts. It loads cleanly in Postgres 16.

## Your corrections are in

- Stepmother: Miriam Konig Stemmer. Rosa's husband: Moshe Zecharya Warhaftig.
- The Kern niece is now "Kern family (Dora's cousins)".
- Courthouse at Littenstraße 12–17, and Gentsestraat 81. These keep your "double check" / "check again" notes.

## Still open

- YouTube IDs, which wait until the videos are public.
- Duplicate and unknown scans, deferred.
- The "david stemmer" and "rosa stemmer" scans are linked to David Loeb and Rosa Stemmer as *probable*, matched by name only.

## Documents (8 Nov 2026)

- `entities.original_file_id`: the file as received (e.g. the archive's PDF), offered as a download.
- `page_fields`: hover labels on a scan page; box is left, top, width, height as a share of the image (0..1). `refers_to` links a label to an entity.
- `site_data()` also returns `attr_fields`, each entity's `body` and `file`, and per page its image size (`w`, `h`) and `fields`.
- Document kind `list` (List or register).
- Example: `updates/2026-11-08-rosa-example.sql` (also part of `supabase-setup.sql` for new projects).
