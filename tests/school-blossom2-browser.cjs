// Actual Chromium app controls, real engine casts, and disposable signed SQLite saves.
// Browser viewport emulation is not a physical Android device.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const G = require('../school/engine.js');
const { fixture } = require('./account-fixture.cjs');
const ROOT = path.resolve(__dirname, '..'), SAVE = 'school-mercenaries-v8';
const OUT = '/tmp/school-blossom2', NOW = Date.parse('2026-11-18T14:59:58Z');
const SIZES = [{ width:755, height:330 }, { width:568, height:280 }, { width:2560, height:1440 }];
const instrument = `\n;(()=>{const draw=SchoolArt.draw;window.blossomFrame=null;SchoolArt.draw=function(c,s,time,events,reduced){const result=draw.apply(this,arguments),cast=s.battle.horasCast;window.blossomFrame={time,elapsed:s.battle.elapsed,simTime:s.simTime,cast:cast?{id:cast.id,missed:cast.missed,began:cast.began}:null,events:events.filter(e=>e.from==='horas').map(e=>({...e})),marks:s.battle.enemies.filter(e=>e.hp>0&&e.horasMark).length,reduced,frames:(window.blossomFrame?.frames||0)+1};return result;};})();`;

function frozen() {
  const s = G.create(NOW, 819); s.gold = 1234; s.gems = 567;
  for (const e of s.battle.enemies) { e.hp = e.max = 1000000; e.atk = 1; }
  for (const h of s.battle.heroes) { h.hp = h.max = 1000000; h.atk = 1; }
  return s;
}
function pending(missed = false) {
  for (let seed = 1; seed < 100; seed++) {
    const s = G.create(NOW, seed); s.team = ['horas','taeo','sua','harin','geonu','ian'];
    for (const id of s.team) s.units[id] = { level:10, xp:0, stars:0, shards:0 };
    G.action(s, { kind:'stage', stage:1, mode:'farm' }, s.at);
    for (const h of s.battle.heroes) { h.hp = h.max = 1000000; h.atk = h.id === 'horas' ? 100 : 1; h.critChance = 0; }
    for (const e of s.battle.enemies) { e.hp = e.max = 1000000; e.atk = 1; }
    const began = s.at;
    for (let step = 1; step <= 80; step++) {
      G.advance(s, began + step * 500);
      if (s.battle.horasCast) {
        if (s.battle.horasCast.missed !== missed) break;
        s.at = NOW; assert(G.validate(s)); return s;
      }
    }
  }
  throw Error('No deterministic real cast fixture');
}

