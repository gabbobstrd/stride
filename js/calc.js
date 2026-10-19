/* Compagno - calcoli (fabbisogni, totali, forza, volume, esami) */
(function () {
  'use strict';
  const S = () => Store.s;
  const N = D.NUTR;

  /* ---------- testo ---------- */
  function norm(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function mean(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }
  function num(x) { return typeof x === 'number' && isFinite(x); }

  /* ---------- alimenti ---------- */
  let idx = null;
  let allList = null;
  const nnCache = new Map();
  function invalidate() { idx = null; allList = null; }
  function foodIndex() {
    if (!idx) {
      idx = {};
      (Array.isArray(window.FOODS) ? window.FOODS : []).forEach(f => { idx[f.id] = f; });
      S().customFoods.forEach(f => { idx[f.id] = f; });
    }
    return idx;
  }
  function food(id) { return foodIndex()[id] || null; }
  function allFoods() {
    if (!allList) allList = (Array.isArray(window.FOODS) ? window.FOODS : []).concat(S().customFoods);
    return allList;
  }
  function isCustom(f) { return S().customFoods.some(c => c.id === f.id); }
  function foodNN(f) {
    let v = nnCache.get(f);
    if (v === undefined) { v = norm(f.n); nnCache.set(f, v); }
    return v;
  }
  function searchFoods(q, list) {
    list = list || allFoods();
    const toks = norm(q).split(/\s+/).filter(Boolean);
    if (!toks.length) return list.slice();
    const out = [];
    for (const f of list) {
      const nn = foodNN(f);
      let ok = true, score = 0;
      for (const t of toks) {
        // singolare/plurale (mela/mele, uovo/uova) e sinonimi di cottura (cotti = lessati/bolliti)
        const st = t.length >= 4 && /[aeio]$/.test(t) ? t.slice(0, -1) : t;
        const alts = /^cott[aeio]?$/.test(t) ? ['cott', 'lessat', 'bollit'] : (st !== t ? [t, st] : [t]);
        let i = -1, pen = 0;
        for (let k = 0; k < alts.length; k++) { i = nn.indexOf(alts[k]); if (i >= 0) { pen = k && st !== t ? 3 : 0; break; } }
        if (i < 0) { ok = false; break; }
        score += pen;
        score += i === 0 ? 0 : (nn.charAt(i - 1) === ' ' ? 2 : 6);
      }
      if (ok) out.push({ f, s: score + nn.length / 100 });
    }
    out.sort((a, b) => a.s - b.s);
    return out.map(x => x.f);
  }
  function findFoodByWords(words, opts) {
    // alimenti il cui nome INIZIA con una delle parole/frasi (opts.anywhere: in qualunque punto)
    opts = opts || {};
    const ws = words.map(norm);
    return allFoods().filter(f => {
      const nn = foodNN(f);
      return ws.some(w => (opts.anywhere ? nn.indexOf(w) >= 0 : nn.indexOf(w) === 0)) && (!opts.needKcal || (f.v && num(f.v.kcal)));
    });
  }
  function foodVal(f, k) { return f && f.v && num(f.v[k]) ? f.v[k] : null; }
  function scaled(f, g, k) { const v = foodVal(f, k); return v === null ? null : v * g / 100; }
  function isExcluded(id) { const p = S().prefs; return p.dislike.indexOf(id) >= 0 || p.avoid.indexOf(id) >= 0; }

  /* ---------- profilo, peso, fabbisogni ---------- */
  function age(birth, ref) {
    if (!birth) return 30;
    const b = Store.parseKey(birth), r = ref ? Store.parseKey(ref) : new Date();
    let a = r.getFullYear() - b.getFullYear();
    const m = r.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && r.getDate() < b.getDate())) a--;
    return a;
  }
  function weightSeries() {
    const b = S().body;
    return Object.keys(b).filter(k => num(b[k].w) && b[k].w > 0).sort().map(k => ({ d: k, w: b[k].w }));
  }
  function trendSeries() {
    let t = null;
    return weightSeries().map(x => { t = t === null ? x.w : t + 0.1 * (x.w - t); return { d: x.d, w: x.w, t }; });
  }
  function weightOn(date) {
    const ser = weightSeries();
    let w = null;
    for (const x of ser) { if (x.d <= date) w = x.w; else break; }
    if (w === null) w = ser.length ? ser[0].w : null;
    const p = S().profile;
    return w !== null ? w : (p && p.weight ? +p.weight : 70);
  }
  function bmr(p, w) {
    return 10 * w + 6.25 * (+p.height || 170) - 5 * age(p.birth) + (p.sex === 'F' ? -161 : 5);
  }

  function adaptive(ref) {
    ref = ref || Store.today();
    // la finestra finisce IERI: il diario e il peso di oggi sono quasi sempre incompleti
    const end = Store.addDays(ref, -1);
    const start = Store.addDays(end, -27);
    const ser = trendSeries().filter(x => x.d >= start && x.d <= end);
    const diary = S().diary;
    const dd = [];
    for (let i = 0; i < 28; i++) {
      const k = Store.addDays(end, -i);
      if (diary[k] && diary[k].items && diary[k].items.length) {
        const k2 = dayTotals(k);
        if (k2.tot.kcal > 0) dd.push(k2.tot.kcal);
      }
    }
    const res = { ok: false, wDays: ser.length, dDays: dd.length };
    if (ser.length < 14) { res.reason = 'Servono almeno 14 giorni con il peso (negli ultimi 28): ne hai ' + ser.length + '.'; return res; }
    if (dd.length < 10) { res.reason = 'Servono almeno 10 giorni di diario (negli ultimi 28): ne hai ' + dd.length + '.'; return res; }
    const first = ser[0], last = ser[ser.length - 1];
    const days = Store.diffDays(last.d, first.d);
    if (days < 10) { res.reason = 'I pesi coprono solo ' + days + ' giorni: servono almeno 10.'; return res; }
    const avg = mean(dd);
    const dTrend = last.t - first.t;
    const tdee = avg - dTrend * 7700 / days;
    res.avgKcal = avg; res.dTrend = dTrend; res.days = days;
    if (!(tdee > 1200 && tdee < 5500)) { res.reason = 'Il valore stimato (' + Math.round(tdee) + ' kcal) non è plausibile: controlla pesi e diario.'; return res; }
    res.ok = true; res.tdee = tdee;
    return res;
  }

  function targets(date) {
    date = date || Store.today();
    const p = S().profile;
    if (!p) return null;
    const w = weightOn(date);
    const b = bmr(p, w);
    const tdeeF = b * (+p.activity || 1.55);
    const ad = adaptive(date);
    const usingAd = !!(p.useAdaptive && ad.ok);
    const tdee = usingAd ? ad.tdee : tdeeF;
    let rate = +p.rateKg;
    if (!(rate > 0)) rate = p.goal === 'definizione' ? 0.5 : 0.25;
    let delta = 0;
    if (p.goal === 'massa') delta = rate * 7700 / 7;
    else if (p.goal === 'definizione') delta = -rate * 7700 / 7;
    else if (p.goal === 'ricomposizione') delta = -0.1 * tdee;
    const over = +p.kcalOverride;
    let kcal = over > 0 ? over : tdee + delta;
    kcal = Math.max(1200, Math.round(kcal / 10) * 10);
    // proteine sempre tra 1,6 e 2,2 g/kg (anche per dati salvati prima del limite)
    const protPerKg = Math.min(2.2, Math.max(1.6, +p.protPerKg || (p.goal === 'definizione' ? 2.2 : 2.0)));
    const fatPerKg = +p.fatPerKg || 0.9;
    const prot = protPerKg * w;
    const fat = Math.max(fatPerKg * w, 0.2 * kcal / 9);
    const carb = Math.max(0, (kcal - prot * 4 - fat * 9) / 4);
    const t = {
      kcal, prot, carb, fat,
      fib: Math.max(25, 14 * kcal / 1000),
      sfa: 0.1 * kcal / 9, sug: 0.15 * kcal / 4,
      na: 2000, epadha: 0.25, chol: 300,
      w, bmr: b, tdeeF, tdee, delta, adaptive: ad, usingAdaptive: usingAd, override: over > 0, age: age(p.birth), protPerKg, fatPerKg
    };
    const a = t.age, sx = p.sex;
    D.MICRO_KEYS.forEach(k => { const r = D.rda(k, sx, a); if (r) { t[k] = r.t; if (r.ul) t['ul_' + k] = r.ul; } });
    return t;
  }

  /* ---------- totali del giorno ---------- */
  function dayTotals(date) {
    const day = Store.getDay(date);
    const tot = {}, knownG = {}, sup = {}, supp = {};
    let totalG = 0, n = 0, missing = 0;
    for (const it of day.items) {
      const f = food(it.f);
      if (!f) { missing++; continue; }
      const g = +it.g || 0;
      totalG += g; n++;
      for (const x of N) {
        const v = f.v ? f.v[x.k] : undefined;
        if (num(v)) { tot[x.k] = (tot[x.k] || 0) + v * g / 100; knownG[x.k] = (knownG[x.k] || 0) + g; }
      }
    }
    const log = S().suppLog[date] || [];
    for (const s of S().supps) {
      if (s.active === false || log.indexOf(s.id) < 0 || !s.v) continue;
      for (const k of Object.keys(s.v)) {
        const v = +s.v[k];
        if (isFinite(v) && v > 0) { tot[k] = (tot[k] || 0) + v; sup[k] = true; supp[k] = (supp[k] || 0) + v; }
      }
    }
    const cov = {};
    for (const x of N) {
      if (totalG > 0) cov[x.k] = Math.min(1, (knownG[x.k] || 0) / totalG);
      else cov[x.k] = tot[x.k] != null ? 1 : 0;
      if (sup[x.k] && totalG > 0 && !(knownG[x.k])) cov[x.k] = 0.01;
    }
    if (tot.kcal == null) tot.kcal = 0;
    ['prot', 'carb', 'fat'].forEach(k => { if (tot[k] == null) tot[k] = 0; });
    const foodOnly = {};
    for (const k of Object.keys(tot)) foodOnly[k] = Math.max(0, tot[k] - (supp[k] || 0));
    return { tot, cov, n, totalG, missing, hasData: n > 0, supp, food: foodOnly };
  }
  function lastDays(endDate, days) { const a = []; for (let i = days - 1; i >= 0; i--) a.push(Store.addDays(endDate, -i)); return a; }
  /* media sui giorni con diario */
  function avgTotals(endDate, days) {
    const sum = {}, cnt = {}, cs = {}, ss = {};
    let nd = 0;
    for (const d of lastDays(endDate, days)) {
      const t = dayTotals(d);
      if (!t.hasData) continue;
      nd++;
      for (const x of N) {
        if (t.tot[x.k] != null && (t.cov[x.k] > 0 || x.g === 'macro')) {
          sum[x.k] = (sum[x.k] || 0) + t.tot[x.k]; cnt[x.k] = (cnt[x.k] || 0) + 1; cs[x.k] = (cs[x.k] || 0) + t.cov[x.k]; ss[x.k] = (ss[x.k] || 0) + (t.supp[x.k] || 0);
        }
      }
    }
    const avg = {}, cov = {}, supp = {}, food = {};
    for (const k of Object.keys(sum)) { avg[k] = sum[k] / cnt[k]; cov[k] = cs[k] / cnt[k]; supp[k] = ss[k] / cnt[k]; food[k] = Math.max(0, avg[k] - supp[k]); }
    return { n: nd, avg, cov, supp, food };
  }

  /* micronutrienti: elenco con percentuale */
  function microReport(tot, cov, tg, supp) {
    const out = [];
    for (const k of D.MICRO_KEYS) {
      const t = tg[k];
      if (!t) continue;
      const v = tot[k];
      const c = cov ? cov[k] : 1;
      const sv = supp && supp[k] > 0 ? Math.min(supp[k], v || 0) : 0;
      out.push({ k, v: v == null ? null : v, t, ul: tg['ul_' + k] || null, pct: v == null || c <= 0 ? null : v / t, cov: c, s: sv, fv: v == null ? null : v - sv });
    }
    return out;
  }
  function lowestMicros(date, n) {
    const tg = targets(date);
    const dt = dayTotals(date);
    if (!tg || !dt.hasData) return [];
    return microReport(dt.tot, dt.cov, tg, dt.supp).filter(x => x.pct !== null).sort((a, b) => a.pct - b.pct).slice(0, n || 6);
  }
  function richFoods(k, n) {
    const list = allFoods().filter(f => num(foodVal(f, k)) && foodVal(f, k) > 0 && !isExcluded(f.id));
    list.sort((a, b) => b.v[k] - a.v[k]);
    const fav = S().prefs.fav;
    // preferisce i preferiti se sono tra i migliori 15
    const top = list.slice(0, 15);
    top.sort((a, b) => (fav.indexOf(b.id) >= 0 ? 1 : 0) - (fav.indexOf(a.id) >= 0 ? 1 : 0) || b.v[k] - a.v[k]);
    return top.slice(0, n || 3);
  }

  /* ---------- acqua ---------- */
  function trainHours(date) {
    let h = 0;
    for (const s of S().sessions) if (s.date === date && s.start && s.end) h += (s.end - s.start) / 3600000;
    const a = S().activeSession;
    if (a && a.date === date && a.start) h += Math.max(0, ((a.end || Date.now()) - a.start) / 3600000);
    return Math.round(h * 10) / 10;
  }
  function waterGoal(date) {
    const w = weightOn(date);
    const ml = 35 * w * 0.8 + 500 * trainHours(date);
    return Math.round(ml / 50) * 50;
  }

  /* ---------- forza ---------- */
  function e1rm(kg, reps, rpe) {
    kg = +kg; reps = +reps;
    if (!(kg > 0) || !(reps > 0)) return 0;
    const hasRpe = rpe !== '' && rpe != null && isFinite(+rpe) && +rpe > 0;
    if (reps === 1 && !hasRpe) return kg;
    return kg * (1 + (reps + (hasRpe ? Math.max(0, 10 - +rpe) : 0)) / 30);
  }
  function exById(id) {
    return D.EXERCISES.find(e => e.id === id) || S().exercises.find(e => e.id === id) || null;
  }
  function exName(id) { const e = exById(id); return e ? e.n : 'Esercizio'; }
  function allExercises() { return D.EXERCISES.concat(S().exercises); }
  function sortedSessions() {
    return S().sessions.slice().sort((a, b) => (a.date + String(a.start || 0).padStart(15, '0')).localeCompare(b.date + String(b.start || 0).padStart(15, '0')));
  }
  function doneSets(sx, conRisc) { return (sx.sets || []).filter(s => s.done && +s.w >= 0 && +s.r > 0 && (conRisc || s.t !== 'w')); } // il riscaldamento (t='w') non conta, salvo conRisc
  function exerciseHistory(eid) {
    const out = [];
    for (const s of sortedSessions()) {
      for (const e of s.ex) if (e.e === eid) { const ds = doneSets(e); if (ds.length) out.push({ s, sets: ds }); }
    }
    return out;
  }
  function lastPerformance(eid) { const h = exerciseHistory(eid); return h.length ? h[h.length - 1] : null; }
  function isLowerBody(eid) {
    const e = exById(eid);
    return !!e && (['quadricipiti', 'femorali', 'glutei'].indexOf(e.mg) >= 0 || /stacco/.test(eid));
  }
  function roundTo(x, step) { return Math.round(x / step) * step; }
  function progression(eid, plan) {
    const lp = lastPerformance(eid);
    if (!lp) return null;
    const sets = lp.sets;
    const lastW = Math.max.apply(null, sets.map(s => +s.w));
    const rmax = plan && plan.rmax ? +plan.rmax : 0;
    const rpe10 = sets.filter(s => +s.rpe >= 10).length;
    if (rpe10 >= 2) {
      const w = Math.max(0, roundTo(lastW * 0.95, 2.5));
      return { type: 'down', w, text: 'Hai fatto più serie a RPE 10: scendi del 5% (circa ' + UI.fmt(w, 1) + ' kg).' };
    }
    const allMax = rmax > 0 && sets.every(s => +s.r >= rmax && (!(+s.rpe > 0) || +s.rpe <= 8));
    if (allMax) {
      const inc = isLowerBody(eid) ? 5 : 2.5;
      return { type: 'up', w: lastW + inc, text: 'Tutte le serie al massimo delle ripetizioni: prova ' + UI.fmt(lastW + inc, 1) + ' kg (+' + UI.fmt(inc, 1) + ').' };
    }
    return { type: 'same', w: lastW, text: 'Stesso carico (' + UI.fmt(lastW, 1) + ' kg), punta a +1 ripetizione.' };
  }
  function sessionVolume(s) {
    let v = 0;
    for (const e of s.ex) for (const x of doneSets(e)) v += (+x.w) * (+x.r);
    return v;
  }
  function bestOf(eid, excludeId) {
    let e1 = null, load = null;
    for (const s of S().sessions) {
      if (excludeId && s.id === excludeId) continue;
      for (const e of s.ex) {
        if (e.e !== eid) continue;
        for (const x of doneSets(e)) {
          const v = e1rm(x.w, x.r, x.rpe);
          if (!e1 || v > e1.v) e1 = { v, w: +x.w, r: +x.r, date: s.date };
          if (!load || +x.w > load.w || (+x.w === load.w && +x.r > load.r)) load = { w: +x.w, r: +x.r, date: s.date };
        }
      }
    }
    return { e1, load };
  }
  function records() {
    const ids = new Set();
    S().sessions.forEach(s => s.ex.forEach(e => ids.add(e.e)));
    const out = [];
    ids.forEach(id => { const b = bestOf(id); if (b.e1) out.push({ id, n: exName(id), e1: b.e1, load: b.load }); });
    return out.sort((a, b) => a.n.localeCompare(b.n, 'it'));
  }
  function newRecords(sess) {
    const out = [];
    for (const e of sess.ex) {
      const prev = bestOf(e.e, sess.id);
      let bestNow = null, loadNow = null;
      for (const x of doneSets(e)) {
        const v = e1rm(x.w, x.r, x.rpe);
        if (!bestNow || v > bestNow.v) bestNow = { v, w: +x.w, r: +x.r };
        if (!loadNow || +x.w > loadNow.w) loadNow = { w: +x.w, r: +x.r };
      }
      if (!bestNow) continue;
      if (!prev.e1) { out.push({ id: e.e, n: exName(e.e), w: bestNow.w, r: bestNow.r, e1: bestNow.v, first: true }); continue; }
      if (bestNow.v > prev.e1.v + 0.05 || loadNow.w > prev.load.w) out.push({ id: e.e, n: exName(e.e), w: loadNow.w > prev.load.w ? loadNow.w : bestNow.w, r: loadNow.w > prev.load.w ? loadNow.r : bestNow.r, e1: bestNow.v });
    }
    return out;
  }

  /* serie per muscolo in un intervallo di date */
  function muscleSets(from, to) {
    const m = {};
    for (const s of S().sessions) {
      if (s.date < from || s.date > to) continue;
      for (const e of s.ex) {
        const ex = exById(e.e);
        if (!ex) continue;
        const n = doneSets(e).length;
        if (!n) continue;
        m[ex.mg] = (m[ex.mg] || 0) + n;
        (ex.sec || []).forEach(sc => { m[sc] = (m[sc] || 0) + n * 0.5; });
      }
    }
    return m;
  }

  /* varieta' vegetale */
  function varietySet(endDate, days) {
    const set = new Map();
    for (const d of lastDays(endDate, days)) {
      for (const it of Store.getDay(d).items) {
        const f = food(it.f);
        if (f && (D.VEG_RE.test(norm(f.cat)) || (/^cereali/.test(norm(f.cat)) && /integral/.test(norm(f.n))))) set.set(f.id, f.n);
      }
    }
    return set;
  }

  /* ---------- esami ---------- */
  function labRange(k, sex) {
    const p = D.LABMAP[k];
    if (!p) return { lo: null, hi: null };
    const r = (sex === 'F' && p.rF) ? p.rF : p.r;
    return { lo: r[0], hi: r[1] };
  }
  function labStatus(v) {
    const x = +v.val;
    if (!isFinite(x)) return 'ok';
    const lo = v.lo === '' || v.lo == null ? null : +v.lo;
    const hi = v.hi === '' || v.hi == null ? null : +v.hi;
    if (lo !== null && isFinite(lo) && x < lo) return 'low';
    if (hi !== null && isFinite(hi) && x > hi) return 'high';
    return 'ok';
  }
  function latestLab() {
    const l = S().labs.slice().sort((a, b) => b.date.localeCompare(a.date));
    return l[0] || null;
  }
  function labName(k) { return D.LABMAP[k] ? D.LABMAP[k].n : String(k).replace(/^x:/, ''); }

  window.Calc = {
    norm, mean, num, invalidate, food, allFoods, isCustom, searchFoods, findFoodByWords, foodVal, scaled, isExcluded,
    age, weightSeries, trendSeries, weightOn, bmr, adaptive, targets, dayTotals, avgTotals, lastDays,
    microReport, lowestMicros, richFoods, trainHours, waterGoal, e1rm, exById, exName, allExercises,
    sortedSessions, doneSets, exerciseHistory, lastPerformance, isLowerBody, progression, sessionVolume, bestOf,
    records, newRecords, muscleSets, varietySet, labRange, labStatus, latestLab, labName
  };
})();
