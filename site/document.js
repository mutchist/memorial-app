/* Document page: document.html?d=<slug>. One document from site_data():
   its scans with hover labels (page_fields), transcription and English
   translation, details (attr_fields), connections, and a print layout
   that saves as a PDF with the translation. */
(() => {
  'use strict';
  const { $, el, esc, fmt, nullsLast, fileUrl, showError, loadData, watchLink } = Site;

  const slug = new URLSearchParams(location.search).get('d');
  if (slug === null) return showError('No document chosen', 'This page needs a document address, e.g. document.html?d=<document>.');
  loadData().then(start, err => showError('The document could not be loaded', err.message));

  function start(D) {
    const { E, BY_SLUG, RT, ET, OPT, PAGES, kindLabel } = Site.index(D);
    const doc = BY_SLUG[slug];
    if (!doc) return showError('Document not found', `Nothing published has the address "${slug}".`);
    if (!ET[doc.type]) return showError('Unknown type', `"${doc.type}" is not in the type list.`);
    const pages = doc.id in PAGES ? PAGES[doc.id] : [];
    const tapes = Object.fromEntries(D.tapes.map(t => [t.id, t]));
    document.title = `${doc.name} · Jonas Stemmer`;
    const main = $('#doc');

    // ---------- head ----------
    const head = el('header', 'doc-head');
    head.innerHTML = `<div class="k">${esc(kindLabel(doc))}${doc.date_text ? ' · ' + esc(doc.date_text) : ''}</div>
      <h1>${esc(doc.name)}</h1>${doc.summary ? `<p class="lede">${esc(doc.summary)}</p>` : ''}`;
    const tools = el('div', 'doc-tools');
    if (pages.some(p => p.fields.length)) {
      const t = el('button', 'btn', 'Show all labels'); t.type = 'button'; t.setAttribute('aria-pressed', 'false');
      t.onclick = () => { const on = main.classList.toggle('show-boxes'); t.setAttribute('aria-pressed', String(on)); t.textContent = on ? 'Hide labels' : 'Show all labels'; };
      tools.appendChild(t);
    }
    const pr = el('button', 'btn', 'Save as PDF / print'); pr.type = 'button'; pr.onclick = () => window.print(); tools.appendChild(pr);
    if ('file' in doc) tools.appendChild(el('a', 'btn', `Original file${doc.file.mime === 'application/pdf' ? ' (PDF)' : ''} ↓`)).href = fileUrl(doc.file.path);
    head.appendChild(tools);
    main.appendChild(head);

    // ---------- details (from attr_fields) ----------
    const fields = D.attr_fields.filter(f => f.type === doc.type && f.key in doc.attrs && f.input !== 'geojson');
    const dl = el('dl', 'doc-details');
    fields.forEach(f => {
      const v = doc.attrs[f.key];
      let h;
      if (f.input === 'select') {
        const o = OPT[doc.type + '.' + f.key][v];
        if (!o) throw new Error(`"${v}" is not a listed value of ${f.label}`);
        h = esc(o.label);
      } else if (f.input === 'url') h = `<a href="${esc(v)}" target="_blank" rel="noopener">${esc(new URL(v).hostname.replace(/^www\./, ''))} ↗</a><span class="print-only"> ${esc(v)}</span>`;
      else h = esc(v);
      dl.innerHTML += `<div><dt>${esc(f.label)}</dt><dd>${h}</dd></div>`;
    });
    dl.innerHTML += `<div><dt>Reading</dt><dd>${esc(certaintyText(doc.certainty))}</dd></div>`;
    main.appendChild(dl);

    if ('body' in doc) {
      const b = el('section', 'doc-body');
      doc.body.split(/\n\s*\n/).forEach(par => b.appendChild(el('p', null, esc(par))));
      main.appendChild(b);
    }

    // ---------- pages ----------
    pages.forEach((p, pi) => main.appendChild(pageSection(p, pi)));

    // ---------- connections ----------
    const facts = [], moments = [];
    D.relations.forEach(r => {
      if (r.s !== doc.id && r.o !== doc.id) return;
      const forward = r.s === doc.id, other = E[forward ? r.o : r.s];
      if (other.type === 'tape') { if (r.t0 != null) moments.push({ tape: tapes[other.id], t: +r.t0, note: r.note }); return; }
      facts.push({ label: forward ? RT[r.p].label : RT[r.p].inverse, other, r });
    });
    D.relations.forEach(r => { if (r.src === doc.id) facts.push({ label: 'evidence for', other: E[r.s], r, about: E[r.o] }); });
    if (facts.length || moments.length) {
      const c = el('section', 'doc-rel'); c.appendChild(el('h2', null, 'Connections'));
      const ul = el('ul', 'facts');
      facts.sort((a, b) => nullsLast(a.r.order, b.r.order) || a.label.localeCompare(b.label)).forEach(f => {
        const meta = [f.r.role, f.r.date_text, f.r.note].filter(x => x != null).map(esc).join(' · ');
        ul.innerHTML += `<li><span class="lab">${esc(f.label)}</span> <a href="${esc(watchLink(f.other))}">${esc(f.other.name)}</a>
          ${f.about ? ` ${esc(RT[f.r.p].label)} <a href="${esc(watchLink(f.about))}">${esc(f.about.name)}</a>` : ''}
          ${f.r.certainty === 'to_verify' ? '<span class="tag-verify">to verify</span>' : f.r.certainty === 'probable' ? '<span class="tag-prob">probable</span>' : ''}
          ${meta ? `<div class="meta">${meta}</div>` : ''}</li>`;
      });
      moments.sort((a, b) => a.tape.number - b.tape.number || a.t - b.t).forEach(m => {
        ul.innerHTML += `<li><span class="lab">shown in the testimony</span> <a href="index.html#tape=${m.tape.number}&t=${m.t}">${D.tapes.length > 1 ? `Tape ${m.tape.number} · ` : ''}${fmt(m.t)}</a>${m.note ? `<div class="meta">${esc(m.note)}</div>` : ''}</li>`;
      });
      c.appendChild(ul); main.appendChild(c);
    }

    const foot = el('footer', 'doc-foot');
    foot.innerHTML = `<p>Transcriptions and translations are ours and may contain mistakes; the scan is the source.
      Please cite the original at the archive that holds it.</p>
      <p class="print-only">Printed from ${esc(location.href)}</p>`;
    main.appendChild(foot);

    // ---------- one page: scan + hover labels + text ----------
    function pageSection(p, pi) {
      const sec = el('section', 'dpage');
      sec.appendChild(el('h2', null, `${esc(p.label)}${pages.length > 1 ? ` <span class="of">${pi + 1} of ${pages.length}</span>` : ''}`));
      const grid = el('div', 'dpage-grid'); sec.appendChild(grid);

      const fig = el('figure', 'scanbox');
      if (!p.mime.startsWith('image/')) {
        fig.innerHTML = `<a class="pdf" href="${esc(fileUrl(p.path))}" target="_blank" rel="noopener">Open this page (PDF) ↗</a>`;
      } else {
        const img = el('img'); img.src = fileUrl(p.path); img.alt = `${doc.name}, ${p.label}`;
        if ('w' in p && 'h' in p) fig.style.aspectRatio = `${p.w} / ${p.h}`;
        img.onerror = () => fig.replaceChildren(el('div', 'scan-missing', 'The scan file is not uploaded yet.'));
        fig.appendChild(img);
      }
      const tip = el('div', 'tip'); tip.setAttribute('role', 'tooltip'); tip.id = `tip-${pi}`; tip.hidden = true;
      const list = el('ol', 'labels');
      const boxed = p.fields.filter(f => 'box' in f);
      const boxes = [];
      p.fields.forEach((f, i) => {
        const n = i + 1;
        const li = el('li', null, `<span class="n">${n}</span><div>${fieldHtml(f)}</div>`);
        list.appendChild(li);
        if (!('box' in f)) return;
        const [x, y, w, h] = f.box;
        const b = el('button', 'box' + ('refers_to' in f ? ' ref' : ''), `<span class="n">${n}</span>`); b.type = 'button';
        b.style.cssText = `left:${x * 100}%;top:${y * 100}%;width:${w * 100}%;height:${h * 100}%`;
        b.setAttribute('aria-label', 'label' in f ? f.label : f.label_original); b.setAttribute('aria-describedby', tip.id);
        const on = () => { show(f, b); li.classList.add('hl'); b.classList.add('hl'); };
        const off = () => { tip.hidden = true; li.classList.remove('hl'); b.classList.remove('hl'); };
        b.onmouseenter = on; b.onfocus = on; b.onmouseleave = off; b.onblur = off;
        b.onclick = on;
        li.onmouseenter = () => b.classList.add('hl'); li.onmouseleave = () => b.classList.remove('hl');
        li.onclick = () => { b.scrollIntoView({ block: 'center', behavior: 'smooth' }); b.focus({ preventScroll: true }); };
        fig.appendChild(b); boxes.push(b);
      });
      fig.appendChild(tip);
      function show(f, b) {
        tip.innerHTML = fieldHtml(f); tip.hidden = false;
        const fr = fig.getBoundingClientRect(), br = b.getBoundingClientRect();
        const below = br.bottom - fr.top + 8, w = Math.min(340, fr.width - 16);
        tip.style.width = w + 'px';
        tip.style.left = Math.max(8, Math.min(br.left - fr.left, fr.width - w - 8)) + 'px';
        const th = tip.offsetHeight;
        tip.style.top = (below + th > fr.height - 8 ? Math.max(8, br.top - fr.top - th - 8) : below) + 'px';
      }
      const scanCol = el('div'); scanCol.appendChild(fig);
      if (p.mime.startsWith('image/')) {
        const full = el('a', 'fullsize', 'Open the scan at full size ↗'); full.href = fileUrl(p.path); full.target = '_blank'; full.rel = 'noopener';
        scanCol.appendChild(full);
      }
      if ('credit' in p) scanCol.appendChild(el('div', 'credit', esc(p.credit)));
      grid.appendChild(scanCol);

      const side = el('div', 'dpage-side');
      if (p.fields.length) {
        side.appendChild(el('h3', null, boxed.length ? 'On this page <span class="hint">hover the scan or a line</span>' : 'On this page'));
        side.appendChild(list);
      }
      const hasTr = 'transcription' in p, hasEn = 'translation' in p;
      if (hasTr || hasEn) {
        const tabs = el('div', 'tabs'); tabs.setAttribute('role', 'tablist');
        const panes = [];
        const add = (key, label, text) => {
          const t = el('button', null, label); t.type = 'button'; t.setAttribute('role', 'tab');
          const pane = el('pre', 'tr ' + key, esc(text));
          t.onclick = () => { panes.forEach(([tt, pp]) => { tt.setAttribute('aria-selected', String(tt === t)); pp.classList.toggle('on', pp === pane); }); };
          tabs.appendChild(t); panes.push([t, pane]);
        };
        if (hasEn) add('en', 'English translation', p.translation);
        if (hasTr) add('orig', 'Transcription', p.transcription);
        side.appendChild(el('h3', null, `Text${p.certainty === 'confirmed' ? '' : ` <span class="tag-${p.certainty === 'to_verify' ? 'verify' : 'prob'}">${esc(certaintyText(p.certainty).toLowerCase())}</span>`}`));
        side.appendChild(tabs); panes.forEach(([, pane]) => side.appendChild(pane));
        panes[0][0].click();
      }
      grid.appendChild(side);
      return sec;
    }

    function fieldHtml(f) {
      let h = 'label' in f ? `<b>${esc(f.label)}</b>` : `<b>${esc(f.label_original)}</b> <span class="untr">not translated yet</span>`;
      if ('value' in f) h += `<div class="v">${esc(f.value)}</div>`;
      const orig = [f.label_original, f.value_original].filter(x => x !== undefined);
      if ('label' in f) h += `<div class="o">${esc(orig.join(': '))}</div>`;
      else if ('value_original' in f) h += `<div class="o">${esc(f.value_original)}</div>`;
      if ('refers_to' in f && f.refers_to in E) h += `<a class="go" href="${esc(watchLink(E[f.refers_to]))}">${esc(E[f.refers_to].name)} in the testimony →</a>`;
      return h;
    }
  }

  // same wording as the admin: to_verify -> To verify
  const certaintyText = c => c[0].toUpperCase() + c.slice(1).replace(/_/g, ' ');
})();
