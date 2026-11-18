// Real app controls, real battle settlement and signed disposable SQLite accounts.
// RNG/time are controlled only inside the local server fixture; no production save
// or browser engine state is edited after a session has started.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const G = require('../school/engine.js');
const { fixture } = require('./account-fixture.cjs');
const ROOT=path.resolve(__dirname,'..'), SAVE='school-mercenaries-v8', OUT='/tmp/school-ryusion';
const NOW=Date.parse('2026-11-19T03:00:00Z');
const SIZES=[{width:755,height:330},{width:568,height:280},{width:2560,height:1440}];
function seed(now=NOW) {
 const s=G.create(now,123);s.team=['ryusion','geonu','sua','osia','lava','horas'];
 for(const id of s.team)s.units[id]={level:50,stars:3,xp:0,shards:0,nextSkill:1,basicHits:0};
 s.gems=50000;s.gold=100000;s.banners.ryusion={pity:79,guaranteed:true};
 G.action(s,{kind:'stage',stage:1,mode:'farm'},s.at);
 for(const h of s.battle.heroes){h.hp=h.max=100000;h.atk=10;}
 for(const e of s.battle.enemies){e.hp=e.max=1000000;e.atk=10;}
 assert(G.validate(s));return s;
}

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
   const credential=await clock(()=>t.credential(challenge.data.nonce,'counter-browser-'+letter));
   const login=await api(null,'/api/account/google',{nonce:challenge.data.nonce,credential});assert.equal(login.status,200);const who=login.data;
   s.commanderName='반격검증'+letter;
   t.sqlite.prepare('INSERT INTO school_saves(account_id,payload,revision,updated_at) VALUES(?,?,0,?)').run(who.profile.id,JSON.stringify(s),serverTime);
   const social=await api(who,'/api/school/social',{kind:'state'});assert.equal(social.status,200);return who;
 }

 try{
  for(const viewport of [{width:755,height:330},{width:568,height:280},{width:2560,height:1440}]){
   const s=seed(),{p,context}=await open(s,{viewport,motion:'full'});await p.evaluate(()=>SchoolRyusion.ready);assert(await p.evaluate(()=>SchoolArt.assetsReady('ryusion')));
   await p.click('.lobby-nav [data-lobby-action="recruit"]');await p.click('[data-banner="ryusion"]');assert.equal(await p.locator('#recruit-price-one').innerText(),'100');assert.equal(await p.locator('#recruit-price-ten').innerText(),'1,000');assert.match(await p.locator('#pickup-element').innerText(),/대지/);
   for(const selector of ['[data-banner="ryusion"]','#recruit-one','#recruit-ten','#feature-ryusion-button'])await within(p,selector);
   await p.screenshot({path:path.join(OUT,`pickup-${viewport.width}.png`)});await p.click('#feature-ryusion-button');assert.match(await p.locator('#modal-content').innerText(),/류시온/);await p.locator('.hero-skills summary').click();assert.match(await p.locator('.hero-skills').innerText(),/60%/);await close(p);
   await p.click('[data-recruit-category="weapons"]');assert(await p.locator('[data-banner="ryusion"]').isHidden());await p.click('[data-recruit-category="heroes"]');await p.click('[data-banner="ryusion"]');
   await p.click('#recruit-ten');await p.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).gems===49000,SAVE);assert((await saved(p)).units.ryusion.shards>=20);
   const skip=p.locator('[data-presentation-skip]');if(await skip.isVisible())await skip.click();await p.waitForTimeout(600);await close(p);await home(p);
   await p.click('.lobby-nav [data-lobby-action="supplies"]');await p.fill('#coupon-code','RYUSION_UPDATE');await p.click('#redeem-code');await p.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).redeemedCodes.includes('RYUSION_UPDATE'),SAVE);await p.fill('#coupon-code','THANKS_FOR_PLAYING');await p.click('#redeem-code');await p.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).redeemedCodes.includes('THANKS_FOR_PLAYING'),SAVE);
   const after=await saved(p);assert.equal(after.gold,115000);assert.equal(after.gems,52000);await p.reload();await ready(p);assert.equal((await saved(p)).gems,52000);await context.close();console.log('PASS',viewport,'SSR artwork, touch controls, weapon tab, pickup, exact coupons, reload');
  }
  const visual=await open(seed(),{motion:'full'}),p=visual.p;await p.evaluate(()=>SchoolRyusion.ready);await p.click('#lobby-resume');
  await p.clock.setFixedTime(new Date(NOW+5000));await p.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).battle.elapsed>=5000,SAVE);await p.screenshot({path:path.join(OUT,'taunt.png')});
  await p.clock.setFixedTime(new Date(NOW+8500));await p.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).events.some(e=>e.kind==='ryusion-impact'),SAVE);
  await p.clock.setFixedTime(new Date(NOW+18000));await p.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).events.some(e=>e.kind==='earth-guard'),SAVE);await p.screenshot({path:path.join(OUT,'barrier.png')});
  const frames=await p.evaluate(()=>{
   const frames=[],poses=[];for(const [name,frame]of [['idle',{time:0}],['basic-windup',{attackAge:.1}],['basic-hit',{attackAge:.3}],['taunt',{taunting:true}],['charge',{motion:SchoolRyusion.motion(1,.4)}],['barrier',{motion:SchoolRyusion.motion(2,.6)}],['hurt',{hit:true}]]){
    const canvas=document.createElement('canvas');canvas.width=288;canvas.height=336;const c=canvas.getContext('2d');c.fillStyle='#1b2530';c.fillRect(0,0,288,336);SchoolArt.hero(c,'ryusion',144,290,4,frame);frames.push({name,url:canvas.toDataURL()});poses.push(SchoolRyusion.poseFor(frame));
   }return{frames,poses};
  });assert.equal(new Set(frames.poses).size,7);for(const f of frames.frames)fs.writeFileSync(path.join(OUT,f.name+'.png'),Buffer.from(f.url.split(',')[1],'base64'));await visual.context.close();
  const a=await createAccount('A'),b=await createAccount('B'),signed=await open(null,{account:a}),sp=signed.p;await sp.click('.lobby-nav [data-lobby-action="recruit"]');await sp.click('[data-banner="ryusion"]');const before=readCloud(b);await sp.click('#recruit-one');await sp.waitForFunction(()=>JSON.parse(sessionStorage.getItem('school-confirmed-cloud-view')).state.gems===49900);assert.deepEqual(readCloud(b),before);await signed.context.close();
  // A persisted server match is replayed with both copies of Ryusion on screen.
  for(const who of [a,b]){const state=await api(who,'/api/school/social',{kind:'season_state'});const registered=await api(who,'/api/school/social',{kind:'season_register',seasonId:state.data.season.id});assert.equal(registered.status,200,JSON.stringify(registered.data));}
  const arena=await open(null,{account:a,motion:'full'}),ap=arena.p;
  await ap.click('#arena-button');await ap.click('button[data-arena-mode="season"]');await ap.waitForSelector(`[data-season-attack="${b.profile.id}"]`);await ap.click(`[data-season-attack="${b.profile.id}"]`);await ap.waitForSelector('#arena-canvas');
  await ap.waitForTimeout(9000);await ap.screenshot({path:path.join(OUT,'arena-replay.png')});
  const persisted=t.sqlite.prepare('SELECT payload FROM school_season_matches').all();assert.equal(persisted.length,1);const match=JSON.parse(persisted[0].payload);assert(match.events.some(e=>e.kind==='ryusion-skill'));assert(match.events.some(e=>e.redirectedFrom));
  await ap.click('#arena-skip');await ap.waitForSelector('#arena-replay-result:not([hidden])');await arena.context.close();console.log('PASS signed season battle, persisted redirected hits, animated replay and result');
  assert.deepEqual(errors,[]);assert.deepEqual(badAssets,[]);console.log('PASS distinct seven poses, automatic taunt/charge/barrier, signed recruitment isolation, JS/asset errors0');
 }catch(error){if(lastPage&&!lastPage.isClosed()){await lastPage.screenshot({path:path.join(OUT,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(OUT,'failure-dom.txt'),await lastPage.locator('body').innerText());}throw error;}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));t.sqlite.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
