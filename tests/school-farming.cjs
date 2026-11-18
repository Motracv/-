const assert=require('node:assert/strict'),path=require('node:path');
const {Worker}=require('node:worker_threads');
const G=require('../school/engine.js');
const NOW=Date.parse('2026-11-18T12:00:00+09:00');let passed=0;
const make=()=>G.create(NOW,287);
const strong=()=>{const s=make();s.best=60;const team=['geonu','taeo','lava','nari','osia','horas'];for(const id of team)s.units[id]={level:100,xp:99,stars:5,shards:0};G.action(s,{kind:'team',team},s.at);return s;};
const report=s=>G.farmingRecommendations(s,G.farmingCandidates(s).map(stage=>G.simulateFarmingStage(s,stage)));
const test=async(name,run)=>{await run();passed++;console.log('PASS',name);};
function makeWorker(){const workerPath=path.resolve(__dirname,'../school/farming-worker.js'),enginePath=path.resolve(__dirname,'../school/engine.js');return new Worker(`const {parentPort}=require('node:worker_threads');global.self=globalThis;global.importScripts=()=>{self.SchoolRPG=require(${JSON.stringify(enginePath)});};self.postMessage=data=>parentPort.postMessage(data);require(${JSON.stringify(workerPath)});parentPort.on('message',data=>self.onmessage({data}));`,{eval:true});}
function response(worker,id){return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{cleanup();reject(Error('worker timeout'));},10000);const onMessage=msg=>{if(msg.id===id&&['result','error'].includes(msg.kind)){cleanup();resolve(msg);}};const onError=e=>{cleanup();reject(e);};function cleanup(){clearTimeout(timeout);worker.off('message',onMessage);worker.off('error',onError);}worker.on('message',onMessage);worker.on('error',onError);});}
(async()=>{
 await test('Candidates cover every cleared stage including discounted farms, with fresh-account fallback',()=>{
  const s=make();assert.deepEqual(G.farmingCandidates(s),[1]);s.best=3;assert.deepEqual(G.farmingCandidates(s),[1,2,3]);s.best=60;assert.deepEqual(G.farmingCandidates(s),Array.from({length:60},(_,i)=>i+1));const before=G.clone(s);assert.throws(()=>G.simulateFarmingStage(s,0));assert.throws(()=>G.simulateFarmingStage(s,61));assert.deepEqual(s,before);
 });
 await test('Simulations never mutate real money, RNG, clocks, levels, quests, saved presets or pending casts',()=>{
  const s=strong();s.units.osia.nextSkill=4;s.battle.horas.stacks=5;G.advance(s,s.at+1000);G.action(s,{kind:'preset-save',slot:0},s.at);const before=G.clone(s),r=report(s);assert.deepEqual(s,before);assert.equal(r.basis,'combat-gold-only');assert.equal(r.seconds,180);assert.equal(r.seeds,3);assert.equal(r.candidates.length,60);assert(r.recommendations.length>0&&r.recommendations.length<=3);assert(r.recommendations.every(row=>row.stable&&row.successfulSeeds===3&&row.clears>0&&row.meanClearSeconds>0));assert.deepEqual(r.recommendations.map(x=>x.goldPerMinute),r.recommendations.map(x=>x.goldPerMinute).sort((a,b)=>b-a));assert.deepEqual(report(s),r);
 });
 await test('Analysis is independent of real resource balances, current combat progress, source seed and earned quest payouts',()=>{
  const a=make(),b=G.clone(a);b.gold=999999;b.gems=999999;b.seed=1;b.captain={level:199,xp:0};b.quests.repeat={kills:99999,waves:99999,bosses:99999};b.winter.snowflakes=b.winter.earned=99999;b.units.harin.xp=G.needXp(1)-1;b.at+=123456789;assert.equal(G.farmingFingerprint(a),G.farmingFingerprint(b));assert.deepEqual(report(a),report(b));
 });
 await test('Only team investment, order, speed, progression or catalog changes invalidate the fingerprint',()=>{
  const s=make(),fingerprint=G.farmingFingerprint(s);for(const mutate of [v=>v.units.harin.level++,v=>v.units.harin.stars++,v=>v.team.reverse(),v=>v.speed=1.5,v=>v.best++]){const c=G.clone(s);mutate(c);assert.notEqual(G.farmingFingerprint(c),fingerprint);}const c=G.clone(s);c.presets[0].name='테스트';c.gold++;c.seed++;assert.equal(G.farmingFingerprint(c),fingerprint);
 });
 await test('Full boss cycles and recovery waits are measured; faster game speed improves direct combat income',()=>{
  const s=make(),normal=G.simulateFarmingStage(s,1);assert(normal.clears>0);assert(normal.meanClearSeconds>5);assert(normal.goldPerMinute>0);assert(normal.goldPerMinute<1040);s.speed=1.5;const fast=G.simulateFarmingStage(s,1);assert(fast.goldPerMinute>normal.goldPerMinute*1.2);assert(fast.meanClearSeconds<normal.meanClearSeconds);assert.equal(fast.totalSeeds,3);
 });
 await test('Underpowered late-game team receives the best reachable discounted coin farm',()=>{
  const s=make();s.best=60;const before=G.clone(s),r=report(s);assert.equal(r.reason,'ok');assert(r.recommendations.length>0);assert(r.recommendations.every(c=>c.stable&&c.losses===0));assert(r.candidates.filter(c=>c.stage>=55).every(c=>!c.stable));assert.deepEqual(s,before);
 });
 await test('Equipment is included in current-team simulation and its cache key without exposing unused inventory',()=>{
  const bare=strong(),geared=G.clone(bare);for(const id of ['dawn_staff','guardian_robe','dawn_brooch'])geared.equipment.inventory[id]={count:geared.team.length,stars:5};for(const hero of geared.team)for(const item of ['dawn_staff','guardian_robe','dawn_brooch'])G.action(geared,{kind:'gear-equip',hero,item},geared.at);const before=G.clone(geared);assert.notEqual(G.farmingFingerprint(geared),G.farmingFingerprint(bare));const baseline=G.simulateFarmingStage(bare,55),withGear=G.simulateFarmingStage(geared,55);assert(withGear.goldPerMinute>=baseline.goldPerMinute);assert.deepEqual(geared,before);const key=G.farmingFingerprint(geared);geared.equipment.inventory.chalk_star={count:999,stars:5};assert.equal(G.farmingFingerprint(geared),key);
 });
 await test('Dedicated worker returns progress, bounded cached results and rejects invalid source data',async()=>{
  const w=makeWorker(),s=make(),before=G.clone(s),messages=[];w.on('message',m=>messages.push(m));try{let waiting=response(w,'one');w.postMessage({kind:'recommend',id:'one',state:s});const first=await waiting;assert.equal(first.kind,'result');assert.equal(first.cached,false);assert.deepEqual(first.data,report(s));assert(messages.some(m=>m.kind==='progress'&&m.completed===0));assert(messages.some(m=>m.kind==='progress'&&m.completed===1));assert.deepEqual(s,before);
   waiting=response(w,'cached');w.postMessage({kind:'recommend',id:'cached',state:s});const cached=await waiting;assert.equal(cached.cached,true);assert.deepEqual(cached.data,first.data);
   waiting=response(w,'bad');w.postMessage({kind:'recommend',id:'bad',state:{}});assert.equal((await waiting).kind,'error');
  }finally{await w.terminate();}
 });
 await test('Worker cancellation and replacement requests cannot publish a stale result',async()=>{
  const w=makeWorker(),messages=[];w.on('message',m=>messages.push(m));try{const waiting=response(w,'new');w.postMessage({kind:'recommend',id:'old',state:strong()});w.postMessage({kind:'cancel'});w.postMessage({kind:'recommend',id:'new',state:make()});const done=await waiting;assert.equal(done.kind,'result');assert(!messages.some(m=>m.id==='old'&&m.kind==='result'));assert.equal(done.fingerprint,G.farmingFingerprint(make()));}finally{await w.terminate();}
 });
 console.log(`${passed} farming simulation and dedicated-worker checks passed`);
})().catch(e=>{console.error(e);process.exitCode=1;});
