/* Compagno - scheda Grafici (Chart.js) */
(function () {
  'use strict';
  const esc = UI.esc, fmt = UI.fmt, S = () => Store.s;
  const G = { tab: 'corpo', per: 28, ex: '', lab: '' };
  let pending = [];
  const COL = { acc: '#3DDC97', prot: '#5AA9FF', carb: '#F5B841', fat: '#FF7A90', water: '#4FC3F7', mut: '#8A97A6', vio: '#B28DFF', supp: '#8EA9FF' };

  function range() { const t = Store.today(); return Calc.lastDays(t, G.per); }
  /* valori per giorno, o per settimana se il periodo e' lungo */
  function bucket(getter) {
    const days = range();
    if (G.per <= 100) return { labels: days.map(UI.dateShort), vals: days.map(getter), keys: days };
    const labels = [], vals = [], keys = [];
    for (let i = 0; i < days.length; i += 7) {
      const part = days.slice(i, i + 7).map(getter).filter(x => x !== null && x !== undefined);
      labels.push(UI.dateShort(days[i])); keys.push(days[i]);
      vals.push(part.length ? Calc.mean(part) : null);
    }
    return { labels, vals, keys };
  }
  const round1 = x => (x === null ? null : Math.round(x * 10) / 10);

  function canvas(title, o) {
    o = o || {};
    const id = 'ch' + pending.length;
    pending.push({ id, cfg: o.cfg });
    return '<section class="card"><div class="chart-t">' + title + '</div><div class="chart-box' + (o.tall ? ' tall' : '') + '"' + (o.h ? ' style="height:' + o.h + 'px"' : '') + '><canvas id="' + id + '"></canvas></div>' + (o.note ? '<p class="xs mut mt8">' + o.note + '</p>' : '') + '</section>';
  }
  function axes(extra) {
    return Object.assign({
      x: { grid: { display: false }, ticks: { maxTicksLimit: 7, maxRotation: 0 } },
      y: { grid: { color: 'rgba(36,48,64,.8)' }, ticks: { maxTicksLimit: 6 } }
    }, extra || {});
  }
  function lineDs(label, data, color, o) {
    return Object.assign({ label, data, borderColor: color, backgroundColor: color, borderWidth: 2, pointRadius: data.length > 40 ? 0 : 2.5, pointHoverRadius: 4, tension: 0.25, spanGaps: true }, o || {});
  }
  function barDs(label, data, color, o) {
    return Object.assign({ label, data, backgroundColor: color, borderRadius: 3, maxBarThickness: 18 }, o || {});
  }
  function lineCfg(labels, ds, scales, legend) {
    return { type: 'line', data: { labels, datasets: ds }, options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: !!legend } }, scales: scales || axes() } };
  }

  /* ---------- Corpo ---------- */
  function corpo() {
    let h = '';
    const days = range();
    const ser = Calc.trendSeries();
    const map = {}; ser.forEach(x => { map[x.d] = x; });
    if (!ser.length) return UI.card('Corpo', UI.empty('Registra il peso in Oggi per vedere il grafico.'));
    const w = bucket(d => map[d] ? map[d].w : null);
    const tr = bucket(d => { let t = null; for (const x of ser) { if (x.d <= d) t = x.t; else break; } return t; });
    const inP = ser.filter(x => x.d >= days[0]);
    const last = ser[ser.length - 1];
    let weekly = '–';
    if (inP.length >= 2) {
      const a = inP[0], b = inP[inP.length - 1];
      const dd = Store.diffDays(b.d, a.d);
      if (dd >= 5) weekly = (b.t - a.t >= 0 ? '+' : '') + fmt((b.t - a.t) / dd * 7, 2);
    }
    h += '<div class="stats"><div class="stat"><b>' + fmt(last.w, 1) + '</b><span>ultimo peso (kg)</span></div><div class="stat"><b>' + fmt(last.t, 1) + '</b><span>tendenza (kg)</span></div><div class="stat"><b>' + weekly + '</b><span>kg / settimana</span></div></div>';
    h += canvas('Peso e tendenza (kg)', { cfg: lineCfg(w.labels, [lineDs('Peso', w.vals, 'rgba(138,151,166,.8)', { borderWidth: 1.5, pointRadius: 3, showLine: false }), lineDs('Tendenza', tr.vals, COL.acc, { borderWidth: 2.5, pointRadius: 0 })], axes({ y: { grid: { color: 'rgba(36,48,64,.8)' }, ticks: { maxTicksLimit: 6 }, grace: '5%' } }), true) });
    /* variazione settimanale della tendenza */
    const wk = [];
    for (let i = Math.min(G.per, 365) - 7; i >= 0; i -= 7) {
      const end = Store.addDays(Store.today(), -i), start = Store.addDays(end, -7);
      const at = d => { let t = null; for (const x of ser) { if (x.d <= d) t = x.t; else break; } return t; };
      const a = at(start), b = at(end);
      wk.push({ l: UI.dateShort(end), v: a !== null && b !== null ? round1((b - a) * 10) / 10 : null });
    }
    h += canvas('Variazione settimanale della tendenza (kg)', { cfg: { type: 'bar', data: { labels: wk.map(x => x.l), datasets: [barDs('kg', wk.map(x => x.v), COL.prot)] }, options: { plugins: { legend: { display: false } }, scales: axes() } } });
    /* misure */
    const ms = [['vita', 'Vita', COL.fat], ['fianchi', 'Fianchi', COL.carb], ['petto', 'Petto', COL.prot], ['braccio', 'Braccio', COL.acc], ['coscia', 'Coscia', COL.vio]];
    const sets = [];
    ms.forEach(m => {
      const b = bucket(d => (S().body[d] && Calc.num(+S().body[d][m[0]]) && +S().body[d][m[0]] > 0 ? +S().body[d][m[0]] : null));
      if (b.vals.some(x => x !== null)) sets.push(lineDs(m[1], b.vals, m[2], { pointRadius: 3 }));
    });
    if (sets.length) h += canvas('Misure (cm)', { cfg: lineCfg(bucket(() => null).labels, sets, axes(), true) });
    else h += UI.card('Misure', UI.empty('Aggiungi le misure in Altro → Corpo e misure.'));
    return h;
  }

  /* ---------- Cibo ---------- */
  function cibo() {
    const tg = Calc.targets(Store.today());
    let h = '';
    const getT = k => d => { const dt = Calc.dayTotals(d); return dt.hasData ? round1(dt.tot[k]) : null; };
    const kc = bucket(getT('kcal'));
    const line = v => lineDs('Obiettivo', kc.labels.map(() => v), 'rgba(232,238,244,.55)', { borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0, type: 'line' });
    const barLine = (title, k, color, goal, unit) => {
      const b = bucket(getT(k));
      return canvas(title, { cfg: { type: 'bar', data: { labels: b.labels, datasets: [barDs(unit, b.vals, color), line(goal)] }, options: { plugins: { legend: { display: false } }, scales: axes() } } });
    };
    h += barLine('Kcal al giorno vs obiettivo', 'kcal', COL.acc, Math.round(tg.kcal), 'kcal');
    h += barLine('Proteine (g) vs obiettivo', 'prot', COL.prot, Math.round(tg.prot), 'g');
    const wb = bucket(d => { const v = Store.getDay(d).water; return v > 0 ? v : null; });
    h += canvas('Acqua (ml)', { cfg: { type: 'bar', data: { labels: wb.labels, datasets: [barDs('ml', wb.vals.map(x => x === null ? null : Math.round(x)), COL.water), lineDs('Obiettivo', wb.keys.map(d => Calc.waterGoal(d)), 'rgba(232,238,244,.55)', { borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0 })] }, options: { plugins: { legend: { display: false } }, scales: axes() } } });
    const sb = bucket(d => { const v = Store.getDay(d).steps; return v > 0 ? v : null; });
    h += canvas('Passi', { cfg: { type: 'bar', data: { labels: sb.labels, datasets: [barDs('passi', sb.vals.map(x => x === null ? null : Math.round(x)), COL.carb)] }, options: { plugins: { legend: { display: false } }, scales: axes() } } });
    const nw = Math.max(4, Math.min(52, Math.round(G.per / 7)));
    const wl = [], wv = [];
    for (let i = nw - 1; i >= 0; i--) { const end = Store.addDays(Store.today(), -i * 7); wl.push(UI.dateShort(end)); wv.push(Calc.varietySet(end, 7).size); }
    h += canvas('Varietà vegetali a settimana', { cfg: { type: 'bar', data: { labels: wl, datasets: [barDs('vegetali diversi', wv, COL.acc), lineDs('Obiettivo 30', wl.map(() => 30), 'rgba(232,238,244,.55)', { borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0 })] }, options: { plugins: { legend: { display: false } }, scales: axes() } }, note: 'Verdure, frutta, legumi, cereali integrali, frutta secca e semi diversi negli ultimi 7 giorni. 30 è un obiettivo indicativo.' });
    return h;
  }

  /* ---------- Micro ---------- */
  const hline100 = { id: 'line100', afterDraw(c) {
    const x = c.scales.x.getPixelForValue(100), a = c.chartArea, g = c.ctx;
    g.save(); g.strokeStyle = 'rgba(232,238,244,.6)'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(x, a.top); g.lineTo(x, a.bottom); g.stroke(); g.restore();
  } };
  function micro() {
    const tg = Calc.targets(Store.today());
    const avg = Calc.avgTotals(Store.today(), 7);
    if (avg.n < 1) return UI.card('Micronutrienti', UI.empty('Registra qualche giorno di diario per vedere la media a 7 giorni.'));
    const rep = Calc.microReport(avg.avg, avg.cov, tg, avg.supp);
    const known = rep.filter(r => r.pct !== null).sort((a, b) => a.pct - b.pct);
    const unknown = rep.filter(r => r.pct === null);
    const over = known.filter(r => r.ul && r.v > r.ul);
    const data = known.map(r => Math.round(r.fv / r.t * 100));
    const sdata = known.map(r => Math.round(r.s / r.t * 100));
    const anyS = sdata.some(x => x > 0);
    const cols = known.map(r => r.ul && r.v > r.ul ? COL.vio : (r.pct < 0.7 ? COL.fat : (r.pct < 1 ? COL.carb : COL.acc)));
    let h = '<div class="disc mb8">Media degli ultimi 7 giorni con diario (' + avg.n + ' giorni) in percentuale dell\'obiettivo. Rosso sotto il 70%, giallo sotto il 100%, viola sopra il limite massimo tollerabile.</div>';
    h += canvas('Micronutrienti, % dell\'obiettivo (media 7 giorni)', {
      h: Math.max(220, known.length * 26 + 40),
      cfg: { type: 'bar', data: { labels: known.map(r => D.NMAP[r.k].n + (r.cov < 0.95 ? ' *' : '')), datasets: [{ label: 'cibo %', data, backgroundColor: cols, borderRadius: 3 }, { label: 'integratore %', data: sdata, backgroundColor: COL.supp, borderRadius: 3 }] }, options: { indexAxis: 'y', plugins: { legend: { display: anyS } }, scales: { x: { stacked: true, grid: { color: 'rgba(36,48,64,.8)' }, min: 0, max: Math.min(200, Math.max(120, Math.ceil(Math.max.apply(null, known.map(r => r.pct * 100)) / 20) * 20)), ticks: { callback: v => v + '%' } }, y: { stacked: true, grid: { display: false } } } }, plugins: [hline100] },
      note: '* dati parziali: alcuni alimenti non riportano questo nutriente. Le barre oltre il 200% sono tagliate.' + (anyS ? ' Azzurro = parte da integratori.' : '')
    });
    if (over.length) h += UI.card('Attenzione', '<div class="tip warn"><span class="dot"></span><div>Sopra il limite massimo tollerabile: ' + over.map(r => esc(D.NMAP[r.k].n)).join(', ') + '. Controlla integratori e alimenti arricchiti.</div></div>');
    if (unknown.length) h += '<p class="xs mut">Dati non disponibili (n.d.): ' + unknown.map(r => esc(D.NMAP[r.k].n)).join(', ') + '.</p>';
    return h;
  }

  /* ---------- Palestra ---------- */
  function palestra() {
    let h = '';
    const ids = [];
    Calc.sortedSessions().forEach(s => s.ex.forEach(e => { if (ids.indexOf(e.e) < 0 && Calc.doneSets(e).length) ids.push(e.e); }));
    if (!ids.length) return UI.card('Palestra', UI.empty('Registra delle sessioni per vedere i grafici.'));
    if (ids.indexOf(G.ex) < 0) G.ex = ids[0];
    h += UI.field('Esercizio', UI.select(ids.map(i => [i, Calc.exName(i)]), G.ex, 'data-ch="graf.ex"'));
    const hist = Calc.exerciseHistory(G.ex);
    const from = range()[0];
    const pts = hist.filter(x => x.s.date >= from).map(x => ({ d: x.s.date, v: Math.max.apply(null, x.sets.map(s => Calc.e1rm(s.w, s.r, s.rpe))) }));
    if (pts.length) h += canvas('e1RM stimato (kg) – ' + esc(Calc.exName(G.ex)), { cfg: lineCfg(pts.map(p => UI.dateShort(p.d)), [lineDs('e1RM', pts.map(p => round1(p.v)), COL.acc, { pointRadius: 4 })], axes({ y: { grid: { color: 'rgba(36,48,64,.8)' }, ticks: { maxTicksLimit: 6 }, grace: '8%' } })) });
    else h += UI.card('e1RM', UI.empty('Nessuna sessione con questo esercizio nel periodo.'));
    /* serie per muscolo negli ultimi 7 giorni */
    const t = Store.today();
    const ms = Calc.muscleSets(Store.addDays(t, -6), t);
    const keys = Object.keys(D.MUSCLES);
    const vals = keys.map(k => Math.round((ms[k] || 0) * 10) / 10);
    const band = { id: 'band', beforeDatasetsDraw(c) {
      const x1 = c.scales.x.getPixelForValue(10), x2 = c.scales.x.getPixelForValue(20), a = c.chartArea, g = c.ctx;
      g.save(); g.fillStyle = 'rgba(61,220,151,.10)'; g.fillRect(x1, a.top, x2 - x1, a.bottom - a.top); g.restore();
    } };
    h += canvas('Serie per muscolo, ultimi 7 giorni (fascia 10–20)', {
      h: keys.length * 26 + 50,
      cfg: { type: 'bar', data: { labels: keys.map(k => D.MUSCLES[k]), datasets: [{ label: 'serie', data: vals, backgroundColor: vals.map(v => v < 10 ? COL.carb : (v <= 20 ? COL.acc : COL.fat)), borderRadius: 3 }] }, options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(36,48,64,.8)' }, suggestedMax: 22 }, y: { grid: { display: false } } } }, plugins: [band] },
      note: 'Serie complete: muscolo principale 1, secondario 0,5. Fascia 10–20 serie a settimana (Schoenfeld 2017).'
    });
    const nw = Math.max(4, Math.min(52, Math.round(G.per / 7)));
    const wl = [], wv = [];
    for (let i = nw - 1; i >= 0; i--) {
      const end = Store.addDays(t, -i * 7), start = Store.addDays(end, -6);
      wl.push(UI.dateShort(end)); wv.push(S().sessions.filter(s => s.date >= start && s.date <= end).length);
    }
    h += canvas('Sessioni a settimana', { cfg: { type: 'bar', data: { labels: wl, datasets: [barDs('sessioni', wv, COL.prot)] }, options: { plugins: { legend: { display: false } }, scales: axes({ y: { grid: { color: 'rgba(36,48,64,.8)' }, ticks: { stepSize: 1 }, beginAtZero: true } }) } } });
    return h;
  }

  /* ---------- Benessere ---------- */
  function benessere() {
    const W = S().well;
    if (!Object.keys(W).length) return UI.card('Benessere', UI.empty('Registra sonno ed energia in Oggi o in Altro → Benessere.'));
    const get = k => d => (W[d] && Calc.num(+W[d][k]) && W[d][k] !== '' && +W[d][k] > 0 ? +W[d][k] : null);
    let h = '';
    const sl = bucket(get('sleep'));
    h += canvas('Sonno (ore)', { cfg: { type: 'bar', data: { labels: sl.labels, datasets: [barDs('ore', sl.vals.map(round1), COL.prot), lineDs('7 ore', sl.labels.map(() => 7), 'rgba(232,238,244,.5)', { borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0 })] }, options: { plugins: { legend: { display: false } }, scales: axes() } } });
    const en = bucket(get('energy')), sq = bucket(get('sq'));
    h += canvas('Energia e qualità del sonno (1–5)', { cfg: lineCfg(en.labels, [lineDs('Energia', en.vals.map(round1), COL.acc, { pointRadius: 3 }), lineDs('Qualità sonno', sq.vals.map(round1), COL.prot, { pointRadius: 3 })], axes({ y: { min: 1, max: 5, grid: { color: 'rgba(36,48,64,.8)' }, ticks: { stepSize: 1 } } }), true) });
    const dz = bucket(d => (W[d] && W[d].dizzy ? 1 : 0));
    const hasD = dz.vals.some(x => x > 0);
    h += canvas('Capogiri' + (G.per > 100 ? ' (quota di giorni a settimana)' : ''), { h: 140, cfg: { type: 'bar', data: { labels: dz.labels, datasets: [barDs('capogiri', dz.vals.map(x => x === null ? null : round1(x)), COL.fat)] }, options: { plugins: { legend: { display: false } }, scales: axes({ y: { beginAtZero: true, max: 1, ticks: { stepSize: 1 }, grid: { color: 'rgba(36,48,64,.8)' } } }) } }, note: hasD ? 'Hai segnato dei capogiri: se persistono, parlane con il medico.' : '' });
    const sy = bucket(get('sys')), di = bucket(get('dia'));
    if (sy.vals.some(x => x !== null) || di.vals.some(x => x !== null)) h += canvas('Pressione (mmHg)', { cfg: lineCfg(sy.labels, [lineDs('Massima', sy.vals.map(round1), COL.fat, { pointRadius: 3 }), lineDs('Minima', di.vals.map(round1), COL.water, { pointRadius: 3 })], axes({ y: { grid: { color: 'rgba(36,48,64,.8)' }, grace: '8%' } }), true) });
    return h;
  }

  /* ---------- Esami ---------- */
  function esami() {
    const labs = S().labs.slice().sort((a, b) => a.date.localeCompare(b.date));
    const keys = [];
    labs.forEach(l => l.vals.forEach(v => { if (keys.indexOf(v.k) < 0) keys.push(v.k); }));
    if (!keys.length) return UI.card('Esami', UI.empty('Aggiungi un referto in Altro → Referti.'));
    if (keys.indexOf(G.lab) < 0) G.lab = keys[0];
    const pts = [];
    labs.forEach(l => { const v = l.vals.find(x => x.k === G.lab); if (v && isFinite(+v.val)) pts.push({ d: l.date, v: +v.val, lo: v.lo === '' || v.lo == null ? null : +v.lo, hi: v.hi === '' || v.hi == null ? null : +v.hi, st: Calc.labStatus(v), u: v.unit }); });
    const last = pts[pts.length - 1];
    const band = { id: 'lband', beforeDatasetsDraw(c) {
      if (!last) return;
      const y = c.scales.y, a = c.chartArea, g = c.ctx;
      const lo = last.lo !== null && isFinite(last.lo) ? last.lo : y.min, hi = last.hi !== null && isFinite(last.hi) ? last.hi : y.max;
      const y1 = y.getPixelForValue(Math.min(y.max, hi)), y2 = y.getPixelForValue(Math.max(y.min, lo));
      g.save(); g.fillStyle = 'rgba(61,220,151,.10)'; g.fillRect(a.left, y1, a.right - a.left, y2 - y1); g.restore();
    } };
    let h = UI.field('Parametro', UI.select(keys.map(k => [k, Calc.labName(k)]), G.lab, 'data-ch="graf.lab"'));
    const vals = pts.map(p => p.v);
    const lo = last && last.lo !== null ? last.lo : Math.min.apply(null, vals), hi = last && last.hi !== null ? last.hi : Math.max.apply(null, vals);
    h += canvas(esc(Calc.labName(G.lab)) + (last && last.u ? ' (' + esc(last.u) + ')' : ''), {
      cfg: { type: 'line', data: { labels: pts.map(p => UI.dateShort(p.d)), datasets: [lineDs('Valore', vals, COL.acc, { pointRadius: 5, pointBackgroundColor: pts.map(p => p.st === 'ok' ? COL.acc : COL.fat), borderWidth: 2 })] }, options: { plugins: { legend: { display: false } }, scales: axes({ y: { grid: { color: 'rgba(36,48,64,.8)' }, suggestedMin: lo - (hi - lo) * 0.2, suggestedMax: hi + (hi - lo) * 0.2 } }) }, plugins: [band] },
      note: last ? 'Fascia verde = range indicato nell\'ultimo referto' + (last.lo !== null || last.hi !== null ? ' (' + (last.lo !== null ? fmt(last.lo, 1) : '…') + '–' + (last.hi !== null ? fmt(last.hi, 1) : '…') + ')' : '') + '. Punti rossi = fuori range.' : ''
    });
    h += '<div class="disc">L\'app non fa diagnosi: i valori fuori range vanno discussi con il medico.</div>';
    return h;
  }

  const view = {
    title: 'Grafici',
    render() {
      pending = [];
      const tabs = [['corpo', 'Corpo'], ['cibo', 'Cibo'], ['micro', 'Micro'], ['palestra', 'Palestra'], ['benessere', 'Benessere'], ['esami', 'Esami']];
      let h = UI.seg(tabs, G.tab, 'graf.tab');
      if (G.tab !== 'micro' && G.tab !== 'esami') h += UI.seg([[28, '4 sett.'], [84, '12 sett.'], [365, '1 anno']], G.per, 'graf.per');
      try {
        h += G.tab === 'corpo' ? corpo() : G.tab === 'cibo' ? cibo() : G.tab === 'micro' ? micro() : G.tab === 'palestra' ? palestra() : G.tab === 'benessere' ? benessere() : esami();
      } catch (e) { console.error(e); h += UI.card('Errore', '<p class="small">Non riesco a disegnare questo grafico: ' + esc(e.message) + '</p>'); }
      return h;
    },
    after() {
      if (typeof Chart === 'undefined') return;
      pending.forEach(p => {
        const c = document.getElementById(p.id);
        if (!c) return;
        try { UI.chart(c, p.cfg); } catch (e) { console.error(e); }
      });
    }
  };
  UI.registerView('grafici', view);
  UI.on('graf.tab', el => { G.tab = el.dataset.v; UI.refresh(); });
  UI.on('graf.per', el => { G.per = +el.dataset.v; UI.refresh(); });
  UI.onChange('graf.ex', el => { G.ex = el.value; UI.refresh(); });
  UI.onChange('graf.lab', el => { G.lab = el.value; UI.refresh(); });
  window.Grafici = G;
})();
