/* Stride - backup automatico cifrato e notifiche dirette (Worker Cloudflare «stride-api").
   Il codice di backup resta sul telefono: dal codice nascono l'indirizzo del backup e la chiave di cifratura.
   Il server riceve solo dati cifrati e non può leggerli. */
(function () {
  'use strict';
  const esc = UI.esc;
  let API = 'https://stride-api.gabriel-martino-cri.workers.dev';
  try { const o = localStorage.getItem('stride_api'); if (o && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)) API = o; } catch (e) { /* ignora */ }
  const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 simboli, niente I O 0 1
  const DAY_MS = 86400000;
  let busy = false, pushBusy = false, pushTimer = null;

  function S() { return Store.s; }
  function cfg() {
    const st = S().settings;
    if (!st.cloud || typeof st.cloud !== 'object') st.cloud = { code: '', auto: true, last: 0, err: '', push: false, pushSig: '' };
    return st.cloud;
  }

  /* ---------- codice e chiavi ---------- */
  function newCode() {
    const r = crypto.getRandomValues(new Uint8Array(20));
    let s = '';
    for (let i = 0; i < 20; i++) { s += ALPH[r[i] & 31]; if (i % 4 === 3 && i < 19) s += '-'; }
    return s;
  }
  function norm(code) { return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function validCode(code) { const n = norm(code); return n.length === 20 && [...n].every(c => ALPH.indexOf(c) >= 0); }
  async function sha(text) { return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))); }
  function hex(b) { return [...b].map(x => x.toString(16).padStart(2, '0')).join(''); }
  async function keysFor(code) {
    const n = norm(code);
    const id = hex(await sha('stride-id:' + n));
    const key = await crypto.subtle.importKey('raw', await sha('stride-key:' + n), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    return { id, key };
  }

  /* ---------- contenuto del backup (uguale al file) ---------- */
  async function buildPayload() {
    await Store.saveNow();
    const ids = await Store.allFileIds(), files = {};
    for (const id of ids) { const b = await Store.getFile(id); if (b) files[id] = { type: b.type, data: await Store.blobToDataURL(b) }; }
    // la chiave Gemini e il codice di backup restano solo su questo telefono
    const st = Object.assign({}, S(), { settings: Object.assign({}, S().settings) });
    delete st.settings.geminiKey; delete st.settings.cloud;
    return { app: 'stride', v: 1, exported: new Date().toISOString(), state: st, files };
  }
  async function applyPayload(j) {
    if (!j || (j.app !== 'stride' && j.app !== 'compagno') || !j.state) throw new Error('non è un backup di Stride');
    const keepKey = (S().settings && S().settings.geminiKey) || '';
    const keepCloud = S().settings && S().settings.cloud;
    if (!j.state.settings || typeof j.state.settings !== 'object') j.state.settings = {};
    j.state.settings.geminiKey = keepKey;
    if (keepCloud) j.state.settings.cloud = keepCloud; else delete j.state.settings.cloud;
    await Store.clearFiles();
    for (const id of Object.keys(j.files || {})) { const fl = j.files[id]; await Store.putFile(id, await Store.dataURLToBlob(fl.data)); }
    Calc.invalidate();
    await Store.replaceAll(j.state);
  }

  /* ---------- cifratura: [versione, gzip?] + iv(12) + dati ---------- */
  async function gz(bytes, dir) {
    const Ctor = dir ? window.CompressionStream : window.DecompressionStream;
    return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new Ctor('gzip'))).arrayBuffer());
  }
  async function seal(obj, key) {
    let data = new TextEncoder().encode(JSON.stringify(obj));
    const zip = typeof CompressionStream === 'function';
    if (zip) data = await gz(data, true);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const c = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
    const out = new Uint8Array(14 + c.length);
    out[0] = 1; out[1] = zip ? 1 : 0; out.set(iv, 2); out.set(c, 14);
    return out;
  }
  async function open(buf, key) {
    const b = new Uint8Array(buf);
    if (b[0] !== 1) throw new Error('formato sconosciuto');
    let data;
    try { data = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(2, 14) }, key, b.slice(14))); }
    catch (e) { throw new Error('codice sbagliato'); }
    if (b[1] === 1) data = await gz(data, false);
    return JSON.parse(new TextDecoder().decode(data));
  }

  /* ---------- salvataggio e ripristino ---------- */
  async function upload() {
    const c = cfg();
    if (!c.code) throw new Error('backup automatico spento');
    if (!navigator.onLine) throw new Error('sei offline');
    const k = await keysFor(c.code);
    const body = await seal(await buildPayload(), k.key);
    const r = await fetch(API + '/v1/backup/' + k.id, { method: 'PUT', body, headers: { 'Content-Type': 'application/octet-stream' } });
    if (!r.ok) throw new Error('il server ha risposto ' + r.status);
    c.last = Date.now(); c.err = ''; Store.change();
    return c.last;
  }
  async function download(code) {
    const k = await keysFor(code);
    const r = await fetch(API + '/v1/backup/' + k.id);
    if (r.status === 404) throw new Error('nessun backup con questo codice');
    if (!r.ok) throw new Error('il server ha risposto ' + r.status);
    const at = +r.headers.get('X-Backup-At') || 0;
    return { j: await open(await r.arrayBuffer(), k.key), at };
  }
  /* una volta al giorno, all'apertura dell'app */
  async function tick() {
    const c = cfg();
    if (busy || !c.code || c.auto === false || !navigator.onLine) return;
    if (Date.now() - (c.last || 0) < 20 * 3600 * 1000) return;
    busy = true;
    try { await upload(); } catch (e) { c.err = e.message; Store.change(); }
    finally { busy = false; }
  }

  /* ---------- notifiche dirette (Web Push) ---------- */
  function pushSupported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
  function standalone() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
  function pushOn() { return !!cfg().push; }
  function b64uToBytes(s) {
    const t = s.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(t + '==='.slice((t.length + 3) % 4));
    return Uint8Array.from(bin, ch => ch.charCodeAt(0));
  }
  async function getSub(create) {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub && create) {
      const r = await fetch(API + '/v1/vapid');
      if (!r.ok) throw new Error('il server delle notifiche non risponde');
      const key = (await r.json()).key;
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(key) });
    }
    return sub;
  }
  function pushItems() {
    return Rem.items().filter(i => i.on).map(it => ({ t: (it.emoji ? it.emoji + ' ' : '') + it.title, b: it.note || '', s: Rem.slots(it), d: (it.days || []).slice() }));
  }
  async function syncPush(force) {
    const c = cfg();
    if (!c.push || pushBusy || !navigator.onLine) return;
    pushBusy = true;
    try {
      const sub = await getSub(false);
      if (!sub) { c.push = false; c.pushSig = ''; Store.change(); return; }
      const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone) || 'Europe/Rome';
      const items = pushItems();
      const sig = hex(await sha(JSON.stringify([sub.endpoint, tz, items])));
      if (!force && sig === c.pushSig) return;
      const r = await fetch(API + '/v1/push', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sub: sub.toJSON(), tz, items }) });
      if (!r.ok) throw new Error('il server ha risposto ' + r.status);
      c.pushSig = sig; Store.change();
    } finally { pushBusy = false; }
  }
  async function enablePush() {
    if (!pushSupported()) return UI.toast(standalone() ? 'Questo telefono non supporta le notifiche (serve iOS 16.4 o più)' : 'Prima aggiungi Stride alla schermata Home e aprila da lì');
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return UI.toast('Permesso negato: attivalo in Impostazioni → Notifiche → Stride');
    UI.toast('Attivo le notifiche…');
    try {
      await getSub(true);
      cfg().push = true; cfg().pushSig = ''; Store.change();
      await syncPush(true);
      UI.refresh(); UI.toast('Notifiche attive');
    } catch (e) { cfg().push = false; Store.change(); UI.toast('Non riuscito: ' + e.message); }
  }
  async function disablePush() {
    try {
      const sub = await getSub(false);
      if (sub) {
        await fetch(API + '/v1/push', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sub: sub.toJSON() }) }).catch(() => { });
        await sub.unsubscribe().catch(() => { });
      }
    } catch (e) { /* ignora */ }
    cfg().push = false; cfg().pushSig = ''; Store.change(); UI.refresh(); UI.toast('Notifiche spente');
  }
  async function testPush() {
    try {
      await syncPush(true);
      const sub = await getSub(false);
      if (!sub) throw new Error('notifiche non attive');
      const r = await fetch(API + '/v1/push/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sub: sub.toJSON() }) });
      UI.toast(r.ok ? 'Inviata: arriva tra pochi secondi' : 'Invio non riuscito (' + r.status + ')');
    } catch (e) { UI.toast('Invio non riuscito: ' + e.message); }
  }
  function pushBlock() {
    if (pushOn()) {
      return '<div class="hl small mb8"><b>🔔 Notifiche dirette attive.</b> Arrivano all\'orario scelto anche con l\'app chiusa. Se prima li avevi aggiunti al Calendario, toglili da lì per non riceverli due volte.</div>' +
        '<div class="row gap mb12"><button class="btn grow" data-act="cloud.pushTest">Manda una prova</button><button class="btn grow" data-act="cloud.pushOff">Spegni</button></div>';
    }
    return '<div class="hl small mb8"><b>Novità: notifiche dirette.</b> Arrivano da Stride senza passare dal Calendario. Accendi qui sotto quelle che vuoi.</div>' +
      '<button class="btn primary block mb12" data-act="cloud.pushOn">Attiva notifiche dirette</button>';
  }

  /* ---------- pagina Backup ---------- */
  function when(ts) {
    if (!ts) return 'mai';
    const d = new Date(ts);
    return UI.dateLong(Store.dkey(d)) + ' alle ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function backupCard() {
    const c = cfg();
    if (!c.code) {
      return '<div class="card"><h3 class="card-h-t mb8">Backup automatico</h3>' +
        '<p class="small mut mb8">Ogni giorno Stride salva una copia <b>cifrata</b> dei tuoi dati. Con il tuo codice la recuperi su un telefono nuovo o se cancelli l\'app. Nessun altro può leggerla, nemmeno chi gestisce il server.</p>' +
        '<button class="btn primary block mb8" data-act="cloud.on">Attiva backup automatico</button>' +
        '<button class="btn block" data-act="cloud.restore">Ho già un codice: ripristina</button></div>';
    }
    return '<div class="card"><h3 class="card-h-t mb8">Backup automatico ✅</h3>' +
      '<div class="li-s mb8">Ultimo salvataggio: <b style="color:var(--tx)">' + esc(when(c.last)) + '</b>' + (c.err ? '<br><span class="bad">Ultimo tentativo non riuscito: ' + esc(c.err) + '</span>' : '') + '</div>' +
      '<button class="btn primary block mb8" data-act="cloud.now">Salva adesso</button>' +
      '<div class="row gap mb8"><button class="btn grow" data-act="cloud.show">Mostra il codice</button><button class="btn grow" data-act="cloud.restore">Ripristina</button></div>' +
      '<button class="btn block" data-act="cloud.off">Spegni il backup automatico</button></div>';
  }
  function codeSheet(first) {
    const code = cfg().code;
    UI.sheet({
      title: first ? 'Il tuo codice di backup' : 'Codice di backup', cls: 'small',
      html: '<div class="hl center mb8" style="font:700 20px/1.4 ui-monospace,Menlo,monospace;letter-spacing:.04em;user-select:all">' + esc(code) + '</div>' +
        '<p class="small mb8"><b>Salvalo adesso</b> nelle Note o nelle Password dell\'iPhone. Senza questo codice il backup non si può aprire: nessuno può recuperarlo, nemmeno io.</p>' +
        '<p class="xs mut mb8">Non mandarlo a nessuno: chi ha il codice può leggere i tuoi dati.</p>' +
        '<button class="btn primary block" data-act="cloud.copy">Copia il codice</button>'
    });
  }
  function restoreSheet() {
    const sh = UI.sheet({
      title: 'Ripristina dal backup', cls: 'small',
      html: '<p class="small mb8">Scrivi il codice di backup (20 lettere e numeri, i trattini non servono).</p>' +
        UI.field('Codice', '<input class="inp" id="cl-code" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="ABCD-EFGH-…" style="font-family:ui-monospace,Menlo,monospace">') +
        '<p class="small mut mb8" id="cl-st"></p><button class="btn primary block" id="cl-go">Cerca il backup</button>'
    });
    const st = sh.body.querySelector('#cl-st');
    sh.body.querySelector('#cl-go').onclick = async () => {
      const code = sh.body.querySelector('#cl-code').value;
      if (!validCode(code)) { st.textContent = 'Il codice deve avere 20 caratteri (lettere e numeri da 2 a 9).'; return; }
      if (!navigator.onLine) { st.textContent = 'Sei offline: serve internet.'; return; }
      st.textContent = 'Scarico e apro il backup…';
      try {
        const res = await download(code);
        const ok = await UI.confirm({ title: 'Ripristinare il backup?', msg: 'Backup del ' + when(res.at || Date.parse(res.j.exported)) + '. Sostituisce TUTTI i dati di questo telefono.', ok: 'Ripristina', danger: true });
        if (!ok) { st.textContent = ''; return; }
        await applyPayload(res.j);
        const c = cfg(); c.code = norm(code).replace(/(.{4})(?!$)/g, '$1-'); c.auto = true; c.last = res.at || 0; c.err = ''; Store.change();
        sh.close();
        document.body.classList.remove('onb');
        UI.toast('Dati ripristinati');
        UI.go('oggi');
      } catch (e) { st.textContent = 'Non riuscito: ' + e.message; }
    };
  }

  UI.on('cloud.on', async () => {
    const c = cfg();
    c.code = newCode(); c.auto = true; c.err = ''; Store.change();
    codeSheet(true);
    try { await upload(); UI.toast('Primo backup salvato'); } catch (e) { c.err = e.message; Store.change(); UI.toast('Backup non riuscito: ' + e.message); }
    UI.refresh();
  });
  UI.on('cloud.now', async () => {
    UI.toast('Salvo…');
    try { await upload(); UI.toast('Backup salvato'); } catch (e) { cfg().err = e.message; Store.change(); UI.toast('Non riuscito: ' + e.message); }
    UI.refresh();
  });
  UI.on('cloud.show', () => codeSheet(false));
  UI.on('cloud.copy', async () => { UI.toast(await UI.copyText(cfg().code) ? 'Codice copiato' : 'Copia non riuscita: scrivilo a mano'); });
  UI.on('cloud.restore', restoreSheet);
  UI.on('cloud.off', async () => {
    if (!await UI.confirm({ title: 'Spegnere il backup automatico?', msg: 'Il backup già salvato resta sul server e si apre ancora con il codice. Questo telefono smette di aggiornarlo.', ok: 'Spegni', danger: true })) return;
    const c = cfg(); c.code = ''; c.last = 0; c.err = ''; Store.change(); UI.refresh();
  });
  UI.on('cloud.pushOn', enablePush);
  UI.on('cloud.pushOff', disablePush);
  UI.on('cloud.pushTest', testPush);

  /* avvio: backup del giorno e orari delle notifiche aggiornati */
  function start() {
    setTimeout(() => { tick(); syncPush(false).catch(() => { }); }, 4000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { tick(); syncPush(false).catch(() => { }); } });
    Store.onChange(() => {
      if (!cfg().push) return;
      clearTimeout(pushTimer);
      pushTimer = setTimeout(() => { syncPush(false).catch(() => { }); }, 2500);
    });
  }

  window.Cloud = { start, buildPayload, applyPayload, backupCard, restoreSheet, pushOn, pushBlock, syncPush, upload, download, newCode, validCode, keysFor, seal, open, get api() { return API; } };
})();
