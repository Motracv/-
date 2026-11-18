// Real app controls, real battle settlement and signed disposable SQLite accounts.
// RNG/time are controlled only inside the local server fixture; no production save
// or browser engine state is edited after a session has started.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const G = require('../school/engine.js');
const { fixture } = require('./account-fixture.cjs');
const ROOT=path.resolve(__dirname,'..'), SAVE='school-mercenaries-v8', OUT='/tmp/school-raid';
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
    if(control?.dropRaidStart&&url.pathname==='/api/school/raid'&&payload.kind==='start'){control.dropRaidStart=false;res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Test start response lost after commit'}));return;}
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
  const members=[];for(let i=0;i<5;i++)members.push(await createAccount(String(i)));
  const guild=async(who,kind,more={})=>api(who,'/api/school/guild',{kind,requestId:crypto.randomUUID(),...more});
  const made=await guild(members[0],'create',{name:'벌룬브라우저반',emblem:1});assert.equal(made.status,200);const gid=made.data.guild.id;
  for(let i=1;i<5;i++){await guild(members[0],'invite',{guildId:gid,name:'길드검증'+i});const s=await guild(members[i],'state');assert.equal((await guild(members[i],'accept',{inviteId:s.data.invites[0].id})).status,200);}
  const sessions=[];
  for(let i=0;i<5;i++){const session=await open(null,{account:members[i],viewport:SIZES[i%3]});sessions.push(session);await session.p.click('#guild-button');await session.p.click('#guild-raid');await session.p.waitForSelector('[data-raid-send="create"]');}
  const a=sessions[0].p;await a.click('[data-raid-send="create"]');await a.waitForSelector('[data-raid-send="ready"]');
  for(let i=1;i<5;i++){const p=sessions[i].p;await p.waitForSelector('[data-raid-send="join"]');await p.click('[data-raid-send="join"]');await p.waitForSelector('[data-raid-send="ready"]');}
  for(const {p} of sessions){await within(p,'[data-raid-send="ready"]');await p.click('[data-raid-send="ready"]');await p.waitForFunction(()=>document.querySelector('[data-raid-send="ready"]')?.textContent==='준비 취소');}
  await a.waitForFunction(()=>!document.querySelector('[data-raid-send="start"]').disabled);controls.set(members[0].token,{dropRaidStart:true});await a.click('[data-raid-send="start"]');await a.waitForSelector('#raid-retry');await a.click('#raid-retry');
  for(const {p} of sessions)await p.waitForFunction(()=>document.getElementById('raid-view')?.dataset.phase==='fighting');
  for(let i=0;i<sessions.length;i++){const p=sessions[i].p;await p.screenshot({path:path.join(OUT,'raid-live-'+i+'.png')});assert.equal(await p.locator('.raid-party').count(),5);assert.equal(await p.locator('#raid-attempts').textContent(),'오늘 4 / 5회');}
  serverTime+=13000;for(const {p} of sessions)await p.clock.setFixedTime(new Date(serverTime));await a.waitForFunction(()=>!document.getElementById('raid-hp').textContent.startsWith('50,000,000 /'));
  const hp=await a.locator('#raid-hp').innerText();for(const {p} of sessions)await p.waitForFunction(h=>document.getElementById('raid-hp').textContent===h,hp);
  const b=sessions[1].p;await b.reload();await ready(b);await b.click('#guild-button');await b.click('#guild-raid');await b.waitForFunction(()=>document.getElementById('raid-view')?.dataset.phase==='fighting');assert.equal(await b.locator('#raid-attempts').innerText(),'오늘 4 / 5회');
  await a.locator('[data-raid-focus="2"]').click();assert(await a.locator('[data-raid-focus="2"]').evaluate(e=>e.classList.contains('selected')));
  for(let i=0;i<3;i++){const p=sessions[i].p;for(const sel of ['#raid-health','#raid-back','#raid-canvas']){const r=await p.locator(sel).boundingBox(),v=p.viewportSize();assert(r.y>=0&&r.y+r.height<=v.height,sel+' visible without scrolling');}const r=await p.locator('#raid-canvas').boundingBox();assert(r.height>=p.viewportSize().height*.29,'battle uses available height');}
  for(let i=0;i<3;i++)await sessions[i].p.screenshot({path:path.join(OUT,'raid-combat-'+i+'.png')});
  serverTime+=91000;for(const {p} of sessions)await p.clock.setFixedTime(new Date(serverTime));for(const {p} of sessions)await p.waitForFunction(()=>document.getElementById('raid-view')?.dataset.phase==='finished');
  const before=readCloud(members[0]).gems;await a.click('[data-raid-claim]');await a.waitForFunction(()=>document.querySelectorAll('[data-raid-claim]').length===0);assert(readCloud(members[0]).gems>before);
  await a.screenshot({path:path.join(OUT,'raid-result.png')});for(const {context} of sessions)await context.close();
  assert.deepEqual(errors,[]);assert.deepEqual(badAssets,[]);console.log('PASS five independent signed browser sessions: room/ready/start, same HP, five teams, reconnect once, finish/rewards, 568x280 755x330 2560x1440; JS/errors0');
 }catch(error){if(lastPage&&!lastPage.isClosed()){await lastPage.screenshot({path:path.join(OUT,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(OUT,'failure-dom.txt'),await lastPage.locator('body').innerText());}throw error;}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));t.sqlite.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
