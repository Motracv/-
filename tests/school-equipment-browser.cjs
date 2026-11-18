// Real app controls, real battle settlement and signed disposable SQLite accounts.
// RNG/time are controlled only inside the local server fixture; no production save
// or browser engine state is edited after a session has started.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const G = require('../school/engine.js');
const { fixture } = require('./account-fixture.cjs');
const ROOT=path.resolve(__dirname,'..'), SAVE='school-mercenaries-v8', OUT='/tmp/school-equipment';
const NOW=Date.parse('2026-11-19T03:00:00Z');
// Captured with the unmodified catalog15 engine after a real daily victory.
const LEGACY_V15={"version":1,"at":1795057260000,"speed":1,"simCredit":0,"simTime":60000,"seed":3756620033,"seq":4,"events":[],"logs":[],"gold":14345,"gems":6869,"commanderName":"새내기 단장","nameChanges":0,"winter":{"id":"first-snow-2026","snowflakes":0,"earned":0,"exchanges":{"gold":0,"gems":0},"daily":{"day":20776,"exchanges":{"gold":0,"gems":0}}},"captain":{"level":1,"xp":0},"units":{"taeo":{"level":100,"xp":0,"stars":5,"shards":0},"harin":{"level":1,"xp":0,"stars":0,"shards":0},"sua":{"level":1,"xp":0,"stars":0,"shards":0},"geonu":{"level":100,"xp":0,"stars":5,"shards":0},"horas":{"level":100,"xp":0,"stars":5,"shards":0},"osia":{"level":100,"xp":0,"stars":5,"shards":0,"nextSkill":1},"lava":{"level":100,"xp":0,"stars":5,"shards":0,"nextSkill":1,"basicHits":0},"ian":{"level":100,"xp":0,"stars":5,"shards":0}},"team":["taeo","geonu","horas","osia","lava","ian"],"presets":[{"name":"이전 편성","team":["taeo","geonu","horas","osia","lava","ian"]},{"name":"보스","team":[]},{"name":"아레나","team":[]}],"stage":1,"wave":1,"best":20,"mode":"progress","kills":1,"pulls":0,"pity":0,"losses":0,"banners":{"osia":{"pity":0,"guaranteed":false},"lava":{"pity":12,"guaranteed":true},"horas":{"pity":79,"guaranteed":false}},"offline":{"seconds":0,"gold":0,"xp":0,"captainXp":0},"claimed":[],"daily":-1,"receipts":[],"history":[],"redeemedCodes":[],"quests":{"version":1,"repeat":{"kills":1,"waves":1,"bosses":0},"daily":{"day":20776,"kills":1,"waves":1,"bosses":0,"claimed":[]}},"activities":{"daily":{"period":20776,"used":1},"weekly":{"period":2968,"used":0},"towerBest":0,"run":{"id":2,"kind":"daily","settled":true,"tier":1,"period":20776},"lastResult":{"runId":2,"kind":"daily","tier":1,"won":true,"reason":"victory","firstClear":false,"reward":{"gold":2000,"gems":80,"xp":70},"refunded":false}},"battle":{"id":2,"runId":2,"stage":5,"wave":4,"boss":true,"activity":{"kind":"daily","tier":1},"phase":"victory","wait":0,"tick":1,"elapsed":1000,"buff":0,"lavaRescueUsed":false,"damage":{"taeo":{"damage":316,"healing":0,"taken":0,"criticals":1}},"synergies":{"counts":{"tank":2,"damage":3,"healer":1},"active":[{"id":"damage","name":"집중 공세","required":3,"description":"전사·사수·마법 3명 · 아군 전체 공격 피해 15% 증가","count":3}],"damageMultiplier":1.15,"healMultiplier":1,"incomingMultiplier":1},"heroes":[{"id":"taeo","hp":2702,"max":2702,"atk":534,"defense":0.28,"damageMultiplier":1.15,"healMultiplier":1,"critChance":0.12,"critMultiplier":1.5,"energy":1,"shield":0},{"id":"geonu","hp":2762,"max":2762,"atk":539,"defense":0.28,"damageMultiplier":1.15,"healMultiplier":1,"critChance":0.12,"critMultiplier":1.5,"energy":0,"shield":0},{"id":"horas","hp":2650,"max":2650,"atk":558,"defense":0.050000000000000044,"damageMultiplier":1.15,"healMultiplier":1,"critChance":0.12,"critMultiplier":1.5,"energy":0,"shield":0},{"id":"osia","hp":2664,"max":2664,"atk":555,"defense":0.050000000000000044,"damageMultiplier":1.15,"healMultiplier":1,"critChance":0.12,"critMultiplier":1.5,"energy":0,"shield":0},{"id":"lava","hp":2674,"max":2674,"atk":546,"defense":0.050000000000000044,"damageMultiplier":1.15,"healMultiplier":1,"critChance":0.12,"critMultiplier":1.5,"energy":0,"shield":0},{"id":"ian","hp":2697,"max":2697,"atk":553,"defense":0.050000000000000044,"damageMultiplier":1.15,"healMultiplier":1,"critChance":0.12,"critMultiplier":1.5,"energy":0,"shield":0}],"enemies":[{"id":"e0","kind":0,"name":"보급고의 수호자","hp":0,"max":316,"atk":17,"boss":true}],"horas":{"stacks":0,"nextBasicAt":2000,"basicPose":1,"lastHitStackAt":-1000,"lastCastAt":-3000}}};
const SIZES=[{width:755,height:330},{width:568,height:280},{width:2560,height:1440}];
function seed(now=NOW) {
  const s=G.create(now,819);s.gold=12345;s.gems=6789;s.best=20;
  s.team=['taeo','geonu','horas','osia','lava','ian'];
  for(const h of G.HEROES)s.units[h.id]={level:100,xp:0,stars:5,shards:0};
  G.action(s,{kind:'stage',stage:20,mode:'farm'},now);assert(G.validate(s));return s;
}
const finances=s=>({gold:s.gold,gems:s.gems,pity:s.pity,banners:s.banners,team:s.team,units:Object.fromEntries(Object.entries(s.units).map(([id,u])=>[id,{level:u.level,xp:u.xp,stars:u.stars,shards:u.shards}])),presets:s.presets});

