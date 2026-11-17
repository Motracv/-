// A 500ms simulation step and 250ms HUD timer need not share the same phase.
// Exercise the actual client with a deliberately late HUD phase, real local
// account Worker, delayed snapshots and a mobile-sized full-motion canvas.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const {chromium} = require('playwright');
const {fixture} = require('./account-fixture.cjs');
const G = require('../school/engine.js');
const ROOT = path.resolve(__dirname, '..');

async function main() {
  const t = await fixture(), errors = [];
  let origin, delayNextState = 0, delayedState = null;
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, origin);
      if (url.pathname.startsWith('/api/')) {
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        const body = Buffer.concat(chunks);
        const response = await t.worker.fetch(new Request(url, {method:req.method, headers:req.headers,
          ...(['GET', 'OPTIONS'].includes(req.method) ? {} : {body})}), t.env);
        const bytes = Buffer.from(await response.arrayBuffer());
        if (url.pathname === '/api/school/state' && delayNextState) {
          const ms = delayNextState; delayNextState = 0;
          delayedState = {computed:Date.now(), status:response.status, delay:ms};
          await new Promise(resolve => setTimeout(resolve, ms));
          delayedState.delivered = Date.now();
        }
        res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(bytes); return;
      }
      const file = path.resolve(ROOT, '.' + decodeURIComponent(url.pathname));
      if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
      let source = fs.readFileSync(file);
      if (file.endsWith('/school/client.js')) {
        if (process.env.SCHOOL_CLIENT_SOURCE) source = fs.readFileSync(process.env.SCHOOL_CLIENT_SOURCE);
        source = Buffer.from(source.toString().replace('https://motracv-card-room.densedormouse4.chatgpt.site', origin));
      }
      if (file.endsWith('/school/engine.js')) source = Buffer.from(source.toString() + `
        ;(()=>{const advance=SchoolRPG.advance;SchoolRPG.advance=function(state,now){const value=advance(state,now);window.motionPhase={now,at:state.at};return value;};})();`);
      if (file.endsWith('/school/art.js')) source = Buffer.from(source.toString() + `
        ;(()=>{const draw=SchoolArt.draw;window.motionFrames=[];SchoolArt.draw=function(ctx,state,time,effects,reduced){
          window.motionFrames.push({wall:performance.now(),visual:time,sim:state.simTime,elapsed:state.battle.elapsed,
            cutin:state.battle.cinematic?.remaining||0,speed:state.speed,reduced,gold:state.gold,gems:state.gems});
          return draw.call(this,ctx,state,time,effects,reduced);};})();`);
      const mime = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml', '.woff2':'font/woff2'};
      res.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream'}); res.end(source);
    } catch (error) { res.writeHead(500, {'Content-Type':'application/json'}); res.end(JSON.stringify({error:error.message})); }
  });
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`; t.env.ALLOWED_ORIGIN = origin;
    const login = await t.login('motion-clock-signed-fixture'); assert.equal(login.status, 200);
    const initial = G.create(Date.now() - 230, 942); initial.simTime = 12378500;
    for (const id of ['ian', 'osia', 'lava', 'harin', 'taeo', 'sua']) initial.units[id] = {level:60, stars:3, xp:0, shards:0};
    G.action(initial, {kind:'team', team:['ian', 'harin', 'osia', 'lava', 'taeo', 'sua']});
    initial.units.osia.nextSkill = 4;
    initial.battle.heroes.find(hero => hero.id === 'osia').energy = G.BY_ID.osia.cooldown - 1;
    for (const enemy of initial.battle.enemies) { enemy.hp = enemy.max = 1000000; enemy.atk = 0; }
    t.sqlite.prepare('INSERT INTO school_saves(account_id,payload,revision,updated_at) VALUES(?,?,0,?)').run(login.data.profile.id, JSON.stringify(initial), Date.now());
    browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless:true, args:['--no-sandbox']});
    const context = await browser.newContext({viewport:{width:755, height:330}, deviceScaleFactor:3, isMobile:true, hasTouch:true, serviceWorkers:'block', reducedMotion:'no-preference'});
    await context.addInitScript(({origin, token}) => {
      localStorage.setItem(`card-account:${origin}`, JSON.stringify({token})); localStorage.setItem('school-save-mode', 'cloud');
      localStorage.setItem('school-settings', JSON.stringify({motion:'full', sound:false})); sessionStorage.setItem('school-landscape-ack', '1');
      const interval = window.setInterval;
      window.setInterval = function(callback, ms, ...args) {
        if (ms !== 250 || !window.motionPhase) return interval(callback, ms, ...args);
        // Deliberately run the first HUD callback 230ms after the next engine
        // boundary, then preserve its real 250ms cadence. Rendering must not
        // depend on this timer firing precisely at the simulation boundary.
        const phase = window.motionPhase, wait = 500 - (phase.now - phase.at) % 500 + 230;
        window.motionTimerPhase = wait;
        return setTimeout(() => { callback(...args); interval(callback, ms, ...args); }, wait);
      };
    }, {origin, token:login.data.token});
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    const frames = () => page.evaluate(() => window.motionFrames);
    function assertSmooth(sample, label) {
      assert.ok(sample.length > 20, label + ': actual full-motion frames must be painted');
      let flatAt = null, maxFlat = 0, backwards = 0;
      for (let i = 1; i < sample.length; i++) {
        if (sample[i].visual < sample[i - 1].visual - .000001) backwards++;
        if (Math.abs(sample[i].visual - sample[i - 1].visual) < .000001) {
          flatAt ??= sample[i - 1].wall; maxFlat = Math.max(maxFlat, sample[i].wall - flatAt);
        } else flatAt = null;
      }
      console.log(JSON.stringify({label, frames:sample.length, maxClockPlateauMs:Math.round(maxFlat), backwards}));
      assert.equal(backwards, 0, label + ': delayed snapshots must not rewind animation time');
      assert.ok(maxFlat < 100, label + ': advancing canvas must not hold a fixed animation clock for 100ms');
      assert.ok(sample.every(frame => frame.reduced === false), 'Test must exercise full-motion user settings');
    }
    await page.goto(origin + '/school.html');
    await page.waitForFunction(() => document.querySelector('#account-label').textContent === '계정 저장' && window.motionFrames?.length > 2 && window.motionTimerPhase > 0);
    await page.waitForTimeout(4500);
    const normal = await frames(); assertSmooth(normal, '1x / shifted 250ms HUD timer');
    const cutin = normal.filter(frame => frame.cutin > 0);
    assert.ok(cutin.length > 1, 'Osia dragon cinematic must be exercised');
    assert.equal(new Set(cutin.map(frame => frame.elapsed)).size, 1, 'Combat elapsed time stays still during the cinematic');
    assert.ok(normal.at(-1).elapsed > cutin[0].elapsed, 'Combat resumes after the cinematic');
    console.log('PASS Osia cinematic freezes combat timers while the presentation clock remains smooth');

    await page.locator('[data-speed="1.5"]').click();
    await page.waitForFunction(() => document.querySelector('[data-speed="1.5"]').getAttribute('aria-pressed') === 'true' && !document.querySelector('[data-speed="1.5"]').disabled);
    const start = (await frames()).at(-1).wall;
    delayNextState = 1500;
    await page.waitForTimeout(5500);
    assert.equal(delayedState?.status, 200); assert.ok(delayedState.delivered, 'A stale snapshot must actually have been delivered');
    const fast = (await frames()).filter(frame => frame.wall >= start && frame.speed === 1.5);
    assertSmooth(fast, '1.5x / delayed authoritative snapshot');
    assert.ok(fast.every(frame => frame.gold === initial.gold && frame.gems === initial.gems), 'Presentation cannot invent spendable rewards');

    // Trigger the same lifecycle hooks as backgrounding without changing the
    // server clock or mutating the saved account. No foreground frame is allowed
    // to expose the old capped clock before catching up after the wake.
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', {configurable:true, value:true}); document.dispatchEvent(new Event('visibilitychange')); });
    const beforeWake = (await frames()).at(-1);
    await page.waitForTimeout(1200);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', {configurable:true, value:false}); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(700);
    const wake = (await frames()).filter(frame => frame.wall > beforeWake.wall);
    assertSmooth(wake, 'foreground resume');
    assert.ok(wake[0].sim >= beforeWake.sim + 1000, 'First resumed draw catches the simulation up before painting');
    assert.deepEqual(errors, []);
    console.log('PASS phased 1x/1.5x clocks, delayed snapshots, confirmed balances and foreground resume');
    await context.close();
  } finally {
    if (browser) await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); t.sqlite.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
