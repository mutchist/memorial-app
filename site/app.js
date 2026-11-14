/* Watch view. Reads site_data() from Supabase (see config.js). Labels,
   colours, route styles and map zooms all come from the database
   vocabulary (entity_types, attr_options, relation_types). */
(() => {
  'use strict';
  const { $, el, esc, fmt, nullsLast, fileUrl, showError, loadData } = Site;
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  // config.js sets where the map opens (mapHome: { center: [lng, lat], zoom })
  const HOME = window.SITE_CONFIG.mapHome;
  if (!HOME || !Array.isArray(HOME.center) || typeof HOME.zoom !== 'number') return showError('The map is not set up', 'config.js needs mapHome: { center: [lng, lat], zoom }.');

  loadData().then(D => {
    if (!D.tapes.length) return showError('Nothing is published yet', 'Publish the tapes and their moments in the admin to show them here.');
    start(D);
  }, err => showError('The testimony could not be loaded', err.message));

  function start(D) {
  const { E, BY_SLUG, RT, ET, OPT, PAGES, option, kindLabel } = Site.index(D), R = D.relations;
  const TAPES = D.tapes;
  const typeClass = t => 't-' + t;
  document.head.appendChild(el('style', null, D.entity_types.map(t => `.t-${t.key}{background:${t.color}}`).join('\n')));

  // ---------- derived data ----------
  const tapeIdx = {}; TAPES.forEach((t, i) => { tapeIdx[t.id] = i; t.duration = +t.duration; });
  const offsets = []; let total = 0; TAPES.forEach(t => { offsets.push(total); total += t.duration; });
  const G = (ti, t) => offsets[ti] + t;

  const moments = TAPES.map(() => []);      // per tape: {t0, id, note, certainty}
  const animates = [];                        // {g, leg}
  const pictures = TAPES.map(() => []);     // per tape: pictures on screen {t0, t1, id, note, page}
  R.forEach(r => {
    const s = E[r.s];
    if (!s || s.type !== 'tape' || r.t0 == null) return;
    const ti = tapeIdx[r.s];
    if (r.p === 'mentions' || r.p === 'shows' || r.p === 'illustrates') moments[ti].push({ ti, t0: +r.t0, id: r.o, note: r.note, certainty: r.certainty, watch: r.watch });
    if (r.p === 'animates') animates.push({ g: G(ti, +r.t0), leg: r.o });
    if (r.p === 'illustrates') {
      const img = r.o in PAGES ? PAGES[r.o].find(p => p.mime.startsWith('image/')) : undefined;
      if (img === undefined) console.error(`"${E[r.o].name}" is set to show on screen but has no uploaded picture`);
      else pictures[ti].push({ t0: +r.t0, t1: +r.t1, id: r.o, note: r.note, page: img });
    }
  });
  moments.forEach(m => m.sort((a, b) => a.t0 - b.t0));
  const allMoments = moments.flat().map(m => ({ ...m, g: G(m.ti, m.t0) })).sort((a, b) => a.g - b.g);

  // journeys and legs
  const legs = {};
  R.forEach(r => {
    if (!['departs_from', 'arrives_at', 'part_of'].includes(r.p)) return;
    if (!(r.s in legs)) legs[r.s] = { id: r.s, mode: E[r.s].attrs.mode, path: 'path' in E[r.s].attrs ? E[r.s].attrs.path.coordinates : null };
    const L = legs[r.s];
    if (r.p === 'departs_from') L.from = r.o;
    if (r.p === 'arrives_at') L.to = r.o;
    if (r.p === 'part_of') { L.journey = r.o; L.order = r.order; }
  });
  const legProgress = {};   // leg id -> 0..1 drawn
  Object.keys(legs).forEach(id => legProgress[id] = 0);
  const legAnimations = animates.filter(a => a.leg in legs).sort((a, b) => a.g - b.g);
  const MODES = OPT['event.mode'];
  // estimated positions for places with no coordinates: interpolate along each journey
  const coord = {};
  Object.entries(E).forEach(([id, e]) => { if (e.type === 'place' && e.lat != null) coord[id] = [e.lng, e.lat]; });
  const estimated = new Set();
  const byJourney = {};
  Object.values(legs).forEach(L => (byJourney[L.journey] ||= []).push(L));
  Object.values(byJourney).forEach(list => {
    list.sort((a, b) => a.order - b.order);
    const pts = [list[0].from, ...list.map(l => l.to)];
    pts.forEach((p, i) => {
      if (coord[p]) return;
      let a = i - 1; while (a >= 0 && !coord[pts[a]]) a--;
      let b = i + 1; while (b < pts.length && !coord[pts[b]]) b++;
      if (a < 0 && b >= pts.length) return;
      const A = coord[pts[a]] || coord[pts[b]], B = coord[pts[b]] || coord[pts[a]];
      const f = a < 0 || b >= pts.length ? 0 : (i - a) / (b - a);
      coord[p] = [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f];
      estimated.add(p);
    });
  });

  // ---------- state ----------
  const st = { ti: 0, t: 0, playing: false, lastNowKey: '', lastPlace: null, yt: null, ytReady: false, picToMap: null, storyKey: null, stripNow: null };
  const tape = () => TAPES[st.ti];
  const g = () => G(st.ti, st.t);

  // one joined video: moments are just a time
  const at = (ti, t) => TAPES.length > 1 ? `Tape ${TAPES[ti].number} · ${fmt(t)}` : fmt(t);
  const cueAt = (cues, t) => { let lo = 0, hi = cues.length - 1, ans = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (+cues[m][0] <= t) { ans = m; lo = m + 1; } else hi = m - 1; } return ans; };

  // ---------- player: the YouTube player is the only control; the page follows it ----------
  const ytOn = () => st.ytReady && !!tape().youtube_id;
  function play() { if (ytOn()) st.yt.playVideo(); }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeDrawer();
    if (e.code === 'Space' && ytOn() && !['SELECT', 'INPUT', 'BUTTON', 'TEXTAREA', 'A'].includes(document.activeElement.tagName)) {
      e.preventDefault(); st.playing ? st.yt.pauseVideo() : st.yt.playVideo();
    }
  });
  TAPES.forEach(t => { if (!t.youtube_id) console.error(`"${t.name}" has no YouTube video set (admin > the tape > youtube_id)`); });
  const posterNote = msg => { $('#posterNote').textContent = msg; };
  if (TAPES.some(t => t.youtube_id)) {
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => { console.error('The YouTube player could not load'); posterNote('The video could not load. Check the connection and reload the page.'); };
    document.head.appendChild(s);
    window.onYouTubeIframeAPIReady = () => {
      const opts = { playerVars: { rel: 0, modestbranding: 1, cc_load_policy: 1 } };
      if (tape().youtube_id) opts.videoId = tape().youtube_id;
      st.yt = new YT.Player('yt', { ...opts,
        events: { onReady: () => { st.ytReady = true; syncPoster(); },
                  onError: e => { console.error('YouTube player error', e.data); posterNote('The video could not be played here.'); },
                  onStateChange: e => { st.playing = e.data === 1; if (e.data === 0) nextTape(); } } });
    };
  } else posterNote('No video is set for the testimony yet.');
  function syncPoster() {
    const hasVideo = ytOn();
    $('#poster').style.display = hasVideo ? 'none' : 'flex';
    $('#yt').style.display = hasVideo ? 'block' : 'none';
    $('#posterTape').textContent = tape().name;
  }
  function nextTape() { if (st.ti < TAPES.length - 1) { seek(st.ti + 1, 0); play(); } }

  function seek(ti, t) {
    const changed = ti !== st.ti;
    const jump = Math.abs(G(ti, t) - g()) > 8;
    st.ti = ti; st.t = t;
    if (changed) syncPoster();
    if (ytOn()) { if (changed) st.yt.cueVideoById(tape().youtube_id, t); else st.yt.seekTo(t, true); }
    render(jump);
  }

  // follow the video while it plays
  setInterval(() => {
    if (!st.playing || !ytOn()) return;
    st.t = st.yt.getCurrentTime();
    render(false);
  }, 200);

  function render(jump) {
    renderStage(st.t);
    renderContext();
    renderStory();
    renderMap(jump);
  }

  // ---------- stage (right panel): a picture while one is on screen, else the map ----------
  const AREA_KEY = 'area';   // place attrs field with its outline (GeoJSON Polygon/MultiPolygon)
  const stage = $('#stage'), stagePic = $('#stagePic');
  let picNow = null;
  // a photo that shows a place with a pin gets a small map of that place in its corner
  const DEPICTS = 'depicts';
  const placeShownIn = id => { const r = R.find(x => x.p === DEPICTS && x.s === id && x.o in E && E[x.o].type === 'place' && x.o in coord); return r === undefined ? null : r.o; };
  let loc = null;   // { node, map, marker } made on first use, moved into each picture
  function locator(placeId) {
    if (loc === null) {
      const node = el('button', 'sp-loc'); node.type = 'button';
      node.innerHTML = '<div class="sp-locmap"></div><span class="sp-locname"></span>';
      const m = new maplibregl.Map({ container: node.firstChild, style: REMOTE_STYLE, center: coord[placeId], zoom: 12, interactive: false, attributionControl: false });
      m.on('error', ev => console.error('Small map could not load:', ev.error));
      const marker = new maplibregl.Marker({ color: ACCENT }).setLngLat(coord[placeId]).addTo(m);
      loc = { node, map: m, marker };
    }
    const zoom = option(E[placeId], 'kind').display.zoom;
    loc.node.querySelector('.sp-locname').textContent = E[placeId].name;
    loc.node.setAttribute('aria-label', 'Show ' + E[placeId].name + ' on the big map');
    loc.node.onclick = () => { st.picToMap = picNow; map.flyTo({ center: coord[placeId], zoom, essential: true }); renderStage(st.t); };
    loc.marker.setLngLat(coord[placeId]);
    requestAnimationFrame(() => { loc.map.resize(); loc.map.jumpTo({ center: coord[placeId], zoom }); });
    return loc.node;
  }
  function showPicture(p) {
    const e = E[p.id], pg = p.page, url = esc(fileUrl(pg.path));
    stagePic.innerHTML = `<button type="button" class="sp-frame" style="--dur:${Math.max(4, p.t1 - p.t0)}s" aria-label="${esc('Open ' + e.name)}">
        <img class="sp-bg" src="${url}" alt=""><img class="sp-fg" src="${url}" alt="${esc('alt' in pg ? pg.alt : e.name)}"></button>
      <figcaption><span class="k">${esc(kindLabel(e))}</span><span class="n">${esc(e.name)}</span>${p.note ? `<span class="note">${esc(p.note)}</span>` : ''}${'credit' in pg ? `<span class="cr">${esc(pg.credit)}</span>` : ''}</figcaption>`;
    stagePic.querySelector('button').onclick = () => openEntity(p.id);
    stagePic.querySelector('.sp-fg').onerror = ev => ev.target.closest('button').replaceWith(el('div', 'missing', 'Picture file not uploaded yet'));
    const placeId = placeShownIn(p.id);
    if (placeId !== null) stagePic.appendChild(locator(placeId));
  }
  function renderStage(t) {
    const p = pictures[st.ti].find(x => t >= x.t0 && t <= x.t1);
    const pnow = p === undefined ? null : p;
    if (pnow !== picNow) { picNow = pnow; st.picToMap = null; if (pnow !== null) showPicture(pnow); }
    // the picture wins, unless its small map was clicked (then the big map shows until the picture's time is over)
    const mode = picNow !== null && st.picToMap !== picNow ? 'pic' : 'map';
    if (mode !== st.stageMode) { st.stageMode = mode; stage.classList.remove('mode-pic', 'mode-map'); stage.classList.add('mode-' + mode); }
  }

  // ---------- now ticker: the items mentioned in the last HOLD seconds, newest first ----------
  const tickerBox = $('#tickerItems');
  $('#ticker').hidden = !allMoments.some(m => m.watch);
  const HOLD = 45;   // seconds a mention stays "now"
  const TICKER_MAX = 6;
  function tickerItem(m) {
    const e = E[m.id];
    const c = el('button', 'tk-item', `<i class="dot ${typeClass(e.type)}"></i>${esc(e.name)}<span class="k">${esc(kindLabel(e))}${e.date_text && e.type === 'event' ? ' · ' + esc(e.date_text) : ''}</span>`);
    c.type = 'button'; c.dataset.key = m.id + '@' + m.g;
    const sub = [m.note, e.summary].find(x => x && x !== e.name);
    if (sub) c.title = sub;
    c.onclick = () => openEntity(m.id);
    return c;
  }
  function renderContext() {
    const G0 = g();
    const past = [];
    for (const m of allMoments) { if (m.g > G0) break; past.push(m); }
    const nowList = [], seen = new Set();
    // only the moments switched on for the Watch page (admin > Tape moments)
    for (let i = past.length - 1; i >= 0 && nowList.length < TICKER_MAX; i--) {
      const m = past[i]; if (G0 - m.g > HOLD) break;
      if (m.watch && !seen.has(m.id)) { seen.add(m.id); nowList.push(m); }
    }
    const key = nowList.map(m => m.id + '@' + m.g).join('|') + '#' + past.length;
    if (key === st.lastNowKey) return;
    st.lastNowKey = key;
    // keep the items already showing (no re-animation); new ones slide in on the left
    const have = {}; [...tickerBox.querySelectorAll('.tk-item')].forEach(n => have[n.dataset.key] = n);
    tickerBox.replaceChildren(...nowList.map(m => have[m.id + '@' + m.g] || tickerItem(m)));
    if (!nowList.length) tickerBox.appendChild(el('span', 'tk-empty', past.some(m => m.watch) ? 'Listening…' : 'Places, people and documents appear here as Jonas mentions them.'));

    // place for the map overlay (the date comes from the story dates, renderStory)
    const lastPlace = [...past].reverse().find(m => E[m.id].type === 'place');
    $('#where').textContent = lastPlace ? E[lastPlace.id].name : '';
    st.storyKey = null; renderStory();
  }

  // ---------- story date and year strip ----------
  // Story dates are set by hand in the admin (Tape moments): from that moment on, the story is at that date,
  // across tapes, until the next one. The strip shows every dated event; the marker shows the story date now.
  const STRIP_FOLLOW_PAUSE_MS = 8000;   // after a drag, the strip does not slide to the story date for this long
  // the database update 2026-11-12-story-dates.sql adds story_dates to each tape; until it is run there are none (said in the console)
  const hasStoryDates = TAPES.every(T => 'story_dates' in T);
  if (!hasStoryDates) console.error('Story dates are missing: run data-model/updates/2026-11-12-story-dates.sql in Supabase');
  const storyDates = !hasStoryDates ? [] : TAPES.flatMap((T, ti) => T.story_dates.map(d => ({ g: G(ti, +d.t), text: d.text, year: yearOf(d.from) }))).sort((a, b) => a.g - b.g);
  function yearOf(iso) { const d = new Date(iso + 'T00:00:00Z'); const y = d.getUTCFullYear(); return y + (d - Date.UTC(y, 0, 1)) / (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1)); }
  const dated = Object.values(E).filter(e => e.type === 'event' && e.date_from).map(e => ({ id: e.id, year: yearOf(e.date_from) }));
  const strip = $('#yearStrip');
  // the years in view at the start are set in config.js (storyYears, first and last year); drag for the others
  const [V0, V1] = Array.isArray(window.SITE_CONFIG.storyYears) ? window.SITE_CONFIG.storyYears : [null, null];
  if (V0 === null) console.error('config.js has no storyYears: the year strip is off');
  const allYears = [...dated.map(d => d.year), ...storyDates.map(d => d.year)];
  const F0 = Math.floor(Math.min(V0, ...allYears)), F1 = Math.floor(Math.max(V1, ...allYears)) + 1;   // whole years, end exclusive
  const xOf = y => ((y - F0) / (F1 - F0) * 100) + '%';
  const stripMarks = {};
  const view = el('div', 'ys-view');
  let lastDrag = -Infinity;
  if (V0 === null) strip.hidden = true;
  else {
    const track = el('div', 'ys-track');
    track.style.width = ((F1 - F0) / (V1 + 1 - V0) * 100) + '%';
    for (let y = F0; y <= F1; y++) { const t = el('span', 'ys-tick', `<b>${y}</b>`); t.style.left = xOf(y); track.appendChild(t); }
    dated.forEach(d => {
      const e = E[d.id], b = el('button', 'ys-mark');
      b.style.left = xOf(d.year); b.title = `${e.name}${e.date_text ? ' · ' + e.date_text : ''}`; b.setAttribute('aria-label', b.title);
      b.onclick = ev => { if (view.dataset.dragged === '1') { ev.preventDefault(); return; } openEntity(d.id); };
      stripMarks[d.id] = b; track.appendChild(b);
    });
    const now = el('div', 'ys-now'); now.innerHTML = '<span></span>'; now.hidden = true; track.appendChild(now);
    view.appendChild(track); strip.append(view, el('div', 'ys-hint', 'Drag for other years'));
    st.stripNow = now;
    // open on the configured years
    requestAnimationFrame(() => { view.scrollLeft = (V0 - F0) / (F1 - F0) * track.offsetWidth; });
    // drag with the mouse (touch scrolls natively); a drag is not a click on a mark
    let drag = null;
    view.addEventListener('pointerdown', ev => { if (ev.pointerType !== 'mouse') return; drag = { x: ev.clientX, left: view.scrollLeft }; view.dataset.dragged = '0'; });
    window.addEventListener('pointermove', ev => {
      if (drag === null) return;
      const dx = ev.clientX - drag.x;
      if (Math.abs(dx) > 4) { view.dataset.dragged = '1'; view.classList.add('dragging'); }
      view.scrollLeft = drag.left - dx;
    });
    window.addEventListener('pointerup', () => { if (drag === null) return; drag = null; view.classList.remove('dragging'); lastDrag = performance.now(); });
    view.addEventListener('scroll', () => { if (drag !== null || view.dataset.dragged === '1') lastDrag = performance.now(); }, { passive: true });
    view.addEventListener('touchmove', () => { lastDrag = performance.now(); }, { passive: true });
  }
  // slide the strip so the story date is in view, unless someone just dragged it
  function followStory(year) {
    if (performance.now() - lastDrag < STRIP_FOLLOW_PAUSE_MS) return;
    const track = view.firstChild, x = (year - F0) / (F1 - F0) * track.offsetWidth;
    if (x < view.scrollLeft + 20 || x > view.scrollLeft + view.clientWidth - 20) view.scrollTo({ left: x - view.clientWidth / 2, behavior: 'smooth' });
  }
  function renderStory() {
    const G0 = g();
    let cur = null; for (const d of storyDates) { if (d.g <= G0) cur = d; else break; }
    const seenIds = new Set(); for (const m of allMoments) { if (m.g > G0) break; seenIds.add(m.id); }
    const key = (cur ? cur.g : '-') + '|' + seenIds.size;
    if (key === st.storyKey) return;
    st.storyKey = key;
    $('#when').textContent = cur ? cur.text : '';
    if (V0 === null) return;
    st.stripNow.hidden = !cur;
    if (cur) { st.stripNow.style.left = xOf(cur.year); st.stripNow.firstChild.textContent = cur.text; followStory(cur.year); }
    Object.entries(stripMarks).forEach(([id, b]) => b.classList.toggle('seen', seenIds.has(id)));
  }

  // ---------- map ----------
  const REMOTE_STYLE = 'https://tiles.openfreemap.org/styles/dark';
  const INK = css('--ink'), BG = css('--bg'), ACCENT = css('--accent');
  const OFFLINE_STYLE = { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': css('--surface') } }] };
  Site.rtlLabels();
  const map = new maplibregl.Map({ container: 'map', style: REMOTE_STYLE, center: HOME.center, zoom: HOME.zoom, attributionControl: { compact: true }, cooperativeGestures: false });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  let mapReady = false, usedFallback = false;
  const failTimer = setTimeout(() => { if (!mapReady) useFallback(); }, 7000);
  map.on('error', () => { if (!mapReady) useFallback(); });
  function useFallback() {
    if (usedFallback) return; usedFallback = true;
    map.setStyle(OFFLINE_STYLE);
    const n = el('div', 'map-fallback', 'Map tiles could not load (offline?). Routes and places still show.');
    n.style.pointerEvents = 'none'; $('.stage-map').appendChild(n); setTimeout(() => n.remove(), 6000);
  }
  map.on('style.load', () => {
    clearTimeout(failTimer); mapReady = true;
    const empty = { type: 'FeatureCollection', features: [] };
    ['legs', 'visited', 'current', 'area'].forEach(id => { if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: empty }); });
    const line = (id, filter, paint) => { if (!map.getLayer(id)) map.addLayer({ id, type: 'line', source: 'legs', filter, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint }); };
    Object.values(MODES).forEach(o => {
      const d = o.display, paint = { 'line-color': d.color, 'line-width': d.width };
      if (d.dash) paint['line-dasharray'] = d.dash;
      line('leg-' + o.value, ['==', ['get', 'mode'], o.value], paint);
    });
    // the outline of the current place, if it has one (place attrs.area, e.g. a neighbourhood)
    if (!map.getLayer('area-fill')) map.addLayer({ id: 'area-fill', type: 'fill', source: 'area', paint: { 'fill-color': ACCENT, 'fill-opacity': .14 } });
    if (!map.getLayer('area-line')) map.addLayer({ id: 'area-line', type: 'line', source: 'area', paint: { 'line-color': ACCENT, 'line-width': 1.6, 'line-opacity': .8 } });
    if (!map.getLayer('visited')) map.addLayer({ id: 'visited', type: 'circle', source: 'visited', paint: {
      'circle-radius': 4, 'circle-color': ['case', ['get', 'est'], 'rgba(0,0,0,0)', INK], 'circle-stroke-color': INK,
      'circle-stroke-width': ['case', ['get', 'est'], 1.2, 0], 'circle-opacity': .8 } });
    if (!map.getLayer('current-halo')) map.addLayer({ id: 'current-halo', type: 'circle', source: 'current', paint: { 'circle-radius': 16, 'circle-color': ACCENT, 'circle-opacity': .18, 'circle-blur': .4 } });
    if (!map.getLayer('current')) map.addLayer({ id: 'current', type: 'circle', source: 'current', paint: { 'circle-radius': 6, 'circle-color': ACCENT, 'circle-stroke-color': BG, 'circle-stroke-width': 2 } });
    if (!map.getLayer('labels')) map.addLayer({ id: 'labels', type: 'symbol', source: 'current', layout: usedFallback ? { visibility: 'none' } : {
      'text-field': ['get', 'name'], 'text-size': 13, 'text-offset': [0, 1.3], 'text-anchor': 'top', 'text-font': ['Noto Sans Regular'] },
      paint: { 'text-color': INK, 'text-halo-color': BG, 'text-halo-width': 1.5 } });
    ['visited', 'current'].forEach(id => {
      map.on('click', id, e => openEntity(e.features[0].properties.id));
      map.on('mouseenter', id, () => map.getCanvas().style.cursor = 'pointer');
      map.on('mouseleave', id, () => map.getCanvas().style.cursor = '');
    });
    st.mapKey = null; renderMap(true);
  });

  const usedModes = new Set(Object.values(legs).map(L => L.mode)), modeLegend = new Set();
  Object.values(MODES).forEach(o => {
    const d = o.display;
    if (!usedModes.has(o.value) || modeLegend.has(d.legend)) return; modeLegend.add(d.legend);
    const dash = d.dash ? ` stroke-dasharray="${d.dash.map(x => x * d.width).join(' ')}"` : '';
    $('#mapLegend').appendChild(el('span', '', `<svg class="ln" viewBox="0 0 18 4" width="18" height="4"><line x1="1" y1="2" x2="17" y2="2" stroke="${d.color}" stroke-width="${d.width}" stroke-linecap="round"${dash}/></svg>${esc(d.legend)}`));
  });

  let animating = false;
  function legFeature(L) {
    const pts = L.path !== null ? L.path : (coord[L.from] && coord[L.to] ? [coord[L.from], coord[L.to]] : null);
    if (!pts) return null;
    const f = legProgress[L.id]; if (f <= 0) return null;
    return { type: 'Feature', properties: { mode: L.mode, id: L.id }, geometry: { type: 'LineString', coordinates: partialLine(pts, f) } };
  }
  // the first fraction f (0..1) of a polyline, by length
  function partialLine(pts, f) {
    const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
    let left = seg.reduce((a, b) => a + b, 0) * f;
    const out = [pts[0]];
    for (let i = 0; i < seg.length; i++) {
      if (left >= seg[i]) { out.push(pts[i + 1]); left -= seg[i]; continue; }
      const t = seg[i] === 0 ? 0 : left / seg[i], a = pts[i], b = pts[i + 1];
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); break;
    }
    return out;
  }
  function pushLegs() { if (mapReady) map.getSource('legs').setData({ type: 'FeatureCollection', features: Object.values(legs).map(legFeature).filter(Boolean) }); }
  function animateLegs() {
    if (animating) return; animating = true;
    const step = () => {
      let more = false;
      Object.keys(legProgress).forEach(id => { const v = legProgress[id]; if (v > 0 && v < 1) { legProgress[id] = Math.min(1, v + 0.025); more = true; } });
      pushLegs();
      if (more) requestAnimationFrame(step); else animating = false;
    };
    requestAnimationFrame(step);
  }
  function renderMap(jump) {
    if (!mapReady) return;
    const G0 = g();
    // legs
    let changed = false;
    legAnimations.forEach(a => {
      const want = a.g <= G0;
      const cur = legProgress[a.leg];
      if (want && cur === 0) { legProgress[a.leg] = jump ? 1 : 0.02; changed = true; }
      if (!want && cur > 0) { legProgress[a.leg] = 0; changed = true; }
    });
    if (changed) { pushLegs(); animateLegs(); }
    // places
    const visited = new Map(); let current = null;
    for (const m of allMoments) { if (m.g > G0) break; if (E[m.id].type === 'place' && coord[m.id]) { visited.set(m.id, m); if (G0 - m.g <= HOLD) current = m; } }
    const key = visited.size + ':' + (current && current.id);
    if (key === st.mapKey) return;
    st.mapKey = key;
    const feat = id => ({ type: 'Feature', properties: { id, name: E[id].name, est: estimated.has(id) }, geometry: { type: 'Point', coordinates: coord[id] } });
    map.getSource('visited').setData({ type: 'FeatureCollection', features: [...visited.keys()].map(feat) });
    map.getSource('current').setData({ type: 'FeatureCollection', features: current ? [feat(current.id)] : [] });
    const area = current && AREA_KEY in E[current.id].attrs ? E[current.id].attrs[AREA_KEY] : null;
    map.getSource('area').setData({ type: 'FeatureCollection', features: area ? [{ type: 'Feature', properties: {}, geometry: area }] : [] });
    // before any place is mentioned (e.g. at the start), the map shows the home view (config.js mapHome)
    if (visited.size === 0 && st.lastPlace !== null) { st.lastPlace = null; map.flyTo({ ...HOME, speed: jump ? 3 : 0.8, essential: true }); }
    if (current && current.id !== st.lastPlace) {
      st.lastPlace = current.id;
      const zoom = option(E[current.id], 'kind').display.zoom;
      if (area) {   // show the whole outline, no closer than the kind's zoom
        const pts = area.type === 'Polygon' ? area.coordinates.flat() : area.coordinates.flat(2);
        const b = pts.reduce((a, [x, y]) => [Math.min(a[0], x), Math.min(a[1], y), Math.max(a[2], x), Math.max(a[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);
        map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 60, maxZoom: zoom, speed: jump ? 3 : 0.8, curve: 1.5, essential: true });
      } else map.flyTo({ center: coord[current.id], zoom, speed: jump ? 3 : 0.8, curve: 1.5, essential: true });
    }
  }

  // ---------- entity drawer ----------
  const drawer = $('#drawer'), scrim = $('#scrim'), body = $('#drawerBody');
  function closeDrawer() { drawer.classList.remove('show'); scrim.classList.remove('show'); drawer.setAttribute('aria-hidden', 'true'); }
  $('#close').onclick = closeDrawer; scrim.onclick = closeDrawer;
  const cueTextAt = (ti, t) => { const i = cueAt(TAPES[ti].cues, t + 0.01); return i < 0 ? null : TAPES[ti].cues[i][2]; };
  window.__jump = (ti, t) => { closeDrawer(); seek(ti, Math.max(0, t - 1)); play(); };
  window.__open = id => openEntity(id);

  function openEntity(id) {
    const e = E[id]; if (!e) return;
    const facts = [], ms = [];
    R.forEach(r => {
      if (r.p === 'mentions' || r.p === 'shows' || r.p === 'illustrates') { if (r.o === id) ms.push({ ti: tapeIdx[r.s], t: +r.t0, note: r.note }); return; }
      if (r.p === 'animates') return;
      if (r.s !== id && r.o !== id) return;
      const forward = r.s === id, other = forward ? r.o : r.s;
      if (E[other].type === 'tape') return;
      facts.push({ label: forward ? RT[r.p].label : RT[r.p].inverse, other, r });
    });
    facts.sort((a, b) => nullsLast(a.r.order, b.r.order) || nullsLast(a.r.date_text, b.r.date_text));
    let h = `<div class="k">${esc(kindLabel(e))}</div><h1>${esc(e.name)}</h1>`;
    if (e.date_text) h += `<div class="date">${esc(e.date_text)}</div>`;
    if (e.summary) h += `<p class="sum">${esc(e.summary)}</p>`;
    // photos that show this item (photo --depicts--> item), with their credit
    const photos = R.filter(r => r.p === DEPICTS && r.o === id && r.s in PAGES).map(r => ({ r, img: PAGES[r.s].find(pg => pg.mime.startsWith('image/')) })).filter(x => x.img !== undefined);
    if (photos.length && e.type !== 'photo') {
      h += `<div class="photos">`;
      photos.forEach(({ r, img }) => h += `<figure><button type="button" onclick="__open('${r.s}')"><img src="${esc(fileUrl(img.path))}" alt="${esc('alt' in img ? img.alt : E[r.s].name)}" loading="lazy"></button>
        <figcaption>${esc(E[r.s].name)}${'credit' in img ? ` · <span class="credit">${esc(img.credit)}</span>` : ''}</figcaption></figure>`);
      h += `</div>`;
    }
    if (id in PAGES) {
      h += `<div class="btns"><a class="btn" href="${esc(Site.documentLink(e))}">Read the document with its translation →</a></div>`;
      h += `<h3>Scans</h3><div class="scans">`;
      PAGES[id].forEach(p => {
        const url = esc(fileUrl(p.path));
        h += `<figure class="scanfig">${p.mime.startsWith('image/') ? `<a href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="${esc(e.name + ', ' + p.label)}" loading="lazy"></a>`
          : `<a class="pdf" href="${url}" target="_blank" rel="noopener">Open scan (PDF) ↗</a>`}<figcaption>${esc(p.label)}${'credit' in p ? ` · <span class="credit">${esc(p.credit)}</span>` : ''}</figcaption>`;
        if ('transcription' in p) h += `<details><summary>Transcription${p.certainty === 'to_verify' ? ' <span class="tag-verify">to verify</span>' : ''}</summary><p class="tr">${esc(p.transcription)}</p></details>`;
        if ('translation' in p) h += `<details><summary>English translation</summary><p class="tr">${esc(p.translation)}</p></details>`;
        h += `</figure>`;
      });
      h += `</div>`;
    }
    const details = D.attr_fields.filter(f => f.type === e.type && f.key in e.attrs && (f.input === 'text' || f.input === 'url') && e.type !== 'tape');
    if (details.length) h += `<dl class="details">${details.map(f => `<div><dt>${esc(f.label)}</dt><dd>${f.input === 'url' ? `<a href="${esc(e.attrs[f.key])}" target="_blank" rel="noopener">${esc(e.attrs[f.key])}</a>` : esc(e.attrs[f.key])}</dd></div>`).join('')}</dl>`;
    if (e.type === 'place') {
      const c = coord[id];
      h += `<div class="btns" style="margin-top:14px">`;
      h += `<a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('address' in e.attrs ? e.attrs.address : c && !estimated.has(id) ? c[1] + ',' + c[0] : e.name)}">Open in Google Maps ↗</a>`;
      h += `<a class="btn" target="_blank" rel="noopener" href="https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(e.name.split(',')[0])}">Wikipedia ↗</a></div>`;
      h += `<div class="coords">${c ? (estimated.has(id) ? 'Position estimated from the route' : (e.precision ? `Coordinates: ${esc(e.precision)}` : 'Coordinates not checked yet')) : 'No coordinates yet'}</div>`;
    }
    if (facts.length) {
      h += `<h3>Connections</h3><ul class="facts">`;
      facts.forEach(f => {
        const r = f.r, src = r.src && E[r.src] && E[r.src].type === 'tape' && r.t0 != null
          ? ` · <a onclick="__jump(${tapeIdx[r.src]}, ${+r.t0})">${at(tapeIdx[r.src], r.t0)}</a>` : '';
        const meta = [r.role, r.date_text].filter(Boolean).map(esc).join(' · ');
        h += `<li><span class="lab">${esc(f.label)}</span> <a onclick="__open('${f.other}')">${esc(E[f.other].name)}</a>
          ${r.certainty === 'to_verify' ? '<span class="tag-verify">to verify</span>' : ''}
          <div class="meta">${meta}${src}${r.note ? (meta || src ? ' · ' : '') + esc(r.note) : ''}</div></li>`;
      });
      h += `</ul>`;
    }
    if (ms.length) {
      ms.sort((a, b) => G(a.ti, a.t) - G(b.ti, b.t));
      h += `<h3>In the testimony</h3><div class="moments">`;
      ms.forEach(m => h += `<button class="moment" onclick="__jump(${m.ti}, ${m.t})"><div class="tc">▶ ${at(m.ti, m.t)}</div>${(q => q === null ? '' : `<div class="q">“${esc(q)}”</div>`)(cueTextAt(m.ti, m.t))}</button>`);
      h += `</div>`;
    }
    body.innerHTML = h;
    drawer.classList.add('show'); scrim.classList.add('show'); drawer.setAttribute('aria-hidden', 'false');
    drawer.scrollTop = 0;
  }

  // ---------- start ----------
  syncPoster(); render(true);
  window.addEventListener('resize', () => render(true));
  window.__state = st; window.__seek = seek;   // for testing
  // links from other pages: #open=<slug> opens an item, #tape=<number>&t=<seconds> goes to a moment
  const link = new URLSearchParams(location.hash.slice(1));
  if (link.has('tape')) {
    const ti = TAPES.findIndex(t => String(t.number) === link.get('tape'));
    if (ti < 0) console.error(`There is no tape ${link.get('tape')}`); else seek(ti, link.has('t') ? +link.get('t') : 0);
  }
  if (link.has('open')) {
    const e = BY_SLUG[link.get('open')];
    if (e) openEntity(e.id); else console.error(`Nothing published has the address "${link.get('open')}"`);
  }
  }
})();
