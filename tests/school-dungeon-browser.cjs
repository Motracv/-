const assert=require('node:assert/strict'),fs=require('node:fs');
const G=require('../school/engine.js');
const {seedGuest}=require('./school-ui-regressions.cjs');

async function runDungeonRegressions({pageFor,saved,tab,t,login,dropNextAction}){
  const realNow=Date.now,offset=Date.parse('2026-11-18T03:00:00Z')-realNow(),pages=[];
  Date.now=()=>realNow()+offset;
  const wallet=s=>({gold:s.gold,gems:s.gems});
  const progress=s=>({units:Object.fromEntries(Object.entries(s.units).map(([id,u])=>[id,{level:u.level,xp:u.xp,stars:u.stars,shards:u.shards}])),captain:s.captain});
  const keys=s=>({daily:G.activityInfo(s,Date.now()).daily.keys,weekly:G.activityInfo(s,Date.now()).weekly.keys});
  async function page(person,width=844,height=390){
    const p=await pageFor(person,width,height);pages.push(p);p.setDefaultTimeout(10000);
    await p.context().addInitScript(offset=>{const RealDate=Date;window.Date=class extends RealDate{constructor(...args){if(args.length)super(...args);else super(RealDate.now()+offset);}static now(){return RealDate.now()+offset;}};},offset);
    await p.reload();await p.waitForFunction(()=>document.querySelectorAll('#party [data-hero]').length>=1);return p;
  }
  async function closeModal(p){if(await p.locator('#modal').evaluate(el=>el.open))await p.click('#modal-close');}
  async function enter(p,kind,value=1,doubleClick=false){
    await closeModal(p);await tab(p,'dungeons');await p.click(`[data-dungeon="${kind}"]`);
    const previous=await p.evaluate(()=>{const s=document.getElementById('account-label').textContent==='계정 저장'?JSON.parse(sessionStorage.getItem('school-confirmed-cloud-view')).state:JSON.parse(localStorage.getItem('school-mercenaries-v8'));return s.activities?.run?.id||null;});
    if(kind==='tower'){await p.fill('#tower-floor',String(value));await p.locator('#tower-floor').dispatchEvent('change');}
    else await p.selectOption(`#${kind}-tier`,String(value));
    if(doubleClick)await p.dblclick(`#${kind}-enter`);else await p.click(`#${kind}-enter`);
    await p.waitForFunction(({previous,kind})=>{const s=document.getElementById('account-label').textContent==='계정 저장'?JSON.parse(sessionStorage.getItem('school-confirmed-cloud-view')).state:JSON.parse(localStorage.getItem('school-mercenaries-v8'));return s.activities?.run?.kind===kind&&s.activities.run.id!==previous&&!s.activities.run.settled&&!document.getElementById('modal').open;},{previous,kind});
  }
  function prepareFinish(s,won){
    s.at=Date.now()+600;
    for(const [i,h]of s.battle.heroes.entries()){h.hp=won?h.max:i===0?1:0;h.shield=0;if(!won)h.atk=1;}
    for(const e of s.battle.enemies){e.hp=won?1:1000000;e.max=Math.max(e.max,e.hp);e.atk=won?1:1000000;}
    return s;
  }
  async function finishGuest(p,won){
    const before=await saved(p),id=before.activities.run.id;await seedGuest(p,prepareFinish(before,won));
    await p.waitForFunction(({id,won})=>{const s=JSON.parse(localStorage.getItem('school-mercenaries-v8'));return s.activities.lastResult?.runId===id&&s.activities.lastResult.won===won;},{id,won},{timeout:10000});
    await p.waitForSelector('#modal .dungeon-result');return await saved(p);
  }
  async function coupon(p,code){await closeModal(p);await tab(p,'supplies');await p.fill('#coupon-code',code);await p.click('#redeem-code');await p.waitForFunction(code=>document.getElementById('coupon-message').dataset.state==='success'&&document.getElementById('coupon-message').textContent.includes(code),code);}
  const readCloud=id=>JSON.parse(t.sqlite.prepare('SELECT payload FROM school_saves WHERE account_id=?').get(id).payload);
  const writeCloud=(id,s)=>t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(s),id);
  try{
    const p=await page('dungeon-guest');const legacy=G.create(Date.now()+60000,42);delete legacy.activities;legacy.gold=4321;legacy.gems=3000;legacy.banners.lava={pity:12,guaranteed:true};legacy.redeemedCodes=['BUG_FIX'];
    await seedGuest(p,legacy,'school-mercenaries-v6');let s=await saved(p);
    assert.deepEqual(s.team,['taeo','harin','sua']);assert.equal(Object.keys(s.units).length,3);assert.deepEqual(wallet(s),{gold:4321,gems:3000});assert.deepEqual(s.banners.lava,{pity:12,guaranteed:true});assert.deepEqual(s.redeemedCodes,['BUG_FIX']);assert.deepEqual(keys(s),{daily:3,weekly:2});
    assert.equal(await p.locator('#party .party-card').count(),6);assert.equal(await p.locator('#party .empty').count(),3);
    for(const id of['osia','lava','ian'])s.units[id]={level:1,xp:0,stars:0,shards:0};await seedGuest(p,s);
    for(const [i,id]of['osia','lava','ian'].entries()){
      await tab(p,'adventure');await p.locator('#party .empty').first().click();await p.click(`#roster [data-hero="${id}"]`);await p.click(`#modal [data-slot="${i+3}"]`);await p.waitForFunction(()=>!document.getElementById('modal').open);
    }
    assert.deepEqual((await saved(p)).team,['taeo','harin','sua','osia','lava','ian']);await p.reload();assert.equal(await p.locator('#party [data-hero]').count(),6);
    for(const [width,height]of[[2560,1440],[320,568],[568,280]]){
      await p.setViewportSize({width,height});await tab(p,'adventure');
      for(const id of['taeo','harin','sua','osia','lava','ian']){
        await p.locator(`#party [data-hero="${id}"]`).scrollIntoViewIfNeeded();const b=await p.locator(`#party [data-hero="${id}"]`).boundingBox();assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=width+1&&b.y+b.height<=height+1,'All six party members must be reachable');
      }
      await p.click('#party [data-hero="ian"]');assert.equal(await p.locator('#modal [data-slot]').count(),6);assert.ok(await p.locator('#train-hero').isVisible());await closeModal(p);
      await tab(p,'dungeons');for(const id of['daily-enter','weekly-enter','tower-enter']){await p.click(`[data-dungeon="${id.split('-')[0]}"]`);await p.locator('#'+id).scrollIntoViewIfNeeded();const b=await p.locator('#'+id).boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width+1&&b.y+b.height<=height+1);}
      assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1));await p.screenshot({path:`/tmp/school-dungeon-${width}x${height}.png`});
    }
    await p.setViewportSize({width:844,height:390});await tab(p,'adventure');await p.click('#party [data-hero="ian"]');await p.click('#remove-hero');await p.waitForFunction(()=>!document.getElementById('modal').open);assert.equal((await saved(p)).team.length,5);
    await p.locator('#party .empty').click();await p.click('#roster [data-hero="ian"]');await p.click('#modal [data-slot="5"]');await p.waitForFunction(()=>!document.getElementById('modal').open);assert.equal((await saved(p)).team.length,6);
    console.log('PASS v6→v8 migration preserves three starters, six UI slots fill/remove/reload, and mobile/QHD formation plus dungeon controls remain reachable');

    const beforeCodes=wallet(await saved(p));await coupon(p,'LAVA_DEBUT');await coupon(p,'THANK_YOU');assert.deepEqual(wallet(await saved(p)),{gold:beforeCodes.gold+1500,gems:beforeCodes.gems+1500});
    await p.reload();await tab(p,'supplies');await p.fill('#coupon-code',' lava_debut ');await p.click('#redeem-code');await p.waitForFunction(()=>document.getElementById('coupon-message').textContent.includes('이미 사용'));assert.deepEqual(wallet(await saved(p)),{gold:beforeCodes.gold+1500,gems:beforeCodes.gems+1500});
    console.log('PASS LAVA_DEBUT and THANK_YOU grant exact rewards once and survive reload');

    await enter(p,'daily',1,true);s=await saved(p);assert.deepEqual(keys(s),{daily:2,weekly:2});const dailyBefore=wallet(s),campaignBefore={stage:s.stage,wave:s.wave,best:s.best,mode:s.mode};
    await tab(p,'dungeons');assert.ok(await p.locator('#daily-enter').isDisabled());assert.ok(await p.locator('#weekly-enter').isDisabled());
    await tab(p,'adventure');await p.click('#party [data-hero="harin"]');assert.ok(await p.locator('#modal [data-slot="0"]').isDisabled());await closeModal(p);
    s=await finishGuest(p,true);assert.deepEqual(s.activities.lastResult.reward,G.activityReward('daily',1));assert.deepEqual(wallet(s),{gold:dailyBefore.gold+2000,gems:dailyBefore.gems+80});assert.deepEqual(keys(s),{daily:2,weekly:2});
    assert.deepEqual({stage:s.stage,wave:s.wave,best:s.best,mode:s.mode},campaignBefore);assert.match(await p.locator('.dungeon-result').innerText(),/도전 성공|클리어/);
    const paid=wallet(s),resultId=s.activities.lastResult.runId;await p.reload();await p.waitForSelector('#modal .dungeon-result');assert.deepEqual(wallet(await saved(p)),paid);assert.equal((await saved(p)).activities.lastResult.runId,resultId);
    await p.setViewportSize({width:320,height:568});await p.locator('#modal [data-activity-exit]').scrollIntoViewIfNeeded();const resultButton=await p.locator('#modal [data-activity-exit]').boundingBox();assert.ok(resultButton.y+resultButton.height<=568);await p.screenshot({path:'/tmp/school-dungeon-result-mobile.png'});await p.setViewportSize({width:844,height:390});
    await enter(p,'daily');assert.equal(keys(await saved(p)).daily,1);s=await finishGuest(p,false);assert.equal(s.activities.lastResult.refunded,true);assert.equal(keys(s).daily,2);assert.deepEqual(wallet(s),paid);assert.match(await p.locator('.dungeon-result').innerText(),/열쇠.*돌려|열쇠.*반환/);
    await enter(p,'daily');assert.equal(keys(await saved(p)).daily,1);await tab(p,'dungeons');await p.click('#dungeon-current [data-activity-exit]');await p.waitForFunction(()=>!JSON.parse(localStorage.getItem('school-mercenaries-v8')).activities.run);assert.equal(keys(await saved(p)).daily,2);
    console.log('PASS dungeon entry spends one key, active run blocks conflicting actions, success persists once, and defeat/abandon refund the entry key');

    s=await saved(p);s.at=Date.now()+60000;await seedGuest(p,s);await enter(p,'tower',1);const towerBefore=wallet(await saved(p));s=await finishGuest(p,true);
    assert.equal(s.activities.towerBest,1);assert.equal(s.activities.lastResult.firstClear,true);assert.deepEqual(s.activities.lastResult.reward,{gold:105,gems:10,xp:0});assert.deepEqual(wallet(s),{gold:towerBefore.gold+105,gems:towerBefore.gems+10});
    await enter(p,'tower',1);const replayBefore=await saved(p);s=await finishGuest(p,true);assert.equal(s.activities.lastResult.firstClear,false);assert.deepEqual(s.activities.lastResult.reward,{gold:0,gems:0,xp:0});assert.deepEqual(wallet(s),wallet(replayBefore));assert.deepEqual(progress(s),progress(replayBefore));assert.equal(s.activities.towerBest,1);
    assert.match(await p.locator('.dungeon-result').innerText(),/추가 보상 없음/);await p.click('#modal [data-activity-mode="tower"][data-floor="2"]');await p.waitForFunction(()=>!document.getElementById('modal').open);assert.equal((await saved(p)).activities.run.floor,2);s=await finishGuest(p,true);assert.equal(s.activities.towerBest,2);assert.deepEqual(s.activities.lastResult.reward,{gold:110,gems:10,xp:0});
    await closeModal(p);await tab(p,'dungeons');assert.equal(await p.locator('#tower-floor').getAttribute('max'),'3');assert.deepEqual(keys(s),{daily:2,weekly:2});
    console.log('PASS tower sequential floors grant first-clear rewards only; replay gives no currency, unit XP or captain XP and next-floor UI works');

    await enter(p,'daily');s=await saved(p);s.at=Date.now()+60000;s.activities.daily.period--;s.activities.run.period--;s.activities.weekly.period--;s.activities.weekly.used=2;await seedGuest(p,s);await tab(p,'dungeons');
    assert.equal(await p.locator('#daily-keys').textContent(),'3');assert.equal(await p.locator('#weekly-keys').textContent(),'2');await p.click('#dungeon-current [data-activity-exit]');await p.waitForFunction(()=>!JSON.parse(localStorage.getItem('school-mercenaries-v8')).activities.run);
    s=await saved(p);assert.equal(s.activities.lastResult.refunded,false);assert.deepEqual(keys(s),{daily:3,weekly:2});assert.equal(s.activities.daily.period,G.day(Date.now()));assert.equal(s.activities.weekly.period,G.week(Date.now()));
    s.at=Date.now()+60000;s.activities.daily.used=3;s.activities.weekly.used=2;await seedGuest(p,s);await tab(p,'dungeons');assert.ok(await p.locator('#daily-enter').isDisabled());assert.ok(await p.locator('#weekly-enter').isDisabled());
    console.log('PASS expired daily/weekly periods refill to their caps, old-run abandonment adds no extra key, and zero-key entry is disabled');

    const identity=(await t.login('dungeon-cloud')).data;await t.call('/api/school/state',{catalogVersion:G.CATALOG_VERSION},null,{'X-Account-Session':identity.token});s=G.create(Date.now()+60000,47);writeCloud(identity.profile.id,s);
    const cloud=await page('dungeon-cloud');await login(cloud);await coupon(cloud,'LAVA_DEBUT');await coupon(cloud,'THANK_YOU');assert.deepEqual(wallet(readCloud(identity.profile.id)),{gold:2200,gems:3300});
    await tab(cloud,'dungeons');await cloud.click('[data-dungeon="daily"]');dropNextAction();await cloud.click('#daily-enter');await cloud.waitForSelector('#connection:not([hidden])');assert.equal(readCloud(identity.profile.id).activities.daily.used,1);const runId=readCloud(identity.profile.id).activities.run.id;
    await cloud.reload();await cloud.waitForFunction(()=>document.getElementById('account-label').textContent==='계정 저장'&&!sessionStorage.getItem('school-pending-action'));assert.equal(readCloud(identity.profile.id).activities.run.id,runId);assert.equal(readCloud(identity.profile.id).activities.daily.used,1);
    const other=await page('dungeon-cloud');await login(other);await tab(other,'dungeons');assert.ok(await other.locator('#daily-enter').isDisabled());assert.equal(await other.locator('#daily-keys').textContent(),'2');
    const cloudBefore=wallet(readCloud(identity.profile.id));writeCloud(identity.profile.id,prepareFinish(readCloud(identity.profile.id),true));await Promise.all([cloud.reload(),other.reload()]);await Promise.all([cloud.waitForSelector('#modal .dungeon-result'),other.waitForSelector('#modal .dungeon-result')]);
    s=readCloud(identity.profile.id);assert.equal(s.activities.lastResult.runId,runId);assert.deepEqual(wallet(s),{gold:cloudBefore.gold+2000,gems:cloudBefore.gems+80});assert.equal(s.activities.daily.used,1);
    await Promise.all([cloud.reload(),other.reload()]);await Promise.all([cloud.waitForSelector('#modal .dungeon-result'),other.waitForSelector('#modal .dungeon-result')]);assert.deepEqual(wallet(readCloud(identity.profile.id)),wallet(s));await other.close();
    // The second session may have advanced the server revision during reload.
    // Explicitly synchronize before a distinct purchase; stale requests must
    // remain rejected rather than silently rebased into a fresh key spend.
    await closeModal(cloud);await cloud.click('#account-button');await Promise.all([cloud.waitForResponse(r=>r.url().includes('/api/school/state')&&r.status()===200),cloud.click('#cloud-refresh')]);await cloud.waitForFunction(()=>document.getElementById('save-status').dataset.state==='saved');await closeModal(cloud);
    await enter(cloud,'weekly');assert.equal(readCloud(identity.profile.id).activities.weekly.used,1);const weeklyBefore=wallet(readCloud(identity.profile.id));writeCloud(identity.profile.id,prepareFinish(readCloud(identity.profile.id),true));await cloud.reload();await cloud.waitForSelector('#modal .dungeon-result');s=readCloud(identity.profile.id);assert.deepEqual(s.activities.lastResult.reward,G.activityReward('weekly',1));assert.deepEqual(wallet(s),{gold:weeklyBefore.gold+12000,gems:weeklyBefore.gems+600});
    console.log('PASS real SQLite account coupons, lost entry response/reload, two-session key/result sync and daily/weekly rewards commit exactly once');

    await runMotionChecks(p,saved);
  }finally{for(const p of pages)await p.context().close();Date.now=realNow;}
}

