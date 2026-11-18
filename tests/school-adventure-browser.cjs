// Full application UI, actual guest saves and a locally signed Worker account.
// These are Chromium viewport/touch simulations, not physical phone results.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const G = require('../school/engine.js');
const { fixture } = require('./account-fixture.cjs');
const ROOT = path.resolve(__dirname, '..'), SAVE = 'school-mercenaries-v8';
const OUT = process.env.SCHOOL_ADVENTURE_OUT || '/tmp/school-adventure';
const SIZES = [{ width: 568, height: 280 }, { width: 755, height: 330 }, { width: 844, height: 390 }, { width: 2560, height: 1440 }];

function save({ frozen = false, damaged = false, boss = false } = {}) {
  const now = Date.now() + (frozen ? 120000 : 0), state = G.create(now, 1824);
  state.gold = 12345; state.gems = 1800; state.best = 16;
  state.team = ['taeo', 'harin', 'sua', 'osia', 'lava', 'ian'];
  for (const id of state.team) state.units[id] = { level: 20, xp: 0, stars: 1, shards: 0, nextSkill: 1 };
  G.action(state, { kind: 'stage', stage: 16, mode: 'farm' }, now);
  if (boss) {
    while (state.wave < 4) {
      for (const enemy of state.battle.enemies) enemy.hp = 0;
      G.advance(state, state.at + 500);
      while (state.battle.phase !== 'fight') G.advance(state, state.at + 500);
    }
  }
  if (damaged) state.battle.heroes.forEach((hero, i) => {
    hero.hp = i === 0 ? 0 : Math.floor(hero.max * (0.3 + i * 0.1));
    hero.energy = i === 0 ? 0 : G.BY_ID[hero.id].cooldown / 2;
    hero.shield = i === 2 ? 17 : 0;
  });
  assert(G.validate(state)); return state;
}

