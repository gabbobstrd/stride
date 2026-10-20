/* Compagno - scheda Cibo: diario, ricerca, quantita', pasti, ricette, codice a barre, proponi giornata */
(function () {
  'use strict';
  const esc = UI.esc, fmt = UI.fmt, S = () => Store.s;
  const C = { date: Store.today(), plan: null };

  function guessMeal() {
    const h = new Date().getHours();
    return h < 10 ? 'colazione' : h < 15 ? 'pranzo' : h < 18 ? 'spuntini' : 'cena';
  }
  function mealOptions(sel) { return D.MEALS.map(m => [m[0], m[1]]).map(o => o); }
  function mealSelect(id, val) { return UI.select(D.MEALS, val, 'id="' + id + '"'); }
  function macroLine(f, g) {
    const p = Calc.scaled(f, g, 'prot'), c = Calc.scaled(f, g, 'carb'), fa = Calc.scaled(f, g, 'fat');
    const v = x => (x === null ? '–' : UI.fmtA(x, 1));
    return '<span class="macros"><i class="mP">P ' + v(p) + '</i> · <i class="mC">C ' + v(c) + '</i> · <i class="mG">G ' + v(fa) + '</i></span>';
  }

  /* ---------- vista ---------- */
  function mini(label, val, goal, color) {
    const p = goal > 0 ? Math.min(1, val / goal) * 100 : 0;
    return '<div class="mini"><div class="mini-l">' + label + '</div><div class="mini-v"><b>' + fmt(val) + '</b><span class="mut">/' + fmt(goal) + '</span></div><div class="bar-track" style="height:5px"><div class="bar-fill" style="width:' + p.toFixed(1) + '%;background:' + color + '"></div></div></div>';
  }
  function itemRow(it) {
    const f = Calc.food(it.f);
    if (!f) return '<button class="li" data-act="cibo.edit" data-id="' + esc(it.id) + '"><div class="li-main"><div class="li-t bad">Alimento non trovato</div><div class="li-s">' + fmt(it.g) + ' g · tocca per eliminare</div></div></button>';
    const k = Calc.scaled(f, it.g, 'kcal');
    return '<button class="li" data-act="cibo.edit" data-id="' + esc(it.id) + '"><div class="li-main"><div class="li-t">' + esc(f.n) + '</div><div class="li-s">' + esc(Portions.fmtItem(it)) + ' · ' + macroLine(f, it.g) + '</div></div><div class="li-r">' + (k === null ? '<span class="mut">n.d.</span>' : '<b>' + fmt(k) + '</b><small>kcal</small>') + '</div></button>';
  }
  const view = {
    title: 'Cibo',
    render() {
      const date = C.date, tg = Calc.targets(date);
      if (!tg) return '';
      const dt = Calc.dayTotals(date), day = Store.getDay(date);
      let h = UI.dateBar(date, 'cibo');
      h += UI.card('', '<div class="grid4">' + mini('Kcal', dt.tot.kcal, tg.kcal, 'var(--acc)') + mini('Prot', dt.tot.prot, tg.prot, 'var(--prot)') + mini('Carb', dt.tot.carb, tg.carb, 'var(--carb)') + mini('Grassi', dt.tot.fat, tg.fat, 'var(--fat)') + '</div>' +
        (dt.hasData && (dt.cov.kcal < 1) ? '<p class="xs warn mt8">Dati parziali: alcuni alimenti non hanno tutti i nutrienti.</p>' : ''), { cls: 'tight' });
      for (const m of D.MEALS) {
        const items = day.items.filter(i => i.m === m[0]);
        let kc = 0;
        items.forEach(i => { const f = Calc.food(i.f); const k = f ? Calc.scaled(f, i.g, 'kcal') : null; if (k) kc += k; });
        h += UI.card(m[1], (items.length ? '<div class="list">' + items.map(itemRow).join('') + '</div>' : '<div class="li-s" style="padding:2px 0 8px">Ancora vuoto</div>') +
          '<div class="row gap6 mt8"><button class="btn sm grow" data-act="cibo.add" data-m="' + m[0] + '">+ Aggiungi</button><button class="btn sm" data-act="voce.photo" data-m="' + m[0] + '" aria-label="Foto del piatto">' + UI.icon('camera', 18) + '</button></div>',
          { right: items.length ? '<b>' + fmt(kc) + '</b> kcal' : '' });
      }
      h += UI.card('Strumenti',
        '<div class="grid2">' +
        '<button class="btn" data-act="piano.open">Piano settimanale</button>' +
        '<button class="btn" data-act="cibo.meals">Pasti salvati</button>' +
        '<button class="btn" data-act="cibo.propose">Proponi giornata</button>' +
        '<button class="btn" data-act="cibo.scan">' + UI.icon('scan', 18) + ' Codice barre</button>' +
        '<button class="btn" data-act="cibo.create">Crea cibo</button>' +
        '<button class="btn" data-act="cibo.recipe">Ricetta</button>' +
        '<button class="btn" data-act="cibo.copyDay">Copia da ieri</button>' +
        '<button class="btn" data-act="voce.photo" data-m="' + guessMeal() + '">' + UI.icon('camera', 18) + ' Foto piatto</button>' +
        '<button class="btn" data-act="cibo.shopOpen">Lista della spesa</button></div>' +
        (Array.isArray(window.FOODS) && window.FOODS.length ? '' : '<p class="xs warn mt8">Il database alimenti non è stato caricato: puoi creare cibi tuoi o scansionare codici a barre.</p>'));
      return h;
    }
  };
  UI.registerView('cibo', view);

  UI.on('cibo.prev', () => { C.date = Store.addDays(C.date, -1); UI.refresh(); });
  UI.on('cibo.next', () => { C.date = Store.addDays(C.date, 1); UI.refresh(); });
  UI.on('cibo.pick', () => Oggi.pickDate(C.date, d => { C.date = d; UI.refresh(); }));
  UI.on('cibo.add', el => openSearch({ meal: el.dataset.m, date: C.date }));
  UI.on('cibo.edit', el => {
    const it = Store.getDay(C.date).items.find(i => i.id === el.dataset.id);
    if (!it) return;
    const f = Calc.food(it.f);
    if (!f) {
      UI.confirm({ title: 'Alimento non trovato', msg: 'Questa voce non è più nel database. Eliminarla?', ok: 'Elimina', danger: true }).then(ok => { if (ok) { removeItem(C.date, it.id); } });
      return;
    }
    qtySheet({ food: f, item: it, date: C.date, meal: it.m });
  });
  UI.on('cibo.copyDay', async () => {
    const from = Store.addDays(C.date, -1);
    const src = Store.getDay(from).items;
    if (!src.length) return UI.toast('Ieri non c\'è niente da copiare');
    if (!await UI.confirm({ title: 'Copia da ieri', msg: 'Aggiungo ' + src.length + ' voci di ieri a questo giorno?', ok: 'Copia' })) return;
    const d = Store.ensureDay(C.date);
    src.forEach(i => d.items.push({ id: Store.uid('e'), f: i.f, g: i.g, m: i.m }));
    Store.change(); UI.refresh(); UI.toast('Copiato');
  });
  function removeItem(date, id) {
    const d = Store.ensureDay(date);
    d.items = d.items.filter(i => i.id !== id);
    Store.change(); UI.refresh();
  }
  function addItem(date, f, g, meal, extra) {
    Store.ensureDay(date).items.push(Object.assign({ id: Store.uid('e'), f: f.id, g: g, m: meal }, extra || {}));
    const meta = S().meta;
    meta.recents = [f.id].concat((meta.recents || []).filter(x => x !== f.id)).slice(0, 40);
    meta.lastQty[f.id] = g;
    Store.change(); UI.refresh();
  }

  /* ---------- ricerca ---------- */
  function foodRowHtml(f, tabMine) {
    const p = S().prefs;
    const kc = Calc.foodVal(f, 'kcal');
    const flags = (p.fav.indexOf(f.id) >= 0 ? '<span class="acc">★ </span>' : '') +
      (p.avoid.indexOf(f.id) >= 0 ? '<span class="badge bad">da evitare</span> ' : (p.dislike.indexOf(f.id) >= 0 ? '<span class="badge warn">non ti piace</span> ' : ''));
    return '<div class="li tap" data-id="' + esc(f.id) + '" role="button" tabindex="0"><div class="li-main"><div class="li-t">' + flags + esc(f.n) + '</div><div class="li-s">' + esc(f.cat || '') + ' · ' + (kc === null ? 'kcal n.d.' : fmt(kc) + ' kcal/100 g') + '</div></div>' +
      (tabMine ? '<button class="icon-btn sm" data-edit="1" aria-label="Modifica">' + UI.icon('edit', 18) + '</button>' : UI.icon('right', 16)) + '</div>';
  }
  function openSearch(o) {
    const meal = o.meal || guessMeal(), date = o.date || C.date;
    const hasDb = Array.isArray(window.FOODS) && window.FOODS.length > 0;
    const meta = S().meta;
    let tab = (meta.recents && meta.recents.length) ? 'rec' : (hasDb ? 'all' : 'mine');
    let limit = 60, q = '';
    const tabs = [['pref', 'Preferiti'], ['rec', 'Recenti'], ['all', 'Tutti'], ['mine', 'Miei']];
    const sh = UI.sheet({
      title: o.title || ('Aggiungi · ' + (D.MEALS.find(m => m[0] === meal) || [0, ''])[1]), cls: 'tall',
      html: '<input class="inp" type="search" id="fs-q" placeholder="Cerca alimento…" autocomplete="off" autocapitalize="off" style="margin-bottom:10px">' +
        '<div class="seg" id="fs-tabs">' + tabs.map(t => '<button data-t="' + t[0] + '" class="' + (t[0] === tab ? 'on' : '') + '">' + t[1] + '</button>').join('') + '</div><div id="fs-res"></div><div id="fs-off"></div>'
    });
    const res = sh.body.querySelector('#fs-res');
    const offBox = sh.body.querySelector('#fs-off');
    let off = null, lastTotal = 0; // off = { q, loading, err, items }
    function offDraw() {
      const qq = q.trim();
      if (qq.length < 2) { offBox.innerHTML = ''; return; }
      if (!off || off.q !== qq) { offBox.innerHTML = lastTotal <= 3 ? '<button class="btn block mt12" style="min-height:52px;white-space:normal;height:auto;padding:12px 14px" data-off="go">Cerca «' + esc(qq) + '» su Open Food Facts (prodotti confezionati)</button>' : ''; return; }
      let h;
      if (off.loading) h = '<p class="small mut center mt12">Cerco su Open Food Facts…</p>';
      else if (off.err) h = '<div class="tip warn mt12"><span class="dot"></span><div>' + esc(off.err) + '</div></div><button class="btn block mt8" data-off="go">Riprova</button>';
      else if (!off.items.length) h = '<p class="small mut center mt12">Nessun prodotto con valori nutrizionali trovato su Open Food Facts.</p>';
      else h = '<div class="sec-t" style="margin-top:14px">Open Food Facts</div><div class="list">' + off.items.map((x, i) => '<div class="li tap" style="min-height:56px" data-oi="' + i + '" role="button" tabindex="0"><div class="li-main"><div class="li-t">' + esc(x.pr.product_name_it || x.pr.product_name) + '</div><div class="li-s">' + esc(String(x.pr.brands || '').split(',')[0]) + (x.pr.brands ? ' · ' : '') + fmt(x.v.kcal) + ' kcal · P ' + fmt(x.v.prot || 0, 1) + ' · C ' + fmt(x.v.carb || 0, 1) + ' · G ' + fmt(x.v.fat || 0, 1) + ' (100 g)</div></div>' + UI.icon('right', 16) + '</div>').join('') + '</div><p class="xs mut mt8">Dati inseriti dalla comunità: controlla l\'etichetta.</p>';
      offBox.innerHTML = h;
    }
    offBox.addEventListener('click', async e => {
      if (e.target.closest('[data-off]')) {
        const qq = q.trim(); if (qq.length < 2 || (off && off.loading)) return;
        const me = off = { q: qq, loading: true }; offDraw();
        const r = await offSearch(qq);
        me.loading = false; me.err = r.err; me.items = r.items || [];
        if (off === me) offDraw();
        return;
      }
      const row = e.target.closest('[data-oi]'); if (!row || !off || !off.items) return;
      const x = off.items[+row.dataset.oi]; if (!x) return;
      const ex = S().customFoods.find(f => f.barcode === x.code);
      if (ex) { sh.close(); qtySheet({ food: ex, date, meal }); return; }
      offConfirm(UI.sheet({ title: 'Conferma prodotto', cls: 'tall' }), x.code, x.pr, x.v);
    });
    function results() {
      let list;
      const all = Calc.allFoods();
      if (tab === 'pref') list = S().prefs.fav.map(Calc.food).filter(Boolean);
      else if (tab === 'rec') list = (meta.recents || []).map(Calc.food).filter(Boolean);
      else if (tab === 'mine') list = S().customFoods.slice();
      else list = all;
      if (q.trim()) list = Calc.searchFoods(q, list);
      const total = list.length; lastTotal = total;
      let html;
      if (!total) {
        html = UI.empty(tab === 'pref' ? 'Nessun preferito: tocca ★ nella scheda di un alimento.' : tab === 'rec' ? 'Nessun alimento recente.' : tab === 'mine' ? 'Non hai ancora creato cibi: usa «Crea cibo», «Ricetta» o il codice a barre.' : (hasDb ? 'Nessun risultato.' : 'Database alimenti non caricato.'));
      } else {
        html = '<div class="list">' + list.slice(0, limit).map(f => foodRowHtml(f, tab === 'mine')).join('') + '</div>';
        if (total > limit) html += '<button class="btn block mt8" data-more="1">Mostra altri (' + (total - limit) + ')</button>';
      }
      res.innerHTML = html;
      offDraw();
    }
    results();
    sh.body.querySelector('#fs-q').addEventListener('input', e => {
      q = e.target.value; limit = 60;
      // scrivendo si cerca in tutto il database, non solo tra recenti/preferiti
      if (q.trim() && (tab === 'rec' || tab === 'pref') && hasDb) { tab = 'all'; sh.body.querySelectorAll('#fs-tabs button').forEach(x => x.classList.toggle('on', x.dataset.t === 'all')); }
      results();
    });
    sh.body.querySelector('#fs-tabs').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      tab = b.dataset.t; limit = 60;
      sh.body.querySelectorAll('#fs-tabs button').forEach(x => x.classList.toggle('on', x === b));
      results();
    });
    res.addEventListener('click', e => {
      if (e.target.closest('[data-more]')) { limit += 60; results(); return; }
      const row = e.target.closest('.li[data-id]'); if (!row) return;
      const f = Calc.food(row.dataset.id); if (!f) return;
      if (e.target.closest('[data-edit]')) { foodForm(f, () => results()); return; }
      if (o.onPick) { o.onPick(f); sh.close(); } else qtySheet({ food: f, date, meal });
    });
    if (!o.noFocus) setTimeout(() => { try { /* niente focus automatico su iOS per non coprire la lista */ } catch (e) { /* ignora */ } }, 0);
    return sh;
  }
  C.openSearch = openSearch;

  /* ---------- quantita' ---------- */
  const KEYMICRO = ['fib', 'sug', 'sfa', 'na', 'k', 'ca', 'mg', 'fe', 'zn', 'vitC', 'vitD', 'b12', 'epadha'];
  function antiHtml(f) {
    if (!f.an) return '';
    let h = '';
    for (const k of Object.keys(D.ANTI)) {
      const lv = +f.an[k];
      if (!(lv >= 1)) continue;
      const a = D.ANTI[k];
      h += '<div class="tip ' + (lv >= 2 ? 'warn' : 'info') + '"><span class="dot"></span><div><b>' + a.n + ': ' + (D.ANTI_LVL[Math.min(3, lv)] || 'presenti') + '.</b> ' + esc(a.t) + '</div></div>';
    }
    return h ? '<div class="sec-t" style="margin-top:14px">Note antinutrienti</div><div class="card" style="padding:10px 12px;margin-bottom:0">' + h + '</div>' : '';
  }
  function qtySheet(o) {
    const f = o.food, edit = !!o.item;
    const p = S().prefs;
    let g = edit ? o.item.g : (S().meta.lastQty[f.id] || 100);
    const warn = p.avoid.indexOf(f.id) >= 0 ? '<div class="tip bad"><span class="dot"></span><div>Hai segnato questo alimento come <b>da evitare</b>.</div></div>' : (p.dislike.indexOf(f.id) >= 0 ? '<div class="tip warn"><span class="dot"></span><div>Hai segnato che questo alimento <b>non ti piace</b>.</div></div>' : '');
    const fav = () => p.fav.indexOf(f.id) >= 0;
    const sh = UI.sheet({
      title: f.n, cls: 'tall',
      html: warn + '<div class="row between mb8"><span class="small mut">' + esc(f.cat || '') + (Calc.isCustom(f) ? ' · mio' : '') + '</span><button class="chip sm' + (fav() ? ' on' : '') + '" id="qt-fav">' + UI.icon('star', 14) + ' Preferito</button></div>' +
        '<div class="row gap"><button class="icon-btn" id="qt-m" style="border:1px solid var(--line)">−</button><input class="inp" id="qt-g" inputmode="decimal" value="' + String(g).replace('.', ',') + '" style="text-align:center;font-size:24px;font-weight:700;min-height:54px" aria-label="Grammi"><span class="mut">g</span><button class="icon-btn" id="qt-p" style="border:1px solid var(--line)">+</button></div>' +
        '<div class="chips mt8" id="qt-pre">' + [30, 50, 100, 150, 200, 250].map(n => '<button class="chip sm" data-g="' + n + '">' + n + ' g</button>').join('') + '</div>' +
        '<div class="row gap mt8" id="qt-por"></div><div class="mt8"><button class="chip sm" id="qt-newp">＋ Porzione mia</button></div>' +
        '<div id="qt-prev" class="mt12"></div>' + antiHtml(f) +
        '<div class="mt16">' + UI.field(edit ? 'Sposta in' : 'Pasto', mealSelect('qt-meal', o.meal || guessMeal())) + '</div>' +
        '<div class="row gap">' + (edit ? '<button class="btn danger" id="qt-del">Elimina</button>' : '') + '<button class="btn primary grow" id="qt-ok">' + (edit ? 'Salva' : 'Aggiungi') + '</button></div>'
    });
    const gi = sh.body.querySelector('#qt-g');
    const cur = () => { const v = UI.parseNum(gi.value); return isFinite(v) && v > 0 ? v : 0; };
    function prev() {
      const gg = cur();
      const kc = Calc.scaled(f, gg, 'kcal');
      let h = '<div class="hl"><div class="row between" style="align-items:baseline"><div class="big">' + (kc === null ? 'n.d.' : fmt(kc)) + ' <small>kcal</small></div><div>' + macroLine(f, gg) + '</div></div></div>';
      h += '<div class="list mt8">' + KEYMICRO.map(k => {
        const m = D.NMAP[k], v = Calc.scaled(f, gg, k);
        return '<div class="li" style="min-height:36px"><div class="li-main"><div class="li-t" style="font-weight:400">' + m.n + '</div></div><div class="li-r">' + (v === null ? '<span class="mut">n.d.</span>' : fmt(v, m.d) + ' ' + m.u) + '</div></div>';
      }).join('') + '</div>';
      sh.body.querySelector('#qt-prev').innerHTML = h;
    }
    prev();
    /* porzioni: N × porzione -> grammi (la voce resta salvata in grammi, con pq/pl solo per la visualizzazione) */
    let pq = edit && o.item.pl ? +o.item.pq : 0, pl = edit && o.item.pl ? o.item.pl : '';
    const porEl = sh.body.querySelector('#qt-por');
    const fa = x => String(Math.round(x * 100) / 100).replace('.', ',');
    function drawPor() {
      const ps = Portions.forFood(f);
      porEl.innerHTML = ps.length ? '<input class="inp" id="qt-pq" inputmode="decimal" placeholder="N" aria-label="Quantità" style="width:70px;flex:none;text-align:center" value="' + (pl ? fa(pq) : '') + '"><span class="mut">×</span><select class="inp" id="qt-pl"><option value="">porzione…</option>' +
        ps.map((p, i) => '<option value="' + i + '"' + (p.label === pl ? ' selected' : '') + '>' + esc((p.personal ? '★ ' : '') + p.label + ' (' + fa(p.g) + ' g)') + '</option>').join('') + '</select>' : '';
    }
    function applyPor() {
      const ps = Portions.forFood(f), s = sh.body.querySelector('#qt-pl'), q = sh.body.querySelector('#qt-pq');
      if (!s || s.value === '') { pl = ''; pq = 0; return; }
      const p = ps[+s.value]; let n = UI.parseNum(q.value);
      if (!(n > 0)) { n = 1; q.value = '1'; }
      pl = p.label; pq = n;
      gi.value = fa(n * p.g); prev();
    }
    const clearPor = () => { if (pl) { pl = ''; pq = 0; drawPor(); } };
    drawPor();
    porEl.addEventListener('input', e => { if (e.target.id === 'qt-pq') applyPor(); });
    porEl.addEventListener('change', e => { if (e.target.id === 'qt-pl') applyPor(); });
    sh.body.querySelector('#qt-newp').onclick = () => {
      const pers = Portions.personal(f.id);
      const ps2 = UI.sheet({
        title: 'Porzione mia · ' + f.n, cls: 'small',
        html: (pers.length ? '<div class="list mb8">' + pers.map((p, i) => '<div class="li" style="min-height:44px"><div class="li-main"><div class="li-t">' + esc(p.label) + '</div></div><div class="li-r">' + fa(p.g) + ' g</div><button class="icon-btn sm" data-del="' + i + '" aria-label="Elimina">' + UI.icon('trash', 18) + '</button></div>').join('') + '</div>' : '') +
          UI.field('Nome', UI.inp({ id: 'np-l', ph: 'es. cucchiaio colmo, fetta grande' })) + UI.field('Grammi', UI.inp({ id: 'np-g', dec: 1, ph: 'es. 12' })) + '<button class="btn primary block" id="np-ok">Salva porzione</button>'
      });
      ps2.body.addEventListener('click', e => { const d = e.target.closest('[data-del]'); if (d) { Portions.removePersonal(f.id, +d.dataset.del); Store.change(); ps2.close(); pl = ''; pq = 0; drawPor(); } });
      ps2.body.querySelector('#np-ok').onclick = () => {
        const l = ps2.body.querySelector('#np-l').value.trim(), gg = UI.parseNum(ps2.body.querySelector('#np-g').value);
        if (!l || !(gg > 0)) return UI.toast('Scrivi nome e grammi');
        Portions.addPersonal(f.id, l, gg); Store.change(); ps2.close(); drawPor(); UI.toast('Porzione salvata');
      };
    };
    gi.addEventListener('input', () => { clearPor(); prev(); });
    const step = d => { clearPor(); gi.value = String(Math.max(0, Math.round((cur() + d) * 10) / 10)).replace('.', ','); prev(); };
    sh.body.querySelector('#qt-m').onclick = () => step(-10);
    sh.body.querySelector('#qt-p').onclick = () => step(10);
    sh.body.querySelector('#qt-pre').onclick = e => { const b = e.target.closest('[data-g]'); if (b) { clearPor(); gi.value = b.dataset.g; prev(); } };
    sh.body.querySelector('#qt-fav').onclick = e => {
      const i = p.fav.indexOf(f.id);
      if (i >= 0) p.fav.splice(i, 1); else p.fav.push(f.id);
      Store.change(); e.currentTarget.classList.toggle('on', fav());
    };
    sh.body.querySelector('#qt-ok').onclick = () => {
      const gg = cur(); if (!gg) return UI.toast('Inserisci i grammi');
      const meal = sh.body.querySelector('#qt-meal').value;
      const keep = pl && pq > 0 && Math.abs(pq * (Portions.forFood(f).find(p => p.label === pl) || { g: 0 }).g - gg) < 0.06;
      if (edit) {
        o.item.g = gg; o.item.m = meal; S().meta.lastQty[f.id] = gg;
        if (keep) { o.item.pq = pq; o.item.pl = pl; } else { delete o.item.pq; delete o.item.pl; }
        Store.change(); UI.refresh(); sh.close(); UI.toast('Salvato');
      } else {
        addItem(o.date || C.date, f, gg, meal, keep ? { pq: pq, pl: pl } : null); sh.close(); UI.toast('Aggiunto: ' + f.n);
      }
    };
    if (edit) sh.body.querySelector('#qt-del').onclick = () => { removeItem(o.date, o.item.id); sh.close(); };
    return sh;
  }
  C.qtySheet = qtySheet;

  /* ---------- crea / modifica cibo ---------- */
  function foodForm(existing, onSaved) {
    const f = existing || { id: null, n: '', cat: '', v: {} };
    const cats = Array.from(new Set((Array.isArray(window.FOODS) ? window.FOODS : []).map(x => x.cat).filter(Boolean)));
    const groups = ['macro', 'grassi', 'vit', 'min', 'altro'];
    let h = UI.field('Nome', UI.inp({ id: 'cf-n', value: f.n, ph: 'es. Pane di casa' })) +
      UI.field('Categoria', '<input class="inp" id="cf-c" list="cf-cats" value="' + esc(f.cat || '') + '" placeholder="es. Cereali"><datalist id="cf-cats">' + cats.map(c => '<option value="' + esc(c) + '">').join('') + '</datalist>') +
      UI.field('Codice a barre (facoltativo)', UI.inp({ id: 'cf-b', value: f.barcode || '', attrs: 'inputmode="numeric"' })) +
      '<p class="hint mb8">Valori per 100 g. Lascia vuoto ciò che non conosci: resterà «n.d.», non zero.</p>';
    for (const g of groups) {
      h += '<div class="sec-t" style="margin-top:10px">' + D.GROUPS[g] + '</div><div class="grid2">' + D.NUTR.filter(n => n.g === g).map(n => UI.field(n.n + ' (' + n.u + ')', '<input class="inp" inputmode="decimal" data-nk="' + n.k + '" value="' + (Calc.num(f.v[n.k]) ? String(f.v[n.k]).replace('.', ',') : '') + '" placeholder="n.d.">')).join('') + '</div>';
    }
    h += '<div class="row gap mt12">' + (existing ? '<button class="btn danger" id="cf-del">Elimina</button>' : '') + '<button class="btn primary grow" id="cf-ok">Salva</button></div>';
    const sh = UI.sheet({ title: existing ? 'Modifica cibo' : 'Crea cibo', cls: 'tall', html: h });
    sh.body.querySelector('#cf-ok').onclick = () => {
      const n = sh.body.querySelector('#cf-n').value.trim();
      if (!n) return UI.toast('Scrivi il nome');
      const v = {};
      sh.body.querySelectorAll('[data-nk]').forEach(i => { const x = UI.parseNum(i.value); if (isFinite(x) && x >= 0) v[i.dataset.nk] = x; });
      if (v.kcal == null) return UI.toast('Servono almeno le kcal');
      const obj = existing || { id: 'c_' + Store.uid(''), an: {} };
      obj.n = n; obj.cat = sh.body.querySelector('#cf-c').value.trim() || 'Miei'; obj.v = v;
      const bc = sh.body.querySelector('#cf-b').value.trim(); if (bc) obj.barcode = bc; else delete obj.barcode;
      if (!existing) S().customFoods.push(obj);
      Calc.invalidate(); Store.change(); sh.close(); UI.refresh(); UI.toast('Cibo salvato');
      if (onSaved) onSaved(obj);
    };
    if (existing) sh.body.querySelector('#cf-del').onclick = async () => {
      if (!await UI.confirm({ title: 'Eliminare «' + existing.n + '»?', msg: 'Le voci già nel diario con questo alimento non saranno più calcolate.', ok: 'Elimina', danger: true })) return;
      S().customFoods = S().customFoods.filter(x => x.id !== existing.id);
      Calc.invalidate(); Store.change(); sh.close(); UI.refresh(); if (onSaved) onSaved(null);
    };
  }
  UI.on('cibo.create', () => foodForm(null));

  /* ---------- ricetta ---------- */
  function recipeSheet() {
    const R = { n: '', items: [], cookedG: '' };
    const sh = UI.sheet({ title: 'Ricetta', cls: 'tall' });
    function per100() {
      const raw = R.items.reduce((a, i) => a + i.g, 0);
      const cooked = UI.parseNum(R.cookedG);
      if (!raw || !(cooked > 0)) return null;
      const v = {};
      for (const n of D.NUTR) {
        let sum = 0, known = 0;
        for (const it of R.items) { const f = Calc.food(it.f); const x = f ? Calc.foodVal(f, n.k) : null; if (x !== null) { sum += x * it.g / 100; known += it.g; } }
        if (known / raw >= 0.6) v[n.k] = Math.round(sum / cooked * 100 * 1000) / 1000;
      }
      return v;
    }
    function draw() {
      const v = per100();
      sh.set(UI.field('Nome della ricetta', UI.inp({ id: 'rc-n', value: R.n, ph: 'es. Pasta al tonno' })) +
        '<div class="sec-t" style="margin-top:6px">Ingredienti (peso crudo)</div>' +
        (R.items.length ? R.items.map((it, i) => { const f = Calc.food(it.f); return '<div class="msgrow mb8"><div class="li-main small">' + esc(f ? f.n : '?') + '</div><input class="inp" style="width:84px;text-align:center" inputmode="decimal" data-rg="' + i + '" value="' + it.g + '" aria-label="Grammi"><span class="mut">g</span><button class="icon-btn sm" data-rd="' + i + '" aria-label="Togli">' + UI.icon('close', 16) + '</button></div>'; }).join('') : '<p class="small mut mb8">Aggiungi gli ingredienti.</p>') +
        '<button class="btn block mb8" data-radd="1">+ Ingrediente</button>' +
        UI.field('Peso totale dopo la cottura (g)', UI.inp({ id: 'rc-c', value: R.cookedG, dec: 1, ph: 'es. 650' }), 'Pesa il piatto finito: i valori vengono calcolati ogni 100 g di piatto.') +
        (v ? '<div class="hl mb8"><b>Per 100 g:</b> ' + fmt(v.kcal || 0) + ' kcal · P ' + fmt(v.prot || 0, 1) + ' · C ' + fmt(v.carb || 0, 1) + ' · G ' + fmt(v.fat || 0, 1) + '</div><p class="xs mut mb8">Un nutriente viene incluso se è noto per almeno il 60% del peso degli ingredienti.</p>' : '') +
        '<button class="btn primary block" data-rsave="1">Salva ricetta</button>');
    }
    draw();
    const readTop = () => { const n = sh.body.querySelector('#rc-n'), c = sh.body.querySelector('#rc-c'); if (n) R.n = n.value; if (c) R.cookedG = c.value; };
    sh.body.addEventListener('change', e => {
      const g = e.target.closest('[data-rg]');
      readTop();
      if (g) { const x = UI.parseNum(g.value); R.items[+g.dataset.rg].g = isFinite(x) && x > 0 ? x : R.items[+g.dataset.rg].g; }
      draw();
    });
    sh.body.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.rd != null) { readTop(); R.items.splice(+b.dataset.rd, 1); draw(); }
      else if (b.dataset.radd) { readTop(); openSearch({ title: 'Ingrediente', onPick: f => { R.items.push({ f: f.id, g: 100 }); draw(); } }); }
      else if (b.dataset.rsave) {
        readTop();
        const v = per100();
        if (!R.n.trim()) return UI.toast('Scrivi il nome');
        if (!R.items.length) return UI.toast('Aggiungi gli ingredienti');
        if (!v) return UI.toast('Inserisci il peso dopo la cottura');
        S().customFoods.push({ id: 'c_' + Store.uid(''), n: R.n.trim(), cat: 'Ricette', v, an: {}, recipe: { items: R.items.map(i => ({ f: i.f, g: i.g })), cookedG: UI.parseNum(R.cookedG) } });
        Calc.invalidate(); Store.change(); sh.close(); UI.refresh(); UI.toast('Ricetta salvata tra i cibi miei');
      }
    });
  }
  UI.on('cibo.recipe', recipeSheet);

  /* ---------- pasti salvati ---------- */
  function mealsSheet() {
    const sh = UI.sheet({ title: 'Pasti salvati', cls: 'tall' });
    let target = guessMeal();
    function draw() {
      const day = Store.getDay(C.date);
      sh.set('<div class="card" style="margin-bottom:12px"><div class="field-l">Salva un pasto di oggi (' + esc(UI.dateLabel(C.date).toLowerCase()) + ')</div><div class="grid2">' + mealSelect('ms-m', target) + UI.inp({ id: 'ms-n', ph: 'Nome del pasto' }) + '</div><button class="btn block mt8" data-ms="save">Salva questo pasto</button></div>' +
        '<div class="sec-t" style="margin-top:4px">Aggiungi in</div>' + '<div class="mb8">' + mealSelect('ms-to', target) + '</div>' +
        (S().meals.length ? '<div class="list">' + S().meals.map(m => {
          let kc = 0; m.items.forEach(i => { const f = Calc.food(i.f); const k = f ? Calc.scaled(f, i.g, 'kcal') : null; if (k) kc += k; });
          return '<div class="li"><div class="li-main"><div class="li-t">' + esc(m.n) + '</div><div class="li-s">' + m.items.length + ' alimenti · ' + fmt(kc) + ' kcal</div>' + (m.steps && m.steps.length ? '<ol class="xs mut" style="margin:4px 0 0;padding-left:18px">' + m.steps.map(x => '<li>' + esc(x) + '</li>').join('') + '</ol>' : '') + '</div><button class="btn sm primary" data-ms="use" data-id="' + esc(m.id) + '">Aggiungi</button><button class="icon-btn sm" data-ms="del" data-id="' + esc(m.id) + '" aria-label="Elimina">' + UI.icon('trash', 18) + '</button></div>';
        }).join('') + '</div>' : UI.empty('Nessun pasto salvato.')));
      void day;
    }
    draw();
    sh.body.addEventListener('click', async e => {
      const b = e.target.closest('[data-ms]'); if (!b) return;
      const a = b.dataset.ms;
      if (a === 'save') {
        const m = sh.body.querySelector('#ms-m').value, n = sh.body.querySelector('#ms-n').value.trim();
        const items = Store.getDay(C.date).items.filter(i => i.m === m);
        if (!items.length) return UI.toast('Quel pasto è vuoto');
        if (!n) return UI.toast('Dai un nome al pasto');
        S().meals.push({ id: Store.uid('m'), n, items: items.map(i => ({ f: i.f, g: i.g })) });
        Store.change(); target = m; draw(); UI.toast('Pasto salvato');
      } else if (a === 'use') {
        const meal = S().meals.find(x => x.id === b.dataset.id); if (!meal) return;
        const to = sh.body.querySelector('#ms-to').value;
        const d = Store.ensureDay(C.date);
        meal.items.forEach(i => d.items.push({ id: Store.uid('e'), f: i.f, g: i.g, m: to }));
        Store.change(); UI.refresh(); sh.close(); UI.toast('Pasto aggiunto');
      } else if (a === 'del') {
        if (await UI.confirm({ title: 'Eliminare il pasto salvato?', ok: 'Elimina', danger: true })) { S().meals = S().meals.filter(x => x.id !== b.dataset.id); Store.change(); draw(); }
      }
    });
  }
  UI.on('cibo.meals', mealsSheet);

  /* ---------- codice a barre ---------- */
  let scriptP = null;
  function loadScript(src) {
    if (scriptP) return scriptP;
    scriptP = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { scriptP = null; rej(new Error('script')); }; document.head.appendChild(s); });
    return scriptP;
  }
  function offMap(n) {
    const g = k => (typeof n[k] === 'number' && isFinite(n[k]) ? n[k] : null);
    const mul = (k, m) => { const x = g(k); return x === null ? null : x * m; };
    const v = {};
    const put = (key, val) => { if (val !== null && val !== undefined && isFinite(val) && val >= 0) v[key] = Math.round(val * 1000) / 1000; };
    let kc = g('energy-kcal_100g'); if (kc === null && g('energy_100g') !== null) kc = g('energy_100g') / 4.184;
    put('kcal', kc); put('prot', g('proteins_100g')); put('carb', g('carbohydrates_100g')); put('fat', g('fat_100g'));
    put('fib', g('fiber_100g')); put('sug', g('sugars_100g')); put('sfa', g('saturated-fat_100g'));
    put('mufa', g('monounsaturated-fat_100g')); put('pufa', g('polyunsaturated-fat_100g')); put('o3', g('omega-3-fat_100g'));
    put('chol', mul('cholesterol_100g', 1000));
    let na = mul('sodium_100g', 1000); if (na === null) na = mul('salt_100g', 400);
    put('na', na);
    put('k', mul('potassium_100g', 1000)); put('ca', mul('calcium_100g', 1000)); put('mg', mul('magnesium_100g', 1000));
    put('p', mul('phosphorus_100g', 1000)); put('fe', mul('iron_100g', 1000)); put('zn', mul('zinc_100g', 1000));
    put('cu', mul('copper_100g', 1000)); put('mn', mul('manganese_100g', 1000)); put('se', mul('selenium_100g', 1e6));
    put('vitA', mul('vitamin-a_100g', 1e6)); put('vitC', mul('vitamin-c_100g', 1000)); put('vitD', mul('vitamin-d_100g', 1e6));
    put('vitE', mul('vitamin-e_100g', 1000)); put('vitK', mul('vitamin-k_100g', 1e6));
    put('b1', mul('vitamin-b1_100g', 1000)); put('b2', mul('vitamin-b2_100g', 1000)); put('b3', mul('vitamin-pp_100g', 1000));
    put('b5', mul('pantothenic-acid_100g', 1000)); put('b6', mul('vitamin-b6_100g', 1000));
    put('b9', mul('vitamin-b9_100g', 1e6)); put('b12', mul('vitamin-b12_100g', 1e6)); put('caff', mul('caffeine_100g', 1000));
    return v;
  }
  function offName(pr, code) {
    return ((pr.product_name_it || pr.product_name || 'Prodotto ' + code) + (pr.brands ? ' – ' + String(pr.brands).split(',')[0] : '')).trim();
  }
  /* foglio di conferma comune a codice a barre e ricerca per nome: salva solo al tocco su «Salva» */
  function offConfirm(sh, code, pr, v) {
    const name = offName(pr, code);
    sh.set('<div class="hl mb8"><b>Prodotto trovato</b><div class="small mut">Valori per 100 g da Open Food Facts</div></div>' + UI.field('Nome', UI.inp({ id: 'sc-n', value: name })) +
      '<div class="list mb8">' + ['kcal', 'prot', 'carb', 'fat', 'fib', 'sug', 'sfa', 'na'].map(k => '<div class="li" style="min-height:36px"><div class="li-main">' + D.NMAP[k].n + '</div><div class="li-r">' + (v[k] == null ? '<span class="mut">n.d.</span>' : fmt(v[k], D.NMAP[k].d) + ' ' + D.NMAP[k].u) + '</div></div>').join('') + '</div>' +
      '<p class="xs mut mb8">Nutrienti trovati: ' + Object.keys(v).length + ' su ' + D.NUTR.length + '. Gli altri restano «n.d.». Dati inseriti dalla comunità: controlla l\'etichetta.</p><button class="btn primary block" id="sc-save">Salva come cibo mio</button>');
    sh.body.querySelector('#sc-save').onclick = () => {
      const nm = sh.body.querySelector('#sc-n').value.trim() || name;
      const ex = S().customFoods.find(f => f.barcode === code);
      const f = ex || { id: 'c_' + Store.uid(''), n: nm, cat: 'Prodotti confezionati', v, an: {}, barcode: code, src: 'Open Food Facts' };
      if (!ex) { S().customFoods.push(f); Calc.invalidate(); Store.change(); }
      sh.close(); UI.refresh();
      qtySheet({ food: f, date: C.date, meal: guessMeal() });
    };
  }
  /* ricerca per nome su Open Food Facts: UNA richiesta per tocco */
  async function offSearch(text) {
    if (!navigator.onLine) return { err: 'Serve internet' };
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const t = setTimeout(() => { if (ctl) ctl.abort(); }, 15000);
    try {
      const r = await fetch('https://world.openfoodfacts.org/cgi/search.pl?search_terms=' + encodeURIComponent(text) + '&search_simple=1&action=process&json=1&page_size=20&fields=code,product_name,product_name_it,brands,nutriments,quantity&lc=it&cc=it', ctl ? { signal: ctl.signal } : undefined);
      if (r.status === 429) return { err: 'Troppe ricerche, riprova tra un minuto' };
      if (!r.ok) return { err: 'Open Food Facts non risponde (errore ' + r.status + '). Riprova più tardi.' };
      const j = await r.json();
      return { items: offParse(j) };
    } catch (e) {
      return { err: 'Open Food Facts non risponde (la ricerca per nome è spesso sovraccarica). Riprova più tardi, oppure usa il codice a barre o «Crea alimento».' };
    } finally { clearTimeout(t); }
  }
  function offParse(j) {
    const out = [];
    for (const pr of ((j && j.products) || [])) {
      const code = String(pr.code || '').replace(/\D/g, '');
      if (code.length < 6 || code.length > 14) continue;
      if (!(pr.product_name_it || pr.product_name)) continue;
      const v = offMap(pr.nutriments || {});
      if (v.kcal == null) continue;
      out.push({ code, pr, v });
    }
    return out;
  }
  C.offMap = offMap; C.offParse = offParse;
  async function lookupBarcode(code, sh) {
    code = String(code).replace(/\D/g, '');
    if (code.length < 6 || code.length > 14) return UI.toast('Codice non valido');
    const ex = S().customFoods.find(f => f.barcode === code);
    if (ex) { sh.close(); return qtySheet({ food: ex, date: C.date, meal: guessMeal() }); }
    if (!navigator.onLine) return UI.toast('Sei offline: la ricerca del codice richiede internet');
    const box = sh.body.querySelector('#sc-status'); box.textContent = 'Cerco il prodotto…';
    try {
      const r = await fetch('https://world.openfoodfacts.org/api/v2/product/' + code + '.json?fields=product_name,product_name_it,brands,nutriments,quantity');
      const j = await r.json();
      if (!j || j.status !== 1 || !j.product) { box.textContent = 'Prodotto non trovato su Open Food Facts. Puoi crearlo a mano con «Crea cibo».'; return; }
      const pr = j.product;
      const v = offMap(pr.nutriments || {});
      if (v.kcal == null) { box.textContent = 'Il prodotto non ha i valori nutrizionali. Puoi crearlo a mano con «Crea cibo».'; return; }
      box.textContent = '';
      offConfirm(sh, code, pr, v);
    } catch (e) {
      box.textContent = 'Non riesco a contattare Open Food Facts. Controlla la connessione.';
    }
  }
  function scanSheet() {
    let scanner = null;
    const stop = () => { if (scanner) { const s = scanner; scanner = null; try { s.stop().then(() => s.clear()).catch(() => { }); } catch (e) { /* ignora */ } } };
    const sh = UI.sheet({
      title: 'Codice a barre', cls: 'tall', onClose: stop,
      html: '<div id="sc-box" class="scanbox"></div><p class="small mut mb8" id="sc-status">Inquadra il codice a barre del prodotto.</p>' +
        UI.field('Oppure scrivi il codice', '<div class="row gap"><input class="inp" id="sc-code" inputmode="numeric" placeholder="es. 8000500310427"><button class="btn primary" id="sc-go">Cerca</button></div>')
    });
    sh.body.querySelector('#sc-go').onclick = () => { stop(); lookupBarcode(sh.body.querySelector('#sc-code').value, sh); };
    const status = sh.body.querySelector('#sc-status');
    if (!navigator.onLine) { status.textContent = 'Sei offline: la ricerca del prodotto richiede internet.'; }
    loadScript('vendor/html5-qrcode.min.js').then(() => {
      if (sh.closed) return;
      const F = window.Html5QrcodeSupportedFormats;
      scanner = new Html5Qrcode('sc-box', { formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E], verbose: false });
      return scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 260, height: 150 } }, code => { stop(); lookupBarcode(code, sh); }, () => { });
    }).catch(() => { status.textContent = 'Fotocamera non disponibile o permesso negato: scrivi il codice a mano qui sotto.'; });
  }
  UI.on('cibo.scan', scanSheet);

  /* ---------- proponi giornata ---------- */
  const KW = {
    bfProt: ['yogurt greco', 'yogurt bianco', 'uovo intero', 'albume', 'ricotta', 'fiocchi di latte', 'latte parzialmente'],
    bfCarb: ["fiocchi d'avena", 'pane integrale', 'pane ai cereali', 'granola'],
    fruit: ['mele', 'banane', 'arance', 'kiwi', 'fragole', 'mirtilli', 'pesche', 'albicocche', 'ananas', 'clementine'],
    prot: ['petto di pollo', 'petto di tacchino', 'fesa di manzo', 'girello', 'merluzzo', 'salmone', 'tonno al naturale', 'tonno pinna', 'spigola', 'gamberi', 'sogliola', 'uovo intero', 'albume', 'ricotta', 'lenticchie', 'ceci'],
    carb: ['riso bianco', 'riso parboiled', 'pasta di semola', 'pasta integrale', 'patate', 'farro', 'orzo', 'couscous', 'quinoa', 'pane integrale', 'polenta'],
    veg: ['spinaci', 'zucchine', 'broccoli', 'lattuga', 'pomodori maturi', 'carote', 'finocchi', 'peperoni', 'cavolfiore', 'fagiolini', 'asparagi', 'melanzane', 'bietole', 'rucola', 'verza', 'cetrioli'],
    fat: ['olio extravergine', 'olio di oliva'],
    nuts: ['noci', 'mandorle', 'nocciole'],
    snackProt: ['yogurt greco', 'yogurt bianco', 'fiocchi di latte', 'ricotta']
  };
  function pool(keys, needProt) {
    const p = S().prefs;
    const list = Calc.findFoodByWords(keys, { needKcal: true }).filter(f => !Calc.isExcluded(f.id) && (!needProt || Calc.foodVal(f, 'prot') >= 8) && Calc.foodVal(f, 'kcal') > 20);
    return list.map(f => ({ f, w: (p.proteins.indexOf(f.id) >= 0 ? 6 : 1) * (p.fav.indexOf(f.id) >= 0 ? 4 : 1) }));
  }
  function pick(keys, needProt, avoidIds) {
    let items = pool(keys, needProt).filter(x => !(avoidIds || []).includes(x.f.id));
    if (needProt) { // aggiunge le proteine preferite anche se il nome non coincide
      const extra = S().prefs.proteins.map(Calc.food).filter(f => f && Calc.foodVal(f, 'kcal') && !Calc.isExcluded(f.id) && !items.some(x => x.f.id === f.id) && !(avoidIds || []).includes(f.id)).map(f => ({ f, w: 6 }));
      items = items.concat(extra);
    }
    if (!items.length) return null;
    const tot = items.reduce((a, b) => a + b.w, 0);
    let r = Math.random() * tot;
    for (const x of items) { r -= x.w; if (r <= 0) return x.f; }
    return items[0].f;
  }
  function pickSeq(keys) { for (const k of keys) { const f = pick([k], false); if (f) return f; } return null; }
  function r5(x) { return Math.max(5, Math.round(x / 5) * 5); }
  function buildMeal(share, tg, type, used) {
    const kT = share * tg.kcal, pT = share * tg.prot;
    const items = [];
    const kc = f => Calc.foodVal(f, 'kcal') / 100, pr = f => (Calc.foodVal(f, 'prot') || 0) / 100;
    let kFixed = 0, pFixed = 0;
    const addFixed = (f, g) => { if (!f) return; items.push({ f: f.id, g: r5(g) }); kFixed += kc(f) * g; pFixed += pr(f) * g; };
    // role: 'p' = fonte principale di proteine, 'c' = fonte principale di carboidrati (servono a riequilibrare la giornata)
    const addVar = (f, g, role) => { items.push({ f: f.id, g: r5(g), s: true, role: role }); };
    if (type === 'colazione') {
      addFixed(pick(KW.fruit, false), 120);
      const bp = pick(KW.bfProt, false), bc = pick(KW.bfCarb, false);
      if (bp) { const g = Math.max(80, Math.min(300, pr(bp) > 0 ? ((pT - pFixed) * 0.7) / pr(bp) : 150)); addVar(bp, g, 'p'); kFixed += kc(bp) * r5(g); }
      if (bc) addVar(bc, Math.max(20, Math.min(120, (kT - kFixed) / kc(bc))), 'c');
    } else if (type === 'spuntini') {
      const fr = pick(KW.fruit, false); if (fr) addFixed(fr, 150);
      const sp = pick(KW.snackProt, false) || pick(KW.nuts, false);
      if (sp) addVar(sp, Math.max(20, Math.min(200, (kT - kFixed) / kc(sp))), 'p');
    } else {
      const veg = pick(KW.veg, false); if (veg) addFixed(veg, 180);
      const oil = pickSeq(KW.fat); if (oil) addFixed(oil, 10);
      const pf = pick(KW.prot, true, used);
      const cf = pick(KW.carb, false);
      if (pf) {
        used.push(pf.id);
        const g = Math.max(50, Math.min(320, (pT - pFixed) * 0.8 / Math.max(0.01, pr(pf))));
        addVar(pf, g, 'p'); kFixed += kc(pf) * r5(g);
      }
      if (cf) addVar(cf, Math.max(40, Math.min(400, (kT - kFixed) / kc(cf))), 'c');
    }
    // correzione finale: porta le kcal del pasto vicino all'obiettivo agendo solo sugli ingredienti principali
    let k = 0, ks = 0;
    items.forEach(i => { const f = Calc.food(i.f); const x = kc(f) * i.g; k += x; if (i.s) ks += x; });
    if (ks > 0) {
      const fac = Math.max(0.6, Math.min(1.8, (kT - (k - ks)) / ks));
      items.forEach(i => { if (i.s) i.g = Math.min(600, r5(i.g * fac)); });
    }
    items.forEach(i => { delete i.s; });
    return items;
  }
  function planTotals(plan) {
    const t = { kcal: 0, prot: 0, carb: 0, fat: 0 };
    Object.keys(plan).forEach(m => plan[m].forEach(i => { const f = Calc.food(i.f); ['kcal', 'prot', 'carb', 'fat'].forEach(k => { const x = f ? Calc.scaled(f, i.g, k) : null; if (x) t[k] += x; }); }));
    return t;
  }
  /* riequilibra la giornata: prima le proteine (obiettivo ±10 g), poi le kcal agendo sui carboidrati */
  function balance(plan, tg) {
    const all = [];
    Object.keys(plan).forEach(m => plan[m].forEach(i => all.push(i)));
    const sum = (role, k) => all.reduce((a, i) => { if (i.role !== role) return a; const f = Calc.food(i.f); const x = f ? Calc.scaled(f, i.g, k) : 0; return a + (x || 0); }, 0);
    const scale = (role, fac, lo, hi) => all.forEach(i => { if (i.role === role) i.g = Math.max(lo, Math.min(hi, r5(i.g * fac))); });
    const ok = () => { const t = planTotals(plan); return Math.abs(tg.prot - t.prot) <= 8 && Math.abs(tg.kcal - t.kcal) <= 0.05 * tg.kcal; };
    for (let n = 0; n < 16 && !ok(); n++) {
      const dp = tg.prot - planTotals(plan).prot, P = sum('p', 'prot');
      if (Math.abs(dp) > 4 && P > 0) scale('p', Math.max(0.6, Math.min(1.8, 1 + dp / P)), 20, 450);
      const dk = tg.kcal - planTotals(plan).kcal, K = sum('c', 'kcal');
      if (K > 0) scale('c', Math.max(0.4, Math.min(2, 1 + dk / K)), 20, 600);
    }
  }
  function propose() {
    const tg = Calc.targets(C.date);
    const plan = {}, used = [];
    plan.colazione = buildMeal(0.25, tg, 'colazione', used);
    plan.pranzo = buildMeal(0.35, tg, 'pranzo', used);
    plan.cena = buildMeal(0.30, tg, 'cena', used);
    plan.spuntini = buildMeal(0.10, tg, 'spuntini', used);
    balance(plan, tg);
    // se le proteine mancano ancora di oltre 10 g aggiungo un'altra fonte proteica leggera e riprovo
    if (tg.prot - planTotals(plan).prot > 10) {
      const sp = pick(KW.snackProt, false);
      if (sp) { plan.spuntini.push({ f: sp.id, g: 150, role: 'p' }); balance(plan, tg); }
    }
    return plan;
  }
  function proposeSheet() {
    if (!Calc.allFoods().length) return UI.toast('Serve il database alimenti (o dei cibi tuoi)');
    const tg = Calc.targets(C.date);
    const sh = UI.sheet({ title: 'Proponi giornata', cls: 'tall' });
    C.plan = propose();
    function draw() {
      const t = planTotals(C.plan);
      const empty = Object.keys(C.plan).every(m => !C.plan[m].length);
      if (empty) { sh.set(UI.empty('Non trovo abbastanza alimenti adatti nel database (servono cibi come pollo, riso, pasta, uova, yogurt, verdure…). Puoi aggiungere cibi tuoi.')); return; }
      sh.set('<div class="disc mb8">Proposta per <b>' + fmt(tg.kcal) + ' kcal</b> e <b>' + fmt(tg.prot) + ' g</b> di proteine, con i tuoi preferiti e senza gli alimenti che non ti piacciono o da evitare. Grammi approssimati: aggiustali nel diario.</div>' +
        D.MEALS.map(m => {
          const items = C.plan[m[0]];
          let kc = 0; items.forEach(i => { const f = Calc.food(i.f); const k = f ? Calc.scaled(f, i.g, 'kcal') : 0; if (k) kc += k; });
          return '<div class="card" style="padding:12px"><div class="card-h" style="margin-bottom:4px"><h3>' + m[1] + '</h3><div class="card-r"><b>' + fmt(kc) + '</b> kcal</div></div>' +
            (items.length ? items.map(i => { const f = Calc.food(i.f); return '<div class="li" style="min-height:40px"><div class="li-main"><div class="li-t">' + esc(f.n) + '</div></div><div class="li-r">' + i.g + ' g</div></div>'; }).join('') : '<div class="li-s">–</div>') + '</div>';
        }).join('') +
        '<div class="hl mb8">Totale: <b>' + fmt(t.kcal) + '</b> kcal · P ' + fmt(t.prot) + ' g · C ' + fmt(t.carb) + ' g · G ' + fmt(t.fat) + ' g</div>' +
        '<div class="row gap"><button class="btn grow" id="pp-re">Rimescola</button><button class="btn primary grow" id="pp-add">Aggiungi al diario</button></div><button class="btn block mt8" id="pp-shop">Lista della spesa</button>');
      sh.body.querySelector('#pp-shop').onclick = () => shopSheet(C.plan);
      sh.body.querySelector('#pp-re').onclick = () => { C.plan = propose(); draw(); };
      sh.body.querySelector('#pp-add').onclick = () => {
        const d = Store.ensureDay(C.date);
        D.MEALS.forEach(m => C.plan[m[0]].forEach(i => d.items.push({ id: Store.uid('e'), f: i.f, g: i.g, m: m[0] })));
        Store.change(); UI.refresh(); sh.close(); UI.toast('Giornata aggiunta al diario');
      };
    }
    draw();
  }
  UI.on('cibo.propose', proposeSheet);

  /* ---------- lista della spesa ---------- */
  function r10(g) { return g >= 1000 ? Math.round(g / 50) * 50 : g >= 100 ? Math.round(g / 10) * 10 : Math.max(5, Math.round(g / 5) * 5); }
  /* alimento cotto -> stesso alimento crudo/secco (chiave = nome senza parole di cottura/crudo), per la spesa */
  const COOKED_RE = /cott|lessat|bollit|arrost|grigliat/, RAWW_RE = /crud|secc/;
  const STRIPW_RE = /\b(cott[aeio]|bollit[aeio]|lessat[aeio]|arrost[aeio]|grigliat[aeio]|crud[aeio]|secc(?:o|a|hi|he))\b/g;
  const rawKey = nn => nn.replace(STRIPW_RE, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
  function rawIndex() {
    const m = {};
    Calc.allFoods().forEach(f => {
      const nn = Calc.norm(f.n); if (!RAWW_RE.test(nn) || COOKED_RE.test(nn) || Calc.foodVal(f, 'kcal') === null) return;
      const k = rawKey(nn); if (!m[k] || (/crud/.test(nn) && !/crud/.test(Calc.norm(m[k].n)))) m[k] = f;
    });
    return m;
  }
  function rawOf(f, idx) {
    const nn = Calc.norm(f.n); if (!COOKED_RE.test(nn) || RAWW_RE.test(nn) || !(Calc.foodVal(f, 'kcal') > 0)) return null;
    const r = idx[rawKey(nn)];
    return r && Calc.foodVal(r, 'kcal') > 0 ? r : null;
  }
  function shopBuild(plan, days) {
    const tot = {}, idx = rawIndex();
    Object.keys(plan).forEach(m => plan[m].forEach(i => {
      let id = i.f, g = i.g * days; const f = Calc.food(id), r = f ? rawOf(f, idx) : null;
      if (r) { g = g * Calc.foodVal(f, 'kcal') / Calc.foodVal(r, 'kcal'); id = r.id; }
      tot[id] = (tot[id] || 0) + g;
    }));
    return Object.keys(tot).map(id => ({ f: id, g: r10(tot[id]) }));
  }
  function shopLine(it) {
    const f = Calc.food(it.f); if (!f) return null;
    const pc = /liquid|pastorizzat/.test(Calc.norm(f.n)) ? null : Portions.forFood(f, []).find(p => p.pc);
    const gTxt = it.g >= 1000 ? UI.fmtA(it.g / 1000, 2) + ' kg' : UI.fmtA(it.g) + ' g';
    let t = f.n + ': ';
    if (pc) { const n = Math.max(1, Math.round(it.g / pc.g)); t += n + ' ' + Portions.pluralOf(pc.label, n) + ' (' + gTxt + ')'; } else t += gTxt;
    return { f, t };
  }
  function shopText(sh0) {
    const by = {};
    sh0.items.forEach(it => { const l = shopLine(it); if (l) (by[l.f.cat || 'Altro'] = by[l.f.cat || 'Altro'] || []).push((sh0.checked[it.f] ? '[x] ' : '[ ] ') + l.t); });
    return 'Lista della spesa (' + sh0.days + (sh0.days === 1 ? ' giorno' : ' giorni') + ')\n' + Object.keys(by).sort().map(c => '\n' + c.toUpperCase() + '\n' + by[c].join('\n')).join('\n');
  }
  let lastPlan = null;
  function shopSheet(plan, fx) {
    const st = S().shopping;
    if (fx) {
      st.checked = {}; st.days = fx.days; st.items = fx.items.map(i => ({ f: i.f, g: i.g })); st.date = Store.today(); lastPlan = null;
    } else if (plan) {
      if (plan !== lastPlan || !st.items.length) { lastPlan = plan; st.checked = {}; }
      st.items = shopBuild(plan, st.days || 3); st.date = Store.today();
    } else if (!st.items.length) return UI.toast('Prima crea una proposta con «Proponi giornata»');
    Store.change();
    const sh = UI.sheet({ title: 'Lista della spesa', cls: 'tall' });
    function draw() {
      const by = {};
      st.items.forEach(it => { const l = shopLine(it); if (l) (by[l.f.cat || 'Altro'] = by[l.f.cat || 'Altro'] || []).push({ it, l }); });
      sh.set((fx ? '<p class="small mut mb8">Quantità per i ' + fx.days + ' giorni del piano</p>' : plan ? UI.seg([[1, '1 giorno'], [3, '3 giorni'], [7, '7 giorni']], st.days, 'noop') : '<p class="small mut mb8">Lista salvata (' + st.days + ' giorni).</p>') +
        Object.keys(by).sort().map(c => '<div class="shop-cat">' + esc(c) + '</div>' + by[c].map(x => '<button class="shop-row' + (st.checked[x.it.f] ? ' done' : '') + '" data-sf="' + esc(x.it.f) + '"><span class="shop-box">' + (st.checked[x.it.f] ? UI.icon('check', 16) : '') + '</span><span class="li-main">' + esc(x.l.t) + '</span></button>').join('')).join('') +
        '<div class="row gap mt16"><button class="btn grow" id="sp-copy">Copia</button><button class="btn primary grow" id="sp-share">Condividi</button></div>' +
        '<button class="btn ghost block mt8" id="sp-clear">Togli tutte le spunte</button><p class="xs mut mt8">Quantità per ' + st.days + (st.days === 1 ? ' giorno' : ' giorni') + (fx ? ' del piano' : ' della proposta') + ', arrotondate. Le spunte restano salvate.</p>');
    }
    draw();
    sh.body.addEventListener('click', async e => {
      const sg = e.target.closest('[data-v]');
      if (sg && plan && !fx) { st.days = +sg.dataset.v; st.items = shopBuild(plan, st.days); Store.change(); draw(); return; }
      const row = e.target.closest('[data-sf]');
      if (row) { const id = row.dataset.sf; if (st.checked[id]) delete st.checked[id]; else st.checked[id] = true; Store.change(); draw(); return; }
      if (e.target.closest('#sp-clear')) { st.checked = {}; Store.change(); draw(); return; }
      if (e.target.closest('#sp-copy')) { UI.toast(await UI.copyText(shopText(st)) ? 'Lista copiata' : 'Copia non riuscita'); return; }
      if (e.target.closest('#sp-share')) {
        try { if (navigator.share) { await navigator.share({ title: 'Lista della spesa', text: shopText(st) }); return; } } catch (err) { if (err && err.name === 'AbortError') return; }
        UI.toast(await UI.copyText(shopText(st)) ? 'Condivisione non disponibile: lista copiata' : 'Condivisione non disponibile');
      }
    });
  }
  C.shopSheet = shopSheet; C.shopBuild = shopBuild; C.KW = KW; C.r10 = r10; C.rawKey = rawKey; C.rawIndex = rawIndex; C.rawOf = rawOf;
  UI.acts.noop = () => { };
  UI.on('cibo.shopOpen', () => shopSheet(null));

  /* aggiunta di più voci in una volta (conferma da voce/foto) */
  C.addItems = function (date, list) {
    const d = Store.ensureDay(date), meta = S().meta;
    list.forEach(x => {
      d.items.push(Object.assign({ id: Store.uid('e'), f: x.f, g: x.g, m: x.m }, x.pl ? { pq: x.pq, pl: x.pl } : {}));
      meta.recents = [x.f].concat((meta.recents || []).filter(y => y !== x.f)).slice(0, 40);
      meta.lastQty[x.f] = x.g;
    });
    Store.change();
  };
  C.guessMeal = guessMeal;

  window.Cibo = C;
})();
