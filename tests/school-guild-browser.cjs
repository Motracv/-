// Real app controls, real battle settlement and signed disposable SQLite accounts.
// RNG/time are controlled only inside the local server fixture; no production save
// or browser engine state is edited after a session has started.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const G = require('../school/engine.js');
const { fixture } = require('./account-fixture.cjs');
const ROOT=path.resolve(__dirname,'..'), SAVE='school-mercenaries-v8', OUT='/tmp/school-guild';
const NOW=Date.parse('2026-11-19T03:00:00Z');
const SIZES=[{width:755,height:330},{width:568,height:280},{width:2560,height:1440}];
function seed(now=NOW) {
 const s=G.create(now,123);s.team=['ryusion','geonu','sua','osia','lava','horas'];
 for(const id of s.team)s.units[id]={level:50,stars:3,xp:0,shards:0,nextSkill:1,basicHits:0};
 delete s.profile;s.gems=50000;s.gold=100000;s.banners.ryusion={pity:79,guaranteed:true};
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
   const credential=await clock(()=>t.credential(challenge.data.nonce,'guild-browser-'+letter));
   const login=await api(null,'/api/account/google',{nonce:challenge.data.nonce,credential});assert.equal(login.status,200);const who=login.data;
   s.commanderName='길드검증'+letter;
   t.sqlite.prepare('INSERT INTO school_saves(account_id,payload,revision,updated_at) VALUES(?,?,0,?)').run(who.profile.id,JSON.stringify(s),serverTime);
   const social=await api(who,'/api/school/social',{kind:'state'});assert.equal(social.status,200);return who;
 }

 try{
  for(const viewport of SIZES){const {p,context}=await open(seed(),{viewport});
   await within(p,'#captain-button');await within(p,'#guild-button');const name=await p.locator('#captain-name-label').boundingBox();assert(name.width>20);
   await p.click('#captain-button');await p.locator('[data-profile-avatar="cat"]').click();await p.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).profile.avatar==='cat',SAVE);await p.locator('[data-profile-title="beta"]').click();await p.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).profile.title==='beta',SAVE);await close(p);
   assert(await p.locator('#captain-title').isVisible());assert(await p.locator('#captain-custom-avatar').isVisible());await p.screenshot({path:path.join(OUT,`lobby-${viewport.width}.png`)});await p.click('#captain-button');await p.screenshot({path:path.join(OUT,`profile-${viewport.width}.png`)});await close(p);await p.reload();await ready(p);assert.equal((await saved(p)).profile.avatar,'cat');assert.equal((await saved(p)).profile.title,'beta');
   await p.click('#guild-button');assert.match(await p.locator('#guild-body').innerText(),/Google 계정/);await within(p,'#guild-login');await context.close();console.log('PASS guest profile, title, top-left name, guild login gate, reload',viewport);
  }
  const aa=await createAccount('A'),bb=await createAccount('B'),cc=await createAccount('C');
  const A=await open(null,{account:aa,viewport:SIZES[0]}),B=await open(null,{account:bb,viewport:SIZES[1]}),C=await open(null,{account:cc,viewport:SIZES[2]});const a=A.p,b=B.p,c=C.p;
  for(const p of [a,b,c])await p.click('#guild-button');
  await a.fill('#guild-name','별빛교실');await a.click('[data-guild-emblem="1"]');await a.click('#guild-create button[type="submit"]');await a.waitForSelector('[data-guild-tab="members"]');await within(a,'#guild-checkin');assert(await a.locator('#guild-checkin').isDisabled());await a.screenshot({path:path.join(OUT,'classroom-755.png')});
  await a.click('[data-guild-tab="members"]');await a.fill('#guild-invite-name','길드검증B');await a.click('#guild-invite-form button');await a.waitForFunction(()=>document.querySelector('.guild-pending')?.textContent.includes('길드검증B'));await b.click('.guild-refresh');await b.waitForSelector('[data-guild-accept]');await within(b,'[data-guild-accept]');await b.click('[data-guild-accept]');await b.waitForSelector('[data-guild-tab="members"]');await b.screenshot({path:path.join(OUT,'classroom-568.png')});await b.click('[data-guild-tab="members"]');assert.equal(await b.locator('[data-guild-kick]').count(),0);assert.equal(await b.locator('#guild-invite-form').count(),0);
  await a.fill('#guild-invite-name','길드검증C');await a.click('#guild-invite-form button');await a.waitForFunction(()=>document.querySelector('.guild-pending')?.textContent.includes('길드검증C'));await c.click('.guild-refresh');await c.waitForSelector('[data-guild-accept]');await c.click('[data-guild-accept]');await c.waitForSelector('[data-guild-tab="members"]');await c.screenshot({path:path.join(OUT,'classroom-2560.png')});
  await a.click('.guild-refresh');await a.waitForFunction(()=>document.querySelectorAll('.guild-member').length===3);await a.click('[data-guild-tab="manage"]');await a.click('[data-guild-emblem="2"]');await a.fill('#guild-notice','환영해요! 우리 반에서 함께 모험해요.');await a.click('#guild-decorate button.primary');await a.waitForFunction(()=>document.querySelector('.guild-heading .guild-crest').dataset.emblem==='2');await b.click('[data-guild-tab="room"]');await b.click('.guild-refresh');await b.waitForFunction(()=>document.querySelector('.guild-chalkboard small').textContent.includes('환영'));assert.equal(await b.locator('.guild-room').getAttribute('data-emblem'),'2');
  const before=readCloud(bb).gems;serverTime=Date.parse('2026-11-19T15:00:01Z');for(const p of [a,b,c])await p.clock.setFixedTime(new Date(serverTime));await b.click('.guild-refresh');await b.waitForFunction(()=>!document.querySelector('#guild-checkin').disabled);await b.click('#guild-checkin');await b.waitForFunction(()=>document.querySelector('#guild-checkin').textContent==='출석 완료');assert.equal(readCloud(bb).gems,before+30);await b.reload();await ready(b);await b.click('#guild-button');await b.waitForFunction(()=>document.querySelector('#guild-checkin')?.textContent==='출석 완료');assert.equal(readCloud(bb).gems,before+30);
  await a.click('[data-guild-tab="members"]');await a.click('.guild-refresh');const kick=a.locator('.guild-member').filter({hasText:'길드검증C'});await kick.locator('summary').click();a.once('dialog',d=>d.accept());await kick.locator('[data-guild-kick]').click();await a.waitForFunction(()=>document.querySelectorAll('.guild-member').length===2);await c.click('.guild-refresh');await c.waitForSelector('#guild-create');
  await a.screenshot({path:path.join(OUT,'members-755.png')});await b.screenshot({path:path.join(OUT,'attendance-568.png')});for(const ctx of [A.context,B.context,C.context])await ctx.close();
  assert.deepEqual(errors,[]);assert.deepEqual(badAssets,[]);console.log('PASS three signed browser sessions create, invite, accept, permissions, decorate, daily gems, reload and kick; JS/asset errors0');
 }catch(error){if(lastPage&&!lastPage.isClosed()){await lastPage.screenshot({path:path.join(OUT,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(OUT,'failure-dom.txt'),await lastPage.locator('body').innerText());}throw error;}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));t.sqlite.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
