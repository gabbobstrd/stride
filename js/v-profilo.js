/* Compagno - Palestra: Profilo (stile Hevy), statistiche, calendario, esercizi, dettagli */
(function () {
  'use strict';
  const P = window.Pal;
  if (!P) return;
  const esc = UI.esc, fmt = UI.fmt, S = () => Store.s;
  const ic = P.ic, circle = P.circle, drawChart = P.drawChart, barCfg = P.barCfg, kgS = P.kgS;
  const MESI_L = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  const LET = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];
  let feedN = 10, wk = 'dur';

  /* ---------- calcoli ---------- */
  const sessions = () => Calc.sortedSessions();
  const durMs = s => (s.end && s.start ? s.end - s.start : 0);
  const repsOf = s => s.ex.reduce((a, e) => a + Calc.doneSets(e).reduce((b, x) => b + (+x.r), 0), 0);
  const setsOf = s => s.ex.reduce((a, e) => a + Calc.doneSets(e, true).length, 0);
  const hoursStr = ms => fmt(ms / 3600000, 1);
  function mondayOf(k) { const d = Store.parseKey(k); return Store.addDays(k, -((d.getDay() + 6) % 7)); }
  /* record per sessione: scorre le sessioni in ordine e conta i miglioramenti (la prima volta non conta) */
  function recordEvents() {
    const best = {}, out = {};
    sessions().forEach(s => {
      const ev = [];
      s.ex.forEach(e => {
        let bn = null, ln = null;
        Calc.doneSets(e).forEach(x => {
          const v = Calc.e1rm(x.w, x.r, x.rpe);
          if (!bn || v > bn.v) bn = { v, w: +x.w, r: +x.r };
          if (!ln || +x.w > ln.w) ln = { w: +x.w, r: +x.r };
        });
        if (!bn) return;
        const pb = best[e.e];
        if (pb && (bn.v > pb.v + 0.05 || ln.w > pb.w)) ev.push({ e: e.e, n: Calc.exName(e.e), w: ln.w > pb.w ? ln.w : bn.w, r: ln.w > pb.w ? ln.r : bn.r });
        best[e.e] = { v: Math.max(bn.v, pb ? pb.v : 0), w: Math.max(ln.w, pb ? pb.w : 0) };
      });
      out[s.id] = ev;
    });
    return out;
  }
  function weeksData(metric) {
    const mon = mondayOf(Store.today()), out = [];
    for (let i = 11; i >= 0; i--) {
      const a = Store.addDays(mon, -7 * i), b = Store.addDays(a, 6);
      const ss = sessions().filter(s => s.date >= a && s.date <= b);
      const v = metric === 'dur' ? ss.reduce((x, s) => x + durMs(s), 0) / 3600000 : metric === 'vol' ? ss.reduce((x, s) => x + Calc.sessionVolume(s), 0) : ss.reduce((x, s) => x + repsOf(s), 0);
      out.push({ l: UI.dateShort(a), v: Math.round(v * 10) / 10, ms: ss.reduce((x, s) => x + durMs(s), 0) });
    }
    return out;
  }

  /* ---------- Profilo ---------- */
  function dashBtn(act, icon, t) { return '<button class="hv-dc" data-act="' + act + '">' + ic(icon, 26) + '<span>' + t + '</span></button>'; }
  function feedCard(s, rec) {
    const exs = s.ex.filter(e => Calc.doneSets(e, true).length);
    const top = exs.slice(0, 3).map(e => '<div class="hv-fe"><span>' + Calc.doneSets(e, true).length + ' serie · ' + esc(Calc.exName(e.e)) + '</span></div>').join('');
    const more = exs.length > 3 ? '<div class="hv-more">Vedi altri ' + (exs.length - 3) + ' esercizi</div>' : '';
    const nr = (rec[s.id] || []).length;
    return '<div class="hv-card feed" role="button" tabindex="0" data-act="pal.sess" data-id="' + esc(s.id) + '"><h3>' + esc(s.name || 'Sessione') + '</h3><p class="hv-sub">' + esc(UI.dateLabel(s.date)) + '</p>' +
      '<div class="hv-stats mini"><div><small>Durata</small><b>' + (s.end ? UI.durStr(durMs(s)) : '–') + '</b></div><div><small>Volume</small><b>' + fmt(Calc.sessionVolume(s)) + ' kg</b></div><div><small>Record</small><b>🏆 ' + nr + '</b></div></div>' + top + more + '</div>';
  }
  function profiloHtml() {
    const ss = sessions(), rec = recordEvents();
    const name = (S().profile && S().profile.name) || 'Tu';
    const totMs = ss.reduce((x, s) => x + durMs(s), 0);
    const nRec = Object.keys(rec).reduce((a, k) => a + rec[k].length, 0);
    const wkd = weeksData(wk);
    let h = '<div class="hv-prof"><span class="hv-av">' + esc(name[0].toUpperCase()) + '</span><div class="grow"><h2 class="hv-h2">' + esc(name) + '</h2>' +
      '<div class="hv-3"><div><b>' + ss.length + '</b><small>Allenamenti</small></div><div><b>' + fmt(totMs / 3600000, 1) + '</b><small>Ore totali</small></div><div><b>' + nRec + '</b><small>Record</small></div></div></div></div>';
    h += bodyCard() + '<p class="hv-wk"><b>' + hoursStr(wkd[11].ms) + ' ore</b> questa settimana</p><div class="hv-chart" id="pf-chart"></div>' +
      '<div class="hv-chips">' + [['dur', 'Durata'], ['vol', 'Volume'], ['rip', 'Ripetizioni']].map(c => '<button class="chip' + (c[0] === wk ? ' on' : '') + '" data-act="pal.wk" data-v="' + c[0] + '">' + c[1] + '</button>').join('') + '</div>';
    h += '<div class="hv-sec"><h2>Dashboard</h2></div><div class="hv-dash">' + dashBtn('pal.stats', 'chart', 'Statistiche') + dashBtn('pal.exList', 'list', 'Esercizi') + dashBtn('pal.muscles', 'body', 'Muscoli') + dashBtn('pal.measures', 'ruler', 'Misure') + dashBtn('pal.cal', 'cal', 'Calendario') + dashBtn('pal.report', 'doc', 'Report mensile') + '</div>';
    h += '<div class="hv-sec"><h2>Allenamenti</h2></div>';
    if (!ss.length) return h + '<p class="hv-empty">Le sessioni terminate appaiono qui.</p>';
    const list = ss.slice().reverse();
    h += list.slice(0, feedN).map(s => feedCard(s, rec)).join('');
    if (list.length > feedN) h += '<button class="hv-wide" data-act="pal.feedMore">Mostra altri</button>';
    return h;
  }
  function profiloAfter(el) {
    const box = el.querySelector('#pf-chart'); if (!box) return;
    const d = weeksData(wk), u = wk === 'dur' ? ' h' : wk === 'vol' ? ' kg' : '';
    drawChart(box, barCfg(d.map(x => x.l), d.map(x => x.v), v => fmt(v, wk === 'dur' ? 1 : 0) + u));
  }
  P.profiloHtml = profiloHtml; P.profiloAfter = profiloAfter;
  UI.on('pal.wk', el => { wk = el.dataset.v; UI.refresh(); });
  UI.on('pal.feedMore', () => { feedN += 10; UI.refresh(); });
  UI.on('pal.report', () => advSheet('rm'));
  UI.on('pal.measures', () => { UI.closeSheets(); UI.go('altro', { sub: 'corpo' }); });

  /* ---------- dettaglio sessione ---------- */
  function sessionDetail(s) {
    const sh = UI.sheet({
      title: (s.name || 'Sessione'), cls: 'tall',
      html: '<p class="hv-sub">' + esc(UI.dateLong(s.date)) + '</p><div class="hv-stats"><div><small>Durata</small><b>' + (s.end ? UI.durStr(durMs(s)) : '–') + '</b></div><div><small>Volume</small><b>' + fmt(Calc.sessionVolume(s)) + ' kg</b></div><div><small>Serie</small><b>' + setsOf(s) + '</b></div></div>' +
        s.ex.map(e => '<div class="hv-exh">' + circle(e.e) + '<button class="hv-exn" data-ex="' + esc(e.e) + '">' + esc(Calc.exName(e.e)) + '</button></div>' + (e.note ? '<div class="hv-sug none">' + esc(e.note) + '</div>' : '') +
          '<div class="hv-tr head"><span>Serie</span><span>Kg × rip</span><span>e1RM</span></div>' +
          Calc.doneSets(e, true).map((x, i) => '<div class="hv-tr"><span>' + (x.t === 'w' ? 'R' : x.t === 'd' ? 'D' : x.t === 'f' ? 'C' : i + 1) + '</span><span>' + kgS(x.w) + ' kg × ' + x.r + (+x.rpe > 0 ? ' @' + x.rpe : '') + '</span><span>' + fmt(Calc.e1rm(x.w, x.r, x.rpe), 1) + '</span></div>').join('')).join('') +
        (s.note ? '<div class="disc mt12">' + esc(s.note) + '</div>' : '') + '<button class="hv-del" id="sd-del">Elimina sessione</button>'
    });
    sh.body.addEventListener('click', e => { const b = e.target.closest('[data-ex]'); if (b) exDetail(b.dataset.ex); });
    sh.body.querySelector('#sd-del').onclick = async () => {
      if (await UI.confirm({ title: 'Eliminare la sessione?', msg: 'Non si può annullare.', ok: 'Elimina', danger: true })) { S().sessions = S().sessions.filter(x => x.id !== s.id); Store.change(); sh.close(); UI.refresh(); }
    };
  }
  UI.on('pal.sess', el => { const s = S().sessions.find(x => x.id === el.dataset.id); if (s) sessionDetail(s); });

  /* ---------- calendario ---------- */
  function weekStreak() {
    const set = new Set(sessions().map(s => mondayOf(s.date)));
    let m = mondayOf(Store.today());
    if (!set.has(m)) m = Store.addDays(m, -7);
    let n = 0;
    while (set.has(m)) { n++; m = Store.addDays(m, -7); }
    return n;
  }
  UI.on('pal.cal', () => {
    const t = Store.parseKey(Store.today());
    let y = t.getFullYear(), mo = t.getMonth();
    const sh = UI.sheet({ title: 'Calendario', cls: 'tall' });
    function draw() {
      const days = new Set(sessions().map(s => s.date));
      const first = new Date(y, mo, 1, 12), lead = (first.getDay() + 6) % 7, nd = new Date(y, mo + 1, 0).getDate();
      const key = d => y + '-' + String(mo + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      let cells = '';
      for (let i = 0; i < lead; i++) cells += '<span></span>';
      for (let d = 1; d <= nd; d++) cells += '<span class="hv-cd' + (days.has(key(d)) ? ' on' : '') + (key(d) === Store.today() ? ' today' : '') + '">' + d + '</span>';
      const n = [...days].filter(k => k.slice(0, 7) === key(1).slice(0, 7)).length, st = weekStreak();
      sh.set('<div class="hv-calh"><button class="icon-btn" data-c="-1" aria-label="Mese prima">' + UI.icon('left', 22) + '</button><b>' + MESI_L[mo] + ' ' + y + '</b><button class="icon-btn" data-c="1" aria-label="Mese dopo">' + UI.icon('right', 22) + '</button></div>' +
        '<div class="hv-calg head">' + ['L', 'M', 'M', 'G', 'V', 'S', 'D'].map(x => '<span>' + x + '</span>').join('') + '</div><div class="hv-calg">' + cells + '</div>' +
        '<div class="hv-stats"><div><small>Giorni allenati</small><b>' + n + '</b></div><div><small>Settimane di fila</small><b>' + st + '</b></div></div>');
    }
    draw();
    sh.body.addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (!b) return; mo += +b.dataset.c; if (mo < 0) { mo = 11; y--; } if (mo > 11) { mo = 0; y++; } draw(); });
  });

  /* ---------- figure del corpo (BodyMap) e conteggio serie ---------- */
  const MG_ORDER = Object.keys(D.MUSCLES).sort((a, b) => D.MUSCLES[a].localeCompare(D.MUSCLES[b], 'it'));
  const MESI_S = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  const durFmt = ms => { const m = Math.round(ms / 60000); return m < 60 ? m + 'min' : Math.floor(m / 60) + 'h ' + (m % 60) + 'min'; };
  /* serie per muscolo tra due date (incluse). Riscaldamento escluso. Primario = 1, secondari = 0,5 per serie. total = serie vere. */
  function setsIn(from, to) {
    const m = {}; let total = 0;
    sessions().forEach(s => {
      if (s.date < from || s.date > to) return;
      s.ex.forEach(e => {
        const ex = Calc.exById(e.e); if (!ex) return;
        const n = Calc.doneSets(e).length; if (!n) return;
        total += n; m[ex.mg] = (m[ex.mg] || 0) + n;
        (ex.sec || []).forEach(sc => { m[sc] = (m[sc] || 0) + n * 0.5; });
      });
    });
    return { m, total };
  }
  const figures = (ms, size) => '<div class="hv-figs">' + BodyMap.svg({ values: ms, size: size || 120 }) + '</div>' +
    '<div class="hv-leg"><span>Meno</span><i style="background:#3A3A3C"></i><i style="background:rgba(59,130,246,.4)"></i><i style="background:rgba(59,130,246,.7)"></i><i style="background:#3B82F6"></i><span>Più</span></div>';
  const rangeMs = (from, to) => setsIn(from, to).m;
  const trainedDays = () => new Set(sessions().map(s => s.date));

  /* corpo cliccabile in cima al Profilo: ultimi 7 giorni */
  function bodyCard() {
    const to = Store.today(), ms = setsIn(Store.addDays(to, -6), to).m;
    return '<button class="hv-bodyc" data-act="pal.muscles" aria-label="Apri i muscoli allenati"><span class="hv-bodyt"><b>Muscoli allenati</b><small>Ultimi 7 giorni</small><em>Tocca per i dettagli</em></span>' + BodyMap.svg({ values: ms, size: 64 }) + '</button>';
  }

  /* ---------- schermata Muscoli: giorno / settimana ---------- */
  function musclesOpen(anchor0, mode0) {
    const today = Store.today();
    let mode = mode0 || 'week', anchor = anchor0 || today, sel = null;
    const sh = UI.sheet({ title: 'Distribuzione del corpo', cls: 'tall' });
    const wkStart = () => mondayOf(anchor);
    function title() {
      if (mode === 'day') return UI.dateLong(anchor);
      const a = Store.parseKey(wkStart()), b = Store.parseKey(Store.addDays(wkStart(), 6));
      return a.getMonth() === b.getMonth() ? a.getDate() + '–' + b.getDate() + ' ' + MESI_L[b.getMonth()].toLowerCase() + ' ' + b.getFullYear()
        : a.getDate() + ' ' + MESI_S[a.getMonth()] + ' – ' + b.getDate() + ' ' + MESI_S[b.getMonth()] + ' ' + b.getFullYear();
    }
    function draw() {
      const td = trainedDays();
      let from, to;
      if (mode === 'day') { from = to = anchor; } else if (sel) { from = to = sel; } else { from = wkStart(); to = Store.addDays(from, 6); }
      const r = setsIn(from, to);
      let chips = '';
      if (mode === 'week') {
        chips = '<div class="hv-days">' + [0, 1, 2, 3, 4, 5, 6].map(i => {
          const d = Store.addDays(wkStart(), i), dt = Store.parseKey(d);
          return '<button class="hv-day' + (sel === d ? ' on' : '') + '" data-d="' + d + '" aria-label="' + esc(UI.dateLabel(d)) + '"><small>' + LET[dt.getDay()] + '</small><b>' + dt.getDate() + '</b>' + (td.has(d) ? '<i></i>' : '') + '</button>';
        }).join('') + '</div>';
      }
      const rows = MG_ORDER.map(k => '<div class="hv-mrow"><span>' + esc(D.MUSCLES[k]) + '</span><b>' + UI.fmtA(r.m[k] || 0, 1) + '</b></div>').join('');
      sh.set('<div class="hv-mtop">' + UI.seg([['day', 'Giorno'], ['week', 'Settimana']], mode, 'noop') + '</div>' +
        '<div class="hv-calh"><button class="icon-btn" data-nav="-1" aria-label="Indietro">' + UI.icon('left', 22) + '</button><b>' + esc(title()) + '</b><button class="icon-btn" data-nav="1" aria-label="Avanti">' + UI.icon('right', 22) + '</button></div>' +
        chips + figures(r.m, 130) +
        '<div class="hv-mh"><span>Muscolo</span><span>Serie</span></div><div class="hv-mrow tot"><span>Totale</span><b>' + r.total + '</b></div>' + rows +
        '<p class="hv-sub">Ogni serie conta 1 per il muscolo principale e mezza per i secondari. Il riscaldamento non conta. «Totale» = serie fatte.</p>');
    }
    draw();
    sh.body.addEventListener('click', e => {
      const m = e.target.closest('.seg button');
      if (m) { mode = m.textContent === 'Giorno' ? 'day' : 'week'; sel = null; draw(); return; }
      const n = e.target.closest('[data-nav]');
      if (n) { anchor = Store.addDays(anchor, +n.dataset.nav * (mode === 'day' ? 1 : 7)); sel = null; draw(); return; }
      const d = e.target.closest('[data-d]');
      if (d) { sel = sel === d.dataset.d ? null : d.dataset.d; draw(); }
    });
  }
  P.musclesOpen = musclesOpen;
  UI.on('pal.muscles', () => musclesOpen());

  /* ---------- Statistiche: corpo ultimi 7 giorni + elenco ---------- */
  UI.on('pal.stats', () => {
    const today = Store.today();
    let sel = null;
    const sh = UI.sheet({ title: 'Statistiche', cls: 'tall' });
    const days = [6, 5, 4, 3, 2, 1, 0].map(i => Store.addDays(today, -i));
    const adv = [
      ['sg', 'chart', 'Serie per gruppo muscolare', 'Numero di serie registrate per ogni gruppo muscolare.'],
      ['rd', 'radar', 'Distribuzione dei muscoli (grafico)', 'Confronta il periodo attuale con il precedente.'],
      ['bd', 'body', 'Distribuzione del corpo', 'Muscoli allenati per giorno e per settimana.'],
      ['tp', 'list', 'Esercizi principali', 'Elenco degli esercizi che pratichi più spesso.'],
      ['rc', 'medal', 'Record', 'I tuoi record attuali.'],
      ['rm', 'doc', 'Report mensile', 'Riepilogo di allenamenti e statistiche mensili.']
    ];
    sh.set('<h2 class="hv-h2 s">Grafico del corpo negli ultimi 7 giorni</h2><div class="hv-days" id="st-days"></div><div id="st-fig"></div>' +
      '<div class="hv-band">Statistiche avanzate</div>' + adv.map(a => '<button class="hv-li" data-k="' + a[0] + '">' + ic(a[1], 26) + '<span class="hv-lt"><b>' + a[2] + '</b><small>' + a[3] + '</small></span>' + UI.icon('right', 16) + '</button>').join(''));
    function draw() {
      sh.body.querySelector('#st-days').innerHTML = days.map(d => { const dt = Store.parseKey(d); return '<button class="hv-day' + (sel === d ? ' on' : '') + '" data-d="' + d + '" aria-label="' + esc(UI.dateLabel(d)) + '"><small>' + LET[dt.getDay()] + '</small><b>' + dt.getDate() + '</b>' + (d === today ? '<i></i>' : '') + '</button>'; }).join('');
      sh.body.querySelector('#st-fig').innerHTML = figures(sel ? rangeMs(sel, sel) : rangeMs(days[0], today), 120);
    }
    draw();
    sh.body.addEventListener('click', e => {
      const d = e.target.closest('[data-d]');
      if (d) { sel = sel === d.dataset.d ? null : d.dataset.d; draw(); return; }
      const k = e.target.closest('[data-k]'); if (k) advSheet(k.dataset.k);
    });
  });

  /* ragnatela SVG a 6 assi */
  const AXES = [['Schiena', ['dorso']], ['Petto', ['petto']], ['Addome', ['addome']], ['Spalle', ['spalle']], ['Braccia', ['bicipiti', 'tricipiti', 'avambracci']], ['Gambe', ['quadricipiti', 'femorali', 'glutei', 'polpacci']]];
  const axVals = m => AXES.map(a => a[1].reduce((x, k) => x + (m[k] || 0), 0));
  function radarSvg(cur, prev) {
    const cx = 160, cy = 150, R = 100, mx = Math.max(1, ...cur, ...prev);
    const ang = i => (-120 + 60 * i) * Math.PI / 180;
    const pt = (i, r) => (cx + r * Math.cos(ang(i))).toFixed(1) + ',' + (cy + r * Math.sin(ang(i))).toFixed(1);
    let g = '';
    for (let k = 1; k <= 6; k++) g += '<polygon points="' + AXES.map((_, i) => pt(i, R * k / 6)).join(' ') + '" fill="none" stroke="#2C2C2E" stroke-width="1"/>';
    AXES.forEach((_, i) => { g += '<line x1="' + cx + '" y1="' + cy + '" x2="' + pt(i, R).split(',')[0] + '" y2="' + pt(i, R).split(',')[1] + '" stroke="#2C2C2E"/>'; });
    const poly = (vals, fill, stroke) => '<polygon points="' + vals.map((v, i) => pt(i, R * v / mx)).join(' ') + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="2" stroke-linejoin="round"/>';
    g += poly(prev, 'rgba(142,142,147,.2)', '#8E8E93') + poly(cur, 'rgba(59,130,246,.35)', '#3B82F6');
    const lab = AXES.map((a, i) => { const p = pt(i, R + 24).split(','); const c = Math.cos(ang(i)); return '<text x="' + p[0] + '" y="' + (+p[1] + 4) + '" text-anchor="' + (Math.abs(c) < 0.3 ? 'middle' : c > 0 ? 'start' : 'end') + '" fill="#8E8E93" font-size="13">' + a[0] + '</text>'; }).join('');
    return '<svg class="hv-radar" viewBox="-30 0 380 300" role="img" aria-label="Distribuzione dei muscoli">' + g + lab + '</svg>' +
      '<div class="hv-rleg"><span><i style="background:#3B82F6"></i>Attuale</span><span><i style="background:#8E8E93"></i>Precedente</span></div>';
  }
  const box4 = (t, v, pv) => '<div class="hv-b4"><span>' + t + '</span><b>' + v + '</b><small>→ ' + pv + '</small></div>';
  function periodStats(from, to) {
    const ss = sessions().filter(s => s.date >= from && s.date <= to);
    return { n: ss.length, ms: ss.reduce((x, s) => x + durMs(s), 0), vol: ss.reduce((x, s) => x + Calc.sessionVolume(s), 0), sets: ss.reduce((x, s) => x + setsOf(s), 0) };
  }

  function advSheet(k) {
    const today = Store.today();
    if (k === 'bd') return musclesOpen();
    const T = { sg: 'Serie per gruppo muscolare', rd: 'Distribuzione dei muscoli', tp: 'Esercizi principali', rc: 'Record', rm: 'Report di ' };
    const sh = UI.sheet({ title: T[k], cls: 'tall' });
    sh.body.addEventListener('click', e => { const b = e.target.closest('[data-ex]'); if (b) exDetail(b.dataset.ex); });
    if (k === 'sg') {
      let per = 7;
      const draw = () => {
        const ms = rangeMs(Store.addDays(today, -per + 1), today);
        const keys = Object.keys(ms).sort((a, b) => ms[b] - ms[a]), mx = keys.length ? ms[keys[0]] : 1;
        sh.set('<div class="hv-chips">' + [7, 30, 90].map(p => '<button class="chip' + (p === per ? ' on' : '') + '" data-p="' + p + '">' + p + ' giorni</button>').join('') + '</div>' +
          (keys.length ? keys.map(m => '<div class="hv-hb"><div class="hv-hbt"><span>' + esc(D.MUSCLES[m] || m) + '</span><b>' + UI.fmtA(ms[m], 1) + '</b></div><div class="hv-hbr"><i style="width:' + Math.max(3, ms[m] / mx * 100).toFixed(0) + '%"></i></div></div>').join('') + '<p class="hv-sub">I muscoli secondari contano mezza serie.</p>' : '<p class="hv-empty">Nessuna serie in questo periodo.</p>'));
      };
      draw();
      sh.body.addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (b) { per = +b.dataset.p; draw(); } });
    } else if (k === 'rd') {
      let per = 30;
      const draw = () => {
        const a = Store.addDays(today, -per + 1), b = Store.addDays(today, -2 * per + 1), bb = Store.addDays(today, -per);
        const cur = axVals(rangeMs(a, today)), prev = axVals(rangeMs(b, bb));
        const c = periodStats(a, today), p = periodStats(b, bb);
        sh.set('<button class="hv-sel" data-per="1">Ultimi ' + per + ' giorni ' + UI.icon('down', 18) + '</button>' + radarSvg(cur, prev) +
          '<div class="hv-grid4">' + box4('Allenamenti', c.n, p.n) + box4('Durata', durFmt(c.ms), durFmt(p.ms)) + box4('Volume', fmt(c.vol) + ' kg', fmt(p.vol) + ' kg') + box4('Serie', c.sets, p.sets) + '</div>');
      };
      draw();
      sh.body.addEventListener('click', e => {
        if (!e.target.closest('[data-per]')) return;
        P.menu('Periodo', [7, 30, 90].map(n => ({ t: 'Ultimi ' + n + ' giorni', a: () => { per = n; draw(); } })));
      });
    } else if (k === 'tp') {
      const m = {};
      sessions().forEach(s => s.ex.forEach(e => { const n = Calc.doneSets(e, true).length; if (!n) return; const o = m[e.e] || (m[e.e] = { s: 0, n: 0 }); o.s++; o.n += n; }));
      const ks = Object.keys(m).sort((a, b) => m[b].s - m[a].s || m[b].n - m[a].n).slice(0, 15);
      sh.set(ks.length ? ks.map((id, i) => '<button class="hv-li" data-ex="' + esc(id) + '"><b class="hv-rank">' + (i + 1) + '</b><span class="hv-lt"><b>' + esc(Calc.exName(id)) + '</b><small>' + m[id].s + (m[id].s === 1 ? ' sessione' : ' sessioni') + ' · ' + m[id].n + ' serie</small></span>' + UI.icon('right', 16) + '</button>').join('') : '<p class="hv-empty">Ancora nessun esercizio fatto.</p>');
    } else if (k === 'rc') {
      const rec = Calc.records();
      sh.set(rec.length ? rec.map(r => '<button class="hv-li" data-ex="' + esc(r.id) + '"><span class="hv-lt"><b>' + esc(r.n) + '</b><small>Miglior carico: ' + kgS(r.load.w) + ' kg × ' + r.load.r + ' (' + UI.dateShort(r.load.date) + ')</small></span><span class="hv-rv"><b>' + fmt(r.e1.v, 1) + '</b><small>e1RM kg</small></span></button>').join('') + '<p class="hv-sub mt12">e1RM = carico massimo stimato (formula di Epley, con RPE se presente).</p>' : '<p class="hv-empty">I record compaiono dopo le prime sessioni.</p>');
    } else if (k === 'rm') {
      const t = Store.parseKey(today);
      let y = t.getFullYear(), mo = t.getMonth(), metric = 'n';
      const MET = [['n', 'Allenamenti'], ['ms', 'Durata'], ['vol', 'Volume'], ['sets', 'Serie']];
      const mk = (yy, mm) => yy + '-' + String(mm + 1).padStart(2, '0');
      const mst = (yy, mm) => periodStats(mk(yy, mm) + '-01', mk(yy, mm) + '-31');
      const prevOf = (yy, mm) => mm === 0 ? [yy - 1, 11] : [yy, mm - 1];
      const val = (st, m) => m === 'ms' ? durFmt(st.ms) : m === 'vol' ? fmt(st.vol) + ' kg' : st[m];
      const draw = () => {
        const [py, pm] = prevOf(y, mo), cur = mst(y, mo), pre = mst(py, pm);
        const bars = [];
        for (let i = 11; i >= 0; i--) { let yy = y, mm = mo - i; while (mm < 0) { mm += 12; yy--; } const st = mst(yy, mm); bars.push({ l: MESI_L[mm][0], v: metric === 'ms' ? Math.round(st.ms / 6000) / 10 : st[metric] }); }
        sh.title('Report di ' + MESI_L[mo]);
        sh.set('<div class="hv-calh"><button class="icon-btn" data-m="-1" aria-label="Mese prima">' + UI.icon('left', 22) + '</button><span></span><button class="icon-btn" data-m="1" aria-label="Mese dopo">' + UI.icon('right', 22) + '</button></div>' +
          '<h2 class="hv-h2 big">' + MESI_L[mo] + ' ' + y + '</h2><p class="hv-rv2"><b>' + val(cur, metric) + '</b> <span>→ ' + val(pre, metric) + '</span></p>' +
          '<div class="hv-chart" id="rm-c"></div><div class="hv-chips nowrap">' + MET.map(c => '<button class="chip' + (c[0] === metric ? ' on' : '') + '" data-met="' + c[0] + '">' + c[1] + '</button>').join('') + '</div>' +
          '<div class="hv-band">Sommario</div><div class="hv-grid4 pt">' + box4('Allenamenti', cur.n, pre.n) + box4('Durata', durFmt(cur.ms), durFmt(pre.ms)) + box4('Volume', fmt(cur.vol) + ' kg', fmt(pre.vol) + ' kg') + box4('Serie', cur.sets, pre.sets) + '</div>' +
          '<div class="hv-band">Registro dei giorni di allenamento</div>' + calGrid(y, mo));
        drawChart(sh.body.querySelector('#rm-c'), (() => {
          const c = barCfg(bars.map(b => b.l), bars.map(b => b.v), v => fmt(v, metric === 'ms' ? 1 : 0) + (metric === 'ms' ? ' min' : metric === 'vol' ? ' kg' : ''));
          c.data.datasets[0].backgroundColor = bars.map((_, i) => i === 11 ? '#3B82F6' : 'rgba(59,130,246,.45)');
          return c;
        })());
      };
      draw();
      sh.body.addEventListener('click', e => {
        const b = e.target.closest('[data-m]'); if (b) { mo += +b.dataset.m; if (mo < 0) { mo = 11; y--; } if (mo > 11) { mo = 0; y++; } draw(); return; }
        const c = e.target.closest('[data-met]'); if (c) { metric = c.dataset.met; draw(); }
      });
    }
  }
  /* calendario del mese: giorni allenati in blu */
  function calGrid(y, mo) {
    const days = trainedDays();
    const first = new Date(y, mo, 1, 12), lead = (first.getDay() + 6) % 7, nd = new Date(y, mo + 1, 0).getDate();
    const key = d => y + '-' + String(mo + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<span></span>';
    for (let d = 1; d <= nd; d++) cells += '<span class="hv-cd' + (days.has(key(d)) ? ' on' : '') + (key(d) === Store.today() ? ' today' : '') + '">' + d + '</span>';
    return '<div class="hv-calg head">' + ['L', 'M', 'M', 'G', 'V', 'S', 'D'].map(x => '<span>' + x + '</span>').join('') + '</div><div class="hv-calg">' + cells + '</div>';
  }

  /* ---------- Esercizi ---------- */
  function exListHtml() {
    const toks = Calc.norm(P.exq).split(/\s+/).filter(Boolean);
    let list = Calc.allExercises().filter(e => P.exMg === 'tutti' || e.mg === P.exMg);
    if (toks.length) list = list.filter(e => { const n = Calc.norm(e.n); return toks.every(t => n.indexOf(t) >= 0); });
    if (!list.length) return UI.empty('Nessun esercizio trovato.');
    return '<div class="list">' + list.map(e => '<button class="li" data-act="pal.exInfo" data-id="' + esc(e.id) + '">' + circle(e.id) + '<div class="li-main"><div class="li-t">' + esc(e.n) + (e.id.indexOf('x_') === 0 ? ' ' + UI.badge('mio') : '') + '</div><div class="li-s">' + esc(D.MUSCLES[e.mg] || '') + ' · ' + esc(D.EQUIP[e.eq] || '') + '</div></div>' + UI.icon('right', 16) + '</button>').join('') + '</div>';
  }
  UI.on('pal.exList', () => {
    const mgs = [['tutti', 'Tutti']].concat(Object.keys(D.MUSCLES).map(k => [k, D.MUSCLES[k]]));
    const sh = UI.sheet({ title: 'Esercizi', cls: 'tall' });
    function draw() {
      sh.set('<input class="inp" type="search" placeholder="Cerca esercizio…" data-in="pal.exq" value="' + esc(P.exq) + '" style="margin-bottom:10px"><div class="chips scroll mb8" id="xl-mg">' +
        mgs.map(m => '<button class="chip sm' + (m[0] === P.exMg ? ' on' : '') + '" data-m="' + m[0] + '">' + m[1] + '</button>').join('') + '</div>' +
        '<button class="hv-go big" data-act="pal.newEx">＋ Esercizio mio</button><div id="pal-exlist">' + exListHtml() + '</div>');
    }
    draw();
    sh.body.addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) { P.exMg = b.dataset.m; draw(); } });
  });
  UI.on('pal.newEx', () => P.exerciseForm(null, () => { const l = document.getElementById('pal-exlist'); if (l) l.innerHTML = exListHtml(); }));
  UI.onInput('pal.exq', el => { P.exq = el.value; const l = document.getElementById('pal-exlist'); if (l) l.innerHTML = exListHtml(); });
  UI.on('pal.exInfo', el => exDetail(el.dataset.id));

  /* ---------- dettaglio esercizio ---------- */
  function exDetail(id) {
    const e = Calc.exById(id); if (!e) return;
    const mine = id.indexOf('x_') === 0;
    const hist = Calc.exerciseHistory(id);
    const per = hist.map(h => ({ d: h.s.date, maxW: Math.max.apply(null, h.sets.map(x => +x.w)), e1: Math.max.apply(null, h.sets.map(x => Calc.e1rm(x.w, x.r, x.rpe))), vol: h.sets.reduce((a, x) => a + (+x.w) * (+x.r), 0), sets: h.sets }));
    const sh = UI.sheet({ title: e.n, cls: 'tall' });
    let tab = 'sum', metric = 'maxW';
    const CH = [['maxW', 'Peso massimo'], ['e1', 'Singola ripetizione massima']];
    const hasPhoto = () => { const m = P.mediaHtml(id); return m.indexOf('<img') >= 0 && m.indexOf('ex-media art') < 0; }; /* col disegno i muscoli sono già nel riquadro */
    function drawChartBox() {
      const box = sh.body.querySelector('#ed-chart'); if (!box) return;
      if (!per.length) { if (box._ch) { box._ch.destroy(); box._ch = null; } box.innerHTML = '<div class="hv-nodata">' + ic('bars', 56) + '<span>Non ci sono ancora dati</span></div>'; return; }
      const pts = per.slice(-20);
      drawChart(box, {
        type: 'line',
        data: { labels: pts.map(p => UI.dateShort(p.d)), datasets: [{ data: pts.map(p => Math.round(p[metric] * 10) / 10), borderColor: '#3B82F6', backgroundColor: 'rgba(59,130,246,.2)', fill: true, tension: .25, pointRadius: 3, pointBackgroundColor: '#3B82F6' }] },
        options: { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: '#8E8E93', maxRotation: 0, autoSkip: true } }, y: { grid: { color: '#2C2C2E' }, ticks: { color: '#8E8E93', maxTicksLimit: 5 }, border: { display: false } } } }
      });
    }
    const sec = e.sec && e.sec.length ? e.sec.map(s => D.MUSCLES[s]).filter(Boolean).join(', ') : '–';
    const names = '<p class="hv-sub" style="margin-bottom:4px">Primario: ' + esc(D.MUSCLES[e.mg] || '–') + '</p><p class="hv-sub" style="margin-bottom:4px">Secondario: ' + esc(sec) + '</p><p class="hv-sub">Attrezzo: ' + esc(D.EQUIP[e.eq] || '–') + '</p>';
    function draw() {
      let h = UI.seg([['sum', 'Sommario'], ['his', 'Cronologia'], ['ist', 'Istruzioni']], tab, 'noop');
      if (tab === 'sum') {
        let bs = null, bv = null;
        hist.forEach(x => x.sets.forEach(s => { const v = (+s.w) * (+s.r); if (!bs || v > bs.v) bs = { v, w: +s.w, r: +s.r }; }));
        per.forEach(p => { if (bv === null || p.vol > bv) bv = p.vol; });
        const b = Calc.bestOf(id);
        h += P.mediaHtml(id) + '<h2 class="hv-h2">' + esc(e.n) + '</h2><div class="hv-exinfo"><div class="grow">' + names + '</div>' + (hasPhoto() ? BodyMap.svg({ primary: [e.mg], secondary: e.sec || [], size: 44 }) : '') + '</div>' +
          '<div class="hv-chart" id="ed-chart"></div><div class="hv-chips nowrap">' + CH.map(c => '<button class="chip' + (c[0] === metric ? ' on' : '') + '" data-m="' + c[0] + '">' + c[1] + '</button>').join('') + '</div>' +
          '<div class="hv-sec"><h2 class="mut">' + ic('medal', 22) + ' Record personali</h2></div>' +
          '<div class="hv-fe big"><span>Peso massimo</span><b>' + (b.e1 ? kgS(b.load.w) + ' kg × ' + b.load.r : '-') + '</b></div><div class="hv-fe big"><span>Miglior 1RM</span><b>' + (b.e1 ? fmt(b.e1.v, 1) + ' kg' : '-') + '</b></div><div class="hv-fe big"><span>Miglior volume del set</span><b>' + (bs ? kgS(bs.w) + ' kg × ' + bs.r : '-') + '</b></div><div class="hv-fe big"><span>Miglior volume della sessione</span><b>' + (bv === null ? '-' : fmt(bv) + ' kg') + '</b></div>';
        if (mine) h += '<button class="hv-wide mt12" data-ed="1">Modifica esercizio</button>';
      } else if (tab === 'his') {
        h += per.length ? per.slice().reverse().map(p => '<div class="hv-hs"><b>' + esc(UI.dateLabel(p.d)) + '</b>' + p.sets.map((s, i) => '<div class="hv-tr"><span>' + (i + 1) + '</span><span>' + kgS(s.w) + ' kg × ' + s.r + (+s.rpe > 0 ? ' @' + s.rpe : '') + '</span><span></span></div>').join('') + '</div>').join('') : '<p class="hv-empty">Nessuna sessione con questo esercizio.</p>';
        if (mine) h += '<button class="hv-wide" data-ed="1">Modifica esercizio</button>';
      } else {
        const steps = Array.isArray(e.steps) && e.steps.length ? '<ol class="hv-steps">' + e.steps.map(s => '<li>' + esc(s) + '</li>').join('') + '</ol>'
          : '<p class="hv-sub">Scegli un carico che ti permette di controllare tutto il movimento. Fai le ripetizioni con tecnica pulita, senza slanci, e recupera tra una serie e l’altra.</p>';
        h += P.mediaHtml(id) + '<h2 class="hv-h2">' + esc(e.n) + '</h2>' + names + steps;
      }
      sh.set(h);
      if (tab === 'sum') drawChartBox();
    }
    draw();
    sh.body.addEventListener('click', ev => {
      const s = ev.target.closest('.seg button');
      if (s) { tab = { Sommario: 'sum', Cronologia: 'his', Istruzioni: 'ist' }[s.textContent] || 'sum'; draw(); return; }
      const m = ev.target.closest('[data-m]'); if (m) { metric = m.dataset.m; draw(); return; }
      if (ev.target.closest('[data-ed]')) P.exerciseForm(e);
    });
  }
  P.exDetail = exDetail; P.sessionDetail = sessionDetail;
  UI.on('noop', () => { });
})();
