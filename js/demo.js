/* Compagno - dati di prova (3 settimane plausibili) */
(function () {
  'use strict';

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  async function load() {
    const R = rng(20261019);
    const rnd = (a, b) => a + R() * (b - a);
    const ri = (a, b) => Math.round(rnd(a, b));
    const pickOne = arr => arr[Math.floor(R() * arr.length)];
    const today = Store.today();
    const dayN = i => Store.addDays(today, -i);       // i = giorni fa
    const st = Store.defaultState();

    /* alimenti: cerca per nome (la ricerca ignora gli accenti) */
    Calc.invalidate();
    const hasFoods = Array.isArray(window.FOODS) && window.FOODS.length > 0;
    const F = {};
    const NAMES = { pollo: 'petto di pollo', riso: 'riso bianco', pasta: 'pasta di semola', uova: 'uovo intero', yogurt: 'yogurt greco', olio: 'olio extravergine', mela: 'mele con buccia', spinaci: 'spinaci', tonno: 'tonno al naturale', avena: "fiocchi d'avena", noci: 'noci', pane: 'pane integrale', zucchine: 'zucchine', banana: 'banane', fagioli: 'fagioli cannellini', salmone: 'salmone selvaggio' };
    Object.keys(NAMES).forEach(w => {
      const list = hasFoods ? Calc.findFoodByWords([NAMES[w]], { needKcal: true }).filter(f => !Calc.isCustom(f)) : [];
      list.sort((a, b) => a.n.length - b.n.length);
      F[w] = list[0] || null;
    });

    st.profile = { name: 'Demo', sex: 'M', birth: '1996-05-14', height: 178, weight: 75, activity: 1.55, goal: 'massa', rateKg: 0.25, protPerKg: 2.0, fatPerKg: 0.9, trainDays: 4, split: 'PPL', useAdaptive: true, kcalOverride: '', onb: true };
    st.meta.firstUse = dayN(20);
    st.meta.demo = true;
    st.partner = { name: 'Alex', phone: '', msgs: null };
    if (F.pollo) { st.prefs.fav = [F.pollo, F.riso, F.uova, F.yogurt, F.avena, F.mela].filter(Boolean).map(f => f.id); st.prefs.proteins = [F.pollo, F.tonno].filter(Boolean).map(f => f.id); }
    st.prefs.notes = 'Dati di prova';

    /* peso e misure */
    for (let i = 20; i >= 0; i--) {
      if (i === 17 || i === 11 || i === 6) continue;                 // qualche giorno senza pesata
      st.body[dayN(i)] = { w: Math.round((75 + (20 - i) * 0.045 + rnd(-0.35, 0.35)) * 10) / 10 };
    }
    [[20, 82.0, 35.0, 56.0, 98.0], [13, 82.2, 35.1, 56.1, 98.2], [6, 82.1, 35.2, 56.3, 98.4], [0, 82.4, 35.3, 56.4, 98.5]].forEach(m => {
      const b = st.body[dayN(m[0])] || (st.body[dayN(m[0])] = {});
      b.vita = m[1]; b.braccio = m[2]; b.coscia = m[3]; b.petto = m[4];
    });

    /* diario */
    let dayWithFoods = 0;
    if (hasFoods) {
      for (let i = 20; i >= 0; i--) {
        if (i === 9 || i === 15) continue;                           // due giorni senza diario
        const items = [];
        const add = (f, g, m) => { if (f) items.push({ id: Store.uid('e'), f: f.id, g: Math.round(g / 5) * 5, m }); };
        const v = R();
        // colazione
        if (v < 0.6) { add(F.yogurt, rnd(150, 200), 'colazione'); add(F.avena, rnd(40, 55), 'colazione'); add(F.mela, rnd(120, 160), 'colazione'); }
        else { add(F.uova, rnd(110, 130), 'colazione'); add(F.pane, rnd(60, 80), 'colazione'); add(F.banana, rnd(100, 130), 'colazione'); }
        // pranzo
        add(R() < 0.5 ? F.riso : F.pasta, rnd(85, 110), 'pranzo');
        add(F.pollo, rnd(160, 210), 'pranzo');
        add(R() < 0.5 ? (F.spinaci || F.zucchine) : (F.zucchine || F.spinaci), rnd(150, 220), 'pranzo');
        add(F.olio, rnd(8, 14), 'pranzo');
        {
          // cena
          add(R() < 0.5 ? (F.tonno || F.salmone) : F.uova, rnd(110, 150), 'cena');
          add(R() < 0.5 ? F.pane : F.riso, rnd(70, 110), 'cena');
          add(R() < 0.7 ? (F.zucchine || F.spinaci) : F.fagioli, rnd(150, 220), 'cena');
          add(F.olio, rnd(8, 12), 'cena');
          // spuntino
          if (R() < 0.7) { add(pickOne([F.noci, F.mela, F.yogurt].filter(Boolean)), rnd(25, 150), 'spuntini'); }
        }
        // porta il totale a circa 2.500-3.000 kcal (porzioni plausibili) e toglie cena/spuntini di oggi
        let kc = 0;
        items.forEach(x => { const f = Calc.food(x.f); if (f) kc += Calc.scaled(f, x.g, 'kcal') || 0; });
        const fac = kc > 0 ? Math.max(0.8, Math.min(2.4, rnd(2550, 2950) / kc)) : 1;
        items.forEach(x => { const ff = Calc.food(x.f); const veg = ff && /^verdur/.test(Calc.norm(ff.cat)); x.g = Math.max(5, Math.round(Math.min(x.g * fac, veg ? 230 : 1e4) / 5) * 5); });
        const d = { items: (i === 0 ? items.filter(x => x.m === 'colazione' || x.m === 'pranzo') : items), water: ri(1500, 2800), steps: ri(5500, 12500) };
        if (d.items.length) dayWithFoods++;
        st.diary[dayN(i)] = d;
      }
    } else {
      for (let i = 20; i >= 0; i--) st.diary[dayN(i)] = { items: [], water: ri(1500, 2800), steps: ri(5500, 12500) };
    }
    // oggi: acqua/passi parziali
    st.diary[today].water = 750; st.diary[today].steps = 3400;

    /* benessere */
    for (let i = 20; i >= 0; i--) {
      const w = { sleep: Math.round(rnd(6.0, 8.4) * 10) / 10, sq: ri(2, 5), energy: ri(2, 5) };
      if (R() < 0.4) { w.sys = ri(116, 126); w.dia = ri(70, 80); }
      st.well[dayN(i)] = w;
    }
    st.well[dayN(2)].dizzy = true; st.well[dayN(2)].note = 'Capogiro dopo l\'allenamento, a digiuno';
    st.well[today] = { sleep: 6.4, sq: 3, energy: 3 };

    /* scheda PPL e sessioni */
    const tpl = D.TEMPLATES.find(t => t.id === 'ppl');
    const prog = { id: Store.uid('p'), n: tpl.n, days: tpl.days.map(d => ({ id: Store.uid('d'), n: d.n, ex: d.ex.map(e => Object.assign({}, e)) })) };
    st.programs.push(prog); st.activeProgram = prog.id; st.nextDayIdx = 0;
    const base = { 'panca': 70, 'shoulder-press': 22, 'panca-inc-man': 26, 'alzate-lat': 8, 'push-down': 30, 'tric-sopra': 20, 'trazioni': 5, 'rematore-bil': 60, 'lat-stretta': 55, 'face-pull': 25, 'curl-bil': 30, 'curl-martello': 14, 'squat': 90, 'stacco-rum': 80, 'pressa': 160, 'leg-curl': 40, 'calf-piedi': 60, 'crunch-cavi': 35 };
    const offs = [20, 18, 16, 13, 11, 9, 6, 4, 2];
    offs.forEach((off, n) => {
      const day = prog.days[n % 3];
      const wk = Math.floor(n / 3);
      const startT = Store.parseKey(dayN(off)); startT.setHours(18, ri(0, 20), 0, 0);
      const sess = { id: Store.uid('s'), date: dayN(off), start: startT.getTime(), end: startT.getTime() + ri(62, 82) * 60000, prog: prog.id, day: day.id, name: day.n, note: '', ex: [] };
      day.ex.forEach(pe => {
        const lower = Calc.isLowerBody(pe.e);
        const w = (base[pe.e] || 20) + wk * (lower ? 5 : 2.5) * (R() < 0.8 ? 1 : 0);
        const sets = [];
        for (let s = 0; s < pe.sets; s++) {
          const r = Math.max(pe.rmin - 1, Math.min(pe.rmax, pe.rmin + ri(0, pe.rmax - pe.rmin) - (s > 1 ? 1 : 0) + (wk > 0 ? 0 : 1)));
          sets.push({ w: w, r: r, rpe: s >= pe.sets - 1 ? ri(8, 9) : ri(7, 8), done: true });
        }
        sess.ex.push({ e: pe.e, plan: { sets: pe.sets, rmin: pe.rmin, rmax: pe.rmax, rest: pe.rest }, sets });
      });
      st.sessions.push(sess);
    });

    /* integratori */
    const sup = [
      { id: Store.uid('sp'), n: 'Creatina monoidrato', dose: '5', unit: 'g', when: 'mattina', v: {}, active: true },
      { id: Store.uid('sp'), n: 'Omega-3', dose: '1', unit: 'capsule', when: 'pranzo', v: { epadha: 0.5 }, active: true },
      { id: Store.uid('sp'), n: 'Vitamina D', dose: '50', unit: 'µg', when: 'colazione', v: { vitD: 50 }, active: true }
    ];
    st.supps = sup;
    for (let i = 20; i >= 0; i--) {
      const log = [];
      if (R() < 0.9) log.push(sup[0].id);
      if (R() < 0.6) log.push(sup[1].id);
      if (R() < 0.8) log.push(sup[2].id);
      if (i === 0) log.length = 0;
      st.suppLog[dayN(i)] = log;
    }

    /* referti */
    st.labs = [
      { id: Store.uid('l'), date: dayN(98), lab: 'Laboratorio Analisi Roma', note: 'Controllo di routine', files: [], fm: [], vals: [
        { k: 'emoglobina', val: 14.9, unit: 'g/dL', lo: 13, hi: 17 }, { k: 'mcv', val: 77, unit: 'fL', lo: 80, hi: 100 }, { k: 'ferritina', val: 82, unit: 'ng/mL', lo: 30, hi: 400 },
        { k: 'sideremia', val: 95, unit: 'µg/dL', lo: 60, hi: 160 }, { k: 'transferrina', val: 28, unit: '%', lo: 20, hi: 45 },
        { k: 'bil-tot', val: 1.9, unit: 'mg/dL', lo: 0.2, hi: 1.2 }, { k: 'bil-dir', val: 0.3, unit: 'mg/dL', lo: 0, hi: 0.3 }, { k: 'bil-ind', val: 1.6, unit: 'mg/dL', lo: 0.1, hi: 0.9 },
        { k: 'vitd', val: 24, unit: 'ng/mL', lo: 30, hi: 100 }, { k: 'glicemia', val: 88, unit: 'mg/dL', lo: 70, hi: 100 }, { k: 'ast', val: 28, unit: 'U/L', lo: 5, hi: 40 }, { k: 'alt', val: 31, unit: 'U/L', lo: 5, hi: 41 }
      ] },
      { id: Store.uid('l'), date: dayN(8), lab: 'Laboratorio Analisi Roma', note: 'Controllo dopo 3 mesi', files: [], fm: [], vals: [
        { k: 'emoglobina', val: 15.1, unit: 'g/dL', lo: 13, hi: 17 }, { k: 'mcv', val: 78, unit: 'fL', lo: 80, hi: 100 }, { k: 'ferritina', val: 91, unit: 'ng/mL', lo: 30, hi: 400 },
        { k: 'bil-tot', val: 1.6, unit: 'mg/dL', lo: 0.2, hi: 1.2 }, { k: 'bil-dir', val: 0.3, unit: 'mg/dL', lo: 0, hi: 0.3 }, { k: 'bil-ind', val: 1.3, unit: 'mg/dL', lo: 0.1, hi: 0.9 },
        { k: 'vitd', val: 32, unit: 'ng/mL', lo: 30, hi: 100 }, { k: 'glicemia', val: 86, unit: 'mg/dL', lo: 70, hi: 100 }, { k: 'ast', val: 26, unit: 'U/L', lo: 5, hi: 40 }, { k: 'alt', val: 29, unit: 'U/L', lo: 5, hi: 41 }
      ] }
    ];

    await Store.clearFiles();
    Calc.invalidate();
    await Store.replaceAll(st);
    return { foods: hasFoods && dayWithFoods > 0 };
  }

  window.Demo = { load };
})();
