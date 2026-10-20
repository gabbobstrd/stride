/* Compagno - scheda Palestra (stile Hevy): Allenamento. Il Profilo sta in v-profilo.js */
(function () {
  'use strict';
  const esc = UI.esc, fmt = UI.fmt, S = () => Store.s;
  const P = { tab: 'allena', exq: '', exMg: 'tutti' };
  let timer = null;       // {end, total}
  let flash = 0;
  let undo = null;        // {ei, snap, n, tm}: ultimo inserimento a voce, annullabile per 6 s

  const num = x => (x === '' || x == null ? '' : String(x).replace('.', ','));
  const kgS = w => fmt(+w, +w % 1 ? 1 : 0);
  const restOf = plan => (plan && plan.rest != null && plan.rest !== '' && isFinite(+plan.rest) ? +plan.rest : 90);
  const restStr = s => !(s > 0) ? 'Spento' : s < 60 ? s + ' s' : Math.floor(s / 60) + ' min' + (s % 60 ? ' ' + (s % 60) + ' s' : '');

  /* ---------- piccole icone e componenti ---------- */
  const IC2 = {
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 10.5v5M9.5 13h5"/>',
    clip: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    bars: '<rect x="4" y="13" width="4" height="7" rx="1"/><rect x="10" y="8" width="4" height="12" rx="1"/><rect x="16" y="3" width="4" height="17" rx="1"/>',
    chart: '<path d="M4 19V5M4 19h16M8 15l4-5 3 3 4-6"/>',
    ruler: '<rect x="3" y="8" width="18" height="8" rx="1.5"/><path d="M7 8v3M11 8v4M15 8v3M19 8v4"/>',
    cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    radar: '<path d="M12 3l8.5 6.2-3.2 10H6.7l-3.2-10z"/><path d="M12 8l4 2.9-1.5 4.6h-5L8 10.9z"/>',
    body: '<circle cx="12" cy="5" r="2.2"/><path d="M6 10h12M12 10v5M9 21l3-6 3 6M6 10l-1.5 6M18 10l1.5 6"/>',
    medal: '<circle cx="12" cy="14" r="5.5"/><path d="M8.5 3l3.5 6 3.5-6M12 11.5v5"/>',
    doc: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 17v-3M13 17v-5M16 17v-2"/>',
    dots: '<circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/>',
    timer: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4.5l2.5 1.5M9.5 3h5M12 3v2.5"/>',
    trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'
  };
  function ic(n, sz) {
    sz = sz || 22;
    return '<svg class="ic" width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC2[n] || '') + '</svg>';
  }
  function initials(name) {
    const w = String(name || '?').replace(/\(.*?\)/g, ' ').split(/\s+/).filter(x => x.length > 1 || /\d/.test(x));
    const s = (w[0] ? w[0][0] : '?') + (w[1] ? w[1][0] : (w[0] && w[0][1]) || '');
    return s.toUpperCase();
  }
  /* disegno dell'esercizio (js/ex-art.js, Workout Guide CC BY-SA 4.0): fotogramma 0 -> frame-1, 1 -> frame-3.
     Se manca, la foto di js/ex-media.js; altrimenti ''. */
  const artOf = eid => { try { return (typeof EX_ART !== 'undefined' && EX_ART && EX_ART[eid]) || ''; } catch (e) { return ''; } };
  function mediaUrl(eid, n) {
    const a = artOf(eid);
    if (a) return EX_ART_BASE + a + '/frame-' + (n ? 3 : 1) + '.svg';
    try { if (typeof EX_MEDIA !== 'undefined' && EX_MEDIA && EX_MEDIA[eid]) return (typeof EX_MEDIA_BASE !== 'undefined' ? EX_MEDIA_BASE : '') + EX_MEDIA[eid] + '/' + n + '.jpg'; } catch (e) { /* ignora */ }
    return '';
  }
  const circle = eid => {
    const u = mediaUrl(eid, 0), ini = esc(initials(Calc.exName(eid)));
    return u ? '<span class="hv-ci img' + (artOf(eid) ? ' art' : '') + '"><img src="' + esc(u) + '" alt="" loading="lazy" onerror="this.remove()"><b>' + ini + '</b></span>' : '<span class="hv-ci">' + ini + '</span>';
  };
  /* riquadro media: disegni (o foto) che alternano ogni 800 ms; se mancano, la figura del corpo */
  function bodyFor(eid, size, color) {
    const ex = Calc.exById(eid) || {};
    return window.BodyMap ? BodyMap.svg({ primary: ex.mg ? [ex.mg] : [], secondary: ex.sec || [], size: size || 70, color: color }) : '';
  }
  function mediaHtml(eid) {
    const a = mediaUrl(eid, 0), b = mediaUrl(eid, 1), art = !!artOf(eid);
    if (!a) return '<div class="ex-media fb" data-eid="' + esc(eid) + '">' + bodyFor(eid, 90) + '</div>';
    return '<div class="ex-media' + (art ? ' art' : '') + '" data-eid="' + esc(eid) + '"><img class="m0 on" src="' + esc(a) + '" alt="" loading="lazy" onerror="this.parentNode.className+=&quot; fail&quot;">' +
      '<img class="m1" src="' + esc(b) + '" alt="" loading="lazy" onerror="this.remove()">' +
      (art ? '<div class="ex-bm">' + bodyFor(eid, 36, '#FF453A') + '</div>' : '') + '<div class="ex-fb">' + bodyFor(eid, 90) + '</div></div>';
  }
  /* un solo timer globale: scorre solo i riquadri ancora nel DOM, quindi si ferma da solo quando escono */
  setInterval(() => {
    document.querySelectorAll('.ex-media:not(.fail)').forEach(m => {
      const i0 = m.querySelector('.m0'), i1 = m.querySelector('.m1');
      if (!i0 || !i1) return;
      const on1 = i1.classList.toggle('on'); i0.classList.toggle('on', !on1);
    });
  }, 800);
  P.mediaHtml = mediaHtml; P.bodyFor = bodyFor;
  /* piccolo menu «⋯»: items = [{t, a, danger}] */
  function menu(title, items) {
    const sh = UI.sheet({ title: title, cls: 'small', html: '<div class="hv-menu">' + items.map((it, i) => '<button class="hv-mi' + (it.danger ? ' dg' : '') + '" data-i="' + i + '">' + esc(it.t) + '</button>').join('') + '</div>' });
    sh.body.addEventListener('click', e => {
      const b = e.target.closest('[data-i]'); if (!b) return;
      const it = items[+b.dataset.i]; sh.close();
      setTimeout(() => { try { it.a(); } catch (x) { console.error(x); UI.toast('Errore: ' + x.message); } }, 60);
    });
    return sh;
  }
  /* grafico dentro un riquadro: ricrea il canvas e distrugge il grafico precedente */
  function drawChart(box, cfg) {
    if (!box) return;
    if (box._ch) { try { box._ch.destroy(); } catch (e) { /* ignora */ } box._ch = null; }
    box.innerHTML = '<canvas></canvas>';
    box._ch = UI.chart(box.firstChild, cfg);
  }
  function barCfg(labels, data, fmtFn) {
    return {
      type: 'bar',
      data: { labels, datasets: [{ data, backgroundColor: '#3B82F6', borderRadius: 4, maxBarThickness: 26 }] },
      options: {
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => (fmtFn ? fmtFn(c.parsed.y) : c.parsed.y) } } },
        scales: { x: { grid: { display: false }, ticks: { color: '#8E8E93', maxRotation: 0, autoSkip: true } }, y: { beginAtZero: true, grid: { color: '#2C2C2E' }, ticks: { color: '#8E8E93', maxTicksLimit: 5 }, border: { display: false } } }
      }
    };
  }

  /* ---------- programma attivo ---------- */
  function activeProg() { return S().programs.find(p => p.id === S().activeProgram) || null; }
  function nextDay() {
    const prog = activeProg();
    if (!prog || !prog.days.length) return null;
    const idx = (S().nextDayIdx || 0) % prog.days.length;
    return { prog, day: prog.days[idx], idx };
  }
  function mkSets(eid, plan, n) {
    const pg = Calc.progression(eid, plan);
    const lp = Calc.lastPerformance(eid);
    return Array.from({ length: n }, (_, i) => {
      const ls = lp ? lp.sets[Math.min(i, lp.sets.length - 1)] : null;
      return { w: pg ? pg.w : (ls ? ls.w : ''), r: '', rpe: '', done: false };
    });
  }
  function mkEx(eid, plan) {
    plan = plan || { sets: 3, rmin: 8, rmax: 12, rest: 90 };
    return { e: eid, plan: { sets: plan.sets, rmin: plan.rmin, rmax: plan.rmax, rest: plan.rest }, sets: mkSets(eid, plan, plan.sets || 3) };
  }
  function start(progId, dayIdx) {
    if (S().activeSession) return UI.toast('C\'è già una sessione in corso');
    const prog = S().programs.find(p => p.id === progId);
    let sess = { id: Store.uid('s'), date: Store.today(), start: Date.now(), end: null, prog: null, day: null, name: 'Sessione libera', ex: [], note: '' };
    if (prog && prog.days[dayIdx]) {
      const day = prog.days[dayIdx];
      sess.prog = prog.id; sess.day = day.id; sess.name = day.n;
      sess.ex = day.ex.map(pe => mkEx(pe.e, { sets: pe.sets, rmin: pe.rmin, rmax: pe.rmax, rest: pe.rest }));
    }
    S().activeSession = sess;
    Store.change();
    P.tab = 'allena'; P.min = false;
    UI.closeSheets();
    UI.go('palestra');
    UI.toast('Sessione iniziata');
  }
  P.nextDay = nextDay; P.start = start;
  P.ic = ic; P.circle = circle; P.menu = menu; P.drawChart = drawChart; P.barCfg = barCfg; P.num = num; P.kgS = kgS;

  /* ---------- timer di recupero ---------- */
  function startTimer(sec) {
    if (!(sec > 0)) { timer = null; flash = 0; drawTimer(); return; }
    timer = { end: Date.now() + sec * 1000, total: sec };
    flash = 0;
    drawTimer();
  }
  function drawTimer() {
    const el = document.getElementById('timerbar');
    if (!el) return;
    if (!timer && !flash) { el.classList.add('hide'); document.body.classList.remove('timer-on'); el.innerHTML = ''; return; }
    el.classList.remove('hide'); document.body.classList.add('timer-on');
    el.innerHTML = '<div class="timerbar-in"><div><div class="timer-l">Recupero</div><div class="timer-n" id="tm-n">–</div></div><div class="grow"></div>' +
      '<button class="btn sm" data-act="pal.tAdd">+30 s</button><button class="btn sm danger" data-act="pal.tStop">Stop</button><div class="timerbar-prog" id="tm-p"></div></div>';
    tick();
  }
  function tick() {
    const n = document.getElementById('tm-n');
    if (timer && n) {
      const rem = Math.ceil((timer.end - Date.now()) / 1000);
      if (rem <= 0) {
        timer = null; flash = Date.now() + 2500;
        UI.beep(3); try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { /* ignora */ }
        n.textContent = 'Via!';
      } else {
        n.textContent = Math.floor(rem / 60) + ':' + String(rem % 60).padStart(2, '0');
        const p = document.getElementById('tm-p'); if (p) p.style.width = (100 - (rem / timer.total) * 100) + '%';
      }
    } else if (!timer && flash) {
      if (Date.now() > flash) { flash = 0; drawTimer(); }
      else if (n) n.textContent = 'Via!';
    }
    const a = S().activeSession;
    if (a) {
      const el = document.getElementById('sess-el'); if (el) el.textContent = UI.durStr(Date.now() - a.start);
      const v = document.getElementById('sess-vol'); if (v) v.textContent = fmt(Calc.sessionVolume(a)) + ' kg';
      const s = document.getElementById('sess-sets'); if (s) s.textContent = a.ex.reduce((x, e) => x + Calc.doneSets(e, true).length, 0);
      const fg = document.getElementById('sess-fig'); if (fg) { const v = sessMuscles(a), k = JSON.stringify(v); if (fg.dataset.k !== k) { fg.dataset.k = k; fg.innerHTML = BodyMap.svg({ values: v, size: 34 }); } }
    }
  }
  /* muscoli toccati finora nella sessione: primario 1, secondari 0,5 per serie fatta (riscaldamento escluso) */
  function sessMuscles(a) {
    const m = {};
    a.ex.forEach(e => {
      const ex = Calc.exById(e.e), n = Calc.doneSets(e).length;
      if (!ex || !n) return;
      m[ex.mg] = (m[ex.mg] || 0) + n;
      (ex.sec || []).forEach(sc => { m[sc] = (m[sc] || 0) + n * 0.5; });
    });
    return m;
  }
  /* barra «Allenamento in corso»: pillola sopra la tabbar */
  const clk = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return s < 60 ? s + 's' : s < 3600 ? Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') : Math.floor(s / 3600) + ':' + String(Math.floor(s % 3600 / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  function curEx(a) {
    const e = a.ex.find(x => x.sets.some(s => !s.done)) || a.ex[a.ex.length - 1];
    return e ? Calc.exName(e.e) : 'Nessun esercizio';
  }
  function drawNotch() {
    const a = S().activeSession;
    let el = document.getElementById('notch');
    const show = !!a && !(UI.state.cur === 'palestra' && !P.min) && UI.state.cur !== 'onb';
    if (!show) { if (el) el.remove(); document.body.classList.remove('notch-on'); return; }
    if (!el) {
      el = document.createElement('div'); el.id = 'notch'; el.className = 'notch';
      el.innerHTML = '<div class="notch-in"><button class="notch-b" data-act="pal.notchOpen" aria-label="Riapri l’allenamento">' + UI.icon('up', 24) + '</button>' +
        '<button class="notch-c" data-act="pal.notchOpen" aria-label="Torna all’allenamento"><span class="notch-l"><i class="notch-dot"></i><b>Allenamento</b> <span id="notch-el"></span></span><span class="notch-x" id="notch-ex"></span></button>' +
        '<button class="notch-b dg" data-act="pal.discard" aria-label="Scarta l’allenamento">' + ic('trash', 22) + '</button></div>';
      document.body.appendChild(el);
    }
    document.body.classList.add('notch-on');
    const d = document.getElementById('notch-el'); if (d) d.textContent = clk(Date.now() - a.start);
    const x = document.getElementById('notch-ex'); if (x) { const n = curEx(a); if (x.textContent !== n) x.textContent = n; }
  }
  UI.on('pal.notchOpen', () => { P.min = false; UI.go('palestra'); UI.scrollTop(); });
  UI.on('pal.minimize', () => { readRows(); P.min = true; P.tab = 'allena'; UI.refresh(); UI.scrollTop(); drawNotch(); });
  setInterval(drawNotch, 500);
  setInterval(tick, 500);
  UI.on('pal.tAdd', () => { if (timer) { timer.end += 30000; timer.total += 30; tick(); } });
  UI.on('pal.timerPick', () => {
    const opts = [30, 45, 60, 90, 120, 180, 240, 300];
    const sh = UI.sheet({ title: 'Timer di recupero', cls: 'small', html: '<div class="hv-menu">' + (timer ? '<button class="hv-mi dg" data-s="0">Ferma il timer</button>' : '') + opts.map(s => '<button class="hv-mi" data-s="' + s + '">' + restStr(s) + '</button>').join('') + '</div>' });
    sh.body.addEventListener('click', ev => { const b = ev.target.closest('[data-s]'); if (!b) return; UI.unlockAudio(); startTimer(+b.dataset.s); sh.close(); });
  });
  UI.on('pal.sessMuscles', () => { if (P.musclesOpen) P.musclesOpen(Store.today(), 'day'); });
  UI.on('pal.tStop', () => { timer = null; flash = 0; drawTimer(); });

  /* ---------- allenamento in corso ---------- */
  function fmtSets(sets) {
    const groups = [];
    sets.forEach(x => { const g = groups[groups.length - 1]; if (g && g.w === +x.w) g.r.push(x.r); else groups.push({ w: +x.w, r: [x.r] }); });
    return groups.map(g => fmt(g.w, g.w % 1 ? 1 : 0) + ' kg × ' + g.r.join(', ')).join(' · ');
  }
  P.fmtSets = fmtSets;
  function setRowHtml(ei, si, st, plan, lp, lab, prevSet, rpeOn) {
    const rph = prevSet ? prevSet.r : (plan && plan.rmin ? plan.rmin + (plan.rmax && plan.rmax !== plan.rmin ? '–' + plan.rmax : '') : 'rip');
    const wph = prevSet ? num(prevSet.w) : 'kg';
    const prev = prevSet
      ? '<button class="hv-prev" data-act="pal.prev" data-w="' + esc(prevSet.w) + '" data-r="' + esc(prevSet.r) + '" aria-label="Copia la serie precedente">' + kgS(prevSet.w) + ' kg × ' + esc(prevSet.r) + '</button>'
      : '<span class="hv-prev none">–</span>';
    return '<div class="setrow hs' + (rpeOn ? ' r' : '') + (st.done ? ' done' : '') + '" data-ei="' + ei + '" data-si="' + si + '">' +
      '<button class="setn' + (st.t ? ' t-' + st.t : '') + '" data-act="pal.setType" aria-label="Tipo di serie: tocca per cambiare">' + lab + '</button>' + prev +
      '<input class="inp" inputmode="decimal" data-ch="pal.set" data-f="w" placeholder="' + esc(wph) + '" value="' + esc(num(st.w)) + '" aria-label="Kg serie ' + (si + 1) + '">' +
      '<input class="inp" inputmode="numeric" data-ch="pal.set" data-f="r" placeholder="' + esc(rph) + '" value="' + esc(st.r === '' ? '' : st.r) + '" aria-label="Ripetizioni serie ' + (si + 1) + '">' +
      (rpeOn ? '<input class="inp" inputmode="decimal" data-ch="pal.set" data-f="rpe" placeholder="–" value="' + esc(num(st.rpe)) + '" aria-label="RPE serie ' + (si + 1) + '">' : '') +
      '<button class="setok' + (st.done ? ' on' : '') + '" data-act="pal.done" aria-label="Serie fatta">' + UI.icon('check', 22) + '</button></div>';
  }
  function exBlock(e, ei) {
    const lp = Calc.lastPerformance(e.e);
    const pg = Calc.progression(e.e, e.plan);
    const fix = (S().exNotes || {})[e.e];
    const rpeOn = !!e.showRpe || e.sets.some(s => +s.rpe > 0);
    let h = '<div class="hv-exh">' + circle(e.e) + '<button class="hv-exn" data-act="pal.exInfo" data-id="' + esc(e.e) + '">' + esc(Calc.exName(e.e)) + '</button>' +
      '<button class="hv-ib" data-act="pal.voice" data-ei="' + ei + '" aria-label="Detta le serie">' + UI.icon('mic', 22) + '</button>' +
      '<button class="hv-ib" data-act="pal.exMenu" data-ei="' + ei + '" aria-label="Altre azioni">' + ic('dots', 22) + '</button></div>';
    if (fix) h += '<div class="sug fixnote">📌 ' + esc(fix) + ' <button class="link" data-act="pal.unpin" data-ei="' + ei + '">togli</button></div>';
    h += '<div class="exnote"><textarea class="inp" rows="1" data-ch="pal.exNote" data-ei="' + ei + '" placeholder="Aggiungi note qui…" aria-label="Nota esercizio">' + esc(e.note || '') + '</textarea>' + (e.note ? '<button class="link" data-act="pal.pin" data-ei="' + ei + '">📌 fissa</button>' : '') + '</div>';
    h += '<button class="hv-rest" data-act="pal.restPick" data-ei="' + ei + '">' + ic('timer', 20) + ' Riposo: ' + esc(restOf(e.plan) > 0 ? restStr(restOf(e.plan)) : 'DISATTIVO') + '</button>';
    if (undo && undo.ei === ei) h += '<div class="sug undo">Segnate ' + undo.n + ' serie <button class="link" data-act="pal.voiceUndo" data-ei="' + ei + '">Annulla</button></div>';
    if (pg) h += '<div class="hv-sug' + (pg.type === 'down' ? ' down' : '') + '">' + esc(pg.text) + '</div>';
    else if (!lp) h += '<div class="hv-sug none">Prima volta: parti leggero e annota come va.</div>';
    h += '<div class="setrow hs head' + (rpeOn ? ' r' : '') + '"><span>Serie</span><span>Precedente</span><span class="center">Kg</span><span class="center">Ripetizioni</span>' + (rpeOn ? '<span class="center">RPE</span>' : '') + '<span class="center">' + UI.icon('check', 16) + '</span></div>';
    let nn = 0;
    h += e.sets.map((st, si) => {
      const lab = st.t === 'w' ? 'R' : st.t === 'd' ? 'D' : st.t === 'f' ? 'C' : String(++nn);
      const prevSet = st.t === 'w' || !lp ? null : lp.sets[Math.min(Math.max(nn - 1, 0), lp.sets.length - 1)];
      return setRowHtml(ei, si, st, e.plan, lp, lab, prevSet, rpeOn);
    }).join('');
    h += '<div class="hv-addrow">' + (e.sets.length > 1 ? '<button class="hv-add rm" data-act="pal.rmSet" data-ei="' + ei + '">− Togli serie</button>' : '') +
      '<button class="hv-add" data-act="pal.addSet" data-ei="' + ei + '">＋ Aggiungi serie</button></div>';
    return '<section class="hv-ex">' + h + '</section>';
  }
  function sessionHtml(a) {
    const nSets = a.ex.reduce((x, e) => x + Calc.doneSets(e, true).length, 0);
    let h = '<div class="hv-top"><button class="hv-ib" data-act="pal.minimize" aria-label="Riduci l’allenamento">' + UI.icon('down', 26) + '</button><div class="hv-name">Allenamento</div>' +
      '<button class="hv-ib" data-act="pal.timerPick" aria-label="Timer di recupero">' + ic('timer', 26) + '</button><button class="hv-fine" data-act="pal.finish">Finito</button></div>';
    h += '<div class="hv-stats s4"><div><small>Durata</small><b class="bl" id="sess-el">' + UI.durStr(Date.now() - a.start) + '</b></div><div><small>Volume</small><b id="sess-vol">' + fmt(Calc.sessionVolume(a)) + ' kg</b></div><div><small>Serie</small><b id="sess-sets">' + nSets + '</b></div><div class="hv-minifig" id="sess-fig" data-act="pal.sessMuscles"></div></div>';
    if (!a.ex.length) h += '<p class="hv-empty">Nessun esercizio: aggiungine uno per iniziare.</p>';
    h += a.ex.map(exBlock).join('');
    h += '<button class="hv-go big" data-act="pal.addEx">＋ Aggiungi esercizio</button>';
    h += '<button class="hv-wide" data-act="pal.sessNote">Note della sessione' + (a.note ? ' ·  ' + esc(a.note.slice(0, 24)) : '') + '</button>';
    h += '<button class="hv-del" data-act="pal.discard">Scarta allenamento</button>';
    return h;
  }

  /* ---------- home Allenamento ---------- */
  function dayCard(p, d) {
    const names = d.ex.map(x => Calc.exName(x.e)).join(', ') || 'Nessun esercizio';
    return '<div class="hv-card" role="button" tabindex="0" data-act="pal.routine" data-p="' + esc(p.id) + '" data-d="' + esc(d.id) + '">' +
      '<div class="hv-ct"><h3>' + esc(d.n.toUpperCase()) + '</h3><button class="hv-ib" data-act="pal.dayMenu" data-p="' + esc(p.id) + '" data-d="' + esc(d.id) + '" aria-label="Altre azioni">' + ic('dots', 22) + '</button></div>' +
      '<p class="hv-cx">' + esc(names) + '</p>' +
      '<button class="hv-go" data-act="pal.startRoutine" data-p="' + esc(p.id) + '" data-d="' + esc(d.id) + '">Avvia la Routine</button></div>';
  }
  function homeHtml() {
    const progs = S().programs;
    let h = '<h1 class="hv-title">Allenamento</h1><button class="hv-wide" data-act="pal.startFree">＋ Inizia un allenamento vuoto</button>';
    h += '<div class="hv-sec"><h2>Routine</h2><button class="hv-ib" data-act="pal.newProg" aria-label="Nuova cartella">' + ic('folder', 26) + '</button></div>';
    h += '<div class="hv-2"><button class="hv-wide half" data-act="pal.newRoutine">' + ic('clip', 22) + ' Nuova routine</button><button class="hv-wide half" data-act="pal.explore">' + ic('search', 22) + ' Esplora</button></div>';
    if (!progs.length) h += '<p class="hv-empty">Nessuna routine: creane una oppure copia un modello da «Esplora».</p>';
    progs.forEach(p => {
      const open = p.open !== false;
      h += '<div class="hv-fold"><button class="hv-foldt" data-act="pal.fold" data-id="' + esc(p.id) + '"><span class="hv-tri' + (open ? '' : ' c') + '">▾</span> ' + esc(p.n) + ' (' + p.days.length + ')' + (S().activeProgram === p.id ? ' ' + UI.badge('attiva', 'ok') : '') + '</button>' +
        '<button class="hv-ib" data-act="pal.progMenu" data-id="' + esc(p.id) + '" aria-label="Azioni cartella">' + ic('dots', 22) + '</button></div>';
      if (open) h += p.days.length ? p.days.map(d => dayCard(p, d)).join('') : '<p class="hv-empty">Cartella vuota: tocca «Nuova routine».</p>';
    });
    const last = Calc.sortedSessions().slice(-1)[0];
    if (last) h += '<p class="hv-last">Ultimo allenamento: ' + esc(last.name || 'Sessione') + ', ' + esc(UI.dateLabel(last.date).toLowerCase()) + '</p>';
    return h;
  }

  /* ---------- dettaglio routine ---------- */
  function findDay(pid, did) {
    const p = S().programs.find(x => x.id === pid); if (!p) return {};
    return { p, d: p.days.find(x => x.id === did), i: p.days.findIndex(x => x.id === did) };
  }
  function routineDetail(p, d) {
    const sh = UI.sheet({ title: 'Routine', cls: 'tall' });
    let metric = 'vol';
    const sess = Calc.sortedSessions().filter(s => s.day === d.id).slice(-12);
    const val = s => metric === 'vol' ? Calc.sessionVolume(s) : metric === 'rip' ? s.ex.reduce((a, e) => a + Calc.doneSets(e).reduce((b, x) => b + (+x.r), 0), 0) : (s.end && s.start ? Math.round((s.end - s.start) / 60000) : 0);
    const CH = [['vol', 'Volume'], ['rip', 'Ripetizioni'], ['dur', 'Durata']];
    function exTable(pe) {
      const lp = Calc.lastPerformance(pe.e);
      let rows = '';
      for (let i = 0; i < (pe.sets || 3); i++) {
        const ls = lp ? lp.sets[Math.min(i, lp.sets.length - 1)] : null;
        rows += '<div class="hv-tr"><span>' + (i + 1) + '</span><span>' + (ls ? kgS(ls.w) : '–') + '</span><span>' + (pe.rmin ? pe.rmin + (pe.rmax !== pe.rmin ? '–' + pe.rmax : '') : '–') + '</span></div>';
      }
      return '<div class="hv-exh">' + circle(pe.e) + '<button class="hv-exn" data-ex="' + esc(pe.e) + '">' + esc(Calc.exName(pe.e)) + '</button></div>' +
        '<div class="hv-tr head"><span>Serie</span><span>Kg</span><span>Ripetizioni</span></div>' + rows;
    }
    sh.set('<h2 class="hv-h2">' + esc(d.n.toUpperCase()) + '</h2><p class="hv-sub">Cartella: ' + esc(p.n) + '</p>' +
      '<button class="hv-go big" id="rd-go">Avvia la routine</button>' +
      '<div class="hv-chart" id="rd-chart"></div><div class="hv-chips" id="rd-chips"></div>' +
      '<div class="hv-sec"><h2 class="mut">Esercizi</h2><button class="hv-lnk" id="rd-edit">Modifica la routine</button></div>' +
      (d.ex.length ? d.ex.map(exTable).join('') : '<p class="hv-empty">Nessun esercizio.</p>'));
    const box = sh.body.querySelector('#rd-chart'), chips = sh.body.querySelector('#rd-chips');
    function draw() {
      chips.innerHTML = CH.map(c => '<button class="chip' + (c[0] === metric ? ' on' : '') + '" data-m="' + c[0] + '">' + c[1] + '</button>').join('');
      if (!sess.length) { box.innerHTML = '<div class="hv-nodata">' + ic('bars', 56) + '<span>Non ci sono ancora dati</span></div>'; return; }
      const unit = metric === 'vol' ? ' kg' : metric === 'dur' ? ' min' : '';
      drawChart(box, barCfg(sess.map(s => UI.dateShort(s.date)), sess.map(val), v => fmt(v) + unit));
    }
    draw();
    chips.addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) { metric = b.dataset.m; draw(); } });
    sh.body.querySelector('#rd-go').onclick = () => { const f = findDay(p.id, d.id); if (f.d) { sh.close(); start(p.id, f.i); } };
    sh.body.querySelector('#rd-edit').onclick = () => { sh.close(); setTimeout(() => dayEditor(p, d, false), 350); };
    sh.body.addEventListener('click', e => { const b = e.target.closest('[data-ex]'); if (b && P.exDetail) P.exDetail(b.dataset.ex); });
  }

  /* ---------- editor di una routine ---------- */
  function pickExercise(cb) {
    let q = '', mg = 'tutti';
    const sh = UI.sheet({
      title: 'Scegli esercizio', cls: 'tall',
      html: '<input class="inp" type="search" id="px-q" placeholder="Cerca esercizio…" style="margin-bottom:10px"><div class="chips scroll mb8" id="px-mg"></div><div id="px-res"></div>'
    });
    const mgs = [['tutti', 'Tutti']].concat(Object.keys(D.MUSCLES).map(k => [k, D.MUSCLES[k]]));
    const chips = sh.body.querySelector('#px-mg'), res = sh.body.querySelector('#px-res');
    function draw() {
      chips.innerHTML = mgs.map(m => '<button class="chip sm' + (m[0] === mg ? ' on' : '') + '" data-m="' + m[0] + '">' + m[1] + '</button>').join('');
      let list = Calc.allExercises().filter(e => mg === 'tutti' || e.mg === mg);
      const toks = Calc.norm(q).split(/\s+/).filter(Boolean);
      if (toks.length) list = list.filter(e => { const n = Calc.norm(e.n); return toks.every(t => n.indexOf(t) >= 0); });
      res.innerHTML = '<div class="list">' + list.map(e => '<button class="li" data-id="' + esc(e.id) + '"><div class="li-main"><div class="li-t">' + esc(e.n) + '</div><div class="li-s">' + esc(D.MUSCLES[e.mg] || '') + ' · ' + esc(D.EQUIP[e.eq] || '') + '</div></div></button>').join('') + '</div><button class="btn block mt12" data-new="1">+ Crea un esercizio mio</button>';
    }
    draw();
    sh.body.querySelector('#px-q').addEventListener('input', e => { q = e.target.value; draw(); });
    chips.addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) { mg = b.dataset.m; draw(); } });
    res.addEventListener('click', e => {
      if (e.target.closest('[data-new]')) { exerciseForm(null, ex => { cb(ex); sh.close(); }); return; }
      const b = e.target.closest('.li[data-id]'); if (!b) return;
      const ex = Calc.exById(b.dataset.id); if (ex) { cb(ex); sh.close(); }
    });
  }
  function dayEditor(prog, day, isNew) {
    const draft = JSON.parse(JSON.stringify(day));
    const sh = UI.sheet({ title: isNew ? 'Nuova routine' : 'Modifica la routine', cls: 'tall' });
    const nI = (attrs, val) => '<input class="inp" inputmode="numeric" ' + attrs + ' value="' + (val == null ? '' : val) + '" style="text-align:center;min-height:44px;padding:4px;font-size:16px">';
    const grid = 'grid-template-columns:1fr 40px 40px 40px 48px;gap:4px';
    function draw() {
      sh.set(UI.field('Nome della routine', UI.inp({ id: 'de-n', value: draft.n, ph: 'es. Push' })) +
        '<div class="field-l">Cartella: ' + esc(prog.n) + '</div>' +
        draft.ex.map((x, xi) => '<section class="card tight"><div class="row between mb8"><b class="small" style="line-height:1.2">' + esc(Calc.exName(x.e)) + '</b><span class="row">' +
          (xi > 0 ? '<button class="icon-btn sm" data-pa="xup" data-xi="' + xi + '" aria-label="Sposta su">' + UI.icon('up', 18) + '</button>' : '') +
          '<button class="icon-btn sm" data-pa="xdel" data-xi="' + xi + '" aria-label="Togli">' + UI.icon('close', 18) + '</button></span></div>' +
          '<div class="setrow" style="' + grid + ';font-size:11px;color:var(--tx2);text-transform:uppercase"><span></span><span class="center">Serie</span><span class="center">Min</span><span class="center">Max</span><span class="center">Rec s</span></div>' +
          '<div class="setrow" style="' + grid + '"><span></span>' + ['sets', 'rmin', 'rmax', 'rest'].map(f => nI('data-pf="' + f + '" data-xi="' + xi + '"', x[f])).join('') + '</div></section>').join('') +
        '<button class="hv-go big" data-pa="xadd">＋ Aggiungi esercizio</button>' +
        '<button class="btn primary block mt12" data-pa="save">Salva</button>');
    }
    draw();
    const readName = () => { const n = sh.body.querySelector('#de-n'); if (n) draft.n = n.value; };
    sh.body.addEventListener('change', e => {
      const t = e.target;
      if (t.id === 'de-n') { draft.n = t.value; return; }
      const f = t.dataset.pf; if (!f) return;
      const x = draft.ex[+t.dataset.xi]; const v = parseInt(t.value, 10);
      if (f === 'rest') { x.rest = isFinite(v) && v >= 0 ? v : x.rest; }
      else x[f] = isFinite(v) && v > 0 ? v : x[f];
      if (f === 'rmin' && x.rmax < x.rmin) x.rmax = x.rmin;
      t.value = x[f];
    });
    sh.body.addEventListener('click', e => {
      const b = e.target.closest('[data-pa]'); if (!b) return;
      const a = b.dataset.pa; readName();
      if (a === 'xdel') { draft.ex.splice(+b.dataset.xi, 1); draw(); }
      else if (a === 'xup') { const i = +b.dataset.xi; if (i > 0) { [draft.ex[i - 1], draft.ex[i]] = [draft.ex[i], draft.ex[i - 1]]; draw(); } }
      else if (a === 'xadd') pickExercise(ex => { draft.ex.push({ e: ex.id, sets: 1, rmin: 8, rmax: 12, rest: 90 }); draw(); });
      else if (a === 'save') {
        if (!draft.n.trim()) return UI.toast('Dai un nome alla routine');
        if (!draft.ex.length) return UI.toast('Aggiungi almeno un esercizio');
        draft.n = draft.n.trim();
        if (S().programs.indexOf(prog) < 0) S().programs.push(prog);
        const i = prog.days.findIndex(d => d.id === draft.id);
        if (i >= 0) prog.days[i] = draft; else prog.days.push(draft);
        if (!S().activeProgram) { S().activeProgram = prog.id; S().nextDayIdx = 0; }
        Store.change(); sh.close(); UI.refresh(); UI.toast('Routine salvata');
      }
    });
  }
  function newDay() { return { id: Store.uid('d'), n: '', ex: [] }; }

  /* ---------- esercizio mio: scheda ---------- */
  function exerciseForm(existing, cb) {
    const ex = existing || { n: '', mg: 'petto', sec: [], eq: 'bilanciere' };
    let sec = ex.sec.slice();
    const sh = UI.sheet({ title: existing ? 'Modifica esercizio' : 'Esercizio mio', cls: 'tall' });
    function draw() {
      sh.set(UI.field('Nome', UI.inp({ id: 'xf-n', value: ex.n, ph: 'es. Panca con fermo' })) +
        UI.field('Muscolo principale', UI.select(Object.keys(D.MUSCLES).map(k => [k, D.MUSCLES[k]]), ex.mg, 'id="xf-mg"')) +
        '<div class="field-l" style="margin-bottom:6px">Muscoli secondari</div><div class="chips mb8">' + Object.keys(D.MUSCLES).map(k => '<button class="chip sm' + (sec.indexOf(k) >= 0 ? ' on' : '') + '" data-s="' + k + '">' + D.MUSCLES[k] + '</button>').join('') + '</div>' +
        UI.field('Attrezzo', UI.select(Object.keys(D.EQUIP).map(k => [k, D.EQUIP[k]]), ex.eq, 'id="xf-eq"')) +
        '<div class="row gap">' + (existing ? '<button class="btn danger" data-xa="del">Elimina</button>' : '') + '<button class="btn primary grow" data-xa="save">Salva</button></div>');
    }
    draw();
    const read = () => { const g = id => sh.body.querySelector(id); ex.n = g('#xf-n').value; ex.mg = g('#xf-mg').value; ex.eq = g('#xf-eq').value; };
    sh.body.addEventListener('click', async e => {
      const c = e.target.closest('[data-s]');
      if (c) { read(); const k = c.dataset.s, i = sec.indexOf(k); if (i >= 0) sec.splice(i, 1); else sec.push(k); draw(); return; }
      const b = e.target.closest('[data-xa]'); if (!b) return;
      read();
      if (b.dataset.xa === 'save') {
        if (!ex.n.trim()) return UI.toast('Scrivi il nome');
        const obj = existing || { id: 'x_' + Store.uid('') };
        obj.n = ex.n.trim(); obj.mg = ex.mg; obj.eq = ex.eq; obj.sec = sec.filter(s => s !== ex.mg);
        if (!existing) S().exercises.push(obj);
        Store.change(); sh.close(); UI.refresh(); if (cb) cb(obj); else UI.toast('Esercizio salvato');
      } else if (await UI.confirm({ title: 'Eliminare l\'esercizio?', msg: 'Resta nelle sessioni già registrate.', ok: 'Elimina', danger: true })) {
        S().exercises = S().exercises.filter(x => x.id !== existing.id); Store.change(); sh.close(); UI.refresh();
      }
    });
  }

  /* ---------- vista ---------- */
  const view = {
    title: 'Palestra',
    render() {
      if (P.tab !== 'profilo') P.tab = 'allena';
      const a = S().activeSession;
      if (a && !P.min) return sessionHtml(a);
      const seg = UI.seg([['allena', 'Allenamento'], ['profilo', 'Profilo']], P.tab, 'pal.tab');
      if (P.tab === 'profilo') return seg + (P.profiloHtml ? P.profiloHtml() : '');
      return seg + homeHtml();
    },
    after(el) { if (P.tab === 'profilo' && !(S().activeSession && !P.min) && P.profiloAfter) P.profiloAfter(el); }
  };
  UI.registerView('palestra', view);

  /* ---------- azioni: home ---------- */
  UI.on('pal.tab', el => { P.tab = el.dataset.v === 'profilo' ? 'profilo' : 'allena'; UI.refresh(); });
  UI.on('pal.startFree', () => start(null, 0));
  UI.on('pal.startRoutine', el => { const f = findDay(el.dataset.p, el.dataset.d); if (f.d) start(f.p.id, f.i); });
  UI.on('pal.routine', el => { const f = findDay(el.dataset.p, el.dataset.d); if (f.d) routineDetail(f.p, f.d); });
  UI.on('pal.fold', el => { const p = S().programs.find(x => x.id === el.dataset.id); if (p) { p.open = p.open === false; Store.change(); UI.refresh(); } });
  UI.on('pal.newProg', async () => {
    const n = await UI.prompt({ title: 'Nuova cartella', ph: 'es. Le mie routine' });
    if (!n) return;
    const p = { id: Store.uid('p'), n, days: [] };
    S().programs.push(p);
    if (!S().activeProgram) { S().activeProgram = p.id; S().nextDayIdx = 0; }
    Store.change(); UI.refresh();
  });
  UI.on('pal.newRoutine', () => {
    let prog = activeProg() || S().programs[0];
    if (!prog) prog = { id: Store.uid('p'), n: 'Le mie routine', days: [] };
    dayEditor(prog, newDay(), true);
  });
  UI.on('pal.explore', () => {
    const sh = UI.sheet({
      title: 'Esplora', cls: 'tall',
      html: '<p class="hv-sub">Modelli pronti: «Copia» li aggiunge come cartella.</p><div class="list">' + D.TEMPLATES.map(t => '<div class="li"><div class="li-main"><div class="li-t">' + esc(t.n) + '</div><div class="li-s wrapt">' + esc(t.d) + '</div></div><button class="btn sm primary" data-id="' + t.id + '">Copia</button></div>').join('') + '</div>'
    });
    sh.body.addEventListener('click', e => {
      const b = e.target.closest('[data-id]'); if (!b) return;
      const t = D.TEMPLATES.find(x => x.id === b.dataset.id); if (!t) return;
      const p = copyTemplate(t);
      S().programs.push(p);
      if (!S().activeProgram) { S().activeProgram = p.id; S().nextDayIdx = 0; }
      Store.change(); sh.close(); UI.refresh(); UI.toast('«' + t.n + '» copiata');
    });
  });
  function copyTemplate(t) {
    return { id: Store.uid('p'), n: t.n, days: t.days.map(d => ({ id: Store.uid('d'), n: d.n, ex: d.ex.map(e => ({ e: e.e, sets: e.sets, rmin: e.rmin, rmax: e.rmax, rest: e.rest })) })) };
  }
  UI.on('pal.progMenu', el => {
    const p = S().programs.find(x => x.id === el.dataset.id); if (!p) return;
    menu(p.n, [
      { t: 'Rinomina', a: async () => { const n = await UI.prompt({ title: 'Rinomina cartella', value: p.n }); if (n) { p.n = n; Store.change(); UI.refresh(); } } },
      { t: 'Imposta attiva', a: () => { S().activeProgram = p.id; S().nextDayIdx = 0; Store.change(); UI.refresh(); UI.toast('Cartella attiva: ' + p.n); } },
      { t: 'Elimina', danger: true, a: async () => {
        if (!await UI.confirm({ title: 'Eliminare la cartella?', msg: 'Le sessioni già fatte restano nello storico.', ok: 'Elimina', danger: true })) return;
        S().programs = S().programs.filter(x => x.id !== p.id);
        if (S().activeProgram === p.id) { S().activeProgram = S().programs[0] ? S().programs[0].id : null; S().nextDayIdx = 0; }
        Store.change(); UI.refresh();
      } }
    ]);
  });
  UI.on('pal.dayMenu', el => {
    const f = findDay(el.dataset.p, el.dataset.d); if (!f.d) return;
    const items = [
      { t: 'Modifica', a: () => dayEditor(f.p, f.d, false) },
      { t: 'Duplica', a: () => { const c = JSON.parse(JSON.stringify(f.d)); c.id = Store.uid('d'); c.n = f.d.n + ' (copia)'; f.p.days.splice(f.i + 1, 0, c); Store.change(); UI.refresh(); } }
    ];
    if (f.i > 0) items.push({ t: 'Sposta su', a: () => { const dd = f.p.days; [dd[f.i - 1], dd[f.i]] = [dd[f.i], dd[f.i - 1]]; Store.change(); UI.refresh(); } });
    items.push({ t: 'Elimina', danger: true, a: async () => {
      if (!await UI.confirm({ title: 'Eliminare la routine?', msg: 'Le sessioni già fatte restano nello storico.', ok: 'Elimina', danger: true })) return;
      f.p.days.splice(f.i, 1);
      if (f.p.days.length) S().nextDayIdx = (S().nextDayIdx || 0) % f.p.days.length; else S().nextDayIdx = 0;
      Store.change(); UI.refresh();
    } });
    menu(f.d.n, items);
  });

  /* ---------- azioni: allenamento in corso ---------- */
  UI.on('pal.addSet', el => { readRows(); const e = S().activeSession.ex[+el.dataset.ei]; const last = e.sets[e.sets.length - 1]; e.sets.push({ w: last ? last.w : '', r: '', rpe: '', t: '', done: false }); Store.change(); UI.refresh(); });
  UI.on('pal.rmSet', el => { readRows(); const e = S().activeSession.ex[+el.dataset.ei]; if (e.sets.length > 1) { e.sets.pop(); Store.change(); UI.refresh(); } });
  UI.on('pal.rmEx', async el => {
    const e = S().activeSession.ex[+el.dataset.ei];
    if (Calc.doneSets(e).length && !await UI.confirm({ title: 'Togliere l\'esercizio?', msg: 'Le serie già fatte andranno perse.', ok: 'Togli', danger: true })) return;
    S().activeSession.ex.splice(+el.dataset.ei, 1); Store.change(); UI.refresh();
  });
  UI.on('pal.addEx', () => { readRows(); pickExercise(ex => { S().activeSession.ex.push(mkEx(ex.id, { sets: 1, rmin: 8, rmax: 12, rest: 90 })); Store.change(); UI.refresh(); }); });
  UI.on('pal.help', el => {
    const e = S().activeSession.ex[+el.dataset.ei];
    let si = e.sets.findIndex(s => !s.done); if (si < 0) si = e.sets.length - 1;
    readRows();
    Partner.open({ ex: e.e, set: si });
  });
  UI.on('pal.exMenu', el => {
    readRows();
    const ei = +el.dataset.ei, e = S().activeSession.ex[ei], fake = { dataset: { ei: String(ei) } };
    const items = [];
    if (ei > 0) items.push({ t: 'Sposta su', a: () => UI.acts['pal.exUp'](fake) });
    items.push({ t: '🎤 Detta le serie', a: () => UI.acts['pal.voice'](fake) });
    items.push({ t: 'Chiedi al Coach', a: () => UI.acts['pal.help'](fake) });
    items.push({ t: e.showRpe ? 'Nascondi RPE' : 'Mostra RPE', a: () => { e.showRpe = !e.showRpe; Store.change(); UI.refresh(); } });
    if (e.sets.length > 1) items.push({ t: 'Togli ultima serie', a: () => UI.acts['pal.rmSet'](fake) });
    items.push({ t: 'Togli esercizio', danger: true, a: () => UI.acts['pal.rmEx'](fake) });
    menu(Calc.exName(e.e), items);
  });
  UI.on('pal.restPick', el => {
    const e = S().activeSession.ex[+el.dataset.ei];
    const opts = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300];
    const cur = restOf(e.plan);
    const sh = UI.sheet({ title: 'Recupero', cls: 'small', html: '<div class="hv-menu">' + opts.map(s => '<button class="hv-mi' + (s === cur ? ' on' : '') + '" data-s="' + s + '">' + restStr(s) + (s === cur ? ' ✓' : '') + '</button>').join('') + '</div>' });
    sh.body.addEventListener('click', ev => {
      const b = ev.target.closest('[data-s]'); if (!b) return;
      e.plan = e.plan || {}; e.plan.rest = +b.dataset.s; Store.change(); sh.close(); UI.refresh();
    });
  });
  UI.on('pal.sessNote', () => {
    readRows();
    const a = S().activeSession;
    const sh = UI.sheet({ title: 'Note della sessione', cls: 'small', html: '<textarea class="inp" id="sn-t" rows="4" placeholder="Come è andata?">' + esc(a.note || '') + '</textarea><button class="btn primary block mt12" id="sn-ok">Salva</button>' });
    sh.body.querySelector('#sn-ok').onclick = () => { a.note = sh.body.querySelector('#sn-t').value; Store.change(); sh.close(); UI.refresh(); };
  });
  function readRow(row) {
    const a = S().activeSession; if (!a) return null;
    const st = a.ex[+row.dataset.ei].sets[+row.dataset.si];
    row.querySelectorAll('input[data-f]').forEach(i => {
      const f = i.dataset.f, v = UI.parseNum(i.value);
      if (f === 'w') st.w = isFinite(v) && v >= 0 ? v : '';
      else if (f === 'r') st.r = isFinite(v) && v > 0 ? Math.round(v) : '';
      else st.rpe = isFinite(v) && v >= 5 && v <= 10 ? v : '';
    });
    return st;
  }
  function readRows() { document.querySelectorAll('#view .setrow[data-ei]').forEach(readRow); }
  UI.onChange('pal.set', el => { const row = el.closest('.setrow'); readRow(row); Store.change(); tick(); });
  UI.on('pal.prev', el => {
    const row = el.closest('.setrow'); if (!row) return;
    const w = row.querySelector('input[data-f="w"]'), r = row.querySelector('input[data-f="r"]');
    w.value = num(el.dataset.w); r.value = el.dataset.r;
    readRow(row); Store.change();
  });
  UI.on('pal.done', el => {
    UI.unlockAudio();
    const row = el.closest('.setrow');
    const st = readRow(row);
    if (!st) return;
    if (!st.done) {
      if (!(st.r > 0)) return UI.toast('Inserisci le ripetizioni');
      if (st.w === '') st.w = 0;
      st.done = true;
      const plan = S().activeSession.ex[+row.dataset.ei].plan;
      startTimer(restOf(plan));
    } else st.done = false;
    el.classList.toggle('on', st.done); row.classList.toggle('done', st.done);
    Store.change(); tick();
  });
  /* ---------- note, tipo di serie, ordine ---------- */
  UI.onChange('pal.exNote', el => { const e = S().activeSession.ex[+el.dataset.ei]; readRows(); e.note = el.value.trim(); Store.change(); UI.refresh(); });
  UI.on('pal.pin', el => {
    const e = S().activeSession.ex[+el.dataset.ei]; if (!e.note) return;
    S().exNotes = S().exNotes || {}; S().exNotes[e.e] = e.note; Store.change(); UI.refresh(); UI.toast('Nota fissata');
  });
  UI.on('pal.unpin', el => { const e = S().activeSession.ex[+el.dataset.ei]; if (S().exNotes) delete S().exNotes[e.e]; Store.change(); UI.refresh(); });
  UI.on('pal.setType', el => {
    readRows();
    const row = el.closest('.setrow'), st = S().activeSession.ex[+row.dataset.ei].sets[+row.dataset.si];
    st.t = { '': 'w', w: 'd', d: 'f', f: '' }[st.t || ''];
    Store.change(); UI.refresh();
  });
  UI.on('pal.exUp', el => {
    readRows();
    const ex = S().activeSession.ex, i = +el.dataset.ei;
    if (i > 0) { const t = ex[i - 1]; ex[i - 1] = ex[i]; ex[i] = t; Store.change(); UI.refresh(); }
  });

  /* ---------- voce sull'esercizio ---------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  function lastKgOf(e) {
    for (let i = e.sets.length - 1; i >= 0; i--) { const st = e.sets[i]; if (st.done && st.t !== 'w' && st.w !== '' && st.w != null) return +st.w; }
    const lp = Calc.lastPerformance(e.e);
    return lp ? +lp.sets[lp.sets.length - 1].w : null;
  }
  function voiceSummary(ps) {
    const tot = ps.reduce((a, p) => a + p.n, 0);
    return tot + (tot === 1 ? ' serie: ' : ' serie: ') + ps.map(p => (p.n > 1 ? p.n + ' × ' : '') + (p.kg === '' ? 'kg ?' : fmt(+p.kg, +p.kg % 1 ? 1 : 0) + ' kg') + ' × ' + p.reps + (p.rpe ? ' @' + p.rpe : '')).join(', ');
  }
  /* riempie le prime serie non spuntate, ne crea se mancano; le segna fatte. Ritorna quante */
  function applySets(e, ps) {
    let n = 0;
    ps.forEach(p => {
      for (let k = 0; k < p.n; k++) {
        let st = e.sets.find(x => !x.done);
        if (!st) { st = { w: '', r: '', rpe: '', t: '', done: false }; e.sets.push(st); }
        st.w = p.kg === '' ? 0 : p.kg; st.r = p.reps; if (p.rpe != null && p.rpe >= 5 && p.rpe <= 10) st.rpe = p.rpe; st.done = true; n++;
      }
    });
    return n;
  }
  UI.on('pal.voice', el => {
    readRows();
    const ei = +el.dataset.ei, e = S().activeSession.ex[ei];
    let rec = null;
    const sh = UI.sheet({
      title: Calc.exName(e.e), cls: 'small',
      onClose() { if (rec) { try { rec.stop(); } catch (x) { /* ignora */ } rec = null; } },
      html: '<textarea class="inp" id="pv-t" rows="2" autofocus placeholder="Es. 80 per 8, poi 80 per 7"></textarea>' +
        '<p class="hint mb8">Tocca il microfono 🎤 della tastiera per dettare.</p>' +
        (SR ? '<button class="btn block mb8" id="pv-mic">' + UI.icon('mic', 18) + ' Parla</button>' : '') +
        '<div class="sug" id="pv-prev">Di\' le serie, per esempio «80 per 8».</div>' +
        '<button class="btn primary block" id="pv-ok">Segna</button>'
    });
    const ta = sh.body.querySelector('#pv-t'), prev = sh.body.querySelector('#pv-prev');
    const parsed = () => VoceParse.parseSets(ta.value, { lastKg: lastKgOf(e) });
    const upd = () => { const ps = parsed(); prev.textContent = ta.value.trim() ? (ps.length ? voiceSummary(ps) : 'Non ho capito: prova "80 per 8"') : 'Di\' le serie, per esempio «80 per 8».'; };
    ta.addEventListener('input', upd);
    setTimeout(() => ta.focus(), 120);
    const mic = sh.body.querySelector('#pv-mic');
    if (mic) {
      const label = on => { mic.innerHTML = UI.icon('mic', 18) + (on ? ' Ascolto… (tocca per fermare)' : ' Parla'); mic.classList.toggle('primary', on); };
      mic.onclick = () => {
        if (rec) { try { rec.stop(); } catch (x) { /* ignora */ } rec = null; label(false); return; }
        try {
          rec = new SR(); rec.lang = 'it-IT'; rec.interimResults = false; rec.continuous = false;
          rec.onresult = ev => { let t = ''; for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) t += ev.results[i][0].transcript; if (t) { ta.value = (ta.value ? ta.value.replace(/\s+$/, '') + ' ' : '') + t.trim(); upd(); } };
          rec.onend = () => { rec = null; label(false); };
          rec.onerror = ev => { rec = null; label(false); UI.toast(ev && ev.error === 'not-allowed' ? 'Microfono non consentito: usa quello della tastiera 🎤' : 'Dettatura non riuscita: usa il microfono 🎤 della tastiera'); };
          rec.start(); label(true);
        } catch (x) { rec = null; label(false); UI.toast('Dettatura non disponibile: usa il microfono 🎤 della tastiera'); }
      };
    }
    sh.body.querySelector('#pv-ok').onclick = () => {
      const ps = parsed();
      if (!ps.length) { prev.textContent = 'Non ho capito: prova "80 per 8"'; return; }
      UI.unlockAudio();
      const snap = JSON.parse(JSON.stringify(e.sets));
      const n = applySets(e, ps);
      startTimer(restOf(e.plan));
      if (undo) clearTimeout(undo.tm);
      const u = undo = { ei, snap, n, tm: setTimeout(() => { if (undo === u) { undo = null; UI.refresh(); } }, 6000) };
      Store.change(); sh.close(); UI.refresh();
    };
  });
  UI.on('pal.voiceUndo', () => {
    if (!undo) return;
    const e = S().activeSession.ex[undo.ei];
    if (e) e.sets = undo.snap;
    clearTimeout(undo.tm); undo = null; Store.change(); UI.refresh();
  });
  UI.on('pal.discard', async () => {
    if (await UI.confirm({ title: 'Scartare la sessione?', msg: 'Non verrà salvata.', ok: 'Scarta', danger: true })) { S().activeSession = null; P.min = false; timer = null; flash = 0; drawTimer(); Store.change(); UI.refresh(); drawNotch(); }
  });
  UI.on('pal.finish', async () => {
    readRows();
    const a = S().activeSession; if (!a) return;
    a.ex.forEach(e => { e.sets = e.sets.filter(s => s.done); });
    a.ex = a.ex.filter(e => e.sets.length);
    if (!a.ex.length) {
      if (await UI.confirm({ title: 'Nessuna serie completata', msg: 'Scarto la sessione?', ok: 'Scarta', danger: true })) { S().activeSession = null; timer = null; drawTimer(); Store.change(); UI.refresh(); }
      else UI.refresh();
      return;
    }
    a.end = Date.now();
    const prs = Calc.newRecords(a);
    S().sessions.push(a);
    const prog = S().programs.find(p => p.id === a.prog);
    if (prog && S().activeProgram === prog.id) { const di = prog.days.findIndex(d => d.id === a.day); if (di >= 0) S().nextDayIdx = (di + 1) % prog.days.length; }
    S().activeSession = null; P.min = false; timer = null; flash = 0; drawTimer();
    Store.change(); UI.refresh(); drawNotch();
    const vol = Calc.sessionVolume(a), nSets = a.ex.reduce((x, e) => x + e.sets.length, 0);
    const sh = UI.sheet({
      title: 'Allenamento finito', cls: 'small',
      html: '<div class="stats"><div class="stat"><b>' + UI.durStr(a.end - a.start) + '</b><span>durata</span></div><div class="stat"><b>' + fmt(vol) + '</b><span>volume kg</span></div><div class="stat"><b>' + nSets + '</b><span>serie</span></div></div>' +
        (prs.length ? '<div class="hl mb8"><b>🏆 Record</b>' + prs.map(r => '<div class="small">' + esc(r.n) + ': ' + fmt(r.w, r.w % 1 ? 1 : 0) + ' kg × ' + r.r + (r.first ? ' (prima volta)' : '') + '</div>').join('') + '</div>' : '<p class="small mut mb8">Nessun nuovo record questa volta: la costanza conta più.</p>') +
        '<button class="btn wa block" id="fin-send">Manda al partner</button><button class="btn block mt8" id="fin-close">Chiudi</button>'
    });
    sh.body.querySelector('#fin-close').onclick = () => sh.close();
    sh.body.querySelector('#fin-send').onclick = () => { sh.close(); setTimeout(() => Partner.send(Partner.sessionSummary(a, prs)), 350); };
  });

  P.pickExercise = pickExercise; P.exerciseForm = exerciseForm;
  window.Pal = P;
})();
