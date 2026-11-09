# Watch view

The page reads its data live from Supabase through `site_data()`. Put the
project URL and publishable key in `config.js` (Supabase: Project Settings >
API Keys). Both are safe to publish: visitors can only read published rows.

Open `index.html` in a browser, or host the folder on any static host.

- If `config.js` is empty or the database can't be reached, the page says so.
- If nothing is published yet, the page says so.
- Labels, colours, route line styles and map zoom per kind of place come from
  the database tables `entity_types` and `attr_options`, not from this code.
- Once a tape's YouTube ID is set, the real video plays and drives everything.
  Until then the play button runs the subtitles on their own at a preview speed.
- Map: MapLibre (in `vendor/`) with OpenFreeMap tiles. No account or key needed.
- `data/data.js` is no longer used and can be deleted.

# Admin

Open `admin.html` and sign in with your Supabase admin account.

- Library on the left: search, filter by type, status and certainty, select
  several and publish or unpublish them together.
- Editor: the fields for each type come from `attr_fields` and `attr_options`
  in the database, so a new field or choice is a new row there.
- Connections: only the kinds of connection allowed for that type are offered
  (from `relation_types`), and the database checks them again.
- History: every change is kept in `revisions`; changes to an item can be undone.
- Journeys: open a journey to get its route map. Add, edit, reorder and remove
  legs; pick places on the map or click empty map to create a new place; set
  the tape moment when each leg draws; draw a leg's path by hand. The Watch
  view follows hand-drawn paths.
- Documents and photos: a "Scans" section to upload pages (image or PDF),
  name each side, add transcription and English translation, and reorder.
  Files go to Supabase Storage, bucket "scans" (public).
- "Scan files" (top right): upload many files at once. Each one is matched to
  a scan already listed in the database by its exact file name.
- The Watch view shows a document's scans, transcription and translation.

## Document page

`document.html?d=<slug>` shows one document or photo: the scans with hover
labels (`page_fields`), transcription and English translation per page, the
details from `attr_fields`, connections, and a download of the original file.
"Save as PDF / print" has its own print layout (light paper, all labels
numbered and listed, both texts). Shared code with the Watch view is in
`common.js`. The Watch view opens an item from `index.html#open=<slug>` and a
tape moment from `index.html#tape=<n>&t=<seconds>`.

Scan files are named `<slug>_<NN>-<page label>.<ext>` and
`<slug>_original.<ext>`; see `upload/HOW-TO-LOAD.md`.
