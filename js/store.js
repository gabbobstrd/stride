/* Compagno - archivio dati (IndexedDB con fallback localStorage) */
(function () {
  'use strict';
  const DB_NAME = 'compagno';
  const LS_KEY = 'compagno_state';
  let db = null;
  let state = null;
  let saveTimer = null;
  let useLS = false;
  const listeners = [];

  /* ---------- date ---------- */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function dkey(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseKey(k) { const p = String(k).split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12, 0, 0); }
  function addDays(k, n) { const d = parseKey(k); d.setDate(d.getDate() + n); return dkey(d); }
  function diffDays(a, b) { return Math.round((parseKey(a) - parseKey(b)) / 86400000); }
  function today() { return dkey(new Date()); }
  function uid(p) { return (p || 'i') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* ---------- stato predefinito ---------- */
  function defaultState() {
    return {
      v: 1,
      profile: null,
      prefs: { fav: [], dislike: [], avoid: [], proteins: [], notes: '' },
      customFoods: [],
      meals: [],
      diary: {},
      body: {},
      well: {},
      exercises: [],
      programs: [],
      activeProgram: null,
      nextDayIdx: 0,
      sessions: [],
      activeSession: null,
      supps: [],
      suppLog: {},
      labs: [],
      settings: { geminiKey: '', model: 'gemini-3.5-flash', search: true, sendLabs: false, portions: {} },
      chat: [],
      partner: { name: '', phone: '', msgs: null },
      reminders: [],
      checkins: [],
      shopping: { date: '', days: 3, items: [], checked: {} },
      meta: { lastBackup: 0, firstUse: today(), recents: [], lastQty: {}, demo: false }
    };
  }
  function mergeDefaults(s) {
    const d = defaultState();
    for (const k of Object.keys(d)) {
      if (s[k] === undefined || s[k] === null) { if (k !== 'profile' && k !== 'activeProgram' && k !== 'activeSession') s[k] = d[k]; }
      else if (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k]) && k !== 'diary' && k !== 'body' && k !== 'well' && k !== 'suppLog' && k !== 'profile') {
        for (const kk of Object.keys(d[k])) if (s[k][kk] === undefined) s[k][kk] = d[k][kk];
      }
    }
    if (s.activeProgram === undefined) s.activeProgram = null;
    if (s.activeSession === undefined) s.activeSession = null;
    return s;
  }

  /* ---------- IndexedDB ---------- */
  function openDB() {
    return new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error('no idb'));
      let req;
      try { req = indexedDB.open(DB_NAME, 1); } catch (e) { return rej(e); }
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
        if (!d.objectStoreNames.contains('files')) d.createObjectStore('files');
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error || new Error('idb error'));
      req.onblocked = () => rej(new Error('idb blocked'));
    });
  }
  function tx(store, mode, fn) {
    return new Promise((res, rej) => {
      let t;
      try { t = db.transaction(store, mode); } catch (e) { return rej(e); }
      const st = t.objectStore(store);
      const r = fn(st);
      t.oncomplete = () => res(r && r.result !== undefined ? r.result : undefined);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  }

  async function init() {
    let loaded = null;
    try {
      db = await openDB();
      loaded = await tx('kv', 'readonly', st => st.get('state'));
    } catch (e) {
      useLS = true; db = null;
    }
    if (useLS || !loaded) {
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw && !loaded) loaded = JSON.parse(raw);
      } catch (e) { /* ignora */ }
    }
    state = mergeDefaults(loaded && typeof loaded === 'object' ? loaded : defaultState());
    try {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
    } catch (e) { /* ignora */ }
    window.addEventListener('pagehide', saveNow);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow(); });
    return state;
  }

  async function writeState() {
    const snapshot = state;
    if (!useLS && db) {
      try { await tx('kv', 'readwrite', st => st.put(snapshot, 'state')); return true; } catch (e) { useLS = true; }
    }
    try { localStorage.setItem(LS_KEY, JSON.stringify(snapshot)); return true; } catch (e) { return false; }
  }
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveTimer = null; writeState(); }, 300);
  }
  function saveNow() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    return writeState();
  }
  function change() { save(); listeners.forEach(fn => { try { fn(); } catch (e) { /* ignora */ } }); }
  function onChange(fn) { listeners.push(fn); }

  /* ---------- file (allegati) ---------- */
  function blobToDataURL(blob) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
  }
  async function dataURLToBlob(u) { const r = await fetch(u); return r.blob(); }
  async function putFile(id, blob) {
    if (!useLS && db) { try { await tx('files', 'readwrite', st => st.put(blob, id)); return; } catch (e) { /* fallback */ } }
    const u = await blobToDataURL(blob);
    localStorage.setItem('compagno_file_' + id, u);
  }
  async function getFile(id) {
    if (!useLS && db) {
      try { const b = await tx('files', 'readonly', st => st.get(id)); if (b) return b; } catch (e) { /* fallback */ }
    }
    const u = localStorage.getItem('compagno_file_' + id);
    return u ? dataURLToBlob(u) : null;
  }
  async function delFile(id) {
    if (!useLS && db) { try { await tx('files', 'readwrite', st => st.delete(id)); } catch (e) { /* ignora */ } }
    try { localStorage.removeItem('compagno_file_' + id); } catch (e) { /* ignora */ }
  }
  async function allFileIds() {
    const ids = [];
    if (!useLS && db) {
      try { const k = await tx('files', 'readonly', st => st.getAllKeys()); ids.push(...k); } catch (e) { /* ignora */ }
    }
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf('compagno_file_') === 0) ids.push(k.slice(14));
      }
    } catch (e) { /* ignora */ }
    return Array.from(new Set(ids));
  }
  async function clearFiles() {
    const ids = await allFileIds();
    for (const id of ids) await delFile(id);
  }

  /* ---------- accessi comodi ---------- */
  function ensureDay(date) {
    if (!state.diary[date]) state.diary[date] = { items: [], water: 0, steps: 0 };
    const d = state.diary[date];
    if (!d.items) d.items = [];
    return d;
  }
  function getDay(date) { return state.diary[date] || { items: [], water: 0, steps: 0 }; }
  function ensureBody(date) { if (!state.body[date]) state.body[date] = {}; return state.body[date]; }
  function ensureWell(date) { if (!state.well[date]) state.well[date] = {}; return state.well[date]; }

  async function replaceAll(newState) {
    state = mergeDefaults(newState);
    await saveNow();
    listeners.forEach(fn => { try { fn(); } catch (e) { /* ignora */ } });
  }
  async function wipe() {
    state = defaultState();
    await clearFiles();
    try { localStorage.removeItem(LS_KEY); } catch (e) { /* ignora */ }
    await saveNow();
  }

  window.Store = {
    init, save, saveNow, change, onChange, putFile, getFile, delFile, allFileIds, clearFiles, replaceAll, wipe,
    defaultState, ensureDay, getDay, ensureBody, ensureWell,
    dkey, parseKey, addDays, diffDays, today, uid, blobToDataURL, dataURLToBlob,
    get s() { return state; },
    get usingLocalStorage() { return useLS; }
  };
})();
