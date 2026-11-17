/* School-only offline shell. Account/API responses and the card game are never cached. */
'use strict';
const RELEASE = 'school-smoothfix1';
const base = new URL('./', self.location.href);
const CACHE_PREFIX = 'school-app-' + encodeURIComponent(base.pathname) + '-';
const CACHE = CACHE_PREFIX + RELEASE;
const url = path => new URL(path, base).href;
const shell = url('school.html');
const required = [
  'school.html', 'school.webmanifest',
  ...['engine.js','art.js','client.js','presentation.js','presentation.css','style.css','install.js','install.css','social.js','social.css'].map(p => `school/${p}?v=${RELEASE}`),
  'assets/fonts/Galmuri11.woff2', 'assets/fonts/PretendardVariable.woff2',
  'school/assets/osia-sprites.png?v=osia1', 'school/assets/lava.png?v=lava1',
  'school/assets/app-192.png', 'school/assets/app-512.png'
].map(url);
const pictures = ['daily','weekly','tower'].map(id => url(`school/assets/dungeon-${id}.png?v=${RELEASE}`));
const staticURLs = new Set([...required.filter(p => p !== shell), ...pictures]);
self.addEventListener('install', event => {
  // Atomic install: a failed download keeps the previous usable shell active.
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(required.map(href => new Request(href, {cache:'reload'})));
    const html = await (await cache.match(shell)).text();
    const engine = await (await cache.match(url(`school/engine.js?v=${RELEASE}`))).text();
    // A CDN rollout must not activate an old HTML with a new offline engine.
    if (!html.includes(`school/client.js?v=${RELEASE}`) || !/CATALOG_VERSION\s*=\s*10\b/.test(engine)) {
      await caches.delete(CACHE); throw Error('School release is not ready');
    }
  })());
  // An update waits for old game windows to close; it never reloads a purchase.
});
self.addEventListener('activate', event => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const request = event.request, target = new URL(request.url);
  if (request.method !== 'GET' || target.origin !== base.origin) return;
  if (request.mode === 'navigate' && target.pathname === new URL(shell).pathname) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (!response.ok) throw Error('Navigation unavailable');
        // Keep the offline HTML and its exact assets in the same release.
        // A newly deployed HTML can still run online while its worker waits.
        const copy = response.clone(), cachedCopy = response.clone();
        event.waitUntil(copy.text().then(async text => {
          if (text.includes(`school/client.js?v=${RELEASE}`)) await (await caches.open(CACHE)).put(shell, cachedCopy);
        }).catch(() => {}));
        return response;
      } catch {
        return (await (await caches.open(CACHE)).match(shell)) || Response.error();
      }
    })());
    return;
  }
  if (!staticURLs.has(target.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE), cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') event.waitUntil(cache.put(request, response.clone()).catch(() => {}));
    return response;
  })());
});
