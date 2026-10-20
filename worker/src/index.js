/* Stride - Worker Cloudflare: backup cifrato e notifiche push.
   Il backup arriva già cifrato dal telefono: qui non si può leggere.
   Le notifiche: ogni minuto il cron guarda gli orari salvati e manda le push (Web Push, RFC 8291 + VAPID RFC 8292). */

const ORIGIN_OK = [
  /^https:\/\/([a-z0-9-]+\.)?stride-8i8\.pages\.dev$/,
  /^https:\/\/gabbobstrd\.github\.io$/,
  /^http:\/\/localhost:\d+$/
];
const PUSH_HOSTS = [/(^|\.)push\.apple\.com$/, /(^|\.)fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)notify\.windows\.com$/];
const MAX_BACKUP = 20 * 1024 * 1024;
const KEEP_DAYS = 14;
const PUSH_KEY = 'push:all';

/* ---------- utilità ---------- */
const enc = new TextEncoder();
function b64u(buf) {
  const b = new Uint8Array(buf); let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64u(str) {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '==='.slice((s.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function concat(...parts) {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
async function sha256hex(text) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text)));
  return [...h].map(x => x.toString(16).padStart(2, '0')).join('');
}
async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}

/* ---------- Web Push: cifratura aes128gcm (RFC 8291) ---------- */
export async function encryptPush(p256dh, auth, payload) {
  const uaPublic = unb64u(p256dh), authSecret = unb64u(auth);
  const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, eph.privateKey, 256));
  const prkKey = await hmac(authSecret, shared);
  const ikm = await hmac(prkKey, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic, new Uint8Array([1])));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);
  const key = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const plain = concat(payload, new Uint8Array([2]));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plain));
  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

/* ---------- VAPID (RFC 8292) ---------- */
let vapidKey = null;
export async function vapidJWT(aud, env) {
  if (!vapidKey) {
    const jwk = JSON.parse(env.VAPID_PRIVATE_JWK);
    vapidKey = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, d: jwk.d }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  }
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT || 'https://stride-8i8.pages.dev' })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, vapidKey, enc.encode(head + '.' + body));
  return head + '.' + body + '.' + b64u(sig);
}
async function sendPush(sub, msg, env) {
  const body = await encryptPush(sub.keys.p256dh, sub.keys.auth, enc.encode(JSON.stringify(msg)));
  const jwt = await vapidJWT(new URL(sub.endpoint).origin, env);
  return fetch(sub.endpoint, {
    method: 'POST',
    headers: { TTL: '3600', Urgency: 'high', 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', Authorization: 'vapid t=' + jwt + ', k=' + env.VAPID_PUBLIC },
    body
  });
}

/* ---------- orari ---------- */
function localNow(date, tz) {
  let parts;
  try { parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date); }
  catch (e) { return null; }
  const get = t => (parts.find(p => p.type === t) || {}).value;
  const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday'));
  return { day, hm: get('hour') + ':' + get('minute') };
}
export function dueItems(cfg, date) {
  const n = localNow(date, cfg.tz || 'Europe/Rome');
  if (!n) return [];
  return (cfg.items || []).filter(it => (it.d || []).indexOf(n.day) >= 0 && (it.s || []).indexOf(n.hm) >= 0);
}

/* ---------- validazione ---------- */
function validSub(sub) {
  if (!sub || typeof sub.endpoint !== 'string' || !sub.keys || typeof sub.keys.p256dh !== 'string' || typeof sub.keys.auth !== 'string') return false;
  let u; try { u = new URL(sub.endpoint); } catch (e) { return false; }
  return u.protocol === 'https:' && PUSH_HOSTS.some(r => r.test(u.hostname));
}
function cleanItems(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 60).map(it => ({
    t: String(it.t || 'Stride').slice(0, 80),
    b: String(it.b || '').slice(0, 160),
    s: (Array.isArray(it.s) ? it.s : []).filter(x => /^\d\d:\d\d$/.test(x)).slice(0, 24),
    d: (Array.isArray(it.d) ? it.d : []).map(Number).filter(x => x >= 0 && x <= 6)
  }));
}

