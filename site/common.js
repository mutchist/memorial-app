/* Shared by the public pages (Watch, document): loading site_data() from
   Supabase and the lookups built from its vocabulary. */
window.Site = (() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = s => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = String(s % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`; };
  const nullsLast = (a, b) => a == null ? (b == null ? 0 : 1) : b == null ? -1 : a < b ? -1 : a > b ? 1 : 0;

  function config() {
    const C = window.SITE_CONFIG;
    if (!C || !C.supabaseUrl || !C.supabaseKey) throw new Error('site/config.js does not have the Supabase project URL and publishable key yet.');
    return C;
  }
  // media.storage_path is "<bucket>/<file>"
  const fileUrl = path => config().supabaseUrl.replace(/\/$/, '') + '/storage/v1/object/public/' + path;

  function showError(title, detail) {
    $('main').replaceChildren(el('div', 'load-error', `<h1>${esc(title)}</h1><p>${esc(detail)}</p>`));
  }

  async function loadData() {
    const C = config();
    const res = await fetch(C.supabaseUrl.replace(/\/$/, '') + '/rest/v1/rpc/site_data', {
      method: 'POST', headers: { apikey: C.supabaseKey, 'Content-Type': 'application/json' }, body: '{}' });
    if (!res.ok) throw new Error(`The database answered ${res.status}: ${await res.text()}`);
    return res.json();
  }

  // Lookups over one site_data() payload.
  function index(D) {
    const E = Object.fromEntries(D.entities.map(x => [x.id, x]));
    const BY_SLUG = Object.fromEntries(D.entities.map(x => [x.slug, x]));
    const RT = Object.fromEntries(D.relation_types.map(t => [t.key, t]));
    const ET = Object.fromEntries(D.entity_types.map(t => [t.key, t]));
    const OPT = {};   // 'place.kind' -> { city: {label, display} }
    D.attr_options.forEach(o => { (OPT[o.type + '.' + o.field] ||= {})[o.value] = o; });
    const PAGES = {};   // entity id -> scan pages in order
    D.pages.forEach(p => (PAGES[p.entity] ||= []).push(p));
    const option = (e, field) => field in e.attrs ? OPT[e.type + '.' + field][e.attrs[field]] : null;
    const kindLabel = e => { const o = option(e, 'kind'); return o && o.display.show_kind ? o.label : ET[e.type].label; };
    return { E, BY_SLUG, RT, ET, OPT, PAGES, option, kindLabel };
  }

  // Links between the public pages
  const watchLink = e => 'index.html#open=' + encodeURIComponent(e.slug);
  const documentLink = e => 'document.html?d=' + encodeURIComponent(e.slug);

  // Map labels in Hebrew, Arabic etc. are drawn right to left only with this plugin (loaded when such a label is on screen).
  // From the CDN, because the map's worker cannot load a local file when the site is opened from disk.
  const RTL_PLUGIN = 'https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.2.3/mapbox-gl-rtl-text.min.js';
  function rtlLabels() {
    if (maplibregl.getRTLTextPluginStatus() !== 'unavailable') return;
    maplibregl.setRTLTextPlugin(RTL_PLUGIN, true).catch(err => console.error('Right-to-left map labels could not load:', err));
  }

  return { $, el, esc, fmt, nullsLast, fileUrl, showError, loadData, index, watchLink, documentLink, rtlLabels };
})();
