/* Admin. Everything it shows is driven by the database vocabulary:
   entity_types (types, labels, colours), attr_fields + attr_options (the
   extra fields per type and their choices), relation_types (which
   connections are allowed between which types) and admin_vocab() (the
   fixed lists: certainty, status). The database enforces the same rules,
   so its error messages are shown as they are. */
(() => {
  'use strict';
  const C = window.SITE_CONFIG;
  const sb = supabase.createClient(C.supabaseUrl, C.supabaseKey);
  const $ = s => document.querySelector(s);
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const human = v => v.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());   // 'to_verify' -> 'To verify'
  // letters that do not split into a base letter + accent are spelled out first
  const SPELL = { 'ß': 'ss', 'æ': 'ae', 'œ': 'oe', 'ø': 'o', 'ł': 'l', 'đ': 'd', 'ı': 'i' };
  const slugify = s => s.toLowerCase().replace(/[ßæœøłđı]/g, c => SPELL[c]).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  const fmtTime = s => { s = Math.round(+s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = String(s % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`; };
  const parseTime = t => { if (!/^\d+(:\d{1,2}){0,2}(\.\d+)?$/.test(t)) throw new Error(`"${t}" is not a time. Use minutes:seconds, e.g. 12:04`); return t.split(':').reduce((a, p) => a * 60 + +p, 0); };

  // ---------- data access: every call throws on error ----------
  async function q(builder) { const { data, error } = await builder; if (error) throw new Error(error.message); return data; }

  let toastTimer;
  function toast(msg, isError) {
    const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (isError ? ' error' : '');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.className = 'toast', isError ? 9000 : 2500);
  }
  const fail = err => { console.error(err); toast(err.message, true); };

  // ---------- state ----------
  const S = {
    vocab: null, types: [], typeByKey: {}, fields: {}, options: {}, rtypes: [], rtByKey: {},
    entities: new Map(), selected: new Set(),
    filter: { q: '', type: null, status: null, certainty: null },
    current: null,          // { entity (saved row or null for new), type }
  };

  // Core columns of `entities` shown in the editor. These mirror the table
  // itself; the type-specific fields come from attr_fields.
  const CORE = [
    { key: 'name', label: 'Name', input: 'text', required: true },
    { key: 'slug', label: 'Web name', input: 'text', required: true, help: 'Used in links. Lowercase letters, numbers and dashes.' },
    { key: 'other_names', label: 'Other names and spellings', input: 'list', help: 'Separate with commas', wide: true },
    { key: 'summary', label: 'Short description', input: 'textarea', wide: true },
    { key: 'body', label: 'Longer story', input: 'textarea', rows: 7, wide: true },
    { key: 'certainty', label: 'Certainty', input: 'enum', list: 'certainty', required: true },
  ];
  const WHEN = [
    { key: 'date_text', label: 'Date as written', input: 'text', help: 'e.g. "end of 1929" or "24 June 1942"' },
    { key: 'date_from', label: 'From (for sorting)', input: 'date' },
    { key: 'date_to', label: 'To', input: 'date' },
  ];
  const WHERE = [
    { key: 'lat', label: 'Latitude', input: 'number' },
    { key: 'lng', label: 'Longitude', input: 'number' },
    { key: 'coord_precision', label: 'How exact', input: 'text', help: 'exact, town, approx, region…' },
  ];
  const REL_FIELDS = [
    { key: 'role', label: 'Role', input: 'text', help: 'e.g. stepmother, holder, cousin' },
    { key: 'sort_order', label: 'Order', input: 'number', help: 'e.g. leg number in a journey' },
    { key: 'date_text', label: 'Date as written', input: 'text' },
    { key: 'date_from', label: 'From', input: 'date' },
    { key: 'date_to', label: 'To', input: 'date' },
    { key: 'certainty', label: 'Certainty', input: 'enum', list: 'certainty', required: true },
    { key: 'status', label: 'On the site', input: 'enum', list: 'status', required: true },
    { key: 'note', label: 'Note', input: 'textarea', wide: true },
  ];

  // ---------- generic form fields ----------
  function fieldInput(f, value, choices) {
    const id = 'f_' + f.key + '_' + Math.random().toString(36).slice(2, 7);
    const wrap = el('div', f.wide || f.input === 'textarea' || f.input === 'geojson' ? 'wide' : '');
    const lab = el('label', null, `${esc(f.label)}${f.required ? ' <span class="req">*</span>' : ''}`);
    lab.htmlFor = id;
    let inp;
    if (f.input === 'textarea' || f.input === 'geojson') { inp = el('textarea'); if (f.rows) inp.rows = f.rows; }
    else if (f.input === 'select' || f.input === 'enum') {
      inp = el('select');
      inp.appendChild(el('option', null, f.required ? 'Choose…' : '—')).value = '';
      choices.forEach(c => { const o = el('option', null, esc(c.label)); o.value = c.value; inp.appendChild(o); });
    } else {
      inp = el('input'); inp.type = { number: 'number', date: 'date', url: 'url' }[f.input] ? f.input : 'text';
      if (f.input === 'number') inp.step = 'any';
    }
    inp.id = id; inp.dataset.key = f.key; inp.dataset.input = f.input;
    if (f.required) inp.required = true;
    if (value !== null && value !== undefined) {
      inp.value = f.input === 'list' ? value.join(', ') : f.input === 'geojson' ? JSON.stringify(value) : String(value);
    }
    lab.appendChild(inp);
    wrap.appendChild(lab);
    if (f.help) wrap.appendChild(el('div', 'help', esc(f.help)));
    return wrap;
  }
  // blank inputs mean "not filled in" -> null
  function readInput(inp) {
    const v = inp.value.trim();
    if (v === '') return null;
    switch (inp.dataset.input) {
      case 'number': return Number(v);
      case 'list': return v.split(',').map(x => x.trim()).filter(x => x);
      case 'geojson': try { return JSON.parse(v); } catch (e) { throw new Error(`"${inp.dataset.key}" is not valid JSON`); }
      default: return v;
    }
  }
  const enumChoices = list => S.vocab[list].map(v => ({ value: v, label: human(v) }));
  const optionChoices = (type, key) => (S.options[type + '.' + key]).map(o => ({ value: o.value, label: o.label }));

  // ---------- auth ----------
  async function boot() {
    if (!C.supabaseUrl || !C.supabaseKey) return notice('Not connected', '<p>site/config.js does not have the Supabase project URL and key yet.</p>');
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return showSignin();
    $('#who').textContent = session.user.email; $('#signout').hidden = false;
    const me = await q(sb.from('admins').select('user_id').eq('user_id', session.user.id));
    if (!me.length) return notice('This account is not an admin yet', `<p>You are signed in as <b>${esc(session.user.email)}</b>, but this account isn't on the admin list. In the Supabase SQL Editor, run:</p>
      <pre>insert into admins (user_id, name) values ('${esc(session.user.id)}', 'Admin');</pre><p>Then reload this page.</p>`);
    await loadAll();
  }
  function showSignin() {
    $('#signin').hidden = false; $('#app').hidden = true; $('#notice').hidden = true;
    $('#signinForm').onsubmit = async e => {
      e.preventDefault(); $('#signinErr').textContent = '';
      const { error } = await sb.auth.signInWithPassword({ email: $('#email').value.trim(), password: $('#password').value });
      if (error) { $('#signinErr').textContent = error.message; return; }
      $('#signin').hidden = true; boot().catch(fail);
    };
  }
  function notice(title, html) { const n = $('#notice'); n.innerHTML = `<h1>${esc(title)}</h1>${html}`; n.hidden = false; $('#app').hidden = true; }
  $('#signout').onclick = async () => { await sb.auth.signOut(); location.reload(); };

  // ---------- load ----------
  async function loadAll() {
    const [vocab, types, fields, options, rtypes, linkSites, ents] = await Promise.all([
      q(sb.rpc('admin_vocab')),
      q(sb.from('entity_types').select('*').order('position')),
      q(sb.from('attr_fields').select('*').order('position')),
      q(sb.from('attr_options').select('*').order('position')),
      q(sb.from('relation_types').select('*').order('label')),
      q(sb.from('link_sites').select('*').order('position')),
      q(sb.from('entities').select('*').order('name')),
    ]);
    S.vocab = vocab; S.types = types; S.typeByKey = Object.fromEntries(types.map(t => [t.key, t]));
    fields.forEach(f => (S.fields[f.entity_type] ||= []).push(f));
    options.forEach(o => (S.options[o.entity_type + '.' + o.attr_key] ||= []).push(o));
    S.rtypes = rtypes; S.rtByKey = Object.fromEntries(rtypes.map(r => [r.key, r]));
    if (!linkSites.length) throw new Error('The link_sites table is empty. Run data-model/updates/2026-11-08-features.sql in Supabase.');
    S.linkSites = linkSites;
    ents.forEach(e => S.entities.set(e.id, e));
    document.head.appendChild(el('style', null, types.map(t => `.t-${t.key}{background:${t.color}}`).join('\n')));
    $('#app').hidden = false;
    buildLibraryControls(); renderList();
    const fromHash = decodeURIComponent(location.hash.slice(1));
    if (S.entities.has(fromHash)) openEntity(fromHash);
  }

  // ---------- library ----------
  function buildLibraryControls() {
    const nt = $('#newType');
    nt.appendChild(el('option', null, '+ Add new…')).value = '';
    S.types.forEach(t => { const o = el('option', null, esc(t.label)); o.value = t.key; nt.appendChild(o); });
    nt.onchange = () => { if (nt.value) openNew(nt.value); nt.value = ''; };
    $('#filesTool').onclick = () => openFilesTool().catch(fail); $('#filesTool').hidden = false;
    $('#momentsTool').onclick = () => openMomentsTool().catch(fail); $('#momentsTool').hidden = false;

    const ft = $('#fType');
    ft.appendChild(el('option', null, 'All types')).value = '';
    S.types.forEach(t => { const o = el('option', null, esc(t.label)); o.value = t.key; ft.appendChild(o); });
    ft.onchange = () => { S.filter.type = ft.value === '' ? null : ft.value; renderList(); };

    const sel = (node, list, allLabel, key) => {
      node.appendChild(el('option', null, allLabel)).value = '';
      S.vocab[list].forEach(v => { const o = el('option', null, esc(human(v))); o.value = v; node.appendChild(o); });
      node.onchange = () => { S.filter[key] = node.value === '' ? null : node.value; renderList(); };
    };
    sel($('#fStatus'), 'status', 'Any status', 'status');
    sel($('#fCertainty'), 'certainty', 'Any certainty', 'certainty');
    $('#search').oninput = e => { S.filter.q = e.target.value.trim().toLowerCase(); renderList(); };
    $('#selAll').onchange = e => { visible().forEach(x => e.target.checked ? S.selected.add(x.id) : S.selected.delete(x.id)); renderList(); };
    $('#bulkClear').onclick = () => { S.selected.clear(); renderList(); };
    const actions = $('#bulkActions');
    S.vocab.status.forEach(st => {
      const b = el('button', 'ghost', `Set ${esc(human(st).toLowerCase())}`);
      b.onclick = () => bulkStatus(st).catch(fail); actions.appendChild(b);
    });
  }
  function matches(e) {
    const f = S.filter;
    if (f.type !== null && e.type !== f.type) return false;
    if (f.status !== null && e.status !== f.status) return false;
    if (f.certainty !== null && e.certainty !== f.certainty) return false;
    if (f.q && !(e.name.toLowerCase().includes(f.q) || e.other_names.some(n => n.toLowerCase().includes(f.q)))) return false;
    return true;
  }
  const visible = () => [...S.entities.values()].filter(matches).sort((a, b) => a.name.localeCompare(b.name));
  function renderList() {
    const list = $('#list'), items = visible(), cur = S.current && S.current.entity ? S.current.entity.id : null;
    list.innerHTML = '';
    items.forEach(e => {
      const li = el('li', e.id === cur ? 'on' : '');
      const cb = el('input'); cb.type = 'checkbox'; cb.checked = S.selected.has(e.id); cb.setAttribute('aria-label', 'Select ' + e.name);
      cb.onclick = ev => { ev.stopPropagation(); cb.checked ? S.selected.add(e.id) : S.selected.delete(e.id); renderBulk(); };
      li.appendChild(cb);
      li.appendChild(el('i', `dot t-${e.type}`));
      li.appendChild(el('div', null, `<div class="nm">${esc(e.name)}</div><div class="meta">${esc(S.typeByKey[e.type].label)} · ${esc(human(e.certainty))} <span class="pill ${e.status}">${esc(human(e.status))}</span></div>`));
      li.onclick = () => openEntity(e.id);
      list.appendChild(li);
    });
    $('#count').textContent = `${items.length} of ${S.entities.size}`;
    $('#selAll').checked = items.length > 0 && items.every(e => S.selected.has(e.id));
    renderBulk();
  }
  function renderBulk() {
    $('#bulk').hidden = S.selected.size === 0;
    $('#bulkCount').textContent = `${S.selected.size} selected`;
  }
  async function bulkStatus(status) {
    const ids = [...S.selected];
    if (!confirm(`Set ${ids.length} item(s) to "${human(status)}"? Their connections to other ${status} items follow them.`)) return;
    const rows = await q(sb.from('entities').update({ status }).in('id', ids).select());
    rows.forEach(r => S.entities.set(r.id, r));
    // connections between items that are now all in this status get the same status
    const rels = await q(sb.from('relations').select('id,subject_id,object_id,status').or(`subject_id.in.(${ids.join(',')}),object_id.in.(${ids.join(',')})`));
    const both = rels.filter(r => r.status !== status && S.entities.get(r.subject_id).status === status && S.entities.get(r.object_id).status === status).map(r => r.id);
    if (both.length) await q(sb.from('relations').update({ status }).in('id', both).select('id'));
    S.selected.clear(); renderList();
    if (S.current && S.current.entity && ids.includes(S.current.entity.id)) openEntity(S.current.entity.id);
    toast(`${rows.length} item(s) and ${both.length} connection(s) set to ${human(status).toLowerCase()}`);
  }

  // ---------- editor ----------
  let pinMap = null;
  function openNew(type) { S.current = { entity: null, type }; renderEditor(); renderList(); }
  function openEntity(id) { S.current = { entity: S.entities.get(id), type: S.entities.get(id).type }; history.replaceState(null, '', '#' + id); renderEditor(); renderList(); }

  function renderEditor() {
    const { entity: e, type } = S.current, T = S.typeByKey[type];
    const ed = $('#editor'); ed.innerHTML = '';
    if (pinMap) { pinMap.remove(); pinMap = null; }
    if (routeMap) { routeMap.remove(); routeMap = null; }
    const head = el('div', 'ed-head');
    head.appendChild(el('div', null, `<div class="k"><i class="dot t-${type}"></i>${esc(T.label)}${e ? ` · <span class="pill ${e.status}">${esc(human(e.status))}</span>` : ' · new'}</div><h1>${esc(e ? e.name : 'New ' + T.label.toLowerCase())}</h1>`));
    const acts = el('div', 'ed-actions');
    const dirty = el('span', 'dirty-note'); acts.appendChild(dirty);
    const save = el('button', 'primary', e ? 'Save' : 'Create'); save.type = 'submit'; save.setAttribute('form', 'edForm'); acts.appendChild(save);
    if (e && S.typeByKey[e.type].has_pages) {
      const v = el('a', 'ghost', 'Document page ↗'); v.href = 'document.html?d=' + encodeURIComponent(e.slug); v.target = '_blank'; v.rel = 'noopener';
      v.title = e.status === 'published' ? 'Open the public page' : 'Only shows once published'; acts.appendChild(v);
    }
    if (e) {
      S.vocab.status.filter(s => s !== e.status).forEach(st => {
        const b = el('button', 'ghost', `Set ${esc(human(st).toLowerCase())}`);
        b.onclick = () => setStatus(e, st).catch(fail); acts.appendChild(b);
      });
      const del = el('button', 'ghost danger', 'Delete'); del.onclick = () => removeEntity(e).catch(fail); acts.appendChild(del);
    }
    head.appendChild(acts); ed.appendChild(head);

    const form = el('form'); form.id = 'edForm'; form.noValidate = false;
    const section = (title, fields, valueOf, choicesOf) => {
      const s = el('div', 'sec'); s.appendChild(el('h3', null, esc(title)));
      const g = el('div', 'grid'); fields.forEach(f => g.appendChild(fieldInput(f, valueOf(f), choicesOf(f)))); s.appendChild(g); return s;
    };
    const coreVal = f => e ? e[f.key] : null;
    const coreChoices = f => f.input === 'enum' ? enumChoices(f.list) : [];
    form.appendChild(section('Basics', CORE, coreVal, coreChoices));
    form.appendChild(section('When', WHEN, coreVal, coreChoices));
    if (type === 'place') {
      const s = section('Where', WHERE, coreVal, coreChoices);
      const m = el('div', 'pinmap'); s.insertBefore(m, s.children[1]);
      s.insertBefore(el('div', 'help', 'Click the map or drag the pin to set the position.'), m);
      form.appendChild(s);
      setTimeout(() => mountPinMap(m, form), 0);
    }
    const attrBox = el('div'); form.appendChild(attrBox);
    const renderAttrs = attrs => {
      attrBox.innerHTML = '';
      const kind = attrs.kind;
      const fs = (S.fields[type] ? S.fields[type] : []).filter(f => f.when_kind === null || f.when_kind === kind);
      if (!fs.length) return;
      attrBox.appendChild(section('Details', fs.map(f => ({ ...f, wide: f.input === 'textarea' || f.input === 'geojson' })), f => f.key in attrs ? attrs[f.key] : null,
        f => f.input === 'select' ? optionChoices(type, f.key) : []));
      const kindSel = attrBox.querySelector('[data-key="kind"]');
      if (kindSel) kindSel.onchange = () => { const cur = readAttrs(attrBox); renderAttrs(cur); };
    };
    renderAttrs(e ? e.attrs : {});
    ed.appendChild(form);

    // slug follows the name until edited by hand, for new items
    const nameIn = form.querySelector('[data-key="name"]'), slugIn = form.querySelector('[data-key="slug"]');
    if (!e) { let touched = false; slugIn.oninput = () => touched = true; nameIn.oninput = () => { if (!touched) slugIn.value = slugify(nameIn.value); }; }
    const fromName = el('button', 'linkbtn', 'Make from name'); fromName.type = 'button';
    fromName.onclick = () => { slugIn.value = slugify(nameIn.value); slugIn.dispatchEvent(new Event('input', { bubbles: true })); };
    slugIn.closest('div').appendChild(fromName);
    if (e) slugIn.closest('div').appendChild(el('div', 'help', 'Changing it changes the item\'s web address; old links to it stop working.'));
    form.oninput = () => dirty.textContent = 'Unsaved changes';
    form.onsubmit = ev => { ev.preventDefault(); saveEntity(form, attrBox).catch(fail); };

    if (e) {
      ed.appendChild(linksSection(e));
      if (type === 'journey') ed.appendChild(routeSection(e));
      if (T.has_pages) ed.appendChild(scansSection(e));
      ed.appendChild(relationsSection(e));
      ed.appendChild(historySection(e));
    }
    ed.scrollTop = 0;
  }
  function readAttrs(box) {
    const out = {};
    box.querySelectorAll('[data-key]').forEach(inp => { const v = readInput(inp); if (v !== null) out[inp.dataset.key] = v; });
    return out;
  }
  function mountPinMap(node, form) {
    const latIn = form.querySelector('[data-key="lat"]'), lngIn = form.querySelector('[data-key="lng"]');
    const has = latIn.value !== '' && lngIn.value !== '';
    const center = has ? [+lngIn.value, +latIn.value] : [6.5, 50.5];
    Site.rtlLabels();
    pinMap = new maplibregl.Map({ container: node, style: 'https://tiles.openfreemap.org/styles/dark', center, zoom: has ? 9 : 4, attributionControl: { compact: true } });
    pinMap.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    const marker = new maplibregl.Marker({ color: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(), draggable: true });
    const set = ll => { latIn.value = ll.lat.toFixed(5); lngIn.value = ll.lng.toFixed(5); form.oninput(); };
    if (has) marker.setLngLat(center).addTo(pinMap);
    marker.on('dragend', () => set(marker.getLngLat()));
    pinMap.on('click', ev => { marker.setLngLat(ev.lngLat).addTo(pinMap); set(ev.lngLat); });
    const sync = () => { if (latIn.value !== '' && lngIn.value !== '') marker.setLngLat([+lngIn.value, +latIn.value]).addTo(pinMap); };
    latIn.addEventListener('change', sync); lngIn.addEventListener('change', sync);
  }

  async function saveEntity(form, attrBox) {
    const row = {};
    [...CORE, ...WHEN, ...(S.current.type === 'place' ? WHERE : [])].forEach(f => {
      row[f.key] = readInput(form.querySelector(`[data-key="${f.key}"]`));
    });
    if (row.other_names === null) row.other_names = [];   // the column holds a list; an empty list means none
    row.attrs = readAttrs(attrBox);
    const { entity: e, type } = S.current;
    const saved = e
      ? await q(sb.from('entities').update(row).eq('id', e.id).select().single())
      : await q(sb.from('entities').insert({ ...row, type }).select().single());
    S.entities.set(saved.id, saved);
    toast(e ? 'Saved' : 'Created (as draft)');
    openEntity(saved.id);
  }
  async function setStatus(e, status) {
    const saved = await q(sb.from('entities').update({ status }).eq('id', e.id).select().single());
    S.entities.set(saved.id, saved); toast(`Set to ${human(status).toLowerCase()}`); openEntity(saved.id);
  }
  async function removeEntity(e) {
    if (!confirm(`Delete "${e.name}" and all its connections? You can restore it later from the database history.`)) return;
    await q(sb.from('entities').delete().eq('id', e.id).select('id'));
    S.entities.delete(e.id); S.selected.delete(e.id); S.current = null;
    history.replaceState(null, '', '#');
    $('#editor').innerHTML = '<div class="empty-ed"><h2>Deleted</h2></div>'; renderList(); toast('Deleted');
  }

  // ---------- links ----------
  function linksSection(e) {
    const s = el('div', 'sec'); s.appendChild(el('h3', null, 'Links'));
    const box = el('div'); s.appendChild(box);
    const load = async () => {
      const links = await q(sb.from('links').select('*').eq('entity_id', e.id).order('position'));
      box.innerHTML = '';
      links.forEach(l => box.appendChild(linkRow(l, load)));
      box.appendChild(linkRow(null, load, links.length));
    };
    load().catch(fail);
    return s;
  }
  function linkRow(l, reload, nextPos) {
    const r = el('div', 'linkrow');
    const lab = el('input'); lab.placeholder = 'Label'; lab.value = l ? l.label : '';
    const url = el('input'); url.type = 'url'; url.placeholder = 'https://…'; url.value = l ? l.url : '';
    if (!l) {
      // new link: choose the website (link_sites, first one preselected); "Other" (no prefix) asks for a label
      const site = el('select'); site.setAttribute('aria-label', 'Website');
      S.linkSites.forEach(x => { const o = el('option', null, esc(x.label)); o.value = x.label; site.appendChild(o); });
      const pick = () => {
        const x = S.linkSites.find(y => y.label === site.value);
        lab.hidden = x.url_prefix !== null; lab.value = x.url_prefix === null ? '' : x.label;
        if (url.value === '' || S.linkSites.some(y => y.url_prefix === url.value)) url.value = x.url_prefix === null ? '' : x.url_prefix;
      };
      site.onchange = pick; pick();
      const b = el('button', 'ghost', 'Add'); b.type = 'button';
      b.onclick = async () => {
        try {
          const x = S.linkSites.find(y => y.label === site.value);
          if (!lab.value.trim()) throw new Error('Give the link a label');
          if (!url.value.trim() || url.value.trim() === x.url_prefix) throw new Error('Finish the web address of the link');
          await q(sb.from('links').insert({ entity_id: S.current.entity.id, label: lab.value.trim(), url: url.value.trim(), position: nextPos }).select('id'));
          await reload();
        } catch (err) { fail(err); }
      };
      const left = el('div', 'linksite'); left.append(site, lab);
      r.append(left, url, b); return r;
    }
    const b = el('button', 'ghost', l ? 'Remove' : 'Add'); b.type = 'button';
    b.onclick = async () => {
      try {
        if (l) await q(sb.from('links').delete().eq('id', l.id).select('id'));
        else {
          if (!lab.value.trim() || !url.value.trim()) throw new Error('A link needs a label and an address');
          await q(sb.from('links').insert({ entity_id: S.current.entity.id, label: lab.value.trim(), url: url.value.trim(), position: nextPos }).select('id'));
        }
        await reload();
      } catch (err) { fail(err); }
    };
    if (l) { const save = async () => { try { await q(sb.from('links').update({ label: lab.value.trim(), url: url.value.trim() }).eq('id', l.id).select('id')); toast('Link saved'); } catch (err) { fail(err); } }; lab.onchange = save; url.onchange = save; }
    r.append(lab, url, b); return r;
  }

  // ---------- connections ----------
  function allowed(list, type) { return list === null || list.includes(type); }
  function relationChoices(type) {
    // every connection this type can take part in, from either side
    const out = [];
    S.rtypes.forEach(rt => {
      if (allowed(rt.subject_types, type)) out.push({ value: rt.key + '|s', label: rt.label + ' …', rt, side: 's' });
      if (!rt.is_symmetric && allowed(rt.object_types, type)) out.push({ value: rt.key + '|o', label: rt.inverse_label + ' …', rt, side: 'o' });
    });
    return out.sort((a, b) => a.label.localeCompare(b.label));
  }
  function relationsSection(e) {
    const s = el('div', 'sec'); s.appendChild(el('h3', null, 'Connections'));
    const add = el('button', 'ghost', '+ Add connection'); add.type = 'button';
    const formBox = el('div'), listBox = el('div');
    s.append(add, formBox, listBox);
    const load = async () => {
      const rels = await q(sb.from('relations').select('*').or(`subject_id.eq.${e.id},object_id.eq.${e.id}`));
      listBox.innerHTML = '';
      const rows = rels.map(r => {
        const forward = r.subject_id === e.id, rt = S.rtByKey[r.predicate];
        return { r, rt, otherId: forward ? r.object_id : r.subject_id, label: forward || rt.is_symmetric ? rt.label : rt.inverse_label };
      });
      const groups = [['Facts', rows.filter(x => !x.rt.timed)], ['In the tapes', rows.filter(x => x.rt.timed)]];
      groups.forEach(([title, list]) => {
        if (!list.length) return;
        list.sort((a, b) => a.label.localeCompare(b.label) || (+a.r.start_sec) - (+b.r.start_sec));
        listBox.appendChild(el('div', 'rels-sub', `${esc(title)} · ${list.length}`));
        const ul = el('ul', 'rels');
        list.forEach(x => ul.appendChild(relationRow(e, x, formBox, load)));
        listBox.appendChild(ul);
      });
      if (!rows.length) listBox.appendChild(el('p', 'help', 'No connections yet.'));
    };
    add.onclick = () => relationForm(e, null, formBox, load);
    load().catch(fail);
    return s;
  }
  function evidenceText(r) {
    const parts = [];
    if (r.source_id !== null) parts.push('source: ' + S.entities.get(r.source_id).name);
    if (r.start_sec !== null) parts.push('at ' + fmtTime(r.start_sec));
    return parts.join(' ');
  }
  function relationRow(e, x, formBox, reload) {
    const { r, otherId, label } = x, other = S.entities.get(otherId);
    const li = el('li');
    const meta = [r.role, r.date_text, evidenceText(r), r.certainty === 'to_verify' ? 'to verify' : null, r.note].filter(v => v !== null && v !== '').map(esc).join(' · ');
    const main = el('div', null, `<span class="lab">${esc(label)}</span> <a>${esc(other.name)}</a> <span class="pill ${r.status}">${esc(human(r.status))}</span>${meta ? `<div class="meta">${meta}</div>` : ''}`);
    main.querySelector('a').onclick = () => openEntity(otherId);
    const acts = el('div', 'acts');
    const ed = el('button', 'linkbtn', 'Edit'); ed.type = 'button'; ed.onclick = () => relationForm(e, r, formBox, reload);
    const del = el('button', 'linkbtn', 'Remove'); del.type = 'button';
    del.onclick = async () => { if (!confirm(`Remove "${label} ${other.name}"?`)) return; try { await q(sb.from('relations').delete().eq('id', r.id).select('id')); toast('Removed'); reload(); } catch (err) { fail(err); } };
    acts.append(ed, del); li.append(main, acts); return li;
  }

  function entityPicker(labelText, types, initialId, onPick) {
    const wrap = el('div', 'picker');
    const lab = el('label', null, `${esc(labelText)} <span class="req">*</span>`);
    const inp = el('input'); inp.placeholder = 'Type to search…'; lab.appendChild(inp); wrap.appendChild(lab);
    const picked = el('div', 'picked'); wrap.appendChild(picked);
    const opts = el('ul', 'opts'); opts.hidden = true; wrap.appendChild(opts);
    let typesNow = types;
    const show = id => { picked.innerHTML = id === null ? '' : `Selected: <b>${esc(S.entities.get(id).name)}</b> <span class="help">(${esc(S.typeByKey[S.entities.get(id).type].label)})</span>`; };
    const search = () => {
      const t = inp.value.trim().toLowerCase(); opts.innerHTML = '';
      if (!t) { opts.hidden = true; return; }
      const found = [...S.entities.values()].filter(x => allowed(typesNow, x.type) && (x.name.toLowerCase().includes(t) || x.other_names.some(n => n.toLowerCase().includes(t)))).slice(0, 30);
      found.forEach(x => { const li = el('li', null, `${esc(x.name)}<span class="t">${esc(S.typeByKey[x.type].label)}</span>`); li.onmousedown = ev => { ev.preventDefault(); inp.value = ''; opts.hidden = true; show(x.id); onPick(x.id); }; opts.appendChild(li); });
      if (!found.length) opts.appendChild(el('li', 'help', 'Nothing matches'));
      opts.hidden = false;
    };
    inp.oninput = search; inp.onblur = () => setTimeout(() => opts.hidden = true, 100);
    show(initialId);
    return { node: wrap, show, setTypes: t => { typesNow = t; }, clear: () => show(null) };
  }

  function relationForm(e, r, box, reload) {
    box.innerHTML = '';
    const f = el('form', 'relform'); box.appendChild(f);
    const choices = relationChoices(e.type);
    const st = { choice: null, other: null, source: r ? r.source_id : null };
    const g = el('div', 'grid');
    const kind = fieldInput({ key: 'kind', label: 'Connection', input: 'select', required: true }, null, choices);
    const kindSel = kind.querySelector('select');
    g.appendChild(kind);
    const picker = entityPicker('With', null, null, id => st.other = id); g.appendChild(picker.node);
    const onKind = () => {
      st.choice = choices.find(c => c.value === kindSel.value);
      picker.setTypes(st.choice ? (st.choice.side === 's' ? st.choice.rt.object_types : st.choice.rt.subject_types) : null);
      timeBox.hidden = !(st.choice && (st.choice.rt.timed || e.type === 'tape'));
      const needsEnd = !!(st.choice && st.choice.rt.needs_end);
      t1.querySelector('.req-end').hidden = !needsEnd; t1.querySelector('input').required = needsEnd && !timeBox.hidden;
    };
    kindSel.onchange = () => { onKind(); if (st.other !== null && st.choice && !allowed(st.choice.side === 's' ? st.choice.rt.object_types : st.choice.rt.subject_types, S.entities.get(st.other).type)) { st.other = null; picker.clear(); } };
    REL_FIELDS.forEach(fd => g.appendChild(fieldInput(fd, r ? r[fd.key] : fd.key === 'status' ? e.status : null, fd.input === 'enum' ? enumChoices(fd.list) : [])));
    f.appendChild(g);

    // evidence: a tape moment and/or a document
    const ev = el('div', 'sec'); ev.appendChild(el('h3', null, 'Evidence'));
    const eg = el('div', 'grid');
    const sourceTypes = ['tape', ...S.types.filter(t => t.has_pages).map(t => t.key)];
    const src = entityPicker('Source: ' + sourceTypes.map(k => S.typeByKey[k].label.toLowerCase()).join(', '), sourceTypes, st.source, id => st.source = id);
    src.node.querySelector('.req').remove();
    const clearSrc = el('button', 'linkbtn', 'No source'); clearSrc.type = 'button'; clearSrc.onclick = () => { st.source = null; src.clear(); };
    src.node.appendChild(clearSrc);
    eg.appendChild(src.node);
    const timeBox = el('div', 'grid wide');
    const t0 = fieldInput({ key: 'start', label: 'Time in the tape', input: 'text', help: 'minutes:seconds, e.g. 12:04' }, r && r.start_sec !== null ? fmtTime(r.start_sec) : null, []);
    const t1 = fieldInput({ key: 'end', label: 'Until', input: 'text' }, r && r.end_sec !== null ? fmtTime(r.end_sec) : null, []);
    t1.querySelector('label').insertBefore(el('span', 'req req-end', ' *'), t1.querySelector('input'));
    timeBox.append(t0, t1, momentPicker(() => {
      // the tape this moment is in: the item itself, the other end, or the source
      const tapeOf = id => id !== null && S.entities.get(id).type === 'tape' ? id : null;
      return tapeOf(e.id) || tapeOf(st.other) || tapeOf(st.source);
    }, (a, b) => { t0.querySelector('input').value = fmtTime(a); t1.querySelector('input').value = fmtTime(b); }));
    eg.appendChild(timeBox);
    ev.appendChild(eg); f.appendChild(ev);

    if (r) {
      const forward = r.subject_id === e.id;
      kindSel.value = r.predicate + '|' + (forward || S.rtByKey[r.predicate].is_symmetric ? 's' : 'o');
      st.other = forward ? r.object_id : r.subject_id;
      picker.node.querySelector('.picked').innerHTML = `Selected: <b>${esc(S.entities.get(st.other).name)}</b>`;
    }
    onKind();

    const ra = el('div', 'row-actions');
    const ok = el('button', 'primary', r ? 'Save connection' : 'Add connection'); ok.type = 'submit';
    const cancel = el('button', 'ghost', 'Cancel'); cancel.type = 'button'; cancel.onclick = () => box.innerHTML = '';
    ra.append(ok, cancel); f.appendChild(ra);
    f.onsubmit = async evt => {
      evt.preventDefault();
      try {
        if (!st.choice) throw new Error('Choose what kind of connection this is');
        if (st.other === null) throw new Error('Choose who or what it connects to');
        const row = {};
        REL_FIELDS.forEach(fd => row[fd.key] = readInput(f.querySelector(`[data-key="${fd.key}"]`)));
        const s0 = t0.querySelector('input').value.trim(), s1 = t1.querySelector('input').value.trim();
        row.start_sec = timeBox.hidden || s0 === '' ? null : parseTime(s0);
        row.end_sec = timeBox.hidden || s1 === '' ? null : parseTime(s1);
        row.source_id = st.source;
        row.predicate = st.choice.rt.key;
        row.subject_id = st.choice.side === 's' ? e.id : st.other;
        row.object_id = st.choice.side === 's' ? st.other : e.id;
        if (r) await q(sb.from('relations').update(row).eq('id', r.id).select('id'));
        else await q(sb.from('relations').insert(row).select('id'));
        box.innerHTML = ''; toast(r ? 'Connection saved' : 'Connection added'); reload();
      } catch (err) { fail(err); }
    };
  }

  // Pick a moment from the tape's subtitles: click a line to start there, shift-click to end there.
  function momentPicker(tapeId, set) {
    const w = el('div', 'wide moment-pick');
    const open = el('button', 'linkbtn', 'Pick the time from the subtitles…'); open.type = 'button'; w.appendChild(open);
    open.onclick = async () => {
      try {
        const tid = tapeId();
        if (tid === null) throw new Error('Choose the tape first (as the connection or as the source)');
        const cues = await q(sb.from('cues').select('start_sec,end_sec,text').eq('tape_id', tid).eq('lang', 'en').order('start_sec'));
        if (!cues.length) throw new Error('This tape has no subtitles in the database');
        w.innerHTML = '';
        const find = el('input'); find.type = 'search'; find.placeholder = 'Search the words, e.g. ear irons';
        const help = el('div', 'help', 'Click a line to start there (it runs until that line ends). Shift-click a later line to end there.');
        const ul = el('ul', 'cue-list');
        let start = null;
        const draw = () => {
          const f = find.value.trim().toLowerCase(); ul.innerHTML = '';
          cues.filter(c => !f || c.text.toLowerCase().includes(f)).slice(0, 200).forEach(c => {
            const li = el('li', null, `<span class="tc">${fmtTime(c.start_sec)}</span> ${esc(c.text)}`);
            li.onclick = ev => {
              if (ev.shiftKey && start !== null) { if (+c.end_sec <= start) return fail(new Error('The end has to come after the start')); set(start, +c.end_sec); }
              else { start = +c.start_sec; set(start, +c.end_sec); }
              [...ul.children].forEach(x => x.classList.remove('on')); li.classList.add('on');
            };
            ul.appendChild(li);
          });
        };
        find.oninput = draw; w.append(find, help, ul); draw(); find.focus();
      } catch (err) { fail(err); }
    };
    return w;
  }

  // ---------- journey route editor ----------
  // How a journey is stored (see data-model.md): each leg is an event with
  // attrs.kind = journey_leg, linked to the journey by part_of (sort_order =
  // leg number), to its places by departs_from / arrives_at, and to the tape
  // moment where it draws by animates (tape -> leg).
  const ROUTE = { legKind: 'journey_leg', partOf: 'part_of', from: 'departs_from', to: 'arrives_at', animates: 'animates' };
  let routeMap = null;
  const legName = (journey, n, from, to) => `${journey.name}, leg ${n}: ${from.name} to ${to.name}`;
  const placeCoord = p => p.lat === null ? null : [p.lng, p.lat];
  const modeOf = leg => S.options['event.mode'].find(o => o.value === leg.entity.attrs.mode);

  async function loadRoute(j) {
    const parts = await q(sb.from('relations').select('*').eq('object_id', j.id).eq('predicate', ROUTE.partOf));
    const ids = parts.map(p => p.subject_id);
    if (!ids.length) return [];
    const ends = await q(sb.from('relations').select('*').in('subject_id', ids).in('predicate', [ROUTE.from, ROUTE.to]));
    const anims = await q(sb.from('relations').select('*').in('object_id', ids).eq('predicate', ROUTE.animates));
    return parts.map(p => {
      const fromRel = ends.find(r => r.subject_id === p.subject_id && r.predicate === ROUTE.from);
      const toRel = ends.find(r => r.subject_id === p.subject_id && r.predicate === ROUTE.to);
      const anim = anims.find(r => r.object_id === p.subject_id);
      return { id: p.subject_id, entity: S.entities.get(p.subject_id), part: p, order: p.sort_order,
               fromRel, toRel, anim, from: fromRel ? S.entities.get(fromRel.object_id) : null, to: toRel ? S.entities.get(toRel.object_id) : null };
    }).sort((a, b) => a.order - b.order);
  }

  function routeSection(j) {
    const s = el('div', 'sec route'); s.appendChild(el('h3', null, 'Route'));
    s.appendChild(el('p', 'help', 'Legs in order. Click a place on the map to use it in a new leg, or click empty map to add a new place there.'));
    const mapNode = el('div', 'routemap'); s.appendChild(mapNode);
    const tools = el('div', 'route-tools'); s.appendChild(tools);
    const listBox = el('ol', 'legs'); s.appendChild(listBox);
    const formBox = el('div'); s.appendChild(formBox);
    const R = { legs: [], draw: null, pick: null };   // draw: {leg, pts}; pick: callback for map place clicks

    if (routeMap) { routeMap.remove(); routeMap = null; }
    // the map is created once its box is on the page, so it gets the right size
    const empty = { type: 'FeatureCollection', features: [] };
    let ready = false;
    const initMap = () => {
    Site.rtlLabels();
    routeMap = new maplibregl.Map({ container: mapNode, style: 'https://tiles.openfreemap.org/styles/dark', center: [6.5, 49], zoom: 4.5, attributionControl: { compact: true } });
    routeMap.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    const INK = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
    const ACC = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    const setup = () => {
      ['r-legs', 'r-places', 'r-draft'].forEach(id => { if (!routeMap.getSource(id)) routeMap.addSource(id, { type: 'geojson', data: empty }); });
      if (!routeMap.getLayer('r-legs')) routeMap.addLayer({ id: 'r-legs', type: 'line', source: 'r-legs', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': ['case', ['get', 'sel'], 5, 3] } });
      if (!routeMap.getLayer('r-draft')) routeMap.addLayer({ id: 'r-draft', type: 'line', source: 'r-draft', paint: { 'line-color': INK, 'line-width': 2, 'line-dasharray': [2, 1.5] } });
      if (!routeMap.getLayer('r-places')) routeMap.addLayer({ id: 'r-places', type: 'circle', source: 'r-places', paint: { 'circle-radius': 6, 'circle-color': ['case', ['get', 'onroute'], ACC, 'rgba(0,0,0,0)'], 'circle-stroke-color': ['case', ['get', 'onroute'], '#11100e', INK], 'circle-stroke-width': ['case', ['get', 'onroute'], 2, 1] } });
      if (!routeMap.getLayer('r-labels')) routeMap.addLayer({ id: 'r-labels', type: 'symbol', source: 'r-places', filter: ['get', 'onroute'], layout: { 'text-field': ['get', 'name'], 'text-size': 11, 'text-offset': [0, 1.2], 'text-anchor': 'top', 'text-font': ['Noto Sans Regular'] }, paint: { 'text-color': INK, 'text-halo-color': '#11100e', 'text-halo-width': 1.4 } });
      ready = true; paint(true);
    };
    routeMap.on("load", setup);
    routeMap.on('error', () => { if (!ready) { routeMap.setStyle({ version: 8, glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf', sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#1a1815' } }] }); routeMap.once('style.load', setup); } });
    routeMap.on('mouseenter', 'r-places', () => routeMap.getCanvas().style.cursor = 'pointer');
    routeMap.on('mouseleave', 'r-places', () => routeMap.getCanvas().style.cursor = '');
    routeMap.on('click', ev => {
      if (R.draw) { R.draw.pts.push([ev.lngLat.lng, ev.lngLat.lat]); paintDraft(); return; }
      const hit = routeMap.queryRenderedFeatures(ev.point, { layers: ['r-places'] });
      if (hit.length) { const id = hit[0].properties.id; if (R.pick) R.pick(id); else openLegForm(null, id); return; }
      newPlaceForm(ev.lngLat);
    });
    };
    setTimeout(initMap, 0);

    function legLine(L, sel) {
      if (L.entity.attrs.path) return L.entity.attrs.path.coordinates;
      const a = L.from && placeCoord(L.from), b = L.to && placeCoord(L.to);
      return a && b ? [a, b] : null;
    }
    function paint(fit) {
      if (!ready) return;
      const feats = R.legs.map(L => { const c = legLine(L); return c && { type: 'Feature', properties: { color: modeOf(L).display.color, sel: !!(R.draw && R.draw.leg.id === L.id) }, geometry: { type: 'LineString', coordinates: c } }; }).filter(Boolean);
      routeMap.getSource('r-legs').setData({ type: 'FeatureCollection', features: feats });
      const onRoute = new Set(R.legs.flatMap(L => [L.from && L.from.id, L.to && L.to.id]));
      const places = [...S.entities.values()].filter(p => p.type === 'place' && p.lat !== null);
      routeMap.getSource('r-places').setData({ type: 'FeatureCollection', features: places.map(p => ({ type: 'Feature', properties: { id: p.id, name: p.name, onroute: onRoute.has(p.id) }, geometry: { type: 'Point', coordinates: placeCoord(p) } })) });
      if (fit && feats.length) {
        const all = feats.flatMap(f => f.geometry.coordinates);
        const bb = all.reduce((b, c) => [[Math.min(b[0][0], c[0]), Math.min(b[0][1], c[1])], [Math.max(b[1][0], c[0]), Math.max(b[1][1], c[1])]], [all[0], all[0]]);
        routeMap.fitBounds(bb, { padding: 50, duration: 0, maxZoom: 9 });
      }
    }
    function paintDraft() {
      if (!ready) return;
      const d = R.draw;
      routeMap.getSource('r-draft').setData(d ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [placeCoord(d.leg.from), ...d.pts, placeCoord(d.leg.to)] } }] } : empty);
    }

    async function reload(fit) {
      R.legs = await loadRoute(j); renderLegs(); paint(fit);
    }
    function renderLegs() {
      listBox.innerHTML = '';
      tools.innerHTML = '';
      const add = el('button', 'ghost', '+ Add leg'); add.type = 'button'; add.onclick = () => openLegForm(null, null); tools.appendChild(add);
      if (!R.legs.length) listBox.appendChild(el('p', 'help', 'No legs yet.'));
      R.legs.forEach((L, i) => {
        const li = el('li', 'leg');
        const mode = modeOf(L);
        const sw = `<svg class="ln" viewBox="0 0 18 4" width="18" height="4"><line x1="1" y1="2" x2="17" y2="2" stroke="${mode.display.color}" stroke-width="3" stroke-linecap="round"/></svg>`;
        const anim = L.anim ? ` · draws at tape ${S.entities.get(L.anim.subject_id).attrs.number} ${fmtTime(L.anim.start_sec)}` : ' · <span class="warn">no tape moment</span>';
        const missing = [L.from ? null : 'start place', L.to ? null : 'end place'].filter(x => x).join(' and ');
        const nocoord = [L.from, L.to].filter(p => p && p.lat === null).map(p => p.name);
        li.innerHTML = `<div class="leg-main"><div class="leg-t"><b>${L.order}.</b> ${L.from ? esc(L.from.name) : '?'} → ${L.to ? esc(L.to.name) : '?'}</div>
          <div class="meta">${sw} ${esc(mode.label)}${L.entity.date_text ? ' · ' + esc(L.entity.date_text) : ''}${anim}${L.entity.attrs.path ? ' · drawn path' : ''}
          ${missing ? `<span class="warn"> · missing ${esc(missing)}</span>` : ''}${nocoord.length ? `<span class="warn"> · no position yet: ${esc(nocoord.join(', '))}</span>` : ''}</div></div>`;
        const acts = el('div', 'acts');
        const btn = (label, fn, dis) => { const b = el('button', 'linkbtn', label); b.type = 'button'; b.disabled = !!dis; b.onclick = () => fn().catch(fail); acts.appendChild(b); };
        btn('↑', () => moveLeg(i, -1), i === 0);
        btn('↓', () => moveLeg(i, 1), i === R.legs.length - 1);
        btn('Edit', async () => openLegForm(L, null));
        btn(L.entity.attrs.path ? 'Redraw' : 'Draw path', async () => startDraw(L), !(L.from && L.to && placeCoord(L.from) && placeCoord(L.to)));
        btn('Open', async () => openEntity(L.id));
        btn('Remove', () => removeLeg(i));
        li.append(acts); listBox.appendChild(li);
      });
    }

    // ----- add / edit a leg -----
    function openLegForm(L, presetPlace) {
      formBox.innerHTML = '';
      const f = el('form', 'relform'); formBox.appendChild(f);
      f.appendChild(el('h4', null, L ? `Edit leg ${L.order}` : `New leg ${R.legs.length + 1}`));
      const prev = R.legs.length ? R.legs[R.legs.length - 1] : null;
      const st = { from: L ? (L.from && L.from.id) : (prev && prev.to ? prev.to.id : presetPlace), to: L ? (L.to && L.to.id) : (prev && prev.to ? presetPlace : null), tape: L && L.anim ? L.anim.subject_id : null };
      const g = el('div', 'grid');
      const fromP = entityPicker('From', ['place'], st.from, id => st.from = id);
      const toP = entityPicker('To', ['place'], st.to, id => st.to = id);
      g.append(fromP.node, toP.node);
      const pickBtns = el('div', 'wide help');
      pickBtns.innerHTML = 'Or pick on the map: ';
      [['from', fromP], ['to', toP]].forEach(([k, P]) => {
        const b = el('button', 'linkbtn', k === 'from' ? 'choose start on map' : 'choose end on map'); b.type = 'button';
        b.onclick = () => { R.pick = id => { st[k] = id; P.show(id); R.pick = null; toast(`${k === 'from' ? 'Start' : 'End'}: ${S.entities.get(id).name}`); }; toast('Click a place on the map'); };
        pickBtns.append(b, document.createTextNode('  '));
      });
      g.appendChild(pickBtns);
      const modeF = fieldInput({ key: 'mode', label: 'Travelled by', input: 'select', required: true }, L ? L.entity.attrs.mode : null, optionChoices('event', 'mode'));
      const dateF = fieldInput({ key: 'date_text', label: 'Date as written', input: 'text' }, L ? L.entity.date_text : null, []);
      const certF = fieldInput({ key: 'certainty', label: 'Certainty', input: 'enum', list: 'certainty', required: true }, L ? L.entity.certainty : j.certainty, enumChoices('certainty'));
      const statF = fieldInput({ key: 'status', label: 'On the site', input: 'enum', list: 'status', required: true }, L ? L.entity.status : j.status, enumChoices('status'));
      const tapes = [...S.entities.values()].filter(x => x.type === 'tape').sort((a, b) => a.attrs.number - b.attrs.number).map(t => ({ value: t.id, label: t.name }));
      const tapeF = fieldInput({ key: 'tape', label: 'Draws on the map during', input: 'select' }, st.tape, tapes);
      const timeF = fieldInput({ key: 'time', label: 'At (minutes:seconds)', input: 'text' }, L && L.anim ? fmtTime(L.anim.start_sec) : null, []);
      const noteF = fieldInput({ key: 'note', label: 'Note', input: 'textarea' }, L && L.part.note !== null ? L.part.note : null, []);
      g.append(modeF, dateF, certF, statF, tapeF, timeF, noteF);
      f.appendChild(g);
      const ra = el('div', 'row-actions');
      const ok = el('button', 'primary', L ? 'Save leg' : 'Add leg'); ok.type = 'submit';
      const cancel = el('button', 'ghost', 'Cancel'); cancel.type = 'button'; cancel.onclick = () => { formBox.innerHTML = ''; R.pick = null; };
      ra.append(ok, cancel); f.appendChild(ra);
      f.onsubmit = async evt => {
        evt.preventDefault();
        try {
          if (st.from === null || st.to === null) throw new Error('Choose where the leg starts and ends');
          if (st.from === st.to) throw new Error('Start and end are the same place');
          const v = k => readInput(f.querySelector(`[data-key="${k}"]`));
          const tapeId = v('tape'), timeTxt = v('time');
          if ((tapeId === null) !== (timeTxt === null)) throw new Error('For the map moment, choose both the tape and the time (or neither)');
          await saveLeg(L, { from: st.from, to: st.to, mode: v('mode'), date_text: v('date_text'), certainty: v('certainty'), status: v('status'), note: v('note'),
                             tape: tapeId, start: timeTxt === null ? null : parseTime(timeTxt) });
          formBox.innerHTML = ''; toast(L ? 'Leg saved' : 'Leg added'); await reload(false);
        } catch (err) { fail(err); }
      };
      f.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    async function saveLeg(L, d) {
      const from = S.entities.get(d.from), to = S.entities.get(d.to);
      const n = L ? L.order : R.legs.length + 1;
      const rel = (predicate, subject_id, object_id, extra) => ({ predicate, subject_id, object_id, certainty: d.certainty, status: d.status, ...extra });
      if (!L) {
        const name = legName(j, n, from, to);
        const leg = await q(sb.from('entities').insert({ type: 'event', name, slug: slugify(name), date_text: d.date_text, certainty: d.certainty, status: d.status,
          attrs: { kind: ROUTE.legKind, mode: d.mode, drawing: 'straight' } }).select().single());
        S.entities.set(leg.id, leg);
        try {
          const rows = [rel(ROUTE.partOf, leg.id, j.id, { sort_order: n, note: d.note }), rel(ROUTE.from, leg.id, d.from), rel(ROUTE.to, leg.id, d.to)];
          if (d.tape !== null) rows.push(rel(ROUTE.animates, d.tape, leg.id, { start_sec: d.start }));
          await q(sb.from('relations').insert(rows).select('id'));
        } catch (err) {   // keep the database tidy: remove the half-made leg
          await q(sb.from('entities').delete().eq('id', leg.id).select('id')); S.entities.delete(leg.id); throw err;
        }
        return;
      }
      const attrs = { ...L.entity.attrs, mode: d.mode };
      const placesChanged = d.from !== (L.from && L.from.id) || d.to !== (L.to && L.to.id);
      if (placesChanged && attrs.path) { delete attrs.path; attrs.drawing = 'straight'; }   // a drawn path belongs to the old places
      const saved = await q(sb.from('entities').update({ name: legName(j, n, from, to), date_text: d.date_text, certainty: d.certainty, status: d.status, attrs }).eq('id', L.id).select().single());
      S.entities.set(saved.id, saved);
      const upsertEnd = async (relRow, predicate, place) => {
        if (relRow) await q(sb.from('relations').update({ object_id: place, certainty: d.certainty, status: d.status }).eq('id', relRow.id).select('id'));
        else await q(sb.from('relations').insert(rel(predicate, L.id, place)).select('id'));
      };
      await upsertEnd(L.fromRel, ROUTE.from, d.from);
      await upsertEnd(L.toRel, ROUTE.to, d.to);
      await q(sb.from('relations').update({ note: d.note, certainty: d.certainty, status: d.status }).eq('id', L.part.id).select('id'));
      if (L.anim && d.tape === null) await q(sb.from('relations').delete().eq('id', L.anim.id).select('id'));
      else if (L.anim) await q(sb.from('relations').update({ subject_id: d.tape, start_sec: d.start, status: d.status }).eq('id', L.anim.id).select('id'));
      else if (d.tape !== null) await q(sb.from('relations').insert(rel(ROUTE.animates, d.tape, L.id, { start_sec: d.start })).select('id'));
    }

    async function renumber(legs) {
      for (let i = 0; i < legs.length; i++) {
        const L = legs[i], n = i + 1;
        if (L.order !== n) await q(sb.from('relations').update({ sort_order: n }).eq('id', L.part.id).select('id'));
        if (L.from && L.to) {
          const name = legName(j, n, L.from, L.to);
          if (name !== L.entity.name) { const s2 = await q(sb.from('entities').update({ name }).eq('id', L.id).select().single()); S.entities.set(s2.id, s2); }
        }
      }
    }
    async function moveLeg(i, dir) {
      const legs = [...R.legs]; const [L] = legs.splice(i, 1); legs.splice(i + dir, 0, L);
      await renumber(legs); await reload(false);
    }
    async function removeLeg(i) {
      const L = R.legs[i];
      if (!confirm(`Remove leg ${L.order} (${L.from ? L.from.name : '?'} → ${L.to ? L.to.name : '?'})? The places stay.`)) return;
      await q(sb.from('entities').delete().eq('id', L.id).select('id')); S.entities.delete(L.id);
      await renumber(R.legs.filter((_, k) => k !== i)); await reload(false); toast('Leg removed');
    }

    // ----- hand-drawn path -----
    function startDraw(L) {
      R.draw = { leg: L, pts: [] }; paint(false); paintDraft();
      tools.innerHTML = '';
      tools.appendChild(el('span', 'help', `Drawing leg ${L.order}: click on the map to add bends between ${esc(L.from.name)} and ${esc(L.to.name)}.`));
      const b = (label, cls, fn) => { const x = el('button', cls, label); x.type = 'button'; x.onclick = () => fn().catch(fail); tools.appendChild(x); };
      b('Undo point', 'ghost', async () => { R.draw.pts.pop(); paintDraft(); });
      b('Save path', 'primary', async () => {
        const coords = [placeCoord(L.from), ...R.draw.pts, placeCoord(L.to)];
        const attrs = { ...L.entity.attrs, drawing: 'manual', path: { type: 'LineString', coordinates: coords } };
        const saved = await q(sb.from('entities').update({ attrs }).eq('id', L.id).select().single()); S.entities.set(saved.id, saved);
        endDraw(); toast('Path saved'); await reload(false);
      });
      if (L.entity.attrs.path) b('Use straight line', 'ghost', async () => {
        const attrs = { ...L.entity.attrs, drawing: 'straight' }; delete attrs.path;
        const saved = await q(sb.from('entities').update({ attrs }).eq('id', L.id).select().single()); S.entities.set(saved.id, saved);
        endDraw(); toast('Straight line'); await reload(false);
      });
      b('Cancel', 'ghost', async () => { endDraw(); renderLegs(); paint(false); });
      mapNode.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    function endDraw() { R.draw = null; paintDraft(); }

    // ----- new place from a map click -----
    function newPlaceForm(lngLat) {
      formBox.innerHTML = '';
      const f = el('form', 'relform'); formBox.appendChild(f);
      f.appendChild(el('h4', null, `New place at ${lngLat.lat.toFixed(4)}, ${lngLat.lng.toFixed(4)}`));
      const g = el('div', 'grid');
      g.append(fieldInput({ key: 'name', label: 'Name', input: 'text', required: true }, null, []),
               fieldInput({ key: 'kind', label: 'Kind of place', input: 'select', required: true }, null, optionChoices('place', 'kind')),
               fieldInput({ key: 'coord_precision', label: 'How exact', input: 'text', help: 'exact, town, approx, region…' }, null, []),
               fieldInput({ key: 'certainty', label: 'Certainty', input: 'enum', list: 'certainty', required: true }, null, enumChoices('certainty')));
      f.appendChild(g);
      const ra = el('div', 'row-actions');
      const ok = el('button', 'primary', 'Create place'); ok.type = 'submit';
      const cancel = el('button', 'ghost', 'Cancel'); cancel.type = 'button'; cancel.onclick = () => formBox.innerHTML = '';
      ra.append(ok, cancel); f.appendChild(ra);
      f.onsubmit = async evt => {
        evt.preventDefault();
        try {
          const v = k => readInput(f.querySelector(`[data-key="${k}"]`));
          const name = v('name');
          const p = await q(sb.from('entities').insert({ type: 'place', name, slug: slugify(name), lat: +lngLat.lat.toFixed(5), lng: +lngLat.lng.toFixed(5),
            coord_precision: v('coord_precision'), certainty: v('certainty'), status: j.status, attrs: { kind: v('kind') } }).select().single());
          S.entities.set(p.id, p); renderList(); paint(false);
          toast(`Created ${p.name}. Click it to use it in a leg.`); formBox.innerHTML = '';
        } catch (err) { fail(err); }
      };
      f.querySelector('[data-key="name"]').focus();
    }

    reload(true).catch(fail);
    return s;
  }

  // ---------- scans (entity_pages + media + storage) ----------
  // media.storage_path is "<bucket>/<file>"; the public address of a file is
  // <project>/storage/v1/object/public/<storage_path>.
  const publicUrl = path => C.supabaseUrl.replace(/\/$/, '') + '/storage/v1/object/public/' + path;
  const splitPath = path => { const i = path.indexOf('/'); return { bucket: path.slice(0, i), key: path.slice(i + 1) }; };
  const isImage = mime => mime.startsWith('image/');
  async function storedFiles(bucket) {
    const out = new Set(); let offset = 0;
    for (;;) {
      const page = await q(sb.storage.from(bucket).list('', { limit: 1000, offset }));
      page.forEach(f => out.add(f.name)); if (page.length < 1000) return out; offset += 1000;
    }
  }
  async function uploadTo(path, file, replace) {
    if (!file.type) throw new Error(`"${file.name}": the file type is unknown. Use an image or a PDF.`);
    const { bucket, key } = splitPath(path);
    await q(sb.storage.from(bucket).upload(key, file, { contentType: file.type, upsert: replace }));
  }
  // File names: <item slug>_<NN>-<page label>.<ext>, and <item slug>_original.<ext>
  // for the file as received (e.g. the archive's PDF). The original name is kept
  // in media.original_filename.
  const extOf = name => { if (!name.includes('.')) throw new Error(`"${name}" has no file extension (.jpg, .png, .pdf).`); return name.split('.').pop().toLowerCase(); };
  const pageFileName = (e, n, label, file) => `${e.slug}_${String(n).padStart(2, '0')}-${slugify(label)}.${extOf(file.name)}`;
  const originalFileName = (e, file) => `${e.slug}_original.${extOf(file.name)}`;
  async function freePath(bucket, name) {
    if ((await storedFiles(bucket)).has(name)) throw new Error(`A file named "${name}" is already in storage. Give the page another label, or replace the file on the existing page.`);
    return bucket + '/' + name;
  }
  // width and height of an image file, so pages can keep their space while loading
  const imageSize = file => !isImage(file.type) ? Promise.resolve({ width_px: null, height_px: null }) : new Promise((ok, bad) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => { URL.revokeObjectURL(url); ok({ width_px: im.naturalWidth, height_px: im.naturalHeight }); };
    im.onerror = () => { URL.revokeObjectURL(url); bad(new Error(`"${file.name}" could not be read as an image.`)); };
    im.src = url;
  });
  function preview(page, present) {
    const m = page.media;
    if (!present) return `<div class="scan-missing">File not uploaded yet<br><span>${esc(m.original_filename === null ? m.storage_path : m.original_filename)}</span></div>`;
    const url = publicUrl(m.storage_path);
    return isImage(m.mime_type) ? `<a href="${esc(url)}" target="_blank" rel="noopener"><img src="${esc(url)}" alt="${esc(page.label)}" loading="lazy"></a>`
      : `<a class="scan-pdf" href="${esc(url)}" target="_blank" rel="noopener">Open PDF ↗</a>`;
  }

  function scansSection(e) {
    const s = el('div', 'sec'); s.appendChild(el('h3', null, 'Scans'));
    const origBox = el('div', 'origfile'); const listBox = el('div', 'scans'); const addBox = el('div'); s.append(origBox, listBox, addBox);
    const PAGE_FIELDS = [
      { key: 'label', label: 'Side or page', input: 'text', required: true, help: 'e.g. Front, Back, Page 2' },
      { key: 'transcription_certainty', label: 'Transcription checked?', input: 'enum', list: 'certainty', required: true },
      { key: 'transcription', label: 'Transcription (original language)', input: 'textarea', rows: 5 },
      { key: 'translation_en', label: 'English translation', input: 'textarea', rows: 5 },
    ];
    // stored on the file itself (media), shown under the picture on the site
    const MEDIA_FIELDS = [
      { key: 'credit', label: 'Credit', input: 'text', wide: true, help: 'Who made it and its licence, e.g. "Jim van der Mee, CC BY-SA 2.0, via Wikimedia Commons"' },
      { key: 'alt_text', label: 'Description for screen readers', input: 'text', wide: true, help: 'What the picture shows, in one sentence' },
    ];
    const load = async () => {
      await renderOriginal();
      const pages = await q(sb.from('entity_pages').select('*').eq('entity_id', e.id).order('position'));
      const fields = pages.length ? await q(sb.from('page_fields').select('id,page_id').in('page_id', pages.map(p => p.id))) : [];
      const media = pages.length ? await q(sb.from('media').select('*').in('id', pages.map(p => p.image_id))) : [];
      pages.forEach(p => p.media = media.find(m => m.id === p.image_id));
      const buckets = [...new Set(media.map(m => splitPath(m.storage_path).bucket))];
      const present = {}; for (const b of buckets) present[b] = await storedFiles(b);
      listBox.innerHTML = '';
      if (!pages.length) listBox.appendChild(el('p', 'help', 'No scans yet.'));
      pages.forEach((p, i) => {
        const { bucket, key } = splitPath(p.media.storage_path), has = present[bucket].has(key);
        const card = el('form', 'scan');
        card.appendChild(el('div', 'scan-prev', preview(p, has)));
        const g = el('div', 'grid');
        PAGE_FIELDS.forEach(f => g.appendChild(fieldInput(f, p[f.key], f.input === 'enum' ? enumChoices(f.list) : [])));
        MEDIA_FIELDS.forEach(f => g.appendChild(fieldInput(f, p.media[f.key], [])));
        const right = el('div', 'scan-body'); right.appendChild(g);
        const nf = fields.filter(f => f.page_id === p.id).length;
        right.appendChild(el('p', 'help', `File: ${esc(key)}${nf ? ` · ${nf} hover label${nf === 1 ? '' : 's'} on the scan` : ''}`));
        const acts = el('div', 'row-actions');
        const save = el('button', 'primary', 'Save'); save.type = 'submit'; acts.appendChild(save);
        const btn = (label, fn, dis) => { const b = el('button', 'ghost', label); b.type = 'button'; b.disabled = !!dis; b.onclick = () => fn().catch(fail); acts.appendChild(b); };
        btn('↑', () => movePage(pages, i, -1), i === 0);
        btn('↓', () => movePage(pages, i, 1), i === pages.length - 1);
        const fileIn = el('input'); fileIn.type = 'file'; fileIn.accept = 'image/*,application/pdf'; fileIn.hidden = true;
        fileIn.onchange = async () => { try { await uploadTo(p.media.storage_path, fileIn.files[0], has); toast('File uploaded'); await load(); } catch (err) { fail(err); } };
        acts.appendChild(fileIn);
        btn(has ? 'Replace file' : 'Upload file', async () => fileIn.click());
        btn('Remove', async () => {
          if (!confirm(`Remove "${p.label}" from this item? The file stays in storage.`)) return;
          await q(sb.from('entity_pages').delete().eq('id', p.id).select('id'));
          await renumberPages(pages.filter(x => x.id !== p.id)); toast('Removed'); await load();
        });
        right.appendChild(acts); card.appendChild(right);
        card.onsubmit = async ev => {
          ev.preventDefault();
          try {
            const row = {}; PAGE_FIELDS.forEach(f => row[f.key] = readInput(card.querySelector(`[data-key="${f.key}"]`)));
            const mrow = {}; MEDIA_FIELDS.forEach(f => mrow[f.key] = readInput(card.querySelector(`[data-key="${f.key}"]`)));
            await q(sb.from('entity_pages').update(row).eq('id', p.id).select('id'));
            await q(sb.from('media').update(mrow).eq('id', p.media.id).select('id')); toast('Saved');
          } catch (err) { fail(err); }
        };
        listBox.appendChild(card);
      });
      renderAdd(pages.length);
    };
    async function renderOriginal() {
      const cur = S.entities.get(e.id).original_file_id;
      const m = cur === null ? null : await q(sb.from('media').select('*').eq('id', cur).single());
      origBox.innerHTML = '';
      const row = el('div', 'route-tools');
      row.appendChild(el('span', 'help', m === null ? 'No original file. Keep the file as it came from the archive (e.g. its PDF) for download:'
        : `Original file: <a href="${esc(publicUrl(m.storage_path))}" target="_blank" rel="noopener">${esc(splitPath(m.storage_path).key)}</a>${m.original_filename === null ? '' : ` (received as ${esc(m.original_filename)})`}`));
      const fi = el('input'); fi.type = 'file'; fi.hidden = true; fi.accept = 'image/*,application/pdf';
      const b = el('button', 'ghost', m === null ? 'Upload original' : 'Replace original'); b.type = 'button'; b.onclick = () => fi.click();
      fi.onchange = async () => {
        try {
          const file = fi.files[0];
          if (m === null) {
            const path = await freePath('scans', originalFileName(e, file));
            await uploadTo(path, file, false);
            const nm = await q(sb.from('media').insert({ storage_path: path, mime_type: file.type, original_filename: file.name, ...(await imageSize(file)) }).select().single());
            const saved = await q(sb.from('entities').update({ original_file_id: nm.id }).eq('id', e.id).select().single());
            S.entities.set(saved.id, saved);
          } else {
            if (file.type !== m.mime_type) throw new Error(`Replace a ${m.mime_type} file with the same kind of file; this one is ${file.type}.`);
            await uploadTo(m.storage_path, file, true);
            await q(sb.from('media').update({ original_filename: file.name }).eq('id', m.id).select('id'));
          }
          toast('Original file saved'); await renderOriginal();
        } catch (err) { fail(err); }
      };
      row.append(fi, b); origBox.appendChild(row);
    }
    async function renumberPages(list) {
      // positions are unique per item: park them out of the way first, then number 1..n
      for (const [i, p] of list.entries()) await q(sb.from('entity_pages').update({ position: -1 - i }).eq('id', p.id).select('id'));
      for (const [i, p] of list.entries()) await q(sb.from('entity_pages').update({ position: i + 1 }).eq('id', p.id).select('id'));
    }
    async function movePage(pages, i, dir) {
      const list = [...pages]; const [p] = list.splice(i, 1); list.splice(i + dir, 0, p);
      await renumberPages(list); await load();
    }
    function renderAdd(count) {
      addBox.innerHTML = '';
      const f = el('form', 'relform'); f.appendChild(el('h4', null, 'Add a scan'));
      const g = el('div', 'grid');
      g.appendChild(fieldInput(PAGE_FIELDS[0], null, []));
      g.appendChild(fieldInput(PAGE_FIELDS[1], null, enumChoices(PAGE_FIELDS[1].list)));
      const fw = el('div'); const fl = el('label', null, 'File (image or PDF) <span class="req">*</span>');
      const fi = el('input'); fi.type = 'file'; fi.accept = 'image/*,application/pdf'; fi.required = true; fl.appendChild(fi); fw.appendChild(fl); g.appendChild(fw);
      f.appendChild(g);
      const ra = el('div', 'row-actions'); const ok = el('button', 'primary', 'Upload and add'); ok.type = 'submit'; ra.appendChild(ok); f.appendChild(ra);
      f.onsubmit = async ev => {
        ev.preventDefault();
        try {
          const file = fi.files[0], label = readInput(f.querySelector('[data-key="label"]')), cert = readInput(f.querySelector('[data-key="transcription_certainty"]'));
          if (label === null) throw new Error('Give the page a label first, e.g. Front or Page 2');
          const path = await freePath('scans', pageFileName(e, count + 1, label, file));
          const size = await imageSize(file);
          ok.disabled = true; ok.textContent = 'Uploading…';
          await uploadTo(path, file, false);
          const m = await q(sb.from('media').insert({ storage_path: path, mime_type: file.type, original_filename: file.name, ...size }).select().single());
          await q(sb.from('entity_pages').insert({ entity_id: e.id, position: count + 1, label, image_id: m.id, transcription_certainty: cert }).select('id'));
          toast('Scan added'); await load();
        } catch (err) { ok.disabled = false; ok.textContent = 'Upload and add'; fail(err); }
      };
      addBox.appendChild(f);
    }
    load().catch(fail);
    return s;
  }

  // ---------- tape moments: the video, every subtitle line, and what is tagged at each line ----------
  // Tag a line: click its words (or select some words first) and the tag form opens under it.
  const MOMENT_PREDICATES = ['mentions', 'shows', 'illustrates'];   // tape -> item at a time (same list as the Watch view)
  const TAG_PREDICATE = 'mentions';                                  // what a new tag is unless another is chosen
  const TAG_ORIGIN = 'admin:tag';                                    // relations.origin for tags made here
  const PICTURE_TYPE = 'photo';                                      // a picture added from a line becomes this kind of item
  const PICTURE_PREDICATE = 'illustrates';                           // ... shown on screen from the line
  const PICTURE_PAGE_LABEL = 'Photo';                                // its one page
  const PICTURE_MIN_SEC = 8;                                         // preset: a picture stays up at least this long
  const DEPICTS = 'depicts';                                         // photo -> what it shows
  const PLAYER_TICK_MS = 400;                                        // how often the current line is checked
  const YT_API = 'https://www.youtube.com/iframe_api';
  let ytApiPromise = null;
  function youtubeApi() {
    if (ytApiPromise) return ytApiPromise;
    ytApiPromise = new Promise((resolve, reject) => {
      if (window.YT && window.YT.Player) return resolve(window.YT);
      window.onYouTubeIframeAPIReady = () => resolve(window.YT);
      const s = document.createElement('script'); s.src = YT_API;
      s.onerror = () => { ytApiPromise = null; reject(new Error('The YouTube player could not be loaded (no connection to youtube.com?)')); };
      document.head.appendChild(s);
    });
    return ytApiPromise;
  }

  async function openMomentsTool() {
    S.current = null; history.replaceState(null, '', '#'); renderList();
    const ed = $('#editor'); ed.innerHTML = '';
    if (pinMap) { pinMap.remove(); pinMap = null; }
    if (routeMap) { routeMap.remove(); routeMap = null; }
    const root = el('div', 'mt'); ed.appendChild(root);
    root.appendChild(el('div', 'ed-head', '<div><div class="k">Tool</div><h1>Tape moments</h1></div>'));
    root.appendChild(el('p', 'help', 'The tape, its subtitles, and what is tagged at each line. Click a line\'s words to tag something said there (select words first, e.g. "Jewish quarter", and they become the name). Switch a tag on to show it as a card next to the transcript on the Watch page.'));
    const tapes = [...S.entities.values()].filter(e => e.type === 'tape').sort((a, b) => a.attrs.number - b.attrs.number);
    if (!tapes.length) throw new Error('There are no tapes in the database');

    // player (sticky, so it stays in view while scrolling the lines)
    const pl = el('div', 'mt-player');
    const frame = el('div', 'mt-frame'); const slot = el('div'); frame.appendChild(slot);
    const plNote = el('div', 'help mt-plnote');
    const follow = el('label', 'selall', '<input type="checkbox" checked> Follow the video');
    const now = el('span', 'mt-now');
    const plSide = el('div', 'mt-plside'); plSide.append(now, follow, plNote);
    pl.append(frame, plSide); root.appendChild(pl);
    const P = { yt: null, ready: false, tapeId: null };
    const tapeById = id => S.entities.get(id);
    const showPlayerFor = async tape => {
      P.tapeId = tape.id;
      const vid = tape.attrs.youtube_id;
      if (!vid) { frame.hidden = true; plNote.textContent = `${tape.name} has no YouTube video ID yet. Add it on the tape's page to play it here.`; return; }
      frame.hidden = false; plNote.textContent = 'Loading the video…';
      try {
        const YT = await youtubeApi();
        if (!root.isConnected) return;
        if (P.yt) { P.yt.cueVideoById(vid); plNote.textContent = ''; return; }
        P.yt = new YT.Player(slot, { videoId: vid, width: '100%', height: '100%', playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
          events: { onReady: () => { P.ready = true; plNote.textContent = ''; },
                    onError: ev => { plNote.textContent = `YouTube could not play this video (error ${ev.data}).`; } } });
      } catch (err) { frame.hidden = true; plNote.textContent = err.message; }
    };
    const seek = s => { if (!P.ready) return toast('The video is not loaded', true); P.yt.seekTo(+s, true); P.yt.playVideo(); };

    const bar = el('div', 'mt-bar');
    const tapeSel = el('select'); tapeSel.setAttribute('aria-label', 'Tape');
    tapes.forEach(t => { const o = el('option', null, esc(t.name)); o.value = t.id; tapeSel.appendChild(o); });
    const modeSel = el('select'); modeSel.setAttribute('aria-label', 'Lines');
    [['all', 'Every subtitle line'], ['tagged', 'Tagged lines only']].forEach(([v, l]) => { const o = el('option', null, l); o.value = v; modeSel.appendChild(o); });
    const typeSel = el('select'); typeSel.setAttribute('aria-label', 'Type');
    typeSel.appendChild(el('option', null, 'All types')).value = '';
    S.types.forEach(t => { const o = el('option', null, esc(t.label)); o.value = t.key; typeSel.appendChild(o); });
    const find = el('input'); find.type = 'search'; find.placeholder = 'Search words or names…';
    const onlyOn = el('label', 'selall', '<input type="checkbox"> Only switched on');
    bar.append(tapeSel, modeSel, typeSel, find, onlyOn); root.appendChild(bar);
    const counts = el('div', 'mt-counts'); root.appendChild(counts);
    const list = el('div', 'mt-list'); root.appendChild(list);
    let cues = [], rels = [], rows = [], tagOpen = null, byLineNow = new Map();   // tagOpen: { cue, form api } of the open tag form
    const load = async () => {
      list.innerHTML = '<p class="help">Loading…</p>'; tagOpen = null;
      [cues, rels] = await Promise.all([
        q(sb.from('cues').select('start_sec,end_sec,text').eq('tape_id', tapeSel.value).eq('lang', 'en').order('start_sec')),
        q(sb.from('relations').select('id,predicate,object_id,start_sec,note,on_watch').eq('subject_id', tapeSel.value).in('predicate', MOMENT_PREDICATES).order('start_sec')),
      ]);
      draw();
    };
    const tagFilter = r => {
      const e = S.entities.get(r.object_id);
      if (typeSel.value !== '' && e.type !== typeSel.value) return false;
      if (onlyOn.querySelector('input').checked && !r.on_watch) return false;
      return true;
    };
    // the subtitle line a moment belongs to: the last line starting at or before it
    const lineOf = r => { let c = null; for (const x of cues) { if (+x.start_sec <= +r.start_sec + 0.05) c = x; else break; } return c; };
    const BEFORE = { start_sec: 0, end_sec: 0, text: '(before the first subtitle)', synthetic: true };
    async function setWatch(ids, on) {
      await q(sb.from('relations').update({ on_watch: on }).in('id', ids).select('id'));
      rels.forEach(r => { if (ids.includes(r.id)) r.on_watch = on; });
    }
    function draw() {
      const f = find.value.trim().toLowerCase(), all = modeSel.value === 'all';
      const byLine = new Map(); byLineNow = byLine;
      rels.filter(tagFilter).forEach(r => { const c = lineOf(r) || BEFORE; (byLine.get(c) || byLine.set(c, []).get(c)).push(r); });
      const tagsAt = c => byLine.has(c) ? byLine.get(c) : [];   // a line with no tags has none
      const matches = c => !f || c.text.toLowerCase().includes(f) || tagsAt(c).some(r => S.entities.get(r.object_id).name.toLowerCase().includes(f));
      const filtersOn = typeSel.value !== '' || onlyOn.querySelector('input').checked;
      // every line (unless a tag filter is set, then only lines with matching tags), or tagged lines only
      const lines = [...(byLine.has(BEFORE) ? [BEFORE] : []), ...cues].filter(c => (all && !filtersOn ? true : byLine.has(c)) && matches(c));
      const shownTags = lines.flatMap(tagsAt);
      counts.innerHTML = `<span>${rels.filter(r => r.on_watch).length} of ${rels.length} moments on this tape are switched on · ${lines.length} line(s) shown</span>`;
      const bulk = (label, on) => { const b = el('button', 'ghost', label); b.type = 'button'; b.disabled = !shownTags.length;
        b.onclick = async () => { try { if (!confirm(`${label}: ${shownTags.length} moment(s)?`)) return; await setWatch(shownTags.map(r => r.id), on); toast('Saved'); draw(); } catch (err) { fail(err); } };
        counts.appendChild(b); };
      bulk('Switch on all shown', true); bulk('Switch off all shown', false);
      list.innerHTML = ''; rows = []; tagOpen = null;
      if (!cues.length) list.appendChild(el('p', 'help', 'This tape has no subtitles in the database.'));
      else if (!lines.length) list.appendChild(el('p', 'help', rels.length || all ? 'Nothing matches the filters.' : 'Nothing is tagged on this tape yet.'));
      lines.forEach(c => {
        const row = el('div', 'mt-row');
        const line = el('div', 'mt-line');
        const tc = el('button', 'tc', fmtTime(c.start_sec)); tc.type = 'button'; tc.title = 'Play from here'; tc.onclick = () => seek(c.start_sec);
        const words = el('span', 'mt-words', esc(c.text));
        line.append(tc, words);
        if (!c.synthetic) {
          words.title = 'Click to tag something said here';
          words.onmouseup = () => {
            const sel = window.getSelection();
            const picked = sel && !sel.isCollapsed && words.contains(sel.anchorNode) && words.contains(sel.focusNode) ? sel.toString().trim() : '';
            if (tagOpen && tagOpen.cue === c) { if (picked) tagOpen.api.setName(picked); return; }
            openTagForm(row, c, picked);
          };
        }
        row.appendChild(line);
        const rs = tagsAt(c);
        if (rs.length) {
          const tags = el('div', 'mt-tags');
          rs.forEach(r => tags.appendChild(tagChip(r)));
          row.appendChild(tags);
        }
        list.appendChild(row);
        if (!c.synthetic) rows.push({ c, row });
      });
    }
    function tagChip(r) {
      const e = S.entities.get(r.object_id), rt = S.rtByKey[r.predicate];
      const tag = el('div', 'mt-tag' + (r.on_watch ? ' on' : ''));
      const sw = el('input'); sw.type = 'checkbox'; sw.className = 'switch'; sw.checked = r.on_watch; sw.setAttribute('aria-label', 'Show ' + e.name + ' on the Watch page');
      sw.onchange = async () => { try { await setWatch([r.id], sw.checked); tag.classList.toggle('on', sw.checked); draw(); } catch (err) { sw.checked = !sw.checked; fail(err); } };
      const open = el('button', 'linkbtn', 'Open'); open.type = 'button'; open.onclick = ev => { ev.preventDefault(); openEntity(e.id); };
      tag.append(sw, el('i', `dot t-${e.type}`), el('span', 'mt-name', `${esc(e.name)} <span class="mt-meta">${esc(S.typeByKey[e.type].label)} · ${esc(rt.label)} at ${fmtTime(r.start_sec)}${r.note ? ' · ' + esc(r.note) : ''}</span>`), open);
      return tag;
    }

    // ----- the tag form under a line: a new item, an existing item, or a picture to show on screen -----
    function openTagForm(row, c, picked) {
      list.querySelectorAll('.mt-tagform').forEach(n => n.remove());
      const tape = tapeById(tapeSel.value);
      const f = el('form', 'mt-tagform relform');
      const st = { mode: 'new', other: null, shows: null };
      const close = () => { f.remove(); tagOpen = null; };
      const lineTags = byLineNow.has(c) ? byLineNow.get(c) : [];
      const notTape = S.types.filter(t => t.key !== 'tape').map(t => t.key);

      // which moment predicates a tape can have with an item of this type
      const predChoices = type => MOMENT_PREDICATES.map(k => S.rtByKey[k]).filter(rt => allowed(rt.subject_types, 'tape') && (type === null || allowed(rt.object_types, type)));
      const seg = el('div', 'mt-seg');
      const tabs = { new: 'New item', old: 'Already in the database', pic: 'Picture on screen' };
      const tabBtn = {};
      Object.entries(tabs).forEach(([k, l]) => { const b = el('button', null, esc(l)); b.type = 'button'; b.onclick = () => setMode(k); tabBtn[k] = b; seg.appendChild(b); });
      f.appendChild(seg);
      // items whose name or other names contain the words; the line's own tags come first
      const similar = (words, types) => {
        const t = words.trim().toLowerCase();
        const own = lineTags.map(r => r.object_id).filter(id => allowed(types, S.entities.get(id).type));
        const found = t.length < 3 ? [] : [...S.entities.values()].filter(x => allowed(types, x.type) && !own.includes(x.id) && (x.name.toLowerCase().includes(t) || x.other_names.some(n => n.toLowerCase().includes(t)))).map(x => x.id);
        return [...own, ...found].slice(0, 8);
      };
      const suggestButtons = (box, ids, title, onPick) => {
        box.innerHTML = '';
        if (!ids.length) return;
        box.appendChild(el('div', 'help', esc(title)));
        ids.forEach(id => { const x = S.entities.get(id); const b = el('button', 'ghost', `${esc(x.name)} <span class="t">${esc(S.typeByKey[x.type].label)}</span>`); b.type = 'button'; b.onclick = () => onPick(id); box.appendChild(b); });
      };
      // name + web name that follows it, and the required details of a type
      const nameFields = (box, prefill, help) => {
        const nameF = fieldInput({ key: 'name', label: 'Name', input: 'text', required: true, help }, prefill === '' ? null : prefill, []);
        const slugF = fieldInput({ key: 'slug', label: 'Web name', input: 'text', required: true, help: 'Follows the name until you change it' }, prefill === '' ? null : slugify(prefill), []);
        box.append(nameF, slugF);
        const nameIn = nameF.querySelector('input'), slugIn = slugF.querySelector('input');
        let touched = false; slugIn.oninput = () => touched = true;
        nameIn.addEventListener('input', () => { if (!touched) slugIn.value = slugify(nameIn.value); });
        return nameIn;
      };
      const requiredAttrs = (box, type) => {
        const kindIn = box.querySelector('[data-key="kind"]'), kind = kindIn ? readInput(kindIn) : null;
        box.innerHTML = '';
        if (type === null) return;
        // only the required details here; the rest can be filled in on the item's own page
        (S.fields[type] ? S.fields[type] : []).filter(fd => fd.required && (fd.when_kind === null || fd.when_kind === kind))
          .forEach(fd => box.appendChild(fieldInput(fd, fd.key === 'kind' ? kind : null, fd.input === 'select' ? optionChoices(type, fd.key) : [])));
        const k = box.querySelector('[data-key="kind"]'); if (k) k.onchange = () => requiredAttrs(box, type);
      };

      // tab 1: a new item
      const newBox = el('div', 'grid');
      const typeF = fieldInput({ key: 'type', label: 'Type', input: 'select', required: true }, null, S.types.filter(t => t.key !== 'tape').map(t => ({ value: t.key, label: t.label })));
      const typeIn = typeF.querySelector('select');
      newBox.appendChild(typeF);
      const nameIn = nameFields(newBox, picked, null);
      newBox.appendChild(fieldInput({ key: 'summary', label: 'Short description', input: 'textarea', wide: true }, null, []));
      const attrBox = el('div', 'grid wide'); newBox.appendChild(attrBox);
      const newSugg = el('div', 'wide mt-sugg'); newBox.appendChild(newSugg);
      typeIn.onchange = () => { requiredAttrs(attrBox, typeIn.value === '' ? null : typeIn.value); syncPred(); };
      const suggestNew = () => suggestButtons(newSugg, similar(nameIn.value, notTape).filter(id => !lineTags.some(r => r.object_id === id)), 'Already in the database? Click to use it instead:', id => { setMode('old'); pickOld(id); });
      nameIn.addEventListener('input', suggestNew);

      // tab 2: an existing item
      const oldBox = el('div', 'grid');
      const pickOld = id => { st.other = id; picker.show(id); syncPred(); };
      const picker = entityPicker('Item', notTape, null, id => { st.other = id; syncPred(); });
      oldBox.appendChild(picker.node);
      const oldSugg = el('div', 'wide mt-sugg'); oldBox.appendChild(oldSugg);

      // tab 3: a picture: upload it, make the photo item, show it on screen, and say what it shows
      const picBox = el('div', 'grid');
      const fileW = el('div'); const fileL = el('label', null, 'Picture file <span class="req">*</span>');
      const fileIn = el('input'); fileIn.type = 'file'; fileIn.accept = 'image/*'; fileIn.required = true; fileIn.dataset.key = 'file';
      fileL.appendChild(fileIn); fileW.appendChild(fileL);
      const thumb = el('img', 'mt-thumb'); thumb.hidden = true; fileW.appendChild(thumb);
      fileIn.onchange = () => { const fl = fileIn.files[0]; if (thumb.src) URL.revokeObjectURL(thumb.src); thumb.hidden = !fl; if (fl) thumb.src = URL.createObjectURL(fl); };
      picBox.appendChild(fileW);
      const picName = nameFields(picBox, picked === '' ? '' : picked, 'What the picture is, e.g. "Russian synagogue, Amsterdam, about 1930"');
      picBox.append(
        fieldInput({ key: 'credit', label: 'Credit', input: 'text', wide: true, help: 'Who made it and its licence, e.g. "Jim van der Mee, CC BY-SA 2.0, via Wikimedia Commons"' }, null, []),
        fieldInput({ key: 'alt_text', label: 'Description for screen readers', input: 'text', wide: true, help: 'What the picture shows, in one sentence' }, null, []));
      const picAttrs = el('div', 'grid wide'); picBox.appendChild(picAttrs);
      const showsW = el('div', 'wide');
      const showsPicker = entityPicker('It shows (a place gets a small map next to the picture)', notTape.filter(k => k !== PICTURE_TYPE), null, id => st.shows = id);
      showsPicker.node.querySelector('.req').remove();
      const noShows = el('button', 'linkbtn', 'Nothing'); noShows.type = 'button'; noShows.onclick = () => { st.shows = null; showsPicker.clear(); };
      showsPicker.node.appendChild(noShows);
      const showsSugg = el('div', 'mt-sugg');
      showsW.append(showsPicker.node, showsSugg); picBox.appendChild(showsW);
      const suggestShows = () => suggestButtons(showsSugg, similar(picName.value.split(',')[0], notTape.filter(k => k !== PICTURE_TYPE)), 'Suggestions:', id => { st.shows = id; showsPicker.show(id); });
      picName.addEventListener('input', suggestShows);

      // the moment itself
      const momBox = el('div', 'grid');
      const predF = fieldInput({ key: 'predicate', label: 'Connection', input: 'select', required: true }, null, []);
      const predIn = predF.querySelector('select');
      const t0 = fieldInput({ key: 'start', label: 'From', input: 'text', required: true, help: 'minutes:seconds' }, fmtTime(c.start_sec), []);
      const t1 = fieldInput({ key: 'end', label: 'Until', input: 'text', help: 'preset to the end of this line' }, fmtTime(c.end_sec), []);
      const certF = fieldInput({ key: 'certainty', label: 'Certainty', input: 'enum', required: true, help: 'For the moment, and for the item if it is new' }, null, enumChoices('certainty'));
      const statF = fieldInput({ key: 'status', label: 'On the site', input: 'enum', required: true, help: `Preset to the tape's (${human(tape.status).toLowerCase()})` }, tape.status, enumChoices('status'));
      const noteF = fieldInput({ key: 'note', label: 'Note', input: 'text', wide: true }, null, []);
      const watchF = el('label', 'selall wide', '<input type="checkbox" checked> Show as a card on the Watch page');
      momBox.append(predF, t0, t1, certF, statF, noteF, watchF);
      const t1In = t1.querySelector('input');
      const typeNow = () => st.mode === 'new' ? (typeIn.value === '' ? null : typeIn.value) : st.mode === 'pic' ? PICTURE_TYPE : st.other === null ? null : S.entities.get(st.other).type;
      const syncPred = () => {
        const cur = predIn.value, ok = predChoices(typeNow()), want = st.mode === 'pic' ? PICTURE_PREDICATE : TAG_PREDICATE;
        predIn.innerHTML = '';
        ok.forEach(rt => { const o = el('option', null, esc(rt.label)); o.value = rt.key; predIn.appendChild(o); });
        predIn.value = st.mode === 'pic' && ok.some(rt => rt.key === want) ? want : ok.some(rt => rt.key === cur) ? cur : ok.some(rt => rt.key === want) ? want : ok.length ? ok[0].key : '';
      };
      const boxes = { new: newBox, old: oldBox, pic: picBox };
      const setMode = m => {
        st.mode = m;
        Object.entries(boxes).forEach(([k, b]) => { b.hidden = k !== m; b.querySelectorAll('input, select, textarea').forEach(i => i.disabled = k !== m); tabBtn[k].classList.toggle('on', k === m); });
        // a picture stays up at least PICTURE_MIN_SEC unless the time was changed by hand
        if (m === 'pic' && t1In.value === fmtTime(c.end_sec) && +c.end_sec - +c.start_sec < PICTURE_MIN_SEC) t1In.value = fmtTime(+c.start_sec + PICTURE_MIN_SEC);
        if (m !== 'pic' && t1In.value === fmtTime(+c.start_sec + PICTURE_MIN_SEC)) t1In.value = fmtTime(c.end_sec);
        ok.textContent = m === 'pic' ? 'Upload and show' : 'Tag it';
        syncPred();
      };

      f.append(newBox, oldBox, picBox, el('h4', 'mt-sub', 'The moment'), momBox);
      const ra = el('div', 'row-actions');
      const ok = el('button', 'primary', 'Tag it'); ok.type = 'submit';
      const cancel = el('button', 'ghost', 'Cancel'); cancel.type = 'button'; cancel.onclick = close;
      ra.append(ok, cancel); f.appendChild(ra);
      f.onsubmit = async ev => {
        ev.preventDefault();
        const box = boxes[st.mode];
        const val = (k, inBox) => readInput((inBox ? box : momBox).querySelector(`[data-key="${k}"]`));
        const label = ok.textContent, done = [];
        try {
          if (!predIn.value) throw new Error('This kind of item cannot be tagged as a moment in a tape');
          const s0 = t0.querySelector('input').value.trim(), s1 = t1In.value.trim();
          // unchanged fields keep the line's exact times (the boxes show them rounded to the second)
          const start = s0 === fmtTime(c.start_sec) ? +c.start_sec : parseTime(s0);
          const end = s1 === '' ? null : s1 === fmtTime(c.end_sec) ? +c.end_sec : parseTime(s1);
          const certainty = val('certainty'), status = val('status');
          let objectId;
          ok.disabled = true;
          if (st.mode === 'old') {
            if (st.other === null) throw new Error('Choose the item');
            objectId = st.other;
          } else if (st.mode === 'new') {
            const saved = await q(sb.from('entities').insert({ type: typeIn.value, name: val('name', 1), slug: val('slug', 1), summary: val('summary', 1), other_names: [], attrs: readAttrs(attrBox), certainty, status }).select().single());
            S.entities.set(saved.id, saved); objectId = saved.id; done.push(`made "${saved.name}"`);
          } else {
            const file = fileIn.files[0];
            if (!file) throw new Error('Choose the picture file');
            if (!isImage(file.type)) throw new Error(`"${file.name}" is not a picture`);
            const slug = val('slug', 1);
            ok.textContent = 'Uploading…';
            const path = await freePath('scans', pageFileName({ slug }, 1, PICTURE_PAGE_LABEL, file));
            const size = await imageSize(file);
            await uploadTo(path, file, false); done.push('uploaded the file');
            const photo = await q(sb.from('entities').insert({ type: PICTURE_TYPE, name: val('name', 1), slug, summary: null, other_names: [], attrs: readAttrs(picAttrs), certainty, status }).select().single());
            S.entities.set(photo.id, photo); objectId = photo.id; done.push(`made "${photo.name}"`);
            const m = await q(sb.from('media').insert({ storage_path: path, mime_type: file.type, original_filename: file.name, credit: val('credit', 1), alt_text: val('alt_text', 1), ...size }).select().single());
            await q(sb.from('entity_pages').insert({ entity_id: photo.id, position: 1, label: PICTURE_PAGE_LABEL, image_id: m.id, transcription_certainty: certainty }).select('id'));
            done.push('added the picture to it');
            if (st.shows !== null) {
              await q(sb.from('relations').insert({ subject_id: photo.id, predicate: DEPICTS, object_id: st.shows, certainty, status, origin: TAG_ORIGIN }).select('id'));
              done.push(`linked it to ${S.entities.get(st.shows).name}`);
            }
          }
          const rel = { subject_id: tape.id, predicate: predIn.value, object_id: objectId, start_sec: start, end_sec: end, certainty, status,
                        note: val('note'), on_watch: watchF.querySelector('input').checked, origin: TAG_ORIGIN };
          const r = await q(sb.from('relations').insert(rel).select('id,predicate,object_id,start_sec,note,on_watch').single());
          rels.push(r); rels.sort((a, b) => a.start_sec - b.start_sec);
          renderList(); draw();
          toast(`${st.mode === 'pic' ? 'Picture shows' : 'Tagged ' + S.entities.get(objectId).name} at ${fmtTime(start)}`);
        } catch (err) {
          ok.disabled = false; ok.textContent = label;
          // say what was already saved, so nothing half-made goes unnoticed
          fail(done.length ? new Error(`${err.message} (Already done: ${done.join(', ')}.)`) : err);
        }
      };
      row.appendChild(f);
      setMode('new'); suggestNew(); suggestShows();
      suggestButtons(oldSugg, similar(picked, notTape), 'Tagged on this line or similar:', pickOld);
      tagOpen = { cue: c, api: { setName: s => { [nameIn, picName].forEach(n => { n.value = s; n.dispatchEvent(new Event('input')); }); } } };
      (picked === '' ? nameIn : typeIn).focus();
    }

    // follow the video: highlight the line being said, scroll to it
    const tick = setInterval(() => {
      if (!root.isConnected) { clearInterval(tick); if (P.yt) P.yt.destroy(); return; }
      if (!P.ready) return;
      const t = P.yt.getCurrentTime();
      now.textContent = fmtTime(t);
      let cur = null; for (const x of rows) { if (+x.c.start_sec <= t) cur = x; else break; }
      rows.forEach(x => x.row.classList.toggle('mt-playing', x === cur && t < +x.c.end_sec + 2));
      const playing = P.yt.getPlayerState() === 1;
      if (cur && playing && follow.querySelector('input').checked && !tagOpen) {
        const top = cur.row.getBoundingClientRect().top - ed.getBoundingClientRect().top + ed.scrollTop, h = ed.clientHeight;
        if (top < ed.scrollTop + pl.offsetHeight || top > ed.scrollTop + h - 80) ed.scrollTo({ top: top - pl.offsetHeight - 40, behavior: 'smooth' });
      }
    }, PLAYER_TICK_MS);

    tapeSel.onchange = () => { showPlayerFor(tapeById(tapeSel.value)); load().catch(fail); };
    modeSel.onchange = draw; typeSel.onchange = draw; find.oninput = draw; onlyOn.querySelector('input').onchange = draw;
    showPlayerFor(tapeById(tapeSel.value));
    await load();
  }

  // ---------- scan files tool: upload many files, matched by file name ----------
  async function openFilesTool() {
    S.current = null; history.replaceState(null, '', '#'); renderList();
    const ed = $('#editor'); ed.innerHTML = '';
    if (pinMap) { pinMap.remove(); pinMap = null; }
    if (routeMap) { routeMap.remove(); routeMap = null; }
    ed.appendChild(el('div', 'ed-head', '<div><div class="k">Tool</div><h1>Scan files</h1></div>'));
    const body = el('div'); ed.appendChild(body);
    const render = async () => {
      const media = await q(sb.from('media').select('*').order('original_filename'));
      const buckets = [...new Set(media.map(m => splitPath(m.storage_path).bucket))];
      const present = {}; for (const b of buckets) present[b] = await storedFiles(b);
      const missing = media.filter(m => !present[splitPath(m.storage_path).bucket].has(splitPath(m.storage_path).key));
      body.innerHTML = `<p class="help">${media.length} files are listed in the database; ${media.length - missing.length} are uploaded and <b>${missing.length}</b> are still missing.
        Choose files from your <b>Historic documents</b> folder (you can select them all). Each one is matched to a missing file by its exact file name (the stored name, or the name it was received with); others are skipped.</p>`;
      const fi = el('input'); fi.type = 'file'; fi.multiple = true; fi.accept = 'image/*,application/pdf';
      const go = el('button', 'primary', 'Upload matching files'); go.type = 'button';
      const out = el('ul', 'hist');
      const row = el('div', 'route-tools'); row.append(fi, go); body.append(row, out);
      go.onclick = async () => {
        try {
          const files = [...fi.files]; if (!files.length) throw new Error('Choose some files first');
          go.disabled = true; out.innerHTML = '';
          // a file matches by its stored name (naming convention) or by the name it was received with
          const byName = new Map();
          missing.forEach(m => { byName.set(splitPath(m.storage_path).key, m); if (m.original_filename !== null) byName.set(m.original_filename, m); });
          let done = 0, skipped = 0;
          for (const f of files) {
            const m = byName.get(f.name);
            const li = el('li', null, `<div><div class="when">${esc(f.name)}</div><div class="what">${m ? 'uploading…' : 'skipped: not a missing file'}</div></div>`); out.appendChild(li);
            if (!m) { skipped++; continue; }
            try { await uploadTo(m.storage_path, f, false); li.querySelector('.what').textContent = 'uploaded'; done++; }
            catch (err) { li.querySelector('.what').textContent = 'failed: ' + err.message; }
          }
          toast(`${done} uploaded, ${skipped} skipped`); go.disabled = false;
          setTimeout(() => render().catch(fail), 1500);
        } catch (err) { go.disabled = false; fail(err); }
      };
      if (missing.length) {
        const ul = el('ul', 'hist'); body.appendChild(el('div', 'rels-sub', 'Still missing'));
        missing.forEach(m => ul.appendChild(el('li', null, `<div><div class="when">${esc(splitPath(m.storage_path).key)}</div>${m.original_filename === null || m.original_filename === splitPath(m.storage_path).key ? '' : `<div class="what">received as ${esc(m.original_filename)}</div>`}</div>`)));
        body.appendChild(ul);
      }
    };
    render().catch(fail);
  }

  // ---------- history ----------
  const EDITABLE = ['name', 'slug', 'other_names', 'summary', 'body', 'date_text', 'date_from', 'date_to', 'lat', 'lng', 'coord_precision', 'attrs', 'certainty', 'status'];
  function historySection(e) {
    const s = el('div', 'sec'); s.appendChild(el('h3', null, 'History'));
    const ul = el('ul', 'hist'); s.appendChild(ul);
    (async () => {
      const revs = await q(sb.from('revisions').select('*').eq('table_name', 'entities').eq('row_id', e.id).order('at', { ascending: false }).limit(15));
      revs.forEach(v => {
        const changed = v.op === 'UPDATE' ? EDITABLE.filter(k => JSON.stringify(v.old_row[k]) !== JSON.stringify(v.new_row[k])) : [];
        const what = v.op === 'INSERT' ? 'Created' : v.op === 'UPDATE' ? 'Changed: ' + (changed.length ? changed.join(', ') : 'nothing visible') : 'Deleted';
        const li = el('li', null, `<div><div class="when">${esc(new Date(v.at).toLocaleString())}${v.by_user === null ? ' · setup' : ''}</div><div class="what">${esc(what)}</div></div>`);
        if (v.op === 'UPDATE' && changed.length) {
          const b = el('button', 'linkbtn', 'Undo this change'); b.type = 'button';
          b.onclick = async () => {
            if (!confirm(`Put back the earlier ${changed.join(', ')}?`)) return;
            try {
              const back = Object.fromEntries(changed.map(k => [k, v.old_row[k]]));
              const saved = await q(sb.from('entities').update(back).eq('id', e.id).select().single());
              S.entities.set(saved.id, saved); toast('Change undone'); openEntity(saved.id);
            } catch (err) { fail(err); }
          };
          li.appendChild(b);
        }
        ul.appendChild(li);
      });
      if (!revs.length) ul.appendChild(el('li', 'help', 'No history yet.'));
    })().catch(fail);
    return s;
  }

  boot().catch(fail);
})();