async function runMotionChecks(page,saved){
  const rendered=await page.evaluate(()=>{
    const make=()=>{const c=document.createElement('canvas');c.width=480;c.height=280;return c.getContext('2d');};
    const motions={};for(const id of['osia','lava'])for(let stage=1;stage<=(id==='osia'?4:2);stage++){
      const frames=[];for(const age of[.15,.55,.9]){const c=make(),motion=SchoolArt.poseForSkill(id,stage,age,false);SchoolArt.hero(c,id,240+motion.dx,200+motion.dy,3,{motion,pose:motion.pose,shadowY:-motion.dy/3,casting:true});frames.push(c.canvas.toDataURL());}motions[`${id}-${stage}`]=frames;
    }
    const s=JSON.parse(localStorage.getItem('school-mercenaries-v8')),base=JSON.parse(JSON.stringify(s));
    // Compare body rectangles only, excluding HP bars and damage labels.
    const normal=make(),empty=make();base.battle.heroes=[];SchoolArt.draw(normal,s,0,[],true);SchoolArt.draw(empty,base,0,[],true);
    const counts=[[228,216],[160,216],[92,216],[202,137],[134,137],[66,137]].map(([x,y])=>{const a=normal.getImageData(x-22,y-64,44,58).data,b=empty.getImageData(x-22,y-64,44,58).data;let n=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])n++;return n;});
    return{motions,counts,png:normal.canvas.toDataURL()};
  });
  for(const [key,frames]of Object.entries(rendered.motions)){assert.equal(new Set(frames).size,3,`${key} body must move across skill phases independently of particles/text`);for(const [i,data]of frames.entries())fs.writeFileSync(`/tmp/school-motion-${key}-${i}.png`,Buffer.from(data.split(',')[1],'base64'));}
  assert.ok(rendered.counts.every(n=>n>100),'All six bodies must be rendered in separate front/rear positions: '+rendered.counts);
  fs.writeFileSync('/tmp/school-six-body-check.png',Buffer.from(rendered.png.split(',')[1],'base64'));
  console.log('PASS six distinct rendered bodies and independently moving Osia/Lava skill poses across every skill stage');
}

module.exports={runDungeonRegressions};
