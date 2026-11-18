// Actual app controls, DedicatedWorker analysis, and locally signed SQLite accounts.
// This does not use production accounts or claim physical-device coverage.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const G = require('../school/engine.js');
const { fixture } = require('./account-fixture.cjs');
const ROOT=path.resolve(__dirname,'..'), SAVE='school-mercenaries-v8', OUT='/tmp/school-season1';
const NOW=Date.parse('2026-11-19T03:00:00Z');
const SIZES=[{width:755,height:330},{width:568,height:280},{width:2560,height:1440}];
function seed() {
  const s=G.create(NOW,819);s.gold=12345;s.gems=6789;s.best=20;
  s.team=['taeo','geonu','horas','osia','lava','ian'];
  for(const h of G.HEROES)s.units[h.id]={level:30,xp:0,stars:2,shards:0};
  G.action(s,{kind:'stage',stage:20,mode:'farm'},NOW);assert(G.validate(s));return s;
}
const finances=s=>({gold:s.gold,gems:s.gems,seed:s.seed,team:s.team,units:s.units,stage:s.stage,mode:s.mode});

(async()=>{
 fs.mkdirSync(OUT,{recursive:true});const t=await fixture(),errors=[],badAssets=[],apiLog=[],controls=new Map();
 let origin,serverTime=NOW,apiChain=Promise.resolve(),lastPage;
 const clock=fn=>(apiChain=apiChain.then(async()=>{const native=Date.now;Date.now=()=>serverTime;try{return await fn();}finally{Date.now=native;}}));
 const fetchAPI=request=>clock(()=>t.worker.fetch(request,t.env));
 async function api(who,route,data={}) {
   const response=await fetchAPI(new Request(origin+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(who?{'X-Account-Session':who.token}:{})},body:JSON.stringify({...(route.startsWith('/api/school/')?{catalogVersion:G.CATALOG_VERSION}:{}),...data})}));
   return{status:response.status,data:await response.json()};
 }
 const server=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,origin||'http://local');
   if(url.pathname.startsWith('/api/')){
    const chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks),payload=body.length?JSON.parse(body):{};
    const response=await fetchAPI(new Request(url,{method:req.method,headers:req.headers,...(['GET','OPTIONS'].includes(req.method)?{}:{body})}));
    const bytes=Buffer.from(await response.arrayBuffer()),record={path:url.pathname,request:payload,status:response.status,response:JSON.parse(bytes)};apiLog.push(record);
    const control=controls.get(req.headers['x-account-session']);
    if(control?.dropAttack&&payload.kind==='season_attack'){
      control.dropAttack=false;control.committed=record;res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Test response lost after commit'}));return;
    }
    if(control?.holdState&&payload.kind==='season_state'){control.holdState=false;control.held=record;await new Promise(r=>setTimeout(r,1000));}
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(bytes);return;
   }
   const file=path.resolve(ROOT,'.'+url.pathname);
   if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
   let body=fs.readFileSync(file);
   if(file.endsWith('/school/client.js'))body=Buffer.from(body.toString().replace('https://motracv-card-room.densedormouse4.chatgpt.site',origin));
   const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.json':'application/json'};
   res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
  }catch(e){res.writeHead(500);res.end(JSON.stringify({error:e.message}));}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}`;t.env.ALLOWED_ORIGIN=origin;
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const ready=p=>p.waitForFunction(()=>document.querySelector('#boot-screen').hidden&&window.SchoolRPG);
 const saved=p=>p.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
 const close=async p=>{if(await p.locator('#modal').evaluate(e=>e.open))await p.click('#modal-close');};
 const home=async p=>{await close(p);if(await p.locator('#app').getAttribute('data-tab')==='adventure')await p.click('#battle-back');else if(await p.locator('#app').getAttribute('data-tab')!=='lobby')await p.click('#home-button');};
 const readCloud=who=>JSON.parse(t.sqlite.prepare('SELECT payload FROM school_saves WHERE account_id=?').get(who.profile.id).payload);
 async function open(s,{account=null,viewport=SIZES[0],wall=NOW}={}) {
  const context=await browser.newContext({viewport,isMobile:viewport.width<1000,hasTouch:viewport.width<1000,deviceScaleFactor:1,serviceWorkers:'block',reducedMotion:'reduce'});
  if(!account)await context.route('**/api/**',r=>r.abort('blockedbyclient'));
  await context.addInitScript(({s,key,account,origin})=>{
   if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(s));
   localStorage.setItem('school-save-mode',account?'cloud':'guest');if(account)localStorage.setItem(`card-account:${origin}`,JSON.stringify({token:account.token}));
   localStorage.setItem('school-settings',JSON.stringify({theme:'light',sound:false,motion:'reduced'}));sessionStorage.setItem('school-landscape-ack','1');
   const Native=window.Worker;window.workerTrace={created:0,terminated:0,sent:[],received:[],errors:[]};
   window.Worker=class extends Native{constructor(...args){super(...args);workerTrace.created++;this.addEventListener('message',event=>workerTrace.received.push(event.data));this.addEventListener('error',event=>workerTrace.errors.push(event.message));}postMessage(data,...args){workerTrace.sent.push(data);return super.postMessage(data,...args);}terminate(){workerTrace.terminated++;return super.terminate();}};
  },{s,key:SAVE,account,origin});
  const p=await context.newPage();lastPage=p;p.setDefaultTimeout(15000);await p.clock.setFixedTime(new Date(wall));
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&/\.(js|css|webp|png|woff2)(\?|$)/.test(r.url()))badAssets.push(r.url());});
  await p.goto(origin+'/school.html');await ready(p);await p.evaluate(()=>document.fonts.ready);
  if(account)await p.waitForFunction(()=>document.querySelector('#account-label').textContent==='계정 저장');
  return{p,context};
 }
 async function within(p,selector) {const el=p.locator(selector).first();await el.scrollIntoViewIfNeeded();const r=await el.boundingBox(),v=p.viewportSize();assert(r&&r.x>=-1&&r.y>=-1&&r.x+r.width<=v.width+1&&r.y+r.height<=v.height+1,selector+JSON.stringify({r,v}));if(!await el.isDisabled())await el.click({trial:true});}
 async function presets(p) {lastPage=p;await close(p);if(await p.locator('#app').getAttribute('data-tab')!=='adventure'){await home(p);await p.click('#lobby-resume');}await p.click('#formation-button');await p.waitForSelector('[data-preset-save="0"]');}
 async function season(p) {lastPage=p;await home(p);await p.click('#arena-button');await p.click('button[data-arena-mode="season"]');await p.waitForSelector('#season-register');}
 async function createAccount(letter) {
   const challenge=await api(null,'/api/account/challenge');assert.equal(challenge.status,200);
   const credential=await clock(()=>t.credential(challenge.data.nonce,'season-browser-'+letter));
   const login=await api(null,'/api/account/google',{nonce:challenge.data.nonce,credential});assert.equal(login.status,200);const who=login.data;
   const s=seed();s.commanderName='시즌검증'+letter;
   t.sqlite.prepare('INSERT INTO school_saves(account_id,payload,revision,updated_at) VALUES(?,?,0,?)').run(who.profile.id,JSON.stringify(s),serverTime);
   const social=await api(who,'/api/school/social',{kind:'state'});assert.equal(social.status,200);assert.equal(social.data.me.canName,false);
   return who;
 }
 try {
  assert.equal(G.CATALOG_VERSION,15);
  if(process.env.SCHOOL_SEASON_ONLY!=='1'){
  const guest=await open(seed()),p=guest.p;
  assert(await p.locator('#lobby-patch-notes [data-patch-unread]').isVisible());
  await p.click('#lobby-patch-notes');assert(await p.locator('#patch-notes-list .patch-note').count()>0);
  for(const viewport of[SIZES[0],SIZES[2]]){await p.setViewportSize(viewport);await p.screenshot({path:path.join(OUT,`patch-notes-${viewport.width}x${viewport.height}.png`)});}await p.setViewportSize(SIZES[0]);
  const noteVersion=await p.evaluate(()=>SchoolPatchNotes.version);assert.equal(await p.evaluate(()=>localStorage.getItem('school-patch-read')),noteVersion);
  await close(p);await p.reload();await ready(p);assert(await p.locator('#lobby-patch-notes [data-patch-unread]').isHidden());
  await presets(p);const teamA=(await saved(p)).team;
  await p.click('[data-preset-save="0"]');await p.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).presets[0].team.length===6,SAVE);
  await close(p);await p.click('#party [data-hero="taeo"]');await p.click('[data-slot="1"]');
  await p.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).team[1]==='taeo',SAVE);await presets(p);
  const teamB=(await saved(p)).team;assert.notDeepEqual(teamA,teamB);
  for(const slot of[1,2]){await p.click(`[data-preset-save="${slot}"]`);await p.waitForFunction(({key,slot})=>JSON.parse(localStorage.getItem(key)).presets[slot].team.length===6,{key:SAVE,slot});}
  await p.fill('[data-preset-name="1"]','보스 전용');await p.locator('[data-preset-rename="1"]').focus();await p.keyboard.press('Enter');
  await p.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).presets[1].name==='보스 전용',SAVE);
  for(const viewport of SIZES){await p.setViewportSize(viewport);for(const slot of[0,1,2])for(const kind of['save','apply','delete','rename'])await within(p,`[data-preset-${kind}="${slot}"]`);await p.locator('#preset-current-team').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(OUT,`presets-${viewport.width}x${viewport.height}.png`)});}
  await p.setViewportSize(SIZES[0]);await p.click('[data-preset-apply="0"]');await p.waitForFunction(({key,team})=>JSON.stringify(JSON.parse(localStorage.getItem(key)).team)===JSON.stringify(team),{key:SAVE,team:teamA});
  await p.click('[data-preset-delete="1"]');await p.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).presets[1].team.length===0,SAVE);
  let s=await saved(p);assert.deepEqual(s.presets[0].team,teamA);assert.deepEqual(s.presets[2].team,teamB);assert.equal(s.presets[1].name,'보스 전용');
  await p.reload();await ready(p);assert.deepEqual((await saved(p)).presets,s.presets);
  console.log('PASS patch-notes read badge survives reload; three presets save/rename/keyboard/apply/delete/reload and fit three viewports');

  const dungeon=seed();dungeon.presets[0]={name:'원래 편성',team:[...dungeon.team]};dungeon.presets[1]={name:'바꿀 편성',team:[...dungeon.team].reverse()};G.action(dungeon,{kind:'activity',mode:'tower',floor:1},NOW);
  const locked=await open(dungeon);await presets(locked.p);assert(await locked.p.locator('[data-preset-apply="1"]').isDisabled());assert.match(await locked.p.locator('#preset-status').innerText(),/던전/);
  await locked.p.locator('[data-preset-apply="1"]').evaluate(el=>el.click());assert.deepEqual((await saved(locked.p)).team,dungeon.team);await locked.context.close();
  console.log('PASS active dungeon blocks changing the current party through saved presets');

  await home(p);await p.click('#lobby-resume');await p.click('#battle-map');
  const workerURL='**/school/farming-worker.js*';
  await guest.context.route(workerURL,route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(ROOT,'school/farming-worker.js'),'utf8')+'\nconst nativePost=self.postMessage.bind(self);self.postMessage=data=>setTimeout(()=>nativePost(data),700);'}));
  const previewBefore=finances(await saved(p));await p.click('[data-map-recommend]');await p.waitForFunction(()=>workerTrace.created>0);await close(p);await p.waitForTimeout(800);
  assert.equal(await p.locator('#modal').evaluate(el=>el.open),false);assert(await p.evaluate(()=>workerTrace.terminated>0));assert.deepEqual(finances(await saved(p)),previewBefore);
  await guest.context.unroute(workerURL);await p.click('#battle-map');await p.click('[data-map-recommend]');
  await p.waitForSelector('[data-farm-start]',{timeout:30000});const workerResult=await p.evaluate(()=>workerTrace.received.findLast(m=>m.kind==='result'));
  assert(workerResult);assert.equal(workerResult.fingerprint,G.farmingFingerprint(await saved(p)));assert.equal(workerResult.data.seconds,180);assert.equal(workerResult.data.seeds,3);
  assert.deepEqual(finances(await saved(p)),previewBefore);assert.deepEqual(await p.evaluate(()=>workerTrace.errors),[]);
  for(const viewport of SIZES){await p.setViewportSize(viewport);await within(p,'#farm-recommendations [data-farm-start]');await p.locator('#farm-preview-status').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(OUT,`farming-${viewport.width}x${viewport.height}.png`)});}
  await p.setViewportSize(SIZES[0]);const recommended=Number(await p.locator('[data-farm-start]').first().getAttribute('data-farm-start'));
  await p.locator('[data-farm-start]').first().click();await p.waitForFunction(({key,stage})=>JSON.parse(localStorage.getItem(key)).stage===stage&&JSON.parse(localStorage.getItem(key)).mode==='farm',{key:SAVE,stage:recommended});
  s=await saved(p);assert.equal(s.gold,previewBefore.gold);assert.equal(s.gems,previewBefore.gems);assert.deepEqual(s.team,previewBefore.team);await guest.context.close();
  console.log('PASS real background farming analysis preserves money/team/RNG, cancellation stops stale results, and confirmed button starts its recommended stage');

  const expiry=G.BANNERS.lava.expiresAt,deadlineSeed=seed();deadlineSeed.at=expiry-1000;
  const deadline=await open(deadlineSeed,{wall:expiry-1000});await deadline.p.click('#lobby-nav [data-lobby-action="recruit"]');
  await deadline.p.click('button[data-banner="lava"]');await deadline.p.waitForFunction(()=>document.querySelector('#banner-deadline').textContent.includes('남음'));
  for(const viewport of SIZES.slice(0,2)){await deadline.p.setViewportSize(viewport);await within(deadline.p,'#recruit-one');await within(deadline.p,'#recruit-ten');assert(await deadline.p.locator('#banner-deadline').isVisible());await deadline.p.screenshot({path:path.join(OUT,`lava-countdown-${viewport.width}x${viewport.height}.png`)});}
  assert(await deadline.p.locator('#recruit-one').isEnabled());await deadline.p.clock.setFixedTime(new Date(expiry+1));
  await deadline.p.waitForFunction(()=>document.querySelector('#recruit-one').disabled&&document.querySelector('#banner-deadline').textContent==='종료됨');
  for(const banner of['osia','horas']){await deadline.p.click(`button[data-banner="${banner}"]`);await deadline.p.waitForFunction(()=>document.querySelector('#banner-deadline').textContent==='상시');assert(await deadline.p.locator('#recruit-one').isEnabled());}
  assert.equal((await saved(deadline.p)).gems,deadlineSeed.gems);await home(deadline.p);await deadline.p.click('#winter-button');
  assert.match(await deadline.p.locator('#winter-event-deadline').innerText(),/종료일 미정/);assert.match(await deadline.p.locator('#winter-reset-countdown').innerText(),/갱신까지/);await deadline.context.close();
  console.log('PASS actual Lava expiry disables draws without charges; permanent banners and unspecified winter end never receive invented deadlines');
  }

  const people=[];for(const name of['A','B','C'])people.push(await createAccount(name));
  const sessions=[];for(const who of people)sessions.push(await open(seed(),{account:who}));
  const [a,b,c]=sessions.map(session=>session.p),[alice,bob,carol]=people;
  await presets(a);await a.click('[data-preset-save="0"]');await a.waitForFunction(()=>document.querySelector('[data-preset-slot="0"] .preset-state').textContent==='사용 중');
  assert.equal(readCloud(alice).presets[0].team.length,6);await presets(b);assert(readCloud(bob).presets.every(slot=>slot.team.length===0));await close(b);
  await season(a);await a.click('#season-register');await a.waitForFunction(()=>document.querySelector('#season-register').textContent.includes('갱신'));
  assert.equal(await a.locator('[data-season-attack]').count(),0);assert.match(await a.locator('#season-content').innerText(),/도전 가능한 단원이 없어요/);
  await a.screenshot({path:path.join(OUT,'season-empty-755x330.png')});
  for(const page of[b,c]){await season(page);await page.click('#season-register');await page.waitForFunction(()=>document.querySelector('#season-register').textContent.includes('갱신'));}
  await a.click('#season-refresh');await a.waitForSelector(`[data-season-attack="${bob.profile.id}"]`);
  const firstState=(await api(alice,'/api/school/social',{kind:'season_state'})).data;
  assert.equal(firstState.candidates.length,2);assert(firstState.candidates.every(x=>x.power===G.power(readCloud(alice))));
  const seasonId=firstState.season.id;
  for(const viewport of SIZES){await a.setViewportSize(viewport);await within(a,'#season-register');await within(a,'[data-season-attack]');await a.locator('#season-register').scrollIntoViewIfNeeded();await a.screenshot({path:path.join(OUT,`season-${viewport.width}x${viewport.height}.png`)});}
  await a.setViewportSize(SIZES[0]);
  const control={dropAttack:true};controls.set(alice.token,control);
  const countMatches=()=>t.sqlite.prepare('SELECT count(*) AS n FROM school_season_matches').get().n;
  const beforeBattle=[alice,bob,carol].map(who=>({gold:readCloud(who).gold,gems:readCloud(who).gems,team:readCloud(who).team}));
  await a.locator(`[data-season-attack="${bob.profile.id}"]`).evaluate(el=>{el.click();el.click();});await a.waitForSelector('#season-pending:not([hidden])');
  await a.waitForFunction(()=>!document.querySelector('#season-pending-retry').disabled);
  assert(control.committed&&control.committed.status===200);assert.equal(countMatches(),1);
  assert(await a.locator('[data-season-attack]').evaluateAll(nodes=>nodes.every(node=>node.disabled)));
  await within(a,'#season-pending-retry');await a.screenshot({path:path.join(OUT,'season-pending-755x330.png')});
  await a.click('#season-pending-retry');await a.waitForSelector('#arena-canvas');await a.click('#arena-skip');await a.waitForSelector('#arena-replay-result:not([hidden])');
  const resultA=await a.locator('#arena-replay-result').innerText(),firstMatch=control.committed.response.match;
  assert.equal(countMatches(),1);assert.match(resultA,/승리|패배|무승부/);assert.equal(firstMatch.mode,'season');
  assert(firstMatch.teams.every(team=>team.units.length===6));
  await a.screenshot({path:path.join(OUT,'season-replay-755x330.png')});
  const duplicate=await api(alice,'/api/school/social',control.committed.request);assert.equal(duplicate.status,200);assert.equal(duplicate.data.repeated,true);assert.equal(countMatches(),1);
  const already=await api(alice,'/api/school/social',{kind:'season_attack',seasonId,targetId:bob.profile.id,requestId:'same-target-twice-browser'});assert.equal(already.status,409);
  await b.click('[data-season-panel="history"]');await b.click('#season-refresh');await b.waitForSelector(`[data-season-match="${firstMatch.id}"]`);await b.click(`[data-season-match="${firstMatch.id}"]`);
  await b.waitForSelector('#arena-canvas');await b.click('#arena-skip');await b.waitForSelector('#arena-replay-result:not([hidden])');
  const resultB=await b.locator('#arena-replay-result').innerText();assert(resultA.includes('무승부')&&resultB.includes('무승부')||resultA.includes('승리')!==resultB.includes('승리'));
  const defender=await api(bob,'/api/school/social',{kind:'season_match',id:firstMatch.id});assert.equal(defender.status,200);assert.deepEqual(defender.data.match.events,firstMatch.events);assert.equal(defender.data.match.meSide,1);assert.equal(defender.data.match.ratingChange,0);
  assert.equal((await api(carol,'/api/school/social',{kind:'season_match',id:firstMatch.id})).status,404);
  console.log('PASS three isolated signed accounts: opt-in real defense/candidates, legitimate empty pool, loss-after-save retry/double-click once, persisted complementary replays and private match access');

  // Four additional server-owned defenders fill a genuine pool; no generated bots.
  for(const name of['D','E','F','G']){const who=await createAccount(name);people.push(who);assert.equal((await api(who,'/api/school/social',{kind:'season_register',seasonId})).status,200);}
  await a.click('#arena-back');await a.waitForSelector('#season-refresh');await a.click('#season-refresh');
  for(let attack=2;attack<=5;attack++){
    await a.waitForFunction(()=>[...document.querySelectorAll('[data-season-attack]')].some(el=>!el.disabled));
    await a.locator('[data-season-attack]:not(:disabled)').first().click();await a.waitForSelector('#arena-canvas');await a.click('#arena-skip');await a.waitForSelector('#arena-replay-result:not([hidden])');
    await a.click('#arena-back');await a.waitForSelector('#season-remaining');
    await a.waitForFunction(n=>document.querySelector('#season-remaining').textContent.trim()===`${n} / 5`,5-attack);
  }
  const capped=(await api(alice,'/api/school/social',{kind:'season_state'})).data;
  assert.equal(capped.me.usedToday,5);assert.equal(capped.me.attacks,5);assert.equal(capped.me.remainingToday,0);assert.equal(countMatches(),5);
  assert(await a.locator('[data-season-attack]').evaluateAll(nodes=>nodes.every(node=>node.disabled)));
  const sixth=await api(alice,'/api/school/social',{kind:'season_attack',seasonId,targetId:capped.candidates[0].id,requestId:'sixth-ranked-attempt-browser'});assert.equal(sixth.status,409);assert.equal(countMatches(),5);
  await a.click('[data-season-panel="ranking"]');assert.match(await a.locator('#season-content').innerText(),/시즌검증A/);await a.screenshot({path:path.join(OUT,'season-ranking.png')});
  await a.click('[data-season-panel="history"]');assert.equal(await a.locator('[data-season-match]').count(),5);
  for(let i=0;i<3;i++){const state=readCloud(people[i]);assert.equal(state.gold,beforeBattle[i].gold);assert.equal(state.gems,beforeBattle[i].gems);assert.deepEqual(state.team,beforeBattle[i].team);}
  const nextDay=capped.dayResetsAt+1;serverTime=nextDay;await a.click('#season-refresh');await a.waitForFunction(()=>document.querySelector('#season-remaining').textContent.trim()==='5 / 5');
  assert.equal((await api(alice,'/api/school/social',{kind:'season_state'})).data.me.attacks,5);
  console.log('PASS five actual daily attacks, same-opponent/sixth rejection, real ranking/history, untouched campaign resources and KST allowance reset');

  serverTime=firstState.season.endsAt+1;
  await a.click('#season-refresh');await a.waitForFunction(id=>document.querySelector('#season-name').textContent.includes(String(id)),seasonId+1);
  const rollover=(await api(alice,'/api/school/social',{kind:'season_state'})).data;
  assert.equal(rollover.season.id,seasonId+1);assert.equal(rollover.me.registered,false);assert.equal(rollover.me.rating,1000);assert.equal(rollover.awards.length,1);
  const award=rollover.awards[0];assert.equal(award.season,seasonId);assert.equal(award.rating,capped.me.rating);
  assert.equal((await api(alice,'/api/school/social',{kind:'season_register',seasonId})).status,409);
  await a.click('[data-season-panel="rewards"]');await a.click(`[data-season-equip="${award.id}"]`);
  await a.waitForFunction(title=>document.querySelector('#season-cosmetic').textContent.includes(title),award.title);
  assert.equal(await a.locator('#season-profile-art').getAttribute('data-frame'),award.tier);
  await a.screenshot({path:path.join(OUT,'season-award-equipped.png')});
  await a.reload();await ready(a);await a.waitForFunction(()=>document.querySelector('#account-label').textContent==='계정 저장');await season(a);
  assert.match(await a.locator('#season-cosmetic').innerText(),new RegExp(`시즌 ${seasonId}`));
  assert.equal((await api(alice,'/api/school/social',{kind:'season_state'})).data.awards.length,1);
  assert.equal(readCloud(alice).gold,beforeBattle[0].gold);assert.equal(readCloud(alice).gems,beforeBattle[0].gems);
  console.log('PASS season rollover after five matches awards one cosmetic only; real profile frame/title equip persists across reload and stale-season writes fail');

  control.holdState=true;await a.click('#season-refresh');await a.waitForTimeout(80);await close(a);await a.click('#account-button');await a.waitForSelector('#logout-account');await a.click('#logout-account');
  await a.waitForFunction(()=>document.querySelector('#account-label').textContent==='게스트');await a.waitForTimeout(1100);
  assert.equal(await a.locator('#season-content').count(),0);assert((await saved(a)).presets.every(slot=>slot.team.length===0));
  await presets(a);assert((await saved(a)).presets.every(slot=>slot.team.length===0));await close(a);
  for(const session of sessions)await session.context.close();
  console.log('PASS account-specific presets stay isolated; logout cancels late season responses and restores the guest save');
  assert.deepEqual(errors,[]);assert.deepEqual(badAssets,[]);
  fs.writeFileSync(path.join(OUT,'result.json'),JSON.stringify({catalog:G.CATALOG_VERSION,viewports:SIZES,errors,badAssets,rankedMatches:countMatches(),signedBrowserSessions:3,serverFixtureAccounts:people.length},null,2));
  console.log('Season1 browser passed; JavaScript/assets errors0');
 }catch(e){
  fs.writeFileSync(path.join(OUT,'failure-api.json'),JSON.stringify({errors,requests:apiLog.map(r=>({path:r.path,request:r.request,status:r.status,error:r.response.error,season:r.response.season,me:r.response.me}))},null,2));
  if(lastPage&&!lastPage.isClosed()){await lastPage.screenshot({path:path.join(OUT,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(OUT,'failure-dom.txt'),await lastPage.locator('body').innerText());}throw e;
 }
 finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));t.sqlite.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
