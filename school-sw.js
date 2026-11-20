/* School-only offline shell. Account/API responses and the card game are never cached. */
'use strict';
const RELEASE = 'school-codes50';
const base = new URL('./', self.location.href);
const CACHE_PREFIX = 'school-app-' + encodeURIComponent(base.pathname) + '-';
const CACHE = CACHE_PREFIX + RELEASE;
const url = path => new URL(path, base).href;
const shell = url('school.html');
const required = [
  ...['combat','spirits','illustration'].map(p=>`school/assets/yaho/${p}.webp?v=yaho1`),
  'school/recruit/assets/yaho-motion.webp?v=yaho1',
  ...['rooftop-poster','rooftop-background','rooftop-characters'].map(p=>`school/assets/title/${p}.webp?v=title-art1`),
  ...['students-a','students-b','students-c','osia','ryusion','spica','lava'].map(p=>`school/assets/roster-remake/${p}.webp?v=roster1`),
  ...['school-a','school-b','bosses','company-emblem'].map(p=>`school/assets/enemy-remake/${p}.webp?v=overhaul1`),
  ...['data.js','cinema.js','scene.js','scene.css'].map(p=>`school/recruit/${p}?v=${RELEASE}`),
  'school/assets/profile/rank-ntr.webp?v=rank-ntr1',
  'school.html', 'school.webmanifest', 'school/assets/lobby/courtyard-winter.webp?v=winter-polish1',
  ...['entry-screen.css','music.js','music.css','lobby-news.js','lobby-news.css','enemy-manifest.js','enemy-art.js','skill-cards.js','campus.js','community.js','overhaul.css','roster-art.js','yaho-art.js','theme-readability.css','entry.js','piyu-guide.js','afk.js','piyu.css','ascension-art.js','battle-pass.js','tower-auto.js','growth.css','horas-skin-art.js','skins.js','skins.css','hyeokjin-art.js','hyeokjin.css','bond-stories.js','osia-breath-art.js','battle-polish.js','winter-polish.css','engine.js','weekend-event.js','weekend-event.css','osia-weapon-art.js','kazua-art.js','kazua.css','ryusion.js','combat-feedback.js','expansion-art.js','art.js','client.js','presentation.js','presentation.css','style.css','install.js','install.css','social.js','social.css','lobby.js','lobby.css','world-map.js','world-map.css','battle.css','horas.css','quests.css','qol.js','qol.css','patch-notes.js','farming-worker.js','equipment.js','equipment.css','guild.js','guild.css','raid.js','raid.css','raid-engine.js','raid-vfx.js','yeti-engine.js','rescue.js','yeti.js','yeti.css','winter2.css','refinement.css','dungeon-portal.js','dungeon-portal.css','insights.js','insights.css','formation.js','formation.css','coop.js','coop.css','notice.js','notice.css'].map(p => `school/${p}?v=${RELEASE}`),
  ...['combat.webp','portrait.webp','pickup.webp'].map(p => `school/assets/kazua/${p}?v=kazua1`),
  'school/assets/horas-after-school/combat.webp?v=horas-skin1',
  ...['illustration','profile','cutin-illustration','bond-classroom','bond-rooftop','bond-skill'].map(p=>`school/assets/horas-after-school/${p}.webp?v=horas-illust1`),
  ...['abyss','rose','crystal','council','rift'].map(p=>`school/assets/ascension/${p}.webp?v=ascension1`),
  'school/assets/kazua/basic-motion.webp?v=kazua-motion1',
  ...['normal.png','awakened.png','skills-a.png','skills-b.png','pickup.webp'].map(p=>`school/assets/hyeokjin/${p}?v=hyeokjin1`),
  'school/assets/osia/breath-dragon.webp?v=osia-breath1', 'school/assets/osia/breath-water.webp?v=osia-breath1',
  'school/assets/osia/divine-dragon.webp?v=osia-ur1',
  'school/assets/osia/divine-dragon-motion.webp?v=osia-motion1',
  'school/assets/battlefields/chapters-13-15.webp?v=expansion1',
  'school/assets/lobby/shop-shards.webp', 'school/assets/bonds/osia-memory.webp',
  ...['osia','ian','lumi','lava','ryusion','kazua','spica','horas','hyeokjin'].flatMap(id => ['illustration','profile'].map(kind => `school/assets/bonds/${id}-${kind}.webp?v=bond-art1`)),
  'school/assets/piyu/motions.png?v=piyu1','school/assets/piyu/illustration.png?v=piyu1',
  'assets/fonts/Galmuri11.woff2', 'assets/fonts/PretendardVariable.woff2',
  'school/assets/lava.png?v=lava1', 'school/assets/osia-front.webp?v=osia-look1',
  ...['courtyard', 'icon-recruit', 'icon-supplies', 'icon-codex', 'icon-arena', 'icon-dungeon', 'icon-adventure', 'icon-quests', 'icon-ranking', 'icon-winter', 'icon-help'].map(p => `school/assets/lobby/${p}.webp?v=lobby1`),
  ...Array.from({length:12}, (_, i) => `school/assets/adventure/region-${String(i + 1).padStart(2, '0')}.webp?v=adventure1`),
  ...['classroom','garden','snow'].map(p => `school/assets/battlefields/${p}.webp?v=battlefield1`),
  ...['combat.webp','combat.json','portrait.webp','pickup.webp','cutin.webp'].map(p => `school/assets/horas/${p}?v=horas1`),
  ...['daily','weekly','tower'].map(id => `school/assets/dungeon-${id}.png?v=${RELEASE}`),
  ...['chalk_star','rift_baton','dawn_staff','apprentice_cape','barrier_uniform','guardian_robe','adventure_badge','wind_bell','dawn_brooch','osia_scepter','lava_fan','horas_orbit','earth_shield'].map(id => `school/assets/equipment/${id}.svg?v=gear1`),
  ...['classroom','avatars','crests'].map(id => `school/assets/guild/${id}.png?v=guild1`),
  ...['gymnasium','balloon-poses'].map(id => `school/assets/raid/${id}.png?v=raid1`),
  ...['plant','bookshelf','trophy','rug-teal','rug-wine','rug-blue'].map(id => `school/assets/guild/decor/${id}.svg?v=guild2`),
  'school/assets/ryusion/portrait.png?v=ryusion1',
  ...['ryusion','osia','lava'].map(id => `school/assets/recruit/${id}.webp?v=pickup-pixel1`),
  'school/assets/spica/portrait.webp?v=spica1',
  'school/assets/recruit/osia-lava.webp?v=osia-look1',
  'school/assets/profile/rank-first.webp?v=rank-profile1',
  'school/assets/profile/rank-first-2.webp?v=rank-profile2',
  ...['background.webp','poses.png'].map(p => `school/assets/yeti/${p}?v=yeti1`),
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
    if (!html.includes(`school/client.js?v=${RELEASE}`) || !/CATALOG_VERSION\s*=\s*50\b/.test(engine)) {
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
