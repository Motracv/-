// Real Chromium + the production SQLite worker. Accounts and saves are disposable.
// Only the locally served client exposes navigation helpers; shipped JS is unchanged.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const G=require('../school/engine.js'),S=require('../school/santa-engine.js'),{fixture}=require('./account-fixture.cjs');
const root=path.resolve(__dirname,'..');

(async()=>{
 const f=await fixture();let origin,browser,context;
 const errors=[],requests=[];
 const server=http.createServer(async(req,res)=>{
  try{
   const u=new URL(req.url,origin);
   if(u.pathname.startsWith('/api/')){
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const body=Buffer.concat(chunks);if(body.length)requests.push(JSON.parse(body));
    const response=await f.worker.fetch(new Request(u,{method:req.method,headers:req.headers,...(req.method==='GET'?{}:{body})}),f.env);
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
   }
   if(u.pathname==='/mobile-fixture.html'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><title>Local worker check</title>');return;}
   const file=path.resolve(root,'.'+decodeURIComponent(u.pathname));
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
   let data=fs.readFileSync(file);
   if(file===path.join(root,'school/client.js'))data=Buffer.from(data.toString()
    .replace('https://motracv-card-room.densedormouse4.chatgpt.site',origin)
    .replace('  boot().catch(',`  window.__mobileTest={tab:setTab,hero:heroDetail,settings:settingsModal,winter:()=>social.openWinter(),santa:()=>santa.open(),yeti:()=>yeti.open(),guild:()=>guild.open(),community:()=>community.open(),map:stageMap,codex:codexModal,shards:shardsModal,shop:shopModal,arena:()=>social.openArena(),pass:()=>battlePassUI.open(),raid:()=>raid.open(),rankings:rankingModal,close:()=>closeModal(true),state:()=>state};\n  boot().catch(`));
   res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.css':'text/css','.html':'text/html','.webp':'image/webp','.png':'image/png','.json':'application/json','.woff2':'font/woff2','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
  }catch(e){res.writeHead(500);res.end(e.stack);}
 });
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;f.env.ALLOWED_ORIGIN=origin;
  const user=(await f.login('mobile-layout')).data,friend=(await f.login('mobile-friend')).data;
  for(const u of [user,friend]){
   const state=G.create(Date.now());state.onboarding={version:1,step:8};state.gold=3000000;state.gems=100000;state.captain.level=90;state.team=['geonu','nari','lava','osia','horas','yaho'];state.best=20;
   for(const id of Object.keys(G.BY_ID))state.units[id]={level:90,stars:0,xp:0,shards:30};
   S.state(state).boxes=10;state.santa.coins=500;state.santa.tickets=10;state.santa.special=2;
   f.sqlite.prepare('INSERT INTO school_saves(account_id,payload,revision,updated_at) VALUES(?,?,0,?)').run(u.profile.id,JSON.stringify(state),Date.now());
  }
  const renamed=await f.call('/api/school/action',{catalogVersion:G.CATALOG_VERSION,revision:0,action:{kind:'rename',name:'모바일검증'},requestId:crypto.randomUUID()},null,{'Origin':origin,'X-Account-Session':user.token});assert.equal(renamed.status,200,JSON.stringify(renamed.data));
  const guild=await f.call('/api/school/guild',{catalogVersion:G.CATALOG_VERSION,kind:'create',name:'모바일검증반',emblem:0,requestId:crypto.randomUUID()},null,{'Origin':origin,'X-Account-Session':user.token});assert.equal(guild.status,200,JSON.stringify(guild.data));
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,serviceWorkers:'block',reducedMotion:'reduce'});
  await context.addInitScript(({origin,token})=>{
   localStorage.setItem('card-account:'+origin,JSON.stringify({token}));
   localStorage.setItem('school-settings',JSON.stringify({motion:'reduced',theme:'dark',muted:true}));
   sessionStorage.setItem('school-landscape-ack','1');
  },{origin,token:user.token});
  await context.route('https://accounts.google.com/**',route=>route.abort());
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/school.html');await page.locator('#entry-start').tap();
  await page.waitForFunction(()=>window.__mobileTest&&document.querySelector('#school-entry')?.hidden!==false);
  const open=async screen=>{
   await page.evaluate(()=>{__mobileTest.close();__mobileTest.tab('lobby');});
   await page.evaluate(name=>{
    if(['lobby','roster','recruit','dungeons','supplies'].includes(name))__mobileTest.tab(name);
    else if(name==='hero')__mobileTest.hero('horas');else __mobileTest[name]();
   },screen);
   await page.waitForTimeout(120);
  };
  const box=selector=>page.locator(selector).boundingBox();
  const reachable=async selector=>{
   const element=page.locator(selector);await element.scrollIntoViewIfNeeded();
   assert(await element.evaluate(node=>{
    const r=node.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
    return r.width>0&&r.height>0&&x>=0&&x<innerWidth&&y>=0&&y<innerHeight&&node.contains(document.elementFromPoint(x,y));
   }),selector+' must be reachable by touch at '+JSON.stringify(page.viewportSize()));
  };
  const fits=async selector=>assert(await page.locator(selector).evaluate(e=>e.scrollWidth<=e.clientWidth+2),selector+' must not overflow horizontally');
  const sizes=[[568,320],[755,330],[844,390],[932,430],[360,800],[390,844],[1024,768]];
  for(const [width,height] of (process.env.MOBILE_EXTRA_ONLY||process.env.MOBILE_FLOW_ONLY?[]:sizes)){
   await page.setViewportSize({width,height});
   for(const screen of ['santa','hero','roster','recruit','settings','winter','guild','community','dungeons','supplies']){
    await open(screen);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1),screen+' page stays inside '+width+'x'+height);
    if(await page.locator('#modal[open]').count()){
     const modal=await box('#modal');assert(modal.y>=-1&&modal.y+modal.height<=height+1,screen+' dialog fits viewport');
     await reachable('#modal-close');await fits('#modal-content');
    }
    if(screen==='santa'){
     await page.locator('[data-santa-tab=loot]').tap();
     const arena=await box('.santa-arena'),loot=await box('#santa-loot'),workspace=await box('.santa-workspace');
     assert(arena.height>=Math.min(105,height*.25),'arena keeps useful height '+width+'x'+height);
     assert(loot.y+loot.height<=workspace.y+workspace.height+1,'loot constrained to visible workspace');
     assert(width<height?loot.y>=arena.y+arena.height:loot.x>=arena.x+arena.width,'loot never covers battle');
     await fits('#santa-view');await fits('#santa-loot');await reachable('#santa-spin');
     await page.locator('#santa-record-button').tap();
     assert(await page.locator('#santa-loot').isHidden());await reachable('#santa-record-button');
     const report=await box('#santa-report'),fight=await box('.santa-arena');
     assert(width<height?report.y>=fight.y+fight.height:report.x>=fight.x+fight.width,'report never covers battle');
    }
    if(screen==='hero'){
     await reachable('#train-ten');await reachable('#change-hero');
     await page.locator('.hero-pane-tabs button').nth(2).tap();await reachable('#remove-hero');
     const profile=await box('.hero-profile'),content=await box('#modal-content');assert(profile.y+profile.height<=content.y+content.height+1,'hero profile bounded');
    }
    if(screen==='roster'){
     const title=await box('#tab-roster .section-heading'),hud=await box('.topbar');assert(title.y>=hud.y+hud.height-1,'formation title below HUD');
     await reachable('[data-form-select="geonu"]');await fits('#tab-roster');
    }
    if(screen==='recruit'){await reachable('#recruit-one');await reachable('#rates-button');}
    if(screen==='settings')await reachable('#setting-sfx-volume');
   }
   console.log('PASS touch layout sweep',width+'x'+height);
  }
  for(const [width,height] of (process.env.MOBILE_FLOW_ONLY?[]:[[568,320],[844,390],[390,844],[1280,720]])){
   await page.setViewportSize({width,height});
   for(const screen of ['map','codex','shards','shop','arena','pass','raid','rankings','guild']){
    await open(screen);await reachable('#modal-close');await fits('#modal-content');
    const modal=await box('#modal');assert(modal.y>=-1&&modal.y+modal.height<=height+1,screen+' dialog fits '+width+'x'+height);
    if(screen==='guild')for(const tab of ['members','quests','manage']){await page.locator('[data-guild-tab="'+tab+'"]').tap();await fits('#modal-content');}
   }
   await open('lobby');
   for(const selector of ['#guild-button','#community-button','.lobby-formation','#company-button',...await page.locator('.lobby-nav button').evaluateAll(nodes=>nodes.map(n=>'.lobby-nav [data-lobby-action="'+n.dataset.lobbyAction+'"]'))]){
    if(selector.includes('undefined'))continue;
    if(['#guild-button','#community-button'].includes(selector)&&!await page.locator(selector).evaluate(n=>n.classList.contains('campus-compact')))continue;
    await reachable(selector);
   }
   console.log('PASS map/codex/shop/arena/pass/raid/rankings and lobby controls',width+'x'+height);
  }

  // Touch real controls, including a purchase while combat continues.
  await page.setViewportSize({width:844,height:390});await open('santa');
  await page.locator('#santa-start:not(:disabled)').tap();await page.waitForFunction(()=>document.querySelector('#santa-view').dataset.phase==='fighting');
  await page.locator('[data-santa-tab=loot]').tap();const start=await page.evaluate(()=>__mobileTest.state().santa.battle.elapsed);
  await page.locator('#santa-box').tap();await page.waitForFunction(()=>__mobileTest.state().santa.boxes===9);
  await page.locator('#santa-buy').tap();await page.waitForFunction(()=>__mobileTest.state().santa.tickets===11);
  await page.locator('#santa-spin').tap();await page.waitForFunction(()=>__mobileTest.state().santa.spins===1);
  await page.waitForFunction(elapsed=>__mobileTest.state().santa.battle.elapsed>elapsed,start);
  assert(await page.locator('#santa-auto').isChecked(),'loot and spin preserve auto setting');
  await page.locator('#santa-record-button').tap();await page.waitForFunction(()=>document.querySelectorAll('#santa-report [data-record-row]').length===6);
  await page.setViewportSize({width:390,height:844});await reachable('#santa-record-button');
  assert(await page.locator('#santa-auto').isChecked(),'rotation preserves auto setting');
  await page.screenshot({path:'/tmp/school-mobile-santa-portrait.png'});
  await page.setViewportSize({width:844,height:390});await page.screenshot({path:'/tmp/school-mobile-santa-landscape.png'});

  await open('hero');await page.locator('#train-ten').tap();await page.waitForFunction(()=>__mobileTest.state().units.horas.level===100);
  await open('roster');await page.locator('[data-form-select="geonu"]').tap();await page.locator('[data-form-target="1"]').tap();
  await page.waitForFunction(()=>__mobileTest.state().team[1]==='geonu');
  await page.setViewportSize({width:390,height:844});await open('roster');await reachable('[data-form-select="hyeokjin"]');
  await open('settings');await page.locator('#setting-sfx-volume').tap({position:{x:70,y:16}});const chosenVolume=await page.locator('#setting-sfx-volume').inputValue();
  await page.setViewportSize({width:390,height:500});await reachable('#setting-sfx-volume');assert.equal(await page.locator('#setting-sfx-volume').inputValue(),chosenVolume,'visible viewport resize preserves settings');
  await page.setViewportSize({width:390,height:844});await open('recruit');
  for(const banner of ['yaho','hyeokjin','kazua','standard','horas']){
   const choice=page.locator('.pickup-grid [data-banner="'+banner+'"]');if(!await choice.isVisible())continue;await choice.tap();
   const name=await box('#pickup-name'),stage=await box('.pickup-stage');assert(name.y>=stage.y&&name.y+name.height<=stage.y+stage.height,'recruit name must not be clipped: '+banner);
  }
  await page.locator('.pickup-grid [data-banner="standard"]').tap();
  const pullCost=Number((await page.locator('#recruit-price-one').textContent()).replace(/,/g,''));
  const beforePull=await page.evaluate(()=>({gems:__mobileTest.state().gems,shards:Object.values(__mobileTest.state().units).reduce((n,u)=>n+u.shards,0)}));
  await page.evaluate(()=>SchoolPresentation.setPreferences({reduced:false}));await page.locator('#recruit-one:not(:disabled)').tap();
  await page.locator('.recruit-skip:visible,[data-presentation-skip]:visible').tap();await reachable('#reveal-done');
  const afterPull=await page.evaluate(()=>({gems:__mobileTest.state().gems,shards:Object.values(__mobileTest.state().units).reduce((n,u)=>n+u.shards,0)}));
  assert.equal(afterPull.gems,beforePull.gems-pullCost);assert(afterPull.shards>beforePull.shards,'skipped recruitment still grants the saved reward');
  await page.locator('#reveal-done').tap();await page.evaluate(()=>SchoolPresentation.setPreferences({reduced:true}));
  await page.setViewportSize({width:844,height:390});

  // A genuine two-account Yeti room, then actual ready/start/report controls.
  const command=(u,kind,extra={})=>f.call('/api/school/yeti',{catalogVersion:G.CATALOG_VERSION,kind,requestId:crypto.randomUUID(),...extra},null,{'X-Account-Session':u.token});
  f.env.ALLOWED_ORIGIN='https://motracv.github.io';
  const created=await command(user,'create');assert.equal(created.status,200,JSON.stringify(created.data));
  const room=created.data.room;assert.equal((await command(friend,'join',{code:room.code})).status,200);await command(friend,'ready',{roomId:room.id});
  f.env.ALLOWED_ORIGIN=origin;await open('yeti');
  await page.locator('[data-yeti=ready]').tap();await page.locator('[data-yeti=start]:not(:disabled)').tap();
  await page.waitForFunction(()=>document.querySelector('#yeti-view').dataset.phase==='fighting');
  await page.locator('#yeti-record-button').tap();await page.waitForFunction(()=>document.querySelectorAll('#yeti-report [data-record-row]').length>=6);
  const arena=await box('.yeti-arena'),report=await box('#yeti-report');assert(report.x>=arena.x+arena.width,'Yeti report remains beside battle');
  assert(arena.height>=150);await reachable('#yeti-back');assert(await page.locator('#yeti-auto').isChecked());
  await page.screenshot({path:'/tmp/school-mobile-yeti-landscape.png'});
  await page.locator('#yeti-record-button').tap();
  const won=JSON.parse(f.sqlite.prepare('SELECT payload FROM school_yeti_rooms WHERE id=?').get(room.id).payload);won.battle.boss.hp=1;
  f.sqlite.prepare('UPDATE school_yeti_rooms SET payload=? WHERE id=?').run(JSON.stringify(won),room.id);
  await page.waitForFunction(()=>document.querySelector('#yeti-view').dataset.phase==='finished');
  assert(await page.locator('#yeti-rewards').isVisible(),'victory rewards stay accessible');
  await page.waitForFunction(()=>document.querySelector('#yeti-view').dataset.phase==='fighting',null,{timeout:10000});
  assert.equal(requests.filter(r=>r.kind==='rematch').length,1,'idle five-second timer starts one rematch without touch or scroll');
  assert.equal(requests.filter(r=>r.action?.kind==='santa-box').length,1,'one tap spends one box');
  assert.deepEqual(errors,[],'no uncaught browser errors');
  console.log('PASS live Santa loot/spin/report/rotation, hero training, formation move, settings resize, recruit skip/reward and two-player Yeti');
  await context.close();context=null;

  // Check the real shipping worker, including its catalog guard and offline files.
  const offline=await browser.newContext({viewport:{width:1280,height:720}});context=offline;
  const workerPage=await offline.newPage();await workerPage.goto(origin+'/mobile-fixture.html');
  await workerPage.evaluate(async()=>{await navigator.serviceWorker.register('school-sw.js');await navigator.serviceWorker.ready;});
  await workerPage.reload();await workerPage.waitForFunction(()=>navigator.serviceWorker.controller);
  const release=fs.readFileSync(path.join(root,'school-sw.js'),'utf8').match(/const RELEASE = '([^']+)'/)[1];
  for(const asset of ['mobile-ui.css','mobile-viewport.js','winter-layout.css']){
   assert(await workerPage.evaluate(async url=>(await caches.match(url))?.ok,'/school/'+asset+'?v='+release),'new mobile asset precached');
  }
  await offline.setOffline(true);
  const css=await workerPage.evaluate(async release=>(await fetch('school/mobile-ui.css?v='+release)).text(),release);
  assert.equal(css,fs.readFileSync(path.join(root,'school/mobile-ui.css'),'utf8'));
  console.log('PASS actual service-worker installation, catalog validation and offline mobile assets');
 }finally{
  await context?.close();await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));f.sqlite.close();
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
