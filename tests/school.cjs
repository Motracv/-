const assert = require('node:assert/strict');
const G = require('../school/engine.js');
let passed = 0;
function test(name, body) { body(); passed++; console.log('PASS', name); }
function run(s, seconds) { for (let i = 0; i < seconds; i++) G.advance(s, s.at + 1000); }
const UPDATE_TIME=Date.parse('2026-11-18T12:00:00+09:00');
function setPity(s,pity,banner='osia') { s.banners[banner].pity=pity; if(banner==='osia')s.pity=pity; }
test('Automatic combat wins, grants XP, unlocks stages and stays deterministic across reload', () => {
  const a = G.create(1000, 287), b = G.clone(a); run(a, 120); G.advance(b, 61000); const c = G.clone(b); G.advance(c, 121000);
  assert.deepEqual(a, c); assert.ok(a.best >= 1); assert.ok(a.units.harin.level > 1 || a.units.harin.xp > 0); assert.ok(a.gold > 700); assert.ok(a.gems > 1800);
});
test('Offline rewards cap at eight hours, never skip stages, and cannot be claimed twice', () => {
  const s = G.create(1000); const best = s.best; G.advance(s, 1000 + 48 * 3600000);
  assert.equal(s.offline.seconds, 28800); assert.equal(s.offline.gold, 9600); assert.equal(s.best, best);
  G.advance(s, s.at + 9 * 3600000); assert.equal(s.offline.seconds, 28800);
  const before = s.gold, reward = G.action(s, {kind:'offline'}); assert.equal(s.gold, before + reward.reward.gold + 700); assert.equal(s.captain.level,2);
  const snapshot = G.clone(s); assert.throws(() => G.action(s, {kind:'offline'})); assert.deepEqual(s, snapshot);
});
test('Exactly 90 seconds simulate battle; longer absences bank rewards; backward clocks give nothing', () => {
  const a = G.create(1000), b = G.create(1000); G.advance(a, 91000); G.advance(b, 92000);
  assert.equal(a.offline.seconds, 0); assert.equal(b.offline.seconds, 91);
  const old = G.clone(b); G.advance(b, 0); assert.deepEqual(b, old);
});
test('SSR pity triggers on the eightieth draw and resets; 10 pulls guarantee SR+', () => {
  const s = G.create(1000); s.gems = 20000; for (let i = 0; i < 79; i++) G.action(s, {kind:'recruit',count:1}, 1000, () => .9);
  assert.equal(s.pity, 79); const result = G.action(s, {kind:'recruit',count:1},1000, () => .9);
  assert.equal(G.BY_ID[result.results[0].id].rarity, 'SSR'); assert.equal(s.pity, 0);
  const t = G.create(1000), ten = G.action(t, {kind:'recruit',count:10},1000, () => .9);
  assert.equal(ten.results.length, 10); assert.equal(t.gems, 800); assert.equal(ten.results.filter(r => G.BY_ID[r.id].rarity !== 'R').length, 1);
});
test('Soft pity starts exactly at draw 60, rises one percentage point, and caps at an SSR on 80',()=>{
  for(const [misses,expected] of [[0,.01],[39,.01],[58,.01],[59,.02],[60,.03],[69,.12],[78,.21],[79,1]]){
    const rates=G.recruitRates(misses);assert.equal(rates.SSR,expected);assert.ok(Math.abs(rates.SSR+rates.SR+rates.R-1)<1e-12);
    if(misses<79)assert.equal(rates.SR,.26);else assert.deepEqual(rates,{SSR:1,SR:0,R:0});
  }
  const s=G.create(1000);setPity(s,39);G.action(s,{kind:'recruit',count:1},1000,()=>.99);assert.equal(s.pity,40);assert.ok(G.validate(s));
  for(const [misses,roll,grade] of [[58,.015,'SR'],[59,.015,'SSR'],[59,.02,'SR'],[78,.20999,'SSR'],[78,.21,'SR'],[79,.99999,'SSR']]){
    const a=G.create(1000);setPity(a,misses);let n=0;const r=G.action(a,{kind:'recruit',count:1},1000,()=>++n%2?roll:.99);
    assert.equal(G.BY_ID[r.results[0].id].rarity,grade);assert.equal(r.results[0].ssrChance,G.recruitRates(misses).SSR);
  }
});
test('Ten-pulls update soft pity per slot, reset immediately on SSR, and preserve guarantees',()=>{
  const s=G.create(1000);setPity(s,58);const r=G.action(s,{kind:'recruit',count:10},1000,()=>.99);
  assert.deepEqual(r.results.map(x=>x.ssrChance),[.01,.02,.03,.04,.05,.06,.07,.08,.09,.10]);assert.equal(s.pity,68);assert.ok(r.results.some(x=>G.BY_ID[x.id].rarity==='SR'));
  const hard=G.create(1000);setPity(hard,78);const h=G.action(hard,{kind:'recruit',count:10},1000,()=>.99);
  assert.equal(h.results[0].ssrChance,.21);assert.equal(h.results[1].pity,true);assert.equal(h.results[1].ssrChance,1);assert.equal(h.results[2].ssrChance,.01);assert.equal(hard.pity,8);
  const reset=G.create(1000);setPity(reset,59);let i=0;const q=G.action(reset,{kind:'recruit',count:10},1000,()=>++i%2?.019:.99);
  assert.equal(G.BY_ID[q.results[0].id].rarity,'SSR');assert.equal(q.results[0].ssrChance,.02);assert.ok(q.results.slice(1).every(x=>x.ssrChance===.01&&G.BY_ID[x.id].rarity==='SR'));assert.equal(reset.pity,9);
});
test('Boundary rolls use the documented 1/26/73 probabilities and every hero is obtainable', () => {
  const obtained = new Set();
  for (const [roll, rarity] of [[0,'SSR'],[.009999,'SSR'],[.01,'SR'],[.269999,'SR'],[.27,'R'],[.999999,'R']]) {
    const pool = G.HEROES.filter(h => h.rarity === rarity && h.id!=='lava' && h.id!=='ryusion');
    for (let j = 0; j < pool.length; j++) { const s = G.create(1000), values = [roll,rarity==='SSR'?[.25,.625,.875][j]:(j+.5)/pool.length]; const r = G.action(s,{kind:'recruit',count:1},1000,()=>values.shift()); assert.equal(G.BY_ID[r.results[0].id].rarity,rarity); obtained.add(r.results[0].id); }
  }
  assert.equal(obtained.size,14); assert.ok(obtained.has('osia')); assert.ok(obtained.has('doyoon')); assert.ok(!obtained.has('lava'));
  const s=G.create(UPDATE_TIME);const featured=G.action(s,{kind:'recruit',banner:'lava',count:1},UPDATE_TIME,()=>.001);obtained.add(featured.results[0].id);assert.equal(obtained.size,15);
});
test('Duplicates award shards and awakening spends exact shards without consuming the hero', () => {
  const s = G.create(1000); s.gems = 1000; G.action(s,{kind:'recruit',count:1},1000,()=>.9); G.action(s,{kind:'recruit',count:1},1000,()=>.9); G.action(s,{kind:'recruit',count:1},1000,()=>.9);
  const id='jiho'; assert.equal(s.units[id].shards,10); const old = G.stats(id,s.units[id]); G.action(s,{kind:'awaken',hero:id}); assert.equal(s.units[id].shards,0); assert.equal(s.units[id].stars,1); assert.ok(G.stats(id,s.units[id]).hp > old.hp);
  const copy=G.clone(s); assert.throws(()=>G.action(s,{kind:'awaken',hero:id})); assert.deepEqual(s,copy);
});
test('Illegal costs, locked stages, unknown heroes and duplicate teams do not mutate progress', () => {
  const s=G.create(1000); s.gold=0;s.gems=0;
  for(const intent of [{kind:'train',hero:'harin'},{kind:'recruit',count:10},{kind:'recruit',count:-1},{kind:'train',hero:'constructor'},{kind:'stage',stage:30,mode:'progress'},{kind:'team',team:['harin','harin','sua']},{kind:'team',team:['taeo','harin','lumi']},{kind:'reward',gold:100000}]) { const old=G.clone(s);assert.throws(()=>G.action(s,intent));assert.deepEqual(s,old); }
});
test('Training costs and level caps; team swaps start a fresh battle and never duplicate a hero',()=>{
  const s=G.create(1000); const cost=G.trainingCost(s.units.harin); G.action(s,{kind:'train',hero:'harin'});assert.equal(s.gold,700-cost);assert.equal(s.units.harin.level,2);
  G.action(s,{kind:'team',team:['harin','taeo','sua']});assert.equal(s.battle.heroes[0].max,G.stats('harin',s.units.harin).hp);
  s.units.harin.level=G.MAX_LEVEL; assert.throws(()=>G.action(s,{kind:'train',hero:'harin'}));
  for(const [level,cost]of [[1,68],[40,3890],[60,8210],[99,21236]]){
    const trained=G.create(UPDATE_TIME);Object.assign(trained.units.harin,{level,xp:G.needXp(level)-1,stars:3,shards:17});trained.gold=cost-1;const old=G.clone(trained);
    assert.equal(G.trainingCost(trained.units.harin),cost);assert.throws(()=>G.action(trained,{kind:'train',hero:'harin',cost:0,gold:1e12},trained.at));assert.deepEqual(trained,old);
    trained.gold=cost;G.action(trained,{kind:'train',hero:'harin',cost:0},trained.at);assert.equal(trained.gold,0);assert.equal(trained.units.harin.level,level+1);assert.equal(trained.units.harin.xp,0);assert.equal(trained.units.harin.stars,3);assert.equal(trained.units.harin.shards,17);assert.equal(trained.gems,old.gems);assert.deepEqual(trained.captain,old.captain);assert.deepEqual(trained.units.taeo,old.units.taeo);assert.ok(G.validate(trained));
  }
});
test('Reward codes normalize case and spacing, grant exact rewards once, and survive a save reload',()=>{
  const now=Date.parse('2026-11-17T12:00:00+09:00'),s=G.create(now);
  const result=G.action(s,{kind:'redeem',code:'  thanks_for_reporting\n',gold:999999,gems:999999,now:0},now);
  assert.deepEqual(result,{kind:'redeem',code:'THANKS_FOR_REPORTING',gold:500,gems:500,expiresAt:null});
  assert.equal(s.gold,1200);assert.equal(s.gems,2300);assert.deepEqual(s.redeemedCodes,['THANKS_FOR_REPORTING']);
  const loaded=G.clone(s),before=G.clone(loaded);assert.ok(G.validate(loaded));
  for(const code of ['THANKS_FOR_REPORTING','thanks_for_reporting',' THANKS_FOR_REPORTING ']){assert.throws(()=>G.action(loaded,{kind:'redeem',code},now),/이미 사용/);assert.deepEqual(loaded,before);}
  G.action(loaded,{kind:'redeem',code:'horas_celebration'},now);assert.equal(loaded.gold,3200);assert.equal(loaded.gems,4300);
  assert.deepEqual(loaded.redeemedCodes,['THANKS_FOR_REPORTING','HORAS_CELEBRATION']);assert.ok(G.validate(G.clone(loaded)));
});
test('Retired codes cannot award currency and the two replacement codes have no invented expiry',()=>{
  const now=Date.parse('2100-01-01T00:00:00Z');
  for(const code of ['OSIA_DEBUT','BUG_FIX','LAVA_DEBUT','THANK_YOU','MAJORUPDATE']){const s=G.create(now),old=G.clone(s);assert.throws(()=>G.action(s,{kind:'redeem',code,now:0},now),/사용할 수 없는/);assert.deepEqual(s,old);}
  for(const code of ['THANKS_FOR_REPORTING','HORAS_CELEBRATION']){
    assert.equal(G.COUPONS[code].expiresAt,null);const last=G.create(now);G.action(last,{kind:'redeem',code},now);assert.deepEqual(last.redeemedCodes,[code]);
    for(const invalid of [NaN,Infinity,-1]){const s=G.create(now),old=G.clone(s);assert.throws(()=>G.action(s,{kind:'redeem',code,now},invalid),/사용 기간/);assert.deepEqual(s,old);}
  }
});
test('Coupon validation preserves old progress and rejects malformed code records without inventing rewards',()=>{
  const now=Date.parse('2026-11-17T00:00:00+09:00'),s=G.create(now);delete s.redeemedCodes;s.gold=5860;s.gems=290;s.pity=59;s.units.harin.level=40;
  const battle=G.clone(s.battle),units=G.clone(s.units);assert.ok(G.validate(s));
  for(const code of [undefined,null,12,{},'','   ','NO_SUCH_CODE','constructor','__proto__','OSIA DEBUT','ＯＳＩＡ_DEBUT','OSIA_DEBUT'.repeat(20)]){const old=G.clone(s);assert.throws(()=>G.action(s,{kind:'redeem',code},now));assert.deepEqual(s,old);}
  G.action(s,{kind:'redeem',code:'THANKS_FOR_REPORTING'},now);assert.equal(s.gold,6360);assert.equal(s.gems,790);assert.equal(s.pity,59);assert.deepEqual(s.battle,battle);assert.deepEqual(s.units,units);
  for(const record of [null,'OSIA_DEBUT',{},[null],['osia_debut'],['OSIA_DEBUT','OSIA_DEBUT']]){const invalid=G.clone(s);invalid.redeemedCodes=record;assert.equal(G.validate(invalid),false);}
  const legacy=G.clone(s);legacy.redeemedCodes=['OSIA_DEBUT','BUG_FIX','MAJORUPDATE'];assert.ok(G.validate(legacy));
});
test('Each hero performs their automatic skill; damage and healing stay bounded',()=>{
  for(const hero of G.HEROES){
    const s=G.create(1000,21);s.units[hero.id]={level:1,xp:0,stars:0,shards:0};s.team=[hero.id,...['taeo','harin','sua'].filter(id=>id!==hero.id)].slice(0,3);
    G.action(s,{kind:'stage',stage:1,mode:'farm'});
    for(const e of s.battle.enemies){e.hp=e.max=100000;e.atk=1;} for(const h of s.battle.heroes)h.hp=Math.floor(h.max*.75);
    run(s,8);assert.ok(s.events.some(e=>e.kind==='skill'&&e.from===hero.id),hero.id);
    assert.ok(s.battle.heroes.every(h=>h.hp>=0&&h.hp<=h.max&&h.shield>=0));
    if(hero.role==='치유') assert.ok(s.events.some(e=>e.kind==='heal'&&e.from===hero.id));
    if(hero.role==='수호'&&hero.id!=='ryusion') assert.ok(s.events.some(e=>e.kind==='guard'&&e.to===hero.id));
  }
});
test('Osia is a permanent SSR, can be drawn by natural roll or pity, and duplicates awaken normally',()=>{
  const s=G.create(1000); const old=G.clone(s); assert.ok(G.validate(old));
  const values=[.001,.001,.001,.001];const roll=()=>values.shift();
  const first=G.action(s,{kind:'recruit',count:1},1000,roll);assert.equal(first.results[0].id,'osia');assert.equal(first.results[0].fresh,true);
  const second=G.action(s,{kind:'recruit',count:1},1000,roll);assert.equal(second.results[0].id,'osia');assert.equal(second.results[0].shards,20);
  G.action(s,{kind:'awaken',hero:'osia'});assert.equal(s.units.osia.stars,1);assert.equal(s.units.osia.shards,10);
  setPity(s,79);const valuesAtPity=[.99,.1];const forced=G.action(s,{kind:'recruit',count:1},1000,()=>valuesAtPity.shift());assert.equal(forced.results[0].id,'osia');assert.equal(forced.results[0].pity,true);assert.equal(s.pity,0);
  G.action(s,{kind:'team',team:['taeo','osia','sua']});G.action(s,{kind:'train',hero:'osia'});assert.equal(s.units.osia.level,2);assert.ok(G.validate(G.clone(s)));
  assert.equal(G.HEROES.filter(h=>h.rarity==='SSR').length,5);assert.equal(G.RECRUIT_RATES.SSR,.01);
});
test('Independent pickup banners preserve legacy pity and guarantee the featured SSR after a miss',()=>{
  const legacy=G.create(UPDATE_TIME);delete legacy.banners;legacy.pity=59;const progress={gold:legacy.gold,gems:legacy.gems,units:G.clone(legacy.units)};
  assert.ok(G.validate(legacy));G.advance(legacy,legacy.at);
  assert.deepEqual(G.bannerState(legacy,'osia'),{pity:59,guaranteed:false});assert.deepEqual(G.bannerState(legacy,'lava'),{pity:0,guaranteed:false});
  assert.equal(legacy.gold,progress.gold);assert.equal(legacy.gems,progress.gems);assert.deepEqual(legacy.units,progress.units);
  const s=G.create(UPDATE_TIME);s.gems=20000;
  const draw=(banner,grade,pick)=>{const rolls=[grade,pick];return G.action(s,{kind:'recruit',banner,count:1},UPDATE_TIME,()=>rolls.shift()).results[0];};
  const miss=draw('osia',.001,.99);assert.ok(['ian','lumi'].includes(miss.id));assert.equal(s.banners.osia.guaranteed,true);
  assert.equal(G.BY_ID[draw('osia',.99,.99).id].rarity,'R');assert.equal(s.banners.osia.guaranteed,true);
  assert.equal(draw('lava',.001,.001).id,'lava');assert.equal(s.banners.osia.guaranteed,true);assert.equal(s.banners.lava.guaranteed,false);
  assert.equal(draw('osia',.001,.99).id,'osia');assert.equal(s.banners.osia.guaranteed,false);assert.equal(s.pity,s.banners.osia.pity);
  setPity(s,79,'lava');const hard=draw('lava',.99,.99);assert.equal(hard.pity,true);assert.ok(['osia','ian','lumi'].includes(hard.id));assert.equal(s.banners.lava.guaranteed,true);assert.equal(s.banners.lava.pity,0);
  const loaded=G.clone(s);const rolls=[.001,.99];assert.equal(G.action(loaded,{kind:'recruit',banner:'lava',count:1},UPDATE_TIME,()=>rolls.shift()).results[0].id,'lava');assert.equal(loaded.banners.lava.guaranteed,false);
  assert.deepEqual(s.banners.osia,loaded.banners.osia);
});
test('Each banner uses exact SSR 50:50 boundaries, one ten-pull guarantee, and never leaks limited Lava into Osia',()=>{
  for(const banner of ['osia','lava'])for(const guaranteed of [false,true]){
    const s=G.create(UPDATE_TIME);s.banners[banner].guaranteed=guaranteed;const rates=G.bannerHeroRates(s,banner);
    for(const[rarity,total]of [['SSR',.01],['SR',.26],['R',.73]])assert.ok(Math.abs(G.HEROES.filter(h=>h.rarity===rarity).reduce((sum,h)=>sum+rates[h.id],0)-total)<1e-12);
    assert.equal(rates[banner],guaranteed?.01:.005);assert.equal(banner==='osia'?rates.lava:rates.osia,guaranteed?0:banner==='osia'?0:.005/3);
  }
  for(const banner of ['osia','lava'])for(const [pick,featured]of [[0,true],[.499999,true],[.5,false],[.999999,false]]){
    const s=G.create(UPDATE_TIME),values=[.001,pick],r=G.action(s,{kind:'recruit',banner,count:1},UPDATE_TIME,()=>values.shift());
    assert.equal(r.results[0].id===banner,featured);assert.equal(s.banners[banner].guaranteed,!featured);
    if(banner==='osia')assert.notEqual(r.results[0].id,'lava');
  }
  const s=G.create(UPDATE_TIME);setPity(s,78,'lava');const r=G.action(s,{kind:'recruit',banner:'lava',count:10},UPDATE_TIME,()=>.99);
  assert.equal(r.results[0].ssrChance,.21);assert.equal(r.results[1].ssrChance,1);assert.equal(s.banners.lava.pity,8);assert.equal(s.banners.osia.pity,0);assert.equal(s.banners.lava.guaranteed,true);
  assert.ok(r.results.some(x=>G.BY_ID[x.id].rarity!=='R'));
  const s2=G.create(UPDATE_TIME);let n=0;const all=G.action(s2,{kind:'recruit',banner:'lava',count:10},UPDATE_TIME,()=>++n%2?.001:.99);
  assert.deepEqual(all.results.map(x=>x.id==='lava'),[false,true,false,true,false,true,false,true,false,true]);assert.equal(s2.banners.lava.guaranteed,false);
});
test('Lava pickup ends exactly after November 20 KST and invalid banners do not spend or reset accumulated guarantees',()=>{
  const end=Date.parse('2026-11-21T00:00:00+09:00');
  const last=G.create(end-1);assert.equal(G.action(last,{kind:'recruit',banner:'lava',count:1},end-1,()=>.001).results[0].id,'lava');
  for(const now of [end,end+1000]){
    const s=G.create(now);s.banners.lava={pity:79,guaranteed:true};const before=G.clone(s);
    assert.throws(()=>G.action(s,{kind:'recruit',banner:'lava',count:1,now:end-1},now,()=>.001));assert.deepEqual(s,before);
    assert.equal(G.action(s,{kind:'recruit',banner:'osia',count:1},now,()=>.001).results[0].id,'osia');assert.deepEqual(s.banners.lava,before.banners.lava);
  }
  for(const banner of ['unknown','constructor','__proto__',{},null]){const s=G.create(UPDATE_TIME),old=G.clone(s);assert.throws(()=>G.action(s,{kind:'recruit',banner,count:1},UPDATE_TIME));assert.deepEqual(s,old);}
});
function osiaBattle(boss = false) {
  const s=G.create(1000,26);s.units.osia={level:1,xp:0,stars:0,shards:0};G.action(s,{kind:'team',team:['taeo','osia','sua']});
  for(const h of s.battle.heroes){h.hp=h.id==='osia'?10000:0;h.max=10000;}
  if(boss){s.battle.boss=true;s.battle.enemies=s.battle.enemies.slice(0,1);s.battle.enemies[0].boss=true;}
  for(const e of s.battle.enemies){e.hp=e.max=100000;e.atk=1;}return s;
}
test('Osia casts successive skills on the combat clock; the dragon cinematic adds its configured pause',()=>{
  const s=osiaBattle(),seen=[],hitStages=[];let seq=s.seq;
  for(let ms=500;ms<=27000;ms+=500){
    G.advance(s,s.at+500);for(const e of s.events.filter(e=>e.seq>seq)){if(e.from==='osia')seen.push(e);if(e.kind==='hit'&&e.skill&&e.from==='osia')hitStages.push(e);}seq=s.seq;
  }
  const casts=seen.filter(e=>e.kind==='skill-stage');assert.deepEqual(casts.map(e=>e.stage),[1,2,3,4,1]);assert.deepEqual(casts.map(e=>e.at),[6000,11000,16000,21000,26000+G.OSIA_CINEMATIC_MS]);
  for(let i=0;i<casts.length;i++){
    const cast=casts[i],hits=hitStages.filter(e=>e.castId===cast.castId);assert.equal(hits.length,3);assert.ok(hits.every(e=>e.stage===cast.stage&&e.at===cast.at+(cast.stage===4?G.OSIA_CINEMATIC_MS+1000:500)&&e.amount>=40&&e.amount<=73));
    if(i<casts.length-1)assert.ok(seen.filter(e=>e.kind==='hit'&&!e.skill&&e.at>cast.at&&e.at<casts[i+1].at).length>=3);
  }
  assert.equal(s.units.osia.nextSkill,2);assert.equal(G.BY_ID.osia.passive,'용왕의 권능');
});
test('Water dragon deals no damage or stun while summoning; impact stuns all survivors/bosses for 1500ms',()=>{
  for(const boss of [false,true]){
    const s=osiaBattle(boss);s.units.osia.nextSkill=4;run(s,5);const id=s.battle.osiaCast.id;
    assert.ok(!s.events.some(e=>e.castId===id&&e.kind==='hit'));assert.ok(s.battle.enemies.every(e=>!e.stunUntil));
    const frozen=G.clone(s.battle),at=s.at;G.advance(s,at+250);assert.deepEqual(s.battle,frozen);
    for(let paused=500;paused<=G.OSIA_CINEMATIC_MS;paused+=500){
      G.advance(s,at+paused);assert.equal(s.battle.elapsed,frozen.elapsed);assert.deepEqual(s.battle.enemies,frozen.enemies);assert.ok(!s.events.some(e=>e.castId===id&&e.kind==='hit'));assert.ok(s.battle.osiaCast);assert.ok(s.battle.enemies.every(e=>!e.stunUntil));
      if(paused<G.OSIA_CINEMATIC_MS){assert.deepEqual(s.battle.heroes,frozen.heroes);assert.equal(s.battle.cinematic.remaining,G.OSIA_CINEMATIC_MS-paused);}
    }
    G.advance(s,s.at+500);assert.equal(s.battle.elapsed,5500);assert.ok(s.battle.osiaCast);assert.ok(s.battle.enemies.every(e=>!e.stunUntil));
    G.advance(s,s.at+500);assert.equal(s.battle.elapsed,6000);assert.equal(s.battle.osiaCast,undefined);assert.ok(s.battle.enemies.every(e=>e.stunUntil===7500));
    for(let i=0;i<2;i++){G.advance(s,s.at+500);assert.ok(s.battle.enemies.every(e=>e.stunUntil>s.battle.elapsed));assert.ok(!s.events.some(e=>e.kind==='hit'&&e.side==='hero'&&e.at===s.at));}
    G.advance(s,s.at+500);assert.equal(s.battle.elapsed,7500);assert.ok(s.battle.enemies.every(e=>e.stunUntil===s.battle.elapsed));
    G.advance(s,s.at+500);assert.equal(s.events.filter(e=>e.kind==='hit'&&e.side==='hero'&&e.at===s.at).length,boss?1:3);
  }
});
test('The dragon cut-in resumes the remaining ally turns instead of deleting a back-row heal',()=>{
  const s=G.create(UPDATE_TIME,26);s.units.osia={level:1,xp:0,stars:0,shards:0};s.units.lava={level:1,xp:0,stars:0,shards:0};G.action(s,{kind:'team',team:['taeo','osia','lava']});
  for(const e of s.battle.enemies){e.hp=e.max=1000000;e.atk=0;}for(const h of s.battle.heroes){h.max=10000;h.hp=5000;}
  const seen=[];let seq=s.seq;for(let step=0;step<(20000+G.OSIA_CINEMATIC_MS)/500;step++){G.advance(s,s.at+500);seen.push(...s.events.filter(e=>e.seq>seq));seq=s.seq;}
  assert.deepEqual(seen.filter(e=>e.kind==='lava-skill').map(e=>e.stage),[1,2,1,2]);
  assert.equal(seen.filter(e=>e.from==='lava'&&e.kind==='hit'&&!e.skill).length,16);
  assert.equal(seen.filter(e=>e.kind==='cinematic').length,1);
});
test('The dragon remains visible when 1.5× speed consumes two simulation ticks in one server step',()=>{
  const s=osiaBattle();s.speed=1.5;s.simCredit=250;s.battle.elapsed=500;s.battle.heroes.find(h=>h.id==='osia').energy=4;s.units.osia.nextSkill=4;
  G.advance(s,s.at+500);assert.equal(s.battle.osiaCast.stage,4);assert.ok(s.battle.cinematic);assert.equal(s.battle.cinematic.duration,G.OSIA_CINEMATIC_MS);assert.equal(s.battle.cinematic.remaining,G.OSIA_CINEMATIC_MS-500);assert.ok(s.battle.cinematic.remaining>0);assert.equal(s.battle.elapsed,1000);
  const loaded=G.clone(s);G.advance(s,s.at+2000);for(let i=0;i<4;i++)G.advance(loaded,loaded.at+500);assert.deepEqual(loaded,s);assert.equal(s.battle.cinematic,undefined);assert.equal(s.battle.osiaCast,undefined);
});
test('Every pending skill, next stage and stun survives reload and produces identical fine/batched results',()=>{
  for(let stage=1;stage<=4;stage++){
    const a=osiaBattle();a.units.osia.nextSkill=stage;run(a,5);const b=G.clone(a);assert.equal(a.battle.osiaCast.stage,stage);
    G.advance(a,a.at+2500);for(let i=0;i<5;i++)G.advance(b,b.at+500);assert.deepEqual(a,b);
  }
  const a=osiaBattle(),b=G.clone(a);G.advance(a,a.at+30000);for(let i=0;i<60;i++)G.advance(b,b.at+500);assert.deepEqual(a,b);
  const old=osiaBattle();run(old,4);delete old.battle.elapsed;delete old.battle.id;delete old.units.osia.nextSkill;old.battle.osiaCast={id:17,began:4000,next:2,targets:[]};assert.ok(G.validate(old));G.advance(old,old.at);assert.equal(old.units.osia.nextSkill,1);assert.equal(old.battle.osiaCast,undefined);G.advance(old,old.at+500);assert.equal(old.battle.elapsed,4500);
});
test('Wave transitions preserve the next skill and charge; defeat/formation restart cannot grant an instant cast',()=>{
  const s=osiaBattle();run(s,7);assert.equal(s.units.osia.nextSkill,2);assert.equal(s.battle.heroes[1].energy,2);
  s.battle.enemies.forEach(e=>e.hp=0);G.advance(s,s.at+500);G.advance(s,s.at+2000);assert.equal(s.battle.heroes[1].energy,2);assert.equal(s.units.osia.nextSkill,2);
  for(const e of s.battle.enemies){e.hp=e.max=10000;e.atk=1;}run(s,3);assert.equal(s.battle.osiaCast.stage,2);assert.equal(s.units.osia.nextSkill,3);
  G.action(s,{kind:'team',team:['osia','taeo','sua']});assert.equal(s.battle.osiaCast,undefined);assert.equal(s.units.osia.nextSkill,3);assert.equal(s.battle.heroes[0].energy,0);
  run(s,2);s.battle.heroes.forEach(h=>h.hp=0);run(s,1);assert.equal(s.battle.phase,'defeat');run(s,5);assert.equal(s.battle.heroes[0].energy,0);assert.equal(s.units.osia.nextSkill,3);
});
test('Caster death, another hero ending the wave, and party changes cancel a pending dragon without stale damage',()=>{
  for(const mode of ['death','victory','party']){
    const s=osiaBattle();s.units.osia.nextSkill=4;run(s,5);const id=s.battle.osiaCast.id;
    if(mode==='death')s.battle.heroes.find(h=>h.id==='osia').hp=0;
    if(mode==='victory')s.battle.enemies.forEach(e=>e.hp=0);
    if(mode==='party')G.action(s,{kind:'team',team:['osia','taeo','sua']});
    G.advance(s,s.at+1500);assert.equal(s.battle.osiaCast,undefined);assert.ok(!s.events.some(e=>e.kind==='hit'&&e.castId===id));assert.ok(s.battle.enemies.every(e=>!e.stunUntil));assert.equal(s.units.osia.nextSkill,1);
  }
});
function lavaBattle(seed=26) {
  const s=G.create(UPDATE_TIME,seed);s.units.lava={level:1,xp:0,stars:0,shards:0};G.action(s,{kind:'team',team:['taeo','lava','sua']});
  for(const h of s.battle.heroes){h.max=10000;h.hp=10000;h.energy=0;}
  for(const e of s.battle.enemies){e.hp=e.max=1000000;e.atk=0;}return s;
}
test('Lava alternates group wind healing/shields and a concentrated heal on the lowest living HP ratio',()=>{
  assert.equal(G.BY_ID.lava.gender,'남성');assert.equal(G.BY_ID.lava.species,'인간');assert.equal(G.BY_ID.lava.element,'wind');assert.equal(G.BY_ID.lava.rarity,'SSR');
  const s=lavaBattle();s.battle.heroes.forEach((h,i)=>h.hp=[5000,2000,8000][i]);
  run(s,5);assert.equal(s.units.lava.nextSkill,2);assert.ok(s.events.some(e=>e.kind==='lava-skill'&&e.stage===1));
  for(const h of s.battle.heroes){assert.ok(s.events.some(e=>e.kind==='heal'&&e.from==='lava'&&e.to===h.id));assert.ok(h.shield>0&&h.shield<=h.max*.6);}
  const mark=s.seq,lowest=s.battle.heroes.reduce((a,b)=>a.hp/a.max<=b.hp/b.max?a:b);run(s,5);
  assert.equal(s.units.lava.nextSkill,1);assert.ok(s.events.some(e=>e.seq>mark&&e.kind==='lava-skill'&&e.stage===2));
  const heals=s.events.filter(e=>e.seq>mark&&e.kind==='heal'&&e.from==='lava');assert.equal(heals.length,1);assert.equal(heals[0].to,lowest.id);assert.equal(heals[0].amount,Math.round(s.battle.heroes.find(h=>h.id==='lava').atk*4.5));
  const dead=lavaBattle();dead.units.lava.nextSkill=2;dead.battle.heroes[0].hp=0;dead.battle.heroes[2].hp=100;run(dead,5);assert.equal(dead.battle.heroes[0].hp,0);assert.ok(dead.events.some(e=>e.kind==='heal'&&e.from==='lava'&&e.to==='sua'));
});
test('Spirit Descent counts exactly ten Lava basic hits, persists through reload, and caps newly added shields',()=>{
  const s=lavaBattle();s.battle.heroes.forEach((h,i)=>h.hp=[5000,2000,8000][i]);run(s,11);
  assert.equal(s.units.lava.basicHits,9);assert.ok(!s.events.some(e=>e.kind==='guard'&&e.from==='lava'&&e.passive));
  const loaded=G.clone(s);G.advance(loaded,loaded.at+1000);assert.equal(loaded.units.lava.basicHits,0);
  const proc=loaded.events.findLast(e=>e.kind==='guard'&&e.from==='lava'&&e.passive);assert.ok(proc);assert.equal(proc.to,'lava');
  const capped=lavaBattle();capped.units.lava.basicHits=9;capped.battle.heroes.forEach((h,i)=>{h.hp=[5000,2000,8000][i];h.shield=h.max*.59;});run(capped,1);
  assert.equal(capped.battle.heroes[1].shield,capped.battle.heroes[1].max*.6);
  const preexisting=lavaBattle();preexisting.battle.heroes.forEach(h=>h.shield=h.max*.7);run(preexisting,5);assert.ok(preexisting.battle.heroes.every(h=>h.shield>h.max*.6),'A shield from another effect must not be reduced by the cap');
  const transition=lavaBattle();transition.units.lava.basicHits=9;transition.battle.enemies.forEach(e=>e.hp=0);G.advance(transition,transition.at+500);G.advance(transition,transition.at+2000);assert.equal(transition.units.lava.basicHits,9);
  run(transition,1);assert.equal(transition.units.lava.basicHits,0);assert.ok(transition.events.some(e=>e.kind==='guard'&&e.from==='lava'&&e.passive));
});
test('Emergency Survival intercepts lethal damage once per wave, protects for exactly two combat seconds and never revives a corpse',()=>{
  const s=lavaBattle();s.battle.heroes.forEach(h=>{h.hp=h.id==='lava'?1:0;h.energy=-20;});s.battle.enemies=s.battle.enemies.slice(0,1);s.battle.enemies[0].atk=100000;
  run(s,1);const lava=s.battle.heroes.find(h=>h.id==='lava');assert.equal(lava.hp,1);assert.equal(s.battle.lavaRescueUsed,true);assert.equal(lava.indomitableUntil,s.battle.elapsed+2000);assert.equal(s.events.filter(e=>e.kind==='rescue').length,1);
  const loaded=G.clone(s);G.advance(loaded,loaded.at+1000);assert.equal(loaded.battle.heroes[1].hp,1);G.advance(loaded,loaded.at+500);assert.equal(loaded.battle.heroes[1].hp,1);G.advance(loaded,loaded.at+500);assert.equal(loaded.battle.heroes[1].hp,0);assert.equal(loaded.events.filter(e=>e.kind==='rescue').length,1);
  const absent=lavaBattle();absent.battle.heroes.forEach(h=>{h.hp=h.id==='taeo'?1:0;h.energy=-20;});absent.battle.enemies=absent.battle.enemies.slice(0,1);absent.battle.enemies[0].atk=100000;run(absent,1);assert.equal(absent.battle.heroes[0].hp,0);assert.ok(!absent.events.some(e=>e.kind==='rescue'));
  const wave=lavaBattle();wave.battle.lavaRescueUsed=true;wave.battle.enemies.forEach(e=>e.hp=0);G.advance(wave,wave.at+500);G.advance(wave,wave.at+2000);assert.equal(wave.battle.lavaRescueUsed,false);
});
test('1.5× speed advances combat only, persists fractional credit and remains deterministic across batched reconnects',()=>{
  const a=osiaBattle(),b=G.clone(a);G.action(a,{kind:'speed',speed:1.5},a.at);G.action(b,{kind:'speed',speed:1.5},b.at);
  G.advance(a,a.at+15000);for(let i=0;i<30;i++)G.advance(b,b.at+500);assert.deepEqual(a,b);assert.equal(a.speed,1.5);assert.ok(a.battle.elapsed>20000);
  const first=osiaBattle();G.action(first,{kind:'speed',speed:1.5},first.at);G.advance(first,first.at+500);assert.equal(first.battle.elapsed,500);assert.equal(first.simCredit,250);
  const loaded=G.clone(first);G.advance(first,first.at+500);G.advance(loaded,loaded.at+500);assert.deepEqual(first,loaded);assert.equal(first.battle.elapsed,1500);assert.equal(first.simCredit,0);
  const changing=osiaBattle();G.action(changing,{kind:'speed',speed:1.5},changing.at+250);assert.equal(changing.speed,1.5);assert.equal(changing.battle.elapsed,0);assert.equal(changing.simCredit,250);G.advance(changing,changing.at+1000);assert.equal(changing.battle.elapsed,1500);assert.equal(changing.simCredit,250);
  for(const speed of [0,2,1.25,'1.5',null,NaN]){const s=G.create(1000),old=G.clone(s);assert.throws(()=>G.action(s,{kind:'speed',speed},s.at));assert.deepEqual(s,old);}
  const slow=G.create(1000),fast=G.create(1000);G.action(fast,{kind:'speed',speed:1.5},fast.at);G.advance(slow,slow.at+12*3600000);G.advance(fast,fast.at+12*3600000);assert.deepEqual(fast.offline,slow.offline);assert.equal(fast.offline.seconds,28800);
});
test('Expansion retains beginner difficulty and saved progress while supporting all sixty zones and level 100',()=>{
  assert.equal(G.MAX_STAGE,60);assert.equal(G.MAX_LEVEL,100);assert.equal(G.CHAPTERS.length,12);assert.equal(G.ENEMIES.length,12);assert.equal(G.BOSSES.length,12);
  for(const stage of [1,5,10,15,30,31,40,50,60]){
    const s=G.create(1000);s.best=59;G.action(s,{kind:'stage',stage,mode:'farm'});
    assert.equal(G.chapter(stage),Math.floor((stage-1)/5));assert.equal(s.battle.enemies[0].kind,G.chapter(stage));assert.ok(s.battle.enemies.every(e=>Number.isFinite(e.hp)&&e.hp>0&&Number.isFinite(e.atk)));
    if(stage<=10){assert.equal(s.battle.enemies[0].max,Math.round(30*Math.pow(1.18,stage-1)));assert.equal(s.battle.enemies[0].atk,Math.round(3*Math.pow(1.14,stage-1)));}
  }
  const s=G.create(1000);s.gold=100000;s.units.harin.level=60;G.action(s,{kind:'train',hero:'harin'});assert.equal(s.units.harin.level,61);s.units.harin.level=100;assert.throws(()=>G.action(s,{kind:'train',hero:'harin'}));
  assert.ok(G.validate(s));const old=G.create(1000);delete old.speed;delete old.simCredit;delete old.simTime;delete old.banners;old.best=30;old.stage=30;old.mode='farm';old.pity=79;assert.ok(G.validate(old));G.advance(old,old.at);assert.equal(old.best,30);assert.equal(old.stage,30);assert.equal(old.speed,1);assert.equal(G.bannerState(old,'osia').pity,79);G.action(old,{kind:'stage',stage:31,mode:'progress'});assert.equal(old.stage,31);
});
test('Maximum-level six-member permanent teams can challenge the final boss without requiring the limited healer',()=>{
  for(const team of [['geonu','ian','osia','lumi','nari','sua'],['geonu','taeo','osia','lumi','nari','sua'],['geonu','ian','osia','lumi','nari','lava']]){
    let wins=0;
    for(let seed=1;seed<=20;seed++){
      const s=G.create(UPDATE_TIME,seed);for(const id of team)s.units[id]={level:100,xp:0,stars:5,shards:0};s.best=60;G.action(s,{kind:'team',team});G.action(s,{kind:'stage',stage:60,mode:'farm'});
      s.wave=4;s.battle.phase='victory';s.battle.wait=0;G.advance(s,s.at+500);assert.equal(s.battle.boss,true);const start=s.at;
      while(s.battle.phase==='fight'&&s.at-start<180000)G.advance(s,s.at+500);
      assert.ok(G.validate(s));if(s.battle.phase==='victory')wins++;
    }
    assert.ok(wins>=1,`${team.join('/')} could not win any of 20 final bosses`);
  }
});
test('Korean midnight daily reset and one-time quests cannot pay twice',()=>{
  const s=G.create(1000), time=Date.UTC(2026,10,17,14,59,59);G.action(s,{kind:'daily'},time);assert.throws(()=>G.action(s,{kind:'daily'},time));G.action(s,{kind:'daily'},time+1000);
  s.best=1;G.action(s,{kind:'quest',quest:'first'});assert.throws(()=>G.action(s,{kind:'quest',quest:'first'}));assert.throws(()=>G.action(s,{kind:'quest',quest:'graduation'}));
});
test('Three failed bosses fall back even when normal waves between bosses were won',()=>{
  const s=G.create(1000);s.best=1;s.stage=2;s.wave=4;
  for(let i=0;i<3;i++){
    if(i){s.battle.phase='fight';s.battle.boss=false;s.battle.enemies.forEach(e=>e.hp=0);run(s,1);run(s,3);}
    s.battle.phase='fight';s.battle.boss=true;s.battle.heroes.forEach(h=>h.hp=0);run(s,1);
  }
  assert.equal(s.mode,'farm');assert.equal(s.stage,1);
});
test('Long simulations remain finite and preserve combat, economy and progression bounds',()=>{
  for(let seed=1;seed<=25;seed++){
    const s=G.create(1000,seed);run(s,3600);
    assert.ok(G.validate(s));assert.ok(s.best>5&&s.best<30);assert.ok(s.gold>=0&&s.gems>=0);assert.ok(s.events.length<=50);assert.ok(s.logs.length<=14);
    assert.ok(s.battle.heroes.concat(s.battle.enemies).every(h=>Number.isFinite(h.hp)&&h.hp>=0&&h.hp<=h.max));
  }
});
test('The new growth curve preserves existing levels, raw XP, currencies, guarantees and old offline rewards',()=>{
  const s=G.create(UPDATE_TIME);delete s.commanderName;s.captain={level:50,xp:1234};s.gold=123456;s.gems=5432;s.banners.osia={pity:79,guaranteed:true};s.pity=79;s.activities.towerBest=234;s.activities.daily.used=2;
  for(const u of Object.values(s.units))Object.assign(u,{level:60,xp:999,stars:3,shards:17});s.offline={seconds:600,gold:400,xp:480};const old=G.clone(s);assert.ok(G.validate(s));G.advance(s,s.at);
  assert.equal(s.commanderName,'새내기 단장');assert.deepEqual(s.captain,old.captain);assert.deepEqual(s.units,old.units);assert.equal(s.gold,old.gold);assert.equal(s.gems,old.gems);assert.deepEqual(s.banners,old.banners);assert.deepEqual(s.activities,old.activities);assert.deepEqual(s.battle,old.battle);assert.deepEqual(s.offline,{...old.offline,captainXp:120});assert.equal(G.CAPTAIN_MAX_LEVEL,200);
  s.captain.xp=G.captainNeed(50)-1;for(const e of s.battle.enemies)e.hp=0;G.advance(s,s.at+500);assert.equal(s.captain.level,51);assert.equal(s.gems,old.gems+160);
  s.captain={level:G.CAPTAIN_MAX_LEVEL,xp:0};G.action(s,{kind:'stage',stage:1,mode:'farm'},s.at);for(const e of s.battle.enemies)e.hp=0;const gems=s.gems;G.advance(s,s.at+500);assert.deepEqual(s.captain,{level:200,xp:0});assert.equal(s.gems,gems);assert.ok(G.validate(s));
});
test('Legacy offline captain XP is preserved separately from slower future deposits and claimed only once',()=>{
  const s=G.create(UPDATE_TIME);for(const u of Object.values(s.units))u.level=50;s.offline={seconds:600,gold:400,xp:100};G.advance(s,s.at);assert.equal(s.offline.captainXp,25);const xp=G.rates(s).xp*60;G.advance(s,s.at+3600000);assert.equal(s.offline.xp,100+xp);assert.equal(s.offline.captainXp,25+xp/8);
  const before=G.clone(s);G.action(s,{kind:'offline'},s.at);for(const u of Object.values(s.units))assert.equal(u.xp,100+xp);assert.equal(s.captain.xp,Math.floor(25+xp/8));assert.equal(s.gold,before.gold+before.offline.gold);assert.deepEqual(s.offline,{seconds:0,gold:0,xp:0,captainXp:0});const paid=G.clone(s);assert.throws(()=>G.action(s,{kind:'offline'},s.at));assert.deepEqual(s,paid);
  const fragmented=G.create(UPDATE_TIME);for(let i=0;i<8;i++)G.advance(fragmented,fragmented.at+91000);assert.equal(fragmented.offline.captainXp,fragmented.offline.xp/8);assert.ok(fragmented.offline.captainXp>=1);for(const value of [-1,NaN,Infinity]){const invalid=G.clone(fragmented);invalid.offline.captainXp=value;assert.equal(G.validate(invalid),false);}
});
test('Twenty-four hours of automatic combat cannot reach commander level 50 or unit level 100 without training',()=>{
  for(const [team,speed]of [[null,1],[['geonu','ian','osia','lumi','nari','sua'],1.5],[['geonu','ian','osia','lumi','nari','lava'],1.5]]){
    const s=G.create(UPDATE_TIME,287);if(team){for(const id of team)s.units[id]={level:1,xp:0,stars:0,shards:0};G.action(s,{kind:'team',team},s.at);}G.action(s,{kind:'speed',speed},s.at);
    for(let minute=0;minute<1440;minute++)G.advance(s,s.at+60000);
    assert.ok(s.captain.level>=10&&s.captain.level<50,`commander reached ${s.captain.level}`);assert.ok(s.team.every(id=>s.units[id].level>1&&s.units[id].level<100));assert.equal(s.offline.seconds,0);assert.ok(G.validate(s));
  }
});
test('Commander names normalize Unicode and spaces; first name is free, later names cost exactly 3000 gems',()=>{
  const s=G.create(UPDATE_TIME);s.gems=10000;const before=G.clone(s);for(const[raw,want]of [['  새  단장  ','새 단장'],['오시아','오시아'],['반장_24-별','반장_24-별'],['𠮷'.repeat(12),'𠮷'.repeat(12)]]){assert.equal(G.normalizeCommanderName(raw),want);G.action(s,{kind:'rename',name:raw},s.at);assert.equal(s.commanderName,want);assert.ok(G.validate(s));}
  assert.equal(s.gold,before.gold);assert.equal(s.gems,before.gems-9000);assert.equal(s.nameChanges,4);assert.deepEqual(s.units,before.units);assert.deepEqual(s.captain,before.captain);assert.deepEqual(s.battle,before.battle);
  for(const name of [null,12,{},'',' ','가','가'.repeat(13),'<script>','이름\n변경','이름\u0000','이름\u202E','이름😀']){const old=G.clone(s);assert.equal(G.normalizeCommanderName(name),null);assert.throws(()=>G.action(s,{kind:'rename',name},s.at));assert.deepEqual(s,old);}
});
test('Enemy variants cover all school regions while existing saved battles keep their appearance',()=>{
  assert.equal(G.ENEMY_VARIANTS.length,12);assert.ok(G.ENEMY_VARIANTS.every(a=>a.length===3&&new Set(a).size===3&&a.every(name=>typeof name==='string'&&name.length>0)));
  for(const stage of [1,2,6,31,60]){const s=G.create(UPDATE_TIME);s.best=60;G.action(s,{kind:'stage',stage,mode:'farm'},s.at);assert.deepEqual(s.battle.enemies.map(e=>e.name),s.battle.enemies.map((_,i)=>G.ENEMY_VARIANTS[G.chapter(stage)][(stage-1+i)%3]));}
  const legacy=G.create(UPDATE_TIME);for(const e of legacy.battle.enemies){delete e.variant;e.name='기존 적 이름';}const battle=G.clone(legacy.battle);G.advance(legacy,legacy.at);assert.deepEqual(legacy.battle,battle);
});
console.log(`${passed} school engine checks passed`);
require('./school-dungeons.cjs');
