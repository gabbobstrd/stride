/* Compagno - scheda Altro: profilo, preferenze, corpo, benessere, integratori, referti, partner, notifiche, backup, AI, info */
(function () {
  'use strict';
  const esc = UI.esc, fmt = UI.fmt, S = () => Store.s;
  const A = { sub: null, d: Store.today(), models: null };

  /* ---------- menu ---------- */
  const MENU = [
    ['Dati', [['profilo', 'Profilo e obiettivi', 'Calcolo di kcal e macro'], ['prefs', 'Preferenze cibo', 'Preferiti, non mi piace, da evitare'], ['corpo', 'Corpo e misure', 'Peso, vita, fianchi…'], ['benessere', 'Benessere', 'Sonno, energia, pressione']]],
    ['Salute', [['integratori', 'Integratori', 'Elenco, spunte e schede informative'], ['referti', 'Referti', 'Esami del sangue e allegati']]],
    ['Strumenti', [['coach', 'Coach AI', 'Chiedi a un nutrizionista sportivo'], ['partner', 'Partner', 'Messaggi rapidi su WhatsApp'], ['salute', 'Collega Salute (bilancia, passi, sonno)', 'Comando rapido iPhone']]],
    ['Impostazioni', [['notifiche', 'Notifiche', 'Promemoria nel Calendario'], ['backup', 'Backup', 'Esporta e importa i dati'], ['ai', 'Impostazioni AI', 'Chiave Gemini'], ['info', 'Info e fonti', 'Come funziona, fonti scientifiche'], ['crediti', 'Crediti', 'Disegni, foto, font e codice di terzi']]]
  ];
  const TITLES = {}; MENU.forEach(g => g[1].forEach(i => { TITLES[i[0]] = i[1]; }));
  TITLES.notifiche = 'Impostazioni · Notifiche';
  TITLES.passi = TITLES.salute;

  function menuHtml() {
    return MENU.map(g => '<div class="sec-t">' + g[0] + '</div><div class="card" style="padding:4px 14px"><div class="list">' + g[1].map(i => '<button class="li" data-act="altro.sub" data-v="' + i[0] + '"><div class="li-main"><div class="li-t">' + i[1] + '</div><div class="li-s">' + i[2] + '</div></div>' + UI.icon('right', 16) + '</button>').join('') + '</div></div>').join('') +
      '<p class="xs mut center mt16">Stride · i dati restano su questo telefono</p>';
  }

  const view = {
    title: 'Altro',
    enter(o) { if (o && o.sub !== undefined) A.sub = o.sub; else if (o && o.reset) A.sub = null; },
    render() {
      if (!A.sub) return menuHtml();
      const f = PAGES[A.sub];
      return '<div class="row" style="margin:-4px 0 8px"><button class="btn sm ghost" data-act="altro.back" style="padding-left:4px">' + UI.icon('left', 18) + ' Altro</button></div><h2 style="font-size:22px;font-weight:700;margin:0 4px 12px">' + esc(TITLES[A.sub]) + '</h2>' + (f ? f() : '');
    }
  };
  UI.registerView('altro', view);
  UI.on('altro.sub', el => {
    const v = el.dataset.v;
    if (v === 'coach') return Coach.open();
    A.sub = v; UI.go('altro'); UI.scrollTop();
  });
  UI.on('altro.back', () => { A.sub = null; UI.refresh(); UI.scrollTop(); });

  /* =============== PROFILO =============== */
  const num = x => (x === '' || x == null ? '' : String(x).replace('.', ','));
  function profileForm() {
    const p = S().profile;
    return '<div class="card">' +
      UI.field('Nome', '<input class="inp" data-ch="altro.pf" data-f="name" value="' + esc(p.name || '') + '" placeholder="Come ti chiami?">') +
      '<div class="field-l" style="margin-bottom:6px">Sesso</div>' + UI.seg([['M', 'Uomo'], ['F', 'Donna']], p.sex, 'altro.sex') +
      '<div class="grid2">' + UI.field('Data di nascita', '<input class="inp" type="date" data-ch="altro.pf" data-f="birth" value="' + esc(p.birth || '') + '">') +
      UI.field('Altezza (cm)', '<input class="inp" inputmode="decimal" data-ch="altro.pf" data-f="height" value="' + num(p.height) + '">') + '</div>' +
      '<div class="grid2">' + UI.field('Peso (kg)', '<input class="inp" inputmode="decimal" data-ch="altro.pf" data-f="weight" value="' + num(Math.round(Calc.weightOn(Store.today()) * 10) / 10) + '">') +
      UI.field('Allenamenti / settimana', UI.select([[0, '0'], [1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6'], [7, '7']], p.trainDays, 'data-ch="altro.pf" data-f="trainDays"')) + '</div>' +
      UI.field('Attività quotidiana', UI.select(D.ACTIVITY, p.activity, 'data-ch="altro.pf" data-f="activity"')) +
      UI.field('Obiettivo', UI.select(Object.keys(D.GOALS).map(k => [k, D.GOALS[k]]), p.goal, 'data-ch="altro.goal"')) +
      (p.goal === 'massa' || p.goal === 'definizione' ? UI.field('Ritmo (kg a settimana)', '<input class="inp" inputmode="decimal" data-ch="altro.pf" data-f="rateKg" value="' + num(p.rateKg) + '">', p.goal === 'massa' ? 'Consigliato 0,25 kg a settimana.' : 'Consigliato 0,5 kg a settimana al massimo.') : '') +
      UI.field('Schema di allenamento', UI.select([['PPL', 'Push Pull Legs'], ['UL', 'Upper / Lower'], ['FB', 'Full body'], ['S5', 'Split 5 giorni'], ['ALTRO', 'Altro']], p.split || 'PPL', 'data-ch="altro.pf" data-f="split"')) +
      '<details class="det"><summary>Impostazioni avanzate</summary>' +
      '<div class="grid2">' + UI.field('Proteine (g/kg)', '<input class="inp" inputmode="decimal" data-ch="altro.pf" data-f="protPerKg" value="' + num(p.protPerKg) + '">', 'ISSN: 1,6–2,2') +
      UI.field('Grassi (g/kg)', '<input class="inp" inputmode="decimal" data-ch="altro.pf" data-f="fatPerKg" value="' + num(p.fatPerKg) + '">', 'Minimo 20% kcal') + '</div>' +
      UI.field('Kcal fisse (sostituisce il calcolo)', '<input class="inp" inputmode="numeric" data-ch="altro.pf" data-f="kcalOverride" value="' + num(p.kcalOverride) + '" placeholder="vuoto = automatico">') +
      '<div class="row between mt8"><div class="li-main"><div class="li-t">Usa il fabbisogno adattivo</div><div class="li-s">Stimato da peso e diario, se i dati bastano</div></div><button class="switch' + (p.useAdaptive ? ' on' : '') + '" role="switch" aria-checked="' + !!p.useAdaptive + '" data-act="altro.adaptive" aria-label="Fabbisogno adattivo"></button></div></details></div>';
  }
  function profileResult() {
    const tg = Calc.targets(Store.today());
    if (!tg) return '';
    const ad = tg.adaptive;
    const mac = (g, k) => Math.round(g * k / tg.kcal * 100);
    let h = UI.card('I tuoi numeri',
      '<div class="hl mb8"><div class="big">' + fmt(tg.kcal) + ' <small>kcal al giorno</small></div><div class="small mt4"><span class="mP">P ' + fmt(tg.prot) + ' g</span> · <span class="mC">C ' + fmt(tg.carb) + ' g</span> · <span class="mG">G ' + fmt(tg.fat) + ' g</span></div></div>' +
      '<div class="list">' +
      row('Metabolismo basale (Mifflin-St Jeor)', fmt(tg.bmr) + ' kcal') +
      row('Fabbisogno con attività (formula)', fmt(tg.tdeeF) + ' kcal') +
      row('Fabbisogno adattivo stimato', ad.ok ? '<b>' + fmt(ad.tdee) + '</b> kcal' : '<span class="mut">non ancora</span>') +
      row('Aggiustamento per l\'obiettivo', (tg.delta >= 0 ? '+' : '') + fmt(tg.delta) + ' kcal') +
      row('Peso usato', fmt(tg.w, 1) + ' kg') +
      row('Proteine', fmt(tg.prot) + ' g · ' + fmt(tg.protPerKg, 1) + ' g/kg · ' + mac(tg.prot, 4) + '%') +
      row('Grassi', fmt(tg.fat) + ' g · ' + mac(tg.fat, 9) + '%') +
      row('Carboidrati', fmt(tg.carb) + ' g · ' + mac(tg.carb, 4) + '%') +
      row('Fibre (minimo)', fmt(tg.fib) + ' g') +
      row('Grassi saturi (massimo 10%)', fmt(tg.sfa) + ' g') +
      row('Zuccheri (massimo 15%)', fmt(tg.sug) + ' g') +
      row('Sodio (massimo)', '2.000 mg') +
      '</div>');
    h += '<div class="disc mb8">' + (tg.override ? '<b>Stai usando kcal fisse.</b> ' : '') + (tg.usingAdaptive ? 'Uso il fabbisogno <b>adattivo</b>. ' : (S().profile.useAdaptive ? 'Fabbisogno adattivo non disponibile: ' + esc(ad.reason || '') + ' Uso la formula. ' : '')) +
      (!ad.ok && !S().profile.useAdaptive ? 'Fabbisogno adattivo: ' + esc(ad.reason || '') : '') + '</div>';
    h += '<div class="disc">Come si calcola: BMR con Mifflin-St Jeor × attività = fabbisogno. Obiettivo: massa +' + '0,25 kg/sett. (+275 kcal circa), definizione −0,5 kg/sett. (−550 kcal circa), ricomposizione −10%, mantenimento 0 (1 kg = 7.700 kcal). Proteine g/kg del peso (ISSN 1,6–2,2). Grassi: il maggiore tra g/kg e 20% delle kcal. Carboidrati: il resto. Il fabbisogno adattivo usa il peso di tendenza (media mobile esponenziale, α 0,1) e le kcal registrate negli ultimi 28 giorni; servono 14 giorni di peso e 10 di diario.</div>';
    return h;
  }
  function row(l, r) { return '<div class="li" style="min-height:40px"><div class="li-main small">' + l + '</div><div class="li-r">' + r + '</div></div>'; }

  const NUMF = { height: 1, weight: 1, protPerKg: 1, fatPerKg: 1, rateKg: 1, kcalOverride: 1 };
  UI.onChange('altro.pf', el => {
    const p = S().profile, f = el.dataset.f;
    if (NUMF[f]) {
      const v = UI.parseNum(el.value);
      if (f === 'kcalOverride') p[f] = isFinite(v) && v > 500 ? Math.round(v) : '';
      else if (f === 'protPerKg' && isFinite(v) && v > 0) {
        // proteine: si resta nell'intervallo ISSN 1,6–2,2 g/kg, altrimenti avviso e uso il limite
        const c = Math.min(2.2, Math.max(1.6, v));
        if (c !== v) UI.toast("Fuori dall'intervallo consigliato 1,6–2,2 g/kg: ho usato " + String(c).replace('.', ','), 4500);
        p[f] = c;
      }
      else if (isFinite(v) && v > 0) p[f] = v;
      if (f === 'weight' && isFinite(v) && v > 20) Store.ensureBody(Store.today()).w = v;
    } else if (f === 'trainDays' || f === 'activity') p[f] = +el.value;
    else p[f] = el.value;
    Store.change(); UI.refresh();
  });
  UI.on('altro.sex', el => { S().profile.sex = el.dataset.v; Store.change(); UI.refresh(); });
  UI.onChange('altro.goal', el => {
    const p = S().profile; p.goal = el.value;
    p.protPerKg = p.goal === 'definizione' ? 2.2 : 2.0;
    p.rateKg = p.goal === 'definizione' ? 0.5 : 0.25;
    Store.change(); UI.refresh();
  });
  UI.on('altro.adaptive', () => { const p = S().profile; p.useAdaptive = !p.useAdaptive; Store.change(); UI.refresh(); });

  /* =============== PREFERENZE =============== */
  const PREF_L = [['fav', 'Preferiti', 'Alimenti che ti piacciono: li uso per proporti i pasti'], ['dislike', 'Non mi piace', 'Non li escludo, ma ti avviso'], ['avoid', 'Da evitare', 'Per salute o intolleranze: ti avviso e non li propongo'], ['proteins', 'Proteine che voglio', 'Le fonti di proteine che preferisci']];
  function prefsPage() {
    const p = S().prefs;
    return PREF_L.map(l => '<div class="card"><div class="card-h"><h3>' + l[1] + '</h3><div class="card-r"><button class="link" data-act="altro.prefAdd" data-l="' + l[0] + '">+ Aggiungi</button></div></div><p class="xs mut mb8">' + l[2] + '</p>' +
      (p[l[0]].length ? '<div class="chips">' + p[l[0]].map(id => { const f = Calc.food(id); return '<button class="chip" data-act="altro.prefDel" data-l="' + l[0] + '" data-id="' + esc(id) + '">' + esc(f ? f.n : id) + ' ✕</button>'; }).join('') + '</div>' : '<p class="small mut">Nessuno.</p>') + '</div>').join('') +
      '<div class="card"><div class="card-h"><h3>Note</h3></div><textarea class="inp" rows="3" data-ch="altro.prefNotes" placeholder="Allergie, abitudini, cosa non mangi…">' + esc(p.notes || '') + '</textarea></div>';
  }
  UI.on('altro.prefAdd', el => {
    const l = el.dataset.l;
    Cibo.openSearch({ title: 'Scegli alimento', onPick: f => { const arr = S().prefs[l]; if (arr.indexOf(f.id) < 0) arr.push(f.id); Store.change(); UI.refresh(); } });
  });
  UI.on('altro.prefDel', el => { const arr = S().prefs[el.dataset.l]; const i = arr.indexOf(el.dataset.id); if (i >= 0) arr.splice(i, 1); Store.change(); UI.refresh(); });
  UI.onChange('altro.prefNotes', el => { S().prefs.notes = el.value; Store.change(); });

  /* =============== data comune per corpo e benessere =============== */
  const dnav = UI.dateBar;
  UI.on('ad.prev', () => { A.d = Store.addDays(A.d, -1); UI.refresh(); });
  UI.on('ad.next', () => { A.d = Store.addDays(A.d, 1); UI.refresh(); });
  UI.on('ad.pick', () => Oggi.pickDate(A.d, d => { A.d = d; UI.refresh(); }));

  /* =============== CORPO =============== */
  const MEAS = [['w', 'Peso (kg)'], ['vita', 'Vita (cm)'], ['fianchi', 'Fianchi (cm)'], ['petto', 'Petto (cm)'], ['braccio', 'Braccio (cm)'], ['coscia', 'Coscia (cm)'], ['bf', 'Grasso corporeo (%)']];
  function corpoPage() {
    const b = S().body[A.d] || {};
    let h = dnav(A.d, 'ad') + '<div class="card"><div class="grid2">' + MEAS.map(m => UI.field(m[1], '<input class="inp" inputmode="decimal" data-ch="altro.body" data-f="' + m[0] + '" value="' + num(b[m[0]]) + '">')).join('') + '</div><p class="xs mut">Misura sempre nelle stesse condizioni (mattina, a digiuno). Il peso di tendenza smussa le oscillazioni giornaliere.</p></div>';
    const dates = Object.keys(S().body).filter(d => Object.keys(S().body[d]).length).sort().reverse().slice(0, 12);
    if (dates.length) h += '<div class="sec-t">Ultime misure</div><div class="card"><div class="list">' + dates.map(d => '<button class="li" data-act="altro.bodyGo" data-d="' + d + '"><div class="li-main"><div class="li-t">' + esc(UI.dateLabel(d)) + '</div><div class="li-s">' + MEAS.filter(m => S().body[d][m[0]]).map(m => m[1].split(' ')[0] + ' ' + num(S().body[d][m[0]])).join(' · ') + '</div></div></button>').join('') + '</div></div>';
    return h;
  }
  UI.onChange('altro.body', el => {
    const v = UI.parseNum(el.value), b = Store.ensureBody(A.d), f = el.dataset.f;
    if (isFinite(v) && v > 0) b[f] = v; else delete b[f];
    Store.change(); UI.toast('Salvato'); UI.refresh();
  });
  UI.on('altro.bodyGo', el => { A.d = el.dataset.d; UI.refresh(); UI.scrollTop(); });

  /* =============== BENESSERE =============== */
  function benessPage() {
    const w = S().well[A.d] || {};
    const chips = (f, cur) => '<div class="chips">' + [1, 2, 3, 4, 5].map(n => '<button class="chip' + (cur === n ? ' on' : '') + '" data-act="altro.wellN" data-f="' + f + '" data-v="' + n + '" style="min-width:44px;justify-content:center;min-height:40px">' + n + '</button>').join('') + '</div>';
    return dnav(A.d, 'ad') + '<div class="card">' +
      '<div class="grid2">' + UI.field('Sonno (ore)', '<input class="inp" inputmode="decimal" data-ch="altro.well" data-f="sleep" value="' + num(w.sleep) + '">') + UI.field('FC a riposo (bpm)', '<input class="inp" inputmode="numeric" data-ch="altro.well" data-f="hr" value="' + num(w.hr) + '">') + UI.field('Pressione (max / min)', '<div class="row gap6"><input class="inp" inputmode="numeric" data-ch="altro.well" data-f="sys" value="' + num(w.sys) + '" placeholder="120" aria-label="Massima"><input class="inp" inputmode="numeric" data-ch="altro.well" data-f="dia" value="' + num(w.dia) + '" placeholder="80" aria-label="Minima"></div>') + '</div>' +
      '<div class="field-l" style="margin-bottom:6px">Qualità del sonno (1–5)</div>' + chips('sq', w.sq) +
      '<div class="field-l mt12" style="margin-bottom:6px">Energia (1–5)</div>' + chips('energy', w.energy) +
      '<div class="field-l mt12" style="margin-bottom:6px">Capogiri</div><div class="chips"><button class="chip' + (w.dizzy === false ? ' on' : '') + '" data-act="altro.wellD" data-v="0">No</button><button class="chip' + (w.dizzy ? ' on' : '') + '" data-act="altro.wellD" data-v="1">Sì</button></div>' +
      '<label class="field mt12"><span class="field-l">Note</span><textarea class="inp" rows="2" data-ch="altro.well" data-f="note">' + esc(w.note || '') + '</textarea></label></div>' +
      '<div class="disc">Se hai capogiri frequenti o pressione fuori dalla norma, parlane con il medico.</div>';
  }
  UI.onChange('altro.well', el => {
    const w = Store.ensureWell(A.d), f = el.dataset.f;
    if (f === 'note') w.note = el.value;
    else { const v = UI.parseNum(el.value); if (isFinite(v) && v > 0) w[f] = v; else delete w[f]; }
    Store.change(); UI.toast('Salvato');
  });
  UI.on('altro.wellN', el => { const w = Store.ensureWell(A.d); const v = +el.dataset.v; w[el.dataset.f] = w[el.dataset.f] === v ? undefined : v; Store.change(); UI.refresh(); });
  UI.on('altro.wellD', el => { const w = Store.ensureWell(A.d); const v = el.dataset.v === '1'; w.dizzy = w.dizzy === v ? undefined : v; Store.change(); UI.refresh(); });

  /* =============== INTEGRATORI =============== */
  const WHEN = ['mattina', 'colazione', 'pranzo', 'sera', 'pre-allenamento', 'post-allenamento'];
  const UNITS = ['g', 'mg', 'µg', 'UI', 'capsule', 'ml'];
  function integratoriPage() {
    const sp = S().supps;
    let h = sp.length ? '<div class="card"><div class="list">' + sp.map(s => '<div class="li"><div class="li-main"><div class="li-t">' + esc(s.n) + '</div><div class="li-s">' + esc((s.dose || '') + ' ' + D.unitLbl(s.dose, s.unit) + (s.when ? ' · ' + s.when : '')) + '</div></div>' +
      '<button class="icon-btn sm" data-act="altro.suppRem" data-id="' + esc(s.id) + '" aria-label="Crea promemoria">' + UI.icon('bell', 18) + '</button>' +
      '<button class="icon-btn sm" data-act="altro.suppEdit" data-id="' + esc(s.id) + '" aria-label="Modifica">' + UI.icon('edit', 18) + '</button>' +
      '<button class="switch' + (s.active !== false ? ' on' : '') + '" role="switch" aria-label="Attivo" data-act="altro.suppAct" data-id="' + esc(s.id) + '"></button></div>').join('') + '</div></div>' : UI.card('I miei integratori', UI.empty('Nessun integratore. Aggiungine uno o parti da una scheda sotto.'));
    h += '<button class="btn primary block mb8" data-act="altro.suppNew">+ Aggiungi integratore</button>';
    h += '<div class="sec-t">Schede informative</div>' + D.SUPP_INFO.map(i => '<div class="card"><div class="card-h"><h3>' + esc(i.n) + '</h3><div class="card-r">' + UI.badge('prove: ' + i.ev, /forte/.test(i.ev) ? 'ok' : (/moderata/.test(i.ev) ? 'warn' : '')) + '</div></div><p class="small"><b>' + esc(i.dose) + '</b></p><p class="small mut mt4">' + esc(i.t) + '</p><button class="btn xs mt8" data-act="altro.suppPre" data-id="' + i.id + '">Aggiungi all\'elenco</button></div>').join('');
    h += '<div class="disc">Dosi e scelte: parola finale al medico. Gli integratori non sostituiscono una dieta varia.</div>';
    return h;
  }
  const SUPP_PRESETS = [['vitD', 'Vitamina D'], ['mg', 'Magnesio'], ['fe', 'Ferro'], ['zn', 'Zinco'], ['b12', 'Vitamina B12'], ['o3', 'Omega-3 (g)'], ['ca', 'Calcio'], ['vitC', 'Vitamina C'], ['b9', 'Folati']];
  const NUT_SUPP = ['vitA', 'vitC', 'vitD', 'vitE', 'vitK', 'b1', 'b2', 'b3', 'b5', 'b6', 'b9', 'b12', 'coline', 'ca', 'mg', 'p', 'fe', 'zn', 'cu', 'mn', 'se', 'k', 'epadha', 'o3', 'caff'];
  /* foto dell'etichetta -> JPEG ridotto (lato max 1600 px) in base64 */
  function shrinkImage(file) {
    return new Promise((ok, ko) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const sc = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * sc); c.height = Math.round(img.naturalHeight * sc);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        ok(c.toDataURL('image/jpeg', 0.85).split(',')[1]);
      };
      img.onerror = () => { URL.revokeObjectURL(url); ko(new Error('Non riesco ad aprire la foto')); };
      img.src = url;
    });
  }
  /* Gemini legge la tabella nutrizionale: valori per UNA dose, già nell'unità dell'app */
  async function readLabel(file) {
    const data = await shrinkImage(file);
    const list = NUT_SUPP.map(k => k + ' = ' + D.NMAP[k].n + ' (' + D.NMAP[k].u + ')').join('\n');
    return AI.json({
      image: { mime: 'image/jpeg', data },
      temperature: 0,
      prompt: 'Questa è la foto dell\'etichetta di un integratore. Leggi la tabella nutrizionale e restituisci i valori per UNA dose giornaliera consigliata (se la tabella ha più colonne usa quella per dose/porzione, non per 100 g).\n' +
        'Usa solo queste chiavi e converti la quantità nell\'unità indicata (1 mg = 1000 µg; vitamina D: 40 UI = 1 µg; vitamina A in µg RE; EPA+DHA e Omega-3 in grammi):\n' + list + '\n' +
        'Ignora i nutrienti che non sono nell\'elenco e le percentuali %VNR. Non inventare valori che non leggi. ' +
        'name = nome commerciale del prodotto; dose e unit = la dose giornaliera (unit una tra ' + UNITS.join(', ') + ', «capsule» anche per compresse/softgel); per = descrizione breve della dose, es. «2 capsule».'
      ,
      schema: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' }, dose: { type: 'NUMBER' }, unit: { type: 'STRING', enum: UNITS }, per: { type: 'STRING' },
          nutrients: { type: 'ARRAY', items: { type: 'OBJECT', properties: { k: { type: 'STRING', enum: NUT_SUPP }, amount: { type: 'NUMBER' } }, required: ['k', 'amount'] } }
        },
        required: ['nutrients']
      }
    });
  }
  function suppForm(s, pre) {
    const x = s || pre || { n: '', dose: '', unit: 'g', when: 'mattina', v: {}, active: true };
    const sh = UI.sheet({
      title: s ? 'Modifica integratore' : 'Nuovo integratore', cls: 'tall',
      html: '<label class="btn block mb8" id="sf-photo" style="cursor:pointer">📷 Leggi l\'etichetta con una foto<input type="file" id="sf-file" accept="image/*" hidden></label>' +
        '<p class="hint mb12" id="sf-photo-h">Fotografa la tabella dei valori: Gemini compila i campi, tu controlli e premi Salva. La foto va a Google e non viene salvata nell\'app.</p>' +
        UI.field('Nome', UI.inp({ id: 'sf-n', value: x.n, ph: 'es. Creatina monoidrato' })) +
        '<div class="grid2">' + UI.field('Dose', UI.inp({ id: 'sf-d', value: x.dose, dec: 1, ph: '5' })) + UI.field('Unità', UI.select(UNITS.map(u => [u, u]), x.unit, 'id="sf-u"')) + '</div>' +
        UI.field('Quando', UI.select(WHEN.map(u => [u, u]), x.when, 'id="sf-w"')) +
        '<div class="sec-t" style="margin-top:6px">Contenuto per dose (facoltativo)</div><p class="hint mb8">Valori scritti sull\'etichetta, per una dose. Verranno sommati ai totali del giorno quando spunti l\'integratore (nelle barre dei micronutrienti compaiono in un colore a parte).</p>' +
        '<div class="chips mb8" id="sf-chips"></div><div id="sf-rows"></div><div class="mb12">' + UI.select([['', '＋ Altro nutriente…']].concat(NUT_SUPP.map(k => [k, D.NMAP[k].n + ' (' + D.NMAP[k].u + ')'])), '', 'id="sf-addk"') + '</div>' +
        '<div class="row gap">' + (s ? '<button class="btn danger" id="sf-del">Elimina</button>' : '') + '<button class="btn primary grow" id="sf-ok">Salva</button></div>'
    });
    /* editor «contenuto per dose»: righe {k, amt, ui} (ui = vitamina D inserita in UI; 40 UI = 1 µg) */
    const rows = Object.keys(x.v || {}).filter(k => D.NMAP[k]).map(k => ({ k, amt: (x.v || {})[k], ui: false }));
    const rowsEl = sh.body.querySelector('#sf-rows');
    function drawRows() {
      rowsEl.innerHTML = rows.map((r, i) => {
        const m = D.NMAP[r.k];
        const unit = r.k === 'vitD' ? UI.select([['0', 'µg'], ['1', 'UI']], r.ui ? '1' : '0', 'data-ru="' + i + '" style="width:76px;flex:none"') : '<span class="mut" style="min-width:34px">' + m.u + '</span>';
        const conv = r.k === 'vitD' && r.ui && UI.parseNum(r.amt) > 0 ? '<div class="xs mut" style="margin:-4px 0 8px 2px">= ' + UI.fmtA(UI.parseNum(r.amt) / 40, 2) + ' µg (40 UI = 1 µg)</div>' : '';
        return '<div class="msgrow mb8"><div class="li-main small">' + esc(m.n) + '</div><input class="inp" style="width:84px;flex:none;text-align:center" inputmode="decimal" data-ra="' + i + '" value="' + esc(num(r.amt)) + '" aria-label="' + esc(m.n) + '">' + unit + '<button class="icon-btn sm" data-rr="' + i + '" aria-label="Togli">' + UI.icon('close', 16) + '</button></div>' + conv;
      }).join('');
      sh.body.querySelector('#sf-chips').innerHTML = SUPP_PRESETS.filter(p => !rows.some(r => r.k === p[0])).map(p => '<button class="chip sm" data-rp="' + p[0] + '">＋ ' + p[1] + '</button>').join('');
    }
    drawRows();
    sh.body.addEventListener('click', e => {
      const rp = e.target.closest('[data-rp]'), rr = e.target.closest('[data-rr]');
      if (rp) { rows.push({ k: rp.dataset.rp, amt: '', ui: false }); drawRows(); }
      else if (rr) { rows.splice(+rr.dataset.rr, 1); drawRows(); }
    });
    sh.body.addEventListener('change', async e => {
      const t = e.target;
      if (t.id === 'sf-file') {
        const f = t.files && t.files[0]; t.value = ''; if (!f) return;
        const btn = sh.body.querySelector('#sf-photo'), hint = sh.body.querySelector('#sf-photo-h'), old = btn.firstChild.textContent;
        btn.classList.add('dis'); btn.style.pointerEvents = 'none'; btn.firstChild.textContent = 'Leggo l\'etichetta…';
        try {
          const r = await readLabel(f);
          const g = id => sh.body.querySelector(id);
          if (r.name && !g('#sf-n').value.trim()) g('#sf-n').value = r.name;
          if (r.dose > 0) g('#sf-d').value = num(r.dose);
          if (r.unit && UNITS.includes(r.unit)) g('#sf-u').value = r.unit;
          let n = 0;
          (r.nutrients || []).forEach(q => {
            const amt = Number(q.amount);
            if (!D.NMAP[q.k] || !NUT_SUPP.includes(q.k) || !(amt > 0)) return;
            const v = Math.round(amt * 1000) / 1000, ex = rows.find(z => z.k === q.k);
            if (ex) { ex.amt = num(v); ex.ui = false; } else rows.push({ k: q.k, amt: num(v), ui: false });
            n++;
          });
          drawRows();
          hint.innerHTML = '✅ Letto' + (r.per ? ' (valori per ' + esc(r.per) + ')' : '') + ': ' + n + ' nutrienti. <b>Controlla i numeri con l\'etichetta</b>, poi premi Salva.';
          UI.toast(n ? 'Etichetta letta: controlla e salva' : 'Nessun valore trovato: prova una foto più nitida');
        } catch (err) { UI.toast(err.message || 'Non riesco a leggere l\'etichetta'); }
        btn.classList.remove('dis'); btn.style.pointerEvents = ''; btn.firstChild.textContent = old;
        return;
      }
      if (t.id === 'sf-addk') { if (t.value && !rows.some(r => r.k === t.value)) rows.push({ k: t.value, amt: '', ui: false }); t.value = ''; drawRows(); }
      else if (t.dataset.ra != null) { rows[+t.dataset.ra].amt = t.value; drawRows(); }
      else if (t.dataset.ru != null) { rows[+t.dataset.ru].ui = t.value === '1'; drawRows(); }
    });
    sh.body.querySelector('#sf-ok').onclick = () => {
      const n = sh.body.querySelector('#sf-n').value.trim(); if (!n) return UI.toast('Scrivi il nome');
      const v = {};
      rows.forEach(r => { let q = UI.parseNum(r.amt); if (isFinite(q) && q > 0) { if (r.k === 'vitD' && r.ui) q = Math.round(q / 40 * 1000) / 1000; v[r.k] = Math.round(((v[r.k] || 0) + q) * 1000) / 1000; } });
      const o = s || { id: Store.uid('sp'), active: true };
      o.n = n; o.dose = sh.body.querySelector('#sf-d').value.trim(); o.unit = sh.body.querySelector('#sf-u').value; o.when = sh.body.querySelector('#sf-w').value; o.v = v;
      if (!s) S().supps.push(o);
      Store.change(); sh.close(); UI.refresh(); UI.toast('Integratore salvato');
    };
    if (s) sh.body.querySelector('#sf-del').onclick = async () => {
      if (await UI.confirm({ title: 'Eliminare «' + s.n + '»?', ok: 'Elimina', danger: true })) { S().supps = S().supps.filter(q => q.id !== s.id); S().reminders = S().reminders.filter(r => r.key !== 'supp:' + s.id); Store.change(); sh.close(); UI.refresh(); }
    };
  }
  UI.on('altro.suppNew', () => suppForm(null));
  UI.on('altro.suppEdit', el => suppForm(S().supps.find(s => s.id === el.dataset.id)));
  UI.on('altro.suppAct', el => { const s = S().supps.find(q => q.id === el.dataset.id); s.active = s.active === false; Store.change(); UI.refresh(); });
  UI.on('altro.suppRem', el => Rem.editSheet('supp:' + el.dataset.id, false));
  UI.on('altro.suppPre', el => {
    const P = { creatina: { n: 'Creatina monoidrato', dose: '5', unit: 'g', when: 'mattina' }, caffeina: { n: 'Caffeina', dose: '200', unit: 'mg', when: 'pre-allenamento', v: { caff: 200 } }, proteine: { n: 'Proteine in polvere', dose: '30', unit: 'g', when: 'post-allenamento' }, vitd: { n: 'Vitamina D', dose: '50', unit: 'µg', when: 'colazione', v: { vitD: 50 } }, omega3: { n: 'Omega-3', dose: '1', unit: 'capsule', when: 'pranzo', v: { epadha: 0.5 } }, betaalanina: { n: 'Beta-alanina', dose: '3,2', unit: 'g', when: 'pre-allenamento' }, magnesio: { n: 'Magnesio', dose: '200', unit: 'mg', when: 'sera', v: { mg: 200 } }, ferro: { n: 'Ferro', dose: '', unit: 'mg', when: 'colazione' }, citrullina: { n: 'Citrullina', dose: '6', unit: 'g', when: 'pre-allenamento' }, ashwagandha: { n: 'Ashwagandha', dose: '', unit: 'mg', when: 'sera' } }[el.dataset.id];
    suppForm(null, Object.assign({ v: {}, active: true }, P));
  });

  /* =============== REFERTI =============== */
  function refertiPage() {
    const labs = S().labs.slice().sort((a, b) => b.date.localeCompare(a.date));
    let h = '<div class="disc mb8">L\'app non fa diagnosi: serve a tenere in ordine i tuoi esami. Per ogni valore e per i range fa fede il referto del laboratorio; i range precompilati sono solo indicativi.</div>';
    h += '<button class="btn primary block mb8" data-act="altro.labNew">+ Nuovo referto</button>';
    if (!labs.length) return h + UI.card('Referti', UI.empty('Nessun referto.'));
    h += '<div class="card"><div class="list">' + labs.map(l => {
      const bad = l.vals.filter(v => Calc.labStatus(v) !== 'ok').length;
      return '<button class="li" data-act="altro.labOpen" data-id="' + esc(l.id) + '"><div class="li-main"><div class="li-t">' + esc(UI.dateLong(l.date)) + (l.lab ? ' · ' + esc(l.lab) : '') + '</div><div class="li-s">' + l.vals.length + ' valori' + ((l.files || []).length ? ' · ' + l.files.length + ' allegati' : '') + '</div></div>' + (bad ? UI.badge(bad + ' fuori range', 'bad') : UI.badge('nei range', 'ok')) + '</button>';
    }).join('') + '</div></div>';
    return h;
  }
  function labRowHtml(v, i) {
    const st = Calc.labStatus(v);
    const pre = D.LABMAP[v.k];
    return '<div class="card" style="padding:10px;margin-bottom:8px"><div class="row between mb8"><b class="small">' + esc(Calc.labName(v.k)) + '</b><div class="row gap6">' + (st !== 'ok' ? UI.badge(st === 'low' ? 'basso' : 'alto', 'bad') : '') + '<button class="icon-btn sm" data-lr="del" data-i="' + i + '" aria-label="Togli">' + UI.icon('trash', 16) + '</button></div></div>' +
      '<div class="grid2" style="grid-template-columns:1fr 1fr 1fr 1fr;gap:6px"><label><span class="field-l">Valore</span><input class="inp" inputmode="decimal" data-lf="val" data-i="' + i + '" value="' + num(v.val) + '" style="padding:6px"></label>' +
      '<label><span class="field-l">Unità</span><input class="inp" data-lf="unit" data-i="' + i + '" value="' + esc(v.unit || '') + '" style="padding:6px"></label>' +
      '<label><span class="field-l">Min</span><input class="inp" inputmode="decimal" data-lf="lo" data-i="' + i + '" value="' + num(v.lo) + '" style="padding:6px"></label>' +
      '<label><span class="field-l">Max</span><input class="inp" inputmode="decimal" data-lf="hi" data-i="' + i + '" value="' + num(v.hi) + '" style="padding:6px"></label></div>' +
      (v.ind ? '<p class="xs mut mt4">Range indicativo: sostituiscilo con quello scritto sul referto.</p>' : '') + (pre ? '' : '') + '</div>';
  }
  function labForm(existing) {
    const draft = existing ? JSON.parse(JSON.stringify(existing)) : { id: Store.uid('l'), date: Store.today(), lab: '', note: '', files: [], fm: [], vals: [] };
    if (!draft.fm) draft.fm = (draft.files || []).map(id => ({ id, name: 'allegato', type: '' }));
    const added = []; let saved = false;
    const sh = UI.sheet({ title: existing ? 'Modifica referto' : 'Nuovo referto', cls: 'tall', onClose() { if (!saved) added.forEach(id => Store.delFile(id)); } });
    function draw() {
      sh.set(UI.field('Data', '<input class="inp" type="date" id="lf-date" value="' + esc(draft.date) + '">') + UI.field('Laboratorio', UI.inp({ id: 'lf-lab', value: draft.lab, ph: 'facoltativo' })) +
        '<div class="sec-t" style="margin-top:4px">Valori</div>' + (draft.vals.length ? draft.vals.map(labRowHtml).join('') : '<p class="small mut mb8">Aggiungi i parametri del referto.</p>') +
        '<div class="row gap mb8"><div class="grow">' + UI.select([['', 'Aggiungi parametro…']].concat(D.LABS.map(p => [p.k, p.n])).concat([['__free', 'Altro (nome libero)']]), '', 'id="lf-add"') + '</div></div>' +
        UI.field('Note', '<textarea class="inp" id="lf-note" rows="2">' + esc(draft.note || '') + '</textarea>') +
        '<div class="field-l" style="margin-bottom:6px">Allegati (foto o PDF)</div>' + (draft.fm.length ? '<div class="chips mb8">' + draft.fm.map((f, i) => '<span class="chip sm">' + esc(f.name || 'file') + ' <button data-lr="fdel" data-i="' + i + '" aria-label="Togli" style="color:var(--bad)">✕</button></span>').join('') + '</div>' : '') +
        '<label class="btn block mb12" style="cursor:pointer">+ Aggiungi foto o PDF<input type="file" id="lf-file" accept="image/*,application/pdf" multiple hidden></label>' +
        '<div class="row gap">' + (existing ? '<button class="btn danger" data-lr="delete">Elimina</button>' : '') + '<button class="btn primary grow" data-lr="save">Salva referto</button></div>');
    }
    draw();
    const readTop = () => { const g = id => sh.body.querySelector(id); if (g('#lf-date')) { draft.date = g('#lf-date').value || draft.date; draft.lab = g('#lf-lab').value; draft.note = g('#lf-note').value; } };
    sh.body.addEventListener('change', async e => {
      const t = e.target;
      if (t.id === 'lf-add') {
        readTop();
        const k = t.value; if (!k) return;
        if (k === '__free') {
          const nm = ((await UI.prompt({ title: 'Nome del parametro', ph: 'es. Ferritina' })) || '').trim(); if (!nm) { draw(); return; }
          draft.vals.push({ k: 'x:' + nm, val: '', unit: '', lo: '', hi: '' });
        } else {
          const pre = D.LABMAP[k], r = Calc.labRange(k, S().profile && S().profile.sex);
          draft.vals.push({ k, val: '', unit: pre.u, lo: r.lo == null ? '' : r.lo, hi: r.hi == null ? '' : r.hi, ind: true });
        }
        draw(); return;
      }
      if (t.id === 'lf-file') {
        readTop();
        for (const f of Array.from(t.files || [])) {
          const id = Store.uid('f');
          try { await Store.putFile(id, f); added.push(id); draft.fm.push({ id, name: f.name || 'allegato', type: f.type || '' }); draft.files.push(id); }
          catch (err) { UI.toast('Non riesco a salvare ' + (f.name || 'il file')); }
        }
        draw(); return;
      }
      const f = t.dataset.lf;
      if (f) {
        const v = draft.vals[+t.dataset.i];
        if (f === 'unit') v.unit = t.value;
        else { const n = UI.parseNum(t.value); v[f] = isFinite(n) ? n : ''; if (f === 'lo' || f === 'hi') v.ind = false; }
        readTop(); draw();
      }
    });
    sh.body.addEventListener('click', async e => {
      const b = e.target.closest('[data-lr]'); if (!b) return;
      readTop();
      const a = b.dataset.lr;
      if (a === 'del') { draft.vals.splice(+b.dataset.i, 1); draw(); }
      else if (a === 'fdel') { const f = draft.fm.splice(+b.dataset.i, 1)[0]; draft.files = draft.files.filter(x => x !== f.id); if (added.indexOf(f.id) >= 0) Store.delFile(f.id); else draft._rm = (draft._rm || []).concat(f.id); draw(); }
      else if (a === 'save') {
        draft.vals = draft.vals.filter(v => v.val !== '' && v.val != null);
        if (!draft.vals.length && !draft.fm.length) return UI.toast('Aggiungi almeno un valore o un allegato');
        (draft._rm || []).forEach(id => Store.delFile(id)); delete draft._rm;
        const i = S().labs.findIndex(l => l.id === draft.id);
        if (i >= 0) S().labs[i] = draft; else S().labs.push(draft);
        saved = true; Store.change(); sh.close(); UI.refresh(); UI.toast('Referto salvato');
      } else if (a === 'delete') {
        if (await UI.confirm({ title: 'Eliminare il referto?', msg: 'Anche gli allegati verranno cancellati.', ok: 'Elimina', danger: true })) {
          (existing.files || []).forEach(id => Store.delFile(id));
          S().labs = S().labs.filter(l => l.id !== existing.id); saved = true; Store.change(); sh.close(); UI.refresh();
        }
      }
    });
  }
  async function labDetail(l) {
    const urls = [];
    const sh = UI.sheet({ title: 'Referto · ' + UI.dateShort(l.date), cls: 'tall', onClose() { urls.forEach(u => URL.revokeObjectURL(u)); } });
    let h = (l.lab ? '<p class="small mut mb8">' + esc(l.lab) + '</p>' : '') + '<div class="card" style="padding:4px 12px"><div class="list">' + l.vals.map(v => {
      const st = Calc.labStatus(v);
      return '<div class="li"><div class="li-main"><div class="li-t">' + esc(Calc.labName(v.k)) + '</div><div class="li-s">range ' + (v.lo === '' || v.lo == null ? '…' : num(v.lo)) + '–' + (v.hi === '' || v.hi == null ? '…' : num(v.hi)) + ' ' + esc(v.unit || '') + (v.ind ? ' (indicativo)' : '') + '</div></div><div class="li-r ' + (st === 'ok' ? '' : 'bad') + '"><b>' + num(v.val) + '</b> ' + esc(v.unit || '') + (st !== 'ok' ? '<small>' + (st === 'low' ? 'sotto il range' : 'sopra il range') + '</small>' : '') + '</div></div>';
    }).join('') + '</div></div>';
    if (l.note) h += '<div class="disc mb8">' + esc(l.note) + '</div>';
    h += '<div id="ld-files"></div><div class="disc mb12">L\'app non fa diagnosi: parlane con il medico.</div><button class="btn block" id="ld-edit">Modifica</button>';
    sh.set(h);
    sh.body.querySelector('#ld-edit').onclick = () => { sh.close(); setTimeout(() => labForm(l), 350); };
    const box = sh.body.querySelector('#ld-files');
    for (const f of (l.fm || [])) {
      try {
        const blob = await Store.getFile(f.id); if (!blob) continue;
        const url = URL.createObjectURL(blob); urls.push(url);
        const isImg = /^image\//.test(f.type || blob.type);
        box.insertAdjacentHTML('beforeend', isImg ? '<a href="' + url + '" target="_blank" rel="noopener"><img class="fileprev mb8" src="' + url + '" alt="' + esc(f.name) + '"></a>' : '<a class="btn block mb8" href="' + url + '" target="_blank" rel="noopener">Apri ' + esc(f.name) + '</a>');
      } catch (e) { /* ignora */ }
    }
  }
  UI.on('altro.labNew', () => labForm(null));
  UI.on('altro.labOpen', el => { const l = S().labs.find(x => x.id === el.dataset.id); if (l) labDetail(l); });

  /* =============== COLLEGA SALUTE =============== */
  const SALUTE_SAMPLE = () => 'STRIDE\ndata=' + Store.today() + '\npeso=75,4\ngrasso=18,2\npassi=8432\nsonno=7,5\nfc=52';
  function salutePage() {
    const li = t => '<li>' + t + '</li>';
    return '<div class="card"><p class="small mb8">Un Comando rapido dell\'iPhone legge peso, grasso, passi, sonno e frequenza a riposo da <b>Salute</b> e li copia negli appunti. In Stride basta toccare <b>Leggi da Salute</b> nella scheda Oggi e confermare.</p>' +
      '<div class="sec-t" style="margin-top:4px">Costruisci il comando</div><ol class="steps small">' +
      li('Apri l\'app <b>Comandi</b> → <b>+</b> → chiama il comando <b>Stride Salute</b>.') +
      li('Aggiungi <b>Trova campioni di Salute</b>: tipo <b>Peso</b>, ordina per <b>Data di inizio</b> (più recente prima), <b>Limite: 1</b>.') +
      li('Aggiungi un altro <b>Trova campioni di Salute</b>: <b>Percentuale di massa grassa</b>, ultimo, limite 1.') +
      li('Aggiungi <b>Trova campioni di Salute</b>: <b>Passi</b>, data di inizio <b>è oggi</b>, poi <b>Calcola statistiche → Somma</b>.') +
      li('Aggiungi <b>Trova campioni di Salute</b>: <b>Analisi del sonno</b> (ultima notte: data di fine è oggi), poi <b>Calcola statistiche → Somma</b> in ore. Se nel totale compare anche il tempo a letto, filtra il valore «Addormentato».') +
      li('Aggiungi <b>Trova campioni di Salute</b>: <b>Frequenza cardiaca a riposo</b>, ultimo, limite 1.') +
      li('Aggiungi l\'azione <b>Testo</b> e scrivi le righe qui sotto; al posto di ogni <b>…</b> tocca il campo e scegli la variabile del passo giusto (data: <b>Data corrente</b> con formato personalizzato <b>aaaa-MM-gg</b>).') +
      '</ol><div class="pre-box mb8">STRIDE\ndata=…\npeso=…\ngrasso=…\npassi=…\nsonno=…\nfc=…</div>' +
      '<ol class="steps small" start="8">' +
      li('Aggiungi <b>Copia negli appunti</b>.') +
      li('Facoltativo: aggiungi <b>Apri app</b> → Stride.') +
      li('Apri Stride → Oggi → <b>Leggi da Salute</b>: iOS ti chiede il permesso di incollare, poi controlli i valori e tocchi «Salva». Le chiavi mancanti vengono ignorate.') +
      '</ol><div class="sec-t">Facoltativo: in automatico ogni mattina</div><ol class="steps small">' +
      li('Comandi → <b>Automazione</b> → <b>+</b> → <b>Ora del giorno</b> → <b>08:00</b>, ogni giorno.') +
      li('Azione: <b>Esegui comando</b> → Stride Salute. Scegli «Esegui immediatamente».') +
      '</ol><button class="btn block mb8" data-act="altro.saluteSample">Copia testo di esempio</button><p class="xs mut mb8">Copia il testo di esempio, apri Oggi e tocca «Leggi da Salute» per provare senza il comando.</p>' +
      '<div class="hl small"><b>Bilancia smart (es. Active Era):</b> nella sua app devi attivare la sincronizzazione con <b>Salute / Apple Health</b>, così il peso compare in Salute. Il browser su iPhone non può usare il Bluetooth, quindi Stride non si collega direttamente alla bilancia.</div>' +
      '<p class="xs mut mt12">Il vecchio formato <b>PASSI 8432 2026-10-19</b> funziona ancora. Le app sulla Home di iOS hanno un archivio separato da Safari: per questo si passano i dati con gli appunti e non con un indirizzo web.</p></div>';
  }
  UI.on('altro.saluteSample', async () => { UI.toast(await UI.copyText(SALUTE_SAMPLE()) ? 'Testo copiato' : 'Copia non riuscita'); });
  function passiPage() {
    return '<div class="card"><p class="small mb8">Il Comando rapido dell\'iPhone legge i passi da Salute e li copia negli appunti. In Stride basta toccare «Leggi passi» nella scheda Oggi.</p>' +
      '<ol class="steps small"><li>Apri l\'app <b>Comandi</b> e crea un nuovo comando.</li><li>Aggiungi <b>Trova campioni di Salute</b>: tipo <b>Passi</b>, data di inizio <b>oggi</b>.</li><li>Aggiungi <b>Calcola statistiche</b>: <b>Somma</b>.</li><li>Aggiungi <b>Testo</b> e scrivi: <b>PASSI [Somma] [Data corrente]</b>. Per la data scegli il formato personalizzato <b>aaaa-MM-gg</b>.</li><li>Aggiungi <b>Copia negli appunti</b>.</li><li>Facoltativo: aggiungi <b>Apri app</b> → Stride.</li><li>In <b>Automazione</b> crea «Ora del giorno» ogni sera alle <b>22:00</b> che esegue il comando (disattiva «Chiedi prima di eseguire»).</li></ol>' +
      '<div class="hl small">Il testo copiato sarà tipo <b>PASSI 8432 2026-10-19</b>. In Oggi tocca <b>Leggi passi</b> e iOS ti chiederà il permesso di incollare.</div>' +
      '<p class="xs mut mt12">Nota: le app sulla Home di iOS hanno un archivio separato da Safari, quindi non si possono passare i dati con un indirizzo web. Per questo si usa la copia negli appunti.</p></div>';
  }

  /* =============== BACKUP =============== */
  function backupPage() {
    const lb = S().meta.lastBackup;
    return Cloud.backupCard() + '<div class="card"><h3 class="card-h-t mb8">Backup su file</h3><div class="li-s mb8">Ultimo backup: <b style="color:var(--tx)">' + (lb ? esc(UI.dateLong(Store.dkey(new Date(lb)))) : 'mai') + '</b></div>' +
      '<button class="btn primary block mb8" data-act="altro.export">Esporta backup</button>' +
      '<label class="btn block" style="cursor:pointer">Importa backup<input type="file" accept=".json,application/json" id="bk-file" data-ch="altro.import" hidden></label></div>' +
      '<div class="disc">Senza backup automatico i dati stanno solo su questo telefono: <b>se elimini l\'app Stride li perdi</b>. Il file è una copia in più da tenere in File o iCloud.</div>';
  }
  UI.on('altro.export', async () => {
    UI.toast('Preparo il backup…');
    try {
      // la chiave Gemini e il codice di backup restano solo su questo telefono: non entrano nel file
      const payload = await Cloud.buildPayload();
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      const name = 'stride-backup-' + Store.today() + '.json';
      S().meta.lastBackup = Date.now(); Store.change();
      const file = (typeof File === 'function') ? new File([blob], name, { type: 'application/json' }) : null;
      let done = false;
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); done = true; } catch (e) { if (e && e.name === 'AbortError') done = true; } }
      if (!done) UI.saveBlob(blob, name);
      UI.refresh(); UI.toast('Backup pronto');
    } catch (e) { console.error(e); UI.toast('Backup non riuscito: ' + e.message); }
  });
  UI.onChange('altro.import', async el => {
    const f = el.files && el.files[0]; if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (!j || (j.app !== 'stride' && j.app !== 'compagno') || !j.state) throw new Error('non è un backup di Stride');
      if (!await UI.confirm({ title: 'Importare il backup?', msg: 'Sostituisce TUTTI i dati attuali con quelli del file (' + (j.exported ? j.exported.slice(0, 10) : 'senza data') + ').', ok: 'Importa', danger: true })) { el.value = ''; return; }
      // la chiave Gemini e il codice di backup locali non vengono mai sovrascritti dal file
      await Cloud.applyPayload(j);
      A.sub = null; UI.toast('Backup importato'); UI.refresh();
    } catch (e) { UI.toast('File non valido: ' + e.message); }
    el.value = '';
  });

  /* =============== IMPOSTAZIONI AI =============== */
  function aiPage() {
    const st = S().settings;
    return '<div class="card">' +
      UI.field('Chiave Gemini', '<input class="inp" type="password" id="ai-key" data-ch="altro.aiKey" value="' + esc(st.geminiKey || '') + '" placeholder="Incolla qui la chiave" autocomplete="off" autocapitalize="off" spellcheck="false">', 'Gratis da <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com</a>. Resta solo su questo telefono e viene inviata solo a Google, mai nell\'indirizzo.') +
      '<button class="btn block mb12" data-act="altro.aiTest">Prova chiave</button>' +
      UI.field('Modello', A.models ? UI.select(A.models.map(m => [m, m]), st.model, 'data-ch="altro.aiModel"') : '<input class="inp" data-ch="altro.aiModel" value="' + esc(st.model) + '">', A.models ? 'Modelli trovati con la tua chiave (consigliati: «flash»).' : 'Predefinito gemini-3.5-flash. Usa «Prova chiave» per vedere i modelli disponibili.') +
      '<div class="nrow"><div class="li-main"><div class="li-t">Cerca studi recenti su Google</div><div class="li-s">Il Coach cita studi e linee guida con i link</div></div><button class="switch' + (st.search ? ' on' : '') + '" role="switch" data-act="altro.aiSearch" aria-label="Ricerca"></button></div>' +
      '<div class="nrow"><div class="li-main"><div class="li-t">Manda anche i referti</div><div class="li-s">Spento di default</div></div><button class="switch' + (st.sendLabs ? ' on' : '') + '" role="switch" data-act="altro.aiLabs" aria-label="Referti"></button></div></div>' +
      '<div class="disc">Con il piano gratuito Gemini <b>Google può usare i dati inviati</b> per migliorare i suoi servizi. Il Coach riceve un riassunto dei tuoi dati (profilo, medie, allenamenti, integratori, benessere). I referti partono solo se accendi l\'interruttore.</div>';
  }
  UI.onChange('altro.aiKey', el => { S().settings.geminiKey = el.value.trim(); Store.change(); UI.toast('Chiave salvata'); });
  UI.onChange('altro.aiModel', el => { S().settings.model = el.value.trim() || 'gemini-3.5-flash'; Store.change(); });
  UI.on('altro.aiSearch', () => { S().settings.search = !S().settings.search; Store.change(); UI.refresh(); });
  UI.on('altro.aiLabs', async () => {
    const st = S().settings;
    if (!st.sendLabs && !await UI.confirm({ title: 'Mandare i referti al Coach?', msg: 'I valori dei tuoi esami verranno inviati a Google (Gemini). Con il piano gratuito Google può usarli per migliorare i suoi servizi. Vuoi continuare?', ok: 'Accendi' })) return;
    st.sendLabs = !st.sendLabs; Store.change(); UI.refresh();
  });
  UI.on('altro.aiTest', async () => {
    const key = (document.getElementById('ai-key').value || S().settings.geminiKey || '').trim();
    if (!key) return UI.toast('Inserisci prima la chiave');
    S().settings.geminiKey = key; Store.change();
    if (!navigator.onLine) return UI.toast('Sei offline');
    UI.toast('Provo la chiave…');
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key } });
      const j = await r.json();
      if (!r.ok) throw new Error((j.error && j.error.message) || ('errore ' + r.status));
      let ms = (j.models || []).filter(m => (m.supportedGenerationMethods || []).indexOf('generateContent') >= 0).map(m => m.name.replace(/^models\//, ''));
      if (!ms.length) throw new Error('nessun modello disponibile');
      const flash = ms.filter(m => /flash/.test(m) && !/(image|tts|live|thinking|lite|embed)/.test(m)), rest = ms.filter(m => flash.indexOf(m) < 0);
      A.models = flash.sort().reverse().concat(rest.filter(m => /flash/.test(m)), rest.filter(m => !/flash/.test(m)).slice(0, 12));
      A.models = Array.from(new Set(A.models));
      const st = S().settings;
      if (A.models.indexOf(st.model) < 0) st.model = A.models[0];
      Store.change(); UI.refresh(); UI.toast('Chiave valida: ' + A.models.length + ' modelli');
    } catch (e) { UI.toast('Chiave non valida: ' + e.message); }
  });

  /* =============== CREDITI =============== */
  function creditiPage() {
    const a = (u, t) => '<a href="' + u + '" target="_blank" rel="noopener">' + esc(t) + '</a>';
    const cr = [
      ['Disegni degli esercizi', 'Workout Guide di Bryl Lim (' + a('https://github.com/bryllim/workout-guide', 'github.com/bryllim/workout-guide') + '), pose da Everkinetic (' + a('https://github.com/everkinetic/data', 'everkinetic/data') + '). Licenza ' + a('https://creativecommons.org/licenses/by-sa/4.0/', 'CC BY-SA 4.0') + '. File originali non modificati; nei cerchi Stride li mostra con i colori invertiti (nero su bianco). I muscoli in rosso sono una figura separata di Stride.'],
      ['Foto degli esercizi', 'free-exercise-db (' + a('https://github.com/yuhonas/free-exercise-db', 'github.com/yuhonas/free-exercise-db') + '), Unlicense / pubblico dominio. Usate solo dove manca un disegno.'],
      ['Figura del corpo', 'Tracciati da react-native-body-highlighter (' + a('https://github.com/HichamELBSI/react-native-body-highlighter', 'HichamELBSI/react-native-body-highlighter') + '), licenza MIT.'],
      ['Font', 'Manrope, © 2019 The Manrope Project Authors, ' + a('https://openfontlicense.org', 'SIL Open Font License 1.1') + ' (testo in fonts/OFL.txt).'],
      ['Alimenti', 'CREA Alimenti e Nutrizione (Tabelle 2019), USDA FoodData Central (pubblico dominio), Open Food Facts (ODbL). Dettagli in Info e fonti.']
    ];
    return '<div class="card">' + cr.map(c => '<div class="mb8"><b class="small">' + esc(c[0]) + '</b><div class="small mut">' + c[1] + '</div></div>').join('') + '</div>' +
      '<p class="xs mut center mt12">Grazie a chi pubblica il proprio lavoro con licenze libere.</p>';
  }

  /* =============== INFO E FONTI =============== */
  function infoPage() {
    const src = [
      ['Fabbisogno energetico', 'Equazione di Mifflin-St Jeor (Am J Clin Nutr 1990). 1 kg di peso ≈ 7.700 kcal.'],
      ['Fabbisogno adattivo', 'Stima come MacroFactor: peso di tendenza (media mobile esponenziale, α 0,1) e kcal registrate; TDEE = kcal medie − (Δ tendenza × 7.700 / giorni).'],
      ['Proteine', 'Posizione ISSN 2017 (Jäger et al.): 1,6–2,2 g/kg per chi si allena con i pesi.'],
      ['Micronutrienti', 'LARN 2014 (SINU) per vitamine e minerali; manganese e colina da EFSA. UL = livello massimo tollerabile (EFSA/LARN).'],
      ['Omega-3', 'EFSA 2010: 250 mg al giorno di EPA+DHA.'],
      ['Sodio, fibre, saturi, zuccheri', 'LARN 2014 / OMS: sodio < 2.000 mg, fibre ≥ 25 g (14 g/1000 kcal), saturi < 10% kcal, zuccheri semplici < 15% kcal.'],
      ['Acqua', 'EFSA 2010: acqua totale 2,5 L (uomo) e 2,0 L (donna). Obiettivo bevande: 35 ml/kg × 0,8 + 500 ml per ora di allenamento.'],
      ['Forza', 'e1RM con la formula di Epley, corretta con le ripetizioni in riserva (RPE).'],
      ['Progressione', 'Doppia progressione: carico su quando tutte le serie arrivano al massimo delle ripetizioni con RPE ≤ 8.'],
      ['Volume', 'Schoenfeld et al. 2017: 10–20 serie a settimana per muscolo per l\'ipertrofia.'],
      ['Creatina e caffeina', 'Posizione ISSN 2017 (creatina) e ISSN 2021 (caffeina).'],
      ['Varietà vegetale', 'Obiettivo indicativo di 30 vegetali diversi a settimana.'],
      ['Alimenti', 'Valori per 100 g dal database incluso (se caricato) o da Open Food Facts per i prodotti cercati o scansionati.'],
      ['CREA', 'Alimenti italiani da: CREA Centro di ricerca Alimenti e Nutrizione, Tabelle di composizione degli alimenti, Aggiornamento 2019 (a cura di L. Marletta ed E. Camilli), www.alimentinutrizione.it. Acidi grassi saturi, mono- e polinsaturi ricavati da % degli acidi grassi × lipidi (stima leggermente per eccesso).'],
      ['USDA', 'Altri alimenti: USDA FoodData Central, SR Legacy (2018), pubblico dominio. Fette biscottate e proteine whey: valori medi da etichetta.'],
      ['Open Food Facts', 'Database aperto di prodotti confezionati (openfoodfacts.org), licenza ODbL. I dati sono inseriti dalla comunità e possono contenere errori: controlla sempre l\'etichetta.']
    ];
    return '<div class="card">' + src.map(s => '<div class="mb8"><b class="small">' + esc(s[0]) + '</b><div class="small mut">' + esc(s[1]) + '</div></div>').join('') + '</div>' +
      '<div class="disc mb12"><b>Stride non fa diagnosi né sostituisce il medico.</b> Per sintomi, esami o dubbi sulla salute, parlane con un professionista.</div>' +
      '<details class="det"><summary>Strumenti di prova</summary><p class="small mut mb8">Per provare l\'app con dati finti. Sostituiscono i tuoi dati attuali.</p><button class="btn block mb8" data-act="altro.demo">Carica dati di prova</button><button class="btn danger block" data-act="altro.wipe">Cancella tutto</button></details>' +
      '<p class="xs mut center mt12">Stride · versione ' + (window.APP_VERSION || '1') + '</p>';
  }
  UI.on('altro.demo', async () => {
    if (!await UI.confirm({ title: 'Caricare i dati di prova?', msg: 'Sostituisce tutti i dati attuali con 3 settimane di dati finti.', ok: 'Carica', danger: true })) return;
    const r = await Demo.load();
    A.sub = null; UI.go('oggi'); UI.toast(r.foods ? 'Dati di prova caricati' : 'Dati caricati (senza diario: database alimenti assente)');
  });
  UI.on('altro.wipe', async () => {
    if (!await UI.confirm({ title: 'Cancellare tutto?', msg: 'Perdi profilo, diario, allenamenti, referti e allegati. Non si può annullare.', ok: 'Continua', danger: true })) return;
    if (!await UI.confirm({ title: 'Ultima conferma', msg: 'Sei sicuro? Se non hai fatto un backup i dati sono persi per sempre.', ok: 'Cancella tutto', danger: true })) return;
    await Store.wipe(); Calc.invalidate(); A.sub = null; location.reload();
  });

  const PAGES = {
    profilo() { return profileForm() + profileResult(); },
    prefs: prefsPage, corpo: corpoPage, benessere: benessPage, integratori: integratoriPage, referti: refertiPage,
    partner() { return Partner.settingsHtml(); },
    notifiche() { return Rem.page(); },
    salute: salutePage, passi: salutePage, backup: backupPage, ai: aiPage, info: infoPage, crediti: creditiPage
  };

  A.profileForm = profileForm; A.profileResult = profileResult;
  window.Altro = A;
})();
