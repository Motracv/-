// Real app controls, real battle settlement and signed disposable SQLite accounts.
// RNG/time are controlled only inside the local server fixture; no production save
// or browser engine state is edited after a session has started.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const G = require('../school/engine.js');
const { fixture } = require('./account-fixture.cjs');
const ROOT=path.resolve(__dirname,'..'), SAVE='school-mercenaries-v8', OUT='/tmp/school-counter';
const NOW=Date.parse('2026-11-19T03:00:00Z');
const SIZES=[{width:755,height:330},{width:568,height:280},{width:2560,height:1440}];
function seed(now=NOW) {
  const s=G.create(now-20000,123);s.team=['taeo','harin','sua','osia','lava','horas'];
  for(const id of s.team)s.units[id]={level:50,stars:3,xp:0,shards:0,nextSkill:1,basicHits:0};
  G.action(s,{kind:'stage',stage:1,mode:'farm'},s.at);
  for(const h of s.battle.heroes){h.hp=h.max=100000;h.atk=10;}
  for(const e of s.battle.enemies){e.hp=e.max=100000;e.atk=10;}
  for(let i=0;i<240&&!G.counterInfo(s).active;i++)G.advance(s,s.at+500);
  assert(G.counterInfo(s).active);const shift=now-s.at;s.at=now;s.counter.cooldownUntil+=shift;s.counter.opportunity.openedAt+=shift;s.counter.opportunity.expiresAt+=shift;
  for(const e of s.events)e.at+=shift;
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

 const fight=async p=>{await close(p);if(await p.locator('#app').getAttribute('data-tab')!=='adventure')await p.click('#lobby-resume');await p.waitForSelector('#counter-button:not([hidden])');};
 try{
  for(const viewport of [{width:755,height:330},{width:568,height:280},{width:2560,height:1440}]){
   const s=seed(),{p,context}=await open(s,{viewport,motion:'full'});await fight(p);await within(p,'#counter-button');
   assert.match(await p.locator('#counter-time').innerText(),/3\.5초/);await p.screenshot({path:path.join(OUT,`ready-${viewport.width}.png`)});
   await p.click('#battle-settings');await p.locator('#counter-button').waitFor({state:'hidden'});await close(p);await p.waitForSelector('#counter-button:not([hidden])');
   await p.locator('#counter-button').dblclick();await p.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).events.some(e=>e.kind==='counter'),SAVE);
   const after=await saved(p);assert.equal(after.events.filter(e=>e.kind==='counter').length,1);assert.equal(after.counter.opportunity,undefined);assert.equal(after.gems,s.gems);assert.equal(after.battle.damage.taeo.damage>=18,true);await p.locator('#counter-button').waitFor({state:'hidden'});await p.screenshot({path:path.join(OUT,`success-${viewport.width}.png`)});
   await p.reload();await ready(p);assert.equal((await saved(p)).counter.opportunity,undefined);assert.equal((await saved(p)).events.filter(e=>e.kind==='counter').length,1);await context.close();console.log('PASS',viewport,'counter visible, reachable, modal hides it, duplicate click once, reload');
  }
  const expired=await open(seed());await fight(expired.p);await expired.p.clock.setFixedTime(new Date(NOW+3500));await expired.p.locator('#counter-button').waitFor({state:'hidden'});assert.equal((await saved(expired.p)).events.filter(e=>e.kind==='counter').length,0);await expired.context.close();console.log('PASS timeout keeps automatic battle without counter damage');
  const a=await createAccount('A'),b=await createAccount('B'),session=await open(null,{account:a}),p=session.p;await fight(p);const other=readCloud(b);controls.set(a.token,{holdAction:true});await p.locator('#counter-button').dblclick();await p.waitForFunction(()=>JSON.parse(sessionStorage.getItem('school-confirmed-cloud-view')).state.events.some(e=>e.kind==='counter'));assert.equal(readCloud(a).events.filter(e=>e.kind==='counter').length,1);assert.deepEqual(readCloud(b),other);await p.reload();await ready(p);await p.waitForFunction(()=>document.querySelector('#account-label').textContent==='계정 저장');assert.equal(readCloud(a).counter.opportunity,undefined);
  const graphics=await p.evaluate(()=>{
   const canvas=document.createElement('canvas');canvas.width=960;canvas.height=560;const c=canvas.getContext('2d'),s=SchoolRPG.create(1000,77),h=s.battle.heroes[0],frames=[],widths=[];h.hp=20;h.max=100;
   SchoolArt.draw(c,s,1,[],false);h.hp=80;const events=[{kind:'heal',from:'sua',to:h.id,amount:60,time:1.1,battleId:s.battle.id},{kind:'hit',from:'harin',to:'e0',amount:8,time:1.1,battleId:s.battle.id},{kind:'hit',from:'taeo',to:'e0',amount:12,time:1.1,battleId:s.battle.id},{kind:'counter',from:'harin',to:'e0',time:1.1,battleId:s.battle.id}];
   const fill=c.fillRect.bind(c);let record=[];c.fillRect=(...args)=>{if(c.fillStyle==='#a4f6b6')record.push(args[2]);return fill(...args);};
   for(const time of [1.1,1.3,1.8]){record=[];SchoolArt.draw(c,s,time,events,false);frames.push(canvas.toDataURL());widths.push(record[0]??null);}
   return {frames,widths,labels:SchoolCombatFeedback.numbers(events,1.3),unchanged:h.hp};
  });assert.equal(graphics.unchanged,80);assert(graphics.widths[1]>graphics.widths[0]);assert.deepEqual(graphics.labels.map(e=>e.text),['+60','20']);graphics.frames.forEach((url,i)=>fs.writeFileSync(path.join(OUT,`heal-${i}.png`),Buffer.from(url.split(',')[1],'base64')));await session.context.close();
  assert.deepEqual(errors,[]);assert.deepEqual(badAssets,[]);fs.writeFileSync(path.join(OUT,'result.json'),JSON.stringify({errors,badAssets,hpWidths:graphics.widths},null,2));console.log('PASS signed server counter, account isolation, HP interpolation canvas, exact combined numbers; JS/asset errors0');
 }catch(error){if(lastPage&&!lastPage.isClosed()){await lastPage.screenshot({path:path.join(OUT,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(OUT,'failure-dom.txt'),await lastPage.locator('body').innerText());}throw error;}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));t.sqlite.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});