async function within(page, locator, label) {
  assert(await locator.isVisible(), `${label} must be visible`);
  const r = await locator.boundingBox(), v = page.viewportSize();
  assert(r && r.width > 0 && r.height > 0 && r.x >= -1 && r.y >= -1 && r.x + r.width <= v.width + 1 && r.y + r.height <= v.height + 1,
    `${label} must fit ${v.width}x${v.height}: ${JSON.stringify(r)}`);
  return r;
}
async function close(page) { if (await page.locator('#modal').evaluate(el => el.open)) await page.click('#modal-close'); }
async function ready(page) {
  await page.waitForFunction(() => document.querySelector('#boot-screen').hidden && window.SchoolRPG && window.SchoolWorldMap);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => SchoolArt.battlefieldsReady);
}
async function saved(page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE); }
async function accountWait(predicate, label) {
  const deadline = Date.now() + 12000;
  while (!predicate()) { if (Date.now() > deadline) throw Error('Timed out: ' + label); await new Promise(resolve => setTimeout(resolve, 30)); }
}
async function battleLayout(page) {
  const v = page.viewportSize(), canvas = page.locator('#battle');
  const box = await within(page, canvas, 'full viewport battle');
  assert(Math.abs(box.x) <= 1 && Math.abs(box.y) <= 1 && Math.abs(box.width - v.width) <= 1 && Math.abs(box.height - v.height) <= 1,
    'Battle canvas must cover the viewport behind its overlaid UI: ' + JSON.stringify(box));
  assert.equal(await canvas.getAttribute('data-layout'), 'panorama');
  const backing = await canvas.evaluate(c => [c.width, c.height]);
  assert(Math.abs(backing[0] / backing[1] - box.width / box.height) < .02, 'Canvas backing and displayed aspect ratios must agree');
  for (const selector of ['#battle-back', '#battle-settings', '#battle-map', '#log-button', '#battle-progress', '#battle-farm', '[data-speed="1"]', '[data-speed="1.5"]'])
    await within(page, page.locator(selector), selector);
  const members = page.locator('#party [data-hero]'); assert.equal(await members.count(), 6);
  for (let i = 0; i < 6; i++) await within(page, members.nth(i), 'battle portrait ' + i);
  const size = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, width: innerWidth, height: innerHeight }));
  assert(size.scrollWidth <= size.width + 1 && size.scrollHeight <= size.height + 1, 'Battle UI must not require document scrolling: ' + JSON.stringify(size));
  return { viewport: v, canvas: box, backing, size };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const t = await fixture(), errors = [], badAssets = [], results = [], controls = new Map();
  let origin;
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, origin || 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        const body = Buffer.concat(chunks), token = req.headers['x-account-session'];
        const control = controls.get(token), record = { path: url.pathname, body: body.length ? JSON.parse(body) : null };
        control?.requests.push(record);
        if (url.pathname === '/api/school/state' && control?.status) {
          res.writeHead(control.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: '연결 복구 검증용 오류' })); return;
        }
        if (url.pathname === '/api/school/action' && control?.holdNextAction) {
          control.holdNextAction = false; await new Promise(resolve => { control.releaseAction = resolve; }); control.releaseAction = null;
        }
        const response = await t.worker.fetch(new Request(url, { method: req.method, headers: req.headers, ...(['GET', 'OPTIONS'].includes(req.method) ? {} : { body }) }), t.env);
        record.status = response.status; res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer())); return;
      }
      const file = path.resolve(ROOT, '.' + url.pathname);
      if (!file.startsWith(ROOT + path.sep)) throw Error('Outside test server');
      let body = fs.readFileSync(file);
      if (file.endsWith('/school/client.js')) body = Buffer.from(body.toString().replace('https://motracv-card-room.densedormouse4.chatgpt.site', origin));
      if (file.endsWith('/school/art.js')) body = Buffer.from(body.toString() + `\n;(()=>{const draw=SchoolArt.draw;window.adventureFrames=[];SchoolArt.draw=function(c,s,...args){adventureFrames.push({stage:s.battle.stage,wave:s.battle.wave,sim:s.simTime,elapsed:s.battle.elapsed});if(adventureFrames.length>600)adventureFrames.shift();return draw.call(this,c,s,...args);};})();`);
      res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' })[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(body);
    } catch (error) { res.writeHead(404); res.end(error.message); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`; t.env.ALLOWED_ORIGIN = origin;
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  async function open(state, viewport = SIZES[1], account) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: viewport.width < 1000, hasTouch: viewport.width < 1000, serviceWorkers: 'block', reducedMotion: 'reduce' });
    if (!account) await context.route('**/api/**', route => route.abort('blockedbyclient'));
    await context.addInitScript(({ state, key, origin, account }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
      localStorage.setItem('school-save-mode', account ? 'cloud' : 'guest');
      if (account) localStorage.setItem(`card-account:${origin}`, JSON.stringify({ token: account.token }));
      localStorage.setItem('school-settings', JSON.stringify({ sound: false, motion: 'reduced', theme: 'light' }));
      sessionStorage.setItem('school-landscape-ack', '1');
    }, { state, key: SAVE, origin, account });
    const page = await context.newPage(); page.setDefaultTimeout(12000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400 && /\.(js|css|webp|png|woff2)(\?|$)/.test(response.url())) badAssets.push({ url: response.url(), status: response.status() }); });
    await page.goto(origin + '/school.html'); await ready(page);
    return { page, context };
  }
  try {
    const initial = save({ frozen: true, damaged: true }), first = await open(initial), page = first.page;
    await page.click('.lobby-nav [data-lobby-action="map"]'); await page.waitForSelector('.wm-campus [data-map-chapter]');
    assert.equal(await page.locator('[data-map-chapter]').count(), 12);
    assert.equal(await page.locator('.wm-region-image').count(), 12);
    for (let i = 0; i < 12; i++) assert.match(await page.locator('.wm-region-image').nth(i).getAttribute('src'), new RegExp(`region-${String(i + 1).padStart(2, '0')}\\.webp`));
    const before = await saved(page), track = page.locator('.wm-campus'), trackBox = await track.boundingBox();
    const beforeScroll = await track.evaluate(el => el.scrollLeft);
    const cdp = await first.context.newCDPSession(page);
    const touchX = Math.round(trackBox.x + trackBox.width * .8), touchY = Math.round(trackBox.y + trackBox.height / 2);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchX, y: touchY }] });
    for (let step = 1; step <= 6; step++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touchX - step * 45, y: touchY }] });
      await page.waitForTimeout(20);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(150);
    assert.notEqual(await track.evaluate(el => el.scrollLeft), beforeScroll, 'A horizontal touch swipe must move the real region-card track');
    await page.click('[data-map-chapter="11"]');
    assert.equal(await page.locator('[data-map-stage]').count(), 5);
    assert(await page.locator('[data-map-stage="60"]').isDisabled());
    assert(await page.locator('#map-start').isDisabled()); assert(await page.locator('#map-farm').isDisabled());
    await page.click('[data-map-next]');
    assert.equal(await page.locator('[data-map-stage="17"]').getAttribute('aria-pressed'), 'true');
    await page.click('[data-map-chapter="2"]'); await page.click('[data-map-stage="15"]');
    assert.deepEqual(await saved(page), before, 'Swiping, locked chapter previews, next and stage selection must be read-only');
    await within(page, page.locator('#map-start'), 'map start'); await within(page, page.locator('#map-farm'), 'map farm');
    await page.screenshot({ path: path.join(OUT, 'region-cards-755x330.png') });
    await page.click('#map-farm');
    await page.waitForFunction(key => document.querySelector('#app').dataset.tab === 'adventure' && JSON.parse(localStorage.getItem(key)).stage === 15, SAVE);
    assert.equal((await saved(page)).mode, 'farm'); await page.waitForFunction(() => adventureFrames.length > 3);
    await page.click('#battle-back'); await page.waitForFunction(() => document.querySelector('#app').dataset.tab === 'lobby');
    await first.context.close();
    console.log('PASS twelve illustrated region cards, real touch scrolling, five-stage locks/read-only selection, next selection and actual guest departure');

    for (const viewport of SIZES) {
      const { page, context } = await open(initial, viewport);
      await page.click('.lobby-nav [data-lobby-action="map"]'); await page.waitForSelector('.wm-region-image');
      await within(page, page.locator('#map-start'), 'region departure'); await within(page, page.locator('#map-farm'), 'region repeat');
      const mapOverflow = await page.locator('#modal').evaluate(el => el.scrollWidth - el.clientWidth);
      assert(mapOverflow <= 1, 'Only the region-card track scrolls horizontally; the dialog must not overflow');
      await page.screenshot({ path: path.join(OUT, `region-cards-${viewport.width}x${viewport.height}.png`) }); await close(page);
      await page.click('#lobby-resume'); await page.waitForFunction(() => adventureFrames.length > 3);
      results.push(await battleLayout(page));
      const portraits = await page.locator('#party [data-hero]').evaluateAll(nodes => nodes.map(el => ({
        id: el.dataset.hero, fallen: el.classList.contains('fallen'), hp: parseFloat(el.querySelector('.party-hp i').style.width),
        energy: parseFloat(el.querySelector('.party-energy i').style.width), cooldown: el.querySelector('.party-cooldown').textContent,
        hpAria: Number(el.querySelector('.party-hp').getAttribute('aria-valuenow')),
        energyAria: Number(el.querySelector('.party-energy').getAttribute('aria-valuenow')),
        skill: el.querySelector('.party-skill')?.textContent || '', shield: el.querySelector('.party-shield').textContent,
        shieldHidden: el.querySelector('.party-shield').hidden, description: el.getAttribute('aria-label'),
      })));
      assert.deepEqual(portraits.map(p => p.id), initial.team);
      for (const card of portraits) {
        const hero = initial.battle.heroes.find(h => h.id === card.id), expectedHP = hero.hp / hero.max * 100;
        assert(Math.abs(card.hp - expectedHP) < .02, `${card.id} HP must come from the actual battle snapshot`);
        assert.equal(card.hpAria, Math.round(expectedHP));
        assert.equal(card.fallen, hero.hp === 0);
        assert(Math.abs(card.energy - hero.energy / G.BY_ID[card.id].cooldown * 100) < .02, `${card.id} energy must reflect the actual cooldown`);
        assert.equal(card.energyAria, Math.round(hero.energy / G.BY_ID[card.id].cooldown * 100));
        assert.equal(card.shieldHidden, hero.shield === 0 || hero.hp === 0);
        if (hero.shield) assert.match(card.shield, new RegExp(String(hero.shield)));
        if (hero.hp === 0) { assert.match(card.cooldown, /전투불능|✕/); assert.match(card.description, /전투불능/); }
        else assert.match(card.cooldown, new RegExp(String(Math.ceil(G.BY_ID[card.id].cooldown - hero.energy))));
      }
      assert.equal(await page.locator('#battle-clock').textContent(), '00:00', 'The elapsed clock is zero for this frozen fresh-wave snapshot');
      assert.match(portraits.find(p => p.id === 'osia').skill, /1\s*\/\s*4/);
      assert.match(portraits.find(p => p.id === 'lava').skill, /1\s*\/\s*2/);
      await page.screenshot({ path: path.join(OUT, `battle-${viewport.width}x${viewport.height}.png`) });
      for (const id of initial.team) {
        await page.click(`#party [data-hero="${id}"]`); await page.waitForSelector('#train-hero');
        assert.match(await page.locator('#modal-content').innerText(), new RegExp(G.BY_ID[id].name)); await close(page);
      }
      await page.click('#battle-settings'); await page.waitForFunction(() => document.querySelector('#modal').open); await close(page);
      await page.click('#log-button'); await page.waitForFunction(() => document.querySelector('#modal').open); await close(page);
      await context.close();
    }
    console.log('PASS full viewport canvases, six real HP/energy/death/skill portraits and management/settings/damage access at four sizes');

    const live = await open(save()), livePage = live.page;
    await livePage.click('#lobby-resume'); await livePage.waitForFunction(() => adventureFrames.length > 3);
    await livePage.click('[data-speed="1.5"]'); await livePage.waitForFunction(key => JSON.parse(localStorage.getItem(key)).speed === 1.5, SAVE);
    await livePage.click('[data-speed="1"]'); await livePage.waitForFunction(key => JSON.parse(localStorage.getItem(key)).speed === 1, SAVE);
    const priorMode = (await saved(livePage)).mode; assert.equal(priorMode, 'farm');
    await livePage.click('#battle-progress'); await livePage.waitForSelector('[data-confirm-battle-mode]');
    assert.match(await livePage.locator('#modal-content').innerText(), /첫 웨이브|다시 시작/);
    assert.equal((await saved(livePage)).mode, priorMode, 'Opening mode confirmation must not restart combat');
    await close(livePage); assert.equal((await saved(livePage)).mode, priorMode);
    await livePage.click('#battle-progress'); await livePage.click('[data-confirm-battle-mode]');
    await livePage.waitForFunction(key => JSON.parse(localStorage.getItem(key)).mode === 'progress' && !document.querySelector('#modal').open, SAVE);
    await livePage.evaluate(() => { window.sameModeActions = []; const action = SchoolRPG.action; SchoolRPG.action = function(s, input, ...rest) { sameModeActions.push({ ...input }); return action.call(this, s, input, ...rest); }; });
    await livePage.click('#battle-progress');
    assert.equal(await livePage.locator('#modal').evaluate(el => el.open), false);
    assert.deepEqual(await livePage.evaluate(() => sameModeActions), [], 'Clicking the already active mode must not restart its current wave');
    for (const height of [280, 390, 330]) { await livePage.setViewportSize({ width: 755, height }); await livePage.waitForTimeout(80); results.push(await battleLayout(livePage)); }
    await livePage.click('#battle-back'); await livePage.waitForFunction(() => document.querySelector('#app').dataset.tab === 'lobby');
    await livePage.reload(); await ready(livePage); assert.equal((await saved(livePage)).mode, 'progress');
    await live.context.close();
    console.log('PASS real speed changes, cancellable mode restart confirmation, persisted progress mode and dynamic viewport heights');

    const login = await t.login('adventure-local-account'); assert.equal(login.status, 200);
    const cloud = save(), control = { requests: [], holdNextAction: false, status: 0 }; controls.set(login.data.token, control);
    t.sqlite.prepare('INSERT INTO school_saves(account_id,payload,revision,updated_at) VALUES(?,?,0,?)').run(login.data.profile.id, JSON.stringify(cloud), Date.now());
    const signed = await open(G.create(Date.now(), 341), SIZES[1], login.data), sp = signed.page;
    await sp.waitForFunction(() => document.querySelector('#account-label').textContent === '계정 저장');
    await sp.click('.lobby-nav [data-lobby-action="map"]'); await sp.click('[data-map-chapter="2"]'); await sp.click('[data-map-stage="15"]'); await sp.click('#map-start');
    await sp.waitForFunction(() => document.querySelector('#app').dataset.tab === 'adventure');
    const cloudSave = () => JSON.parse(t.sqlite.prepare('SELECT payload FROM school_saves WHERE account_id=?').get(login.data.profile.id).payload);
    assert.equal(cloudSave().stage, 15); assert.equal(cloudSave().mode, 'progress');
    await sp.click('#battle-farm'); await sp.waitForSelector('[data-confirm-battle-mode]');
    control.holdNextAction = true;
    const actionCount = control.requests.filter(r => r.path === '/api/school/action').length;
    await sp.click('[data-confirm-battle-mode]'); await accountWait(() => !!control.releaseAction, 'held account action');
    await sp.locator('[data-confirm-battle-mode]').evaluate(button => { button.click(); button.click(); });
    assert.equal(await sp.locator('#battle-progress').getAttribute('aria-pressed'), 'true', 'Mode remains confirmed server mode until the response arrives');
    assert.equal(cloudSave().mode, 'progress');
    assert.equal(control.requests.filter(r => r.path === '/api/school/action').length, actionCount + 1, 'Repeated confirmation cannot send another account action');
    control.releaseAction();
    await sp.waitForFunction(() => document.querySelector('#battle-farm').getAttribute('aria-pressed') === 'true' && !document.querySelector('#modal').open);
    assert.equal(cloudSave().stage, 15); assert.equal(cloudSave().mode, 'farm');
    control.status = 503; await sp.waitForFunction(() => !document.querySelector('#connection').hidden, null, { timeout: 12000 });
    await within(sp, sp.locator('#connection'), 'connection warning');
    await within(sp, sp.locator('#battle-back'), 'back during account disconnection');
    await within(sp, sp.locator('#battle-settings'), 'settings during account disconnection');
    await sp.click('#battle-settings'); await sp.waitForFunction(() => document.querySelector('#modal').open); await close(sp);
    await sp.screenshot({ path: path.join(OUT, 'battle-disconnected-755x330.png') });
    await sp.click('#battle-back'); await sp.waitForFunction(() => document.querySelector('#app').dataset.tab === 'lobby');
    await within(sp, sp.locator('#account-button'), 'account recovery from lobby');
    await signed.context.close();
    console.log('PASS actual Worker account departure, one held mode action with unchanged pre-response UI, and accessible controls during connection failure');

    const boss = await open(save({ frozen: true, boss: true }));
    await boss.page.click('#lobby-resume'); await boss.page.waitForFunction(() => adventureFrames.length > 3);
    assert(await boss.page.locator('#boss-hud').isVisible()); await within(boss.page, boss.page.locator('#boss-hud'), 'boss status');
    await boss.page.screenshot({ path: path.join(OUT, 'battle-boss-755x330.png') }); await boss.context.close();
    const dungeonState = save(); G.action(dungeonState, { kind: 'activity', mode: 'daily', tier: 1 }, dungeonState.at);
    // A finite snapshot grace period lets the real UI enter battle first; the
    // unchanged engine then settles this nearly defeated boss automatically.
    dungeonState.at = Date.now() + 6000;
    for (const enemy of dungeonState.battle.enemies) { enemy.hp = 1; enemy.atk = 0; }
    const dungeon = await open(dungeonState); await dungeon.page.click('#lobby-resume');
    assert(await dungeon.page.locator('#battle-progress').isDisabled()); assert(await dungeon.page.locator('#battle-farm').isDisabled());
    await dungeon.page.waitForFunction(() => document.querySelector('#modal').open && !!document.querySelector('#modal').dataset.activityResult);
    const resultId = await dungeon.page.locator('#modal').getAttribute('data-activity-result'); await close(dungeon.page);
    assert.equal(await dungeon.page.locator('#app').getAttribute('data-tab'), 'adventure');
    assert.match(await dungeon.page.locator('#battle-map').textContent(), /결과/);
    await within(dungeon.page, dungeon.page.locator('#battle-map'), 'settled dungeon result control');
    const rewarded = await saved(dungeon.page);
    await dungeon.page.click('#battle-map'); await dungeon.page.waitForFunction(id => document.querySelector('#modal').open && document.querySelector('#modal').dataset.activityResult === id, resultId);
    const reopened = await saved(dungeon.page);
    assert.equal(reopened.gold, rewarded.gold); assert.equal(reopened.gems, rewarded.gems); assert.equal(reopened.activities.daily.used, rewarded.activities.daily.used);
    await dungeon.context.close();
    console.log('PASS boss HUD visibility, dungeon mode locks, actual dungeon settlement and HUD result reopening without repeated rewards');
    assert.deepEqual(errors, []); assert.deepEqual(badAssets, []);
    fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ results, errors, badAssets, scope: 'Local Chromium viewport/touch emulation, isolated guest saves and locally signed Worker account; no production account writes' }, null, 2));
  } catch (error) {
    const page = browser.contexts().flatMap(c => c.pages()).filter(p => !p.isClosed()).at(-1);
    if (page) { await page.screenshot({ path: path.join(OUT, 'failure.png') }).catch(() => {}); fs.writeFileSync(path.join(OUT, 'failure.json'), JSON.stringify({ error: error.message, errors, badAssets }, null, 2)); }
    throw error;
  } finally {
    for (const control of controls.values()) control.releaseAction?.();
    await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); t.sqlite.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
