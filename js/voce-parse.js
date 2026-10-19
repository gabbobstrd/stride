/* Compagno - «Dimmi cosa hai fatto»: analizzatore a regole (puro, provabile in node).
   Voce.parse(text, ctx) -> stessa forma della risposta di Gemini:
   {foods:[{text,food_id,name,grams,qty,portion_label,meal,matched,assumed,approx}], water_ml, supplements:[{name,supp_id}],
    sets:[{exercise,exercise_id,kg,reps,sets,rir}], weight_kg, body_fat_pct, sleep_h, energy_1_5, notes, unparsed:[]}
   ctx = {foods:[{id,n}], supps:[{id,n}], exercises:[{id,n}], fav:[ids], now:Date} */
(function (g) {
  'use strict';
  const P = g.Portions || (typeof require !== 'undefined' ? require('./portions.js') : null);
  const norm = s => P.norm(s).replace(/[×*]/g, 'x');

  const NW = { un: 1, uno: 1, una: 1, mezzo: 0.5, mezza: 0.5, mezz: 0.5, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10, undici: 11, dodici: 12, quindici: 15, venti: 20 };
  const NUMW = '(?:' + Object.keys(NW).sort((a, b) => b.length - a.length).join('|') + ')';
  const NUMRE = '(\\d+(?:[.,]\\d+)?|' + NUMW + ')';
  const UNITS = { kg: 1000, chili: 1000, chilo: 1000, g: 1, gr: 1, grammi: 1, grammo: 1, etto: 100, etti: 100, hg: 100, ml: 1, cl: 10, dl: 100, l: 1000, litri: 1000, litro: 1000 };
  const UNITRE = '(kg|chili|chilo|grammi|grammo|gr|etti|etto|hg|ml|cl|dl|litri|litro|g|l)';

  function num(s) { s = String(s); return /^\d/.test(s) ? parseFloat(s.replace(',', '.')) : (NW[s] != null ? NW[s] : NaN); }
  const STOPW = new Set(['di', 'd', 'del', 'dello', 'della', 'dei', 'degli', 'delle', 'al', 'alla', 'allo', 'ai', 'con', 'e', 'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'in', 'a', 'da', 'per', 'tipo', 'po', 'circa', 'g', 'gr', 'grammi', 'ho', 'mangiato', 'bevuto', 'preso']);
  function stem(w) { return w.length > 3 ? w.replace(/[aeio]+$/, '') : w; }
  function words(s) { return norm(s).split(/[^a-z0-9%]+/).filter(Boolean); }

  /* ---------- scelta dell'alimento ---------- */
  const nnCache = new WeakMap();
  function fnorm(f) { let v = nnCache.get(f); if (v === undefined) { v = norm(f.n); nnCache.set(f, v); } return v; }
  function byPick(prefixes, ctx) {
    for (const p of prefixes) {
      const n = norm(p);
      let hit = ctx.foods.find(f => fnorm(f) === n);
      if (!hit) hit = ctx.foods.find(f => fnorm(f).indexOf(n) === 0);
      if (hit) return { f: hit, idx: prefixes.indexOf(p) };
    }
    return null;
  }
  const ALIAS = [
    [/^(pollo|petto pollo)$/, 'petto di pollo, crudo'], [/^tacchino$/, 'petto di tacchino, crudo'], [/^pasta( semola)?$/, 'pasta di semola, cruda'],
    [/^riso( bianco)?$/, 'riso bianco, crudo'], [/^uov[oa]$/, 'uovo intero'], [/^pane$/, 'pane bianco in cassetta'], [/^olio( oliva)?( extravergine)?$|^olio extravergine/, 'olio extravergine'],
    [/^latte$/, 'latte parzialmente scremato (2'], [/^yogurt$/, 'yogurt greco 0'], [/^tonno$/, 'tonno al naturale, sgocciolato'], [/^bresaola$/, 'manzo essiccato'],
    [/^banan[ae]$/, 'banane'], [/^mel[ae]$/, 'mele con buccia'], [/^aranc(ia|e)$/, 'arance, crude'], [/^(avena|fiocchi avena)$/, 'fiocchi d avena'],
    [/^parmigiano$/, 'parmigiano (tipo'], [/^prosciutto cotto$/, 'prosciutto cotto magro'], [/^prosciutto crudo$/, 'prosciutto crudo'], [/^sottilett[ae]$/, 'formaggio fuso a fette'],
    [/^fett[ae] biscottat[ae]$|^biscottat[ae]$/, 'fette biscottate'], [/^(proteine )?whey( in polvere)?$|^proteine( in polvere)?$|^misurin[oi] (proteine|whey)$/, 'proteine whey'], [/^caffe$/, 'caffe espresso'], [/^salmone$/, 'salmone selvaggio'], [/^patate$/, 'patate']
  ];
  function fuzzy(query, ctx) {
    const toks = P.squash(query).split(' ').filter(t => t && !/^\d/.test(t) && !STOPW.has(t));
    if (!toks.length) return null;
    const cooked = /\b(cott|lessat|arrost|frit|bollit|stufat|sod)/.test(norm(query));
    const fav = ctx.fav || [];
    let best = null;
    for (const f of ctx.foods) {
      const nn = fnorm(f), ws = nn.split(/[^a-z0-9%]+/).filter(Boolean);
      let score = 0, ok = true;
      for (const t of toks) {
        const st = stem(t);
        let b = Infinity;
        for (let i = 0; i < ws.length; i++) {
          const w = ws[i];
          if (w === t) b = Math.min(b, i * 0.1);
          else if (stem(w) === st) b = Math.min(b, 1 + i * 0.1);
          else if (st.length >= 3 && w.indexOf(st) === 0) b = Math.min(b, 3 + i * 0.1);
        }
        if (b === Infinity) { ok = false; break; }
        score += b;
      }
      if (!ok) continue;
      score += nn.length / 100;
      if (!cooked) { if (/\b(cott[oaie]|arrosto|fritto|lessat\w*)\b/.test(nn)) score += 0.6; if (/\bcrud[oaie]\b/.test(nn)) score -= 0.3; }
      if (fav.indexOf(f.id) >= 0) score -= 0.7;
      if (!best || score < best.s) best = { f, s: score };
    }
    return best && best.s < 12 ? best.f : null;
  }
  /* alimento per un nome semplice (alias poi ricerca fuzzy) */
  function matchFood(query, ctx) {
    const sq = P.squash(query);
    for (const a of ALIAS) if (a[0].test(sq)) { const h = byPick([a[1]], ctx); if (h) return h.f; }
    return fuzzy(query, ctx);
  }

  /* ---------- trovare esercizi ---------- */
  function matchExercise(query, ctx) {
    const toks = P.squash(query).split(' ').filter(t => t && !/^\d/.test(t) && !STOPW.has(t));
    if (!toks.length) return null;
    let best = null;
    ctx.exercises.forEach((ex, idx) => {
      const ws = words(ex.n);
      let score = idx * 0.001, ok = true;
      for (const t of toks) {
        const st = stem(t); let b = Infinity;
        ws.forEach((w, i) => {
          if (w === t) b = Math.min(b, i * 0.1);
          else if (stem(w) === st) b = Math.min(b, 1 + i * 0.1);
          else if (st.length >= 3 && w.indexOf(st) === 0) b = Math.min(b, 3 + i * 0.1);
        });
        if (b === Infinity) { ok = false; break; }
        score += b;
      }
      if (ok && (!best || score < best.s)) best = { ex, s: score };
    });
    return best ? best.ex : null;
  }

  /* ---------- spezzare il testo ---------- */
  function splitSegments(text) {
    const out = [];
    norm(text).split(/(?<!\d),|,(?!\d)|[;\n]+/).forEach(chunk => {
      const parts = chunk.split(/\s+(?:e poi|e|poi|piu)\s+/);
      let cur = parts[0];
      for (let i = 1; i < parts.length; i++) {
        const p = parts[i];
        const starts = new RegExp('^(\\d|' + NUMW + '\\b)').test(p);
        const mezz = /^mezz/.test(p) && /(ore|ora|h|litro|litri|kg|etto|etti)$/.test(cur);
        const min = /^\d+\s*min/.test(p) && /(ore|ora|h)$/.test(cur);
        if (starts && !mezz && !min) { out.push(cur); cur = p; } else cur += ' e ' + p;
      }
      out.push(cur);
    });
    return out.map(s => s.trim()).filter(Boolean);
  }
  function mealOf(t) {
    if (/\bcolazione\b/.test(t)) return 'colazione';
    if (/\bpranzo\b/.test(t)) return 'pranzo';
    if (/\bcena\b/.test(t)) return 'cena';
    if (/\b(spuntino|spuntini|merenda|snack)\b/.test(t)) return 'spuntini';
    return null;
  }
  const MEALRE = /\b(a|per|di|come|nel|dopo)?\s*(colazione|pranzo|cena|spuntino|spuntini|merenda|snack)\b/g;
  function timeMeal(now) {
    const h = (now || new Date()).getHours();
    return h < 10 ? 'colazione' : h < 15 ? 'pranzo' : h < 18 ? 'spuntini' : 'cena';
  }

  /* ---------- parser di un pezzo di cibo ---------- */
  function parseFood(t, ctx, meal) {
    t = t.replace(/^(ho |abbiamo )?(mangiato|bevuto|preso|fatto|assunto|aggiunto)\s+/, '').replace(/^(ieri|oggi|stamattina|stasera|stanotte)\s+/, '').replace(/^(ho|un po)\s+/, '').trim();
    if (!t) return null;
    const item = { text: t, food_id: '', name: '', grams: null, qty: null, portion_label: '', meal, matched: false, assumed: false, approx: false };
    const fin = f => { if (f) { item.food_id = f.id; item.name = f.n; item.matched = true; } return item; };

    /* quantità in grammi, kg, ml, litri... */
    const mre = new RegExp('(?:(\\d+(?:[.,]\\d+)?)|\\b(' + NUMW + ')\\b)\\s*' + UNITRE + '\\b');
    const m = t.match(mre);
    if (m) {
      const v = num(m[1] || m[2]);
      item.grams = Math.round(v * UNITS[m[3]] * 10) / 10;
      const name = (t.slice(0, m.index) + ' ' + t.slice(m.index + m[0].length)).trim();
      return fin(matchFood(name, ctx));
    }
    /* N <porzione> */
    const pm = t.match(new RegExp('^' + NUMRE + '\\s+(.*)$'));
    const qty = pm ? num(pm[1]) : 1;
    const phrase = pm ? pm[2] : t;
    const sq = P.squash(phrase);
    for (const p of P.LIST) {
      const mm = sq.match(p.say);
      if (!mm) continue;
      const residual = (sq.slice(0, mm.index) + ' ' + sq.slice(mm.index + mm[0].length)).replace(/\s+/g, ' ').trim();
      item.qty = qty; item.portion_label = p.label; item.grams = Math.round(qty * p.g * 10) / 10;
      let f = null;
      if (residual) f = fuzzy((p.q !== undefined ? p.q + ' ' : (p.pick.length ? sq : '')) + residual, ctx) || (p.pick.length && !p.q ? fuzzy(sq, ctx) : null);
      if (!f && (!residual || p.pick.length)) {
        if (!residual || residual.split(' ').every(w => STOPW.has(w))) { const h = byPick(p.pick, ctx); if (h) { f = h.f; if (p.approx && h.idx > 0) item.approx = true; } }
      }
      if (!f && p.pick.length && residual) { const h = byPick(p.pick, ctx); if (h) f = h.f; }
      return fin(f);
    }
    /* nessuna porzione conosciuta */
    const f = matchFood(phrase, ctx);
    if (pm) { item.qty = qty; item.assumed = true; } else { item.grams = 100; item.assumed = true; }
    return fin(f);
  }

  /* ---------- serie di un solo esercizio: «80 per 8», «3 serie da 8 a 80», «stesso peso 6 reps» ---------- */
  const UW = { zero: 0, uno: 1, un: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10, undici: 11, dodici: 12, tredici: 13, quattordici: 14, quindici: 15, sedici: 16, diciassette: 17, diciotto: 18, diciannove: 19 };
  const TW = { venti: 20, trenta: 30, quaranta: 40, cinquanta: 50, sessanta: 60, settanta: 70, ottanta: 80, novanta: 90 };
  function wnum(w) {
    if (UW[w] != null) return UW[w];
    if (TW[w] != null) return TW[w];
    if (w === 'cento') return 100;
    if (w.indexOf('cento') === 0) { const r = wnum(w.slice(5)); return r != null && r < 100 ? 100 + r : null; }
    for (const t in TW) {
      const stem = t.slice(0, -1);
      if (w.indexOf(t) === 0 && UW[w.slice(t.length)] > 0 && UW[w.slice(t.length)] < 10) return TW[t] + UW[w.slice(t.length)];
      if (w.indexOf(stem) === 0 && (w.slice(stem.length) === 'uno' || w.slice(stem.length) === 'otto')) return TW[t] + UW[w.slice(stem.length)];
    }
    return null;
  }
  /* numeri in parole -> cifre («settantadue e mezzo per otto» -> «72.5 per 8»); testo già normalizzato */
  function numWords(text) {
    let t = norm(text).replace(/[a-z]+/g, w => { const v = wnum(w); return v == null ? w : String(v); });
    t = t.replace(/(\d+)\s+virgola\s+(\d+)/g, '$1,$2');
    t = t.replace(/(\d+)(?:[.,]\d+)?\s+e\s+mezz[oa]\b/g, (m, a) => (parseFloat(m.replace(/\s+e\s+mezz[oa]/, '').replace(',', '.')) + 0.5).toString());
    return t;
  }
  const fl = x => parseFloat(String(x).replace(',', '.'));
  /* un pezzo -> {kg, reps, n, rpe, explicitKg} o null; lastKg = kg della serie precedente */
  function setSeg(s, lastKg) {
    let kg = null, reps = null, n = 1, rpe = null, expl = false, m;
    if ((m = s.match(/\brpe\s*(\d+(?:[.,]\d)?)/))) { rpe = fl(m[1]); s = s.replace(m[0], ' '); }
    else if ((m = s.match(/\brir\s*(\d)/))) { rpe = 10 - +m[1]; s = s.replace(m[0], ' '); }
    if (/\bcorpo libero\b/.test(s)) { kg = 0; expl = true; s = s.replace(/\ba?\s*corpo libero\b/, ' '); }
    let same = false;
    if (/\b(stesso peso|stesso carico|uguale|identico|idem|stessi chili)\b/.test(s)) { same = true; s = s.replace(/\b(stesso peso|stesso carico|uguale|identico|idem|stessi chili)\b/, ' '); }
    if ((m = s.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|chili|chilo)\b/))) { kg = fl(m[1]); expl = true; s = s.replace(m[0], ' '); }
    if ((m = s.match(/(\d+)\s*(?:ripetizioni|ripetizione|rip|reps?|volte)\b/))) { reps = +m[1]; s = s.replace(m[0], ' '); }
    if ((m = s.match(/(\d+)\s*serie\s*(?:da|di|x)?\s*(\d+)?/))) { n = +m[1]; if (m[2] && reps == null) reps = +m[2]; s = s.replace(m[0], ' '); }
    else if ((m = s.match(/(\d+(?:[.,]\d+)?)\s*x\s*(\d+)/))) {
      const rest = s.replace(m[0], ' ');
      if (+m[1] <= 10 && /\d/.test(rest) && kg == null) { n = +m[1]; reps = reps == null ? +m[2] : reps; }
      else { if (kg == null) { kg = fl(m[1]); expl = true; } if (reps == null) reps = +m[2]; }
      s = rest;
    }
    const nums = (s.match(/\d+(?:[.,]\d+)?/g) || []).map(fl);
    if (kg == null && reps == null) {
      if (nums.length >= 2) { kg = nums[0]; reps = nums[1]; expl = true; }
      else if (nums.length === 1) reps = nums[0];
    } else if (reps == null) { if (nums.length) reps = nums[nums.length - 1]; }
    else if (kg == null && nums.length) { kg = nums[0]; expl = true; }
    if (!(reps > 0)) return null;
    if (reps > 50 && kg != null && kg <= 50) { const t = kg; kg = reps; reps = t; }
    if (kg == null) kg = lastKg == null || lastKg === '' ? '' : lastKg;
    void same;
    return { kg, reps: Math.round(reps), n: Math.max(1, Math.min(20, n)), rpe: rpe, explicitKg: expl };
  }
  /* testo -> [{kg, reps, n, rpe}]; ctx.lastKg = kg dell'ultima serie dell'esercizio */
  function parseSets(text, ctx) {
    ctx = ctx || {};
    const t = numWords(text);
    const out = [];
    let last = ctx.lastKg;
    const hard = [];
    t.split(/(?<!\d),|,(?!\d)|;|\n|\bpoi\b/).forEach(c => { if (c.trim()) hard.push(c.trim()); });
    const segs = [];
    hard.forEach(c => {
      const parts = c.split(/\s+e\s+/);
      let cur = parts[0];
      for (let i = 1; i < parts.length; i++) {
        const a = setSeg(cur, null), b = setSeg(parts[i], null);
        if (a && b && a.explicitKg && b.explicitKg) { segs.push(cur); cur = parts[i]; } else cur += ' e ' + parts[i];
      }
      segs.push(cur);
    });
    segs.forEach(sg => {
      const r = setSeg(sg, last);
      if (!r) return;
      if (r.kg !== '') last = r.kg;
      out.push({ kg: r.kg, reps: r.reps, n: r.n, rpe: r.rpe });
    });
    return out;
  }

  /* ---------- parser principale ---------- */
  function parse(text, ctx) {
    ctx = Object.assign({ foods: [], supps: [], exercises: [], fav: [], now: new Date() }, ctx || {});
    const R = { foods: [], water_ml: null, supplements: [], sets: [], weight_kg: null, body_fat_pct: null, sleep_h: null, energy_1_5: null, notes: '', unparsed: [] };
    let sticky = null, lastEx = null;
    const suppKeys = ctx.supps.map(s => {
      const nn = norm(s.n), ws = nn.split(' ').filter(Boolean);
      const keys = [nn];
      if (ws[0] === 'vitamina' && ws[1]) keys.push('vitamina ' + ws[1], 'vit ' + ws[1]);
      else if (ws[0] && ws[0].length >= 4) keys.push(ws[0]);
      return { s, keys };
    });
    for (let seg of splitSegments(text)) {
      const mw = mealOf(seg);
      if (mw) { sticky = mw; seg = seg.replace(MEALRE, ' ').replace(/\s+/g, ' ').trim(); if (!seg) continue; }
      const meal = sticky || timeMeal(ctx.now);
      let m;

      /* sonno */
      if (/\b(dorm\w*|sonno)\b/.test(seg)) {
        const h = seg.match(new RegExp(NUMRE + '\\s*(?:ore|ora|h)\\b(?:\\s*e?\\s*(mezza|mezzo|un quarto|(\\d{1,2})(?:\\s*min\\w*)?))?'));
        const hm = seg.match(/(\d{1,2})\s*h\s*(\d{1,2})\b/);
        if (hm) { R.sleep_h = Math.round((+hm[1] + +hm[2] / 60) * 10) / 10; continue; }
        if (h) {
          let v = num(h[1]);
          if (h[2]) v += /mezz/.test(h[2]) ? 0.5 : /quarto/.test(h[2]) ? 0.25 : (h[3] ? +h[3] / 60 : 0);
          R.sleep_h = Math.round(v * 100) / 100; continue;
        }
      }
      /* peso corporeo e massa grassa */
      if ((m = seg.match(/\b(?:massa grassa|grasso(?: corporeo)?|bf|body fat)\b\D{0,12}(\d+(?:[.,]\d+)?)/))) { R.body_fat_pct = parseFloat(m[1].replace(',', '.')); continue; }
      if (/\b(peso|pesato|pesavo)\b/.test(seg) && (m = seg.match(/(\d+(?:[.,]\d+)?)\s*(kg|chili)?\b/)) && !/\b(g|gr|grammi)\b/.test(seg)) {
        const v = parseFloat(m[1].replace(',', '.'));
        if (v >= 20 && v <= 400) { R.weight_kg = v; continue; }
      }
      /* energia */
      if ((m = seg.match(/\benergia\b\D{0,14}([1-5])\b/)) || (m = seg.match(/\b([1-5])\s*(?:\/|su)\s*5\b.*\benergia\b/))) { R.energy_1_5 = +m[1]; continue; }
      /* acqua */
      if (/\bacqua\b/.test(seg) && !/acqua (di cocco)/.test(seg) || (/\bbevut\w*/.test(seg) && /\d|\b(mezz|un|una|due|tre)/.test(seg) && /\b(l|litri|litro|ml|cl|bicchier\w*|bottigli\w*)\b/.test(seg) && !/\b(latte|birra|vino|caffe|te|succo|spremuta|cola)\b/.test(seg))) {
        const wm = seg.match(new RegExp(NUMRE + '\\s*' + UNITRE + '\\b'));
        const cm = seg.match(new RegExp('(?:' + NUMRE + '\\s+)?(bicchier[ei]|bottigli[ae]|lattin[ae])'));
        let ml = null;
        if (wm) {
          ml = num(wm[1]) * UNITS[wm[2]];
          if (/\b(litro|litri|l)\b/.test(wm[2]) && /\be mezzo\b/.test(seg)) ml += 500;
        } else if (cm) { const q = cm[1] ? num(cm[1]) : 1; ml = q * (/bicchier/.test(cm[2]) ? 200 : /bottigli/.test(cm[2]) ? 500 : 330); }
        if (ml) { R.water_ml = (R.water_ml || 0) + Math.round(ml); continue; }
        R.unparsed.push(seg); continue;
      }
      /* integratori */
      const found = suppKeys.filter(k => k.keys.some(key => new RegExp('(^|[^a-z0-9])' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)').test(seg)));
      if (found.length) { found.forEach(k => { if (!R.supplements.some(x => x.supp_id === k.s.id)) R.supplements.push({ name: k.s.n, supp_id: k.s.id }); }); continue; }

      /* serie senza «kg» scritto: «panca 80 per 8», «squat 3 serie da otto» (esercizio sottinteso = quello di prima) */
      {
        const sw = numWords(seg);
        if (/\d\s*per\s*\d|\bserie\b|\brip\w*|\breps?\b|\bvolte\b|\bstesso peso\b/.test(sw) && /\d/.test(sw)) {
          const ps = parseSets(sw, {});
          if (ps.length) {
            const q = sw.replace(/\d+(?:[.,]\d+)?|\bper\b|\bserie\b|\brip\w*|\breps?\b|\bvolte\b|\bda\b|\bcon\b|\brpe\b|\brir\b|\bstesso peso\b|\bcorpo libero\b|\bkg\b|\bchil[io]\b|\bpoi\b|\bx\b|\bho\b|\bfatt[oaie]\b|\boggi\b/g, ' ');
            const ex = matchExercise(q, ctx) || lastEx;
            if (ex) {
              lastEx = ex;
              ps.forEach(p => R.sets.push({ exercise: ex.n, exercise_id: ex.id, kg: p.kg === '' ? 0 : p.kg, reps: p.reps, sets: p.n, rir: p.rpe != null ? Math.max(0, 10 - p.rpe) : null }));
              continue;
            }
          }
        }
      }
      /* serie di allenamento */
      const kgm = seg.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|chili|chilo)\b/);
      const hasX = /\d\s*x\s*\d/.test(seg);
      if ((kgm || hasX) && /[a-z]{3}/.test(seg.replace(/\bkg\b|\bserie\b|\brip\w*|\breps?\b|\brir\b|\brpe\b/g, ''))) {
        let kg = null, reps = null, sets = null, rest = seg;
        if (kgm) {
          kg = parseFloat(kgm[1].replace(',', '.'));
          const after = seg.slice(kgm.index + kgm[0].length);
          const am = after.match(/^\s*x\s*(\d+)(?:\s*x\s*(\d+))?/);
          if (am) { reps = +am[1]; sets = am[2] ? +am[2] : null; }
          rest = seg.slice(0, kgm.index) + ' ' + (am ? after.replace(am[0], ' ') : after);
        } else {
          const m3 = seg.match(/(\d+(?:[.,]\d+)?)\s*x\s*(\d+)\s*x\s*(\d+)/);
          if (m3) { kg = parseFloat(m3[1].replace(',', '.')); reps = +m3[2]; sets = +m3[3]; rest = seg.replace(m3[0], ' '); }
        }
        let sd = rest.match(/(\d+)\s*serie\s*(?:da|di|x)\s*(\d+)/);
        if (sd) { sets = +sd[1]; reps = +sd[2]; rest = rest.replace(sd[0], ' '); }
        if (reps == null && (sd = rest.match(/(\d+)\s*x\s*(\d+)/))) { sets = +sd[1]; reps = +sd[2]; rest = rest.replace(sd[0], ' '); }
        if ((sd = rest.match(/(\d+)\s*serie/))) { sets = +sd[1]; rest = rest.replace(sd[0], ' '); }
        if (reps == null && (sd = rest.match(/(\d+)\s*(?:rip\w*|reps?|volte)/))) { reps = +sd[1]; rest = rest.replace(sd[0], ' '); }
        let rir = null;
        if ((sd = rest.match(/\brir\s*(\d)/))) { rir = +sd[1]; rest = rest.replace(sd[0], ' '); }
        else if ((sd = rest.match(/\brpe\s*(\d+(?:[.,]\d)?)/))) { rir = Math.max(0, 10 - parseFloat(sd[1].replace(',', '.'))); rest = rest.replace(sd[0], ' '); }
        const q = rest.replace(/\d+(?:[.,]\d+)?|\bx\b|\bserie\b|\brip\w*|\breps?\b|\bda\b|\bcon\b|\bho\b|\bfatt[oaie]\b|\boggi\b/g, ' ');
        const ex = matchExercise(q, ctx);
        if (ex && reps) {
          lastEx = ex;
          R.sets.push({ exercise: ex.n, exercise_id: ex.id, kg: kg == null ? 0 : kg, reps, sets: sets || 1, rir });
          continue;
        }
      }
      /* cibo */
      const it = parseFood(seg, ctx, meal);
      if (it) R.foods.push(it);
    }
    return R;
  }

  g.Voce = Object.assign(g.Voce || {}, { parse, parseSets, numWords, matchFood, matchExercise, splitSegments, timeMeal });
  g.VoceParse = g.Voce;
  if (typeof module !== 'undefined' && module.exports) module.exports = g.Voce;
})(typeof window !== 'undefined' ? window : globalThis);
