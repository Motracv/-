const assert=require('node:assert/strict');
const {fixture}=require('./account-fixture.cjs');
const G=require('../school/engine.js');
(async()=>{
 const t=await fixture();let passed=0;
 const test=async(name,fn)=>{await fn();passed++;console.log('PASS',name);};
 const a=(await t.login('school-A')).data,b=(await t.login('school-B')).data;
 const call=(who,route,data={})=>t.call('/api/school/'+route,{catalogVersion:G.CATALOG_VERSION,...data},null,who?{'X-Account-Session':who.token}:{});
 const save=who=>t.sqlite.prepare('SELECT * FROM school_saves WHERE account_id=?').get(who.profile.id);
 const action=(revision,id,input)=>({revision,requestId:id,action:input});
 await test('Unauthenticated, room-token and forged sessions cannot read school saves',async()=>{
   assert.equal((await call(null,'state')).status,401);assert.equal((await call({token:'f'.repeat(64)},'state')).status,401);
   const room=await t.call('/api/create',{name:'guest'});assert.equal((await call({token:room.data.token},'state')).status,401);
 });
 await test('Verified accounts receive separate server saves; no receipts or other account data leak',async()=>{
   const ra=await call(a,'state'),rb=await call(b,'state');assert.equal(ra.status,200);assert.equal(rb.status,200);assert.equal(ra.data.state.gems,1800);assert.ok(!('receipts'in ra.data.state));assert.equal(t.sqlite.prepare('SELECT count(*) AS n FROM school_saves').get().n,2);
 });
 await test('Client-supplied currency, time, account and draw results are ignored',async()=>{
   const ra=await call(a,'state',{gold:1e12,state:{gems:1e12},now:Date.now()+1e12,accountId:b.profile.id});assert.equal(ra.status,200);assert.equal(ra.data.state.gems,1800);assert.equal(ra.data.state.offline.seconds,0);
   const r=await call(a,'action',{...action(ra.data.revision,'server-owned-action-01',{kind:'recruit',count:1,gems:1e12,results:[{id:'lumi'}]}),accountId:b.profile.id});assert.equal(r.status,200);assert.equal(r.data.state.gems,1640);assert.equal(r.data.state.pulls,1);assert.equal(JSON.parse(save(b).payload).pulls,0);
 });
 await test('Old browser catalogs are rejected before spending or exposing unfamiliar heroes',async()=>{
   const row=save(a);const old=await t.call('/api/school/action',action(row.revision,'outdated-browser-0001',{kind:'recruit',count:10}),null,{'X-Account-Session':a.token});assert.equal(old.status,426);assert.equal(save(a).payload,row.payload);assert.ok(!old.data.state);
   for(let catalogVersion=1;catalogVersion<G.CATALOG_VERSION;catalogVersion++)assert.equal((await call(a,'state',{catalogVersion})).status,426);assert.equal(save(a).payload,row.payload);
   const staleCost=await call(a,'action',{...action(row.revision,'outdated-training-cost1',{kind:'train',hero:'harin',cost:0}),catalogVersion:G.CATALOG_VERSION-1});assert.equal(staleCost.status,426);assert.equal(save(a).payload,row.payload);
 });
 await test('Simultaneous same-ID requests and lost-response retries charge once',async()=>{
   const current=await call(a,'state');const input=action(current.data.revision,'same-action-0000000002',{kind:'recruit',count:10});
   const results=await Promise.all([call(a,'action',input),call(a,'action',input)]);results.forEach(r=>assert.equal(r.status,200));assert.equal(results[0].data.state.gems,40);assert.deepEqual(results[0].data.result,results[1].data.result);
   const again=await call(a,'action',input);assert.equal(again.data.repeated,true);assert.equal(again.data.state.pulls,11);assert.equal(again.data.state.gems,40);
 });
 await test('Distinct simultaneous spending actions conflict instead of overwriting',async()=>{
   const current=await call(a,'state');const rs=await Promise.all(['A','B'].map(id=>call(a,'action',action(current.data.revision,'parallel-action-000'+id,{kind:'train',hero:'harin'}))));
   assert.deepEqual(rs.map(r=>r.status).sort(),[200,409]);assert.equal(JSON.parse(save(a).payload).units.harin.level,2);assert.equal(JSON.parse(save(a).payload).gold,current.data.state.gold-68);
 });
 await test('Unaffordable or invalid requests do not commit costs or an invented outcome',async()=>{
   const row=save(a),state=JSON.parse(row.payload);
   const r=await call(a,'action',action(row.revision,'unaffordable-000001',{kind:'recruit',count:10}));assert.equal(r.status,400);assert.deepEqual(JSON.parse(save(a).payload),state);
   assert.equal((await call(a,'action',action(row.revision,'invalid-action-0001',{kind:'stage',stage:30,mode:'progress'}))).status,400);
 });
 await test('Eight-hour bank is computed on server, claim is atomic, no second-device double reward',async()=>{
   const row=save(b),state=JSON.parse(row.payload);state.at=Date.now()-48*3600000;t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(state),b.profile.id);
   const current=await call(b,'state');assert.equal(current.data.state.offline.seconds,28800);const before=current.data.state.gold;
   const rs=await Promise.all(['1','2'].map(id=>call(b,'action',action(current.data.revision,'offline-claim-00000'+id,{kind:'offline'}))));assert.deepEqual(rs.map(r=>r.status).sort(),[200,409]);
   const saved=JSON.parse(save(b).payload);assert.equal(saved.gold,before+9600+700);assert.equal(saved.captain.level,2);assert.equal(saved.offline.seconds,0);
   assert.equal((await call(b,'action',action(save(b).revision,'offline-claim-again1',{kind:'offline'}))).status,400);
 });
 await test('Daily reset and quest eligibility are enforced by server, not browser flags',async()=>{
   let current=await call(a,'state');const r=await call(a,'action',action(current.data.revision,'daily-claim-0000001',{kind:'daily',now:1e15}));assert.equal(r.status,200);
   const r2=await call(a,'action',action(r.data.revision,'daily-claim-0000002',{kind:'daily',now:1e15}));assert.equal(r2.status,400);
   assert.equal((await call(a,'action',action(r.data.revision,'quest-cheat-0000001',{kind:'quest',quest:'graduation'}))).status,400);
 });
 await test('Account deletion cascades school progress and leaves the other account untouched',async()=>{
   const r=await t.call('/api/account/delete',{confirm:'DELETE'},a.token);assert.equal(r.status,200);assert.equal(save(a),undefined);assert.ok(save(b));assert.equal((await call(a,'state')).status,401);
 });
 await test('A storage response lost after commit returns retriable 503 and the same action recovers without another charge',async()=>{
   const current=await call(b,'state'),before=current.data.state.gems;const intent=action(current.data.revision,'storage-response-lost1',{kind:'recruit',count:1});
   const prepare=t.db.prepare;let drop=true;
   t.db.prepare=sql=>{const statement=prepare(sql);if(!sql.startsWith('UPDATE school_saves'))return statement;return {bind(...args){const bound=statement.bind(...args);return {...bound,async run(){const r=await bound.run();if(drop){drop=false;throw Error('D1_RESPONSE_LOST');}return r;}};}};};
   const lost=await call(b,'action',intent);assert.equal(lost.status,503);t.db.prepare=prepare;
   const recovered=await call(b,'action',intent);assert.equal(recovered.status,200);assert.equal(recovered.data.repeated,true);assert.equal(recovered.data.state.gems,before-160);
 });
 await test('Real persisted payload remains valid after requests and excludes personal Google claims',async()=>{
   const payload=save(b).payload;assert.ok(G.validate(JSON.parse(payload)));assert.ok(!payload.includes('never-store@example.test'));assert.ok(!payload.includes(b.token));
 });
 await test('Osia acquired through the server pool persists, can join the party and level up after reconnect',async()=>{
   const who=(await t.login('school-Osia')).data;const current=await call(who,'state');
   const random=crypto.getRandomValues;let n=0;
   crypto.getRandomValues=function(array){if(array instanceof Uint32Array&&array.length===1){array[0]=4294967;return array;}return random.call(crypto,array);};
   let r;try{r=await call(who,'action',action(current.data.revision,'server-osia-draw-001',{kind:'recruit',count:1}));}finally{crypto.getRandomValues=random;}
   assert.equal(r.status,200);assert.equal(r.data.result.results[0].id,'osia');assert.equal(r.data.state.gems,1640);
   r=await call(who,'action',action(r.data.revision,'server-osia-team-001',{kind:'team',team:['taeo','osia','sua']}));assert.equal(r.status,200);
   const again=(await t.login('school-Osia')).data;r=await call(again,'state');assert.equal(r.data.state.team[1],'osia');assert.equal(r.data.state.units.osia.level,1);
   r=await call(again,'action',action(r.data.revision,'server-osia-train-01',{kind:'train',hero:'osia'}));assert.equal(r.status,200);assert.equal(r.data.state.units.osia.level,2);
 });
 await test('Server owns the soft-pity count and applies 60th-draw odds, 80th guarantee and resets',async()=>{
   const who=(await t.login('school-soft-pity')).data;await call(who,'state');
   const setMisses=misses=>{const s=JSON.parse(save(who).payload);s.pity=misses;s.banners.osia.pity=misses;t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(s),who.profile.id);};
   setMisses(39);assert.equal((await call(who,'state')).data.state.pity,39);
   const random=crypto.getRandomValues;
   try{
     setMisses(59);let n=0;crypto.getRandomValues=function(a){if(a instanceof Uint32Array&&a.length===1){a[0]=++n%2?64424509:4294967;return a;}return random.call(crypto,a);};
     let current=await call(who,'state');assert.equal(current.data.state.pity,59);
     let r=await call(who,'action',{...action(current.data.revision,'soft-pity-server-001',{kind:'recruit',count:1}),pity:0,ssrChance:1});
     assert.equal(r.status,200);assert.equal(r.data.result.results[0].ssrChance,.02);assert.equal(r.data.result.results[0].id,'osia');assert.equal(r.data.state.pity,0);
     setMisses(79);crypto.getRandomValues=function(a){if(a instanceof Uint32Array&&a.length===1){a[0]=4294967294;return a;}return random.call(crypto,a);};
     current=await call(who,'state');r=await call(who,'action',action(current.data.revision,'hard-pity-server-001',{kind:'recruit',count:1}));assert.equal(r.status,200);assert.equal(r.data.result.results[0].ssrChance,1);assert.equal(r.data.result.results[0].pity,true);assert.equal(r.data.state.pity,0);
   }finally{crypto.getRandomValues=random;}
 });
 await test('Server owns the next skill and persists the dragon windup, impact and stun across sessions',async()=>{
   const who=(await t.login('school-cycle')).data;await call(who,'state');
   const realNow=Date.now;let now=realNow();
   const state=G.create(now-20000,26);state.units.osia={level:1,xp:0,stars:0,shards:0};G.action(state,{kind:'team',team:['taeo','osia','sua']});for(const e of state.battle.enemies){e.hp=e.max=10000;e.atk=1;}G.advance(state,now);
   assert.equal(state.battle.osiaCast.stage,4);assert.equal(state.units.osia.nextSkill,1);t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(state),who.profile.id);
   try{
     Date.now=()=>now;let r=await call(who,'state',{nextSkill:4,stunUntil:0,state:{battle:{osiaCast:null}}});assert.equal(r.status,200);assert.deepEqual(r.data.state.battle.osiaCast,state.battle.osiaCast);assert.equal(r.data.state.units.osia.nextSkill,1);
     const again=(await t.login('school-cycle')).data;
     for(let paused=500;paused<=G.OSIA_CINEMATIC_MS;paused+=500){now+=500;r=await call(again,'state');assert.equal(r.data.state.battle.osiaCast.stage,4);assert.ok(r.data.state.battle.enemies.every(e=>!e.stunUntil));assert.equal(r.data.state.battle.elapsed,20000);if(paused<G.OSIA_CINEMATIC_MS)assert.equal(r.data.state.battle.cinematic.remaining,G.OSIA_CINEMATIC_MS-paused);}
     now+=500;r=await call(again,'state');assert.equal(r.data.state.battle.elapsed,20500);assert.ok(r.data.state.battle.osiaCast);
     now+=500;r=await call(again,'state');assert.equal(r.status,200);assert.equal(r.data.state.battle.osiaCast,undefined);assert.ok(r.data.state.battle.enemies.every(e=>e.stunUntil===22500));
     now+=1000;r=await call(who,'state');assert.equal(r.data.state.battle.elapsed,22000);assert.ok(!r.data.state.events.some(e=>e.kind==='hit'&&e.side==='hero'&&e.at>now-1000));
     now+=1000;r=await call(again,'state');assert.equal(r.data.state.battle.elapsed,23000);assert.equal(r.data.state.events.filter(e=>e.kind==='hit'&&e.side==='hero'&&e.at===now).length,3);
     now+=2000;r=await call(again,'state');assert.equal(r.data.state.battle.osiaCast.stage,1);assert.equal(r.data.state.units.osia.nextSkill,2);assert.ok(G.validate(JSON.parse(save(who).payload)));
   }finally{Date.now=realNow;}
 });
 await test('Server migrates old pity without resetting progress and stores independent pickup guarantees across sessions',async()=>{
   const realNow=Date.now;Date.now=()=>Date.parse('2026-11-18T12:00:00+09:00');const random=crypto.getRandomValues;
   try{
     const who=(await t.login('school-banners')).data;await call(who,'state');const old=JSON.parse(save(who).payload);delete old.banners;old.pity=73;old.gems=10000;old.gold=5860;old.units.harin.level=40;t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(old),who.profile.id);
     let current=await call(who,'state');assert.equal(current.status,200);assert.deepEqual(current.data.state.banners.osia,{pity:73,guaranteed:false});assert.deepEqual(current.data.state.banners.lava,{pity:0,guaranteed:false});assert.equal(current.data.state.gold,5860);assert.equal(current.data.state.units.harin.level,40);
     const draw=async(banner,id,rolls)=>{let index=0;crypto.getRandomValues=function(array){if(array instanceof Uint32Array&&array.length===1){array[0]=Math.floor(rolls[index++]*4294967296);return array;}return random.call(crypto,array);};const r=await call(who,'action',{...action(current.data.revision,id,{kind:'recruit',banner,count:1,guaranteed:true,featured:'lava',pity:79}),guaranteed:true});crypto.getRandomValues=random;assert.equal(r.status,200);current=r;return r;};
     let r=await draw('osia','server-banner-miss-01',[.001,.99]);assert.ok(['ian','lumi'].includes(r.data.result.results[0].id));assert.equal(r.data.state.banners.osia.guaranteed,true);assert.equal(r.data.state.banners.lava.guaranteed,false);
     r=await draw('lava','server-banner-lava-01',[.001,.001]);assert.equal(r.data.result.results[0].id,'lava');assert.equal(r.data.state.banners.osia.guaranteed,true);assert.equal(r.data.state.banners.lava.guaranteed,false);
     const again=(await t.login('school-banners')).data;current=await call(again,'state');assert.equal(current.data.state.banners.osia.guaranteed,true);assert.equal(current.data.state.units.lava.level,1);
     r=await draw('osia','server-banner-guarantee',[.001,.99]);assert.equal(r.data.result.results[0].id,'osia');assert.equal(r.data.state.banners.osia.guaranteed,false);assert.equal(r.data.state.gems,9520);assert.equal(r.data.state.pity,0);assert.equal(r.data.state.banners.lava.pity,0);
     const row=save(who);assert.equal((await call(who,'action',action(row.revision,'server-banner-invalid',{kind:'recruit',banner:'constructor',count:1}))).status,400);assert.equal(save(who).payload,row.payload);
   }finally{Date.now=realNow;crypto.getRandomValues=random;}
 });
 await test('Lava uses the server cutoff and remains playable after the limited banner closes',async()=>{
   const realNow=Date.now,random=crypto.getRandomValues;let now=Date.parse('2026-11-21T00:00:00+09:00')-1;Date.now=()=>now;
   try{
     const who=(await t.login('school-limited-expiry')).data;let current=await call(who,'state');crypto.getRandomValues=function(array){if(array instanceof Uint32Array&&array.length===1){array[0]=4294967;return array;}return random.call(crypto,array);};
     current=await call(who,'action',action(current.data.revision,'limited-last-millisecond',{kind:'recruit',banner:'lava',count:1}));assert.equal(current.status,200);assert.equal(current.data.result.results[0].id,'lava');
     const state=JSON.parse(save(who).payload);state.banners.lava={pity:79,guaranteed:true};t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(state),who.profile.id);now++;
     const row=save(who);const expired=await call(who,'action',{...action(row.revision,'limited-expired-server',{kind:'recruit',banner:'lava',count:1,now:now-1000}),now:now-1000});assert.equal(expired.status,400);assert.equal(save(who).payload,row.payload);
     current=await call(who,'state');assert.deepEqual(current.data.state.banners.lava,{pity:79,guaranteed:true});current=await call(who,'action',action(current.data.revision,'limited-after-expiry-team',{kind:'team',team:['taeo','lava','sua']}));assert.equal(current.status,200);assert.equal(current.data.state.team[1],'lava');
     current=await call(who,'action',action(current.data.revision,'limited-after-expiry-train',{kind:'train',hero:'lava'}));assert.equal(current.status,200);assert.equal(current.data.state.units.lava.level,2);
   }finally{Date.now=realNow;crypto.getRandomValues=random;}
 });
 await test('A lost limited guaranteed draw is recovered after expiry without a second charge or guarantee consumption',async()=>{
   const realNow=Date.now,random=crypto.getRandomValues,prepare=t.db.prepare;let now=Date.parse('2026-11-21T00:00:00+09:00')-1;Date.now=()=>now;
   try{
     const who=(await t.login('school-limited-retry')).data;let current=await call(who,'state');const state=JSON.parse(save(who).payload);state.banners.lava={pity:79,guaranteed:true};state.banners.osia={pity:61,guaranteed:true};state.pity=61;t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(state),who.profile.id);
     current=await call(who,'state');const intent=action(current.data.revision,'limited-guarantee-lost',{kind:'recruit',banner:'lava',count:1});let drop=true;
     crypto.getRandomValues=function(array){if(array instanceof Uint32Array&&array.length===1){array[0]=4294967294;return array;}return random.call(crypto,array);};
     t.db.prepare=sql=>{const statement=prepare(sql);if(!sql.startsWith('UPDATE school_saves'))return statement;return{bind(...args){const bound=statement.bind(...args);return{...bound,async run(){const result=await bound.run();if(drop){drop=false;throw Error('D1_RESPONSE_LOST');}return result;}};}};};
     const lost=await call(who,'action',intent);assert.equal(lost.status,503);t.db.prepare=prepare;now+=2;
     const retries=await Promise.all([call(who,'action',intent),call(who,'action',intent)]);
     for(const r of retries){assert.equal(r.status,200);assert.equal(r.data.repeated,true);assert.equal(r.data.result.results[0].id,'lava');assert.equal(r.data.state.gems,1640);assert.equal(r.data.state.pulls,1);assert.deepEqual(r.data.state.banners.lava,{pity:0,guaranteed:false});assert.deepEqual(r.data.state.banners.osia,{pity:61,guaranteed:true});}
     const row=save(who);assert.equal((await call(who,'action',action(row.revision,'limited-guarantee-new',{kind:'recruit',banner:'lava',count:1}))).status,400);assert.equal(save(who).payload,row.payload);
   }finally{t.db.prepare=prepare;Date.now=realNow;crypto.getRandomValues=random;}
 });
 await test('Validated speed changes persist across sessions, use server time and never multiply the offline bank',async()=>{
   const realNow=Date.now;let now=realNow();Date.now=()=>now;
   try{
     const who=(await t.login('school-speed')).data;let current=await call(who,'state');const initial=current.data.state.battle.elapsed;
     current=await call(who,'action',action(current.data.revision,'speed-server-change001',{kind:'speed',speed:1.5,now:now+1000000,simCredit:999999}));assert.equal(current.status,200);assert.equal(current.data.state.speed,1.5);assert.equal(current.data.state.battle.elapsed,initial);
     now+=1000;const again=(await t.login('school-speed')).data;current=await call(again,'state',{speed:20,now:now+1000000});assert.equal(current.status,200);assert.equal(current.data.state.speed,1.5);assert.equal(current.data.state.battle.elapsed,initial+1500);assert.equal(current.data.state.simCredit,0);
     const row=save(who);assert.equal((await call(who,'action',action(row.revision,'speed-server-invalid01',{kind:'speed',speed:2}))).status,400);assert.equal(save(who).payload,row.payload);
     const state=JSON.parse(row.payload);state.at=now-12*3600000;state.best=0;state.offline={seconds:0,gold:0,xp:0};t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(state),who.profile.id);
     current=await call(who,'state');assert.equal(current.status,200);assert.equal(current.data.state.offline.seconds,28800);assert.equal(current.data.state.offline.gold,9600);assert.equal(current.data.state.speed,1.5);
   }finally{Date.now=realNow;}
 });
 await test('Old account formations migrate intact and six owned members persist across sessions without granting heroes',async()=>{
   const realNow=Date.now;Date.now=()=>Date.parse('2026-11-18T12:00:00+09:00');
   try{
     const who=(await t.login('school-six-members')).data;await call(who,'state');const old=JSON.parse(save(who).payload);delete old.activities;old.gold=5860;old.gems=290;old.best=30;const originalTeam=[...old.team],originalUnits=G.clone(old.units);t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(old),who.profile.id);
     let current=await call(who,'state');assert.equal(current.status,200);assert.deepEqual(current.data.state.team,originalTeam);assert.deepEqual(current.data.state.units,originalUnits);assert.equal(current.data.state.gold,5860);assert.equal(current.data.state.gems,290);assert.equal(current.data.state.activities.towerBest,0);
     const owned=JSON.parse(save(who).payload),team=['geonu','ian','lumi','nari','lava','osia'];for(const id of team)owned.units[id]={level:50,xp:0,stars:0,shards:0};t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(owned),who.profile.id);
     current=await call(who,'state');current=await call(who,'action',action(current.data.revision,'six-members-formation',{kind:'team',team}));assert.equal(current.status,200);assert.deepEqual(current.data.state.team,team);assert.equal(current.data.state.battle.heroes.length,6);
     const again=(await t.login('school-six-members')).data;current=await call(again,'state');assert.deepEqual(current.data.state.team,team);const row=save(who);assert.equal((await call(again,'action',action(row.revision,'six-members-overflow1',{kind:'team',team:[...team,'taeo']}))).status,400);assert.equal(save(who).payload,row.payload);
   }finally{Date.now=realNow;}
 });
 await test('Concurrent challenge entry spends one server-owned key and cannot replace an active run',async()=>{
   const realNow=Date.now;Date.now=()=>Date.parse('2026-11-18T12:00:00+09:00');
   try{
     const who=(await t.login('school-key-concurrency')).data;let current=await call(who,'state');const intent=action(current.data.revision,'activity-same-entry01',{kind:'activity',mode:'daily',tier:1,keys:99,used:0,reward:{gold:1e12,gems:1e12}});
     const same=await Promise.all([call(who,'action',intent),call(who,'action',intent)]);for(const r of same){assert.equal(r.status,200);assert.equal(r.data.state.activities.daily.used,1);assert.equal(r.data.state.activities.run.kind,'daily');}assert.equal(same[0].data.state.activities.run.id,same[1].data.state.activities.run.id);
     const active=save(who);for(const [index,input]of [{kind:'activity',mode:'weekly',tier:1},{kind:'team',team:['harin']},{kind:'stage',stage:1,mode:'farm'}].entries()){assert.equal((await call(who,'action',action(active.revision,'activity-active-reject'+index,input))).status,400);assert.equal(save(who).payload,active.payload);}
     current=await call(who,'action',action(active.revision,'activity-exit-refund01',{kind:'activity-exit'}));assert.equal(current.status,200);assert.equal(current.data.state.activities.daily.used,0);
     const competing=await Promise.all(['A','B'].map(id=>call(who,'action',action(current.data.revision,'activity-racing-entry'+id,{kind:'activity',mode:'daily',tier:1}))));assert.deepEqual(competing.map(r=>r.status).sort(),[200,409]);assert.equal(JSON.parse(save(who).payload).activities.daily.used,1);
   }finally{Date.now=realNow;}
 });
 await test('A victory committed before a lost server response pays once on retry and never auto-enters another dungeon',async()=>{
   const realNow=Date.now,prepare=t.db.prepare;let now=Date.parse('2026-11-18T12:00:00+09:00');Date.now=()=>now;
   try{
     const who=(await t.login('school-result-lost')).data;let current=await call(who,'state');const before={gold:current.data.state.gold,gems:current.data.state.gems};const intent=action(current.data.revision,'activity-lost-result01',{kind:'activity',mode:'daily',tier:1});current=await call(who,'action',intent);assert.equal(current.status,200);
     const ready=JSON.parse(save(who).payload);for(const e of ready.battle.enemies)e.hp=0;t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(ready),who.profile.id);now+=500;let drop=true;
     t.db.prepare=sql=>{const statement=prepare(sql);if(!sql.startsWith('UPDATE school_saves'))return statement;return{bind(...args){const bound=statement.bind(...args);return{...bound,async run(){const result=await bound.run();if(drop){drop=false;throw Error('D1_RESPONSE_LOST');}return result;}};}};};
     const lost=await call(who,'state');assert.equal(lost.status,503);t.db.prepare=prepare;
     current=await call(who,'state');assert.equal(current.status,200);assert.equal(current.data.state.activities.run.settled,true);assert.equal(current.data.state.gold,before.gold+2000);assert.equal(current.data.state.gems,before.gems+80);assert.deepEqual(current.data.state.activities.lastResult.reward,{gold:2000,gems:80,xp:70});
     const paid=G.clone(current.data.state.activities);now+=30000;const retries=await Promise.all([call(who,'state'),call(who,'action',intent)]);for(const r of retries){assert.equal(r.status,200);assert.equal(r.data.state.gold,before.gold+2000);assert.equal(r.data.state.gems,before.gems+80);assert.equal(r.data.state.activities.daily.used,1);assert.equal(r.data.state.activities.run.id,paid.run.id);assert.equal(r.data.state.battle.phase,'victory');}
   }finally{t.db.prepare=prepare;Date.now=realNow;}
 });
 await test('Server Korean day/week boundaries refill keys without trusting browser clocks or over-refunding old entries',async()=>{
   const realNow=Date.now;let now;Date.now=()=>now;
   try{
     for(const [kind,cutoff]of [['daily',Date.parse('2026-11-19T00:00:00+09:00')],['weekly',Date.parse('2026-11-23T00:00:00+09:00')]]){
       now=cutoff-1000;const who=(await t.login('school-server-boundary-'+kind)).data;let current=await call(who,'state');current=await call(who,'action',action(current.data.revision,'boundary-enter-'+kind+'01',{kind:'activity',mode:kind,tier:1,now:cutoff+86400000,period:0}));assert.equal(current.status,200);assert.equal(current.data.state.activities[kind].used,1);
       current=await call(who,'state',{now:cutoff+86400000,activities:{[kind]:{used:0}}});assert.equal(current.data.state.activities[kind].used,1);const cap=kind==='daily'?3:2;assert.equal(G.activityInfo(current.data.state,now)[kind].keys,cap-1);
       now=cutoff;current=await call(who,'state');assert.equal(G.activityInfo(current.data.state,now)[kind].keys,cap);current=await call(who,'action',action(current.data.revision,'boundary-exit-'+kind+'01',{kind:'activity-exit'}));assert.equal(current.status,200);assert.equal(current.data.state.activities[kind].used,0);assert.equal(current.data.state.activities.lastResult.refunded,false);assert.equal(G.activityInfo(current.data.state,now)[kind].keys,cap);
     }
   }finally{Date.now=realNow;}
 });
 await test('The server enforces sequential tower floors and zero repeated-floor currency, unit XP, or captain XP',async()=>{
   const realNow=Date.now;let now=Date.parse('2026-11-18T12:00:00+09:00');Date.now=()=>now;
   try{
     const who=(await t.login('school-tower-rewards')).data;let current=await call(who,'state');const first=save(who);assert.equal((await call(who,'action',action(first.revision,'tower-locked-floor001',{kind:'activity',mode:'tower',floor:2,towerBest:99}))).status,400);assert.equal(save(who).payload,first.payload);
     const win=async id=>{current=await call(who,'action',action(current.data.revision,id,{kind:'activity',mode:'tower',floor:1,towerBest:99,gold:1e12,reward:{gold:1e12}}));assert.equal(current.status,200);const s=JSON.parse(save(who).payload);for(const e of s.battle.enemies)e.hp=0;t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(s),who.profile.id);now+=500;current=await call(who,'state');assert.equal(current.status,200);};
     await win('tower-first-enter001');assert.equal(current.data.state.activities.towerBest,1);assert.equal(current.data.state.gold,805);assert.equal(current.data.state.gems,1810);assert.equal(current.data.state.activities.lastResult.firstClear,true);const paid=G.clone(current.data.state);
     await win('tower-repeat-enter01');assert.equal(current.data.state.activities.lastResult.firstClear,false);assert.deepEqual(current.data.state.activities.lastResult.reward,{gold:0,gems:0,xp:0});assert.equal(current.data.state.gold,paid.gold);assert.equal(current.data.state.gems,paid.gems);assert.deepEqual(current.data.state.units,paid.units);assert.deepEqual(current.data.state.captain,paid.captain);assert.equal(current.data.state.activities.daily.used,0);assert.equal(current.data.state.activities.weekly.used,0);
   }finally{Date.now=realNow;}
 });
 await test('New coupons use fixed server amounts and retired coupon names remain disabled',async()=>{
   const realNow=Date.now;Date.now=()=>Date.parse('2026-11-21T00:00:00+09:00');
   try{
     const who=(await t.login('school-new-coupons')).data;let current=await call(who,'state');for(const[code,amount]of [['THANKS_FOR_REPORTING',500],['HORAS_CELEBRATION',2000]]){
       const before=current.data.state;current=await call(who,'action',action(current.data.revision,'new-coupon-'+code+'001',{kind:'redeem',code:code.toLowerCase(),gold:1e12,gems:1e12}));assert.equal(current.status,200);assert.equal(current.data.state.gold,before.gold+amount);assert.equal(current.data.state.gems,before.gems+amount);const row=save(who);assert.equal((await call(who,'action',action(row.revision,'new-coupon-duplicate-'+code,{kind:'redeem',code}))).status,400);assert.equal(save(who).payload,row.payload);
     }
     const again=(await t.login('school-new-coupons')).data;current=await call(again,'state');assert.deepEqual(current.data.state.redeemedCodes,['THANKS_FOR_REPORTING','HORAS_CELEBRATION']);
     const retired=(await t.login('school-new-coupons-retired')).data;const fresh=await call(retired,'state');for(const code of ['OSIA_DEBUT','BUG_FIX','LAVA_DEBUT','THANK_YOU','MAJORUPDATE'])assert.equal((await call(retired,'action',action(fresh.data.revision,'retired-coupon-'+code,{kind:'redeem',code,now:0}))).status,400);assert.equal(JSON.parse(save(retired).payload).gold,700);
   }finally{Date.now=realNow;}
 });
 const couponEnd=Date.parse('2026-11-21T00:00:00+09:00');let couponAccount;
 await test('Coupon rewards use server amounts and time; concurrent normalized codes credit an account once',async()=>{
   const realNow=Date.now;Date.now=()=>couponEnd-60000;
   try{
     couponAccount=(await t.login('school-coupon')).data;const current=await call(couponAccount,'state');
     const forged={kind:'redeem',code:'  thanks_for_reporting  ',gold:1e12,gems:1e12,now:couponEnd+1e12,expiresAt:1e15,redeemedCodes:[]};
     const attempts=await Promise.all(['A','B'].map(id=>call(couponAccount,'action',{...action(current.data.revision,'coupon-parallel-0000'+id,forged),now:couponEnd+1e12,gold:1e12,gems:1e12})));
     assert.deepEqual(attempts.map(r=>r.status).sort(),[200,409]);
     const won=attempts.find(r=>r.status===200);assert.equal(won.data.result.kind,'redeem');assert.equal(won.data.result.code,'THANKS_FOR_REPORTING');assert.equal(won.data.result.gold,500);assert.equal(won.data.result.gems,500);
     let row=save(couponAccount),s=JSON.parse(row.payload);assert.equal(s.gold,1200);assert.equal(s.gems,2300);assert.deepEqual(s.redeemedCodes,['THANKS_FOR_REPORTING']);
     const duplicate=await call(couponAccount,'action',action(row.revision,'coupon-duplicate-0001',{kind:'redeem',code:'THANKS_FOR_REPORTING',redeemedCodes:[]}));
     assert.equal(duplicate.status,400);assert.equal(save(couponAccount).payload,row.payload);
     const reloaded=await call(couponAccount,'state',{state:{redeemedCodes:[]}});assert.deepEqual(reloaded.data.state.redeemedCodes,['THANKS_FOR_REPORTING']);assert.equal(reloaded.data.state.gems,2300);
   }finally{Date.now=realNow;}
 });
 await test('A committed coupon with a lost response is replayed safely and a new request cannot claim it again',async()=>{
   const realNow=Date.now;Date.now=()=>couponEnd-60000;const prepare=t.db.prepare;
   try{
     const current=await call(couponAccount,'state'),intent=action(current.data.revision,'coupon-response-lost01',{kind:'redeem',code:'horas_celebration'});let drop=true;
     t.db.prepare=sql=>{const statement=prepare(sql);if(!sql.startsWith('UPDATE school_saves'))return statement;return{bind(...args){const bound=statement.bind(...args);return{...bound,async run(){const result=await bound.run();if(drop){drop=false;throw Error('D1_RESPONSE_LOST');}return result;}};}};};
     const lost=await call(couponAccount,'action',intent);assert.equal(lost.status,503);t.db.prepare=prepare;
     const retries=await Promise.all([call(couponAccount,'action',intent),call(couponAccount,'action',intent)]);
     for(const r of retries){assert.equal(r.status,200);assert.equal(r.data.repeated,true);assert.equal(r.data.result.code,'HORAS_CELEBRATION');assert.equal(r.data.result.gems,2000);assert.equal(r.data.result.gold,2000);assert.equal(r.data.state.gold,3200);assert.equal(r.data.state.gems,4300);}
     const row=save(couponAccount),s=JSON.parse(row.payload);assert.deepEqual(s.redeemedCodes,['THANKS_FOR_REPORTING','HORAS_CELEBRATION']);assert.ok(G.validate(s));
     assert.equal((await call(couponAccount,'action',action(row.revision,'coupon-new-duplicate01',{kind:'redeem',code:'  HORAS_CELEBRATION  '}))).status,400);assert.equal(save(couponAccount).payload,row.payload);
   }finally{t.db.prepare=prepare;Date.now=realNow;}
 });
 await test('Replacement coupons remain valid after the former expiry and old codes cannot be revived by a forged date',async()=>{
   const realNow=Date.now;Date.now=()=>couponEnd+86400000;
   try{
     const who=(await t.login('school-coupon-retired-date')).data;const current=await call(who,'state');
     const valid=await call(who,'action',action(current.data.revision,'coupon-no-expiry-001',{kind:'redeem',code:'THANKS_FOR_REPORTING',now:0}));
     assert.equal(valid.status,200);assert.equal(valid.data.state.gems,2300);assert.equal(valid.data.state.gold,1200);
     const before=save(who),retired=await call(who,'action',{...action(before.revision,'coupon-retired-00001',{kind:'redeem',code:'BUG_FIX',now:couponEnd-86400000}),now:couponEnd-86400000});
     assert.equal(retired.status,400);assert.equal(save(who).payload,before.payload);
   }finally{Date.now=realNow;}
 });
 await test('Commander renames are normalized, validated and confirmed once across simultaneous sessions and lost responses',async()=>{
   const realNow=Date.now,prepare=t.db.prepare,originalBatch=t.db.batch;Date.now=()=>Date.parse('2026-11-24T12:00:00+09:00');
   try{
     const who=(await t.login('school-rename')).data;let current=await call(who,'state');const funded=JSON.parse(save(who).payload);funded.gems=10000;t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(funded),who.profile.id);current=await call(who,'state');const before=current.data.state;
     current=await call(who,'action',action(current.data.revision,'commander-rename-first',{kind:'rename',name:'  오시아  단장  ',gold:1e12,captain:{level:200}}));assert.equal(current.status,200);assert.equal(current.data.state.commanderName,'오시아 단장');assert.equal(current.data.state.gold,before.gold);assert.deepEqual(current.data.state.captain,before.captain);
     for(const[index,name]of ['<script>','단장\n이름','가'.repeat(13),null].entries()){const row=save(who);assert.equal((await call(who,'action',action(row.revision,'commander-invalid-name'+index,{kind:'rename',name}))).status,400);assert.equal(save(who).payload,row.payload);}
     const again=(await t.login('school-rename')).data;current=await call(again,'state');const races=await Promise.all(['붉은 단장','푸른 단장'].map((name,i)=>call(i?again:who,'action',action(current.data.revision,'commander-racing-name'+i,{kind:'rename',name}))));assert.deepEqual(races.map(r=>r.status).sort(),[200,409]);assert.equal(JSON.parse(save(who).payload).commanderName,races.find(r=>r.status===200).data.state.commanderName);
     current=await call(who,'state');const intent=action(current.data.revision,'commander-response-lost',{kind:'rename',name:'확인된 단장'});let drop=true;t.db.batch=async statements=>{const result=await originalBatch(statements);if(drop){drop=false;throw Error('D1_RESPONSE_LOST');}return result;};
     assert.equal((await call(who,'action',intent)).status,503);t.db.batch=originalBatch;t.db.prepare=prepare;const retry=await call(again,'action',intent);assert.equal(retry.status,200);assert.equal(retry.data.repeated,true);assert.equal(retry.data.state.commanderName,'확인된 단장');assert.equal((await call(again,'state')).data.state.commanderName,'확인된 단장');
   }finally{t.db.prepare=prepare;t.db.batch=originalBatch;Date.now=realNow;}
 });
 await test('Growth migration retains old level 50, raw XP and the previously earned offline captain share on the server',async()=>{
   const realNow=Date.now;Date.now=()=>Date.parse('2026-11-24T12:00:00+09:00');
   try{
     const who=(await t.login('school-growth-preserved')).data;await call(who,'state');const old=JSON.parse(save(who).payload);delete old.commanderName;old.captain={level:50,xp:1234};old.gold=123456;old.gems=5432;for(const u of Object.values(old.units))Object.assign(u,{level:60,xp:999,stars:3,shards:17});old.offline={seconds:600,gold:400,xp:1003};old.banners.osia={pity:79,guaranteed:true};old.pity=79;t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(old),who.profile.id);
     let current=await call(who,'state',{captain:{level:200},units:{},gems:0});assert.equal(current.status,200);assert.deepEqual(current.data.state.captain,old.captain);assert.deepEqual(current.data.state.units,old.units);assert.equal(current.data.state.gold,123456);assert.equal(current.data.state.gems,5432);assert.equal(current.data.state.commanderName,'새내기 단장');assert.deepEqual(current.data.state.offline,{...old.offline,captainXp:250});assert.deepEqual(current.data.state.banners,old.banners);
     current=await call(who,'action',action(current.data.revision,'growth-old-bank-claim',{kind:'offline',captainXp:1e12,xp:1e12}));assert.equal(current.status,200);assert.equal(current.data.state.captain.level,50);assert.equal(current.data.state.captain.xp,1484);assert.equal(current.data.state.gold,123856);for(const u of Object.values(current.data.state.units))assert.equal(u.xp,2002);assert.equal(current.data.state.offline.captainXp,0);
   }finally{Date.now=realNow;}
 });
 await test('The reduced training price is charged exactly once at the balance boundary and survives reconnects',async()=>{
   const realNow=Date.now;Date.now=()=>Date.parse('2026-11-24T12:00:00+09:00');
   try{
     const who=(await t.login('school-training-price')).data;await call(who,'state');const saved=JSON.parse(save(who).payload);Object.assign(saved.units.harin,{level:40,xp:321,stars:3,shards:17});saved.gold=3889;saved.gems=5432;saved.captain={level:50,xp:1234};t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(saved),who.profile.id);
     let current=await call(who,'state');assert.equal(current.status,200);assert.equal(current.data.state.gold,3889);assert.deepEqual(current.data.state.units.harin,saved.units.harin);const before=save(who);const denied=await call(who,'action',action(before.revision,'training-short-one-coin',{kind:'train',hero:'harin',cost:0,gold:1e12}));assert.equal(denied.status,400);assert.equal(save(who).payload,before.payload);
     saved.gold=3890;t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(saved),who.profile.id);current=await call(who,'state');const intent=action(current.data.revision,'training-price-once-01',{kind:'train',hero:'harin',cost:1,level:99});const copies=await Promise.all([call(who,'action',intent),call(who,'action',intent)]);
     for(const r of copies){assert.equal(r.status,200);assert.equal(r.data.state.gold,0);assert.equal(r.data.state.gems,5432);assert.deepEqual(r.data.state.captain,{level:50,xp:1234});assert.deepEqual(r.data.state.units.harin,{level:41,xp:0,stars:3,shards:17});assert.deepEqual(r.data.state.units.taeo,saved.units.taeo);}
     const again=(await t.login('school-training-price')).data;const loaded=await call(again,'state');assert.equal(loaded.status,200);assert.equal(loaded.data.state.gold,0);assert.equal(loaded.data.state.units.harin.level,41);const repeated=await call(again,'action',intent);assert.equal(repeated.status,200);assert.equal(repeated.data.repeated,true);assert.equal(repeated.data.state.gold,0);
   }finally{Date.now=realNow;}
 });
 let rankViewer,rankSubjects=[];
 await test('Public rankings expose only saved game names and server scores, with shared ties and a fifty-entry limit',async()=>{
   const realNow=Date.now;Date.now=()=>Date.parse('2026-11-24T12:00:00+09:00');
   try{
     rankViewer=(await t.login('school-ranking-viewer')).data;let current=await call(rankViewer,'state');current=await call(rankViewer,'action',action(current.data.revision,'ranking-viewer-name01',{kind:'rename',name:'순위 확인자'}));assert.equal(current.status,200);
     for(let i=0;i<60;i++){
       const id='rank-internal-'+String(i).padStart(2,'0'),s=G.create(Date.now(),i+1);s.commanderName='단장'+String(i).padStart(2,'0');s.captain={level:i>=57?180:100+i,xp:i>=58?300:i===57?100:i};s.activities.towerBest=i>=58?2000:i===57?1999:1000+i;if(i===56){delete s.commanderName;s.googleName='Never Publish Real Name';}
       t.sqlite.prepare('INSERT INTO accounts(id,google_key,created_at) VALUES(?,?,?)').run(id,'rank-private-google-'+i,Date.now());t.sqlite.prepare('INSERT INTO school_saves(account_id,payload,revision,updated_at) VALUES(?,?,0,?)').run(id,JSON.stringify(s),Date.now());rankSubjects.push({id,state:s});
     }
     const r=await call(null,'rankings',{mode:'level',score:1e12,level:200,floor:1e12,state:{captain:{level:200}}});assert.equal(r.status,200);assert.equal(r.data.mode,'level');assert.equal(r.data.limit,50);assert.equal(r.data.entries.length,50);assert.equal(r.data.me,null);assert.deepEqual(r.data.entries.slice(0,3).map(e=>({rank:e.rank,name:e.name,level:e.level})),[{rank:1,name:'단장58',level:180},{rank:1,name:'단장59',level:180},{rank:3,name:'단장57',level:180}]);assert.ok(r.headers.get('cache-control')?.includes('no-store'));
     assert.equal(r.data.entries.find(e=>e.level===156).name,'새내기 단장');for(const e of r.data.entries){assert.deepEqual(Object.keys(e).sort(),['floor','isMe','level','name','rank']);assert.equal(e.isMe,false);}const json=JSON.stringify(r.data);for(const secret of ['rank-internal-','rank-private-google-','never-store@example.test','Never Publish Real Name',rankViewer.token,rankViewer.profile.id,'receipts','units','google_key','account_id'])assert.ok(!json.includes(secret),secret);
     const forged=await call({token:'f'.repeat(64)},'rankings',{mode:'level'});assert.equal(forged.status,200);assert.equal(forged.data.me,null);assert.deepEqual(forged.data.entries,r.data.entries);assert.equal((await call(null,'rankings',{mode:'constructor'})).status,400);assert.equal((await call(null,'rankings',{mode:'level',catalogVersion:G.CATALOG_VERSION-1})).status,426);
   }finally{Date.now=realNow;}
 });
 await test('Signed ranking viewers receive their global rank outside the top fifty and never another account’s identity',async()=>{
   const realNow=Date.now;Date.now=()=>Date.parse('2026-11-24T12:00:00+09:00');
   try{
     const r=await call(rankViewer,'rankings',{mode:'level'});assert.equal(r.status,200);assert.ok(r.data.me);assert.equal(r.data.me.name,'순위 확인자');assert.equal(r.data.me.isMe,true);assert.ok(r.data.me.rank>50);assert.ok(r.data.entries.every(e=>!e.isMe));
     const row=JSON.parse(save(rankViewer).payload),higher=t.sqlite.prepare('SELECT payload FROM school_saves').all().map(r=>JSON.parse(r.payload)).filter(s=>s.captain.level>row.captain.level||s.captain.level===row.captain.level&&s.captain.xp>row.captain.xp).length;assert.equal(r.data.me.rank,higher+1);
     const other=await call(b,'rankings',{mode:'level'});assert.equal(other.status,200);assert.ok(other.data.me);assert.notEqual(other.data.me.name,r.data.me.name);const guest=await call(null,'rankings',{mode:'level'});assert.equal(guest.data.me,null);assert.ok(guest.data.entries.every(e=>!e.isMe));
     const noSave=(await t.login('school-rank-only-account')).data;assert.equal(save(noSave),undefined);const empty=await call(noSave,'rankings',{mode:'level'});assert.equal(empty.status,200);assert.equal(empty.data.me,null);assert.equal(save(noSave),undefined);
   }finally{Date.now=realNow;}
 });
 await test('Tower rankings use first-clear floors only, ignore fake scores, and safely exclude malformed JSON saves',async()=>{
   const realNow=Date.now;Date.now=()=>Date.parse('2026-11-24T12:00:00+09:00');
   try{
     const r=await call(rankViewer,'rankings',{mode:'tower',floor:999999,towerBest:999999,accountId:rankSubjects[0].id});assert.equal(r.status,200);assert.equal(r.data.me,null);assert.ok(r.data.entries.every(e=>e.floor>0));assert.deepEqual(r.data.entries.slice(0,3).map(e=>({rank:e.rank,name:e.name,floor:e.floor})),[{rank:1,name:'단장58',floor:2000},{rank:1,name:'단장59',floor:2000},{rank:3,name:'단장57',floor:1999}]);
     const before=await call(null,'rankings',{mode:'level'});t.sqlite.prepare('INSERT INTO accounts(id,google_key,created_at) VALUES(?,?,?)').run('rank-invalid-json','rank-invalid-private',Date.now());t.sqlite.prepare('INSERT INTO school_saves(account_id,payload,revision,updated_at) VALUES(?,?,0,?)').run('rank-invalid-json','{',Date.now());const safe=await call(null,'rankings',{mode:'level'});assert.equal(safe.status,200);assert.equal(safe.data.total,before.data.total);assert.deepEqual(safe.data.entries,before.data.entries);
     const s=JSON.parse(save(rankViewer).payload);s.captain={level:190,xp:100};s.activities.towerBest=2001;t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(s),rankViewer.profile.id);for(const mode of ['level','tower']){const top=await call(rankViewer,'rankings',{mode});assert.equal(top.status,200);assert.equal(top.data.me.rank,1);assert.equal(top.data.me.isMe,true);assert.equal(top.data.entries[0].name,'순위 확인자');assert.equal(top.data.entries[0].isMe,true);}
   }finally{Date.now=realNow;}
 });
 await test('Deleting an account removes its ranking immediately while leaving other saved competitors intact',async()=>{
   const realNow=Date.now;Date.now=()=>Date.parse('2026-11-24T12:00:00+09:00');
   try{
     const before=await call(null,'rankings',{mode:'level'});assert.equal(before.data.entries[0].name,'순위 확인자');assert.equal((await t.call('/api/account/delete',{confirm:'DELETE'},rankViewer.token)).status,200);assert.equal(save(rankViewer),undefined);
     const after=await call(null,'rankings',{mode:'level'});assert.equal(after.status,200);assert.equal(after.data.total,before.data.total-1);assert.ok(!after.data.entries.some(e=>e.name==='순위 확인자'));assert.equal(after.data.entries[0].name,'단장58');assert.equal(t.sqlite.prepare('SELECT count(*) AS n FROM school_saves WHERE account_id LIKE ?').get('rank-internal-%').n,60);
   }finally{Date.now=realNow;}
 });
 t.sqlite.close();console.log(`${passed} school server checks passed (SQLite + signed test Google credentials)`);
})().catch(e=>{console.error(e);process.exitCode=1;});
