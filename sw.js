/* Compagno - service worker: tutto offline dopo la prima apertura */
const VERSION = 'stride-v1.3.10';
const FILES = [
  './', 'index.html', 'styles.css', 'fonts/manrope.woff2', 'manifest.webmanifest', 'foods.js', 'js/foods-crea.js', 'js/foods-usda2.js', 'js/foods-extra.js',
  'vendor/chart.umd.min.js', 'vendor/html5-qrcode.min.js',
  'js/portions.js', 'js/salute.js', 'js/ai.js', 'js/checkin.js', 'js/voce-parse.js', 'js/v-voce.js',
  'js/store.js', 'js/data.js', 'js/calc.js', 'js/ui.js', 'js/advice.js', 'js/reminders.js', 'js/partner.js',
  'js/v-oggi.js', 'js/v-cibo.js', 'js/body-map.js', 'js/ex-media.js', 'js/ex-art.js', 'js/v-palestra.js', 'js/v-profilo.js', 'js/v-grafici.js', 'js/v-altro.js', 'js/v-coach.js', 'js/demo.js', 'js/app.js',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-192.png', 'icons/icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // un file mancante (es. foods.js non ancora caricato) non deve bloccare l'installazione
    await Promise.all(FILES.map(f => cache.add(new Request(f, { cache: 'reload' })).catch(() => { })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // niente cache per Gemini, Open Food Facts e qualunque altro dominio
  if (url.origin !== self.location.origin) return;
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('index.html');
  if (isPage) {
    // rete per prima, poi cache
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) { const c = await caches.open(VERSION); c.put('index.html', res.clone()); }
        return res;
      } catch (err) {
        const c = await caches.open(VERSION);
        return (await c.match('index.html')) || (await c.match('./')) || Response.error();
      }
    })());
    return;
  }
  // cache per prima, aggiornamento in sottofondo
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(res => { if (res && res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { net.catch(() => { }); return hit; }
    const res = await net;
    return res || Response.error();
  })());
});
