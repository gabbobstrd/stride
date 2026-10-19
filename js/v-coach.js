/* Compagno - Coach AI (Gemini) */
(function () {
  'use strict';
  const esc = UI.esc, S = () => Store.s;
  let busy = false;

  const SYSTEM = [
    'Sei Stride Coach: un nutrizionista sportivo e preparatore atletico che ragiona sulle prove scientifiche. Rispondi sempre in italiano, con tono diretto e amichevole.',
    'Regole di risposta:',
    '- Prima la risposta o l\'azione, poi il perché. Niente preamboli.',
    '- Usa passi numerati, al massimo 5 punti.',
    '- Distingui sempre prove forti, moderate e deboli.',
    '- Con la ricerca attiva cita studi recenti (meta-analisi, RCT, linee guida, posizioni ISSN/EFSA/LARN) con il link.',
    '- Niente diagnosi: per sintomi e referti rimanda al medico.',
    '- Rispetta le preferenze alimentari e gli alimenti da evitare dell\'utente.',
    '- Indica sempre le quantità in grammi.',
    '- Usa i dati del contesto JSON: se un dato manca (null o assente) dillo, non inventarlo. I micronutrienti con dati parziali non vanno interpretati come carenze certe.',
    '- Formato: Markdown semplice (grassetto, elenchi, link).'
  ].join('\n');

  const QUICK = [
    ['Analizza la mia settimana', 'Analizza la mia settimana: cosa va bene, cosa migliorare, in 5 punti.'],
    ['Cosa mangio stasera?', 'Cosa mangio stasera per chiudere la giornata con kcal e proteine? Dammi grammi precisi.'],
    ['Come progredisco su panca?', 'Come posso progredire sulla panca piana guardando i miei ultimi allenamenti?'],
    ['Studi recenti su…', null],
    ['Micronutrienti bassi: cosa cambio?', 'Quali micronutrienti sono bassi nella mia media a 7 giorni e cosa cambio nei pasti?']
  ];

  /* ---------- contesto ---------- */
  function r1(x) { return x == null || !isFinite(x) ? null : Math.round(x * 10) / 10; }
  function buildContext() {
    const s = S(), p = s.profile, t = Store.today();
    const tg = Calc.targets(t);
    const avg = Calc.avgTotals(t, 7);
    const ctx = {};
    ctx.profilo = { nome: p.name || null, sesso: p.sex, eta: tg.age, altezza_cm: +p.height, peso_kg: r1(tg.w), obiettivo: p.goal, ritmo_kg_settimana: +p.rateKg || null, giorni_allenamento: +p.trainDays, schema: p.split || null };
    ctx.obiettivi_giornalieri = { kcal: Math.round(tg.kcal), proteine_g: Math.round(tg.prot), carboidrati_g: Math.round(tg.carb), grassi_g: Math.round(tg.fat), fibre_g: Math.round(tg.fib), fabbisogno_stimato_kcal: Math.round(tg.tdee) };
    const ser = Calc.trendSeries();
    if (ser.length) { const l = ser[ser.length - 1]; const old = ser.filter(x => x.d <= Store.addDays(t, -28)).pop(); ctx.peso = { ultimo_kg: l.w, tendenza_kg: r1(l.t), variazione_tendenza_4_settimane_kg: old ? r1(l.t - old.t) : null }; }
    const micro = {}, nd = [];
    Calc.microReport(avg.avg, avg.cov, tg).forEach(r => { if (r.pct === null) nd.push(D.NMAP[r.k].n); else micro[D.NMAP[r.k].n] = { percento: Math.round(r.pct * 100), dati_parziali: r.cov < 0.95 }; });
    ctx.medie_7_giorni = {
      giorni_con_diario: avg.n, kcal: r1(avg.avg.kcal), proteine_g: r1(avg.avg.prot), carboidrati_g: r1(avg.avg.carb), grassi_g: r1(avg.avg.fat), fibre_g: r1(avg.avg.fib), sodio_mg: r1(avg.avg.na), epa_dha_g: r1(avg.avg.epadha),
      micronutrienti: micro, micronutrienti_non_disponibili: nd
    };
    /* cibi piu' mangiati (14 giorni) */
    const cnt = {};
    Calc.lastDays(t, 14).forEach(d => Store.getDay(d).items.forEach(it => { const f = Calc.food(it.f); if (!f) return; const c = cnt[f.id] || (cnt[f.id] = { nome: f.n, volte: 0, g: 0 }); c.volte++; c.g += it.g; }));
    ctx.cibi_piu_mangiati = Object.keys(cnt).map(k => cnt[k]).sort((a, b) => b.volte - a.volte).slice(0, 12).map(c => ({ nome: c.nome, volte: c.volte, grammi_medi: Math.round(c.g / c.volte) }));
    const nm = ids => ids.map(i => { const f = Calc.food(i); return f ? f.n : null; }).filter(Boolean);
    ctx.preferenze = { preferiti: nm(s.prefs.fav), non_mi_piace: nm(s.prefs.dislike), da_evitare: nm(s.prefs.avoid), proteine_volute: nm(s.prefs.proteins), note: s.prefs.notes || null };
    ctx.ultime_5_sessioni = Calc.sortedSessions().slice(-5).reverse().map(x => ({ data: x.date, nome: x.name, volume_kg: Math.round(Calc.sessionVolume(x)), esercizi: x.ex.map(e => ({ nome: Calc.exName(e.e), nota: e.note || undefined, serie: Calc.doneSets(e).map(q => q.w + 'x' + q.r + (+q.rpe > 0 ? '@' + q.rpe : '')).join(', ') })) }));
    ctx.record_e1rm_kg = Calc.records().slice(0, 25).map(r => ({ esercizio: r.n, e1rm: r1(r.e1.v), miglior_carico: r.load.w + 'x' + r.load.r }));
    const ms = Calc.muscleSets(Store.addDays(t, -6), t), vol = {};
    Object.keys(ms).forEach(k => { vol[D.MUSCLES[k]] = r1(ms[k]); });
    ctx.serie_per_muscolo_7_giorni = vol;
    ctx.integratori = s.supps.filter(x => x.active !== false).map(x => ({ nome: x.n, dose: (x.dose || '') + ' ' + D.unitLbl(x.dose, x.unit), quando: x.when || null }));
    const days = Calc.lastDays(t, 7), W = s.well;
    const arr = k => days.map(d => W[d] && +W[d][k] > 0 ? +W[d][k] : null).filter(x => x !== null);
    ctx.benessere_7_giorni = { sonno_medio_ore: arr('sleep').length ? r1(Calc.mean(arr('sleep'))) : null, energia_media: arr('energy').length ? r1(Calc.mean(arr('energy'))) : null, giorni_con_capogiri: days.filter(d => W[d] && W[d].dizzy).length, ultima_pressione: (() => { for (let i = days.length - 1; i >= 0; i--) { const w = W[days[i]]; if (w && w.sys) return w.sys + '/' + (w.dia || '?'); } return null; })() };
    if (s.settings.sendLabs && s.labs.length) {
      ctx.referti = s.labs.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3).map(l => ({ data: l.date, valori: l.vals.map(v => ({ parametro: Calc.labName(v.k), valore: v.val, unita: v.unit, range: [v.lo === '' ? null : v.lo, v.hi === '' ? null : v.hi], stato: Calc.labStatus(v) })) }));
    }
    return ctx;
  }

  /* ---------- interfaccia ---------- */
  function el(id) { return document.getElementById(id); }
  function msgHtml(m) {
    if (m.r === 'user') return '<div class="msg user">' + esc(m.t).replace(/\n/g, '<br>') + '</div>';
    let h = '<div class="msg model">' + UI.md(m.t);
    if (m.src && m.src.length) h += '<div class="src"><b>Fonti</b>' + m.src.map(x => '<a href="' + esc(x.uri) + '" target="_blank" rel="noopener">' + esc(x.title || x.uri) + '</a>').join('') + '</div>';
    return h + '</div>';
  }
  function drawList(typing) {
    const l = el('co-list'); if (!l) return;
    const chat = S().chat;
    let h = chat.length ? chat.map(msgHtml).join('') : '<div class="empty" style="padding:30px 10px"><p style="font-size:17px;color:var(--tx);font-weight:600;margin-bottom:6px">Ciao' + (S().profile && S().profile.name ? ' ' + esc(S().profile.name) : '') + '!</p>Chiedimi di cibo, allenamento e integratori. Rispondo in base ai tuoi dati e alle prove scientifiche.</div>';
    if (typing) h += '<div class="msg model"><span class="typing"><i></i><i></i><i></i></span></div>';
    if (!S().settings.geminiKey) h = '<div class="card alert"><p class="small mb8">Per usare il Coach serve la chiave Gemini (gratis).</p><button class="btn primary sm" data-act="coach.settings">Aggiungi la chiave</button></div>' + h;
    l.innerHTML = h;
    const sc = el('co-msgs'); if (sc) sc.scrollTop = sc.scrollHeight;
  }
  function build() {
    const c = el('coach');
    c.innerHTML = '<div class="coach-h"><div class="coach-h-in"><h2>' + UI.icon('spark', 22) + ' Coach AI</h2><div class="row"><button class="btn sm ghost" data-act="coach.clear">Svuota</button><button class="icon-btn" data-act="coach.close" aria-label="Chiudi">' + UI.icon('close', 22) + '</button></div></div></div>' +
      '<div class="coach-msgs" id="co-msgs"><div class="coach-msgs-in" id="co-list"></div></div>' +
      '<div class="coach-f"><div class="coach-f-in"><div class="chips scroll">' + QUICK.map((q, i) => '<button class="chip sm" data-act="coach.quick" data-i="' + i + '">' + esc(q[0]) + '</button>').join('') + '</div>' +
      '<div class="coach-in"><textarea class="inp" id="co-in" rows="1" placeholder="Scrivi una domanda…"></textarea><button class="send" data-act="coach.send" aria-label="Invia">' + UI.icon('up', 22) + '</button></div></div></div>';
    const ta = el('co-in');
    ta.addEventListener('input', () => { ta.style.height = '44px'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; });
  }
  function open() {
    const c = el('coach');
    build(); drawList(false);
    c.classList.add('open'); c.setAttribute('aria-hidden', 'false');
    document.body.classList.add('noscroll');
  }
  function close() {
    const c = el('coach'); c.classList.remove('open'); c.setAttribute('aria-hidden', 'true');
    if (!UI.topSheet()) document.body.classList.remove('noscroll');
  }
  UI.on('coach.open', open);
  UI.on('coach.close', close);
  UI.on('coach.settings', () => { close(); Altro.sub = 'ai'; UI.go('altro'); });
  UI.on('coach.clear', async () => {
    if (!S().chat.length) return;
    if (await UI.confirm({ title: 'Svuotare la chat?', ok: 'Svuota', danger: true })) { S().chat = []; Store.change(); drawList(false); }
  });
  UI.on('coach.quick', el0 => {
    const q = QUICK[+el0.dataset.i];
    if (q[1] === null) { const ta = el('co-in'); ta.value = 'Studi recenti su '; ta.focus(); return; }
    send(q[1]);
  });
  UI.on('coach.send', () => { const ta = el('co-in'); const t = ta.value.trim(); if (t) { ta.value = ''; ta.style.height = '44px'; send(t); } });

  async function send(text) {
    if (busy) return;
    const st = S().settings;
    if (!st.geminiKey) { drawList(false); return UI.toast('Aggiungi prima la chiave Gemini'); }
    if (!navigator.onLine) return UI.toast('Sei offline: il Coach ha bisogno di internet');
    const chat = S().chat;
    const um = { r: 'user', t: text };
    chat.push(um);
    busy = true; drawList(true);
    try {
      const ctx = buildContext();
      // storico per l'API: senza errori e senza domande rimaste senza risposta, sempre user/model alternati
      const contents = [];
      chat.filter(m => !m.err && !m.unans).slice(-11).forEach(m => {
        const last = contents[contents.length - 1];
        if (last && last.role === m.r) contents[contents.length - 1] = { role: m.r, parts: [{ text: m.t }] };
        else contents.push({ role: m.r, parts: [{ text: m.t }] });
      });
      while (contents.length > 1 && contents[0].role !== 'user') contents.shift();
      const body = {
        systemInstruction: { parts: [{ text: SYSTEM + '\n\nCONTESTO UTENTE (JSON, aggiornato adesso):\n' + JSON.stringify(ctx) }] },
        contents, generationConfig: { temperature: 0.6 }
      };
      if (st.search) body.tools = [{ google_search: {} }];
      const call = () => fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(st.model || 'gemini-3.5-flash') + ':generateContent', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': st.geminiKey }, body: JSON.stringify(body)
      });
      let r = await call();
      /* la ricerca Google ha un limite gratuito suo: se è finito, riprova una volta senza */
      if ((r.status === 429 || r.status === 400) && body.tools) { delete body.tools; r = await call(); }
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = (j.error && j.error.message) || '';
        let t = 'Errore ' + r.status + (msg ? ': ' + msg : '');
        if (r.status === 400 && /API key/i.test(msg)) t = 'La chiave Gemini non è valida. Controllala in Altro → Impostazioni AI.';
        else if (r.status === 403) t = 'Chiave non autorizzata per questo modello. Controllala in Altro → Impostazioni AI.';
        else if (r.status === 404) t = 'Modello «' + st.model + '» non trovato. Usa «Prova chiave» in Impostazioni AI per scegliere un modello.';
        else if (r.status === 429) t = AI.quotaMsg(j, st.model);
        throw new Error(t);
      }
      const cand = j.candidates && j.candidates[0];
      if (!cand || !cand.content) throw new Error(j.promptFeedback && j.promptFeedback.blockReason ? 'Richiesta bloccata dal filtro di sicurezza.' : 'Risposta vuota. Riprova.');
      const out = (cand.content.parts || []).map(x => x.text || '').join('').trim();
      const gm = cand.groundingMetadata, src = [];
      if (gm && gm.groundingChunks) gm.groundingChunks.forEach(c => { if (c.web && c.web.uri && !src.some(s => s.uri === c.web.uri)) src.push({ uri: c.web.uri, title: c.web.title }); });
      chat.push({ r: 'model', t: out || 'Nessuna risposta.', src: src.slice(0, 8) });
    } catch (e) {
      chat.push({ r: 'model', t: '⚠️ ' + (e.message || 'Errore di rete. Controlla la connessione.') });
      /* l'errore non va rimandato come contesto */
      chat[chat.length - 1].err = true;
      um.unans = true;   // la domanda resta visibile ma non viene rimandata a Gemini
    }
    if (chat.length > 60) chat.splice(0, chat.length - 60);
    busy = false; Store.change(); drawList(false);
  }

  /* apre il Coach con un testo già scritto (l'utente lo rivede e lo invia) */
  function prefill(text) {
    open();
    const ta = el('co-in');
    if (ta) { ta.value = text; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; ta.focus(); }
  }
  window.Coach = { open, close, buildContext, prefill };
})();
