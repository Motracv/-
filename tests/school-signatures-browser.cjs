// Real app controls, real battle settlement and signed disposable SQLite accounts.
// RNG/time are controlled only inside the local server fixture; no production save
// or browser engine state is edited after a session has started.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const G = require('../school/engine.js');
const { fixture } = require('./account-fixture.cjs');
const ROOT=path.resolve(__dirname,'..'), SAVE='school-mercenaries-v8', OUT='/tmp/school-signatures';
const NOW=Date.parse('2026-11-19T03:00:00Z');
// Captured with the unmodified catalog15 engine after a real daily victory.
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
   const credential=await clock(()=>t.credential(challenge.data.nonce,'signature-browser-'+letter));
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

 const recruit=async p=>{await home(p);await p.click('#lobby-nav [data-lobby-action="recruit"]');await p.waitForSelector('#recruit-ten');};
 const weapons=async(p,id)=>{await recruit(p);await p.click('button[data-recruit-category="weapons"]');await p.click(`button[data-banner="${id}"]`);};
 const gear=async(p,id,item)=>{await hero(p,id);await p.click('[data-gear-slot="weapon"]');await p.click(`[data-gear-item="${item}"]`);};
 try{
  for(const viewport of SIZES){
   const s=seed();s.weaponBanners.standard.pity=79;s.equipment.inventory.osia_scepter={count:1,stars:0};
   const {p,context}=await open(s,{viewport});await recruit(p);
   for(const id of ['osia','lava','horas']){await p.click(`button[data-banner="${id}"]`);assert.equal(await p.locator('#recruit-price-one').innerText(),id==='horas'?'160':'100');assert.equal(await p.locator('#recruit-price-ten').innerText(),id==='horas'?'1,600':'1,000');}
   await p.click('button[data-recruit-category="weapons"]');await p.click('button[data-banner="osia"]');
   assert.equal(await p.locator('#pity-left').innerText(),'1');await p.click('button[data-banner="lava"]');assert.equal(await p.locator('#pity-left').innerText(),'1');await p.click('button[data-banner="horas"]');assert.equal(await p.locator('#pity-left').innerText(),'80');assert.match(await p.locator('#banner-deadline').getAttribute('title'),/12월 2일/);
   for(const selector of ['button[data-recruit-category="weapons"]','button[data-recruit-category="heroes"]','button[data-banner="horas"]','button[data-banner="osia"]','button[data-banner="lava"]','#rates-button','#recruit-one','#recruit-ten','#weapon-preview'])await within(p,selector);
   assert(await p.locator('#weapon-pickup-art').evaluate(e=>e.complete&&e.naturalWidth>0));await p.screenshot({path:path.join(OUT,`weapon-${viewport.width}.png`)});
   await p.click('#rates-button');const rates=await p.locator('#modal-content').innerText();assert.match(rates,/픽뚫 없음/);assert.match(rates,/1,000보석/);assert.match(rates,/상시 전무는 누적을 공유/);await close(p);
   await p.click('button[data-banner="osia"]');await p.click('#recruit-one');await p.waitForSelector('[data-weapon-details="osia_scepter"]');assert.equal((await saved(p)).gems,s.gems-100);assert.equal((await saved(p)).equipment.inventory.osia_scepter.count,2);await p.screenshot({path:path.join(OUT,`weapon-result-${viewport.width}.png`)});await close(p);
   await gear(p,'osia','osia_scepter');await within(p,'#gear-equip');await p.click('#gear-equip');await p.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).equipment.equipped.osia?.weapon==='osia_scepter',SAVE);assert.match(await p.locator('#gear-exclusive').innerText(),/용왕의 해류/);await p.click('#gear-awaken');await p.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).equipment.inventory.osia_scepter.stars===1,SAVE);assert.match(await p.locator('#gear-exclusive').innerText(),/13.6/);await p.screenshot({path:path.join(OUT,`weapon-equipped-${viewport.width}.png`)});
   await p.reload();await ready(p);assert.equal((await saved(p)).equipment.inventory.osia_scepter.stars,1);assert.equal((await saved(p)).gems,s.gems-100);assert.equal((await saved(p)).weaponPulls,1);await context.close();
   console.log('PASS',viewport,'prices, shared/separate pity, visible controls, original icons, real pull/equip/awaken/reload');
  }
  const aSeed=seed();aSeed.gems=1000;aSeed.weaponBanners.limited.pity=79;
  const alice=await createAccount('A',aSeed),bob=await createAccount('B',seed());
  const aSession=await open(null,{account:alice}),bSession=await open(null,{account:bob}),a=aSession.p,b=bSession.p;
  const control={holdAction:true};controls.set(alice.token,control);await weapons(a,'horas');forcedRandom=.99;await a.locator('#recruit-ten').dblclick();await a.waitForSelector('[data-weapon-details="horas_orbit"]');forcedRandom=null;
  assert.equal(readCloud(alice).gems,0);assert.equal(readCloud(alice).weaponPulls,10);assert.equal(readCloud(alice).equipment.inventory.horas_orbit.count,1);assert.equal(readCloud(bob).weaponPulls,0);assert.deepEqual(readCloud(bob).equipment.inventory,{});
  assert.equal(apiLog.filter(x=>x.path==='/api/school/action'&&x.request.action?.kind==='weapon-recruit').length,1);
  await gear(a,'horas','horas_orbit');await a.click('#gear-equip');await a.waitForFunction(()=>JSON.parse(sessionStorage.getItem('school-confirmed-cloud-view')).state.equipment.equipped.horas?.weapon==='horas_orbit');assert.match(await a.locator('#gear-exclusive').innerText(),/벚꽃의 맹세/);await a.reload();await ready(a);await a.waitForFunction(()=>document.querySelector('#account-label').textContent==='계정 저장');assert.equal((await confirmed(a)).equipment.equipped.horas.weapon,'horas_orbit');assert.equal((await confirmed(a)).gems,0);
  controls.set(bob.token,{dropAction:true});await weapons(b,'lava');forcedRandom=0;await b.click('#recruit-one');await b.waitForSelector('#connection button');assert.equal(readCloud(bob).weaponPulls,1);assert.equal((await confirmed(b)).weaponPulls,0);await b.click('#connection button');await b.waitForFunction(()=>JSON.parse(sessionStorage.getItem('school-confirmed-cloud-view'))?.state?.weaponPulls===1,null,{timeout:25000});forcedRandom=null;assert.equal(readCloud(bob).gems,6689);assert.equal(readCloud(bob).equipment.inventory.lava_fan.count,1);await b.reload();await ready(b);await b.waitForFunction(()=>document.querySelector('#account-label').textContent==='계정 저장');assert.equal((await confirmed(b)).weaponPulls,1);
  await aSession.context.close();await bSession.context.close();console.log('PASS two signed browser accounts: double-click once, account isolation, equipment reload and response-loss recovery');
  const closed=seed();closed.at=G.WEAPON_BANNERS.horas.expiresAt;const expired=await open(closed,{wall:closed.at});await weapons(expired.p,'horas');assert(await expired.p.locator('#recruit-one').isDisabled());assert(await expired.p.locator('#recruit-ten').isDisabled());await expired.p.click('button[data-banner="lava"]');assert(await expired.p.locator('#recruit-one').isEnabled());await expired.context.close();
  assert.deepEqual(errors,[]);assert.deepEqual(badAssets,[]);fs.writeFileSync(path.join(OUT,'result.json'),JSON.stringify({catalog:G.CATALOG_VERSION,viewports:SIZES,signedBrowserSessions:2,errors,badAssets},null,2));console.log('PASS expired limited weapon disabled; permanent Lava weapon available; JS and asset errors 0');
 }catch(e){if(lastPage&&!lastPage.isClosed()){await lastPage.screenshot({path:path.join(OUT,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(OUT,'failure-dom.txt'),await lastPage.locator('body').innerText());}console.log(JSON.stringify({errors,badAssets}));throw e;}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));t.sqlite.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
