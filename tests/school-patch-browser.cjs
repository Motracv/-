const assert=require('node:assert/strict');
const G=require('../school/engine.js');
const {seedGuest}=require('./school-ui-regressions.cjs');
const SAVE='school-mercenaries-v8';
async function runPatchRegressions({pageFor,saved,tab,t,login,origin}){
 const pages=[];const page=async(...args)=>{const p=await pageFor(...args);pages.push(p);p.setDefaultTimeout(12000);return p;};
 const readCloud=id=>JSON.parse(t.sqlite.prepare('SELECT payload FROM school_saves WHERE account_id=?').get(id).payload);
 const finishState=s=>{s.at=Date.now()+1800;for(const h of s.battle.heroes){h.hp=h.max;h.shield=0;}for(const e of s.battle.enemies){e.hp=1;e.atk=1;}return s;};
 const towerState=floor=>{const s=G.create(Date.now()+60000,901);s.activities.towerBest=floor-1;G.action(s,{kind:'activity',mode:'tower',floor},Date.now());return finishState(s);};
 const wallet=s=>({gold:s.gold,gems:s.gems});
 async function close(p){if(await p.locator('#modal').evaluate(el=>el.open))await p.click('#modal-close');}
 try{
  const p=await page('patch-tower',844,390);
  for(const modal of['hero','settings','captain']){
   const s=towerState(1);await seedGuest(p,s);const before=wallet(await saved(p));
   await p.click(modal==='hero'?'#party [data-hero="harin"]':modal==='settings'?'#settings-button':'#captain-button');
   await p.waitForFunction(()=>JSON.parse(localStorage.getItem('school-mercenaries-v8')).activities.run?.settled);
   await p.waitForSelector('#pending-activity-result [data-activity-result]');
   if(modal==='hero')await p.click('#pending-activity-result [data-activity-result]');
   else if(modal==='settings')await p.keyboard.press('Escape');
   else await close(p);
   await p.waitForSelector('#modal .dungeon-result');assert.ok(await p.locator('#modal [data-activity-mode="tower"][data-floor="2"]').isVisible());
   const won=await saved(p);assert.equal(won.activities.towerBest,1);assert.deepEqual(wallet(won),{gold:before.gold+105,gems:before.gems+10});await p.reload();await p.waitForSelector('#modal .dungeon-result');assert.deepEqual(wallet(await saved(p)),wallet(won));
  }
  await close(p);await p.waitForTimeout(500);assert.equal(await p.locator('#modal .dungeon-result').isVisible(),false);await tab(p,'dungeons');await p.click('#dungeon-current [data-activity-result]');await p.waitForSelector('#modal .dungeon-result');
  console.log('PASS Mobius victory while hero/settings/captain details are open exposes a result notice; clicking, Esc and closing recover the next-floor dialog; intentional dismissal stays closed and can be reopened');
  // Enter consecutive floors through the result controls. Wait for a new run ID,
  // since the preceding result can remain visible during a confirmed save.
  for(const floor of[2,3,4]){
   const previous=(await saved(p)).activities.run.id;await p.click(`#modal [data-activity-mode="tower"][data-floor="${floor}"]`);
   await p.waitForFunction(previous=>{const s=JSON.parse(localStorage.getItem('school-mercenaries-v8'));return s.activities.run?.id!==previous&&s.activities.run?.settled===false;},previous);
   let s=await saved(p);assert.equal(s.activities.run.floor,floor);const before=wallet(s);await seedGuest(p,finishState(s));await p.waitForSelector('#modal .dungeon-result');s=await saved(p);assert.equal(s.activities.towerBest,floor);assert.deepEqual(wallet(s),{gold:before.gold+100+5*floor,gems:before.gems+10});
   await p.reload();await p.waitForSelector('#modal .dungeon-result');assert.deepEqual(wallet(await saved(p)),wallet(s));
  }
  console.log('PASS three consecutive next-floor buttons create distinct runs, retain the next result and award each floor only once');
  const effect=await page('patch-pending-presentation',844,390,1,{presentation:false});await effect.emulateMedia({reducedMotion:'no-preference'});const withReward=towerState(1);withReward.at=Date.now()+300;withReward.offline={seconds:600,gold:1,xp:1,captainXp:G.captainNeed(1)};await seedGuest(effect,withReward);await tab(effect,'supplies');await effect.click('#claim-offline');await effect.waitForSelector('#school-presentation[open][data-kind="captain"]');await effect.waitForFunction(()=>JSON.parse(localStorage.getItem('school-mercenaries-v8')).activities.run?.settled);assert.ok(await effect.locator('#school-presentation[open]').isVisible());assert.equal(await effect.locator('#modal .dungeon-result').isVisible(),false);await effect.click('.presentation-skip');await effect.waitForSelector('#modal .dungeon-result');assert.ok(await effect.locator('#modal [data-activity-mode="tower"][data-floor="2"]').isVisible());assert.equal((await saved(effect)).captain.level,2);assert.equal((await saved(effect)).activities.towerBest,1);console.log('PASS a real commander reward presentation defers an overlapping Mobius victory and reveals the next floor immediately after skipping');
  // Price is user-visible and charged by the engine, for old and new levels.
  for(const [level,cost]of[[1,68],[2,90],[40,3890],[99,21236]]){
   const s=G.create(Date.now()+60000,902);s.gold=cost;s.units.harin.level=level;await seedGuest(p,s);await p.click('#party [data-hero="harin"]');assert.equal(await p.locator('#train-cost').textContent(),`골드 ${cost.toLocaleString('ko-KR')}`);assert.equal(await p.locator('#train-hero').isDisabled(),false);await p.click('#train-hero');await p.waitForFunction(level=>JSON.parse(localStorage.getItem('school-mercenaries-v8')).units.harin.level===level+1,level);assert.equal((await saved(p)).gold,0);await p.reload();assert.equal((await saved(p)).units.harin.level,level+1);
  }
  console.log('PASS reduced training prices charge the displayed exact amount at levels 1, 2, 40 and 99 and persist');
  const who=(await t.login('patch-tower-cloud')).data;await t.call('/api/school/state',{catalogVersion:G.CATALOG_VERSION},null,{'X-Account-Session':who.token});let s=towerState(1);s.at=Date.now()+60000;t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(s),who.profile.id);
  const cloud=await page('patch-tower-cloud',844,390);await login(cloud);await cloud.click('#settings-button');s=finishState(readCloud(who.profile.id));s.at=Date.now()-1500;t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(s),who.profile.id);await cloud.waitForFunction(()=>JSON.parse(sessionStorage.getItem('school-confirmed-cloud-view')).state.activities.run?.settled,{},{timeout:15000});
  await cloud.waitForSelector('#pending-activity-result [data-activity-result]');await cloud.click('#pending-activity-result [data-activity-result]');await cloud.waitForSelector('#modal .dungeon-result');const paid=wallet(readCloud(who.profile.id));await cloud.reload();await cloud.waitForSelector('#modal .dungeon-result');assert.deepEqual(wallet(readCloud(who.profile.id)),paid);const other=await page('patch-tower-cloud',844,390);await login(other);await other.waitForSelector('#modal .dungeon-result');assert.deepEqual(wallet(readCloud(who.profile.id)),paid);await other.context().close();
  console.log('PASS authoritative cloud Mobius result appears after an information dialog and survives reload/second-browser restore without another payout');
  await runDungeonAccountSwitch({pageFor,saved,tab,t,login});
  await runArtCacheChecks(p);
  await runInstallChecks({page,saved,t,login,origin});
 }finally{for(const p of pages)if(!p.isClosed())await p.context().close();}
}
async function runArtCacheChecks(p){
 const result=await p.evaluate(async()=>{await document.fonts.ready;const G=SchoolRPG,reused=document.createElement('canvas'),checks=[],pictures=[];for(const scenario of[{stage:1},{stage:6},{stage:31},{stage:60},{mode:'daily',tier:1},{mode:'weekly',tier:1},{mode:'tower',floor:1},{mode:'tower',floor:6},{stage:1,six:true},{stage:1,w:960},{stage:1,w:480}]){const s=G.create(Date.now(),912);s.best=59;if(scenario.mode){s.activities.towerBest=6;G.action(s,{kind:'activity',...scenario},Date.now());}else G.action(s,{kind:'stage',stage:scenario.stage,mode:'farm'},Date.now());if(scenario.six)s.team=['taeo','harin','sua','osia','lava','ian'];s.battle.heroes=[];s.battle.enemies=[];const before=JSON.stringify(s),w=scenario.w||480,h=Math.round(w*7/12),fresh=document.createElement('canvas');fresh.width=w;fresh.height=h;if(reused.width!==w||reused.height!==h){reused.width=w;reused.height=h;}SchoolArt.draw(reused.getContext('2d'),s,1,[],false);SchoolArt.draw(fresh.getContext('2d'),s,1,[],false);checks.push({scenario,equal:reused.toDataURL()===fresh.toDataURL(),unchanged:JSON.stringify(s)===before});pictures.push(reused.toDataURL());}return{checks,restored:pictures[0]===pictures.at(-1)};});
 assert.ok(result.checks.every(x=>x.equal&&x.unchanged),'Cached backgrounds must match fresh rendering after region/activity/camera/size changes without changing state: '+JSON.stringify(result.checks));assert.equal(result.restored,true);console.log('PASS cached artwork invalidates across regions, daily/weekly/tower floors, six-hero camera and backing-size changes without modifying combat state');
}
async function runInstallChecks({page,saved,t,login,origin}){
 const p=await page('patch-install',844,390,1,{serviceWorkers:'allow',persistent:true}),manifest=await p.evaluate(async()=>{const link=document.querySelector('link[rel=manifest]');if(!link)throw Error('Missing install manifest');return await (await fetch(link.href)).json();});
 assert.equal(manifest.name,'학교용병단');assert.equal(manifest.display,'standalone');assert.equal(manifest.orientation,'landscape');assert.equal(manifest.scope,'./school.html');assert.ok(manifest.start_url.includes('school.html'));
 for(const icon of manifest.icons){const size=Number(icon.sizes.split('x')[0]);const actual=await p.evaluate(async src=>{const img=new Image();img.src=src;await img.decode();return[img.naturalWidth,img.naturalHeight];},icon.src);assert.deepEqual(actual,[size,size]);}
 await p.waitForFunction(async()=>Boolean((await navigator.serviceWorker.getRegistration())?.active),{},{timeout:20000});await p.reload();await p.waitForFunction(()=>Boolean(navigator.serviceWorker.controller)&&document.getElementById('boot-screen').hidden);
 const installability=await (await p.context().newCDPSession(p)).send('Page.getInstallabilityErrors');assert.deepEqual(installability.installabilityErrors,[],'Chromium installability checks must accept the file-scoped app');
 const other=await p.context().newPage();for(const target of['index.html','game.html']){await other.goto(origin+'/'+target);assert.equal(await other.evaluate(()=>navigator.serviceWorker.controller),null,`${target} must not be controlled by the RPG service worker`);}await other.close();
 await p.click('#settings-button');await p.waitForSelector('#school-install-controls');assert.match(await p.locator('#school-install-controls').textContent(),/설치|앱/);assert.match(await p.locator('#school-install-controls').textContent(),/오프라인/);await p.click('#modal-close');
 let s=G.create(Date.now()+60000,903);s.gold=500;await seedGuest(p,s);await p.context().setOffline(true);await p.reload();await p.waitForFunction(()=>document.getElementById('boot-screen').hidden&&document.querySelectorAll('#party [data-hero]').length===3);assert.equal((await saved(p)).gold,500);await p.click('#party [data-hero="harin"]');await p.click('#train-hero');await p.waitForFunction(()=>JSON.parse(localStorage.getItem('school-mercenaries-v8')).units.harin.level===2);assert.equal((await saved(p)).gold,432);await p.reload();await p.waitForFunction(()=>document.getElementById('boot-screen').hidden);assert.equal((await saved(p)).gold,432);assert.equal((await saved(p)).units.harin.level,2);await p.context().setOffline(false);
 const cached=await p.evaluate(async()=>{const keys=await caches.keys();const urls=[];for(const key of keys)for(const request of await (await caches.open(key)).keys())urls.push(request.url);return urls;});assert.ok(cached.some(url=>url.includes('school.html')));assert.ok(cached.some(url=>url.includes('/school/engine.js')));assert.ok(cached.every(url=>!url.includes('/api/')&&!url.includes('game.html')),'Offline shell must exclude accounts, rankings, game rooms and the card game');
 const identity=(await t.login('patch-install-account')).data;await t.call('/api/school/state',{catalogVersion:G.CATALOG_VERSION},null,{'X-Account-Session':identity.token});s=G.create(Date.now()+60000,904);s.gold=1234;t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(s),identity.profile.id);
 const cloud=await page('patch-install-account',844,390,1,{serviceWorkers:'allow'});await login(cloud);await cloud.waitForFunction(async()=>Boolean((await navigator.serviceWorker.getRegistration())?.active),{},{timeout:20000});await cloud.reload();await cloud.waitForFunction(()=>Boolean(navigator.serviceWorker.controller)&&document.getElementById('boot-screen').hidden);await cloud.context().setOffline(true);await cloud.reload();await cloud.waitForFunction(()=>document.getElementById('boot-screen').hidden);assert.equal(await cloud.locator('#account-label').textContent(),'계정 저장');assert.equal(await cloud.locator('#gold').textContent(),'1,234');assert.ok(await cloud.locator('#recruit-one').isDisabled());assert.ok(await cloud.locator('#connection').isVisible());await cloud.context().setOffline(false);
 console.log('PASS actual manifest/icons and service-worker control; offline guest launch/training/reload persists; cache excludes API/card game; offline accounts retain confirmed funds and disable spending');
}
async function runDungeonAccountSwitch({pageFor,saved,tab,t,login}){
 const make=tier=>{const s=G.create(Date.now()+60000,919);s.best=59;G.action(s,{kind:'activity',mode:'daily',tier},Date.now());s.at=Date.now()+60000;return s;};
 const guest=make(1),account=make(5);assert.equal(guest.activities.run.id,account.activities.run.id);assert.equal(guest.best,account.best);assert.deepEqual(guest.activities.daily,account.activities.daily);assert.deepEqual(guest.activities.weekly,account.activities.weekly);
 const who=(await t.login('dungeon-content-account-switch')).data;await t.call('/api/school/state',{catalogVersion:G.CATALOG_VERSION},null,{'X-Account-Session':who.token});t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(account),who.profile.id);
 const p=await pageFor('dungeon-content-account-switch',844,390);
 try{await seedGuest(p,guest);await tab(p,'dungeons');assert.match(await p.locator('#dungeon-current h3').textContent(),/1단계/);await login(p);await p.waitForFunction(()=>document.querySelector('#dungeon-current h3')?.textContent.includes('5단계'));assert.match(await p.locator('#stage-number').textContent(),/5단계/);assert.equal((await saved(p)).activities.run.tier,1,'Account login cannot alter the preserved guest run');
  await p.click('#account-button');await p.click('#guest-return');await p.waitForFunction(()=>document.getElementById('account-label').textContent==='게스트'&&document.querySelector('#dungeon-current h3')?.textContent.includes('1단계'));assert.match(await p.locator('#stage-number').textContent(),/1단계/);assert.equal(JSON.parse(t.sqlite.prepare('SELECT payload FROM school_saves WHERE account_id=?').get(who.profile.id).payload).activities.run.tier,5);console.log('PASS same-ID guest daily tier 1 → account daily tier 5 → guest switches refresh the dungeon summary without mixing either saved run');
 }finally{await p.context().close();}
}
module.exports={runPatchRegressions,runDungeonAccountSwitch};
