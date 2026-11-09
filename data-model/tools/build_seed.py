"""Build seed.sql for the entity–relation–entity model from the CSVs in ../tagging.

Inputs (all editable in Excel):
  tagging/tape-tags.csv  every tagged moment in the tapes  -> entities + 'mentions'
  tagging/places.csv     coordinates per place             -> place entities
  tagging/people.csv     relationship to Jonas             -> family relations
  tagging/facts.csv      subject, predicate, object facts  -> relations
  tagging/journeys.csv   route legs                        -> journey + leg events

Usage:  python build_seed.py            (run from anywhere)
Output: data-model/seed.sql  (load after schema.sql and tapes.sql)
"""
import csv, json, re, sys, unicodedata
from datetime import date
from calendar import monthrange
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TAG = ROOT / 'tagging'
OUT = ROOT / 'data-model' / 'seed.sql'

# ---------- naming fixes and type overrides ----------------------------
RENAME = {
    'Stepmother of Jonas': 'Miriam Konig Stemmer',
    'Warhaftig': 'Moshe Zecharya Warhaftig',
    'Niece of Jonas (Kern family)': "Kern family (Dora's cousins)",
    'Courthouse, Berlin-Mitte': 'Courthouse, Berlin-Mitte, Littenstraße 12–17',
    'Gentsestraat, Scheveningen': 'Gentsestraat 81, Scheveningen',
}
GROUPS = {'Parents-in-law of Jonas', 'Siblings of Jonas', 'Twin brothers from Brussels',
          "Kern family (Dora's cousins)"}
ORGS = {'Chamber of Commerce (Kamer van Koophandel)', 'IG Farben', 'SA (Sturmabteilung)',
        'Wirtschaftsprüfstelle', 'Wehrmacht', 'Jewish Agency', 'Office Néerlandais',
        'French national police', 'Gendarmes', 'Swiss Red Cross', 'Jewish Brigade',
        'Property management institute (Nederlands Beheersinstituut)', 'Hilfspolizei'}
MONTHS = {m: i for i, m in enumerate(
    'january february march april may june july august september october november december'.split(), 1)}

def slugify(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')[:80]

def q(v):
    if v is None or v == '':
        return 'null'
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"

def secs(t):
    m, s = t.split(':'); return int(m) * 60 + int(s)

def fuzzy_date(text):
    """'7 November 1917' / 'March/April 1933' / 'end of 1929' / '1919–1920' -> (from, to)."""
    if not text:
        return None, None
    t = text.lower().replace('c. ', '')
    years = [int(y) for y in re.findall(r'\b(1[89]\d\d|20\d\d)\b', t)]
    if not years:
        return None, None
    months = [MONTHS[m] for m in re.findall('|'.join(MONTHS), t)]
    day = re.match(r'^(\d{1,2}) ', t)
    y1, y2 = years[0], years[-1]
    if day and months:
        d = date(y1, months[0], int(day.group(1))); return d, d
    if months:
        m1, m2 = months[0], months[-1]
        if t.startswith('early'):
            return date(y1, m1, 1), date(y1, m1, 10)
        return date(y1, m1, 1), date(y2, m2, monthrange(y2, m2)[1])
    if 'end of' in t:
        return date(y1, 10, 1), date(y1, 12, 31)
    if 'early' in t or 'beginning' in t:
        return date(y1, 1, 1), date(y1, 4, 30)
    if 'autumn' in t:
        return date(y1, 9, 22), date(y1, 12, 21)
    if t.endswith('s') and len(years) == 1 and str(y1).endswith('0'):   # '1920s'
        return date(y1, 1, 1), date(y1 + 9, 12, 31)
    if t.startswith('from'):
        return date(y1, 1, 1), None
    return date(y1, 1, 1), date(y2, 12, 31)

def read(name):
    with open(TAG / name, encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))

# ---------- collect entities -------------------------------------------
entities = {}          # slug -> dict
by_name = {}           # (type-agnostic) name -> slug

