// Real app controls, real battle settlement and signed disposable SQLite accounts.
// RNG/time are controlled only inside the local server fixture; no production save
// or browser engine state is edited after a session has started.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const G = require('../school/engine.js');
const { fixture } = require('./account-fixture.cjs');
const ROOT=path.resolve(__dirname,'..'), SAVE='school-mercenaries-v8', OUT='/tmp/school-bag';
const NOW=Date.parse('2026-11-19T03:00:00Z');
const SIZES=[{width:755,height:330},{width:568,height:280},{width:2560,height:1440}];
function seed(now=NOW) {
  const s=G.create(now,819);s.gold=12345;s.gems=6789;s.best=20;
  s.team=['taeo','geonu','horas','osia','lava','ian'];
  for(const h of G.HEROES)s.units[h.id]={level:100,xp:0,stars:5,shards:0};
  G.action(s,{kind:'stage',stage:20,mode:'farm'},now);assert(G.validate(s));return s;
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
   const credential=await clock(()=>t.credential(challenge.data.nonce,'bag-browser-'+letter));
   const login=await api(null,'/api/account/google',{nonce:challenge.data.nonce,credential});assert.equal(login.status,200);const who=login.data;
   s.commanderName='장비검증'+letter;
   t.sqlite.prepare('INSERT INTO school_saves(account_id,payload,revision,updated_at) VALUES(?,?,0,?)').run(who.profile.id,JSON.stringify(s),serverTime);
   const social=await api(who,'/api/school/social',{kind:'state'});assert.equal(social.status,200);return who;
 }


 const gear=async(p,id,item)=>{await home(p);await p.click(`#lobby-party [data-hero="${id}"]`);await p.click('[data-gear-slot="weapon"]');if(item){const bag=p.locator(`[data-gear-item="${item}"]`);await(await bag.isVisible()?bag:p.locator(`[data-gear-worn="${item}"]`)).click();}};
 const assertDialog=async p=>{await within(p,'#modal-close');const r=await p.locator('#modal').boundingBox(),v=p.viewportSize();assert(r.x>=0&&r.y>=0&&r.width<=v.width&&r.height<=v.height);assert(await p.locator('#modal').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'dialog horizontal overflow');};
 const waitGear=async(p,hero,item,cloud=false)=>{await p.waitForFunction(({key,hero,item,cloud})=>{const s=cloud?JSON.parse(sessionStorage.getItem('school-confirmed-cloud-view')).state:JSON.parse(localStorage.getItem(key));return (s.equipment.equipped[hero]?.weapon||null)===item;},{key:SAVE,hero,item,cloud});await p.locator('#gear-unequip').waitFor({state:item?'visible':'hidden'});};
 try{
  for(const [index,viewport] of [{width:755,height:330},{width:568,height:280},{width:390,height:844},{width:360,height:640},{width:2560,height:1440}].entries()){
   const s=seed();s.equipment.inventory={horas_orbit:{count:1,stars:0},osia_scepter:{count:2,stars:0},chalk_star:{count:3,stars:0}};
   const {p,context}=await open(s,{viewport});if(index%2){await p.evaluate(()=>document.documentElement.dataset.theme='dark');}
   await gear(p,'horas','horas_orbit');await assertDialog(p);await within(p,'#gear-back');await p.click('#gear-back');await p.waitForSelector('#train-hero');assert.equal(await p.locator('.gear-heading').count(),0);await p.click('[data-gear-slot="weapon"]');await p.click('[data-gear-item="horas_orbit"]');assert.match(await p.locator('#gear-exclusive').innerText(),/^착용 시/);assert.equal(await p.locator('[data-gear-item="lava_fan"]').isVisible(),false);await within(p,'#gear-equip');await within(p,'#gear-awaken');assert(await p.locator('#gear-awaken').isDisabled());
   await p.click('#gear-equip');await waitGear(p,'horas','horas_orbit');assert.equal(await p.locator('[data-gear-item="horas_orbit"]').isVisible(),false);assert.equal(await p.locator('[data-gear-worn="horas_orbit"]').isVisible(),true);assert.match(await p.locator('#gear-owned').innerText(),/총 1개 = 가방 0 \+ 착용 1/);await p.screenshot({path:path.join(OUT,`bag-${viewport.width}.png`)});
   await gear(p,'taeo','horas_orbit');assert(await p.locator('#gear-equip').isDisabled());assert.match(await p.locator('#gear-lock-note').innerText(),/호라스 착용 중/);assert.match(await p.locator('#gear-exclusive').innerText(),/^비활성/);const before=await saved(p);await p.locator('#gear-equip').evaluate(e=>{e.disabled=false;e.click();});assert.deepEqual((await saved(p)).equipment,before.equipment);assert(await p.locator('#gear-equip').isDisabled());
   await gear(p,'horas','horas_orbit');await within(p,'#gear-unequip');await p.click('#gear-unequip');await waitGear(p,'horas',null);assert(await p.locator('[data-gear-item="horas_orbit"]').isVisible());assert.equal((await saved(p)).equipment.inventory.horas_orbit.count,1);
   await gear(p,'taeo','horas_orbit');await p.click('#gear-equip');await waitGear(p,'taeo','horas_orbit');assert.equal((await saved(p)).equipment.equipped.horas,undefined);assert.equal((await saved(p)).equipment.inventory.horas_orbit.count,1);
   await gear(p,'osia','osia_scepter');await p.click('#gear-equip');await waitGear(p,'osia','osia_scepter');assert.match(await p.locator('#gear-owned').innerText(),/총 2개 = 가방 1 \+ 착용 1/);await p.click('#gear-awaken');await p.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).equipment.inventory.osia_scepter.stars===1,SAVE);assert.equal((await saved(p)).equipment.inventory.osia_scepter.count,1);assert(await p.locator('#gear-awaken').isDisabled());
   await p.click('[data-gear-filter="armor"]');assert(await p.locator('#gear-bag-empty').isVisible());assert(await p.locator('#gear-selected-content').isHidden());assert(await p.locator('#gear-equip').isDisabled());await assertDialog(p);
   await home(p);await p.click('#settings-button');await assertDialog(p);await within(p,'#settings-help');await p.screenshot({path:path.join(OUT,`settings-${viewport.width}.png`)});await p.click('#settings-diagnostics');const report=JSON.parse(await p.locator('#diagnostic-report').inputValue());assert.deepEqual(report.equipment.find(i=>i.id==='horas_orbit'),{id:'horas_orbit',count:1,free:0,stars:0,wearers:['taeo']});assert.equal(report.account.token,undefined);await close(p);await p.click('#captain-button');await assertDialog(p);await within(p,'#save-commander-name');await close(p);
   await p.reload();await ready(p);assert.equal((await saved(p)).equipment.inventory.horas_orbit.count,1);assert.equal((await saved(p)).equipment.equipped.taeo.weapon,'horas_orbit');assert.equal((await saved(p)).gems,s.gems);
   await context.close();console.log('PASS',viewport,'one copy blocked on second wearer, unequip/move, passive states, awakening, empty bag, vertical dialogs/reload');
  }
  const s=seed();s.equipment.inventory={horas_orbit:{count:1,stars:0}};const a=await createAccount('A',s),b=await createAccount('B',seed());const session=await open(null,{account:a}),p=session.p;await gear(p,'horas','horas_orbit');controls.set(a.token,{holdAction:true});await p.locator('#gear-equip').dblclick();await waitGear(p,'horas','horas_orbit',true);assert.equal(readCloud(a).equipment.inventory.horas_orbit.count,1);await gear(p,'osia','horas_orbit');assert(await p.locator('#gear-equip').isDisabled());assert.deepEqual(readCloud(b).equipment.inventory,{});await p.reload();await ready(p);await p.waitForFunction(()=>document.querySelector('#account-label').textContent==='계정 저장');await gear(p,'osia','horas_orbit');assert(await p.locator('#gear-equip').isDisabled());assert.equal(readCloud(a).equipment.equipped.osia,undefined);
  await close(p);await home(p);await p.click('#arena-button');await p.waitForSelector('#school-social');for(const viewport of [{width:390,height:844},{width:568,height:280},{width:2560,height:1440}]){await p.setViewportSize(viewport);await assertDialog(p);await p.screenshot({path:path.join(OUT,`arena-${viewport.width}.png`)});}await session.context.close();
  assert.deepEqual(errors,[]);assert.deepEqual(badAssets,[]);fs.writeFileSync(path.join(OUT,'result.json'),JSON.stringify({errors,badAssets,portrait:true,oneCopyOneWearer:true},null,2));console.log('PASS signed account double-click, second wearer disabled after reload, isolation and responsive arena; JS/asset errors0');
 }catch(e){if(lastPage&&!lastPage.isClosed()){await lastPage.screenshot({path:path.join(OUT,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(OUT,'failure-dom.txt'),await lastPage.locator('body').innerText());}console.log(JSON.stringify({errors,badAssets}));throw e;}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));t.sqlite.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
