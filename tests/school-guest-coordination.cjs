// Real documents, shared origin and IndexedDB: no production account or API.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require('playwright');
const G = require('../school/engine.js');
const {installGuestSeed, seedGuest} = require('./school-ui-regressions.cjs');
const ROOT = path.resolve(__dirname, '..');
const SAVE = 'school-mercenaries-v8';
const frozen = (gold = 700) => { const state = G.create(Date.now() + 120000, 26); state.gold = gold; return state; };

async function main() {
  const server = http.createServer((req, res) => {
    try {
      const file = path.resolve(ROOT, '.' + new URL(req.url, 'http://localhost').pathname);
      if (!file.startsWith(ROOT + path.sep)) throw Error('outside root');
      res.setHeader('Content-Type', ({'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.woff2':'font/woff2'})[path.extname(file)] || 'application/octet-stream');
      res.end(fs.readFileSync(file));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({executablePath:'/usr/bin/chromium', headless:true, args:['--no-sandbox']});
  const errors = [];
  try {
    const context = await browser.newContext({viewport:{width:1280, height:800}, serviceWorkers:'block', reducedMotion:'reduce'});
    await installGuestSeed(context);
    await context.addInitScript(() => {
      sessionStorage.setItem('school-landscape-ack', '1');
      window.coordinationAborts = [];
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function(value, key) {
        const request = put.call(this, value, key);
        const rule = window.abortNextGuestCommit || sessionStorage.getItem('abort-next-guest-commit');
        if (this.name === 'locks' && key === 'guest' && rule) {
          const next = JSON.parse(value.raw);
          if (rule === 'any' || (rule === 'paid' && next.gold < 700)) {
            window.abortNextGuestCommit = null;
            sessionStorage.removeItem('abort-next-guest-commit');
            window.coordinationAborts.push({gold:next.gold, level:next.units.harin.level, mirrored:localStorage.getItem('school-mercenaries-v8') === value.raw});
            this.transaction.abort();
          }
        }
        return request;
      };
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const p = await context.newPage();
    p.on('pageerror', error => errors.push(error.message));
    await p.goto(origin + '/school.html');
    await p.waitForFunction(() => document.querySelector('#party [data-hero="harin"]'));
    const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('school-mercenaries-v8')));
    const canonical = page => page.evaluate(() => new Promise((resolve, reject) => {
      const open = indexedDB.open('school-save-coordination', 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result, tx = db.transaction('locks'), request = tx.objectStore('locks').get('guest');
        request.onsuccess = () => resolve(JSON.parse(request.result.raw));
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      };
    }));

    // Existing IDB data must not win over an explicitly imported legacy save.
    const legacy = frozen(1234); legacy.units.harin.level = 17;
    await seedGuest(p, legacy, 'school-mercenaries-v5');
    assert.equal((await saved(p)).gold, 1234);
    assert.equal((await canonical(p)).units.harin.level, 17);
    console.log('PASS explicit legacy import replaces an unrelated existing coordination head');

    await seedGuest(p, frozen());
    await p.click('#party [data-hero="harin"]');
    await p.evaluate(() => { window.abortNextGuestCommit = 'paid'; });
    await p.click('#train-hero');
    await p.waitForFunction(() => window.coordinationAborts.length === 1 && document.querySelector('#save-status').dataset.state === 'error');
    assert.equal((await saved(p)).gold, 700);
    assert.equal((await canonical(p)).units.harin.level, 1);
    assert.equal(await p.locator('#gold').textContent(), '700');
    assert.match(await p.locator('#hero-level').textContent(), /1/);
    assert.equal((await p.evaluate(() => window.coordinationAborts))[0].mirrored, true);
    await p.reload();
    await p.waitForFunction(() => document.querySelector('#party [data-hero="harin"]'));
    assert.equal((await saved(p)).gold, 700);
    assert.equal((await saved(p)).units.harin.level, 1);
    console.log('PASS abort after localStorage write charges nothing, publishes no level-up and survives reload');

    // A broken original is preserved, while rollback uses its validated backup.
    const backup = frozen(864); backup.units.harin.level = 12;
    await p.evaluate(() => sessionStorage.setItem('abort-next-guest-commit', 'any'));
    await seedGuest(p, '{broken-original', SAVE, {backup, corrupt:true});
    await p.waitForFunction(() => window.coordinationAborts.length === 1 && document.querySelector('#save-status').dataset.state === 'error');
    assert.equal((await saved(p)).gold, 864);
    assert.equal((await saved(p)).units.harin.level, 12);
    assert.equal(await p.evaluate(() => localStorage.getItem('school-mercenaries-v8-recovery')), '{broken-original');
    await p.reload();
    await p.waitForFunction(() => document.querySelector('#party [data-hero="harin"]'));
    assert.equal((await canonical(p)).gold, 864);
    assert.equal(await p.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('school-mercenaries-v8-journal:')).length), 0);
    console.log('PASS recovered-backup abort retains valid progress and the broken original; journals are cleared');

    // Native-lock and fallback pages must share one authoritative transaction.
    const q = await context.newPage();
    q.on('pageerror', error => errors.push(error.message));
    await q.addInitScript(() => Object.defineProperty(navigator, 'locks', {value:undefined}));
    for (let round = 0; round < 10; round++) {
      await seedGuest(p, frozen());
      await q.goto(origin + '/school.html');
      await q.waitForFunction(() => document.querySelector('#party [data-hero="harin"]'));
      await p.click('#party [data-hero="harin"]');
      await q.click('#party [data-hero="harin"]');
      await Promise.all([p.click('#train-hero'), q.click('#train-hero')]);
      await p.waitForFunction(() => JSON.parse(localStorage.getItem('school-mercenaries-v8')).units.harin.level === 3);
      assert.equal((await canonical(p)).gold, 542);
    }
    console.log('PASS 10 mixed Web Locks / IndexedDB-fallback simultaneous purchases preserve both actions');

    // An aborted tab's compensation must not roll back the other tab's purchase.
    for (let round = 0; round < 5; round++) {
      await seedGuest(p, frozen());
      await q.reload();
      await q.waitForFunction(() => document.querySelector('#party [data-hero="harin"]'));
      await p.click('#party [data-hero="harin"]');
      await q.click('#party [data-hero="harin"]');
      await p.evaluate(() => { window.abortNextGuestCommit = 'paid'; });
      await Promise.all([p.click('#train-hero'), q.click('#train-hero')]);
      await p.waitForFunction(() => window.coordinationAborts.length === 1 && JSON.parse(localStorage.getItem('school-mercenaries-v8')).units.harin.level === 2);
      assert.equal((await canonical(p)).gold, 632);
      assert.equal((await canonical(p)).units.harin.level, 2);
    }
    console.log('PASS 5 concurrent abort/commit pairs retain exactly the successful purchase');
    assert.deepEqual(errors, []);
    await context.close();
  } finally {
    await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
