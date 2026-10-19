/* Compagno - componenti d'interfaccia: formati, fogli, toast, barre, grafici, router */
(function () {
  'use strict';

  /* ---------- formati ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fmt(n, d) {
    if (n === null || n === undefined || n === '' || !isFinite(+n)) return '–';
    d = d || 0;
    n = +n;
    const neg = n < 0;
    let s = Math.abs(n).toFixed(d);
    let parts = s.split('.');
    let ip = parts[0];
    if (ip.length > 3) ip = ip.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    s = parts[1] ? ip + ',' + parts[1] : ip;
    if (neg && +Math.abs(n).toFixed(d) !== 0) s = '−' + s;
    return s;
  }
  /* numero con decimali solo se servono */
  function fmtA(n, maxD) {
    if (n === null || n === undefined || !isFinite(+n)) return '–';
    maxD = maxD == null ? 1 : maxD;
    const r = Math.round(+n * Math.pow(10, maxD)) / Math.pow(10, maxD);
    return fmt(r, Number.isInteger(r) ? 0 : maxD);
  }
  function parseNum(s) {
    if (typeof s === 'number') return s;
    s = String(s == null ? '' : s).trim().replace(/\s/g, '').replace(',', '.');
    if (s === '') return NaN;
    return parseFloat(s);
  }
  const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  function dateLabel(k) {
    const t = Store.today();
    if (k === t) return 'Oggi';
    if (k === Store.addDays(t, -1)) return 'Ieri';
    if (k === Store.addDays(t, 1)) return 'Domani';
    const d = Store.parseKey(k);
    return GIORNI[d.getDay()] + ' ' + d.getDate() + ' ' + MESI[d.getMonth()];
  }
  function dateShort(k) { const d = Store.parseKey(k); return d.getDate() + ' ' + MESI[d.getMonth()]; }
  function dateLong(k) { const d = Store.parseKey(k); return GIORNI[d.getDay()] + ' ' + d.getDate() + ' ' + MESI[d.getMonth()] + ' ' + d.getFullYear(); }
  function timeStr(ms) { const d = new Date(ms); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function durStr(ms) {
    const m = Math.round(ms / 60000);
    if (m < 60) return m + ' min';
    return Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') + ' min';
  }

  /* ---------- icone ---------- */
  const IC = {
    oggi: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.5"/>',
    cibo: '<path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 21V3c-2.2 1.6-3.2 4.2-3.2 7.5V14H17"/>',
    palestra: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
    grafici: '<path d="M4 20V11M10 20V5M16 20v-6M22 20H2"/>',
    altro: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    right: '<path d="M9 5l7 7-7 7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    chat: '<path d="M20 12a8 8 0 0 1-11.7 7.1L4 20l1-4A8 8 0 1 1 20 12z"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0"/>',
    chev: '<path d="M6 9l6 6 6-6"/>',
    trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
    edit: '<path d="M4 20l1-4L16 5l3 3L8 19z"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    up: '<path d="M6 15l6-6 6 6"/>',
    down: '<path d="M6 9l6 6 6-6"/>'
  };
  function icon(n, sz) {
    sz = sz || 22;
    return '<svg class="ic" width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[n] || '') + '</svg>';
  }

  /* ---------- azioni (delegazione eventi) ---------- */
  const acts = {}, chs = {}, ins = {};
  function init() {
    document.addEventListener('click', ev => {
      const el = ev.target.closest('[data-act]');
      if (!el || el.disabled) return;
      const fn = acts[el.dataset.act];
      if (fn) {
        try { fn(el, ev); } catch (e) { console.error(e); toast('Errore: ' + e.message); }
      }
    });
    document.addEventListener('change', ev => {
      const el = ev.target.closest('[data-ch]');
      if (!el) return;
      const fn = chs[el.dataset.ch];
      if (fn) { try { fn(el, ev); } catch (e) { console.error(e); toast('Errore: ' + e.message); } }
    });
    document.addEventListener('input', ev => {
      const el = ev.target.closest('[data-in]');
      if (!el) return;
      const fn = ins[el.dataset.in];
      if (fn) { try { fn(el, ev); } catch (e) { console.error(e); } }
    });
    document.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' && ev.target.matches('input[data-enter]')) {
        ev.preventDefault();
        const fn = acts[ev.target.dataset.enter];
        if (fn) fn(ev.target, ev);
      }
    });
    initCharts();
  }

  /* ---------- fogli (bottom sheet) ---------- */
  const sheets = [];
  function sheet(o) {
    o = o || {};
    const back = document.createElement('div');
    back.className = 'sheet-back';
    const sh = document.createElement('div');
    sh.className = 'sheet' + (o.cls ? ' ' + o.cls : '');
    sh.setAttribute('role', 'dialog');
    sh.innerHTML = '<div class="sheet-grab"></div><div class="sheet-h"><div class="sheet-t"></div><button class="icon-btn" data-sheet-close aria-label="Chiudi">' + icon('close', 20) + '</button></div><div class="sheet-b"></div>';
    sh.querySelector('.sheet-t').textContent = o.title || '';
    const body = sh.querySelector('.sheet-b');
    body.innerHTML = o.html || '';
    document.body.appendChild(back);
    document.body.appendChild(sh);
    document.body.classList.add('noscroll');
    const obj = {
      el: sh, body, closed: false,
      set(html) { body.innerHTML = html; },
      title(t) { sh.querySelector('.sheet-t').textContent = t; },
      close(val) {
        if (obj.closed) return;
        obj.closed = true;
        const i = sheets.indexOf(obj);
        if (i >= 0) sheets.splice(i, 1);
        sh.classList.remove('open'); back.classList.remove('open');
        if (!sheets.length) document.body.classList.remove('noscroll');
        setTimeout(() => { sh.remove(); back.remove(); }, 340);
        if (o.onClose) { try { o.onClose(val); } catch (e) { console.error(e); } }
      }
    };
    back.addEventListener('click', () => obj.close());
    sh.querySelector('[data-sheet-close]').addEventListener('click', () => obj.close());
    /* trascinamento verso il basso dall'intestazione */
    let y0 = null, dy = 0;
    const head = sh.querySelector('.sheet-grab'), head2 = sh.querySelector('.sheet-h');
    [head, head2].forEach(h => {
      h.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; dy = 0; sh.style.transition = 'none'; }, { passive: true });
      h.addEventListener('touchmove', e => { if (y0 === null) return; dy = Math.max(0, e.touches[0].clientY - y0); sh.style.transform = 'translateY(' + dy + 'px)'; }, { passive: true });
      h.addEventListener('touchend', () => {
        if (y0 === null) return;
        sh.style.transition = ''; sh.style.transform = '';
        if (dy > 90) obj.close();
        y0 = null;
      });
    });
    sheets.push(obj);
    requestAnimationFrame(() => requestAnimationFrame(() => { sh.classList.add('open'); back.classList.add('open'); }));
    if (o.onOpen) { try { o.onOpen(obj); } catch (e) { console.error(e); } }
    return obj;
  }
  function topSheet() { return sheets[sheets.length - 1] || null; }
  function closeSheets() { sheets.slice().forEach(s => s.close()); }

  function confirmBox(o) {
    return new Promise(res => {
      let done = false;
      const s = sheet({
        title: o.title || 'Conferma', cls: 'small',
        html: '<p class="txt">' + (o.html || esc(o.msg || '')) + '</p><div class="row gap"><button class="btn ghost grow" data-cf="0">' + esc(o.cancel || 'Annulla') + '</button><button class="btn ' + (o.danger ? 'danger' : 'primary') + ' grow" data-cf="1">' + esc(o.ok || 'Conferma') + '</button></div>',
        onClose() { if (!done) { done = true; res(false); } }
      });
      s.body.addEventListener('click', e => {
        const b = e.target.closest('[data-cf]');
        if (!b) return;
        done = true; res(b.dataset.cf === '1'); s.close();
      });
    });
  }

  /* chiede un testo con un foglio dentro l'app (prompt() non funziona bene nelle app installate su iPhone) */
  function promptBox(o) {
    o = o || {};
    return new Promise(res => {
      let done = false;
      const s = sheet({
        title: o.title || 'Scrivi', cls: 'small',
        html: '<div class="field"><input class="inp" id="pb-inp" type="text" autocomplete="off"' + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + ' value="' + esc(o.value || '') + '"></div>' +
          '<div class="row gap mt8"><button class="btn ghost grow" data-pb="0">' + esc(o.cancel || 'Annulla') + '</button><button class="btn primary grow" data-pb="1">' + esc(o.ok || 'OK') + '</button></div>',
        onClose() { if (!done) { done = true; res(null); } },
        onOpen(sh) { setTimeout(() => { const i = sh.body.querySelector('#pb-inp'); if (i) i.focus(); }, 350); }
      });
      const finish = ok => { if (done) return; const i = s.body.querySelector('#pb-inp'); done = true; res(ok ? (i.value || '').trim() : null); s.close(); };
      s.body.addEventListener('click', e => { const b = e.target.closest('[data-pb]'); if (b) finish(b.dataset.pb === '1'); });
      s.body.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); finish(true); } });
    });
  }

  /* ---------- toast ---------- */
  let toastTimer = null;
  function toast(msg, ms) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms || 2200);
  }

  /* ---------- componenti HTML ---------- */
  function card(title, body, o) {
    o = o || {};
    return '<section class="card' + (o.cls ? ' ' + o.cls : '') + '"' + (o.id ? ' id="' + o.id + '"' : '') + '>' +
      (title ? '<header class="card-h"><h3>' + title + '</h3>' + (o.right ? '<div class="card-r">' + o.right + '</div>' : '') + '</header>' : '') + body + '</section>';
  }
  /* barra valore / obiettivo */
  function bar(label, val, goal, color, o) {
    o = o || {};
    const u = o.unit || '', d = o.dec == null ? 0 : o.dec;
    const has = val !== null && val !== undefined && isFinite(val);
    let p = goal > 0 && has ? val / goal : 0;
    let cls = '';
    if (o.max) cls = has && val > goal ? ' over' : '';
    const w = Math.max(0, Math.min(1, p)) * 100;
    let right;
    if (!has) right = '<b>n.d.</b>';
    else right = '<b>' + fmt(val, d) + '</b><span class="mut"> / ' + fmt(goal, d) + (u ? ' ' + u : '') + '</span>';
    return '<div class="bar' + cls + (o.click ? ' tap' : '') + '"' + (o.click ? ' data-act="' + o.click + '" data-k="' + esc(o.k || '') + '"' : '') + '>' +
      '<div class="bar-top"><span class="bar-l">' + label + '</span><span class="bar-v">' + right + '</span></div>' +
      '<div class="bar-track"><div class="bar-fill" style="width:' + w.toFixed(1) + '%;background:' + (color || 'var(--acc)') + '"></div></div>' +
      (o.sub ? '<div class="bar-sub">' + o.sub + '</div>' : '') + '</div>';
  }
  /* barra impilata: parte da cibo + parte da integratori (valori nella stessa unità dell'obiettivo) */
  function barStack(label, fv, sv, goal, color, o) {
    o = o || {};
    const u = o.unit || '', d = o.dec == null ? 0 : o.dec;
    const tot = (fv || 0) + (sv || 0);
    const fw = goal > 0 ? Math.min(1, (fv || 0) / goal) * 100 : 0;
    const sw = goal > 0 ? Math.max(0, Math.min(1 - Math.min(1, (fv || 0) / goal), (sv || 0) / goal)) * 100 : 0;
    const share = tot > 0 ? Math.round((sv || 0) / tot * 100) : 0;
    return '<div class="bar"><div class="bar-top"><span class="bar-l">' + label + '</span><span class="bar-v"><b>' + fmt(o.pct != null ? o.pct : tot / goal * 100, 0) + '</b><span class="mut"> %</span></span></div>' +
      '<div class="bar-track"><div class="bar-fill stk" style="width:' + fw.toFixed(1) + '%;background:' + (color || 'var(--acc)') + '"></div><div class="bar-fill stk" style="width:' + sw.toFixed(1) + '%;background:var(--supp)"></div></div>' +
      '<div class="bar-sub">' + (o.sub ? o.sub + ' · ' : '') + (100 - share) + '% cibo · ' + share + '% integratore' + (o.warn ? ' · <span class="bad">' + o.warn + '</span>' : '') + '</div></div>';
  }
  function seg(items, active, act, extra) {
    return '<div class="seg"' + (extra || '') + '>' + items.map(it => '<button class="' + (String(it[0]) === String(active) ? 'on' : '') + '" data-act="' + act + '" data-v="' + esc(it[0]) + '">' + esc(it[1]) + '</button>').join('') + '</div>';
  }
  function field(label, input, hint) {
    return '<label class="field"><span class="field-l">' + label + '</span>' + input + (hint ? '<span class="hint">' + hint + '</span>' : '') + '</label>';
  }
  function inp(o) {
    return '<input class="inp" type="' + (o.type || 'text') + '"' + (o.dec ? ' inputmode="decimal"' : '') + (o.id ? ' id="' + o.id + '"' : '') +
      (o.value != null && o.value !== '' ? ' value="' + esc(o.value) + '"' : '') + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') +
      (o.ch ? ' data-ch="' + o.ch + '"' : '') + (o.in ? ' data-in="' + o.in + '"' : '') + (o.enter ? ' data-enter="' + o.enter + '"' : '') +
      (o.attrs ? ' ' + o.attrs : '') + ' autocomplete="off">';
  }
  function select(opts, val, attrs) {
    return '<select class="inp" ' + (attrs || '') + '>' + opts.map(o => '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(val) ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>';
  }
  function dateBar(date, ns) {
    return '<div class="datebar"><button class="icon-btn" data-act="' + ns + '.prev" aria-label="Giorno prima">' + icon('left', 22) + '</button>' +
      '<button class="datebar-t" data-act="' + ns + '.pick"><span>' + esc(dateLabel(date)) + '</span><small>' + esc(dateLong(date)) + '</small></button>' +
      '<button class="icon-btn" data-act="' + ns + '.next" aria-label="Giorno dopo">' + icon('right', 22) + '</button></div>';
  }
  function empty(msg) { return '<div class="empty">' + msg + '</div>'; }
  function badge(t, cls) { return '<span class="badge ' + (cls || '') + '">' + esc(t) + '</span>'; }

  /* testo semplice con **grassetto**, liste, link (per il Coach) */
  function md(src) {
    const lines = String(src || '').split(/\r?\n/);
    let html = '', inList = null;
    const inline = t => {
      let s = esc(t);
      s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
      s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>');
      return s;
    };
    const close = () => { if (inList) { html += '</' + inList + '>'; inList = null; } };
    for (const raw of lines) {
      const l = raw.trimEnd();
      let m;
      if ((m = l.match(/^\s*[-*•]\s+(.*)$/))) { if (inList !== 'ul') { close(); html += '<ul>'; inList = 'ul'; } html += '<li>' + inline(m[1]) + '</li>'; }
      else if ((m = l.match(/^\s*\d+[.)]\s+(.*)$/))) { if (inList !== 'ol') { close(); html += '<ol>'; inList = 'ol'; } html += '<li>' + inline(m[1]) + '</li>'; }
      else if ((m = l.match(/^#{1,4}\s+(.*)$/))) { close(); html += '<p><b>' + inline(m[1]) + '</b></p>'; }
      else if (l.trim() === '') { close(); }
      else { close(); html += '<p>' + inline(l) + '</p>'; }
    }
    close();
    return html;
  }

  /* ---------- grafici ---------- */
  const charts = [];
  function initCharts() {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.color = '#8A97A6';
    Chart.defaults.borderColor = '#243040';
    Chart.defaults.font.family = '-apple-system, "SF Pro Text", system-ui, sans-serif';
    Chart.defaults.font.size = 11;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.animation = { duration: 350 };
    Chart.defaults.plugins.legend.labels.boxWidth = 10;
    Chart.defaults.plugins.legend.labels.boxHeight = 10;
    Chart.defaults.plugins.tooltip.backgroundColor = '#0B0F14';
    Chart.defaults.plugins.tooltip.borderColor = '#243040';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 8;
  }
  function chart(canvas, cfg) {
    if (typeof Chart === 'undefined') return null;
    const c = new Chart(canvas, cfg);
    charts.push(c);
    return c;
  }
  function destroyCharts() { while (charts.length) { try { charts.pop().destroy(); } catch (e) { /* ignora */ } } }

  /* ---------- router ---------- */
  const views = {};
  const state = { cur: 'oggi' };
  function registerView(name, v) { views[name] = v; }
  function render() {
    const el = document.getElementById('view');
    if (!el) return;
    const v = views[state.cur];
    if (!v) return;
    destroyCharts();
    const y = window.scrollY;
    el.innerHTML = v.render() || '';
    if (v.after) { try { v.after(el); } catch (e) { console.error(e); } }
    window.scrollTo(0, y);
    document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === state.cur));
    const t = document.getElementById('hdr-title');
    if (t) t.textContent = v.title || '';
    document.body.classList.toggle('hv', state.cur === 'palestra');
  }
  function go(name, opts) {
    if (!views[name]) return;
    const changed = state.cur !== name;
    state.cur = name;
    if (views[name].enter) views[name].enter(opts || {});
    render();
    if (changed) window.scrollTo(0, 0);
    try { sessionStorage.setItem('compagno_tab', name); } catch (e) { /* ignora */ }
  }
  function refresh() { render(); }
  function scrollTop() { window.scrollTo(0, 0); }

  /* un breve tono con WebAudio */
  let actx = null;
  function beep(n) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      n = n || 3;
      for (let i = 0; i < n; i++) {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = 'sine'; o.frequency.value = 880;
        o.connect(g); g.connect(actx.destination);
        const t0 = actx.currentTime + i * 0.28;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.4, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
        o.start(t0); o.stop(t0 + 0.22);
      }
    } catch (e) { /* ignora */ }
  }
  function unlockAudio() {
    try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { /* ignora */ }
  }

  /* apre un file/blob (download o condivisione) */
  function saveBlob(blob, name, type) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener';
    document.body.appendChild(a); a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 4000);
    return url;
  }
  async function shareFile(file, title) {
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: title || file.name }); return true; }
    } catch (e) { if (e && e.name === 'AbortError') return true; }
    return false;
  }
  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).then(() => true, () => false);
    return Promise.resolve(false);
  }

  window.UI = {
    esc, fmt, fmtA, parseNum, dateLabel, dateShort, dateLong, timeStr, durStr, icon, acts, chs, ins, init,
    sheet, topSheet, closeSheets, confirm: confirmBox, prompt: promptBox, toast, card, bar, barStack, seg, field, inp, select, dateBar, empty, badge, md,
    chart, destroyCharts, registerView, go, refresh, render, state, scrollTop, beep, unlockAudio, saveBlob, shareFile, copyText,
    on(name, fn) { acts[name] = fn; }, onChange(name, fn) { chs[name] = fn; }, onInput(name, fn) { ins[name] = fn; }
  };
})();
