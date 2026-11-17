// UI integration uses real SQLite and test-signed Google tokens. It does not
// substitute for a personal Google login on the public origin.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {fixture}=require('./account-fixture.cjs');
(async()=>{
 const t=await fixture(),origin='http://127.0.0.1:8801';t.env.ALLOWED_ORIGIN=origin;
 let dropNext=false,actionRequests=0;
 const server=http.createServer(async(req,res)=>{
   try{
     const url=new URL(req.url,origin);
     if(url.pathname.startsWith('/api/')){
       const chunks=[];for await(const c of req)chunks.push(c);
       const r=await t.worker.fetch(new Request(url,{method:req.method,headers:req.headers,...(['GET','OPTIONS'].includes(req.method)?{}:{body:Buffer.concat(chunks)})}),t.env);
       if(url.pathname==='/api/school/action'){actionRequests++;if(dropNext){dropNext=false;res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'검증용: 저장 후 응답이 끊겼습니다.'}));return;}}
       res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));return;
     }
     const file=url.pathname.slice(1);if(!/^(school\.html|privacy\.html|school\/(engine\.js|art\.js|client\.js|style\.css|assets\/osia-sprites\.png)|assets\/fonts\/(Galmuri11|PretendardVariable)\.woff2)$/.test(file)){res.writeHead(404);res.end();return;}
     let body=fs.readFileSync(path.join(__dirname,'..',file));if(file==='school/client.js')body=Buffer.from(body.toString().replace('https://motracv-card-room.densedormouse4.chatgpt.site',origin));
     const types={'.js':'text/javascript','.html':'text/html','.css':'text/css','.woff2':'font/woff2','.png':'image/png'};res.writeHead(200,{'Content-Type':types[path.extname(file)]});res.end(body);
   }catch(e){res.writeHead(500);res.end(e.message);}
 });
 await new Promise(r=>server.listen(8801,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const errors=[];let sdkLoads=0;
 async function pageFor(person,width=390,height=844){
   const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
   await context.exposeBinding('fixtureCredential',(_,nonce)=>t.credential(nonce,person));
   await context.route('https://accounts.google.com/gsi/client',async route=>{sdkLoads++;await route.fulfill({contentType:'text/javascript',body:`window.google={accounts:{id:{initialize(o){this.o=o},renderButton(host){const b=document.createElement('button');b.id='fixture-login';b.textContent='Google로 로그인 (검증용)';b.onclick=async()=>this.o.callback({credential:await window.fixtureCredential(this.o.nonce)});host.append(b)},disableAutoSelect(){}}}}`});});
   const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+'/school.html');await p.waitForFunction(()=>document.querySelectorAll('.party-card').length===3);return p;
 }
 const saved=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('school-mercenaries-v4')));
 const tab=(p,name)=>p.click(`.bottom-nav [data-tab="${name}"]`);
 async function login(p){await p.click('#account-button');await p.click('#fixture-login');await p.waitForFunction(()=>document.getElementById('account-label').textContent==='계정 저장');}
 try{
   const p=await pageFor('same-person');assert.equal(sdkLoads,0);assert.equal(await p.evaluate(()=>SchoolArt.assetsReady()),true);
   for(const [width,height]of[[390,844],[360,640],[320,568],[844,390],[568,280],[1280,800]]){
     await p.setViewportSize({width,height});await tab(p,'adventure');
     const box=await p.evaluate(()=>{const nav=document.querySelector('.bottom-nav').getBoundingClientRect(),battle=document.getElementById('battle').getBoundingClientRect();return{scroll:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth,h:innerHeight,w:innerWidth,navTop:nav.top,navBottom:nav.bottom,battleBottom:battle.bottom,battleHeight:battle.height};});
     assert.ok(box.scroll<=height+1,JSON.stringify(box));assert.ok(box.width<=width+1,JSON.stringify(box));assert.ok(box.navBottom<=height+1&&box.navTop>=0,JSON.stringify(box));assert.ok(box.battleHeight>50&&box.battleBottom<=box.navTop,JSON.stringify(box));
     await p.click('#battle-stage');await p.waitForSelector('#next-stage');await p.click('#modal-close');
     for(const name of ['roster','recruit','supplies']){await tab(p,name);const nav=await p.locator('.bottom-nav').boundingBox();assert.ok(nav.y+nav.height<=height+1);}
   }
   console.log('PASS six mobile/landscape/desktop viewports: canvas, navigation, map, roster/recruit/supply tabs');
   await tab(p,'recruit');await p.click('#feature-osia-button');assert.match(await p.locator('#modal-content').innerText(),/Osia · 물고기 종족 · 물 속성/);await p.click('#modal-close');
   await tab(p,'recruit');await p.click('#rates-button');assert.match(await p.locator('#modal-content').innerText(),/SSR · 3명/);assert.match(await p.locator('#modal-content').innerText(),/1\.3333%/);await p.click('#modal-close');
   assert.equal(await p.locator('#pity-count').textContent(),'0 / 80');assert.equal(await p.locator('#next-ssr-chance').textContent(),'다음 SSR 4%');
   await p.setViewportSize({width:390,height:844});await tab(p,'recruit');await p.screenshot({path:'/tmp/school-tested-recruit.png'});
   await p.click('#recruit-ten');await p.waitForSelector('.result-card');assert.equal(await p.locator('.result-card').count(),10);assert.equal((await saved(p)).pulls,10);assert.equal((await saved(p)).gems,900);
   assert.ok(await p.locator('.result-card.SR,.result-card.SSR').count()>=1);await p.screenshot({path:'/tmp/school-tested-reveal.png'});await p.click('#reveal-done');
   await p.click('#roster [data-hero="harin"]');await p.click('#train-hero');await p.waitForFunction(()=>JSON.parse(localStorage.getItem('school-mercenaries-v4')).units.harin.level>=2);await p.click('[data-slot="0"]');await p.waitForFunction(()=>!document.getElementById('modal').open);assert.equal((await saved(p)).team[0],'harin');
   await p.reload();assert.equal((await saved(p)).team[0],'harin');assert.equal((await saved(p)).pulls,10);console.log('PASS guest 10-pull guarantee, training, formation and reload persistence');
   await p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('school-mercenaries-v4'));s.at=Date.now()-12*3600000;localStorage.setItem('school-mercenaries-v4',JSON.stringify(s));});await p.reload();await tab(p,'supplies');await p.click('#claim-offline');await p.waitForFunction(()=>JSON.parse(localStorage.getItem('school-mercenaries-v4')).offline.seconds===0);assert.ok((await saved(p)).units.harin.level>2);await p.click('#claim-daily');await p.waitForFunction(()=>document.getElementById('claim-daily').disabled);console.log('PASS offline bank collection and daily claim in browser');
   const guestPulls=(await saved(p)).pulls;await login(p);assert.equal((await saved(p)).pulls,guestPulls);assert.equal(await p.locator('#gems').textContent(),'1,800');assert.equal(t.sqlite.prepare('SELECT count(*) AS n FROM school_saves').get().n,1);console.log('PASS signed Google fixture creates separate cloud progress without overwriting guest');
   await tab(p,'recruit');dropNext=true;await p.click('#recruit-ten');await p.waitForSelector('#connection:not([hidden])');assert.ok(await p.locator('#recruit-ten').isDisabled());
   assert.equal(JSON.parse(t.sqlite.prepare('SELECT payload FROM school_saves').get().payload).pulls,10);
   await p.reload();await p.waitForSelector('.result-card');assert.equal(await p.locator('.result-card').count(),10);assert.equal(JSON.parse(t.sqlite.prepare('SELECT payload FROM school_saves').get().payload).pulls,10);assert.equal(JSON.parse(t.sqlite.prepare('SELECT payload FROM school_saves').get().payload).gems,900);await p.click('#modal-close');console.log('PASS lost network response + reload recovers same draw and charges only once');
   const other=await pageFor('same-person',844,390);await login(other);assert.equal(await other.locator('#gems').textContent(),'900');await tab(other,'recruit');await other.click('#recruit-one');await other.waitForSelector('.result-card');await other.click('#modal-close');
   await p.click('#account-button');await p.click('#cloud-refresh');await p.waitForFunction(()=>document.getElementById('gems').textContent==='800');await p.click('#guest-return');assert.equal((await saved(p)).pulls,guestPulls);console.log('PASS same-account second browser sync and explicit return to preserved guest save');
   const osia=await pageFor('osia-guest',844,390);await osia.emulateMedia({reducedMotion:'no-preference'});await osia.reload();await tab(osia,'recruit');
   await osia.evaluate(()=>{const s=JSON.parse(localStorage.getItem('school-mercenaries-v4'));s.gold=777;s.gems=1900;s.pity=7;s.units.harin.level=3;localStorage.setItem('school-mercenaries-v1',JSON.stringify(s));localStorage.removeItem('school-mercenaries-v4');});await osia.reload();
   assert.equal((await saved(osia)).gold,777);assert.equal((await saved(osia)).gems,1900);assert.equal((await saved(osia)).pity,7);assert.equal((await saved(osia)).units.harin.level,3);await tab(osia,'recruit');
   await osia.evaluate(()=>{window.normalRandom=Math.random;let i=0;Math.random=()=>++i%2?.01:.99;});await osia.click('#recruit-one');await osia.waitForSelector('.result-card');await osia.evaluate(()=>{Math.random=window.normalRandom;});
   assert.match(await osia.locator('.result-card').innerText(),/오시아/);assert.equal((await saved(osia)).gems,1800);await osia.screenshot({path:'/tmp/osia-browser-recruit.png'});
   await osia.evaluate(()=>{localStorage.setItem('school-mercenaries-v1',JSON.stringify(SchoolRPG.create(Date.now())));});assert.ok((await saved(osia)).units.osia);console.log('PASS legacy guest save migration preserves progress; stale tabs cannot overwrite the new hero');
   await osia.click('#reveal-done');await osia.click('#roster [data-hero="osia"]');assert.match(await osia.locator('#modal-content').innerText(),/220%/);assert.match(await osia.locator('#modal-content').innerText(),/패시브 · 용왕의 권능/);assert.match(await osia.locator('#modal-content').innerText(),/1.5초 기절/);await osia.click('[data-slot="1"]');await osia.waitForFunction(()=>!document.getElementById('modal').open);
   await osia.evaluate(()=>{const s=JSON.parse(localStorage.getItem('school-mercenaries-v4'));for(const e of s.battle.enemies){e.hp=e.max=10000;e.atk=1;}s.at=Date.now();localStorage.setItem('school-mercenaries-v4',JSON.stringify(s));});await osia.reload();
   await osia.evaluate(()=>{
     const draw=SchoolArt.draw;window.osiaFrames={};window.osiaSteps=[];window.osiaStunFinished=false;
     SchoolArt.draw=function(c,s,t,events,reduced){
       const labels=[],fill=c.fillText;c.fillText=function(text,...args){labels.push(text);return fill.call(this,text,...args);};
       draw(c,s,t,events,reduced);c.fillText=fill;
       const phase=events.findLast(e=>e.kind==='skill-stage'&&e.from==='osia'&&t-e.time>.16&&t-e.time<.4);
       if(phase){
         window.osiaComboId??=phase.castId;
         if(phase.castId===window.osiaComboId&&!window.osiaFrames[phase.stage]){
           const base=document.createElement('canvas');base.width=480;base.height=280;draw(base.getContext('2d'),s,t,[],false);
           const count=ctx=>{const a=ctx.getImageData(0,0,480,280).data;let n=0;for(let i=0;i<a.length;i+=4)if(a[i+2]>a[i]+40&&a[i+1]>a[i]+30)n++;return n;};
           window.osiaFrames[phase.stage]={png:c.canvas.toDataURL(),waterPixels:count(c)-count(base.getContext('2d')),labels,at:phase.at};
           if(phase.stage===4){window.osiaStunUntil=s.battle.enemies[0].stunUntil;window.osiaFinalSnapshot=JSON.parse(JSON.stringify({s,t,events}));}
         }
       }
       if(window.osiaStunUntil){
         const remaining=window.osiaStunUntil-s.battle.elapsed;if(!window.osiaSteps.some(e=>e.elapsed===s.battle.elapsed))window.osiaSteps.push({elapsed:s.battle.elapsed,remaining,attacks:s.events.filter(e=>e.kind==='hit'&&e.side==='hero'&&e.at===s.at).length});
         if(remaining<=0)window.osiaStunFinished=true;
       }
     };
   });
   await osia.waitForFunction(()=>Object.keys(window.osiaFrames).length===4&&window.osiaStunFinished,{},{timeout:20000});
   const frames=await osia.evaluate(()=>window.osiaFrames);assert.equal(new Set(Object.values(frames).map(f=>f.png)).size,4);
   for(const stage of [1,2,3,4]){assert.ok(frames[stage].waterPixels>150,JSON.stringify({stage,pixels:frames[stage].waterPixels}));assert.equal(frames[stage].at,frames[1].at+(stage-1)*500);fs.writeFileSync(`/tmp/osia-combo-stage-${stage}.png`,Buffer.from(frames[stage].png.split(',')[1],'base64'));}
   assert.ok(frames[4].waterPixels>1000);assert.ok(frames[4].labels.includes('용왕의 해일 · 거대 수룡!'));assert.equal(frames[4].labels.filter(t=>t==='기절 1.5초').length,3);
   const stun=await osia.evaluate(()=>window.osiaSteps);assert.ok(stun.some(e=>e.remaining===500&&e.attacks===0));assert.ok(stun.some(e=>e.remaining===0&&e.attacks===3));
   const accessible=await osia.evaluate(()=>{const {s,t,events}=window.osiaFinalSnapshot,canvas=document.createElement('canvas');canvas.width=480;canvas.height=280;const c=canvas.getContext('2d'),labels=[],fill=c.fillText;c.fillText=function(text,...args){labels.push(text);return fill.call(this,text,...args);};SchoolArt.draw(c,s,t,events,true);return labels;});assert.ok(accessible.includes('용왕의 해일 · 거대 수룡!'));assert.equal(accessible.filter(t=>t==='기절 1.5초').length,3);
   console.log('PASS four distinct live combo frames, 500ms spacing, three stun indicators, attack suppression/resume and reduced-motion rendering');
   await osia.reload();assert.equal((await saved(osia)).team[1],'osia');assert.equal((await saved(osia)).units.osia.level,1);
   await tab(osia,'roster');await osia.click('#roster [data-hero="osia"]');await osia.click('#train-hero');await osia.waitForFunction(()=>JSON.parse(localStorage.getItem('school-mercenaries-v4')).units.osia.level===2);await osia.screenshot({path:'/tmp/osia-browser-detail.png'});
   console.log('PASS Osia draw, right-facing atlas, passive explanation, formation/reload/training and updated odds');
   await osia.click('#modal-close');await osia.evaluate(()=>{const s=JSON.parse(localStorage.getItem('school-mercenaries-v4'));s.pity=59;localStorage.setItem('school-mercenaries-v3',JSON.stringify(s));localStorage.removeItem('school-mercenaries-v4');});await osia.reload();await tab(osia,'recruit');
   assert.equal((await saved(osia)).pity,59);assert.equal(await osia.locator('#pity-count').textContent(),'59 / 80');assert.equal(await osia.locator('#next-ssr-chance').textContent(),'다음 SSR 5%');
   await osia.click('#rates-button');assert.match(await osia.locator('#modal-content').innerText(),/다음 60회째 확률/);await osia.click('#modal-close');
   await osia.evaluate(()=>{window.normalRandom=Math.random;Math.random=()=>.99;});await osia.click('#recruit-one');await osia.waitForSelector('.result-card');await osia.evaluate(()=>Math.random=window.normalRandom);await osia.click('#modal-close');assert.equal((await saved(osia)).pity,60);assert.equal(await osia.locator('#next-ssr-chance').textContent(),'다음 SSR 6%');
   await osia.evaluate(()=>{const s=JSON.parse(localStorage.getItem('school-mercenaries-v4'));s.pity=79;localStorage.setItem('school-mercenaries-v4',JSON.stringify(s));});await osia.reload();await tab(osia,'recruit');assert.equal(await osia.locator('#pity-left').textContent(),'1');assert.equal(await osia.locator('#next-ssr-chance').textContent(),'다음 SSR 100%');await osia.screenshot({path:'/tmp/school-hard-pity-public-preview.png'});
   await osia.evaluate(()=>{window.normalRandom=Math.random;Math.random=()=>.99;});await osia.click('#recruit-one');await osia.waitForSelector('.result-card.SSR');await osia.evaluate(()=>Math.random=window.normalRandom);await osia.click('#modal-close');assert.equal((await saved(osia)).pity,0);assert.equal(await osia.locator('#next-ssr-chance').textContent(),'다음 SSR 4%');console.log('PASS existing 59-count migration, next-chance UI, gradual increase and 80th SSR/reset');
   const prior=(await saved(p)).kills;await tab(p,'adventure');await p.waitForTimeout(11000);assert.ok((await saved(p)).kills>prior);await p.screenshot({path:'/tmp/school-tested-mobile.png'});assert.deepEqual(errors,[]);console.log('PASS unattended combat continues and browser has no JavaScript exceptions');
   console.log('School browser verification passed; action requests:',actionRequests);
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));t.sqlite.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
