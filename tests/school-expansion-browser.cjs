const assert=require('node:assert/strict'),fs=require('node:fs');
const G=require('../school/engine.js');
const {seedGuest}=require('./school-ui-regressions.cjs');

async function runExpansionRegressions({pageFor,saved,tab,t,login}){
  const realNow=Date.now,campaign=Date.parse('2026-11-18T03:00:00Z'),offset=campaign-realNow(),pages=[];
  // Exercise the limited banner during its campaign, with clocks that keep
  // running so actual combat pacing and animation delays remain observable.
  Date.now=()=>realNow()+offset;
  async function page(person,width=844,height=390){
    const p=await pageFor(person,width,height);pages.push(p);
    await p.context().addInitScript(offset=>{const RealDate=Date;window.Date=class extends RealDate{constructor(...args){if(args.length)super(...args);else super(RealDate.now()+offset);}static now(){return RealDate.now()+offset;}};},offset);
    await p.reload();await p.waitForFunction(()=>document.querySelectorAll('#party [data-hero]').length>=1);return p;
  }
  async function draw(p,roll,pick){
    await p.evaluate(([roll,pick])=>{window.expNormalRandom=Math.random;let i=0;Math.random=()=>++i%2?roll:pick;},[roll,pick]);
    try{await p.click('#recruit-one');await p.waitForSelector('.result-card');return await p.locator('.result-card').innerText();}
    finally{await p.evaluate(()=>{Math.random=window.expNormalRandom;});}
  }
  const png=(name,data)=>fs.writeFileSync(`/tmp/school-expansion-${name}.png`,Buffer.from(data.split(',')[1],'base64'));
  async function watch(p){
    await p.evaluate(()=>{
      const original=SchoolArt.draw;window.expFrames={};window.expEvents=[];window.expLive=null;window.expCutin=[];let last=0;
      function render(s,time,events,reduced){const canvas=document.createElement('canvas');canvas.width=480;canvas.height=280;const c=canvas.getContext('2d'),labels=[],fill=c.fillText;c.fillText=function(text,...args){labels.push(text);return fill.call(this,text,...args);};original(c,s,time,events,reduced);return{c,png:canvas.toDataURL(),labels};}
      SchoolArt.draw=function(c,s,time,events,reduced){
        original(c,s,time,events,reduced);window.expLive={elapsed:s.battle.elapsed,simTime:s.simTime,speed:s.speed,wall:Date.now()};
        for(const e of s.events.filter(e=>e.seq>last))window.expEvents.push(e);last=s.seq;
        for(const kind of['lava-skill','rescue','guard','cinematic']){
          const e=events.findLast(e=>e.kind===kind&&(e.from==='lava'||kind==='cinematic')),age=e?time-e.time:-1;
          const key=kind==='lava-skill'?`lava-${e?.stage}`:kind==='guard'?`guard-${e?.passive}`:kind;
          if(!e||window.expFrames[key]||(kind==='cinematic'?(!s.battle.cinematic||age<.02||age>e.duration/1000):(age<.08||age>.4)))continue;
          const actual=render(s,time,events,reduced),plain=JSON.parse(JSON.stringify(s));if(kind==='cinematic')delete plain.battle.cinematic;
          const base=render(plain,time,events.filter(x=>x.from!==(kind==='cinematic'?'osia':'lava')),reduced);
          const a=actual.c.getImageData(0,0,480,280).data,b=base.c.getImageData(0,0,480,280).data;let changed=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])changed++;
          window.expFrames[key]={png:actual.png,labels:actual.labels,changed,event:e,state:JSON.parse(JSON.stringify(s)),time,events:JSON.parse(JSON.stringify(events))};
        }
        if(s.battle.cinematic)window.expCutin.push({elapsed:s.battle.elapsed,wall:Date.now(),simTime:s.simTime,energy:s.battle.heroes.map(h=>h.energy),hp:s.battle.enemies.map(e=>e.hp)});
      };
      window.expStatic=(frame,reduced)=>{const s=window.expFrames[frame];return render(s.state,s.time,s.events,reduced).labels;};
    });
  }
  try{
    const p=await page('expansion-guest');const legacy=G.create(Date.now()+60000,26);
    legacy.gold=1234;legacy.gems=5000;legacy.pity=59;legacy.units.harin.level=17;legacy.redeemedCodes=['OSIA_DEBUT'];delete legacy.banners;delete legacy.speed;delete legacy.simTime;delete legacy.simCredit;
    await seedGuest(p,legacy,'school-mercenaries-v5');let s=await saved(p);
    assert.equal(s.gold,1234);assert.equal(s.gems,5000);assert.equal(s.units.harin.level,17);assert.deepEqual(s.redeemedCodes,['OSIA_DEBUT']);
    assert.deepEqual(s.banners,{osia:{pity:59,guaranteed:false},lava:{pity:0,guaranteed:false}});assert.equal(s.speed,1);
    await tab(p,'recruit');assert.equal(await p.locator('#pity-count').textContent(),'59 / 80');
    await p.click('[data-banner="lava"]');assert.equal(await p.locator('#pity-count').textContent(),'0 / 80');assert.match(await p.locator('#banner-deadline').textContent(),/11월 20|11\/20|11\.20/);
    await p.click('#rates-button');const rates=await p.locator('#modal-content').innerText();assert.match(rates,/라바/);assert.match(rates,/50%/);assert.match(rates,/0\.1667/);await p.click('#modal-close');
    await draw(p,.99,.99);await p.click('#modal-close');s=await saved(p);assert.equal(s.banners.lava.pity,1);assert.equal(s.banners.osia.pity,59);
    await p.reload();await tab(p,'recruit');assert.equal(await p.locator('[data-banner="lava"]').getAttribute('aria-pressed'),'true');assert.equal(await p.locator('#pity-count').textContent(),'1 / 80');
    await p.click('[data-banner="osia"]');assert.equal(await p.locator('#pity-count').textContent(),'59 / 80');
    assert.doesNotMatch(await draw(p,.001,.99),/오시아|라바/);await p.click('#modal-close');assert.equal((await saved(p)).banners.osia.guaranteed,true);assert.match(await p.locator('#banner-status').textContent(),/확정|100%/);
    assert.match(await draw(p,.001,.99),/오시아/);await p.click('#modal-close');assert.equal((await saved(p)).banners.osia.guaranteed,false);assert.equal((await saved(p)).banners.lava.pity,1);
    await p.click('[data-banner="lava"]');assert.match(await draw(p,.001,.1),/라바/);await p.click('#modal-close');assert.ok((await saved(p)).units.lava);assert.equal((await saved(p)).banners.lava.pity,0);
    assert.equal(await p.evaluate(()=>SchoolArt.assetsReady('lava')),true);
    console.log('PASS v5→v8 migration, two actual banner draws, separate pity, 50/50 miss guarantee, selected banner reload and Lava asset');

    for(const [width,height]of[[2560,1440],[320,568],[568,280]]){
      await p.setViewportSize({width,height});await tab(p,'recruit');
      for(const selector of['[data-banner="osia"]','[data-banner="lava"]','#recruit-one','#recruit-ten']){
        await p.locator(selector).scrollIntoViewIfNeeded();const b=await p.locator(selector).boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width+1&&b.y>=0&&b.y+b.height<=height+1,selector+' must remain reachable');
      }
      assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1));
      await p.screenshot({path:`/tmp/school-expansion-recruit-${width}x${height}.png`});
    }
    await p.setViewportSize({width:844,height:390});await tab(p,'adventure');await p.click('#formation-button');await p.click('#roster [data-hero="lava"]');
    assert.match(await p.locator('#modal-content').innerText(),/라바/);await p.locator('.hero-skills summary').click();assert.match(await p.locator('#modal-content').innerText(),/바람의 부채|바람의 상처/);
    await p.click('#train-hero');await p.waitForFunction(()=>JSON.parse(localStorage.getItem('school-mercenaries-v8')).units.lava.level===2);await p.click('[data-slot="1"]');await p.waitForFunction(()=>!document.getElementById('modal').open);
    await p.reload();assert.equal((await saved(p)).team[1],'lava');assert.equal((await saved(p)).units.lava.level,2);

    s=await saved(p);s.at=Date.now()+600;s.speed=1;s.simCredit=0;s.units.lava.nextSkill=1;s.units.lava.basicHits=9;G.action(s,{kind:'stage',stage:1,mode:'farm'},Date.now());
    for(const h of s.battle.heroes){h.hp=Math.round(h.max*.3);}for(const e of s.battle.enemies){e.hp=e.max=100000;e.atk=1;}
    await p.emulateMedia({reducedMotion:'no-preference'});await seedGuest(p,s);await watch(p);
    await p.waitForFunction(()=>window.expFrames['lava-1']&&window.expFrames['lava-2']&&window.expFrames['guard-ten-hits'],{},{timeout:20000});
    const lava=await p.evaluate(()=>({frames:window.expFrames,events:window.expEvents}));
    for(const key of['lava-1','lava-2','guard-ten-hits']){assert.ok(lava.frames[key].changed>100,`${key} needs a visible effect`);png(key,lava.frames[key].png);}
    assert.notEqual(lava.frames['lava-1'].png,lava.frames['lava-2'].png);
    assert.ok(lava.events.some(e=>e.kind==='heal'&&e.from==='lava'&&e.amount>0));assert.ok(lava.events.some(e=>e.kind==='guard'&&e.from==='lava'&&e.amount>0));
    assert.ok(lava.frames['lava-1'].labels.some(text=>text.includes('바람의 부채')));assert.ok(lava.frames['lava-2'].labels.some(text=>text.includes('바람의 상처')));
    s=await saved(p);s.at=Date.now()+600;s.units.lava.basicHits=0;G.action(s,{kind:'stage',stage:1,mode:'farm'},Date.now());for(const h of s.battle.heroes){h.hp=1;h.shield=0;}for(const e of s.battle.enemies){e.hp=e.max=100000;e.atk=10000;}
    await seedGuest(p,s);await watch(p);
    try{await p.waitForFunction(()=>!!window.expFrames.rescue,{},{timeout:5000});}
    catch(error){const details=await p.evaluate(()=>({state:JSON.parse(localStorage.getItem('school-mercenaries-v8')),events:window.expEvents,frames:Object.keys(window.expFrames),live:window.expLive,now:Date.now()}));fs.writeFileSync('/tmp/school-expansion-rescue-debug.json',JSON.stringify(details,null,2));console.error('Rescue capture details:',{at:details.state.at,now:details.now,battle:details.state.battle,frames:details.frames,live:details.live,events:details.events.filter(e=>e.kind==='rescue')});throw error;}
    const rescue=await p.evaluate(()=>window.expFrames.rescue);
    assert.ok(rescue.changed>100);assert.equal(rescue.event.duration,2000);assert.ok(rescue.state.battle.heroes.find(h=>h.id===rescue.event.to).hp>=1);png('lava-rescue',rescue.png);
    console.log('PASS recruited Lava trains/equips/reloads and renders both healing skills, shields, ten-hit passive and lethal-hit rescue');

    for(const [speed,simCredit]of[[1,0],[1.5,250]]){
      s=G.create(Date.now()+600,36);s.speed=speed;s.simCredit=simCredit;s.units.osia={level:1,xp:0,stars:0,shards:0,nextSkill:4};s.team[1]='osia';G.action(s,{kind:'stage',stage:1,mode:'farm'},Date.now());for(const e of s.battle.enemies){e.hp=e.max=100000;e.atk=1;}
      await seedGuest(p,s);await watch(p);await p.waitForFunction(()=>window.expFrames.cinematic&&window.expEvents.some(e=>e.kind==='skill-impact'&&e.stage===4),{},{timeout:10000});
      const osia=await p.evaluate(()=>({frame:window.expFrames.cinematic,cutin:window.expCutin,events:window.expEvents}));
      assert.ok(osia.frame.changed>480*280*.2,'Cut-in must cover a meaningful part of the battlefield');assert.ok(osia.frame.labels.some(text=>text.includes('용왕의 권능')));png(`osia-cutin-${speed}x`,osia.frame.png);
      assert.ok(osia.cutin.length>=3,'Even the 1.5× two-step batch must leave a visible cut-in');assert.ok(osia.cutin.at(-1).wall-osia.cutin[0].wall>=150);
      assert.equal(new Set(osia.cutin.map(x=>x.elapsed)).size,1);assert.equal(new Set(osia.cutin.map(x=>JSON.stringify([x.energy,x.hp]))).size,1,'Combat cannot advance underneath the cut-in');
      const cinematic=osia.events.find(e=>e.kind==='cinematic'),impact=osia.events.find(e=>e.kind==='skill-impact'&&e.stage===4);assert.equal(cinematic.duration,1000);assert.equal(impact.simAt-cinematic.simAt,2000);
      const stuns=osia.events.filter(e=>e.kind==='stun');assert.equal(stuns.length,3);assert.ok(stuns.every(e=>e.duration===1500));assert.ok((await p.evaluate(()=>window.expStatic('cinematic',true))).some(text=>text.includes('용왕의 권능')));
    }
    console.log('PASS visible Osia cut-in at 1×/1.5×, including two-step batches, freezes combat before impact and supports reduced motion');

    s=G.create(Date.now()+60000,16);s.gold=100000;s.best=59;s.units.lava={level:99,xp:0,stars:0,shards:0};s.team[1]='lava';G.action(s,{kind:'stage',stage:60,mode:'farm'},Date.now());await seedGuest(p,s);
    await p.click('#battle-stage');assert.equal(await p.locator('[data-stage]').count(),60);assert.ok(await p.locator('[data-stage="60"]').isEnabled());await p.click('[data-stage="60"]');await p.waitForFunction(()=>!document.getElementById('modal').open);assert.equal((await saved(p)).stage,60);
    await p.click('#party [data-hero="lava"]');assert.match(await p.locator('.hero-stat-grid').innerText(),/100/);await p.click('#train-hero');await p.waitForFunction(()=>JSON.parse(localStorage.getItem('school-mercenaries-v8')).units.lava.level===100);assert.ok(await p.locator('#train-hero').isDisabled());await p.reload();assert.equal((await saved(p)).units.lava.level,100);
    console.log('PASS all 60 stage choices and level 99→100 training cap persist through reload');

    const identity=(await t.login('expansion-speed')).data;await t.call('/api/school/state',{catalogVersion:G.CATALOG_VERSION},null,{'X-Account-Session':identity.token});s=G.create(Date.now(),8);for(const h of s.battle.heroes){h.hp=h.max=100000;}for(const e of s.battle.enemies){e.hp=e.max=100000;e.atk=1;}
    t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(s),identity.profile.id);
    const cloud=await page('expansion-speed');await login(cloud);await watch(cloud);
    for(const speed of[1,1.5]){
      await cloud.click(`[data-speed="${speed}"]`);await cloud.waitForFunction(speed=>document.querySelector(`[data-speed="${speed}"]`).getAttribute('aria-pressed')==='true',speed);
      await cloud.waitForFunction(speed=>window.expLive?.speed===speed,speed);const start=await cloud.evaluate(()=>window.expLive);await cloud.waitForTimeout(4600);const end=await cloud.evaluate(()=>window.expLive);
      const wall=end.wall-start.wall,expected=wall*speed,actual=end.elapsed-start.elapsed;
      // The engine advances in 500ms batches; sample several seconds so endpoint
      // quantization cannot be mistaken for a missing 1.5× speed multiplier.
      assert.ok(Math.abs(actual-expected)<1000&&Math.abs(actual/wall-speed)<.23,`Speed ${speed} must change game time, not only its label: actual=${actual}, expected=${expected}`);
      assert.equal(JSON.parse(t.sqlite.prepare('SELECT payload FROM school_saves WHERE account_id=?').get(identity.profile.id).payload).speed,speed);
    }
    await cloud.reload();await cloud.waitForFunction(()=>document.querySelector('[data-speed="1.5"]').getAttribute('aria-pressed')==='true');assert.equal(JSON.parse(t.sqlite.prepare('SELECT payload FROM school_saves WHERE account_id=?').get(identity.profile.id).payload).speed,1.5);
    console.log('PASS authenticated speed controls persist on the server and real-time combat follows 1× and 1.5× pacing');
  }finally{for(const p of pages)await p.context().close();Date.now=realNow;}
}

module.exports={runExpansionRegressions};
