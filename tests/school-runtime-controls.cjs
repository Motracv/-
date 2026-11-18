// Real isolated Chromium UI checks with explicitly injected renderer failures.
// Mobile viewport emulation is not a physical Android/iOS device test.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const G = require('../school/engine.js');
const root = path.resolve(__dirname, '..');
const SAVE = 'school-mercenaries-v8';

(async () => {
  const server = http.createServer((req, res) => {
    try {
      const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
      if (!file.startsWith(root + path.sep)) throw Error('Outside fixture');
      const body = fs.readFileSync(file);
      res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2' })[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const results = [];
  try {
    for (const viewport of [{ width: 568, height: 280 }, { width: 844, height: 390 }]) {
      const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 2, serviceWorkers: 'block', reducedMotion: 'no-preference' });
      const seed = G.create(Date.now(), 714);
      seed.gold = 7654321; seed.gems = 8765432; seed.commanderName = '비공개진단테스트';
      seed.team = ['taeo', 'harin', 'sua'];
      G.action(seed, { kind: 'stage', stage: 1, mode: 'farm' }, Date.now());
      for (const hero of seed.battle.heroes) hero.hp = hero.max = 1e6;
      for (const enemy of seed.battle.enemies) { enemy.hp = enemy.max = 1e7; enemy.atk = 1; }
      await context.addInitScript(({ seed, key }) => {
        seed.at = Date.now();
        localStorage.setItem(key, JSON.stringify(seed));
        localStorage.setItem('school-save-mode', 'guest');
        localStorage.setItem('school-settings', JSON.stringify({ sound: false, motion: 'full', theme: 'light' }));
        sessionStorage.setItem('school-landscape-ack', '1');
      }, { seed, key: SAVE });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await page.goto(`http://127.0.0.1:${server.address().port}/school.html`);
        await page.waitForFunction(() => document.querySelector('#boot-screen').hidden);
        await page.click('#lobby-resume');
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => {
          const draw = SchoolArt.draw;
          window.runtimeQA = { draw, draws: 0, attempts: [], fault: null, beforeCanvas: document.querySelector('#battle') };
          SchoolArt.draw = function (...args) {
            const qa = window.runtimeQA;
            qa.attempts.push(performance.now());
            if (qa.fault === 'once') { qa.fault = null; throw Error('QA_RENDER_ONCE'); }
            if (qa.fault === 'persistent') throw Error('QA_RENDER_PERSISTENT');
            const result = draw.apply(this, args); qa.draws++; return result;
          };
          // Deliberate sentinels must not enter the diagnostic report. Set after
          // boot so they cannot trigger account authentication or alter gameplay.
          localStorage.setItem('card-account:https://motracv-card-room.densedormouse4.chatgpt.site', JSON.stringify({ token: 'PRIVATE_TOKEN_SENTINEL_714' }));
          sessionStorage.setItem('school-confirmed-cloud-view', JSON.stringify({ profile: { id: 'PRIVATE_PROFILE_ID_714', name: 'PRIVATE_PROFILE_NAME_714' } }));
        });
        await page.waitForFunction(() => runtimeQA.draws >= 5);
        const saved = () => page.evaluate(key => {
          const s = JSON.parse(localStorage.getItem(key));
          return { gold: s.gold, gems: s.gems, team: s.team, units: s.units, commanderName: s.commanderName };
        }, SAVE);
        const before = await saved();

        // Headless visibility is deliberately simulated. A suspended rAF must
        // not make foreground frame statistics include time in the background.
        await page.evaluate(() => {
          window.runtimeHidden = true;
          Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.runtimeHidden });
          document.dispatchEvent(new Event('visibilitychange'));
        });
        const backgroundDraws = await page.evaluate(() => runtimeQA.draws);
        await page.waitForTimeout(1200);
        assert.equal(await page.evaluate(() => runtimeQA.draws), backgroundDraws);
        await page.evaluate(() => {
          window.runtimeHidden = false;
          document.dispatchEvent(new Event('visibilitychange'));
          window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
          delete document.hidden;
        });
        await page.waitForFunction(draws => runtimeQA.draws >= draws + 5, backgroundDraws);
        await page.click('#battle-settings');
        await page.click('#settings-diagnostics');
        const resumedTiming = JSON.parse(await page.locator('#diagnostic-report').inputValue()).timing;
        assert(resumedTiming.samples > 0 && resumedTiming.samples <= 300);
        assert(Number.isFinite(resumedTiming.fps));
        assert(resumedTiming.maxFrameGap < 1000, `Foreground diagnostics must exclude the 1200ms simulated background gap: ${resumedTiming.maxFrameGap}`);
        await page.click('#modal-close');

        await page.click('#battle-settings');
        const manualDraws = await page.evaluate(() => runtimeQA.draws);
        await page.click('#settings-recover');
        await page.waitForFunction(draws => runtimeQA.draws >= draws + 5, manualDraws);
        assert(await page.evaluate(() => runtimeQA.beforeCanvas !== document.querySelector('#battle')), 'Settings recovery replaces the canvas');
        assert.equal(await page.locator('#modal').evaluate(x => x.open), false);
        assert.deepEqual(await saved(), before, 'Manual renderer recovery preserves saved currency, team and units');

        // Deliberately stop only the renderer's scheduled callback. Recovery
        // must create a fresh single loop even when no old loop is running.
        await page.evaluate(() => {
          const qa = runtimeQA;
          qa.realRAF = requestAnimationFrame.bind(window); qa.realCancelRAF = cancelAnimationFrame.bind(window); qa.pendingFrames = new Set();
          window.requestAnimationFrame = callback => {
            if (callback.name !== 'animate') return qa.realRAF(callback);
            const id = qa.realRAF(time => { qa.pendingFrames.delete(id); callback(time); });
            qa.pendingFrames.add(id); return id;
          };
          window.cancelAnimationFrame = id => { qa.pendingFrames.delete(id); qa.realCancelRAF(id); };
        });
        await page.waitForFunction(() => runtimeQA.pendingFrames.size > 0);
        const stoppedDraws = await page.evaluate(() => {
          for (const id of runtimeQA.pendingFrames) cancelAnimationFrame(id);
          return runtimeQA.draws;
        });
        await page.waitForTimeout(180);
        assert.equal(await page.evaluate(() => runtimeQA.draws), stoppedDraws, 'The injected renderer stop really paused drawing');
        await page.evaluate(() => {
          runtimeQA.beforeCanvas = document.querySelector('#battle');
          runtimeQA.realReset = SchoolArt.resetRenderCache;
          SchoolArt.resetRenderCache = function (...args) {
            SchoolArt.resetRenderCache = runtimeQA.realReset;
            throw Error('QA_CACHE_RESET_ONCE');
          };
        });
        await page.click('#battle-settings');
        await page.click('#settings-recover');
        await page.waitForFunction(draws => runtimeQA.draws >= draws + 5, stoppedDraws);
        assert(await page.evaluate(() => runtimeQA.beforeCanvas !== document.querySelector('#battle')));
        assert.equal(await page.evaluate(() => runtimeQA.pendingFrames.size), 1, 'Recovery restarts exactly one renderer loop');
        await page.evaluate(() => {
          window.requestAnimationFrame = runtimeQA.realRAF;
          window.cancelAnimationFrame = runtimeQA.realCancelRAF;
        });
        await page.click('#battle-settings');
        await page.click('#settings-diagnostics');
        const resetReport = JSON.parse(await page.locator('#diagnostic-report').inputValue());
        assert.match(resetReport.graphics.lastError, /QA_CACHE_RESET_ONCE/);
        assert(resetReport.graphics.failures >= 1, 'Transient render cache reset failure is recorded');
        assert.deepEqual(errors, [], 'A render cache reset failure must not escape to pageerror');
        await page.click('#modal-close');

        const oneDraws = await page.evaluate(() => {
          runtimeQA.beforeCanvas = document.querySelector('#battle'); runtimeQA.fault = 'once'; return runtimeQA.draws;
        });
        await page.waitForFunction(draws => runtimeQA.draws >= draws + 5 && runtimeQA.beforeCanvas !== document.querySelector('#battle'), oneDraws);
        assert(await page.locator('#battle-recovery').evaluate(x => x.hidden), 'Single failure recovers and dismisses its notice');

        const faultStart = await page.evaluate(() => {
          runtimeQA.attempts = []; runtimeQA.beforeCanvas = document.querySelector('#battle'); runtimeQA.fault = 'persistent'; return performance.now();
        });
        await page.waitForFunction(() => runtimeQA.attempts.length >= 4, null, { timeout: 8000 });
        const attempts = await page.evaluate(() => [...runtimeQA.attempts]);
        // The first failure may replace the canvas and immediately try it once.
        // Following failures must not spin at requestAnimationFrame frequency.
        for (let i = 2; i < attempts.length; i++) assert(attempts[i] - attempts[i - 1] >= 950, `Persistent retry throttled: ${attempts[i] - attempts[i - 1]}ms`);
        assert(attempts.length <= 2 + Math.ceil((attempts.at(-1) - faultStart) / 950));
        assert(await page.locator('#battle-recovery').isVisible());
        assert.match(await page.locator('#battle-recovery-message').textContent(), /오류|문제 정보/);

        await page.click('#battle-settings');
        assert(await page.locator('#settings-recover').isVisible(), 'Settings remain usable while drawing fails');
        await page.click('#settings-diagnostics');
        const json = await page.locator('#diagnostic-report').inputValue(), report = JSON.parse(json);
        assert(report.version && report.version !== 'unknown');
        assert.equal(report.browser, await page.evaluate(() => navigator.userAgent));
        assert.deepEqual(report.viewport.slice(0, 2), [viewport.width, viewport.height]);
        assert(report.graphics.frames >= 15);
        assert(report.graphics.failures >= 5);
        assert(report.graphics.recoveries >= 3);
        assert.match(report.graphics.lastError, /QA_RENDER_PERSISTENT/);
        assert.deepEqual(Object.keys(report.account).sort(), ['busy', 'connected', 'mode', 'pending']);
        for (const sentinel of ['PRIVATE_TOKEN_SENTINEL_714', 'PRIVATE_PROFILE_ID_714', 'PRIVATE_PROFILE_NAME_714', '비공개진단테스트', '7654321', '8765432']) assert(!json.includes(sentinel), `Diagnostics exclude ${sentinel}`);
        const keys = value => value && typeof value === 'object' ? Object.entries(value).flatMap(([key, child]) => [key, ...keys(child)]) : [];
        assert(!keys(report).some(key => ['token', 'profile', 'gold', 'gems', 'units', 'team', 'commanderName'].includes(key)));

        await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(Error('Clipboard denied by test')) } }));
        await page.click('#copy-diagnostics');
        await page.waitForFunction(() => document.activeElement?.id === 'diagnostic-report' && document.querySelector('#toast').textContent.includes('길게'));
        assert(await page.locator('#diagnostic-report').evaluate(x => x.selectionStart === 0 && x.selectionEnd === x.value.length), 'Denied clipboard selects the report for manual copy');
        await page.screenshot({ path: `/tmp/school-runtime-diagnostics-${viewport.width}x${viewport.height}.png` });

        await page.click('#modal-close');
        const finalDraws = await page.evaluate(() => { runtimeQA.fault = null; runtimeQA.beforeCanvas = document.querySelector('#battle'); return runtimeQA.draws; });
        await page.click('#recover-battle');
        await page.waitForFunction(draws => runtimeQA.draws >= draws + 5 && runtimeQA.beforeCanvas !== document.querySelector('#battle'), finalDraws);
        assert(await page.locator('#battle-recovery').evaluate(x => x.hidden));
        assert.deepEqual(await saved(), before, 'Exception handling and diagnostic UI preserve guest save');
        assert.deepEqual(errors, [], 'No uncaught browser errors');
        results.push({ viewport, resumedTiming, attempts: attempts.length, minimumRetryMs: Math.min(...attempts.slice(2).map((time, i) => time - attempts[i + 1])), cacheResetError: resetReport.graphics.lastError, graphics: report.graphics });
        console.log(`PASS ${viewport.width}×${viewport.height}: background timing exclusion, stopped-loop restart, cache-reset/one-draw recovery, throttled persistent errors, usable menu, private diagnostics and clipboard fallback; guest save preserved`);
      } finally { await context.close(); }
    }
    fs.writeFileSync('/tmp/school-runtime-controls.json', JSON.stringify({ environment: 'Headless Chromium mobile viewport emulation; explicitly injected renderer failures, not physical phone testing', results }, null, 2));
  } finally {
    await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