/* ---------- HTTP ---------- */
function cors(origin) {
  const ok = origin && ORIGIN_OK.some(r => r.test(origin));
  return ok ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' } : { Vary: 'Origin' };
}
function json(obj, status, h) { return new Response(JSON.stringify(obj), { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json' }, h) }); }
const ID_RE = /^[0-9a-f]{64}$/;

async function handle(req, env) {
  const url = new URL(req.url);
  const h = cors(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  const p = url.pathname.split('/').filter(Boolean); // es. ['v1','backup',id]
  if (p[0] !== 'v1') return json({ ok: true, app: 'stride-api' }, 200, h);

  if (p[1] === 'vapid' && req.method === 'GET') return json({ key: env.VAPID_PUBLIC }, 200, h);

  /* backup: /v1/backup/:id  (id = sha256 del codice, il contenuto è cifrato sul telefono) */
  if (p[1] === 'backup' && ID_RE.test(p[2] || '')) {
    const id = p[2];
    if (req.method === 'PUT') {
      const len = +req.headers.get('Content-Length') || 0;
      if (len > MAX_BACKUP) return json({ error: 'troppo grande' }, 413, h);
      const buf = await req.arrayBuffer();
      if (!buf.byteLength || buf.byteLength > MAX_BACKUP) return json({ error: 'dimensione non valida' }, 413, h);
      const at = Date.now(), day = new Date(at).toISOString().slice(0, 10);
      await env.STRIDE.put('bk:' + id, buf, { metadata: { at, size: buf.byteLength } });
      await env.STRIDE.put('bkd:' + id + ':' + day, buf, { metadata: { at, size: buf.byteLength }, expirationTtl: KEEP_DAYS * 86400 });
      return json({ ok: true, at }, 200, h);
    }
    if (req.method === 'GET' && !p[3]) {
      const r = await env.STRIDE.getWithMetadata('bk:' + id, 'arrayBuffer');
      if (!r.value) return json({ error: 'nessun backup' }, 404, h);
      return new Response(r.value, { headers: Object.assign({ 'Content-Type': 'application/octet-stream', 'X-Backup-At': String((r.metadata || {}).at || ''), 'Access-Control-Expose-Headers': 'X-Backup-At' }, h) });
    }
    if (req.method === 'GET' && p[3] === 'days') {
      const l = await env.STRIDE.list({ prefix: 'bkd:' + id + ':' });
      return json({ days: l.keys.map(k => ({ day: k.name.slice(-10), at: (k.metadata || {}).at, size: (k.metadata || {}).size })) }, 200, h);
    }
    if (req.method === 'GET' && /^\d{4}-\d\d-\d\d$/.test(p[3] || '')) {
      const v = await env.STRIDE.get('bkd:' + id + ':' + p[3], 'arrayBuffer');
      if (!v) return json({ error: 'nessun backup quel giorno' }, 404, h);
      return new Response(v, { headers: Object.assign({ 'Content-Type': 'application/octet-stream' }, h) });
    }
  }

  /* notifiche: /v1/push (PUT salva orari, DELETE spegne, POST /v1/push/test prova) */
  if (p[1] === 'push') {
    let body; try { body = await req.json(); } catch (e) { return json({ error: 'json non valido' }, 400, h); }
    const sub = body && body.sub;
    if (!validSub(sub)) return json({ error: 'iscrizione non valida' }, 400, h);
    const key = await sha256hex(sub.endpoint);
    const all = (await env.STRIDE.get(PUSH_KEY, 'json')) || {};
    if (req.method === 'PUT' && !p[2]) {
      all[key] = { sub: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, tz: String(body.tz || 'Europe/Rome').slice(0, 60), items: cleanItems(body.items), at: Date.now() };
      if (Object.keys(all).length > 50) return json({ error: 'troppi telefoni' }, 429, h);
      await env.STRIDE.put(PUSH_KEY, JSON.stringify(all));
      return json({ ok: true, items: all[key].items.length }, 200, h);
    }
    if (req.method === 'DELETE' && !p[2]) {
      if (all[key]) { delete all[key]; await env.STRIDE.put(PUSH_KEY, JSON.stringify(all)); }
      return json({ ok: true }, 200, h);
    }
    if (req.method === 'POST' && p[2] === 'test') {
      if (!all[key]) return json({ error: 'telefono non registrato' }, 404, h);
      const r = await sendPush(all[key].sub, { title: '🔔 Stride', body: 'Le notifiche funzionano!', tag: 'test' }, env);
      return json({ ok: r.ok, status: r.status }, r.ok ? 200 : 502, h);
    }
  }
  return json({ error: 'non trovato' }, 404, h);
}

async function cron(event, env) {
  const all = (await env.STRIDE.get(PUSH_KEY, 'json')) || {};
  const when = new Date(event.scheduledTime || Date.now());
  let gone = false;
  for (const key of Object.keys(all)) {
    const cfg = all[key];
    for (const it of dueItems(cfg, when)) {
      try {
        const r = await sendPush(cfg.sub, { title: it.t, body: it.b, tag: it.t }, env);
        console.log('push', it.t, r.status);
        if (r.status === 404 || r.status === 410) { delete all[key]; gone = true; break; }
      } catch (e) { /* riprova al prossimo orario */ }
    }
  }
  if (gone) await env.STRIDE.put(PUSH_KEY, JSON.stringify(all));
}

export default {
  async fetch(req, env) {
    try { return await handle(req, env); }
    catch (e) { return json({ error: 'errore interno' }, 500, cors(req.headers.get('Origin'))); }
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(cron(event, env)); }
};