def add_entity(etype, name, **kw):
    slug = slugify(name)
    if slug in entities:
        e = entities[slug]
        for k, v in kw.items():
            if v not in (None, '') and not e.get(k):
                e[k] = v
        return slug
    e = dict(type=etype, slug=slug, name=name, **kw)
    entities[slug] = e
    by_name[name] = slug
    return slug

def ref(name):
    name = RENAME.get(name, name)
    if name not in by_name:
        sys.exit(f'Unknown entity name: {name!r}. Check spelling against the CSVs.')
    return f"(select id from entities where slug = {q(by_name[name])})"

def tape(n):
    return f"(select id from entities where slug = 'tape-{int(n)}')"

for p in read('places.csv'):
    name = RENAME.get(p['name'], re.sub(r'\s+', ' ', p['name']).strip())
    add_entity('place', name, lat=p['lat'] or None, lng=p['lng'] or None,
               coord_precision=p['coordinate_precision'], attrs={'kind': p['kind']})

tags = read('tape-tags.csv')
for t in tags:
    name = RENAME.get(t['name'], t['name'])
    typ = t['type']
    if typ == 'place':
        if name not in by_name:
            sys.exit(f'Place {name!r} is tagged but missing from places.csv')
        continue
    if typ == 'person':
        add_entity('group' if name in GROUPS else 'person', name, summary=t['note'])
    elif typ == 'term':
        add_entity('organisation' if name in ORGS else 'term', name, summary=t['note'])
    elif typ == 'document':
        add_entity('photo' if 'photo' in name.lower() else 'document', name, summary=t['note'])
    elif typ == 'date':
        f, to = fuzzy_date(t['name'])
        t['_event'] = add_entity('event', t['note'], date_text=t['name'],
                                 date_from=f, date_to=to)

# people from the scans (names only)
SCAN_PEOPLE = ['Helena Berglas', 'Malke Berglas', 'Marek Radler', 'Rachelle Radler',
               'Sara Hana Radler', 'Chaskel Radler']
for n in SCAN_PEOPLE:
    add_entity('person', n, summary='Named on a scan in Historic documents.')
add_entity('person', 'Miriam Konig Stemmer', summary="Jonas's stepmother")
add_entity('person', 'Moshe Zecharya Warhaftig', summary="Rosa's husband")

jonas = by_name['Jonas Stemmer']
entities[jonas].update(date_text='7 November 1917', certainty='confirmed',
                       summary='Narrator of the testimony; grandfather.')

# ---------- relations ----------------------------------------------------
rels = []   # (subject_sql, predicate, object_sql, extra dict)

def rel(s, p, o, **kw):
    rels.append((s, p, o, kw))

# 1. every tagged moment: tape --mentions--> entity
for t in tags:
    name = RENAME.get(t['name'], t['name'])
    obj = f"(select id from entities where slug = {q(t['_event'])})" if t['type'] == 'date' else ref(name)
    rel(tape(t['tape']), 'mentions', obj, start_sec=float(t['start_sec']),
        end_sec=float(t['end_sec']), note=t['note'],
        certainty='to_verify' if t['needs_check'] else 'probable', origin='batch:tapes')

# 2. family, from the relationship column in people.csv (relative to Jonas)
J = ref('Jonas Stemmer')
seen = set()
for p in read('people.csv'):
    r = (p.get('relationship') or '').strip().lower()
    name = RENAME.get(p['name'], p['name'])
    if not r:
        continue
    X = ref(name)
    if r in ('father', 'mother'):
        rel(X, 'parent_of', J, role=r, certainty='confirmed')
    elif r in ('brother', 'sister'):
        rel(X, 'sibling_of', J, role=r, certainty='confirmed')
    elif r == 'son':
        rel(J, 'parent_of', X, role='father', certainty='confirmed')
    elif r == 'wife':
        pass   # in facts.csv with the wedding date
    elif 'dora' in r:
        rel(X, 'relative_of', ref('Dora Stemmer'), role=r.replace(' of dora', ''), certainty='confirmed')
    else:
        rel(X, 'relative_of', J, role=r, certainty='confirmed')

