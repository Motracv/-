// Real Chromium documents + SQLite Worker + locally signed Google fixture.
// This checks app flows, not a physical phone/Windows or personal Google login.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const {fixture} = require('./account-fixture.cjs');
const {installGuestSeed, seedGuest} = require('./school-ui-regressions.cjs');
const G = require('../school/engine.js');
const ROOT = path.resolve(__dirname, '..'), SAVE = 'school-mercenaries-v8';

(async () => {
  const t = await fixture(), errors = [], contexts = [];
  let origin, clients = 0, accountSDK = 0;
  const apiLog = [];
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, origin);
      if (url.pathname.startsWith('/api/')) {
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        const body = Buffer.concat(chunks);
        apiLog.push({path:url.pathname, ...(body.length ? {body:JSON.parse(body)} : {})});
        const response = await t.worker.fetch(new Request(url, {method:req.method, headers:req.headers,
          ...(['GET','OPTIONS'].includes(req.method) ? {} : {body})}), t.env);
        res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer())); return;
      }
      const file = path.resolve(ROOT, '.' + decodeURIComponent(url.pathname));
      if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {res.writeHead(404);res.end();return;}
      let body = fs.readFileSync(file);
      if (file.endsWith('/school/client.js')) body = Buffer.from(body.toString().replace('https://motracv-card-room.densedormouse4.chatgpt.site', origin));
      const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
      res.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream'}); res.end(body);
    } catch (error) {res.writeHead(500);res.end(JSON.stringify({error:error.message}));}
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`; t.env.ALLOWED_ORIGIN = origin;
  const browser = await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});

  async function pageFor(person, options = {}) {
    const context = await browser.newContext({viewport:options.viewport || {width:1280,height:800}, serviceWorkers:'block', reducedMotion:'reduce',
      extraHTTPHeaders:{'CF-Connecting-IP':`198.51.100.${++clients}`}, ...(options.storageState ? {storageState:options.storageState} : {})});
    contexts.push(context); await installGuestSeed(context);
    await context.addInitScript(() => sessionStorage.setItem('school-landscape-ack','1'));
    await context.exposeBinding('fixtureCredential', (_, nonce) => t.credential(nonce, person));
    await context.route('https://accounts.google.com/gsi/client', route => {
      accountSDK++;
      return route.fulfill({contentType:'text/javascript',body:`window.google={accounts:{id:{initialize(o){this.o=o},renderButton(host){const b=document.createElement('button');b.id='fixture-login';b.textContent='Google로 로그인 (검증용)';b.onclick=async()=>this.o.callback({credential:await window.fixtureCredential(this.o.nonce)});host.append(b)},disableAutoSelect(){}}}}`});
    });
    const p = await context.newPage(); p.on('pageerror', e => errors.push(e.message));
    await p.goto(origin + '/school.html');
    await p.waitForFunction(() => document.getElementById('boot-screen').hidden);
    return p;
  }
  const saved = p => p.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE);
  const close = async p => {if (await p.locator('#modal').evaluate(el=>el.open)) await p.click('#modal-close');};
  const accountId = p => p.evaluate(() => JSON.parse(sessionStorage.getItem('school-confirmed-cloud-view')).profile.id);
  const cloudState = id => JSON.parse(t.sqlite.prepare('SELECT payload FROM school_saves WHERE account_id=?').get(id).payload);
  async function login(p) {await p.click('#account-button');await p.click('#fixture-login');await p.waitForFunction(()=>document.getElementById('account-label').textContent==='계정 저장');}
  async function name(p, value) {await close(p);await p.click('#captain-button');await p.fill('#commander-name',value);await p.click('#save-commander-name');await p.waitForFunction(value=>document.getElementById('commander-display-name')?.textContent===value,value);await close(p);}
  function frozen(gold = 100000) {const s=G.create(Date.now()+60000,913);s.gold=gold;return s;}

  try {
    if (process.env.SCHOOL_WINTER_SESSION_ONLY === '1') {
      const a=await pageFor('winter-session-only');await login(a);const aid=await accountId(a);
      const persistent=await a.context().storageState(),sdkBefore=accountSDK;await a.context().close();
      const restored=await pageFor('winter-session-only',{storageState:persistent});await restored.waitForFunction(()=>document.getElementById('account-label').textContent==='계정 저장');
      assert.equal(await accountId(restored),aid);assert.equal(accountSDK,sdkBefore);
      await restored.click('#account-button');await restored.click('#logout-account');await restored.waitForFunction(()=>document.getElementById('account-label').textContent==='게스트');
      await restored.reload();await restored.waitForFunction(()=>document.getElementById('boot-screen').hidden);assert.equal(await restored.locator('#account-label').textContent(),'게스트');
      assert.equal(await restored.evaluate(origin=>localStorage.getItem(`card-account:${origin}`),origin),null);
      assert.deepEqual(errors,[]);
      console.log('PASS fresh context with only persistent localStorage restores verified account without SDK; logout stays logged out after reload');return;
    }
    if (process.env.SCHOOL_WINTER_SOCIAL_ONLY !== '1') {
      const p = await pageFor('winter-training');
      await seedGuest(p, frozen());
      await p.click('#party [data-hero="harin"]');
      const button = p.locator('#train-hero'), box = await button.boundingBox();
      await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();await p.waitForTimeout(1250);await p.mouse.up();
      await p.waitForTimeout(350);const after = await saved(p);
      assert.ok(after.units.harin.level >= 4, 'Holding must train more than once');
      const cost = Array.from({length:after.units.harin.level-1}, (_,i)=>G.trainingCost({level:i+1})).reduce((a,b)=>a+b,0);
      assert.equal(after.gold, 100000-cost, 'Each actual level charges its precise current price');
      await p.waitForTimeout(650);assert.equal((await saved(p)).units.harin.level,after.units.harin.level,'Release stops all repetitions');
      assert.equal(await p.locator('#train-hero').count(),1);
      // Keyboard/single click stays a single paid action, with no delayed repeats.
      await p.locator('#train-hero').focus();await p.keyboard.press('Enter');await p.waitForTimeout(700);
      assert.equal((await saved(p)).units.harin.level,after.units.harin.level+1);
      await p.reload();assert.equal((await saved(p)).units.harin.level,after.units.harin.level+1);
      const limited=frozen(G.trainingCost({level:1})+G.trainingCost({level:2}));await seedGuest(p,limited);await p.click('#party [data-hero="harin"]');
      const limitedBox=await p.locator('#train-hero').boundingBox();await p.mouse.move(limitedBox.x+limitedBox.width/2,limitedBox.y+limitedBox.height/2);await p.mouse.down();await p.waitForTimeout(1200);await p.mouse.up();
      assert.equal((await saved(p)).units.harin.level,3);assert.equal((await saved(p)).gold,0);assert.ok(await p.locator('#train-hero').isDisabled());
      console.log('PASS long press repeats sequential paid levels; release/keyboard/reload and exact-funds stop preserve currency');

      await seedGuest(p, frozen());await p.click('#party [data-hero="harin"]');const blurBox=await p.locator('#train-hero').boundingBox();
      await p.mouse.move(blurBox.x+blurBox.width/2,blurBox.y+blurBox.height/2);await p.mouse.down();await p.waitForTimeout(550);await p.evaluate(()=>window.dispatchEvent(new Event('blur')));await p.waitForTimeout(300);const blurLevel=(await saved(p)).units.harin.level;await p.waitForTimeout(600);assert.equal((await saved(p)).units.harin.level,blurLevel);await p.mouse.up();await close(p);
      console.log('PASS focus loss stops held training without further spending');

      for (const viewport of [{width:568,height:280},{width:844,height:390},{width:1280,height:800},{width:2560,height:1440}]) {
        await p.setViewportSize(viewport);await p.waitForTimeout(100);
        const metrics=await p.evaluate(()=>{const b=document.getElementById('battle').getBoundingClientRect(),header=document.querySelector('.topbar').getBoundingClientRect();return{w:innerWidth,h:innerHeight,scrollW:document.documentElement.scrollWidth,scrollH:document.documentElement.scrollHeight,battle:{width:b.width,height:b.height,top:b.top,bottom:b.bottom},headerH:header.height,nav:[...document.querySelectorAll('.bottom-nav button')].map(n=>{const r=n.getBoundingClientRect();return{top:r.top,bottom:r.bottom}})};});
        assert.ok(metrics.scrollW<=metrics.w+1&&metrics.scrollH<=metrics.h+1,JSON.stringify(metrics));
        assert.ok(metrics.battle.height>100&&metrics.battle.bottom<=metrics.h+1,JSON.stringify(metrics));
        assert.ok(metrics.nav.every(n=>n.top>=0&&n.bottom<=metrics.h+1),JSON.stringify(metrics));
        if(viewport.width===568||viewport.width===2560)await p.screenshot({path:`/tmp/school-winter-${viewport.width}.png`});
      }
      await p.setViewportSize({width:844,height:390});await p.click('#settings-button');await p.check('#setting-theme');await close(p);
      await p.click('.bottom-nav [data-tab="recruit"]');
      const rarityColors=await p.evaluate(()=>{const host=document.createElement('div');host.innerHTML='<span class="rarity SR">SR</span><span class="rarity SSR">SSR</span>';document.body.append(host);const colors=[...host.children].map(n=>({color:getComputedStyle(n).color,bg:getComputedStyle(n).backgroundColor}));host.remove();return colors;});
      assert.notDeepEqual(rarityColors[0],rarityColors[1],'Dark theme must preserve grade color distinction');
      await p.screenshot({path:'/tmp/school-winter-dark.png'});
      await p.click('.bottom-nav [data-tab="adventure"]');assert.ok(await p.locator('#fullscreen-button').isVisible());
      console.log('PASS compact mobile/QHD layout has no clipped navigation or vertical overflow; dark mode keeps rarity colors distinct');

      // Seed actual battle metrics then inspect the user-facing damage entry.
      const combat=frozen();combat.at=Date.now();for(const enemy of combat.battle.enemies){enemy.hp=enemy.max=100000;enemy.atk=1;}G.advance(combat,combat.at+5000);combat.at=Date.now()+60000;
      await seedGuest(p,combat);await p.click('#log-button');
      assert.match(await p.locator('#modal-content').innerText(),/피해|딜량|기여/);assert.doesNotMatch(await p.locator('#modal-title').innerText(),/모험 기록/);await close(p);
      console.log('PASS battle entry opens damage contribution instead of prose adventure log');

      const art=await p.evaluate(()=>{
        const shot=(id,t)=>{const canvas=document.createElement('canvas');canvas.width=248;canvas.height=344;SchoolArt.recruitPortrait(canvas.getContext('2d'),id,t,false);return canvas.toDataURL();};
        const portraits=['osia','lava'].map(id=>({id,frames:[shot(id,0),shot(id,.55)]}));
        const s=SchoolRPG.create(Date.now(),913);for(const enemy of s.battle.enemies){enemy.hp=enemy.max=100000;enemy.atk=1;}SchoolRPG.advance(s,s.at+12000);
        const event=s.events.findLast(e=>e.critical);if(!event)throw Error('Seeded combat did not crit');
        const draw=(events,time,labels=[])=>{const canvas=document.createElement('canvas');canvas.width=960;canvas.height=560;const c=canvas.getContext('2d'),fill=c.fillText;c.fillText=function(value,...args){labels.push(String(value));return fill.call(this,value,...args)};SchoolArt.draw(c,s,time,events,false);return canvas.toDataURL();};
        const effects=[{...event,time:event.simAt/1000}],critical=draw(effects,event.simAt/1000+.09),normal=draw(effects.map(e=>({...e,critical:false})),event.simAt/1000+.09);
        s.battle.phase='defeat';s.battle.boss=true;s.battle.wait=5;const labels=[];draw([],15,labels);
        return{portraits,criticalDifferent:critical!==normal,defeat:labels.some(text=>text.includes('패배'))};
      });
      assert.ok(art.portraits.every(hero=>hero.frames[0]!==hero.frames[1]),'Featured frontal recruit portraits must have visible animated poses');
      assert.ok(art.criticalDifferent,'An actual engine critical must have visibly distinct impact/icon pixels');assert.ok(art.defeat,'Lost boss battle must render an explicit defeat message');
      console.log('PASS Osia/Lava recruit frames move, real engine critical changes impact pixels, and boss defeat has explicit canvas text');

      const winter=frozen();winter.winter={...winter.winter,snowflakes:100,earned:100,exchanges:{gold:0,gems:0}};await seedGuest(p,winter);await p.click('#winter-button');await p.waitForSelector('#winter-balance');const before=await saved(p);
      await p.click('[data-winter-item="gold"]');await p.waitForFunction(gold=>JSON.parse(localStorage.getItem('school-mercenaries-v8')).gold>gold,before.gold);
      const exchanged=await saved(p);assert.ok(exchanged.winter.snowflakes<before.winter.snowflakes);assert.ok(exchanged.winter.exchanges.gold>0);await p.reload();assert.equal((await saved(p)).winter.snowflakes,exchanged.winter.snowflakes);assert.equal((await saved(p)).gold,exchanged.gold);
      console.log('PASS winter currency exchange deducts snowflakes, increases capped purchase count and persists reward');
    }

    if (process.env.SCHOOL_WINTER_UI_ONLY !== '1') {
      const a=await pageFor('winter-social-A'), b=await pageFor('winter-social-B');await login(a);await login(b);
      await name(a,'겨울검증A');await name(b,'겨울검증B');
      const aid=await accountId(a),bid=await accountId(b);assert.notEqual(aid,bid);
      // Test-only DB seeding creates owned six-person parties. The clients still
      // submit only invitations; the server must derive both teams from saves.
      for(const id of [aid,bid]) {
        const s=cloudState(id),team=['taeo','harin','sua','osia','lava','ian'];
        for(const hero of team)s.units[hero]={level:20,xp:0,stars:1,shards:0,nextSkill:1};
        G.action(s,{kind:'team',team},Date.now());s.at=Date.now()+60000;
        t.sqlite.prepare('UPDATE school_saves SET payload=?, revision=revision+1 WHERE account_id=?').run(JSON.stringify(s),id);
      }
      await Promise.all([a.reload(),b.reload()]);
      await Promise.all([a,b].map(p=>p.waitForFunction(()=>document.getElementById('account-label').textContent==='계정 저장'&&document.querySelectorAll('#party [data-hero]').length===6)));
      await a.click('#friends-button');await a.fill('#social-friend-name','겨울검증B');await a.click('#social-add-friend button[type="submit"]');
      await b.click('#friends-button');await b.waitForSelector('[data-social-action="friend_accept"]');await b.click('[data-social-action="friend_accept"]');
      await b.waitForSelector('[data-social-action="arena_invite"]');
      await close(a);await a.click('#friends-button');await a.waitForSelector('[data-social-action="arena_invite"]');
      await a.click('[data-social-action="arena_invite"]');await close(b);await b.click('#arena-button');await b.waitForSelector('[data-social-action="arena_accept"]');
      await b.click('[data-social-action="arena_accept"]');await b.waitForSelector('#arena-canvas');
      await b.screenshot({path:'/tmp/school-winter-arena.png'});
      await b.click('#arena-skip');await b.waitForSelector('#arena-replay-result');
      const bResult=await b.locator('#arena-replay-result').innerText();assert.match(bResult,/승리|패배|무승부/);
      // Polling may already open the inviter's replay automatically. Both that
      // path and the persisted match-history entry must reach the same record.
      await close(a);await a.click('#arena-button');await a.waitForFunction(()=>document.getElementById('arena-canvas')||document.querySelector('[data-social-action="arena_match"]'));
      if(!await a.locator('#arena-canvas').count())await a.locator('[data-social-action="arena_match"]').first().click();
      await a.waitForSelector('#arena-canvas');await a.click('#arena-skip');await a.waitForSelector('#arena-replay-result');
      const aResult=await a.locator('#arena-replay-result').innerText();assert.match(aResult,/승리|패배|무승부/);
      assert.ok(aResult.includes('무승부')&&bResult.includes('무승부') || aResult.includes('승리')!==bResult.includes('승리'),'Participants must see complementary authoritative outcomes');
      assert.ok(await a.locator('#arena-damage-report').isVisible());assert.ok(await b.locator('#arena-damage-report').isVisible());
      await a.click('#arena-damage-report');await a.waitForSelector('#arena-damage-content:not([hidden])');
      assert.match(await a.locator('#arena-damage-content').innerText(),/오시아/);assert.match(await a.locator('#arena-damage-content').innerText(),/라바/);
      const recorded=JSON.parse(t.sqlite.prepare("SELECT payload FROM school_arena WHERE status='done'").get().payload);
      assert.deepEqual(recorded.teams.map(team=>team.units.length),[6,6]);assert.deepEqual(recorded.damage.map(team=>team.length),[6,6]);
      assert.ok(apiLog.some(r=>r.path==='/api/school/social'&&r.body?.kind==='arena_accept'));
      assert.ok(apiLog.filter(r=>r.path==='/api/school/social').every(r=>!('winner'in(r.body||{}))&&!('damage'in(r.body||{}))));
      console.log('PASS two signed accounts in isolated Chromium sessions: unique name → friend request/accept → six-versus-six arena invite/accept → matching authoritative replay/outcomes and damage report');

      await close(a);const persistent=await a.context().storageState(),sdkBefore=accountSDK;await a.context().close();
      const restored=await pageFor('winter-social-A',{storageState:persistent});await restored.waitForFunction(()=>document.getElementById('account-label').textContent==='계정 저장');
      assert.equal(await accountId(restored),aid);assert.equal(accountSDK,sdkBefore,'Restoring a valid login must not load Google SDK or request user sign-in');
      assert.equal(cloudState(aid).commanderName,'겨울검증A');
      await restored.click('#account-button');await restored.click('#logout-account');await restored.waitForFunction(()=>document.getElementById('account-label').textContent==='게스트');
      await restored.reload();await restored.waitForFunction(()=>document.getElementById('boot-screen').hidden);assert.equal(await restored.locator('#account-label').textContent(),'게스트');
      const persistentToken=await restored.evaluate(origin=>localStorage.getItem(`card-account:${origin}`),origin);assert.equal(persistentToken,null);
      console.log('PASS close/reopen with localStorage only restores signed account silently; explicit logout removes session and stays logged out');
    }
    assert.deepEqual(errors,[],'No browser JavaScript exceptions');
  } finally {
    for(const context of contexts)await context.close().catch(()=>{});
    await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));t.sqlite.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
