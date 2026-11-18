// Actual Chromium navigation and saved-state checks for the full-scene lobby.
// Viewport emulation does not replace testing a physical Android/iOS device.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const G = require('../school/engine.js');
const { fixture } = require('./account-fixture.cjs');
const root = path.resolve(__dirname, '..');
const SAVE = 'school-mercenaries-v8';
const out = process.env.SCHOOL_LOBBY_OUT || '/tmp/school-lobby';
const viewports = [
  { width: 755, height: 330 }, { width: 568, height: 280 },
  { width: 844, height: 390 }, { width: 2560, height: 1440 },
];

function sixHeroSave() {
  const state = G.create(Date.now(), 8104);
  state.gold = 12345; state.gems = 1800; state.best = 16;
  state.team = ['taeo', 'harin', 'sua', 'osia', 'lava', 'ian'];
  for (const id of state.team) state.units[id] = { level: 20, xp: 0, stars: 1, shards: 0, nextSkill: 1 };
  G.action(state, { kind: 'stage', stage: 16, mode: 'farm' }, state.at);
  assert(G.validate(state));
  return state;
}

async function inside(page, locator, label) {
  assert(await locator.isVisible(), `${label} must be visible`);
  const box = await locator.boundingBox(), viewport = page.viewportSize();
  assert(box && box.width > 0 && box.height > 0, `${label} must have an actual clickable box`);
  assert(box.x >= -1 && box.y >= -1 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1,
    `${label} is outside ${viewport.width}x${viewport.height}: ${JSON.stringify(box)}`);
  return box;
}

async function closeModal(page) {
  if (await page.locator('#modal').evaluate(el => el.open)) await page.click('#modal-close');
}

async function home(page) {
  await closeModal(page);
  const tab = await page.locator('#app').getAttribute('data-tab');
  if (tab !== 'lobby') await page.click(tab === 'adventure' ? '#battle-back' : '#home-button');
  await page.waitForFunction(() => document.querySelector('#app').dataset.tab === 'lobby');
}

async function ready(page) {
  await page.waitForFunction(() => document.querySelector('#boot-screen').hidden && window.SchoolRPG && window.SchoolArt);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => SchoolArt.assetsReady('osia-front') && SchoolArt.assetsReady('lava-fan'));
}