# 3. hand-curated facts
for f in read('facts.csv'):
    df, dt = fuzzy_date(f['date_text'])
    rel(ref(f['subject']), f['predicate'], ref(f['object']), role=f['role'] or None,
        date_text=f['date_text'] or None, date_from=df, date_to=dt,
        source_id=tape(f['tape']) if f['tape'] else None,
        start_sec=secs(f['time']) if f['time'] else None,
        certainty=f['certainty'] or 'to_verify', note=f['note'] or None)

# 4. journeys: journey entity, one event per leg, from/to/part_of relations
for j in read('journeys.csv'):
    js = add_entity('journey', j['journey'])
    leg_name = f"{j['journey']}, leg {j['leg']}: {RENAME.get(j['from'], j['from'])} to {RENAME.get(j['to'], j['to'])}"
    df, dt = fuzzy_date(j['date_text'])
    ls = add_entity('event', leg_name, date_text=j['date_text'], date_from=df, date_to=dt,
                    summary=j['note'] or None,
                    attrs={'kind': 'journey_leg', 'mode': j['mode'], 'drawing':
                           'snap_to_roads' if j['mode'] in ('car', 'bus', 'truck', 'walk') else 'manual',
                           'path': None})
    L = f"(select id from entities where slug = {q(ls)})"
    rel(L, 'part_of', f"(select id from entities where slug = {q(js)})", sort_order=int(j['leg']))
    rel(L, 'departs_from', ref(j['from']))
    rel(L, 'arrives_at', ref(j['to']))
    rel(J, 'participant_in', L, role='refugee')
    rel(tape(j['tape']), 'animates', L, start_sec=secs(j['time']), origin='batch:tapes')


# 5. scans in Historic documents: one media row per file; files with a
#    person's name become one document per person+kind, with 'about'.
SCANS = """2721ca3fcb56dbb89e53a4435e2af019.jpg|31_494_0_1_156_9558596.jpg|33_276_0_-_14_9572231.jpg|33_276_0_-_158_62788821.jpg|david stemmer 2.pdf|david stemmer 3.pdf|david stemmer 4.pdf|david stemmer 5.pdf|david stemmer other card 1.pdf|david stemmer other card 2.pdf|david stemmer other card 3.pdf|david stemmer.pdf|helena berglas concentration.pdf|helena berglas westerbork back.pdf|helena berglas westerbork back2.pdf|helena berglas westerbork second copy.pdf|malke berglas westerbork back.pdf|malke berglas westerbork.pdf|marek radler.pdf|MLR austor hungarian.jpg|mrek radler.pdf|NL-HaHGA_0335-01_1665_2307.30.jpg|NL-HaHGA_0335-01_1708_2443.39.jpg|NL-HaHGA_0354-01_128_0124.jpg|NL-HaHGA_0354-01_1410_0169.jpg|NL-HaHGA_0354-01_3104_0036.jpg|rachelle radler.pdf|radler chaskel check 2.pdf|radler chaskel check.pdf|rosa stemmer.pdf|sara hana cc.pdf|sara hana radler.pdf""".split('|')
SCAN_DOCS = [  # (filename prefix, document title, person, certainty)
    ('david stemmer other card', 'David Stemmer, second card', 'David Loeb Stemmer', 'probable'),
    ('david stemmer', 'David Stemmer, card', 'David Loeb Stemmer', 'probable'),
    ('helena berglas westerbork', 'Westerbork card: Helena Berglas', 'Helena Berglas', 'confirmed'),
    ('helena berglas concentration', 'Camp card: Helena Berglas', 'Helena Berglas', 'confirmed'),
    ('malke berglas westerbork', 'Westerbork card: Malke Berglas', 'Malke Berglas', 'confirmed'),
    ('marek radler', 'Marek Radler, card', 'Marek Radler', 'confirmed'),
    ('mrek radler', 'Marek Radler, card', 'Marek Radler', 'confirmed'),
    ('rachelle radler', 'Rachelle Radler, card', 'Rachelle Radler', 'confirmed'),
    ('radler chaskel', 'Chaskel Radler, check', 'Chaskel Radler', 'confirmed'),
    ('rosa stemmer', 'Rosa Stemmer, card', 'Rosa Stemmer', 'probable'),
    ('sara hana', 'Sara Hana Radler, card', 'Sara Hana Radler', 'confirmed'),
]
media_sql, page_sql = [], []
pos = {}
for fn in SCANS:
    path = 'scans/' + slugify(fn.rsplit('.', 1)[0]) + '.' + fn.rsplit('.', 1)[1].lower()
    mime = 'application/pdf' if fn.lower().endswith('.pdf') else 'image/jpeg'
    media_sql.append(f"  ({q(path)}, {q(mime)}, {q(fn)})")
    for prefix, title, person, cert in SCAN_DOCS:
        if fn.lower().startswith(prefix):
            ds = add_entity('document', title, summary='Scan in Historic documents. Archive and reference to be added.',
                            certainty=cert)
            if not any(r[1] == 'about' and r[0].endswith(q(ds) + ')') for r in rels):
                rel(f"(select id from entities where slug = {q(ds)})", 'about', ref(person),
                    role='holder', certainty=cert,
                    note=None if cert == 'confirmed' else 'Matched by name only')
            pos[ds] = pos.get(ds, 0) + 1
            page_sql.append(f"insert into entity_pages (entity_id, position, label, image_id) select "
                            f"(select id from entities where slug = {q(ds)}), {pos[ds]}, {q(fn.rsplit('.',1)[0])}, "
                            f"(select id from media where storage_path = {q(path)});")
            break

