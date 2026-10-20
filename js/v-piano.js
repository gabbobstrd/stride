/* Compagno - Piano settimanale: Gemini propone i piatti, l'app valida, scala le quantità e calcola kcal e macro */
(function () {
  'use strict';
  const esc = UI.esc, fmt = UI.fmt, S = () => Store.s;
  const P = { day: 0, busy: false, sh: null };
  const SHARES = { colazione: 0.25, pranzo: 0.35, cena: 0.30, spuntini: 0.10 };
  const NOPT = { colazione: 2, pranzo: 3, cena: 3, spuntini: 2 };

  /* ---------- allergeni (filtro sul nome dell'alimento, in italiano) ---------- */
  const ALG = [
    ['glutine', 'Glutine', /\b(pasta|pane|farro|orzo|couscous|frumento|grano|segale|avena|seitan|bulgur|semola|pizza|cracker)\b|spaghett|penne|fusill|maccheron|tagliatell|rigaton|tortellin|ravioli|gnocchi|lasagn|biscott|fette biscottate|panett|pandoro|panin|piadin|grissin|focacc|brioche|cornett|merendin|crostat|torta|muesli|granola|pangrattato|farina(?! di (riso|mais|ceci))/],
    ['crostacei', 'Crostacei', /gamber|scamp|aragost|grancho|granchi|astice/],
    ['uova', 'Uova', /\buov|albume|tuorlo|frittata/],
    ['pesce', 'Pesce', /merluzz|salmon|tonno|spigol|orata|sogliol|acciug|sardin|pesce|trota|baccal|sgombr|alici|branzin|dentice|nasello|platessa|cernia|palombo|rombo|triglia|aringa|pesce spada|stoccafiss|halibut|eglefino/],
    ['arachidi', 'Arachidi', /arachid/],
    ['soia', 'Soia', /soia|tofu|edamame|tempeh/],
    ['latte', 'Latte e derivati', /latte(?! di (soia|mandorl|riso|avena|cocco))|yogurt|formagg|ricotta|mozzarella|parmigian|grana|burro(?! di (arachidi|cacao|mandorl|karite))|panna|fiocchi di latte|stracchino|kefir|whey|siero|mascarpone|gorgonzola|pecorino|emmental|fontina|provol|scamorza|burrata|crescenza|feta|caciott|asiago|taleggio|caciocavallo|besciamella|gelato/],
    ['guscio', 'Frutta a guscio', /\bnoci\b|\bnoce\b|mandorl|nocciol|pistacch|anacard|pinoli/],
    ['sedano', 'Sedano', /sedano/],
    ['senape', 'Senape', /senape/],
    ['sesamo', 'Sesamo', /sesamo|tahin/],
    ['solfiti', 'Solfiti', /\bvino\b|aceto|frutta secca|albicocche secche|uvetta/],
    ['lupini', 'Lupini', /lupin/],
    ['molluschi', 'Molluschi', /cozz|vongol|calamar|polpo|seppi|ostric/]
  ];
  /* nome già normalizzato (minuscolo, senza accenti) + chiavi allergeni scelte -> true se il nome contiene l'allergene */
  function allergenHit(name, keys) {
    if (!keys || !keys.length) return false;
    const nn = Calc.norm(name);
    return ALG.some(a => keys.indexOf(a[0]) >= 0 && a[2].test(nn) && !(a[0] === 'glutine' && /senza glutine/.test(nn)));
  }

  /* ---------- alimenti candidati ---------- */
  function candidates() {
    const p = S().prefs, al = p.allergens || [], seen = new Set(), out = [];
    const add = f => {
      if (!f || out.length >= 250 || seen.has(f.id)) return;
      if (Calc.isExcluded(f.id) || !(Calc.foodVal(f, 'kcal') > 0) || allergenHit(f.n, al)) return;
      seen.add(f.id); out.push(f);
    };
    (p.fav || []).forEach(id => add(Calc.food(id)));
    (p.proteins || []).forEach(id => add(Calc.food(id)));
    ((S().meta.recents) || []).forEach(id => add(Calc.food(id)));
    const pools = Object.keys(Cibo.KW).map(k => Calc.findFoodByWords(Cibo.KW[k], { needKcal: true }));
    for (let i = 0; out.length < 250 && pools.some(l => i < l.length); i++) pools.forEach(l => { if (i < l.length) add(l[i]); });
    return out;
  }
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const r5 = x => Math.max(5, Math.round(x / 5) * 5);
  const isFat = f => /^olio|^burro/.test(Calc.norm(f.n));
  function optKcal(items) { return items.reduce((a, i) => { const f = Calc.food(i.f); return a + ((f && Calc.scaled(f, i.g, 'kcal')) || 0); }, 0); }
  function optTot(items) {
    const t = { kcal: 0, prot: 0, carb: 0, fat: 0 };
    items.forEach(i => { const f = Calc.food(i.f); if (f) ['kcal', 'prot', 'carb', 'fat'].forEach(k => { t[k] += Calc.scaled(f, i.g, k) || 0; }); });
    return t;
  }

  /* ---------- chiamata a Gemini ---------- */
  const STR = { type: 'STRING' };
  const OPTS = { type: 'ARRAY', items: { type: 'OBJECT', properties: { n: STR, items: { type: 'ARRAY', items: { type: 'OBJECT', properties: { id: STR, g: { type: 'NUMBER' } }, required: ['id', 'g'] } }, steps: { type: 'ARRAY', items: STR } }, required: ['n', 'items', 'steps'] } };
  const SCHEMA = { type: 'OBJECT', properties: { days: { type: 'ARRAY', items: { type: 'OBJECT', properties: { colazione: OPTS, pranzo: OPTS, cena: OPTS, spuntini: OPTS }, required: ['colazione', 'pranzo', 'cena', 'spuntini'] } } }, required: ['days'] };

  async function generate() {
    const cands = candidates();
    if (cands.length < 15) throw new Error('Servono più alimenti nel database (o cibi tuoi) per creare il piano.');
    const today = Store.today(), dates = [], tgs = [];
    for (let i = 0; i < 7; i++) { const d = Store.addDays(today, i), tg = Calc.targets(d); if (!tg) throw new Error('Completa prima il profilo (obiettivi giornalieri).'); dates.push(d); tgs.push(tg); }
    const byId = {}; cands.forEach(f => { byId[f.id] = f; });
    const pr = S().profile || {}, notes = (S().prefs.notes || '').trim();
    const prompt = 'Crea un piano alimentare di 7 giorni (il giorno 1 è oggi) di cucina casalinga italiana/mediterranea, varia nell\'arco della settimana: non ripetere la stessa proteina principale in pasti consecutivi.\n' +
      'Per ogni giorno dai le opzioni: colazione ' + NOPT.colazione + ', pranzo ' + NOPT.pranzo + ', cena ' + NOPT.cena + ', spuntini ' + NOPT.spuntini + ' (ogni opzione è un piatto alternativo agli altri dello stesso pasto).\n' +
      'Usa SOLO gli id di questo elenco (id|nome|kcal per 100 g|proteine per 100 g). I grammi devono essere coerenti con il nome: se l\'alimento è «crudo» i grammi sono peso crudo, se è «cotto» peso cotto. 2-6 alimenti per opzione. ' +
      'n = nome breve del piatto; steps = da 2 a 4 frasi brevi in italiano per prepararlo. NON calcolare kcal o nutrienti: li calcola l\'app.\n' +
      'Obiettivo: ' + (pr.goal || 'non indicato') + '. Ripartizione delle kcal del giorno: colazione 25%, pranzo 35%, cena 30%, spuntini 10%.\n' +
      'Obiettivi per giorno (kcal, proteine g):\n' + dates.map((d, i) => (i + 1) + ') ' + d + ': ' + Math.round(tgs[i].kcal) + ' kcal, ' + Math.round(tgs[i].prot) + ' g').join('\n') +
      (notes ? '\nNote dell\'utente: ' + notes : '') +
      '\n\nAlimenti disponibili:\n' + cands.map(f => f.id + '|' + f.n + '|' + Math.round(Calc.foodVal(f, 'kcal')) + '|' + (Math.round((Calc.foodVal(f, 'prot') || 0) * 10) / 10)).join('\n');
    const res = await AI.json({ prompt, schema: SCHEMA, temperature: 0.6, system: 'Sei un nutrizionista che scrive piani settimanali pratici in italiano. Rispondi solo con il JSON richiesto e usa esclusivamente gli id forniti.' });
    const days = Array.isArray(res && res.days) ? res.days.slice(0, 7) : [];
    let total = 0;
    const plan = { start: today, days: dates.map((date, di) => {
      const src = days[di] || {}, day = { date, meals: {}, pick: {} };
      D.MEALS.forEach(m => {
        const k = m[0];
        day.pick[k] = 0;
        day.meals[k] = (Array.isArray(src[k]) ? src[k] : []).map(o => {
          const items = (Array.isArray(o && o.items) ? o.items : []).filter(i => i && byId[i.id] && +i.g > 0 && +i.g <= 1000).map(i => ({ f: i.id, g: +i.g }));
          if (!items.length) return null;
          const kc = optKcal(items), fac = kc > 0 ? clamp(SHARES[k] * tgs[di].kcal / kc, 0.6, 1.6) : 1;
          items.forEach(i => { if (!isFat(byId[i.f])) i.g = r5(i.g * fac); });
          return { n: String((o && o.n) || 'Piatto').trim().slice(0, 80) || 'Piatto', items, steps: (Array.isArray(o.steps) ? o.steps : []).map(x => String(x).trim()).filter(Boolean).slice(0, 6) };
        }).filter(Boolean);
        total += day.meals[k].length;
      });
      return day;
    }) };
    if (!total) throw new Error('Gemini non ha prodotto un piano valido. Riprova.');
    return plan;
  }

  /* ---------- vista ---------- */
  function dayLabel(date) { return D.DAYS_IT[(Store.parseKey(date).getDay() + 6) % 7] + ' ' + Store.parseKey(date).getDate(); }
  function draw() {
    const sh = P.sh; if (!sh || sh.closed) return;
    const p = S().prefs, al = p.allergens || [], wp = S().weekPlan;
    let h = '<div class="sec-t" style="margin-top:0">Allergeni da evitare</div><div class="chips mb8">' + ALG.map(a => '<button class="chip sm' + (al.indexOf(a[0]) >= 0 ? ' on' : '') + '" data-al="' + a[0] + '">' + esc(a[1]) + '</button>').join('') + '</div>' +
      '<div class="disc mb12">Il filtro guarda solo il nome degli alimenti: per un\'allergia vera leggi sempre l\'etichetta.</div>' +
      '<button class="btn primary block mb12" data-pa="gen">' + (wp ? 'Rifai il piano' : 'Crea il piano della settimana') + '</button>';
    if (P.busy) h = '<p class="center mut mt16">Gemini sta preparando la settimana… può volerci un minuto</p>';
    else if (wp && wp.days && wp.days.length) {
      if (P.day >= wp.days.length) P.day = 0;
      const day = wp.days[P.day], tg = Calc.targets(day.date);
      h += '<div class="seg mb8">' + wp.days.map((d, i) => '<button class="' + (i === P.day ? 'on' : '') + '" data-pd="' + i + '">' + esc(dayLabel(d.date)) + '</button>').join('') + '</div>';
      const tot = { kcal: 0, prot: 0, carb: 0, fat: 0 };
      D.MEALS.forEach(m => {
        const k = m[0], opts = day.meals[k] || [];
        if (!opts.length) { h += UI.card(m[1], '<div class="li-s">Nessuna opzione</div>'); return; }
        const pi = clamp(day.pick[k] || 0, 0, opts.length - 1), o = opts[pi], t = optTot(o.items);
        Object.keys(tot).forEach(x => { tot[x] += t[x]; });
        h += UI.card(m[1],
          (opts.length > 1 ? '<div class="seg mb8">' + opts.map((_, i) => '<button class="' + (i === pi ? 'on' : '') + '" data-po="' + i + '" data-m="' + k + '">Opzione ' + (i + 1) + '</button>').join('') + '</div>' : '') +
          '<div class="li-t mb8"><b>' + esc(o.n) + '</b></div>' +
          o.items.map(i => { const f = Calc.food(i.f); return '<div class="li" style="min-height:40px"><div class="li-main"><div class="li-t">' + esc(f ? f.n : '?') + '</div></div><div class="li-r">' + esc(Portions.fmtItem({ g: i.g })) + '</div></div>'; }).join('') +
          (o.steps.length ? '<ol class="small mut" style="margin:8px 0 0;padding-left:20px">' + o.steps.map(x => '<li>' + esc(x) + '</li>').join('') + '</ol>' : '') +
          '<div class="row gap6 mt8"><button class="btn sm grow primary" data-pa="eat" data-m="' + k + '">Mangiato questo</button><button class="btn sm grow" data-pa="save" data-m="' + k + '">Salva come ricetta</button></div>',
          { right: '<b>' + fmt(t.kcal) + '</b> kcal · P ' + fmt(t.prot) + ' g' });
      });
      h += '<div class="hl mb8">Totale: <b>' + fmt(tot.kcal) + '</b>' + (tg ? ' / ' + fmt(tg.kcal) : '') + ' kcal · P ' + fmt(tot.prot) + (tg ? ' / ' + fmt(tg.prot) : '') + ' g · C ' + fmt(tot.carb) + ' g · G ' + fmt(tot.fat) + ' g</div>' +
        '<p class="xs mut mb8">Kcal e macro sono calcolati dall\'app sui grammi; le quantità sono scalate sul tuo obiettivo.</p>' +
        '<button class="btn block" data-pa="shop">Lista della spesa della settimana</button>';
    }
    sh.set(h);
  }
  function pickOpt(day, k) { const o = day.meals[k] || []; return o.length ? o[clamp(day.pick[k] || 0, 0, o.length - 1)] : null; }

  async function onClick(e) {
    const wp = S().weekPlan, p = S().prefs;
    const al = e.target.closest('[data-al]');
    if (al) { p.allergens = p.allergens || []; const i = p.allergens.indexOf(al.dataset.al); if (i >= 0) p.allergens.splice(i, 1); else p.allergens.push(al.dataset.al); Store.change(); draw(); return; }
    const pd = e.target.closest('[data-pd]');
    if (pd) { P.day = +pd.dataset.pd; draw(); return; }
    const po = e.target.closest('[data-po]');
    if (po && wp) { wp.days[P.day].pick[po.dataset.m] = +po.dataset.po; Store.change(); draw(); return; }
    const b = e.target.closest('[data-pa]'); if (!b) return;
    const a = b.dataset.pa;
    if (a === 'gen') {
      if (P.busy) return;
      if (!AI.hasKey()) return UI.toast('Serve la chiave Gemini (gratis): aggiungila in Altro → Impostazioni AI.');
      if (wp && !await UI.confirm({ title: 'Rifare il piano?', msg: 'Il piano attuale verrà sostituito.', ok: 'Rifai' })) return;
      P.busy = true; draw();
      try {
        const plan = await generate();
        S().weekPlan = plan; P.day = 0; Store.change();
        if (P.sh && P.sh.closed) UI.toast('Piano della settimana pronto');
      } catch (err) { UI.toast(err && err.message ? err.message : 'Qualcosa non ha funzionato', 4000); }
      P.busy = false; draw();
      return;
    }
    if (!wp) return;
    const day = wp.days[P.day];
    if (a === 'eat') {
      const o = pickOpt(day, b.dataset.m); if (!o) return;
      Cibo.addItems(Store.today(), o.items.map(i => ({ f: i.f, g: i.g, m: b.dataset.m })));
      UI.refresh(); UI.toast('Aggiunto al diario di oggi');
    } else if (a === 'save') {
      const o = pickOpt(day, b.dataset.m); if (!o) return;
      if (S().meals.some(m => m.n === o.n)) return UI.toast('«' + o.n + '» è già in Pasti salvati');
      S().meals.push({ id: Store.uid('m'), n: o.n, items: o.items.map(i => ({ f: i.f, g: i.g })), steps: o.steps.slice() });
      Store.change(); UI.toast('Salvato in Pasti salvati');
    } else if (a === 'shop') {
      const all = [];
      wp.days.forEach(d => D.MEALS.forEach(m => { const o = pickOpt(d, m[0]); if (o) o.items.forEach(i => all.push({ f: i.f, g: i.g })); }));
      if (!all.length) return UI.toast('Il piano è vuoto');
      Cibo.shopSheet(null, { items: Cibo.shopBuild({ all }, 1), days: 7, fixed: true });
    }
  }

  UI.on('piano.open', () => {
    if (!Calc.allFoods().length) return UI.toast('Serve il database alimenti (o dei cibi tuoi)');
    P.sh = UI.sheet({ title: 'Piano settimanale', cls: 'tall' });
    P.sh.body.addEventListener('click', onClick);
    draw();
  });

  window.Piano = { ALG, allergenHit, candidates, generate };
})();
