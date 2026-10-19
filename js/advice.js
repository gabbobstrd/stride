/* Compagno - consigli a regole (tutto offline) */
(function () {
  'use strict';
  const fmt = (n, d) => UI.fmt(n, d);

  function itemsWith(dates, pred) {
    const found = new Map();
    for (const d of dates) {
      for (const it of Store.getDay(d).items) {
        const f = Calc.food(it.f);
        if (f && pred(f)) found.set(f.id, f);
      }
    }
    return Array.from(found.values());
  }
  function proteinExample(missing) {
    const p = Store.s.prefs;
    const ids = p.proteins.concat(p.fav);
    for (const id of ids) {
      const f = Calc.food(id);
      const pr = f ? Calc.foodVal(f, 'prot') : null;
      if (f && pr && pr >= 10 && !Calc.isExcluded(id)) {
        const g = Math.max(50, Math.min(400, Math.round(missing / (pr / 100) / 10) * 10));
        return g + ' g di ' + f.n.toLowerCase();
      }
    }
    return '';
  }

  function list(date) {
    const out = [];
    const S = Store.s;
    const p = S.profile;
    if (!p) return out;
    const today = Store.today();
    const isToday = date === today;
    const h = new Date().getHours();
    const tg = Calc.targets(date);
    if (!tg) return out;
    const dt = Calc.dayTotals(date);
    const day = Store.getDay(date);
    const week = Calc.lastDays(date, 7);
    const avg = Calc.avgTotals(date, 7);

    /* 1. kcal / proteine mancanti dopo le 18 */
    if (isToday && h >= 18) {
      const mk = tg.kcal - dt.tot.kcal, mp = tg.prot - dt.tot.prot;
      if (mk > 150 || mp > 15) {
        let t = 'Ti mancano ' + fmt(Math.max(0, mk)) + ' kcal e ' + fmt(Math.max(0, mp)) + ' g di proteine per oggi.';
        const ex = mp > 15 ? proteinExample(mp) : '';
        if (ex) t += ' Esempio: ' + ex + '.';
        out.push({ lvl: 'warn', t });
      }
    }
    /* 2. acqua */
    const goal = Calc.waterGoal(date);
    if (isToday && h >= 15 && (day.water || 0) < goal * 0.5) {
      out.push({ lvl: 'info', t: 'Hai bevuto ' + fmt(day.water || 0) + ' ml su ' + fmt(goal) + ' ml: sei sotto il 50%. Un bicchiere adesso aiuta.' });
    }
    /* 3. micronutrienti bassi (media 7 giorni) */
    if (avg.n >= 3) {
      const rep = Calc.microReport(avg.food, avg.cov, tg).filter(x => x.pct !== null && x.pct < 0.7 && x.cov >= 0.6).sort((a, b) => a.pct - b.pct).slice(0, 2);
      for (const r of rep) {
        const meta = D.NMAP[r.k];
        const rich = Calc.richFoods(r.k, 3);
        let t = meta.n + ' in media 7 giorni al ' + Math.round(r.pct * 100) + '% dell\'obiettivo (solo dal cibo).';
        if (rich.length) t += ' Cibi ricchi (per 100 g): ' + rich.map(f => f.n + ' ' + UI.fmtA(f.v[r.k], meta.d) + ' ' + meta.u).join('; ') + '.';
        out.push({ lvl: 'warn', t });
      }
      /* 4. ferro basso + caffe'/te' */
      const fe = avg.food.fe;
      if (Calc.num(fe) && tg.fe && fe / tg.fe < 0.7 && (avg.cov.fe || 0) >= 0.5) {
        const cafs = itemsWith(week, f => Calc.foodVal(f, 'caff') > 0 || /\b(caffe|te|the|tea)\b/.test(Calc.norm(f.n)));
        if (cafs.length) out.push({ lvl: 'warn', t: 'Ferro basso e bevi ' + cafs[0].n.toLowerCase() + ': tè e caffè lontano dai pasti, e la vitamina C aiuta ad assorbire il ferro non-eme.' });
      }
    }
    /* 5. ossalati */
    const oss = itemsWith(Calc.lastDays(date, 3), f => f.an && f.an.oss >= 2);
    if (oss.length >= 3) out.push({ lvl: 'info', t: 'Negli ultimi 3 giorni molti cibi ricchi di ossalati (' + oss.slice(0, 3).map(f => f.n.toLowerCase()).join(', ') + '). Alterna le verdure e cuocile in acqua; con la storia di calcoli renali chiedi al medico.' });
    /* 6. fitati alti + zinco/ferro bassi */
    const fit = itemsWith(week, f => f.an && f.an.fit >= 2);
    if (fit.length >= 3 && avg.n >= 3) {
      const low = ['fe', 'zn'].filter(k => Calc.num(avg.avg[k]) && tg[k] && avg.avg[k] / tg[k] < 0.8);
      if (low.length) out.push({ lvl: 'info', t: 'Molti cibi ricchi di fitati e ' + low.map(k => D.NMAP[k].n.toLowerCase()).join(' e ') + ' bassi: ammollo, germinazione o lievito madre migliorano l\'assorbimento.' });
    }
    /* 7. fagioli crudi */
    const lec = itemsWith([date], f => f.an && (f.an.lec >= 3 || (f.an.lec >= 2 && /fagiol/.test(Calc.norm(f.n)))));
    if (lec.length) out.push({ lvl: 'info', t: lec[0].n + ': i legumi vanno ammollati e bolliti almeno 10 minuti (mai crudi).' });
    /* 8. sodio, saturi */
    if (dt.tot.na > 2000) out.push({ lvl: 'warn', t: 'Sodio ' + fmt(dt.tot.na) + ' mg: oltre il limite di 2.000 mg. Meno insaccati e cibi in scatola, usa il sale con misura.' });
    if (dt.tot.kcal > 500 && dt.tot.sfa != null && dt.tot.sfa * 9 > 0.1 * dt.tot.kcal) out.push({ lvl: 'warn', t: 'Grassi saturi sopra il 10% delle kcal (' + fmt(dt.tot.sfa * 9 / dt.tot.kcal * 100) + '%). Più pesce, olio extravergine e legumi, meno burro e salumi.' });
    /* 10. allenamento */
    const sess = Calc.sortedSessions();
    if (sess.length) {
      const last = sess[sess.length - 1].date;
      const gap = Store.diffDays(date, last);
      if (isToday && gap >= 4) out.push({ lvl: 'warn', t: 'Sono ' + gap + ' giorni che non ti alleni.' });
    } else if (isToday && Store.diffDays(today, S.meta.firstUse || today) >= 4) {
      out.push({ lvl: 'info', t: 'Nessun allenamento registrato finora: inizia dalla scheda Palestra.' });
    }
    /* 11. volume per muscolo */
    if (sess.some(s => s.date >= Store.addDays(date, -14))) {
      const w7 = Calc.muscleSets(Store.addDays(date, -6), date), w28 = Calc.muscleSets(Store.addDays(date, -27), date);
      const low = Object.keys(w28).filter(m => (w7[m] || 0) < 10).sort((a, b) => (w7[a] || 0) - (w7[b] || 0)).slice(0, 4);
      if (low.length && isToday) out.push({ lvl: 'info', t: 'Serie questa settimana sotto 10: ' + low.map(m => D.MUSCLES[m].toLowerCase() + ' ' + UI.fmtA(w7[m] || 0, 1)).join(', ') + '. La fascia utile è 10–20 serie a settimana.' });
    }
    /* 12. sonno */
    const sl = week.map(d => S.well[d] && Calc.num(+S.well[d].sleep) && +S.well[d].sleep > 0 ? +S.well[d].sleep : null).filter(x => x !== null);
    if (sl.length >= 3 && Calc.mean(sl) < 7) out.push({ lvl: 'warn', t: 'Dormi in media ' + fmt(Calc.mean(sl), 1) + ' ore (ultimi 7 giorni): sotto le 7 il recupero e la fame ne risentono.' });
    /* 13. capogiri */
    const diz = Calc.lastDays(date, 3).filter(d => S.well[d] && S.well[d].dizzy);
    if (diz.length) out.push({ lvl: 'bad', t: 'Hai segnato capogiri: controlla acqua, pasti regolari e pressione. Se persistono, parlane con il medico.' });
    /* 14. esami fuori range */
    const lab = Calc.latestLab();
    if (lab) {
      const bad = lab.vals.filter(v => Calc.labStatus(v) !== 'ok');
      if (bad.length) out.push({ lvl: 'warn', t: 'Nell\'ultimo referto (' + UI.dateShort(lab.date) + ') fuori range: ' + bad.slice(0, 4).map(v => Calc.labName(v.k)).join(', ') + '. Parlane con il medico: l\'app non fa diagnosi.' });
    }
    /* 15. backup */
    const lb = S.meta.lastBackup || 0;
    const hasData = Object.keys(S.diary).length + S.sessions.length > 0;
    if (isToday && hasData) {
      const old = lb ? (Date.now() - lb) / 86400000 > 7 : Store.diffDays(today, S.meta.firstUse || today) > 7;
      if (old) out.push({ lvl: 'warn', t: lb ? 'L\'ultimo backup è di oltre 7 giorni fa.' : 'Non hai ancora fatto un backup. I dati stanno solo su questo telefono.', btn: { label: 'Fai il backup', act: 'altro.sub', v: 'backup' } });
    }
    return out;
  }

  window.Advice = { list };
})();