async function layout(page) {
  const bounds = {};
  bounds.panel = await inside(page, page.locator('#lobby-panel'), 'lobby scene');
  const actions = page.locator('.lobby-nav button');
  assert(await actions.count() >= 4, 'The lobby must provide its primary destinations');
  for (let i = 0; i < await actions.count(); i++) {
    const button = actions.nth(i), action = await button.getAttribute('data-lobby-action') || await button.getAttribute('id');
    bounds[action] = await inside(page, button, `lobby ${action}`);
    assert((await button.getAttribute('aria-label') || await button.innerText()).trim(), `${action} needs an accessible name`);
  }
  await inside(page, page.locator('#friends-button'), 'top friends');
  assert(await page.locator('#friends-button').evaluate(el => !!el.closest('.topbar')), 'Friends belongs in the top bar');
  for (const selector of ['#lobby-next', '#lobby-resume', '#lobby-formation']) await inside(page, page.locator(selector), selector);
  const shortcuts = page.locator('.lobby-shortcuts button');
  for (let i = 0; i < await shortcuts.count(); i++) {
    const button = shortcuts.nth(i);
    await inside(page, button, 'left shortcut ' + i);
    assert((await button.getAttribute('aria-label') || '').trim(), 'Icon-only shortcuts need accessible names');
    assert.equal((await button.innerText()).trim(), '', 'Left shortcuts must not retain a visible text menu');
  }
  const sizes = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight }));
  assert(sizes.scrollWidth <= sizes.width + 1, `Landscape must not overflow horizontally: ${JSON.stringify(sizes)}`);
  assert(sizes.scrollHeight <= sizes.height + 1, `Lobby must fit the available height: ${JSON.stringify(sizes)}`);
  return { bounds, sizes };
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  let accountFixture, origin;
  const apiLog = [];
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, origin || 'http://localhost');
      if (url.pathname.startsWith('/api/') && accountFixture) {
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        const body = Buffer.concat(chunks);
        apiLog.push({ path: url.pathname, ...(body.length ? { body: JSON.parse(body) } : {}) });
        const response = await accountFixture.worker.fetch(new Request(url, { method: req.method, headers: req.headers, ...(['GET', 'OPTIONS'].includes(req.method) ? {} : { body }) }), accountFixture.env);
        res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer())); return;
      }
      const file = path.resolve(root, '.' + url.pathname);
      if (!file.startsWith(root + path.sep)) throw Error('Outside fixture');
      let bytes = fs.readFileSync(file);
      if (file.endsWith('/school/client.js')) bytes = Buffer.from(bytes.toString().replace('https://motracv-card-room.densedormouse4.chatgpt.site', origin));
      res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json' })[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(bytes);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const errors = [], badAssets = [], results = [];
  async function newPage(viewport, seed) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: viewport.width < 1000, hasTouch: viewport.width < 1000, serviceWorkers: 'block' });
    await context.route('**/api/**', route => route.abort('blockedbyclient'));
    await context.addInitScript(({ seed, key }) => {
      if (seed && !localStorage.getItem(key)) { seed.at = Date.now(); localStorage.setItem(key, JSON.stringify(seed)); }
      localStorage.setItem('school-save-mode', 'guest');
      localStorage.setItem('school-settings', JSON.stringify({ sound: false, motion: 'full', theme: 'light' }));
      sessionStorage.setItem('school-landscape-ack', '1');
    }, { seed, key: SAVE });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400 && /\.(?:png|webp|js|css|woff2)(?:\?|$)/.test(response.url())) badAssets.push({ url: response.url(), status: response.status() }); });
    await page.goto(origin + '/school.html'); await ready(page);
    return { page, context };
  }
  try {
    // New players see only their three actual starters; the remaining slots
    // are actionable vacancies, never invented or unowned showcase heroes.
    const fresh = await newPage(viewports[0]);
    assert.equal(await fresh.page.locator('#app').getAttribute('data-tab'), 'lobby');
    assert.deepEqual(await fresh.page.locator('#lobby-party .lobby-unit[data-hero]').evaluateAll(nodes => nodes.map(node => node.dataset.hero)), ['taeo', 'harin', 'sua']);
    assert.equal(await fresh.page.locator('#lobby-party .lobby-unit').count(), 6);
    const vacancies = fresh.page.locator('#lobby-party .lobby-unit:not([data-hero])');
    assert.equal(await vacancies.count(), 3);
    assert.equal(await vacancies.locator('img,canvas').count(), 0, 'Vacancies must not draw characters the player does not own');
    await vacancies.first().click();
    await fresh.page.waitForFunction(() => document.querySelector('#app').dataset.tab === 'roster');
    await home(fresh.page); await layout(fresh.page);
    await fresh.page.screenshot({ path: path.join(out, 'fresh-three-755x330.png') });
    await fresh.context.close();
    console.log('PASS fresh default lobby, three real starters and three useful empty slots');

    for (const viewport of viewports) {
      const { page, context } = await newPage(viewport, sixHeroSave());
      assert.equal(await page.locator('#app').getAttribute('data-tab'), 'lobby');
      assert.deepEqual(await page.locator('#lobby-party .lobby-unit[data-hero]').evaluateAll(nodes => nodes.map(node => node.dataset.hero)), ['taeo', 'harin', 'sua', 'osia', 'lava', 'ian']);
      const measured = await layout(page);
      for (const id of ['taeo', 'harin', 'sua', 'osia', 'lava', 'ian']) {
        const unit = page.locator(`#lobby-party .lobby-unit[data-hero="${id}"]`);
        await inside(page, unit, id + ' lobby unit');
        await unit.click();
        await page.waitForSelector('#train-hero');
        assert.match(await page.locator('#modal-content').innerText(), new RegExp(G.BY_ID[id].name));
        await closeModal(page);
      }
      await page.screenshot({ path: path.join(out, `lobby-${viewport.width}x${viewport.height}.png`) });
      results.push({ viewport, ...measured });
      await context.close();
    }
    console.log('PASS six saved heroes open their own management panels at four landscape sizes');

    const { page, context } = await newPage(viewports[0], sixHeroSave());
    await page.evaluate(() => {
      window.lobbyActions = [];
      const action = SchoolRPG.action;
      SchoolRPG.action = function(state, input, ...rest) { const result = action.call(this, state, input, ...rest); lobbyActions.push({ input: { ...input }, stage: state.stage, team: [...state.team] }); return result; };
    });
    await page.click('#lobby-party .lobby-unit[data-hero="harin"]');
    await page.click('#train-hero');
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).units.harin.level === 21, SAVE);
    await page.click('[data-slot="0"]');
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).team[0] === 'harin', SAVE);
    await home(page);
    assert.equal(await page.locator('#lobby-party .lobby-unit[data-hero]').first().getAttribute('data-hero'), 'harin');
    await page.reload(); await ready(page);
    assert.equal(await page.locator('#lobby-party .lobby-unit[data-hero]').first().getAttribute('data-hero'), 'harin');
    assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).units.harin.level, SAVE), 21);
    console.log('PASS lobby training and formation write existing v8 guest save and survive reload');

    for (const [action, tab] of [['recruit', 'recruit'], ['supplies', 'supplies'], ['dungeons', 'dungeons'], ['codex', 'roster']]) {
      await home(page);
      await page.click(`.lobby-nav [data-lobby-action="${action}"]`);
      await page.waitForFunction(tab => document.querySelector('#app').dataset.tab === tab, tab);
      assert(await page.locator('#tab-' + tab).isVisible(), `${tab} is reachable from the lobby`);
      await inside(page, page.locator('#home-button'), `${tab} return to lobby`);
      if (tab === 'dungeons') await page.screenshot({ path: path.join(out, 'dungeons-755x330.png') });
    }
    await home(page); await page.click('#friends-button');
    await page.waitForFunction(() => document.querySelector('#modal').open);
    assert.match(await page.locator('#modal-content').innerText(), /로그인|계정|친구/);
    await home(page); await page.click('#arena-button');
    await page.waitForFunction(() => document.querySelector('#modal').open);
    assert.match(await page.locator('#modal-content').innerText(), /로그인|계정|아레나/);
    await home(page);
    console.log('PASS recruitment, supplies, dungeons, formation, friends and arena entry points');

    await page.evaluate(() => {
      window.lobbyMapActions = []; window.lobbyBattleDraws = [];
      const action = SchoolRPG.action, draw = SchoolArt.draw;
      SchoolRPG.action = function(state, input, ...rest) { const result = action.call(this, state, input, ...rest); lobbyMapActions.push({ ...input, actualStage: state.stage }); return result; };
      SchoolArt.draw = function(ctx, state, ...rest) { lobbyBattleDraws.push({ stage: state.stage, sim: state.simTime }); return draw.call(this, ctx, state, ...rest); };
    });
    const hiddenBattleBefore = await page.evaluate(key => {
      const state = JSON.parse(localStorage.getItem(key)); return { simTime: state.simTime, at: state.at };
    }, SAVE);
    await page.waitForTimeout(1250);
    const hiddenBattleAfter = await page.evaluate(key => {
      const state = JSON.parse(localStorage.getItem(key)); return { simTime: state.simTime, at: state.at, draws: lobbyBattleDraws.length, tab: document.querySelector('#app').dataset.tab };
    }, SAVE);
    assert.equal(hiddenBattleAfter.tab, 'lobby');
    assert.equal(hiddenBattleAfter.draws, 0, 'A hidden battle canvas must not be repainted while the player stays in the lobby');
    assert(hiddenBattleAfter.simTime > hiddenBattleBefore.simTime && hiddenBattleAfter.at > hiddenBattleBefore.at,
      `Guest combat calculation and saving must continue without hidden canvas draws: ${JSON.stringify({ before: hiddenBattleBefore, after: hiddenBattleAfter })}`);
    results.push({ hiddenBattle: { before: hiddenBattleBefore, after: hiddenBattleAfter } });
    console.log('PASS lobby skips all hidden battle canvas draws while actual guest simulation and saved time continue');
    await page.click('.lobby-nav [data-lobby-action="map"]');
    await page.waitForSelector('#modal.world-map-modal .school-world-map');
    await page.click('[data-map-chapter="11"]');
    assert(await page.locator('[data-map-stage="60"]').isDisabled(), 'An unopened stage itself cannot be activated');
    assert(await page.locator('#map-start').isDisabled(), 'A locked region can be previewed but cannot be entered');
    assert(await page.locator('#map-farm').isDisabled(), 'A locked region cannot be farmed');
    assert.deepEqual(await page.evaluate(() => lobbyMapActions.filter(action => action.kind === 'stage')), [], 'Map previews must not mutate the saved stage');
    await page.click('[data-map-chapter="2"]');
    await page.click('[data-map-stage="15"]');
    assert(await page.locator('#map-start').isEnabled());
    assert(await page.locator('#map-farm').isEnabled());
    await inside(page, page.locator('#map-start'), 'map adventure start');
    await inside(page, page.locator('#map-farm'), 'map repeat start');
    await page.screenshot({ path: path.join(out, 'world-map-755x330.png') });
    await page.click('#map-start');
    await page.waitForFunction(() => document.querySelector('#app').dataset.tab === 'adventure' && lobbyMapActions.some(action => action.kind === 'stage' && action.stage === 15 && action.mode === 'progress' && action.actualStage === 15));
    await page.waitForFunction(() => lobbyBattleDraws.length > 4 && lobbyBattleDraws.some(draw => draw.stage === 15));
    assert.equal(await page.locator('#modal').evaluate(el => el.open), false);
    await inside(page, page.locator('#battle-back'), 'battle return to lobby');
    await page.screenshot({ path: path.join(out, 'battle-from-map-755x330.png') });
    await home(page);
    await page.click('.lobby-nav [data-lobby-action="map"]');
    await page.click('[data-map-chapter="2"]');
    await page.click('[data-map-stage="14"]');
    await page.click('#map-farm');
    await page.waitForFunction(() => document.querySelector('#app').dataset.tab === 'adventure' && lobbyMapActions.some(action => action.kind === 'stage' && action.stage === 14 && action.mode === 'farm' && action.actualStage === 14));
    await home(page);
    console.log('PASS world-map locked previews cannot start; opened region starts actual progress/farm combat and returns to lobby');

    // Address-bar expansion/shrink is represented by a viewport height change.
    // It is not a physical browser address-bar or OS fullscreen test.
    for (const height of [280, 390, 330]) { await page.setViewportSize({ width: 755, height }); await page.waitForTimeout(80); results.push({ addressBarHeight: height, ...await layout(page) }); }
    await context.close();

    const settled = sixHeroSave();
    G.action(settled, { kind: 'activity', mode: 'daily', tier: 1 }, settled.at);
    for (const enemy of settled.battle.enemies) enemy.hp = 0;
    G.advance(settled, settled.at + 500);
    assert(settled.activities.run.settled && settled.activities.lastResult.won);
    const dungeon = await newPage(viewports[0], settled);
    await dungeon.page.waitForFunction(() => document.querySelector('#modal').open && !!document.querySelector('#modal').dataset.activityResult);
    const resultKey = await dungeon.page.locator('#modal').getAttribute('data-activity-result');
    await closeModal(dungeon.page); await home(dungeon.page);
    assert.match(await dungeon.page.locator('#lobby-resume').innerText(), /결과 확인/);
    const rewardBefore = await dungeon.page.evaluate(key => { const s = JSON.parse(localStorage.getItem(key)); return { gold: s.gold, gems: s.gems, used: s.activities.daily.used, runId: s.activities.run.id }; }, SAVE);
    await dungeon.page.click('#lobby-resume');
    await dungeon.page.waitForFunction(key => document.querySelector('#modal').open && document.querySelector('#modal').dataset.activityResult === key, resultKey);
    const rewardAfter = await dungeon.page.evaluate(key => { const s = JSON.parse(localStorage.getItem(key)); return { gold: s.gold, gems: s.gems, used: s.activities.daily.used, runId: s.activities.run.id }; }, SAVE);
    assert.deepEqual(rewardAfter, rewardBefore, 'Reopening a completed dungeon result must not repeat rewards or spend another key');
    await dungeon.context.close();
    console.log('PASS dismissed dungeon results reopen from the lobby without duplicate rewards');

    // The browser receives a locally signed test account and talks to the real
    // Worker backed by an isolated in-memory SQLite database, never production.
    accountFixture = await fixture();
    const login = await accountFixture.login('lobby-local-account');
    assert.equal(login.status, 200);
    accountFixture.env.ALLOWED_ORIGIN = origin;
    const cloud = sixHeroSave(), guest = G.create(Date.now(), 922);
    accountFixture.sqlite.prepare('INSERT INTO school_saves(account_id,payload,revision,updated_at) VALUES(?,?,0,?)').run(login.data.profile.id, JSON.stringify(cloud), Date.now());
    const signedContext = await browser.newContext({ viewport: viewports[0], serviceWorkers: 'block', isMobile: true, hasTouch: true });
    await signedContext.addInitScript(({ origin, token, guest, key }) => {
      localStorage.setItem(`card-account:${origin}`, JSON.stringify({ token }));
      localStorage.setItem('school-save-mode', 'cloud'); localStorage.setItem(key, JSON.stringify(guest));
      localStorage.setItem('school-settings', JSON.stringify({ sound: false, motion: 'full' }));
      sessionStorage.setItem('school-landscape-ack', '1');
    }, { origin, token: login.data.token, guest, key: SAVE });
    const signed = await signedContext.newPage(); signed.on('pageerror', error => errors.push(error.message));
    await signed.goto(origin + '/school.html'); await ready(signed);
    await signed.waitForFunction(() => document.querySelector('#account-label').textContent === '계정 저장');
    assert.equal(await signed.locator('#app').getAttribute('data-tab'), 'lobby');
    assert.deepEqual(await signed.locator('#lobby-party .lobby-unit[data-hero]').evaluateAll(nodes => nodes.map(node => node.dataset.hero)), cloud.team);
    await signed.click('#lobby-party .lobby-unit[data-hero="osia"]'); await signed.click('#train-hero');
    await signed.waitForFunction(() => document.querySelector('#hero-level').textContent === '21');
    assert.equal(JSON.parse(accountFixture.sqlite.prepare('SELECT payload FROM school_saves WHERE account_id=?').get(login.data.profile.id).payload).units.osia.level, 21);
    await home(signed); await signed.click('#account-button'); await signed.click('#logout-account');
    await signed.waitForFunction(() => document.querySelector('#account-label').textContent === '게스트');
    await home(signed);
    assert.deepEqual(await signed.locator('#lobby-party .lobby-unit[data-hero]').evaluateAll(nodes => nodes.map(node => node.dataset.hero)), guest.team);
    assert(!await signed.evaluate(key => Object.hasOwn(JSON.parse(localStorage.getItem(key)).units, 'osia'), SAVE), 'Cloud characters must not leak into the separate guest save');
    assert(apiLog.some(call => call.path === '/api/school/action' && call.body?.action?.kind === 'train'), 'Lobby training must use the actual account action endpoint');
    await signedContext.close();
    console.log('PASS locally signed account lobby and server training; logout restores separate original guest party');

    assert.deepEqual(errors, [], 'No uncaught browser JavaScript errors');
    assert.deepEqual(badAssets, [], 'No missing local game assets');
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ results, errors, badAssets, account: { mode: 'Locally signed test identity and in-memory Worker SQLite', training: true, guestSeparation: true }, scope: 'Local Chromium, isolated guest/account fixtures, actual UI clicks; no live account writes' }, null, 2));
    console.log('PASS dynamic landscape height changes, no horizontal overflow, JavaScript errors or failed assets');
  } catch (error) {
    const lastPage = browser.contexts().flatMap(context => context.pages()).filter(page => !page.isClosed()).at(-1);
    if (lastPage) {
      await lastPage.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
      const diagnostic = await lastPage.evaluate(() => ({
        tab: document.querySelector('#app')?.dataset.tab,
        viewport: [innerWidth, innerHeight],
        scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
        modal: document.querySelector('#modal')?.open,
        title: document.querySelector('#modal-title')?.textContent,
        buttons: [...document.querySelectorAll('#lobby-panel button')].map(button => {
          const r = button.getBoundingClientRect();
          return { id: button.id, action: button.dataset.lobbyAction, hero: button.dataset.hero, x: r.x, y: r.y, width: r.width, height: r.height };
        }),
      })).catch(() => ({}));
      fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify({ error: error.message, diagnostic, errors, badAssets }, null, 2));
    }
    throw error;
  } finally {
    await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    accountFixture?.sqlite.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