# ---------- write SQL ----------------------------------------------------
sql = ['-- Generated by tools/build_seed.py from the CSVs in tagging/. Do not edit by hand:',
       '-- change the CSVs and run the script again.',
       '-- Load order: schema.sql, tapes.sql, seed.sql', 'begin;', '']

sql.append("update entities set attrs = attrs || '{\"recorded_note\": \"Interview with Jonas Stemmer by Peter Engelsman, Scheveningen, 3 March 1997. Language: Dutch.\"}'::jsonb, "
           "date_text = '3 March 1997', date_from = '1997-03-03', date_to = '1997-03-03' where type = 'tape';\n")

cols = ['type', 'slug', 'name', 'summary', 'date_text', 'date_from', 'date_to',
        'lat', 'lng', 'coord_precision', 'attrs', 'certainty']
rows = []
for e in entities.values():
    vals = []
    for c in cols:
        v = e.get(c)
        if c == 'attrs':
            vals.append(q(json.dumps(v or {}, ensure_ascii=False)) + '::jsonb')
        elif c in ('lat', 'lng'):
            vals.append(str(float(v)) if v not in (None, '') else 'null')
        elif c == 'certainty':
            vals.append(q(v or 'to_verify'))
        elif c == 'type':
            vals.append(q(v) + '::entity_type')
        else:
            vals.append(q(v.isoformat() if isinstance(v, date) else v))
    rows.append('  (' + ', '.join(vals) + ')')
sql.append(f"insert into entities ({', '.join(cols)}) values\n" + ',\n'.join(rows) + ';\n')

for s, p, o, kw in rels:
    keys = ['role', 'sort_order', 'date_text', 'date_from', 'date_to', 'source_id',
            'start_sec', 'end_sec', 'note', 'certainty', 'origin']
    vals = []
    for k in keys:
        v = kw.get(k)
        if k == 'source_id':
            vals.append(v or 'null')
        elif isinstance(v, date):
            vals.append(q(v.isoformat()))
        elif k == 'certainty':
            vals.append(q(v or 'to_verify') + '::certainty')
        elif k == 'origin':
            vals.append(q(v or 'batch:facts'))
        else:
            vals.append(q(v))
    sql.append(f"insert into relations (subject_id, predicate, object_id, {', '.join(keys)}) "
               f"values ({s}, {q(p)}, {o}, {', '.join(vals)});")

sql.append('\ninsert into media (storage_path, mime_type, original_filename) values\n' + ',\n'.join(media_sql) + ';')
sql += page_sql
sql += ['', 'commit;']
OUT.write_text('\n'.join(sql) + '\n', encoding='utf-8')
from collections import Counter
print(f'wrote {OUT}: {len(entities)} entities {dict(Counter(e["type"] for e in entities.values()))}, {len(rels)} relations')
