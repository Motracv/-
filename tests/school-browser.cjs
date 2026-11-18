// UI integration uses real SQLite and test-signed Google tokens. It does not
// substitute for a personal Google login on the public origin.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {fixture}=require('./account-fixture.cjs');
const {installGuestSeed,seedGuest,enterBattle,runSchoolRegressions}=require('./school-ui-regressions.cjs');
const {runDisplayRegressions}=require('./school-display-regressions.cjs');
const {runCouponRegressions}=require('./school-coupon-browser.cjs');
const {runExpansionRegressions}=require('./school-expansion-browser.cjs');
const {runDungeonRegressions}=require('./school-dungeon-browser.cjs');
const {runPolishRegressions}=require('./school-polish-browser.cjs');
const {runPatchRegressions,runDungeonAccountSwitch}=require('./school-patch-browser.cjs');
const {runFrameCadence}=require('./school-frame-cadence.cjs');
(async()=>{
 const t=await fixture(),origin='http://127.0.0.1:8801';t.env.ALLOWED_ORIGIN=origin;
 let dropNext=false,actionRequests=0,stateDelay=0,blockedActionToken=null,failNextState=false;const schoolActionLog=[];
 const server=http.createServer(async(req,res)=>{
   try{
     const url=new URL(req.url,origin);
     if(url.pathname.startsWith('/api/')){
       const chunks=[];for await(const c of req)chunks.push(c);
       if(url.pathname==='/api/school/action'){
         const body=JSON.parse(Buffer.concat(chunks).toString()||'{}'),token=req.headers['x-account-session'];schoolActionLog.push({token,accountId:body.accountId,requestId:body.requestId,revision:body.revision});
         if(token===blockedActionToken){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'검증용: 요청 수신 전 연결 실패'}));return;}
       }
       if(url.pathname==='/api/school/state'&&failNextState){failNextState=false;res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'검증용: 새 계정 저장 첫 응답 실패'}));return;}
       if(url.pathname==='/api/school/state'&&stateDelay)await new Promise(resolve=>setTimeout(resolve,stateDelay));
       const r=await t.worker.fetch(new Request(url,{method:req.method,headers:req.headers,...(['GET','OPTIONS'].includes(req.method)?{}:{body:Buffer.concat(chunks)})}),t.env);
       if(url.pathname==='/api/school/action'){actionRequests++;if(dropNext){dropNext=false;res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'검증용: 저장 후 응답이 끊겼습니다.'}));return;}}
       res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));return;
     }
     const file=url.pathname.slice(1);if(!/^(school\.html|privacy\.html|index\.html|game\.html|school\.webmanifest|school-sw\.js|school\/(engine\.js|art\.js|client\.js|social\.js|social\.css|presentation\.js|presentation\.css|style\.css|install\.js|install\.css|lobby\.js|lobby\.css|world-map\.js|world-map\.css|battle\.css|horas\.css|assets\/horas\/(combat\.(webp|json)|portrait\.webp|cutin\.webp|pickup\.webp)|assets\/(osia-sprites|lava|dungeon-daily|dungeon-weekly|dungeon-tower|app-192|app-512)\.png|assets\/(lava-fan-basic|osia-front)\.webp|assets\/battlefields\/(classroom|garden|snow)\.webp|assets\/adventure\/region-(0[1-9]|1[0-2])\.webp|assets\/lobby\/(courtyard|icon-(adventure|arena|codex|dungeon|help|quests|ranking|recruit|supplies|winter))\.webp)|assets\/fonts\/(Galmuri11|PretendardVariable)\.woff2)$/.test(file)){res.writeHead(404);res.end();return;}
     let body=fs.readFileSync(path.join(__dirname,'..',file));if(file==='school/client.js')body=Buffer.from(body.toString().replace('https://motracv-card-room.densedormouse4.chatgpt.site',origin));
     const types={'.js':'text/javascript','.html':'text/html','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp','.webmanifest':'application/manifest+json'};res.writeHead(200,{'Content-Type':types[path.extname(file)]});res.end(body);
   }catch(e){res.writeHead(500);res.end(e.message);}
 });
 await new Promise(r=>server.listen(8801,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const errors=[];let sdkLoads=0,fixtureBrowser=0;
 async function pageFor(person,width=390,height=844,deviceScaleFactor=1,options={}){
   // Each test browser represents a separate client; account rate limits are tested in accounts.cjs.
   const contextOptions={viewport:{width,height},deviceScaleFactor,serviceWorkers:options.serviceWorkers||'block',reducedMotion:'reduce',extraHTTPHeaders:{'CF-Connecting-IP':`198.51.100.${++fixtureBrowser}`}};
   const context=options.persistent?await chromium.launchPersistentContext(fs.mkdtempSync('/tmp/school-install-test-'),{...contextOptions,executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']}):await browser.newContext(contextOptions);
   await installGuestSeed(context);
   await context.exposeBinding('fixtureCredential',(_,nonce,subject)=>t.credential(nonce,subject||person));
   await context.route('https://accounts.google.com/gsi/client',async route=>{sdkLoads++;await route.fulfill({contentType:'text/javascript',body:`window.google={accounts:{id:{initialize(o){this.o=o},renderButton(host){const b=document.createElement('button');b.id='fixture-login';b.textContent='Google로 로그인 (검증용)';b.onclick=async()=>this.o.callback({credential:await window.fixtureCredential(this.o.nonce,window.fixturePerson)});host.append(b)},disableAutoSelect(){}}}}`});});
   context.on('page',async page=>{
     if(options.orientation!==false)await page.addLocatorHandler(page.locator('#rotate-prompt:not([hidden])'),async()=>{await page.locator('#continue-landscape').click();});
     if(options.presentation!==false)await page.addLocatorHandler(page.locator('#school-presentation[open]'),async()=>{await page.locator('.presentation-skip').click();});
   });
   const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+'/school.html');await p.waitForFunction(()=>document.getElementById('boot-screen')?.hidden && document.querySelectorAll('#party [data-hero]').length>=1);if(options.battle!==false&&options.orientation!==false)await enterBattle(p);return p;
 }
 const saved=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('school-mercenaries-v8')));
 const tab=async(p,name)=>{if(name==='adventure')return enterBattle(p);if(await p.locator('#app').getAttribute('data-tab')==='adventure')await p.click('#battle-back');if(await p.locator('#app').getAttribute('data-tab')==='recruit')await p.click('.pickup-return');if(name==='lobby'){if(await p.locator('#app').getAttribute('data-tab')!=='lobby')await p.click('#home-button');return;}if(await p.locator('#app').getAttribute('data-tab')==='lobby')return p.click(`#lobby-nav [data-lobby-action="${name}"]`);return p.click(`.bottom-nav [data-tab="${name}"]`);};
 async function login(p){await p.click('#account-button');await p.click('#fixture-login');await p.waitForFunction(()=>document.getElementById('account-label').textContent==='계정 저장');}
 try{
   if(process.env.SCHOOL_SWITCH_ONLY==='1'){await runDungeonAccountSwitch({pageFor,saved,tab,t,login});assert.deepEqual(errors,[]);return;}
   if(process.env.SCHOOL_FRAMES_ONLY==='1'){await runFrameCadence({pageFor});assert.deepEqual(errors,[]);return;}
   if(process.env.SCHOOL_PATCH_ONLY==='1'){await runPatchRegressions({pageFor,saved,tab,t,login,origin});assert.deepEqual(errors,[]);return;}
   if(process.env.SCHOOL_POLISH_ONLY==='1'){await runPolishRegressions({pageFor,saved,tab,t,login,origin,setStateDelay:ms=>{stateDelay=ms;}});assert.deepEqual(errors,[]);return;}
   if(process.env.SCHOOL_DUNGEON_ONLY==='1'){await runDungeonRegressions({pageFor,saved,tab,t,login,dropNextAction:()=>{dropNext=true;}});assert.deepEqual(errors,[]);return;}
   if(process.env.SCHOOL_EXPANSION_ONLY==='1'){await runExpansionRegressions({pageFor,saved,tab,t,login});assert.deepEqual(errors,[]);return;}
   if(process.env.SCHOOL_COUPON_ONLY==='1'){await runCouponRegressions({pageFor,saved,tab,t,login,dropNextAction:()=>{dropNext=true;}});assert.deepEqual(errors,[]);return;}
   if(process.env.SCHOOL_DISPLAY_ONLY==='1'){await runDisplayRegressions({pageFor,tab});assert.deepEqual(errors,[]);return;}
   if(process.env.SCHOOL_LEGACY_ONLY!=='1'){
   if(process.env.SCHOOL_AFTER_DUNGEON_ONLY!=='1'){
   await runFrameCadence({pageFor});
   if(process.env.SCHOOL_REMAINING_ONLY!=='1')await runPatchRegressions({pageFor,saved,tab,t,login,origin});
   if(process.env.SCHOOL_REMAINING_ONLY!=='1')await runPolishRegressions({pageFor,saved,tab,t,login,origin,setStateDelay:ms=>{stateDelay=ms;}});
   await runDungeonRegressions({pageFor,saved,tab,t,login,dropNextAction:()=>{dropNext=true;}});
   }
   await runExpansionRegressions({pageFor,saved,tab,t,login});
   await runCouponRegressions({pageFor,saved,tab,t,login,dropNextAction:()=>{dropNext=true;}});
   await runSchoolRegressions({pageFor,saved,origin,errors,t,login,setStateDelay:ms=>{stateDelay=ms;},setActionBlock:value=>{blockedActionToken=value;},failStateOnce:()=>{failNextState=true;},schoolActionLog});
   if(process.env.SCHOOL_SAVE_ONLY==='1')return;
   }
   const sdkBefore=sdkLoads,p=await pageFor('same-person');assert.equal(sdkLoads,sdkBefore);assert.equal(await p.evaluate(()=>SchoolArt.assetsReady()),true);
   for(const [width,height]of[[390,844],[360,640],[320,568],[360,500],[844,390],[568,280],[1280,800],[1440,900]]){
     await p.setViewportSize({width,height});await tab(p,'adventure');
     const box=await p.evaluate(()=>{const controls=[...document.querySelectorAll('.bottom-nav button')].map(el=>el.getBoundingClientRect()),nav={top:Math.min(...controls.map(r=>r.top)),bottom:Math.max(...controls.map(r=>r.bottom))},battle=document.getElementById('battle').getBoundingClientRect();return{scroll:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth,h:innerHeight,w:innerWidth,navTop:nav.top,navBottom:nav.bottom,battleBottom:battle.bottom,battleHeight:battle.height};});
     assert.ok(box.scroll<=height+1,JSON.stringify(box));assert.ok(box.width<=width+1,JSON.stringify(box));assert.ok(box.navBottom<=height+1&&box.navTop>=0,JSON.stringify(box));assert.ok(box.battleHeight>50&&box.battleBottom<=height+1,JSON.stringify(box));
     await p.click('#battle-stage');await p.waitForSelector('#map-start');await p.click('#modal-close');
     for(const name of ['recruit','supplies']){await tab(p,name);const bottoms=await p.locator('.bottom-nav button').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().bottom));assert.ok(bottoms.every(bottom=>bottom<=height+1));}
   }
   console.log('PASS eight mobile/landscape/desktop viewports: canvas, six-item navigation, map, recruitment and supplies');
   await runDisplayRegressions({pageFor,tab});
   await tab(p,'recruit');await p.click('#feature-osia-button');assert.match(await p.locator('#modal-content').innerText(),/Osia · 물고기 종족 · 물 속성/);await p.click('#modal-close');
   await tab(p,'recruit');await p.click('#rates-button');assert.match(await p.locator('#modal-content').innerText(),/오시아/);assert.match(await p.locator('#modal-content').innerText(),/50%/);await p.click('#modal-close');
   assert.equal(await p.locator('#pity-count').textContent(),'0 / 80');assert.equal(await p.locator('#next-ssr-chance').textContent(),'다음 SSR 1%');
   await p.setViewportSize({width:390,height:844});await tab(p,'recruit');await p.screenshot({path:'/tmp/school-tested-recruit.png'});
   await p.click('#recruit-ten');await p.waitForSelector('.result-card');assert.equal(await p.locator('.result-card').count(),10);assert.equal((await saved(p)).pulls,10);assert.equal((await saved(p)).gems,200);
   assert.ok(await p.locator('.result-card.SR,.result-card.SSR').count()>=1);await p.screenshot({path:'/tmp/school-tested-reveal.png'});await p.click('#reveal-done');
   await tab(p,'adventure');await p.click('#party [data-hero="harin"]');await p.click('#train-hero');await p.waitForFunction(()=>JSON.parse(localStorage.getItem('school-mercenaries-v8')).units.harin.level>=2);await p.click('[data-slot="0"]');await p.waitForFunction(()=>!document.getElementById('modal').open);assert.equal((await saved(p)).team[0],'harin');
   await p.reload();assert.equal((await saved(p)).team[0],'harin');assert.equal((await saved(p)).pulls,10);console.log('PASS guest 10-pull guarantee, training, formation and reload persistence');
   {const s=await saved(p);s.at=Date.now()-12*3600000;await seedGuest(p,s);}await tab(p,'supplies');await p.click('#claim-offline');await p.waitForFunction(()=>JSON.parse(localStorage.getItem('school-mercenaries-v8')).offline.seconds===0);assert.ok((await saved(p)).units.harin.level>2);await p.click('#claim-daily');await p.waitForFunction(()=>document.getElementById('claim-daily').disabled);console.log('PASS offline bank collection and daily claim in browser');
   const guestPulls=(await saved(p)).pulls,accountsBefore=t.sqlite.prepare('SELECT count(*) AS n FROM school_saves').get().n;await login(p);const mainAccount=await p.evaluate(()=>JSON.parse(sessionStorage.getItem('school-confirmed-cloud-view')).profile.id);assert.equal((await saved(p)).pulls,guestPulls);assert.equal(await p.locator('#gems').textContent(),'1,800');assert.equal(t.sqlite.prepare('SELECT count(*) AS n FROM school_saves').get().n,accountsBefore+1);console.log('PASS signed Google fixture creates separate cloud progress without overwriting guest');
   await tab(p,'recruit');dropNext=true;await p.click('#recruit-ten');await p.waitForSelector('#connection:not([hidden])');assert.ok(await p.locator('#recruit-ten').isDisabled());
   assert.equal(JSON.parse(t.sqlite.prepare('SELECT payload FROM school_saves WHERE account_id=?').get(mainAccount).payload).pulls,10);
   await p.reload();await p.waitForSelector('.result-card');assert.equal(await p.locator('.result-card').count(),10);assert.equal(JSON.parse(t.sqlite.prepare('SELECT payload FROM school_saves WHERE account_id=?').get(mainAccount).payload).pulls,10);assert.equal(JSON.parse(t.sqlite.prepare('SELECT payload FROM school_saves WHERE account_id=?').get(mainAccount).payload).gems,200);await p.click('#modal-close');console.log('PASS lost network response + reload recovers same draw and charges only once');
   const other=await pageFor('same-person',844,390);await login(other);assert.equal(await other.locator('#gems').textContent(),'200');await tab(other,'recruit');await other.click('#recruit-one');await other.waitForSelector('.result-card');await other.click('#modal-close');
   await p.click('#account-button');await p.click('#cloud-refresh');await p.waitForFunction(()=>document.getElementById('gems').textContent==='100');await p.click('#guest-return');assert.equal((await saved(p)).pulls,guestPulls);console.log('PASS same-account second browser sync and explicit return to preserved guest save');
   const osia=await pageFor('osia-guest',844,390);await osia.emulateMedia({reducedMotion:'no-preference'});await osia.reload();await tab(osia,'recruit');
   {const s=await saved(osia);s.gold=777;s.gems=1900;s.pity=7;delete s.banners;s.units.harin.level=3;await seedGuest(osia,s,'school-mercenaries-v1');}
   assert.equal((await saved(osia)).gold,777);assert.equal((await saved(osia)).gems,1900);assert.equal((await saved(osia)).pity,7);assert.equal((await saved(osia)).units.harin.level,3);await tab(osia,'recruit');
   await osia.evaluate(()=>{window.normalRandom=Math.random;let i=0;Math.random=()=>++i%2?.001:.1;});await osia.click('#recruit-one');await osia.waitForSelector('.result-card');await osia.evaluate(()=>{Math.random=window.normalRandom;});
   assert.match(await osia.locator('.result-card').innerText(),/오시아/);assert.equal((await saved(osia)).gems,1800);await osia.screenshot({path:'/tmp/osia-browser-recruit.png'});
   await osia.evaluate(()=>{localStorage.setItem('school-mercenaries-v1',JSON.stringify(SchoolRPG.create(Date.now())));});assert.ok((await saved(osia)).units.osia);console.log('PASS legacy guest save migration preserves progress; stale tabs cannot overwrite the new hero');
   await osia.click('#reveal-done');await osia.click('#roster [data-form-detail="osia"]');await osia.locator('.hero-skills summary').click();assert.match(await osia.locator('#modal-content').innerText(),/220%/);assert.match(await osia.locator('#modal-content').innerText(),/패시브 · 용왕의 권능/);assert.match(await osia.locator('#modal-content').innerText(),/1.5초 기절/);await osia.click('[data-slot="1"]');await osia.waitForFunction(()=>!document.getElementById('modal').open);
   await seedGuest(osia,await osia.evaluate(()=>{const s=JSON.parse(localStorage.getItem('school-mercenaries-v8'));s.units.osia.nextSkill=1;SchoolRPG.action(s,{kind:'stage',stage:1,mode:'farm'});for(const e of s.battle.enemies){e.hp=e.max=10000;e.atk=1;}s.at=Date.now();return s;}));
   await osia.evaluate(()=>{
     const draw=SchoolArt.draw;window.osiaOriginalDraw=draw;window.osiaFrames={};window.dragonFrames={};window.osiaTimeline=[];window.osiaSteps=[];window.osiaLabels=[];let last=0;
     SchoolArt.draw=function(c,s,t,events,reduced){
       const labels=[],fill=c.fillText;c.fillText=function(text,...args){labels.push(text);return fill.call(this,text,...args);};draw(c,s,t,events,reduced);c.fillText=fill;
       for(const e of s.events.filter(e=>e.seq>last&&e.from==='osia'))window.osiaTimeline.push(e);last=s.seq;
       const status=document.getElementById('battle-status').textContent;if(!window.osiaLabels.includes(status))window.osiaLabels.push(status);
       const phase=events.findLast(e=>e.kind==='skill-stage'&&e.from==='osia'),age=phase?t-phase.time:-1;
       // Compare effects at a fixed logical resolution; the live canvas now
       // matches each display's physical pixels and can be much larger.
       const snapshot=(shownEvents=events)=>{const canvas=document.createElement('canvas');canvas.width=480;canvas.height=280;const ctx=canvas.getContext('2d');draw(ctx,s,t,shownEvents,reduced);return ctx;};
       const picture=()=>({png:snapshot().canvas.toDataURL(),labels,at:phase.at,stunned:s.battle.enemies.filter(e=>e.stunUntil>s.battle.elapsed).length,skillHits:s.events.filter(e=>e.kind==='hit'&&e.castId===phase.castId).length});
       if(phase&&age>.16&&age<.4&&!window.osiaFrames[phase.stage])window.osiaFrames[phase.stage]=picture();
       if(phase?.stage===4){
         const part=age>1.16&&age<1.4?'summon':age>1.65&&age<1.9?'rush':age>2.06&&age<2.45&&!s.battle.osiaCast?'impact':null;
         if(part&&!window.dragonFrames[part]){window.dragonFrames[part]=picture();if(part==='impact'){window.osiaStunUntil=s.battle.enemies[0].stunUntil;window.osiaFinalSnapshot=JSON.parse(JSON.stringify({s,t,events}));}}
       }
       if(!window.osiaBasicPNG&&events.some(e=>e.kind==='hit'&&e.from==='osia'&&!e.skill&&t-e.time>.1&&t-e.time<.25)){
         const actual=snapshot(),base=snapshot(events.filter(e=>e.from!=='osia'));window.osiaBasicPNG=actual.canvas.toDataURL();
         const blue=ctx=>{const a=ctx.getImageData(0,0,480,280).data;let n=0;for(let i=0;i<a.length;i+=4)if(a[i+2]>a[i]+40&&a[i+1]>a[i]+30)n++;return n;};window.osiaBombPixels=blue(actual)-blue(base);
       }
       if(window.osiaStunUntil&&!window.osiaSteps.some(e=>e.elapsed===s.battle.elapsed))window.osiaSteps.push({elapsed:s.battle.elapsed,remaining:window.osiaStunUntil-s.battle.elapsed,attacks:s.events.filter(e=>e.kind==='hit'&&e.side==='hero'&&e.at===s.at).length});
     };
   });
   await osia.waitForFunction(()=>window.osiaTimeline.filter(e=>e.kind==='skill-stage').length>=5&&Object.keys(window.dragonFrames).length===3,{},{timeout:40000});
   const timeline=await osia.evaluate(()=>window.osiaTimeline),casts=timeline.filter(e=>e.kind==='skill-stage').slice(0,5);assert.deepEqual(casts.map(e=>e.stage),[1,2,3,4,1]);
   for(let i=1;i<5;i++){assert.equal(casts[i].at-casts[i-1].at,i===4?6000:5000);assert.ok(timeline.filter(e=>e.kind==='hit'&&!e.skill&&e.at>casts[i-1].at&&e.at<casts[i].at).length>=3);}
   const frames=await osia.evaluate(()=>window.osiaFrames),dragon=await osia.evaluate(()=>window.dragonFrames);assert.equal(new Set(Object.values(frames).map(f=>f.png)).size,4);assert.equal(new Set(Object.values(dragon).map(f=>f.png)).size,3);
   for(const stage of [1,2,3,4])fs.writeFileSync(`/tmp/osia-cycle-skill-${stage}.png`,Buffer.from(frames[stage].png.split(',')[1],'base64'));
   for(const part of ['summon','rush','impact'])fs.writeFileSync(`/tmp/osia-dragon-${part}.png`,Buffer.from(dragon[part].png.split(',')[1],'base64'));
   fs.writeFileSync('/tmp/osia-water-bomb.png',Buffer.from((await osia.evaluate(()=>window.osiaBasicPNG)).split(',')[1],'base64'));
   assert.ok(await osia.evaluate(()=>window.osiaBombPixels>50),'A visible water bomb must travel on basic attacks');
   assert.equal(dragon.summon.stunned,0);assert.equal(dragon.summon.skillHits,0);assert.equal(dragon.rush.stunned,0);assert.equal(dragon.rush.skillHits,0);assert.equal(dragon.impact.stunned,3);assert.equal(dragon.impact.skillHits,3);assert.equal(dragon.impact.labels.filter(t=>t==='기절 1.5초').length,3);
   const stun=await osia.evaluate(()=>window.osiaSteps);assert.ok(stun.some(e=>e.remaining===500&&e.attacks===0));assert.ok(stun.some(e=>e.remaining===0));assert.ok(stun.some(e=>e.remaining===-500&&e.attacks===3));
   const next=await osia.evaluate(()=>window.osiaLabels);for(const part of ['다음 1/4','다음 2/4','다음 3/4','다음 4/4'])assert.ok(next.some(t=>t.includes(part)));
   const accessible=await osia.evaluate(()=>{const {s,t,events}=window.osiaFinalSnapshot,canvas=document.createElement('canvas');canvas.width=480;canvas.height=280;const c=canvas.getContext('2d'),labels=[],fill=c.fillText;c.fillText=function(text,...args){labels.push(text);return fill.call(this,text,...args);};window.osiaOriginalDraw(c,s,t,events,true);return labels;});assert.ok(accessible.includes('스킬 4/4 · 거대 수룡 명중!'));assert.equal(accessible.filter(t=>t==='기절 1.5초').length,3);
   const waiting=await osia.evaluate(()=>{const snap=JSON.parse(JSON.stringify(window.osiaFinalSnapshot)),phase=snap.events.find(e=>e.kind==='skill-stage'&&e.stage===4);snap.s.battle.osiaCast={id:phase.castId,stage:4};snap.s.battle.elapsed=20500;snap.s.battle.enemies.forEach(e=>delete e.stunUntil);snap.events=snap.events.filter(e=>e.kind!=='skill-impact');const c=document.createElement('canvas').getContext('2d'),labels=[];c.fillText=text=>labels.push(text);window.osiaOriginalDraw(c,snap.s,phase.time+1.6,snap.events,false);return labels;});assert.ok(waiting.includes('스킬 4/4 · 거대 수룡 돌진'));assert.ok(!waiting.some(t=>t.includes('명중!')||t.includes('기절')));
   console.log('PASS 1→2→3→4→1 on separate cooldowns, basics between casts, next-skill UI, summon/rush/impact animation, impact-only stun and reduced motion');
   await osia.reload();assert.equal((await saved(osia)).team[1],'osia');assert.equal((await saved(osia)).units.osia.level,1);
   await tab(osia,'adventure');await osia.click('#party [data-hero="osia"]');await osia.click('#train-hero');await osia.waitForFunction(()=>JSON.parse(localStorage.getItem('school-mercenaries-v8')).units.osia.level===2);await osia.screenshot({path:'/tmp/osia-browser-detail.png'});
   console.log('PASS Osia draw, right-facing atlas, passive explanation, formation/reload/training and updated odds');
   await osia.click('#modal-close');{const s=await saved(osia);s.pity=59;delete s.banners;await seedGuest(osia,s,'school-mercenaries-v4');}await tab(osia,'recruit');
   assert.equal((await saved(osia)).pity,59);assert.equal(await osia.locator('#pity-count').textContent(),'59 / 80');assert.equal(await osia.locator('#next-ssr-chance').textContent(),'다음 SSR 2%');
   await osia.click('#rates-button');assert.match(await osia.locator('#modal-content').innerText(),/다음 60회째 확률/);await osia.click('#modal-close');
   await osia.evaluate(()=>{window.normalRandom=Math.random;Math.random=()=>.99;});await osia.click('#recruit-one');await osia.waitForSelector('.result-card');await osia.evaluate(()=>Math.random=window.normalRandom);await osia.click('#modal-close');assert.equal((await saved(osia)).pity,60);assert.equal(await osia.locator('#next-ssr-chance').textContent(),'다음 SSR 3%');
   {const s=await saved(osia);s.pity=79;s.banners.osia.pity=79;await seedGuest(osia,s);}await tab(osia,'recruit');assert.equal(await osia.locator('#pity-left').textContent(),'1');assert.equal(await osia.locator('#next-ssr-chance').textContent(),'다음 SSR 100%');await osia.screenshot({path:'/tmp/school-hard-pity-public-preview.png'});
   await osia.evaluate(()=>{window.normalRandom=Math.random;Math.random=()=>.99;});await osia.click('#recruit-one');await osia.waitForSelector('.result-card.SSR');await osia.evaluate(()=>Math.random=window.normalRandom);await osia.click('#modal-close');assert.equal((await saved(osia)).pity,0);assert.equal(await osia.locator('#next-ssr-chance').textContent(),'다음 SSR 1%');console.log('PASS existing 59-count migration, next-chance UI, gradual increase and 80th SSR/reset');
   const prior=(await saved(p)).kills;await tab(p,'adventure');await p.waitForTimeout(11000);assert.ok((await saved(p)).kills>prior);await p.screenshot({path:'/tmp/school-tested-mobile.png'});assert.deepEqual(errors,[]);console.log('PASS unattended combat continues and browser has no JavaScript exceptions');
   console.log('School browser verification passed; action requests:',actionRequests);
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));t.sqlite.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