(async()=>{
 fs.mkdirSync(OUT,{recursive:true});const t=await fixture(),errors=[],badAssets=[],apiLog=[],controls=new Map();
 let origin,serverTime=NOW,apiChain=Promise.resolve(),lastPage,forcedRandom=null;
 const clock=fn=>(apiChain=apiChain.then(async()=>{
   const native=Date.now,nativeRandom=crypto.getRandomValues;Date.now=()=>serverTime;
   crypto.getRandomValues=function(array){if(forcedRandom!==null&&array instanceof Uint32Array&&array.length===1){array[0]=Math.floor(forcedRandom*4294967296);return array;}return nativeRandom.call(crypto,array);};
   try{return await fn();}finally{Date.now=native;crypto.getRandomValues=nativeRandom;}
 }));
 const fetchAPI=request=>clock(()=>t.worker.fetch(request,t.env));
 async function api(who,route,data={}) {
   const response=await fetchAPI(new Request(origin+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(who?{'X-Account-Session':who.token}:{})},body:JSON.stringify({...(route.startsWith('/api/school/')?{catalogVersion:G.CATALOG_VERSION}:{}),...data})}));
   return{status:response.status,data:await response.json()};
 }
 const server=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,origin||'http://local');
   if(url.pathname.startsWith('/api/')){
    const chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks),payload=body.length?JSON.parse(body):{},control=controls.get(req.headers['x-account-session']);
    if(control?.blockState&&url.pathname==='/api/school/state'){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Test confirmation pending'}));return;}
    const response=await fetchAPI(new Request(url,{method:req.method,headers:req.headers,...(['GET','OPTIONS'].includes(req.method)?{}:{body})}));
    const bytes=Buffer.from(await response.arrayBuffer()),record={path:url.pathname,request:payload,status:response.status,response:JSON.parse(bytes)};apiLog.push(record);
    if(control?.dropAction&&url.pathname==='/api/school/action'){
      control.dropAction=false;control.committed=record;res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Test response lost after commit'}));return;
    }
    if(control?.holdAction&&url.pathname==='/api/school/action'){control.holdAction=false;control.committed=record;await new Promise(r=>setTimeout(r,800));}
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
 const confirmed=p=>p.evaluate(()=>JSON.parse(sessionStorage.getItem('school-confirmed-cloud-view')).state);
 const close=async p=>{if(await p.locator('#modal').evaluate(e=>e.open))await p.click('#modal-close');};
 const home=async p=>{lastPage=p;await close(p);if(await p.locator('#app').getAttribute('data-tab')==='adventure')await p.click('#battle-back');else if(await p.locator('#app').getAttribute('data-tab')!=='lobby')await p.click('#home-button');};
 const readCloud=who=>JSON.parse(t.sqlite.prepare('SELECT payload FROM school_saves WHERE account_id=?').get(who.profile.id).payload);
 async function open(s,{account=null,viewport=SIZES[0],wall=serverTime,motion='reduced'}={}) {
  const context=await browser.newContext({viewport,isMobile:viewport.width<1000,hasTouch:viewport.width<1000,deviceScaleFactor:1,serviceWorkers:'block',reducedMotion:motion==='reduced'?'reduce':'no-preference'});
  if(!account)await context.route('**/api/**',r=>r.abort('blockedbyclient'));
  await context.addInitScript(({s,key,account,origin,motion})=>{
   if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(s));
   localStorage.setItem('school-save-mode',account?'cloud':'guest');if(account)localStorage.setItem(`card-account:${origin}`,JSON.stringify({token:account.token}));
   localStorage.setItem('school-settings',JSON.stringify({theme:'light',sound:false,motion}));sessionStorage.setItem('school-landscape-ack','1');
   const Native=window.Worker;window.workerTrace={created:0,terminated:0,sent:[],received:[],errors:[]};
   window.Worker=class extends Native{constructor(...args){super(...args);workerTrace.created++;this.addEventListener('message',event=>workerTrace.received.push(event.data));this.addEventListener('error',event=>workerTrace.errors.push(event.message));}postMessage(data,...args){workerTrace.sent.push(data);return super.postMessage(data,...args);}terminate(){workerTrace.terminated++;return super.terminate();}};
  },{s,key:SAVE,account,origin,motion});
  const p=await context.newPage();lastPage=p;p.setDefaultTimeout(15000);await p.clock.setFixedTime(new Date(wall));
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&/\.(js|css|webp|png|svg|woff2)(\?|$)/.test(r.url()))badAssets.push(r.url());});
  await p.goto(origin+'/school.html');await ready(p);await p.evaluate(()=>document.fonts.ready);
  if(account)await p.waitForFunction(()=>document.querySelector('#account-label').textContent==='계정 저장');
  return{p,context};
 }
 async function within(p,selector) {const el=p.locator(selector).first();await el.scrollIntoViewIfNeeded();const r=await el.boundingBox(),v=p.viewportSize();assert(r&&r.x>=-1&&r.y>=-1&&r.x+r.width<=v.width+1&&r.y+r.height<=v.height+1,selector+JSON.stringify({r,v}));if(await el.evaluate(e=>e.tagName==='BUTTON'))assert(r.height>=43,selector+' touch target');if(!await el.isDisabled())await el.click({trial:true});}
 async function createAccount(letter,s=seed()) {
   const challenge=await api(null,'/api/account/challenge');assert.equal(challenge.status,200);
   const credential=await clock(()=>t.credential(challenge.data.nonce,'equipment-browser-'+letter));
   const login=await api(null,'/api/account/google',{nonce:challenge.data.nonce,credential});assert.equal(login.status,200);const who=login.data;
   s.commanderName='장비검증'+letter;
   t.sqlite.prepare('INSERT INTO school_saves(account_id,payload,revision,updated_at) VALUES(?,?,0,?)').run(who.profile.id,JSON.stringify(s),serverTime);
   const social=await api(who,'/api/school/social',{kind:'state'});assert.equal(social.status,200);return who;
 }
 async function action(who,value,id='equipment-test-'+crypto.randomUUID()) {
   const state=await api(who,'/api/school/state');assert.equal(state.status,200);
   return api(who,'/api/school/action',{action:value,revision:state.data.revision,requestId:id});
 }
 async function refresh(p){await home(p);await p.click('#account-button');await Promise.all([p.waitForResponse(r=>r.url().includes('/api/school/state')&&r.status()===200),p.click('#cloud-refresh')]);await p.waitForFunction(()=>document.querySelector('#save-status').dataset.state==='saved');await close(p);}
 async function hero(p,id){lastPage=p;await close(p);if(await p.locator('#app').getAttribute('data-tab')!=='adventure'){await home(p);if((await p.locator('#lobby-resume').innerText()).includes('결과')){await p.click(`#lobby-party [data-hero="${id}"]`);await p.waitForSelector('#train-hero');return;}await p.click('#lobby-resume');}await p.click(`#party [data-hero="${id}"]`);await p.waitForSelector('#train-hero');}
 async function dungeons(p,kind='daily'){await home(p);await p.click('#lobby-nav [data-lobby-action="dungeons"]');await p.click(`[data-dungeon="${kind}"]`);}
 async function enter(p,kind='daily',tier=1){await dungeons(p,kind);await p.selectOption(`#${kind}-tier`,String(tier));await p.click(`#${kind}-enter`);await p.waitForFunction(kind=>{const cache=sessionStorage.getItem('school-confirmed-cloud-view'),s=cache?JSON.parse(cache).state:JSON.parse(localStorage.getItem('school-mercenaries-v8'));return s.activities?.run?.kind===kind&&!s.activities.run.settled;},kind);}
 async function season(p){await home(p);await p.click('#arena-button');await p.click('button[data-arena-mode="season"]');await p.waitForSelector('#season-register');}
 async function gear(p,id='taeo',slot='weapon'){await hero(p,id);await p.click(`[data-gear-slot="${slot}"]`);await p.waitForSelector('#gear-inventory');}
 async function waitGear(p,predicate){await p.waitForFunction(predicate);}
 async function equipped(p,hero,item,cloud=false){await p.waitForFunction(({key,hero,item,cloud})=>{const s=cloud?JSON.parse(sessionStorage.getItem('school-confirmed-cloud-view')).state:JSON.parse(localStorage.getItem(key));return Object.values(s.equipment.equipped[hero]||{}).includes(item);},{key:SAVE,hero,item,cloud});}
 async function finish(p){serverTime+=30000;await p.clock.setFixedTime(new Date(serverTime));await refresh(p);await p.waitForSelector('#modal .dungeon-result');}
 try {
  assert.equal(G.CATALOG_VERSION,18);
  const rich=seed();for(const item of G.GEAR)rich.equipment.inventory[item.id]={count:12,stars:0};
  if(process.env.SCHOOL_EQUIPMENT_CLOUD_ONLY!=='1'){
  const legacy=await open(LEGACY_V15,{wall:LEGACY_V15.at});
  await legacy.p.waitForSelector('#modal .dungeon-result');let migrated=await saved(legacy.p);
  assert.deepEqual(finances(migrated),finances(LEGACY_V15));assert.deepEqual(migrated.activities.lastResult,LEGACY_V15.activities.lastResult);
  assert.deepEqual(migrated.equipment,{inventory:{},equipped:{}});
  await legacy.p.reload();await ready(legacy.p);await legacy.p.waitForSelector('#modal .dungeon-result');migrated=await saved(legacy.p);
  assert.deepEqual(finances(migrated),finances(LEGACY_V15));assert.deepEqual(migrated.equipment,{inventory:{},equipped:{}});await legacy.context.close();
  console.log('PASS exact catalog15 save migration preserves wallet, pity, heroes, presets and pending paid dungeon result without retroactive gear');

  const guest=await open(rich),p=guest.p;
  await gear(p);assert.equal(await p.locator('#gear-items [data-gear-item]:visible').count(),G.GEAR.filter(item=>item.slot==='weapon').length);
  for(const viewport of SIZES){
    await p.setViewportSize(viewport);
    for(const slot of G.GEAR_SLOTS){await p.click(`[data-gear-filter="${slot}"]`);for(const item of G.GEAR.filter(item=>item.slot===slot))await within(p,`[data-gear-item="${item.id}"]`);await within(p,'#gear-equip');await within(p,'#gear-awaken');}
    await p.click('[data-gear-filter="weapon"]');await p.locator('#gear-back').scrollIntoViewIfNeeded();await p.locator('#gear-items,#gear-detail').evaluateAll(nodes=>nodes.forEach(node=>node.scrollTop=0));await p.screenshot({path:path.join(OUT,`equipment-${viewport.width}x${viewport.height}.png`)});
  }
  await p.setViewportSize(SIZES[0]);await p.locator('#gear-equip').scrollIntoViewIfNeeded();const priorStats=G.stats('taeo',rich.units.taeo,rich);
  await p.click('#gear-equip');await equipped(p,'taeo','chalk_star');let s=await saved(p);
  assert.deepEqual(finances(s),finances(rich));assert.equal(s.battle.heroes.find(h=>h.id==='taeo').atk,priorStats.atk);
  assert(G.stats('taeo',s.units.taeo,s).atk>priorStats.atk);assert((await p.locator('#gear-preview-atk').innerText()).replaceAll(',','').includes(String(G.stats('taeo',s.units.taeo,s).atk)));
  await gear(p,'geonu');await p.click('#gear-equip');await equipped(p,'geonu','chalk_star');
  const beforeAwaken=await saved(p);
  for(let stars=1;stars<=5;stars++){
    await p.click('#gear-awaken');await p.waitForFunction(({key,stars})=>JSON.parse(localStorage.getItem(key)).equipment.inventory.chalk_star.stars===stars,{key:SAVE,stars});
    await p.waitForFunction(stars=>document.querySelector('#gear-selected-stars').textContent.includes(stars+'성'),stars);
    if(stars===1){await p.waitForSelector('#gear-awaken-fx.gear-fx-playing');await p.screenshot({path:path.join(OUT,'equipment-awaken-reduced.png')});}
  }
  s=await saved(p);assert.equal(s.equipment.inventory.chalk_star.count,3);assert.equal(s.equipment.equipped.taeo.weapon,'chalk_star');assert.equal(s.equipment.equipped.geonu.weapon,'chalk_star');
  assert.deepEqual(finances(s),finances(beforeAwaken));assert(await p.locator('#gear-awaken').isDisabled());assert.match(await p.locator('#gear-awaken').innerText(),/최대 5성/);
  await p.click('#gear-unequip');await p.waitForFunction(key=>!JSON.parse(localStorage.getItem(key)).equipment.equipped.geonu?.weapon,SAVE);assert.equal((await saved(p)).equipment.inventory.chalk_star.count,3);
  await gear(p,'taeo','armor');await p.click('[data-gear-item="guardian_robe"]');await p.click('#gear-equip');await equipped(p,'taeo','guardian_robe');
  await p.click('[data-gear-filter="charm"]');await p.click('[data-gear-item="dawn_brooch"]');await p.click('#gear-equip');await equipped(p,'taeo','dawn_brooch');
  s=await saved(p);assert.equal(Object.keys(s.equipment.equipped.taeo).length,3);
  await close(p);await p.click('#battle-settings');await p.check('#setting-theme');await close(p);await gear(p);
  const colors=await p.locator('[data-gear-kind="weapon"]').evaluateAll(nodes=>nodes.map(node=>({rarity:node.className,color:getComputedStyle(node).getPropertyValue('--gear-color')||getComputedStyle(node).borderColor})));
  assert.equal(new Set(colors.map(x=>x.color)).size,4);await p.screenshot({path:path.join(OUT,'equipment-dark-rarity.png')});
  await close(p);await p.clock.setFixedTime(new Date(NOW+20000));await p.waitForFunction(({key,atk,hp})=>{const h=JSON.parse(localStorage.getItem(key)).battle.heroes.find(h=>h.id==='taeo');return h.atk===atk&&h.max===hp;},{key:SAVE,...G.stats('taeo',s.units.taeo,s)});
  s=await saved(p);const preservedGear=G.clone(s.equipment);await p.click('#formation-button');await p.click('[data-preset-save="0"]');await p.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).presets[0].team.length===6,SAVE);await close(p);
  await p.click('#party [data-hero="taeo"]');await p.click('[data-slot="1"]');await p.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).team[1]==='taeo',SAVE);
  await p.click('#formation-button');await p.click('[data-preset-apply="0"]');await p.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).team[0]==='taeo',SAVE);assert.deepEqual((await saved(p)).equipment,preservedGear);
  await p.reload();await ready(p);assert.deepEqual((await saved(p)).equipment,preservedGear);await guest.context.close();
  console.log('PASS owned equipment bag and 44px controls fit three viewports; dark rarity colors remain distinct; shared five-star awakening costs only unused copies, slots persist, next-wave stats and presets preserve gear');
  const active=G.clone(rich);active.best=60;for(const u of Object.values(active.units))u.level=1;G.action(active,{kind:'activity',mode:'weekly',tier:3},NOW);
  const locked=await open(active);await gear(locked.p);assert(await locked.p.locator('#gear-equip').isDisabled());assert(await locked.p.locator('#gear-awaken').isDisabled());assert.match(await locked.p.locator('#gear-lock-note').innerText(),/던전/);assert.deepEqual((await saved(locked.p)).equipment,active.equipment);await locked.context.close();
  console.log('PASS active dungeon disables equipment changes and duplicate awakening before battle settlement');
  }

  const alice=await createAccount('A'),bob=await createAccount('B');const aSession=await open(seed(),{account:alice}),bSession=await open(seed(),{account:bob}),a=aSession.p,b=bSession.p;
  const control={};controls.set(alice.token,control);forcedRandom=0;
  await dungeons(a);await a.click('details[data-gear-drop-source="daily"] summary');
  assert.equal((await a.locator('details[data-gear-drop-source="daily"] [data-gear-rate="SSR"]').innerText()).trim(),'2%');
  await a.selectOption('#daily-tier','3');await a.click('details[data-gear-drop-source="daily"] summary');assert.equal((await a.locator('details[data-gear-drop-source="daily"] [data-gear-rate="SSR"]').innerText()).trim(),'5%');
  await a.screenshot({path:path.join(OUT,'equipment-dungeon-rates.png')});
  await enter(a);await gear(a);assert(await a.locator('#gear-equip').isDisabled());assert(await a.locator('#gear-awaken').isDisabled());assert.match(await a.locator('#gear-lock-note').innerText(),/던전|저장/);assert.equal(readCloud(alice).activities.run.settled,false);await close(a);
  control.blockState=true;serverTime+=30000;await a.clock.setFixedTime(new Date(serverTime));
  await a.waitForFunction(()=>document.querySelector('#battle-status').textContent.includes('확인'));
  assert.deepEqual(readCloud(alice).equipment.inventory,{});assert.equal(await a.locator('[data-gear-drop]').count(),0);await a.screenshot({path:path.join(OUT,'equipment-confirmation-pending.png')});
  control.blockState=false;await refresh(a);await a.waitForSelector('[data-gear-drop="chalk_star"]');
  let cloud=readCloud(alice);assert.equal(cloud.activities.lastResult.won,true);assert.equal(cloud.equipment.inventory.chalk_star.count,1);assert.deepEqual(cloud.activities.lastResult.gearDrops,[{item:'chalk_star',count:1,duplicate:false,stars:0}]);
  const paidResult=G.clone(cloud.activities.lastResult),paidWallet={gold:cloud.gold,gems:cloud.gems};await a.screenshot({path:path.join(OUT,'equipment-confirmed-loot.png')});
  await a.reload();await ready(a);await a.waitForSelector('[data-gear-drop="chalk_star"]');await api(alice,'/api/school/state');assert.deepEqual(readCloud(alice).activities.lastResult,paidResult);assert.equal(readCloud(alice).equipment.inventory.chalk_star.count,1);assert.deepEqual({gold:readCloud(alice).gold,gems:readCloud(alice).gems},paidWallet);
  await gear(a);control.holdAction=true;await a.locator('#gear-equip').evaluate(el=>{el.click();el.click();});await a.waitForTimeout(200);assert(control.committed?.status===200);assert(await a.locator('#gear-equip').isDisabled());await equipped(a,'taeo','chalk_star',true);
  const retry=await api(alice,'/api/school/action',control.committed.request);assert.equal(retry.status,200);assert.equal(retry.data.repeated,true);assert.equal(readCloud(alice).equipment.inventory.chalk_star.count,1);
  await gear(a,'geonu');assert(await a.locator('#gear-equip').isDisabled());assert.match(await a.locator('#gear-equip').innerText(),/가방에 없음/);assert.equal(await a.locator('#gear-items [data-gear-item]:visible').count(),0);assert.equal(await a.locator('#gear-worn-items [data-gear-worn="chalk_star"]:visible').count(),1);assert.match(await a.locator('#gear-lock-note').innerText(),/착용 중.*해제/);assert.match(await a.locator('#gear-owned').innerText(),/총 1개 = 가방 0 \+ 착용 1/);
  assert.equal((await action(alice,{kind:'gear-equip',hero:'geonu',item:'chalk_star'})).status,400);
  await gear(b);assert(await b.locator('#gear-equip').isDisabled());assert(await b.locator('#gear-bag-empty').isVisible());assert(await b.locator('#gear-detail-empty').isVisible());assert.equal(await b.locator('#gear-items [data-gear-item]:visible').count(),0);assert.equal(await b.locator('#gear-worn-items [data-gear-worn]:visible').count(),0);assert.equal((await action(bob,{kind:'gear-equip',hero:'taeo',item:'chalk_star',accountId:alice.profile.id})).status,400);assert.deepEqual(readCloud(bob).equipment,{inventory:{},equipped:{}});
  console.log('PASS actual signed server dungeon victory confirms one secure drop; cloud preview exposes no fake loot; reload and receipt retry award once, first-copy ownership and cross-account isolation enforced');

  await enter(a);await finish(a);assert.equal(readCloud(alice).equipment.inventory.chalk_star.count,2);await gear(a,'geonu');await a.click('#gear-equip');await equipped(a,'geonu','chalk_star',true);assert(await a.locator('#gear-awaken').isDisabled());
  await enter(a);await finish(a);assert.equal(readCloud(alice).equipment.inventory.chalk_star.count,3);await gear(a,'geonu');await a.click('#gear-awaken');await a.waitForFunction(()=>JSON.parse(sessionStorage.getItem('school-confirmed-cloud-view')).state.equipment.inventory.chalk_star.stars===1);
  cloud=readCloud(alice);assert.deepEqual(cloud.equipment.inventory.chalk_star,{count:2,stars:1});assert.equal(Object.values(cloud.equipment.equipped).filter(x=>x.weapon==='chalk_star').length,2);assert(await a.locator('#gear-awaken').isDisabled());
  await a.reload();await ready(a);assert.deepEqual(readCloud(alice).equipment,cloud.equipment);
  console.log('PASS second actual drop permits two wearers; third drop enables one shared awakening without consuming worn copies, and authoritative gear survives reload');

  await a.waitForSelector('#modal .dungeon-result');await a.click('#modal [data-activity-exit]');await a.waitForFunction(()=>!JSON.parse(sessionStorage.getItem('school-confirmed-cloud-view')).state.activities.run);
  await home(a);await a.click('#lobby-resume');await a.click('#battle-map');await a.click('[data-map-recommend]');
  await a.waitForSelector('[data-farm-start]');const preview=await a.evaluate(()=>workerTrace.received.filter(m=>m.kind==='result').at(-1));
  assert.equal(preview.fingerprint,G.farmingFingerprint(readCloud(alice)));const workerWallet={gold:readCloud(alice).gold,gems:readCloud(alice).gems};
  const changed=await action(alice,{kind:'gear-unequip',hero:'geonu',slot:'weapon'});assert.equal(changed.status,200);assert.notEqual(preview.fingerprint,G.farmingFingerprint(changed.data.state));
  await a.evaluate(()=>window.dispatchEvent(new Event('online')));await a.waitForFunction(()=>document.querySelector('#farm-preview-status').textContent.includes('다시 계산'));
  assert.equal(await a.locator('[data-farm-start]').count(),0);assert.deepEqual({gold:readCloud(alice).gold,gems:readCloud(alice).gems},workerWallet);
  await a.click('#farm-preview-retry');await a.waitForSelector('[data-farm-start]');const nextPreview=await a.evaluate(()=>workerTrace.received.filter(m=>m.kind==='result').at(-1));assert.notEqual(nextPreview.fingerprint,preview.fingerprint);assert.equal(nextPreview.fingerprint,G.farmingFingerprint(readCloud(alice)));await close(a);
  console.log('PASS actual background-worker recommendations are invalidated by a server-confirmed equipment change without granting currency or accepting stale stage choices');

  await season(a);await a.click('#season-register');await a.waitForFunction(()=>document.querySelector('#season-register').textContent.includes('갱신'));
  const seasonBefore=(await api(alice,'/api/school/social',{kind:'season_state'})).data;assert.deepEqual(seasonBefore.me.defense.equipment,G.snapshotEquipment(readCloud(alice)));const defense=G.clone(seasonBefore.me.defense);
  await a.click('details[data-gear-snapshot] summary');assert.match(await a.locator('[data-gear-snapshot-hero="taeo"]').innerText(),/별빛 분필.*1성/s);await a.screenshot({path:path.join(OUT,'equipment-season-defense.png')});
  await season(b);await b.click('#season-register');await b.waitForFunction(()=>document.querySelector('#season-register').textContent.includes('갱신'));
  assert.equal((await action(alice,{kind:'gear-unequip',hero:'taeo',slot:'weapon'})).status,200);
  const unchanged=(await api(alice,'/api/school/social',{kind:'season_state'})).data;assert.deepEqual(unchanged.me.defense,defense);
  await b.click('#season-refresh');await b.waitForSelector(`[data-season-attack="${alice.profile.id}"]`);await b.click(`[data-season-attack="${alice.profile.id}"]`);await b.waitForSelector('#arena-canvas');await b.click('#arena-skip');await b.waitForSelector('#arena-replay-result:not([hidden])');
  const matches=t.sqlite.prepare('SELECT payload FROM school_season_matches').all();assert.equal(matches.length,1);const match=JSON.parse(matches[0].payload);assert.deepEqual(match.teams[1].equipment,defense.equipment);
  const stat=G.stats('taeo',defense.units.taeo,defense),unit=match.teams[1].units.find(u=>u.id==='taeo');assert.equal(unit.atk,stat.atk);assert.equal(unit.max,stat.hp*3);assert(unit.atk>G.stats('taeo',readCloud(alice).units.taeo,readCloud(alice)).atk);
  assert.equal(await b.locator('details[data-gear-snapshot]').count(),2);await b.locator('details[data-gear-snapshot] summary').nth(1).click();assert.match(await b.locator('details[data-gear-snapshot]').nth(1).innerText(),/별빛 분필.*1성/s);
  await b.screenshot({path:path.join(OUT,'equipment-season-replay.png')});
  await refresh(a);await season(a);await Promise.all([a.waitForResponse(r=>r.url().includes('/api/school/social')&&r.request().postDataJSON()?.kind==='season_register'&&r.status()===200),a.click('#season-register')]);
  const updated=(await api(alice,'/api/school/social',{kind:'season_state'})).data;assert(!updated.me.defense.equipment||Object.keys(updated.me.defense.equipment.equipped).length===0);assert(updated.me.defense.power<defense.power);
  console.log('PASS real season defense locks equipped bonuses at registration; actual persisted replay uses that snapshot, then manual refresh updates the defense');

  await close(a);await a.click('#account-button');await a.waitForSelector('#logout-account');await a.click('#logout-account');await a.waitForFunction(()=>document.querySelector('#account-label').textContent==='게스트');
  assert.deepEqual((await saved(a)).equipment,{inventory:{},equipped:{}});await gear(a);assert(await a.locator('#gear-equip').isDisabled());assert(await a.locator('#gear-bag-empty').isVisible());assert.equal(await a.locator('#gear-items [data-gear-item]:visible').count(),0);assert.equal(await a.locator('#gear-worn-items [data-gear-worn]:visible').count(),0);
  await aSession.context.close();await bSession.context.close();
  const full=await open(rich,{motion:'full'});await gear(full.p);await full.p.click('#gear-awaken');await full.p.waitForSelector('#gear-awaken-fx.gear-fx-playing');await full.p.screenshot({path:path.join(OUT,'equipment-awaken-full.png')});await full.p.waitForFunction(()=>!document.querySelector('#gear-awaken-fx').classList.contains('gear-fx-playing'));assert.equal((await saved(full.p)).equipment.inventory.chalk_star.stars,1);await full.context.close();
  assert.deepEqual(errors,[]);assert.deepEqual(badAssets,[]);
  fs.writeFileSync(path.join(OUT,'result.json'),JSON.stringify({catalog:G.CATALOG_VERSION,viewports:SIZES,errors,badAssets,signedBrowserSessions:2,actualDailyClears:3,rankedMatches:1},null,2));
  console.log('PASS account gear never leaks into guest inventory; full/reduced awakening finishes cleanly; JavaScript and asset errors 0');
 } catch(e) {
  fs.writeFileSync(path.join(OUT,'failure-api.json'),JSON.stringify({errors,requests:apiLog.map(r=>({path:r.path,request:r.request,status:r.status,error:r.response.error,result:r.response.result}))},null,2));
  if(lastPage&&!lastPage.isClosed()){await lastPage.screenshot({path:path.join(OUT,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(OUT,'failure-dom.txt'),await lastPage.locator('body').innerText());}throw e;
 } finally {await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));t.sqlite.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
