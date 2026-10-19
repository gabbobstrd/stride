/* Compagno - «Dimmi cosa hai fatto»: testo/voce e foto del piatto -> foglio di conferma -> salvataggio.
   Con la chiave Gemini: AI.json con schema; senza (o in caso di errore): analizzatore a regole (voce-parse.js).
   Niente viene salvato prima di «Salva tutto». Le foto non vengono mai conservate. */
(function () {
  'use strict';
  const esc = UI.esc, fmt = UI.fmt, S = () => Store.s;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const PHOTO_NOTE = 'La foto viene inviata a Google (piano gratuito: Google può usarla per migliorare i servizi). Le stime da foto possono sbagliare del 20–30%: controlla i grammi.';

  /* ---------- contesto ---------- */
  function buildCtx() {
    return {
      foods: Calc.allFoods(),
      supps: S().supps.filter(s => s.active !== false).map(s => ({ id: s.id, n: s.n })),
      exercises: Calc.allExercises().map(e => ({ id: e.id, n: e.n })),
      fav: S().prefs.fav, now: new Date()
    };
  }
  function planExercises() {
    const p = S().programs.find(q => q.id === S().activeProgram), ids = [];
    if (p) p.days.forEach(d => d.ex.forEach(e => { if (ids.indexOf(e.e) < 0) ids.push(e.e); }));
    return ids.map(id => Calc.exById(id)).filter(Boolean);
  }

  /* ---------- schemi e prompt ---------- */
  const T = (type, extra) => Object.assign({ type }, extra || {});
  const NUM = T('NUMBER', { nullable: true });
  const FOOD_ITEM = (photo) => {
    const props = { text: T('STRING'), food_id: T('STRING'), grams: T('NUMBER'), qty: T('NUMBER', { nullable: true }), portion_label: T('STRING', { nullable: true }), meal: T('STRING') };
    if (photo) { props.hidden = T('BOOLEAN'); props.confidence = T('NUMBER'); }
    return T('OBJECT', { properties: props, required: ['text', 'food_id', 'grams', 'meal'] });
  };
  const TEXT_SCHEMA = T('OBJECT', {
    properties: {
      foods: T('ARRAY', { items: FOOD_ITEM(false) }),
      water_ml: NUM,
      supplements: T('ARRAY', { items: T('OBJECT', { properties: { name: T('STRING'), supp_id: T('STRING') }, required: ['name', 'supp_id'] }) }),
      sets: T('ARRAY', { items: T('OBJECT', { properties: { exercise: T('STRING'), exercise_id: T('STRING'), kg: T('NUMBER'), reps: T('NUMBER'), sets: T('NUMBER'), rir: NUM }, required: ['exercise', 'exercise_id', 'kg', 'reps', 'sets'] }) }),
      weight_kg: NUM, body_fat_pct: NUM, sleep_h: NUM, energy_1_5: NUM, notes: T('STRING', { nullable: true })
    },
    required: ['foods', 'supplements', 'sets']
  });
  const PHOTO_SCHEMA = T('OBJECT', { properties: { foods: T('ARRAY', { items: FOOD_ITEM(true) }), notes: T('STRING', { nullable: true }) }, required: ['foods'] });

  const DAYS = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
  function nowLine() {
    const n = new Date();
    return DAYS[n.getDay()] + ' ' + Store.today() + ', ore ' + String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
  }
  function lists(ctx, withEx) {
    let s = 'ALIMENTI (id|nome):\n' + ctx.foods.map(f => f.id + '|' + f.n).join('\n');
    s += '\n\nPORZIONI (nome|grammi):\n' + Portions.promptList();
    if (withEx) {
      s += '\n\nINTEGRATORI DELL\'UTENTE (id|nome):\n' + (ctx.supps.map(x => x.id + '|' + x.n).join('\n') || '(nessuno)');
      s += '\n\nESERCIZI DELLA SCHEDA ATTIVA (id|nome):\n' + (planExercises().map(e => e.id + '|' + e.n).join('\n') || '(nessuno)');
    }
    return s;
  }
  function textPrompt(text, ctx) {
    return 'Sei l\'assistente di un diario di cibo, allenamento e salute. Ora locale: ' + nowLine() + '.\n' +
      'Estrai dal testo (italiano) SOLO ciò che l\'utente dice di aver fatto. Regole:\n' +
      '- foods: un elemento per alimento. food_id deve essere uno degli ID dell\'elenco ALIMENTI; se nessuno è adatto metti "" (non inventare MAI un id). grams = grammi totali (0 se non detto). Per i pezzi (uova, sottilette, fette...) usa l\'elenco PORZIONI: qty = numero di pezzi, portion_label = nome della porzione, grams = qty × grammi della porzione. Pasta e riso senza altre indicazioni sono crudi (secchi).\n' +
      '- meal: colazione, pranzo, cena o spuntino, dalle parole dell\'utente; altrimenti dall\'ora (prima delle 10 colazione, fino alle 15 pranzo, fino alle 18 spuntino, dopo cena).\n' +
      '- water_ml: totale di acqua bevuta in ml (null se non detto). supplements: integratori presi, supp_id dall\'elenco INTEGRATORI ("" se non c\'è). sets: serie di allenamento, exercise_id dall\'elenco ESERCIZI ("" se non c\'è), kg, reps, sets = numero di serie, rir null se non detto.\n' +
      '- weight_kg, body_fat_pct, sleep_h (ore), energy_1_5: solo se detti, altrimenti null. notes: altro di utile, brevissimo.\n' +
      'Non aggiungere nulla che l\'utente non abbia detto.\n\n' + lists(ctx, true) + '\n\nTESTO DELL\'UTENTE:\n"""\n' + text + '\n"""';
  }
  function photoPrompt(text, ctx, meal) {
    return 'Guarda la foto di un pasto. Ora locale: ' + nowLine() + '. Elenca ogni alimento visibile (foods) con una stima dei grammi del cibo così come appare nel piatto (di solito già cotto), senza piatto né contenitore. ' +
      'Aggiungi anche gli ingredienti probabilmente nascosti (olio di cottura, condimenti, burro, salse) con hidden=true e una stima prudente. confidence da 0 a 1 per ogni voce. ' +
      'food_id deve essere un ID dell\'elenco ALIMENTI (se esiste scegli la variante cotta quando il cibo è cotto); se non c\'è metti "" e descrivi in text: non inventare MAI un id. ' +
      'meal: ' + (meal ? '"' + meal + '"' : 'colazione, pranzo, cena o spuntino secondo l\'ora') + '. qty/portion_label solo se ha senso (es. 2 uova).' +
      (text ? '\nDescrizione dell\'utente: """' + text + '"""' : '') + '\n\n' + lists(ctx, false);
  }

  /* ---------- risposta AI -> stessa forma del parser a regole ---------- */
  const MEALMAP = m => { m = Calc.norm(m || ''); return /colaz/.test(m) ? 'colazione' : /pranz/.test(m) ? 'pranzo' : /cena/.test(m) ? 'cena' : /spunt|mer|snack/.test(m) ? 'spuntini' : null; };
  const pos = x => (typeof x === 'number' && isFinite(x) && x > 0 ? x : null);
  function normalizeAI(j, ctx, meal) {
    const idx = {}; ctx.foods.forEach(f => { idx[f.id] = f; });
    const exIdx = {}; ctx.exercises.forEach(e => { exIdx[e.id] = e; });
    const sIdx = {}; ctx.supps.forEach(s => { sIdx[s.id] = s; });
    const R = { foods: [], water_ml: pos(j.water_ml), supplements: [], sets: [], weight_kg: pos(j.weight_kg), body_fat_pct: pos(j.body_fat_pct), sleep_h: pos(j.sleep_h), energy_1_5: pos(j.energy_1_5), notes: typeof j.notes === 'string' ? j.notes.trim() : '', unparsed: [] };
    if (R.energy_1_5 && (R.energy_1_5 < 1 || R.energy_1_5 > 5)) R.energy_1_5 = null;
    (j.foods || []).forEach(x => {
      if (!x || !x.text) return;
      let f = idx[x.food_id] || null, approx = false;
      if (!f) { f = Voce.matchFood(x.text, ctx); approx = !!f; }   // id inventato o assente: ricerca per nome, da controllare
      let g = pos(+x.grams), qty = pos(+x.qty), pl = '';
      if (f && qty && x.portion_label) {
        const p = Portions.forFood(f).find(q => Calc.norm(q.label) === Calc.norm(x.portion_label));
        if (p) { pl = p.label; if (!g) g = qty * p.g; } else qty = null;
      } else qty = null;
      R.foods.push({ text: String(x.text), food_id: f ? f.id : '', name: f ? f.n : '', grams: g, qty: pl ? qty : null, portion_label: pl, meal: MEALMAP(x.meal) || meal || Voce.timeMeal(ctx.now), matched: !!f, assumed: !g, approx, hidden: !!x.hidden, confidence: typeof x.confidence === 'number' ? x.confidence : null });
    });
    (j.supplements || []).forEach(x => { const s = sIdx[x.supp_id]; if (s) { if (!R.supplements.some(y => y.supp_id === s.id)) R.supplements.push({ name: s.n, supp_id: s.id }); } else if (x && x.name) R.unparsed.push('Integratore non in elenco: ' + x.name); });
    (j.sets || []).forEach(x => {
      let ex = exIdx[x.exercise_id] || Voce.matchExercise(x.exercise || '', ctx);
      const reps = pos(+x.reps); if (!reps) return;
      R.sets.push({ exercise: ex ? ex.n : String(x.exercise || ''), exercise_id: ex ? ex.id : '', kg: +x.kg >= 0 ? +x.kg : 0, reps, sets: pos(+x.sets) || 1, rir: typeof x.rir === 'number' ? x.rir : null });
    });
    return R;
  }

  /* ---------- foto: ridimensiona e converte (la foto non viene salvata) ---------- */
  function downscale(file, max) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * sc)), h = Math.max(1, Math.round(img.naturalHeight * sc));
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        const data = c.toDataURL('image/jpeg', 0.8);
        res({ data: data.split(',')[1], thumb: data, w, h });
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Non riesco a leggere la foto.')); };
      img.src = url;
    });
  }

  /* ---------- foglio di partenza ---------- */
  let inputSheet = null;
  function openInput(o) {
    o = o || {};
    const hasKey = AI.hasKey();
    const sh = UI.sheet({
      title: 'Dimmi cosa hai fatto', cls: 'tall',
      onClose() { if (inputSheet === sh) inputSheet = null; stopListen(); },
      html: '<textarea class="inp" id="vc-t" rows="6" placeholder="Es. a pranzo 80 g di pasta, 1 sottiletta e 2 uova; bevuto mezzo litro d\'acqua; preso la vitamina D; panca 60 kg × 8 × 3; dormito 7 ore"></textarea>' +
        '<p class="hint mb8">Tocca il microfono 🎤 della tastiera per dettare.</p>' +
        '<div class="row gap mb8"><button class="btn primary grow" id="vc-go">Analizza</button>' + (SR ? '<button class="btn" id="vc-mic">' + UI.icon('mic', 18) + ' Parla</button>' : '') + '</div>' +
        '<p class="xs mut mb12">' + (hasKey ? 'Uso Gemini per capire la frase; se non risponde uso un analizzatore semplice. Prima di salvare controlli tutto.' : 'Senza chiave Gemini uso un analizzatore semplice (cibi, acqua, integratori, serie, peso, sonno). Con la chiave capisce meglio le frasi libere.') + '</p>' +
        '<div class="sec-t" style="margin-top:6px">Foto del piatto</div>' +
        '<label class="btn block" id="vc-ph" style="' + (o.photo ? 'border-color:var(--acc);color:var(--acc)' : '') + '">' + UI.icon('camera', 18) + ' Scatta o scegli una foto<input type="file" accept="image/*" capture="environment" id="vc-file" style="display:none"></label>' +
        '<p class="xs mut mt8">' + PHOTO_NOTE + '</p>' + (hasKey ? '' : '<p class="xs warn mt4">Le foto richiedono la chiave Gemini (Altro → Impostazioni AI).</p>') +
        '<p class="xs mut mt4">Se vuoi, scrivi sopra una descrizione: viene mandata insieme alla foto. La foto non viene salvata.</p>'
    });
    inputSheet = sh;
    const ta = sh.body.querySelector('#vc-t');
    sh.body.querySelector('#vc-go').onclick = () => { const t = ta.value.trim(); if (!t) return UI.toast('Scrivi o detta qualcosa'); run(t, null, o.meal); };
    sh.body.querySelector('#vc-file').addEventListener('change', e => {
      const f = e.target.files && e.target.files[0]; e.target.value = '';
      if (f) photo(f, ta.value.trim(), o.meal);
    });
    sh.body.querySelector('#vc-ph').addEventListener('click', e => { if (!AI.hasKey()) { e.preventDefault(); UI.toast('Le foto richiedono la chiave Gemini (Altro → Impostazioni AI)'); } });
    if (SR) setupMic(sh, ta);
    return sh;
  }
  let rec = null;
  function stopListen() { if (rec) { try { rec.stop(); } catch (e) { /* ignora */ } rec = null; } }
  function setupMic(sh, ta) {
    const btn = sh.body.querySelector('#vc-mic');
    const label = on => { btn.innerHTML = UI.icon('mic', 18) + (on ? ' Ascolto… (tocca per fermare)' : ' Parla'); btn.classList.toggle('primary', on); };
    btn.onclick = () => {
      if (rec) { stopListen(); label(false); return; }
      try {
        rec = new SR(); rec.lang = 'it-IT'; rec.interimResults = false; rec.continuous = false;
        rec.onresult = ev => { let t = ''; for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) t += ev.results[i][0].transcript; if (t) ta.value = (ta.value ? ta.value.replace(/\s+$/, '') + ' ' : '') + t.trim(); };
        rec.onend = () => { rec = null; label(false); };
        rec.onerror = ev => { rec = null; label(false); UI.toast(ev && ev.error === 'not-allowed' ? 'Microfono non consentito: usa quello della tastiera 🎤' : 'Dettatura non riuscita: usa il microfono 🎤 della tastiera'); };
        rec.start(); label(true);
      } catch (e) { rec = null; label(false); UI.toast('Dettatura non disponibile: usa il microfono 🎤 della tastiera'); }
    };
  }

  /* ---------- analisi ---------- */
  function loading(msg) {
    return UI.sheet({ title: 'Un attimo…', cls: 'small', html: '<div class="center" style="padding:14px 0"><span class="typing"><i></i><i></i><i></i></span><p class="small mut mt12">' + esc(msg) + '</p></div>' });
  }
  function hasAny(r) { return r.foods.length || r.water_ml || r.supplements.length || r.sets.length || r.weight_kg || r.body_fat_pct || r.sleep_h || r.energy_1_5 || r.notes; }

  async function run(text, thumb, meal) {
    const ctx = buildCtx();
    let res = null, via = 'rules', aiErr = '';
    if (AI.hasKey() && navigator.onLine) {
      const ld = loading('Gemini sta leggendo…');
      try { res = normalizeAI(await AI.json({ prompt: textPrompt(text, ctx), schema: TEXT_SCHEMA }), ctx, meal); via = 'ai'; }
      catch (e) { aiErr = e.message || 'errore'; res = null; }
      ld.close();
    } else if (AI.hasKey()) aiErr = 'Sei offline.';
    if (!res) res = Voce.parse(text, Object.assign(ctx, { now: new Date() }));
    if (meal && via === 'rules') res.foods.forEach(f => { f.meal = meal; });
    if (!hasAny(res)) { UI.toast(aiErr ? 'Non ho capito (' + aiErr + ')' : 'Non ho capito niente: prova con frasi più semplici'); return; }
    confirmSheet(res, { via, aiErr, thumb: null, text });
  }
  async function photo(file, text, meal) {
    if (!AI.hasKey()) return UI.toast('Le foto richiedono la chiave Gemini (Altro → Impostazioni AI)');
    if (!navigator.onLine) return UI.toast('Sei offline: la foto richiede internet');
    const ctx = buildCtx(), ld = loading('Guardo il piatto…');
    try {
      const img = await downscale(file, 1024);
      const j = await AI.json({ prompt: photoPrompt(text, ctx, meal), schema: PHOTO_SCHEMA, image: img.data, temperature: 0.3 });
      ld.close();
      const res = normalizeAI(j, ctx, meal);
      if (!res.foods.length) return UI.toast('Non vedo alimenti nella foto');
      confirmSheet(res, { via: 'photo', thumb: img.thumb, text });
    } catch (e) { ld.close(); UI.toast(e.message || 'Foto non analizzata'); }
  }

  /* ---------- foglio di conferma ---------- */
  const fa = x => (x == null || x === '' ? '' : String(Math.round(x * 100) / 100).replace('.', ','));
  function confirmSheet(res, o) {
    const cur = UI.state.cur;
    const R = {
      date: cur === 'cibo' ? Cibo.date : cur === 'oggi' ? Oggi.date : Store.today(),
      foods: res.foods.map(x => ({ on: true, fid: x.food_id || '', g: x.grams == null ? 100 : x.grams, pq: x.qty || 0, pl: x.portion_label || '', meal: x.meal || 'pranzo', text: x.text, hidden: !!x.hidden, conf: x.confidence, approx: !!x.approx, assumed: !!x.assumed })),
      water: res.water_ml ? { on: true, v: res.water_ml } : null,
      supps: res.supplements.map(s => ({ on: true, id: s.supp_id, name: s.name })),
      sets: res.sets.map(s => ({ on: true, exid: s.exercise_id, name: s.exercise, kg: s.kg, reps: s.reps, sets: s.sets, rir: s.rir })),
      weight: res.weight_kg ? { on: true, v: res.weight_kg } : null,
      bf: res.body_fat_pct ? { on: true, v: res.body_fat_pct } : null,
      sleep: res.sleep_h ? { on: true, v: res.sleep_h } : null,
      energy: res.energy_1_5 ? { on: true, v: res.energy_1_5 } : null,
      note: res.notes ? { on: true, t: res.notes } : null
    };
    const exOpts = [['', '— scegli l\'esercizio —']].concat(Calc.allExercises().map(e => [e.id, e.n]));
    const sh = UI.sheet({
      title: o.via === 'photo' ? 'Controlla il piatto' : 'Controlla e salva', cls: 'tall',
      onClose() { if (o.thumb) o.thumb = null; }
    });

    const food = r => (r.fid ? Calc.food(r.fid) : null);
    function totals() {
      const t = { kcal: 0, prot: 0, carb: 0, fat: 0 };
      let pending = 0, n = 0;
      R.foods.forEach(r => {
        if (!r.on) return;
        const f = food(r); if (!f) { pending++; return; }
        n++;
        ['kcal', 'prot', 'carb', 'fat'].forEach(k => { const x = Calc.scaled(f, r.g, k); if (x) t[k] += x; });
      });
      return { t, pending, n };
    }
    function totHtml() {
      const x = totals(), t = x.t;
      return '<b>' + fmt(t.kcal) + '</b> kcal · <span class="mP">P ' + fmt(t.prot) + '</span> · <span class="mC">C ' + fmt(t.carb) + '</span> · <span class="mG">G ' + fmt(t.fat) + '</span>' + (x.pending ? '<div class="xs warn">' + x.pending + ' da scegliere (non contate)</div>' : '');
    }
    function rowKcal(r) { const f = food(r); const k = f ? Calc.scaled(f, r.g, 'kcal') : null; return f ? (k === null ? 'kcal n.d.' : fmt(k) + ' kcal') : ''; }
    const chk = (g, i, on) => '<input type="checkbox" class="vchk" data-vg="' + g + '" data-i="' + i + '" data-vk="on"' + (on ? ' checked' : '') + ' aria-label="Includi">';
    const numIn = (g, i, k, v, w, ph) => '<input class="inp" inputmode="decimal" data-vg="' + g + '" data-i="' + i + '" data-vk="' + k + '" value="' + esc(fa(v)) + '" style="width:' + (w || 76) + 'px;flex:none;text-align:center"' + (ph ? ' placeholder="' + ph + '"' : '') + '>';

    function foodRow(r, i) {
      const f = food(r), ps = f ? Portions.forFood(f) : [];
      const badges = (r.hidden ? '<span class="badge warn">nascosto (stima)</span> ' : '') + (r.conf != null && r.conf < 0.5 ? '<span class="badge bad">incerto</span> ' : '') + (r.approx && f ? '<span class="badge">controlla l\'alimento</span> ' : '') + (r.assumed && f ? '<span class="badge">quantità da controllare</span> ' : '');
      return '<div class="vrow' + (r.on ? '' : ' off') + (f ? '' : ' unm') + '" id="vf-' + i + '">' + chk('f', i, r.on) + '<div style="min-width:0">' +
        '<button class="vname" data-vpick="' + i + '">' + (f ? esc(f.n) : 'da scegliere') + '</button>' +
        '<div class="vsub">' + badges + esc(r.text) + ' · <span id="vk-' + i + '">' + rowKcal(r) + '</span></div>' +
        '<div class="row gap6 mt8">' + numIn('f', i, 'g', r.g, 80) + '<span class="mut">g</span>' + UI.select(D.MEALS, r.meal, 'data-vg="f" data-i="' + i + '" data-vk="meal"') + '</div>' +
        (ps.length ? '<div class="row gap6 mt8">' + numIn('f', i, 'pq', r.pl ? r.pq : '', 64, 'N') + '<span class="mut">×</span><select class="inp" data-vg="f" data-i="' + i + '" data-vk="pl"><option value="">porzione…</option>' + ps.map((p, k) => '<option value="' + k + '"' + (p.label === r.pl ? ' selected' : '') + '>' + esc((p.personal ? '★ ' : '') + p.label + ' (' + fa(p.g) + ' g)') + '</option>').join('') + '</select></div>' : '') +
        '</div></div>';
    }
    function draw() {
      const foodsH = R.foods.length ? '<div class="sec-t" style="margin-top:4px">Cibo</div>' + R.foods.map(foodRow).join('') : '';
      let h = '';
      if (o.thumb) h += '<img class="vthumb" alt="Foto del piatto" src="' + o.thumb + '">';
      if (o.via === 'photo') h += '<p class="xs mut mb8">' + PHOTO_NOTE + ' Cambia i grammi: il totale si aggiorna subito.</p>';
      if (o.via === 'rules') h += '<div class="disc mb8">Analisi semplice (senza Gemini)' + (o.aiErr ? ': ' + esc(o.aiErr) : '') + '. Controlla ogni riga.</div>';
      h += UI.field('Giorno', '<input class="inp" type="date" id="vc-date" value="' + R.date + '">');
      h += foodsH;
      if (R.foods.length) h += '<div class="vtot" id="vc-tot">' + totHtml() + '</div>';
      const other = [];
      if (R.water) other.push('<div class="vrow' + (R.water.on ? '' : ' off') + '">' + chk('water', 0, R.water.on) + '<div class="row gap6"><div class="li-main">Acqua</div>' + numIn('water', 0, 'v', R.water.v, 84) + '<span class="mut">ml</span></div></div>');
      R.supps.forEach((s, i) => other.push('<div class="vrow' + (s.on ? '' : ' off') + '">' + chk('su', i, s.on) + '<div class="li-main" style="align-self:center">' + esc(s.name) + ' <span class="mut small">· preso</span>' + (((S().suppLog[R.date]) || []).indexOf(s.id) >= 0 ? ' <span class="badge">già spuntato</span>' : '') + '</div></div>'));
      R.sets.forEach((s, i) => other.push('<div class="vrow' + (s.on ? '' : ' off') + '">' + chk('s', i, s.on) + '<div style="min-width:0">' + (s.exid ? '<div class="vname" style="border:0;padding-left:0">' + esc(Calc.exName(s.exid)) + '</div>' : UI.select(exOpts, s.exid, 'data-vg="s" data-i="' + i + '" data-vk="exid"')) +
        '<div class="row gap6 mt8">' + numIn('s', i, 'kg', s.kg, 70) + '<span class="mut">kg ×</span>' + numIn('s', i, 'reps', s.reps, 56) + '<span class="mut">rip ×</span>' + numIn('s', i, 'sets', s.sets, 56) + '<span class="mut">serie</span></div></div></div>'));
      [['weight', 'Peso', 'kg'], ['bf', 'Grasso corporeo', '%'], ['sleep', 'Sonno', 'ore'], ['energy', 'Energia (1–5)', '']].forEach(a => {
        const m = R[a[0]]; if (m) other.push('<div class="vrow' + (m.on ? '' : ' off') + '">' + chk(a[0], 0, m.on) + '<div class="row gap6"><div class="li-main">' + a[1] + '</div>' + numIn(a[0], 0, 'v', m.v, 76) + '<span class="mut">' + a[2] + '</span></div></div>');
      });
      if (R.note) other.push('<div class="vrow' + (R.note.on ? '' : ' off') + '">' + chk('note', 0, R.note.on) + '<div class="small" style="align-self:center">Nota: ' + esc(R.note.t) + '</div></div>');
      if (other.length) h += '<div class="sec-t">Altro</div>' + other.join('');
      (res.unparsed || []).forEach(u => { h += '<p class="xs warn mt8">Non so dove mettere: ' + esc(u) + '</p>'; });
      if (!R.foods.length && !other.length) h += UI.empty('Niente da salvare.');
      h += '<div class="row gap mt12"><button class="btn ghost grow" data-vx="cancel">Annulla</button><button class="btn primary grow" data-vx="save">Salva tutto</button></div>';
      sh.set(h);
    }
    draw();

    function refreshRow(i) {
      const r = R.foods[i], row = sh.body.querySelector('#vf-' + i); if (!row) return;
      row.classList.toggle('off', !r.on);
      const k = sh.body.querySelector('#vk-' + i); if (k) k.textContent = rowKcal(r);
      const t = sh.body.querySelector('#vc-tot'); if (t) t.innerHTML = totHtml();
    }
    function modelOf(el) {
      const g = el.dataset.vg, i = +el.dataset.i;
      return g === 'f' ? R.foods[i] : g === 's' ? R.sets[i] : g === 'su' ? R.supps[i] : R[g];
    }
    const NUMK = { g: 1, kg: 1, reps: 1, sets: 1, v: 1, pq: 1 };
    function onEdit(e) {
      const el = e.target; if (!el.dataset || !el.dataset.vk) return;
      const m = modelOf(el), k = el.dataset.vk, i = +el.dataset.i;
      if (!m) return;
      if (el.type === 'checkbox') { m.on = el.checked; if (el.dataset.vg === 'f') refreshRow(i); else el.closest('.vrow').classList.toggle('off', !m.on); return; }
      if (el.dataset.vg === 'f' && (k === 'pq' || k === 'pl')) {
        const f = food(m), ps = f ? Portions.forFood(f) : [];
        const sel = sh.body.querySelector('select[data-vg="f"][data-i="' + i + '"][data-vk="pl"]'), q = sh.body.querySelector('input[data-vg="f"][data-i="' + i + '"][data-vk="pq"]');
        if (!sel || sel.value === '') { m.pl = ''; m.pq = 0; return; }
        const p = ps[+sel.value]; let n = UI.parseNum(q.value); if (!(n > 0)) { n = 1; q.value = '1'; }
        m.pl = p.label; m.pq = n; m.g = Math.round(n * p.g * 100) / 100;
        sh.body.querySelector('input[data-vg="f"][data-i="' + i + '"][data-vk="g"]').value = fa(m.g);
        refreshRow(i); return;
      }
      if (NUMK[k]) {
        const v = UI.parseNum(el.value); m[k] = isFinite(v) && v >= 0 ? v : 0;
        if (el.dataset.vg === 'f' && k === 'g') {
          if (m.pl) { m.pl = ''; m.pq = 0; const sel = sh.body.querySelector('select[data-vg="f"][data-i="' + i + '"][data-vk="pl"]'); if (sel) sel.value = ''; const q = sh.body.querySelector('input[data-vg="f"][data-i="' + i + '"][data-vk="pq"]'); if (q) q.value = ''; }
          refreshRow(i);
        }
      } else if (k === 'meal') m.meal = el.value;
      else if (k === 'exid') { m.exid = el.value; const ex = Calc.exById(el.value); m.name = ex ? ex.n : ''; }
    }
    sh.body.addEventListener('input', e => { if (e.target.type !== 'checkbox' && e.target.tagName !== 'SELECT') onEdit(e); });
    sh.body.addEventListener('change', e => {
      if (e.target.id === 'vc-date') { if (e.target.value) { R.date = e.target.value; draw(); } return; }
      onEdit(e);
    });
    sh.body.addEventListener('click', e => {
      const pk = e.target.closest('[data-vpick]');
      if (pk) {
        const i = +pk.dataset.vpick, r = R.foods[i];
        Cibo.openSearch({ title: 'Scegli alimento', meal: r.meal, date: R.date, onPick: f => { r.fid = f.id; r.pl = ''; r.pq = 0; r.approx = false; draw(); } });
        return;
      }
      const x = e.target.closest('[data-vx]'); if (!x) return;
      if (x.dataset.vx === 'cancel') { sh.close(); return; }
      save();
    });

    function save() {
      const bad = R.foods.filter(r => r.on && !food(r));
      if (bad.length) {
        UI.toast(bad.length + (bad.length === 1 ? ' alimento è «da scegliere»' : ' alimenti sono «da scegliere»') + ': sceglilo o togli la spunta');
        const row = sh.body.querySelector('.vrow.unm'); if (row && row.scrollIntoView) row.scrollIntoView({ block: 'center' });
        return;
      }
      const zero = R.foods.filter(r => r.on && !(r.g > 0));
      if (zero.length) return UI.toast('Metti i grammi per tutti gli alimenti spuntati');
      const badSet = R.sets.filter(s => s.on && (!s.exid || !(s.reps > 0)));
      if (badSet.length) return UI.toast('Scegli l\'esercizio e le ripetizioni delle serie spuntate');
      const d = R.date, parts = [];
      const items = R.foods.filter(r => r.on).map(r => ({ f: r.fid, g: Math.round(r.g * 10) / 10, m: r.meal, pq: r.pq, pl: r.pl }));
      if (items.length) { Cibo.addItems(d, items); parts.push(items.length + ' alimenti'); }
      if (R.water && R.water.on && R.water.v > 0) { const day = Store.ensureDay(d); day.water = (day.water || 0) + Math.round(R.water.v); parts.push(fmt(R.water.v) + ' ml d\'acqua'); }
      const picked = R.supps.filter(s => s.on);
      if (picked.length) { const log = S().suppLog; const arr = log[d] || (log[d] = []); picked.forEach(s => { if (arr.indexOf(s.id) < 0) arr.push(s.id); }); parts.push(picked.length + ' integratori'); }
      const sets = R.sets.filter(s => s.on);
      const act = S().activeSession;
      if (sets.length && act && d === Store.today()) {
        /* allenamento in corso: le serie vanno nella sessione attiva */
        sets.forEach(s => {
          let ex = act.ex.find(q => q.e === s.exid);
          if (!ex) { ex = { e: s.exid, plan: { sets: 0, rmin: s.reps, rmax: s.reps, rest: 90 }, sets: [] }; act.ex.push(ex); }
          for (let n = 0; n < Math.max(1, Math.round(s.sets)); n++) {
            let st = ex.sets.find(q => !q.done && !(+q.r > 0));
            if (!st) { st = { w: '', r: '', rpe: '', t: '', done: false }; ex.sets.push(st); }
            st.w = s.kg; st.r = Math.round(s.reps); st.rpe = s.rir != null ? Math.max(1, 10 - s.rir) : ''; st.done = true;
          }
          ex.plan.sets = Math.max(ex.plan.sets || 0, ex.sets.length);
        });
        parts.push(sets.length + ' esercizi (nella sessione in corso)');
      } else if (sets.length) {
        const dt = Store.parseKey(d), t0 = d === Store.today() ? Date.now() : dt.getTime();
        const sess = { id: Store.uid('s'), date: d, start: t0, end: t0, prog: null, day: null, name: 'Dettato a voce', ex: [], note: '' };
        sets.forEach(s => {
          let ex = sess.ex.find(q => q.e === s.exid);
          if (!ex) { ex = { e: s.exid, plan: { sets: 0, rmin: s.reps, rmax: s.reps, rest: 90 }, sets: [] }; sess.ex.push(ex); }
          for (let n = 0; n < Math.max(1, Math.round(s.sets)); n++) ex.sets.push({ w: s.kg, r: Math.round(s.reps), rpe: s.rir != null ? Math.max(1, 10 - s.rir) : '', done: true });
          ex.plan.sets = ex.sets.length;
        });
        S().sessions.push(sess); parts.push(sets.length + ' esercizi');
      }
      if (R.weight && R.weight.on && R.weight.v >= 20 && R.weight.v <= 400) { Store.ensureBody(d).w = Math.round(R.weight.v * 10) / 10; parts.push('peso'); }
      if (R.bf && R.bf.on && R.bf.v > 0) { Store.ensureBody(d).bf = Math.round(R.bf.v * 10) / 10; parts.push('grasso'); }
      if (R.sleep && R.sleep.on && R.sleep.v > 0 && R.sleep.v <= 16) { Store.ensureWell(d).sleep = Math.round(R.sleep.v * 10) / 10; parts.push('sonno'); }
      if (R.energy && R.energy.on && R.energy.v >= 1 && R.energy.v <= 5) { Store.ensureWell(d).energy = Math.round(R.energy.v); parts.push('energia'); }
      if (R.note && R.note.on && R.note.t) { const w = Store.ensureWell(d); w.note = (w.note ? w.note + '\n' : '') + R.note.t; }
      Store.change(); UI.refresh();
      sh.close(); if (inputSheet) inputSheet.close();
      UI.toast(parts.length ? 'Salvato: ' + parts.join(', ') : 'Niente da salvare');
    }
    return sh;
  }

  UI.on('voce.open', () => openInput());
  UI.on('voce.photo', el => openInput({ photo: true, meal: el.dataset.m }));

  window.Voce = Object.assign(window.Voce || {}, { open: openInput, buildCtx, normalizeAI, textPrompt, photoPrompt });
})();
