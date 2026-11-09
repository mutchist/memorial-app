# Interactive Testimony Site — Concept

## Purpose
A private, family-oriented website built around a grandfather's recorded Holocaust testimony (four tapes, ~2 hours, Dutch with English subtitles). As he speaks, the page shows the context behind his words: the places he mentions on a map, the people as portraits, and related documents and photographs. The aim is to make the testimony easier to follow, easier to understand, and easier to pass on to the next generations.

Inspiration for look and feel: https://bennos-light.org/ (quiet, immersive, respectful). A crude clickable mockup already exists (`testimony-mockup.html`) and shows the basic layout and interactions.

## Core experience
- **Watch view:** the video (YouTube embed, unlisted) with synced subtitles, a language toggle (English / Dutch), and a timeline across all four tapes with markers for places, people, documents and photos.
- **Context panel:** next to the video, content changes with what is being said.
  - A map moves to the place mentioned and draws his route as the story unfolds.
  - A portrait card appears when a person is named.
  - A document or photo appears as a thumbnail that opens a popup.
- **Popups:** documents open as zoomable scans (front and back where relevant) with a transcription and English translation. Each popup lists every moment in the tapes where the item is mentioned (click to jump there) and links out to Wikipedia, archives or other sources.
- **Explore view:** browse everything by Places, People, Documents or Photos, independent of the video. Each item shows where it appears in the tapes.
- **About page:** family introduction, a content note, family tree, glossary of terms, and a quiet memorial element.

## Map
- Open source map (MapLibre or Leaflet with OpenStreetMap-based tiles), not Google. It allows the route to animate in sync with the video, supports historical routes and old-map overlays, and has no billing dependency.
- Each journey is made of legs with a **mode**: walking, car, train, ship, etc., each drawn in a distinct style with an icon.
- Car and walking legs can snap to roads automatically; train and ship legs are drawn by hand so historical routes are accurate.
- Every place also gets an "Open in Google Maps" link.

## Documents
- Documents (letters, census and registration cards, photos, certificates) are scanned images with a transcription and translation alongside.
- Dutch registration cards also feed the map: addresses and dates become dated residence pins.
- For forms, hovering over a column heading shows its English meaning.
- Transcriptions of handwriting are marked "to verify" until the owner approves them.

## Managing content
The site should not depend on a developer for routine changes. The owner does not code, so editing must be point-and-click.

1. **Data-driven site:** tapes, cues, places, routes, people and documents live as simple structured data plus an image folder. Adding content never means changing code.
2. **Built-in editor** (owner only):
   - Pause the video and "tag this moment" with a place, person, photo or document.
   - Draw or adjust routes on the map and set the mode for each leg.
   - Upload a scan, add its transcription, translation and links.
   - Preview as visitors see it, then publish.
3. **Claude Code** is used for bigger work: new features, redesigns, batch-tagging the tapes from the transcripts, and transcribing or translating documents.

## Privacy
- Family-only. The site contains named relatives and personal documents, so it should not be publicly discoverable.
- Visitors sign in (or use a protected link). Supabase (already used in other projects) is the likely choice for sign-in and private file storage.
- YouTube videos set to Unlisted or Private. Embedded playback depends on that setting.
- The editor is behind a separate owner login.

## Suggested build order
1. Visual design and look, based on the mockup and the reference site.
2. Watch view: video, subtitles, timeline, with the data-driven structure underneath.
3. Real map with animated, mode-styled routes.
4. Document and photo popups, including the census-card viewer.
5. Explore view and cross-links between items.
6. Owner editor.
7. Private access (sign-in), then content entry for all four tapes.
8. About page extras: family tree, glossary, memorial.

## Open questions
- Who should have access, and how do they get in (invite, shared password, sign-in)?
- Languages beyond English and Dutch (Hebrew)?
- Hosting choice and domain, if any.
- How much of the family's existing archive (photos, letters, certificates) is already scanned?
- Should visitors be able to add comments or memories, or is the site read-only?
