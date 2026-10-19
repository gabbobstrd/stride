/* Compagno - scheda Oggi */
(function () {
  'use strict';
  const esc = UI.esc, fmt = UI.fmt, S = () => Store.s;
  const O = { date: Store.today() };

  function pctColor(p) { return p < 0.7 ? 'var(--bad)' : (p < 1 ? 'var(--warn)' : 'var(--ok)'); }

  /* ---------- barre dei nutrienti ---------- */
  function macroCard(tg, dt) {
    const T = dt.tot;
    const left = tg.kcal - T.kcal;
    const right = !dt.hasData && !dt.missing ? '' : (left >= 0 ? 'mancano <b style="color:var(--acc)">' + fmt(left) + '</b> kcal' : 'oltre di <b style="color:var(--warn)">' + fmt(-left) + '</b> kcal');
    const partial = k => (dt.hasData && dt.cov[k] < 1 ? (dt.cov[k] <= 0 ? 'n.d. negli alimenti registrati' : 'dati parziali') : '');
    let h = UI.bar('Kcal', T.kcal, tg.kcal, 'var(--acc)', { sub: partial('kcal') });
    h += UI.bar('Proteine', T.prot, tg.prot, 'var(--prot)', { unit: 'g', sub: partial('prot') });
    h += UI.bar('Carboidrati', T.carb, tg.carb, 'var(--carb)', { unit: 'g', sub: partial('carb') });
    h += UI.bar('Grassi', T.fat, tg.fat, 'var(--fat)', { unit: 'g', sub: partial('fat') });
    const fibVal = dt.hasData && dt.cov.fib <= 0 ? null : (T.fib || 0);
    h += UI.bar('Fibre', fibVal, tg.fib, 'var(--ok)', { unit: 'g', sub: partial('fib') && fibVal !== null ? 'dati parziali' : '' });
    return UI.card('Nutrienti', h, { right });
  }

  /* ---------- micronutrienti ---------- */
  function microCard(tg, dt, date) {
    let body;
    if (!dt.hasData) body = UI.empty('Registra qualcosa nel Cibo per vedere i micronutrienti.');
    else {
      const low = Calc.lowestMicros(date, 6);
      if (!low.length) body = UI.empty('Nessun dato sui micronutrienti negli alimenti registrati (n.d.).');
      else {
        let anySupp = false;
        body = low.map(r => {
          const m = D.NMAP[r.k];
          const sub = fmt(r.v, m.d) + ' / ' + fmt(r.t, m.d) + ' ' + m.u + (r.cov < 1 ? ' · dati parziali' : '');
          const warn = r.ul && r.v > r.ul ? 'sopra il limite massimo tollerabile' : '';
          if (r.s > 0) { anySupp = true; return UI.barStack(m.n, r.fv, r.s, r.t, pctColor(r.pct), { pct: r.pct * 100, sub, warn }); }
          return UI.bar(m.n, r.pct * 100, 100, pctColor(r.pct), { unit: '%', sub: sub + (warn ? ' · ' + warn : '') });
        }).join('');
        const over = Calc.microReport(dt.tot, dt.cov, tg, dt.supp).filter(r => r.ul && r.v > r.ul && low.every(l => l.k !== r.k));
        if (over.length) body += '<div class="tip warn mt8"><span class="dot"></span><div>' + over.map(r => esc(D.NMAP[r.k].n)).join(', ') + ': sopra il limite massimo tollerabile.</div></div>';
        if (anySupp) body += '<div class="legend"><i class="lf">▮</i> cibo &nbsp; <i class="ls">▮</i> integratore</div>';
      }
    }
    return UI.card('Micronutrienti più bassi', body, { right: dt.hasData ? '<button class="link" data-act="oggi.micros">Tutti</button>' : '' });
  }
  function allSheet(date) {
    const tg = Calc.targets(date), dt = Calc.dayTotals(date);
    const rep = {};
    Calc.microReport(dt.tot, dt.cov, tg).forEach(r => { rep[r.k] = r; });
    const row = (k, lim) => {
      const m = D.NMAP[k];
      const v = dt.tot[k], cov = dt.cov[k];
      const known = v != null && cov > 0;
      let t = tg[k];
      let right, cls = '';
      if (!known) right = '<span class="mut">n.d.</span>';
      else {
        right = '<b>' + fmt(v, m.d) + '</b> ' + m.u;
        if (t) right += '<small>' + (lim ? 'limite ' : 'obiettivo ') + fmt(t, m.d) + ' · ' + Math.round(v / t * 100) + '%</small>';
        else right += '';
      }
      if (known && t && ((lim && v > t) || (rep[k] && rep[k].ul && v > rep[k].ul))) cls = ' bad';
      let sub = '';
      if (known && cov < 1) sub = 'dati parziali';
      if (known && dt.supp[k] > 0) sub = (sub ? sub + ' · ' : '') + 'di cui integratori ' + fmt(dt.supp[k], m.d) + ' ' + m.u;
      if (known && rep[k] && rep[k].ul && v > rep[k].ul) sub = 'sopra il limite massimo tollerabile (' + fmt(rep[k].ul, m.d) + ' ' + m.u + ')';
      return '<div class="li"><span class="dot" style="background:' + (t && known ? (lim ? (v > t ? 'var(--bad)' : 'var(--ok)') : pctColor(v / t)) : '#3a4656') + '"></span><div class="li-main"><div class="li-t">' + esc(m.n) + '</div>' + (sub ? '<div class="li-s' + (cls ? ' bad' : '') + '">' + sub + '</div>' : '') + '</div><div class="li-r' + cls + '">' + right + '</div></div>';
    };
    const lim = { fib: 0, sfa: 1, sug: 1, na: 1, chol: 1 };
    let h = '<div class="disc mb8">Valori in base agli alimenti registrati. «n.d.» = dato non presente nell\'alimento (non è zero). Obiettivi: LARN 2014, EFSA.</div>';
    h += '<div class="sec-t" style="margin-top:6px">Macro e grassi</div><div class="list">' + ['fib', 'sug', 'sfa', 'mufa', 'pufa', 'o3', 'epadha', 'chol', 'na'].map(k => row(k, lim[k])).join('') + '</div>';
    h += '<div class="sec-t">Vitamine</div><div class="list">' + D.NUTR.filter(n => n.g === 'vit').map(n => row(n.k, false)).join('') + '</div>';
    h += '<div class="sec-t">Minerali</div><div class="list">' + ['ca', 'p', 'mg', 'k', 'fe', 'zn', 'cu', 'mn', 'se'].map(k => row(k, false)).join('') + '</div>';
    h += '<div class="sec-t">Altro</div><div class="list">' + ['caff', 'alc'].map(k => row(k, false)).join('') + '</div>';
    UI.sheet({ title: 'Tutti i nutrienti · ' + UI.dateLabel(date), cls: 'tall', html: h });
  }

  /* ---------- acqua, passi ---------- */
  function waterCard(date, tg) {
    const day = Store.getDay(date);
    const goal = Calc.waterGoal(date);
    const w = day.water || 0;
    const hrs = Calc.trainHours(date);
    const ref = S().profile.sex === 'F' ? 2.0 : 2.5;
    return UI.card('Acqua',
      '<div class="row between" style="align-items:baseline;margin-bottom:8px"><div class="big">' + fmt(w) + ' <small>ml</small></div><div class="small mut">obiettivo ' + fmt(goal) + ' ml</div></div>' +
      UI.bar('Bevande', w, goal, 'var(--water)', { unit: 'ml' }) +
      '<div class="row gap6 mt8"><button class="btn sm grow" data-act="oggi.water" data-v="150">+150</button><button class="btn sm grow" data-act="oggi.water" data-v="250">+250</button><button class="btn sm grow" data-act="oggi.water" data-v="500">+500</button><button class="btn sm ghost" data-act="oggi.water" data-v="-250">−250</button></div>' +
      '<p class="xs mut mt8">35 ml × kg × 0,8' + (hrs > 0 ? ' + 500 ml per ogni ora di allenamento (' + fmt(hrs, 1) + ' h)' : ' + 500 ml per ogni ora di allenamento') + '. Riferimento EFSA: acqua totale ' + fmt(ref, 1) + ' L al giorno (comprende cibo e bevande).</p>',
      { right: '' });
  }
  function stepsCard(date) {
    const st = Store.getDay(date).steps || 0;
    return UI.card('Passi',
      '<div class="row between"><div class="big">' + fmt(st) + '</div><button class="btn sm" data-act="oggi.readSteps">Leggi da Salute</button></div>' +
      '<div class="row gap mt8"><input class="inp" inputmode="numeric" placeholder="Inserisci a mano" id="og-steps" data-ch="oggi.stepsIn" value="' + (st ? st : '') + '"></div>');
  }

  /* ---------- allenamento ---------- */
  function workoutCard(date) {
    const a = S().activeSession;
    const done = S().sessions.filter(s => s.date === date);
    let body;
    if (a) {
      body = '<div class="li-t">Sessione in corso</div><div class="li-s">' + esc(a.name || 'Sessione libera') + ' · iniziata alle ' + UI.timeStr(a.start) + '</div><button class="btn primary block mt12" data-act="oggi.goTrain">Continua</button>';
    } else {
      const nx = window.Pal ? Pal.nextDay() : null;
      if (nx) {
        body = '<div class="row between"><div class="li-main"><div class="li-t">' + esc(nx.day.n) + '</div><div class="li-s">' + esc(nx.prog.n) + ' · ' + nx.day.ex.length + ' esercizi</div></div><button class="btn primary" data-act="oggi.startNext">Inizia</button></div>';
      } else body = '<div class="li-s mb8">Nessuna scheda attiva.</div><button class="btn block" data-act="oggi.goPrograms">Scegli una scheda</button>';
      if (done.length) body += '<div class="hr"></div>' + done.map(s => '<div class="li-s">✅ ' + esc(s.name || 'Sessione') + ' · ' + UI.durStr((s.end || s.start) - s.start) + ' · volume ' + fmt(Calc.sessionVolume(s)) + ' kg</div>').join('');
    }
    return UI.card('Allenamento di oggi', body);
  }

  /* ---------- integratori ---------- */
  function suppCard(date) {
    const supps = S().supps.filter(s => s.active !== false);
    if (!supps.length) return UI.card('Integratori', '<div class="li-s mb8">Nessun integratore in elenco.</div><button class="btn block" data-act="oggi.goSupps">Aggiungi integratori</button>');
    const log = S().suppLog[date] || [];
    const body = supps.map(s => '<button class="li" data-act="oggi.supp" data-id="' + esc(s.id) + '"><span class="setok' + (log.indexOf(s.id) >= 0 ? ' on' : '') + '" style="width:30px;height:30px;border-radius:9px">' + (log.indexOf(s.id) >= 0 ? UI.icon('check', 18) : '') + '</span><div class="li-main"><div class="li-t">' + esc(s.n) + '</div><div class="li-s">' + esc((s.dose || '') + ' ' + D.unitLbl(s.dose, s.unit) + (s.when ? ' · ' + s.when : '')) + '</div></div></button>').join('');
    return UI.card('Integratori', '<div class="list">' + body + '</div>', { right: log.length + '/' + supps.length });
  }

  /* ---------- peso e benessere ---------- */
  function bodyCard(date) {
    const b = S().body[date] || {}, w = S().well[date] || {};
    const ser = Calc.trendSeries();
    const last = ser.filter(x => x.d <= date).pop();
    const en = [1, 2, 3, 4, 5].map(n => '<button class="chip' + (w.energy === n ? ' on' : '') + '" data-act="oggi.energy" data-v="' + n + '" style="min-width:44px;justify-content:center;min-height:40px">' + n + '</button>').join('');
    return UI.card('Peso e benessere',
      '<div class="grid2"><label class="field" style="margin:0"><span class="field-l">Peso (kg)</span><input class="inp" inputmode="decimal" id="og-w" data-ch="oggi.weight" value="' + (b.w ? esc(String(b.w).replace('.', ',')) : '') + '" placeholder="' + (last ? fmt(last.w, 1) : '0,0') + '"></label>' +
      '<label class="field" style="margin:0"><span class="field-l">Sonno (ore)</span><input class="inp" inputmode="decimal" id="og-sleep" data-ch="oggi.sleep" value="' + (w.sleep ? esc(String(w.sleep).replace('.', ',')) : '') + '" placeholder="7,5"></label></div>' +
      (last ? '<p class="xs mut mt4">Peso di tendenza: <b>' + fmt(last.t, 1) + ' kg</b></p>' : '') +
      ((b.bf || w.hr) ? '<p class="xs mut mt4">' + (b.bf ? 'Grasso corporeo <b>' + fmt(b.bf, 1) + ' %</b>' : '') + (b.bf && w.hr ? ' · ' : '') + (w.hr ? 'FC a riposo <b>' + fmt(w.hr) + ' bpm</b>' : '') + '</p>' : '') +
      '<div class="field-l mt12" style="margin-bottom:6px">Energia (1–5)</div><div class="chips">' + en + '</div>' +
      '<div class="field-l mt12" style="margin-bottom:6px">Capogiri oggi?</div><div class="chips"><button class="chip' + (w.dizzy === false ? ' on' : '') + '" data-act="oggi.dizzy" data-v="0">No</button><button class="chip' + (w.dizzy ? ' on' : '') + '" data-act="oggi.dizzy" data-v="1">Sì</button></div>');
  }

  function adviceCard(date) {
    const list = Advice.list(date);
    if (!list.length) return UI.card('Consigli', '<div class="tip ok"><span class="dot"></span><div>Nessun avviso: continua così.</div></div>');
    return UI.card('Consigli', list.map(a => '<div class="tip ' + a.lvl + '"><span class="dot"></span><div>' + esc(a.t) + (a.btn ? '<div class="mt8"><button class="btn xs" data-act="' + a.btn.act + '" data-v="' + a.btn.v + '">' + esc(a.btn.label) + '</button></div>' : '') + '</div></div>').join(''));
  }

  const view = {
    title: 'Oggi',
    render() {
      const date = O.date;
      const tg = Calc.targets(date);
      if (!tg) return '';
      const dt = Calc.dayTotals(date);
      return UI.dateBar(date, 'oggi') + (window.Checkin ? Checkin.card(date) : '') + macroCard(tg, dt) + microCard(tg, dt, date) + waterCard(date, tg) + stepsCard(date) +
        workoutCard(date) + suppCard(date) + bodyCard(date) + adviceCard(date) + Rem.card();
    }
  };
  UI.registerView('oggi', view);

  /* ---------- azioni ---------- */
  UI.on('oggi.prev', () => { O.date = Store.addDays(O.date, -1); UI.refresh(); });
  UI.on('oggi.next', () => { O.date = Store.addDays(O.date, 1); UI.refresh(); });
  UI.on('oggi.pick', () => pickDate(O.date, d => { O.date = d; UI.refresh(); }));
  function pickDate(cur, cb) {
    const sh = UI.sheet({ title: 'Scegli il giorno', cls: 'small', html: UI.field('Data', '<input class="inp" type="date" id="pk-date" value="' + cur + '">') + '<div class="row gap"><button class="btn grow" id="pk-today">Oggi</button><button class="btn primary grow" id="pk-ok">Vai</button></div>' });
    sh.body.querySelector('#pk-today').onclick = () => { cb(Store.today()); sh.close(); };
    sh.body.querySelector('#pk-ok').onclick = () => { const v = sh.body.querySelector('#pk-date').value; if (v) cb(v); sh.close(); };
  }
  UI.on('oggi.micros', () => allSheet(O.date));
  UI.on('oggi.water', el => {
    const d = Store.ensureDay(O.date);
    d.water = Math.max(0, (d.water || 0) + (+el.dataset.v));
    Store.change(); UI.refresh();
  });
  UI.onChange('oggi.stepsIn', el => {
    const v = UI.parseNum(el.value);
    Store.ensureDay(O.date).steps = isFinite(v) && v > 0 ? Math.round(v) : 0;
    Store.change(); UI.refresh();
  });
  UI.on('oggi.readSteps', async () => {
    let txt = '';
    try { txt = await navigator.clipboard.readText(); } catch (e) { /* permesso negato */ }
    const r = Salute.parse(txt);
    if (r) return saluteSheet(r);
    const sh = UI.sheet({
      title: 'Incolla da Salute', cls: 'small',
      html: '<p class="txt">Non ho trovato il testo del Comando rapido negli appunti (inizia con <b>STRIDE</b>, oppure <b>PASSI 8432 2026-10-19</b>). Incollalo qui sotto oppure inserisci i dati a mano.</p><textarea class="inp" id="st-paste" rows="4" placeholder="STRIDE&#10;peso=75,4&#10;passi=8432"></textarea><button class="btn primary block mt12" id="st-ok">Usa il testo</button>'
    });
    sh.body.querySelector('#st-ok').onclick = () => { const q = Salute.parse(sh.body.querySelector('#st-paste').value); if (q) { sh.close(); saluteSheet(q); } else UI.toast('Testo non riconosciuto'); };
  });
  /* "8432", "8.432", "8,432", "8432,0", "12.345,0" -> numero intero */
  const parseSteps = Salute.parseSteps;   // il vecchio formato «PASSI 8432 2026-10-19» passa da Salute.parse
  void parseSteps;
  /* conferma di ciò che è stato letto, poi salva */
  function saluteSheet(r) {
    const date = r.date || Store.today();
    const day = Store.getDay(date), b = S().body[date] || {}, w = S().well[date] || {};
    const rows = [];
    const add = (k, label, val, unit, old, dec) => { if (r[k] !== undefined) rows.push('<div class="li" style="min-height:44px"><div class="li-main"><div class="li-t">' + label + '</div>' + (old ? '<div class="li-s">ora: ' + fmt(old, dec) + ' ' + unit + '</div>' : '') + '</div><div class="li-r"><b>' + fmt(val, dec) + '</b> ' + unit + '</div></div>'); };
    add('w', 'Peso', r.w, 'kg', b.w, 1); add('bf', 'Grasso corporeo', r.bf, '%', b.bf, 1); add('steps', 'Passi', r.steps, '', day.steps, 0);
    add('sleep', 'Sonno', r.sleep, 'ore', w.sleep, 1); add('hr', 'FC a riposo', r.hr, 'bpm', w.hr, 0);
    const sh = UI.sheet({
      title: 'Da Salute · ' + UI.dateLabel(date), cls: 'small',
      html: '<div class="list mb8">' + rows.join('') + '</div><p class="xs mut mb8">Controlla i valori: nulla viene salvato finché non tocchi «Salva».</p><div class="row gap"><button class="btn ghost grow" data-x="0">Annulla</button><button class="btn primary grow" data-x="1">Salva</button></div>'
    });
    sh.body.addEventListener('click', e => {
      const x = e.target.closest('[data-x]'); if (!x) return;
      if (x.dataset.x === '1') {
        if (r.w !== undefined) Store.ensureBody(date).w = r.w;
        if (r.bf !== undefined) Store.ensureBody(date).bf = r.bf;
        if (r.steps !== undefined) Store.ensureDay(date).steps = r.steps;
        if (r.sleep !== undefined) Store.ensureWell(date).sleep = r.sleep;
        if (r.hr !== undefined) Store.ensureWell(date).hr = r.hr;
        Store.change();
        if (date <= Store.today()) O.date = date;
        UI.refresh(); UI.toast('Salvato da Salute');
      }
      sh.close();
    });
  }
  UI.on('oggi.goTrain', () => { Pal.tab = 'allena'; UI.go('palestra'); });
  UI.on('oggi.goPrograms', () => { Pal.tab = 'schede'; UI.go('palestra'); });
  UI.on('oggi.goSupps', () => { UI.go('altro', { sub: 'integratori' }); });
  UI.on('oggi.startNext', () => { const nx = Pal.nextDay(); if (nx) { Pal.start(nx.prog.id, nx.idx); } });
  UI.on('oggi.supp', el => {
    const id = el.dataset.id, log = S().suppLog;
    const arr = log[O.date] || (log[O.date] = []);
    const i = arr.indexOf(id);
    if (i >= 0) arr.splice(i, 1); else arr.push(id);
    Store.change(); UI.refresh();
  });
  UI.onChange('oggi.weight', el => {
    const v = UI.parseNum(el.value);
    if (isFinite(v) && v > 20 && v < 400) { Store.ensureBody(O.date).w = Math.round(v * 10) / 10; UI.toast('Peso salvato'); }
    else if (el.value.trim() === '') { const b = Store.s.body[O.date]; if (b) { delete b.w; } }
    else UI.toast('Peso non valido');
    Store.change(); UI.refresh();
  });
  UI.onChange('oggi.sleep', el => {
    const v = UI.parseNum(el.value);
    if (isFinite(v) && v > 0 && v <= 16) { Store.ensureWell(O.date).sleep = Math.round(v * 10) / 10; UI.toast('Sonno salvato'); }
    else if (el.value.trim() === '') { const w = Store.s.well[O.date]; if (w) delete w.sleep; }
    else UI.toast('Ore non valide');
    Store.change(); UI.refresh();
  });
  UI.on('oggi.energy', el => { const w = Store.ensureWell(O.date); w.energy = w.energy === +el.dataset.v ? undefined : +el.dataset.v; Store.change(); UI.refresh(); });
  UI.on('oggi.dizzy', el => { const w = Store.ensureWell(O.date); const v = el.dataset.v === '1'; w.dizzy = w.dizzy === v ? undefined : v; Store.change(); UI.refresh(); });

  window.Oggi = O;
  O.pickDate = pickDate;
})();