(async () => {
  fs.mkdirSync(OUT, { recursive:true });
  const t = await fixture(), errors = [], badAssets = [], apiLog = [], controls = new Map();
  let origin, lastPage, serverTime = NOW, apiChain = Promise.resolve();
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, origin || 'http://local');
      if (url.pathname.startsWith('/api/')) {
        const chunks = []; for await (const c of req) chunks.push(c);
        const body = Buffer.concat(chunks), control = controls.get(req.headers['x-account-session']);
        const response = await (apiChain = apiChain.then(async () => {
          const original = Date.now; Date.now = () => serverTime;
          try { return await t.worker.fetch(new Request(url, { method:req.method, headers:req.headers,
            ...(['GET','OPTIONS'].includes(req.method) ? {} : { body }) }), t.env); }
          finally { Date.now = original; }
        }));
        const bytes = Buffer.from(await response.arrayBuffer());
        const record = { path:url.pathname, request:body.length ? JSON.parse(body) : {}, status:response.status, response:JSON.parse(bytes) };
        apiLog.push(record);
        if (control?.dropNextAction && url.pathname === '/api/school/action') {
          control.dropNextAction = false; control.committed = record;
          res.writeHead(503, { 'Content-Type':'application/json' }); res.end(JSON.stringify({ error:'Test response lost after commit' })); return;
        }
        res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(bytes); return;
      }
      const file = path.resolve(ROOT, '.' + url.pathname);
      if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
      let body = fs.readFileSync(file);
      if (file.endsWith('/school/client.js')) body = Buffer.from(body.toString().replace('https://motracv-card-room.densedormouse4.chatgpt.site', origin));
      if (file.endsWith('/school/art.js')) body = Buffer.from(body.toString() + instrument);
      const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.webp':'image/webp', '.png':'image/png', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.json':'application/json' };
      res.writeHead(200, { 'Content-Type':mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store' }); res.end(body);
    } catch (e) { res.writeHead(500); res.end(JSON.stringify({ error:e.message })); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  origin = `http://127.0.0.1:${server.address().port}`; t.env.ALLOWED_ORIGIN = origin;
  const browser = await chromium.launch({ executablePath:'/usr/bin/chromium', headless:true, args:['--no-sandbox'] });
  const saved = p => p.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE);
  const ready = p => p.waitForFunction(() => document.querySelector('#boot-screen').hidden && window.SchoolRPG && window.SchoolArt);
  async function open(seed, { viewport=SIZES[0], account=null, motion='full', wall=NOW } = {}) {
    const context = await browser.newContext({ viewport, isMobile:viewport.width < 1000, hasTouch:viewport.width < 1000,
      deviceScaleFactor:1, serviceWorkers:'block', reducedMotion:motion === 'reduced' ? 'reduce' : 'no-preference' });
    if (!account) await context.route('**/api/**', r => r.abort('blockedbyclient'));
    await context.addInitScript(({ seed, key, account, origin, motion }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(seed));
      localStorage.setItem('school-save-mode', account ? 'cloud' : 'guest');
      if (account) localStorage.setItem(`card-account:${origin}`, JSON.stringify({ token:account.token }));
      localStorage.setItem('school-settings', JSON.stringify({ theme:'light', sound:false, motion }));
      sessionStorage.setItem('school-landscape-ack', '1');
    }, { seed, key:SAVE, account, origin, motion });
    const p = await context.newPage(); lastPage = p; p.setDefaultTimeout(12000);
    await p.clock.setFixedTime(new Date(wall));
    p.on('pageerror', e => errors.push(e.message));
    p.on('response', r => { if (r.status() >= 400 && /\.(js|css|webp|png|woff2)(\?|$)/.test(r.url())) badAssets.push(r.url()); });
    await p.goto(origin + '/school.html'); await ready(p); await p.evaluate(() => Promise.all([document.fonts.ready, SchoolArt.horasReady]));
    return { p, context };
  }
  async function advance(p, ms) { await p.clock.setFixedTime(new Date(NOW + ms)); await p.waitForTimeout(320); }
  async function battle(p) { await p.click('#lobby-resume'); await p.waitForFunction(() => !!window.blossomFrame); }
  async function winter(p) { await p.click('#winter-button'); await p.waitForSelector('#winter-balance'); }
  async function fits(p, selector) {
    const r = await p.locator(selector).boundingBox(), v = p.viewportSize();
    assert(r && r.x >= -1 && r.y >= -1 && r.x + r.width <= v.width + 1 && r.y + r.height <= v.height + 1, selector + JSON.stringify({r,v}));
  }
  try {
    const cast = pending(false), frames = [];
    for (const viewport of SIZES) {
      const view = await open(cast, { viewport }); await battle(view.p);
      for (const [phase, ms] of [['orbs',200],['fusion',700],['sky',1250],['impact',1620],['afterglow',2200],['mark',2800]]) {
        await advance(view.p, ms);
        const frame = await view.p.evaluate(() => blossomFrame);
        if (ms < 1500) assert.equal(frame.cast?.id, cast.battle.horasCast.id, 'Pending authoritative cast remains');
        if (ms >= 1620) assert(frame.events.some(e => e.kind === 'horas-impact' && !e.missed), 'Confirmed impact visible');
        if (ms >= 1620) assert(frame.marks > 0);
        if (['fusion','sky','impact','afterglow'].includes(phase)) await view.p.screenshot({ path:path.join(OUT, `${phase}-${viewport.width}x${viewport.height}.png`) });
        frames.push({ viewport, phase, time:frame.time, elapsed:frame.elapsed });
      }
      const final = await saved(view.p);
      assert.equal(final.events.filter(e => e.kind === 'horas-impact' && e.castId === cast.battle.horasCast.id).length, 1);
      await fits(view.p, '#battle'); await view.context.close();
    }
    console.log('PASS real pending cast: five-orb/fusion, sky, confirmed impact, afterglow/mark at three landscape sizes');
    if (process.env.SCHOOL_BLOSSOM_CAPTURE_ONLY === '1') return;

    const reduced = await open(cast, { motion:'reduced' }); await battle(reduced.p);
    await reduced.p.click('[data-speed="1.5"]');
    await reduced.p.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).speed===1.5,SAVE);
    await advance(reduced.p, 1200);
    let state = await saved(reduced.p); assert.equal(state.speed, 1.5);
    assert(state.events.some(e => e.kind === 'horas-impact' && e.castId === cast.battle.horasCast.id));
    assert.equal(await reduced.p.evaluate(() => blossomFrame.reduced), true);
    await reduced.p.screenshot({ path:path.join(OUT, 'reduced-1.5x.png') }); await reduced.context.close();
    const miss = pending(true), missed = await open(miss); await battle(missed.p); await advance(missed.p, 1700);
    state = await saved(missed.p); const id = miss.battle.horasCast.id;
    assert(state.events.some(e => e.kind === 'horas-impact' && e.castId === id && e.missed));
    assert(!state.events.some(e => ['hit','horas-mark','horas-refund'].includes(e.kind) && e.castId === id));
    assert(state.battle.enemies.every(e => !e.horasMark));
    await missed.p.screenshot({ path:path.join(OUT, 'miss-755x330.png') });
    const cancellations = await missed.p.evaluate(seed => {
      const G=SchoolRPG, Art=SchoolArt, outcomes=[];
      for (const reason of ['death','stage-exit']) {
        const s=G.clone(seed), cast=s.battle.horasCast;
        const event=s.events.find(e=>e.kind==='horas-cast'&&e.castId===cast.id);
        if(reason==='death') { s.battle.heroes.find(h=>h.id==='horas').hp=0;G.advance(s,s.at+500); }
        else G.action(s,{kind:'stage',stage:1,mode:'farm'},s.at);
        const canvas=document.createElement('canvas');canvas.width=755;canvas.height=330;canvas.dataset.layout='panorama';
        const c=canvas.getContext('2d'),time=s.simTime/1000;
        Art.draw(c,s,time,[{...event,time:event.simAt/1000}],false);const stale=canvas.toDataURL();
        Art.draw(c,s,time,[],false);
        outcomes.push({reason,castGone:!s.battle.horasCast,samePixels:stale===canvas.toDataURL(),noImpact:!s.events.some(e=>e.kind==='horas-impact'&&e.castId===cast.id)});
      }
      return outcomes;
    },cast);
    assert(cancellations.every(r=>r.castGone&&r.samePixels&&r.noImpact),JSON.stringify(cancellations));
    await missed.context.close();
    console.log('PASS 1.5× reduced-motion resolves once; real 10% miss has no hit/mark/refund; death and stage exit remove stale effects');

    const weak=frozen();weak.best=60;
    for(const h of weak.battle.heroes)h.atk=100000;
    for(const e of weak.battle.enemies)e.hp=e.max=1;
    const reward=G.campaignRewardInfo(weak),low=await open(weak);await battle(low.p);
    assert.equal(await low.p.locator('#battle-status').getAttribute('data-reduced'),'true');
    assert.match(await low.p.locator('#battle-status').innerText(),new RegExp(`${Math.round(reward.multiplier*100)}%`));
    await advance(low.p,1000);state=await saved(low.p);
    assert.equal(state.gold,weak.gold+reward.gold);assert.equal(state.kills,3);
    assert.deepEqual(state.quests.repeat,{kills:0,waves:0,bosses:0});assert.equal(state.quests.daily.kills,0);
    assert.equal(state.winter.snowflakes,weak.winter.snowflakes);assert.equal(state.captain.xp,weak.captain.xp);
    await low.p.click('#battle-map');await low.p.waitForSelector('[data-map-stage="1"]');
    assert.equal(await low.p.locator('.wm-reward').getAttribute('data-reduced'),'true');
    assert.match(await low.p.locator('.wm-stage-note').innerText(),/눈송이.*미집계/);
    await low.p.screenshot({path:path.join(OUT,'low-stage-map.png')});
    await low.p.click('[data-map-chapter="10"]');await low.p.click('[data-map-stage="54"]');
    assert.equal(await low.p.locator('.wm-reward').getAttribute('data-reduced'),String(!G.campaignRewardInfo(state,54,false).eligible));
    await low.p.click('[data-map-stage="55"]');
    assert.equal(await low.p.locator('.wm-reward').getAttribute('data-reduced'),String(!G.campaignRewardInfo(state,55,false).eligible));
    await low.context.close();console.log('PASS real weak-stage victory pays exact reduced gold, no quest/snow/XP; compact map/battle notices match eligibility boundary54/55');

    const legacy = frozen(); legacy.winter = { id:G.WINTER_EVENT.id, snowflakes:600, earned:900, exchanges:{gold:12,gems:18} };
    const shop = await open(legacy); await winter(shop.p);
    for (const [item, cost] of [['gold',30],['gems',60]]) {
      assert.match(await shop.p.locator(`[data-winter-row="${item}"] [data-winter-remaining]`).innerText(), /10\s*\/\s*10/);
      assert.equal((await shop.p.locator(`[data-winter-item="${item}"] [data-winter-price]`).innerText()).trim(), String(cost));
      await shop.p.click(`[data-winter-item="${item}"]`);
      await shop.p.waitForFunction(({ key, item }) => JSON.parse(localStorage.getItem(key)).winter.daily.exchanges[item] === 1, {key:SAVE,item});
    }
    state = await saved(shop.p); assert.equal(state.winter.snowflakes, 510); assert.equal(state.winter.earned, 900);
    assert.deepEqual(state.winter.exchanges, {gold:13,gems:19}); assert.equal(state.gold, legacy.gold+1000); assert.equal(state.gems, legacy.gems+100);
    await shop.p.reload(); await ready(shop.p); assert.equal((await saved(shop.p)).winter.snowflakes, 510);
    await winter(shop.p); await shop.p.screenshot({ path:path.join(OUT, 'winter-755x330.png') }); await shop.context.close();
    const capped = frozen(); capped.winter.snowflakes=1000; capped.winter.earned=1000;
    capped.winter.daily.exchanges={gold:10,gems:10}; capped.winter.exchanges={gold:25,gems:30};
    const reset = await open(capped); await winter(reset.p);
    assert(await reset.p.locator('[data-winter-item="gold"]').isDisabled()); assert(await reset.p.locator('[data-winter-item="gems"]').isDisabled());
    await advance(reset.p, 3000);
    for (const item of ['gold','gems']) {
      await reset.p.waitForFunction(item => document.querySelector(`[data-winter-item="${item}"]`)?.disabled === false, item);
      assert.match(await reset.p.locator(`[data-winter-row="${item}"] [data-winter-remaining]`).innerText(), /10\s*\/\s*10/);
    }
    assert.equal((await saved(reset.p)).winter.snowflakes, 1000); assert.deepEqual((await saved(reset.p)).winter.exchanges,{gold:25,gems:30});
    await reset.context.close(); console.log('PASS winter legacy wallet/history preserved, exact30/60 prices, actual purchases/reload, both daily caps reset while window stays open');

    // Signed account: server time wins over a device clock three days ahead.
    const identity = await t.login('blossom2-browser-signed'); assert.equal(identity.status,200);
    const cloud = frozen(); cloud.winter.snowflakes=1000; cloud.winter.earned=1000; cloud.winter.daily.exchanges={gold:10,gems:10}; cloud.winter.exchanges={gold:25,gems:30};
    t.sqlite.prepare('INSERT INTO school_saves(account_id,payload,revision,updated_at) VALUES(?,?,0,?)').run(identity.data.profile.id,JSON.stringify(cloud),serverTime);
    const readCloud = () => JSON.parse(t.sqlite.prepare('SELECT payload FROM school_saves WHERE account_id=?').get(identity.data.profile.id).payload);
    const control = {dropNextAction:false}; controls.set(identity.data.token,control);
    const account = await open(frozen(), {account:identity.data,wall:NOW+3*86400000});
    await account.p.waitForFunction(() => document.querySelector('#account-label').textContent === '계정 저장');
    await winter(account.p); assert(await account.p.locator('[data-winter-item="gold"]').isDisabled());
    serverTime=NOW+3000;
    await account.p.waitForFunction(() => !document.querySelector('[data-winter-item="gold"]').disabled, null, {timeout:8000});
    control.dropNextAction=true;
    await account.p.locator('[data-winter-item="gold"]').evaluate(el => {el.click();el.click();});
    await account.p.waitForSelector('#connection:not([hidden])');
    assert(control.committed && control.committed.status===200); assert.equal(readCloud().winter.snowflakes,970); assert.equal(readCloud().gold,cloud.gold+1000);
    assert(await account.p.locator('[data-winter-item="gold"]').isDisabled()); assert(await account.p.locator('[data-winter-item="gems"]').isDisabled());
    const requestsBefore=apiLog.filter(r=>r.path==='/api/school/action').length;
    await account.p.locator('[data-winter-item="gems"]').evaluate(el=>el.click()); await account.p.waitForTimeout(150);
    assert.equal(apiLog.filter(r=>r.path==='/api/school/action').length,requestsBefore);
    await account.p.reload(); await ready(account.p); await account.p.waitForFunction(()=>document.querySelector('#account-label').textContent==='계정 저장'&&document.querySelector('#connection').hidden);
    await winter(account.p); assert.equal(readCloud().winter.snowflakes,970); assert.equal(readCloud().gold,cloud.gold+1000);
    assert.deepEqual(readCloud().winter.daily.exchanges,{gold:1,gems:0}); assert.deepEqual(readCloud().winter.exchanges,{gold:26,gems:30});
    assert.match(await account.p.locator('[data-winter-row="gold"] [data-winter-remaining]').innerText(),/9\s*\/\s*10/);
    await account.context.close(); console.log('PASS signed server clock, midnight window refresh, lost-response pending guard and reload receipt retry charge exactly once');

    assert.deepEqual(errors,[]); assert.deepEqual(badAssets,[]);
    fs.writeFileSync(path.join(OUT,'result.json'),JSON.stringify({catalog:G.CATALOG_VERSION,frames,errors,badAssets,accountActions:apiLog.filter(r=>r.path==='/api/school/action').length},null,2));
    console.log('Blossom2 browser passed; JavaScript/assets errors0');
  } catch(e) { if(lastPage&&!lastPage.isClosed())await lastPage.screenshot({path:path.join(OUT,'failure.png')}).catch(()=>{}); throw e; }
  finally { await browser.close(); server.closeAllConnections(); await new Promise(r=>server.close(r)); t.sqlite.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
