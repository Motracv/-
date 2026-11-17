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
   const r=await call(a,'action',{...action(ra.data.revision,'server-owned-action-01',{kind:'recruit',count:1,gems:1e12,results:[{id:'lumi'}]}),accountId:b.profile.id});assert.equal(r.status,200);assert.equal(r.data.state.gems,1700);assert.equal(r.data.state.pulls,1);assert.equal(JSON.parse(save(b).payload).pulls,0);
 });
 await test('Old browser catalogs are rejected before spending or exposing unfamiliar heroes',async()=>{
   const row=save(a);const old=await t.call('/api/school/action',action(row.revision,'outdated-browser-0001',{kind:'recruit',count:10}),null,{'X-Account-Session':a.token});assert.equal(old.status,426);assert.equal(save(a).payload,row.payload);assert.ok(!old.data.state);
   for(const catalogVersion of [1,2,3,4,5])assert.equal((await call(a,'state',{catalogVersion})).status,426);assert.equal(save(a).payload,row.payload);
 });
 await test('Simultaneous same-ID requests and lost-response retries charge once',async()=>{
   const current=await call(a,'state');const input=action(current.data.revision,'same-action-0000000002',{kind:'recruit',count:10});
   const results=await Promise.all([call(a,'action',input),call(a,'action',input)]);results.forEach(r=>assert.equal(r.status,200));assert.equal(results[0].data.state.gems,800);assert.deepEqual(results[0].data.result,results[1].data.result);
   const again=await call(a,'action',input);assert.equal(again.data.repeated,true);assert.equal(again.data.state.pulls,11);assert.equal(again.data.state.gems,800);
 });
 await test('Distinct simultaneous spending actions conflict instead of overwriting',async()=>{
   const current=await call(a,'state');const rs=await Promise.all(['A','B'].map(id=>call(a,'action',action(current.data.revision,'parallel-action-000'+id,{kind:'train',hero:'harin'}))));
   assert.deepEqual(rs.map(r=>r.status).sort(),[200,409]);assert.equal(JSON.parse(save(a).payload).units.harin.level,2);
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
   const saved=JSON.parse(save(b).payload);assert.equal(saved.gold,before+9600);assert.equal(saved.offline.seconds,0);
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
   const recovered=await call(b,'action',intent);assert.equal(recovered.status,200);assert.equal(recovered.data.repeated,true);assert.equal(recovered.data.state.gems,before-100);
 });
 await test('Real persisted payload remains valid after requests and excludes personal Google claims',async()=>{
   const payload=save(b).payload;assert.ok(G.validate(JSON.parse(payload)));assert.ok(!payload.includes('never-store@example.test'));assert.ok(!payload.includes(b.token));
 });
 await test('Osia acquired through the server pool persists, can join the party and level up after reconnect',async()=>{
   const who=(await t.login('school-Osia')).data;const current=await call(who,'state');
   const random=crypto.getRandomValues;let n=0;
   crypto.getRandomValues=function(array){if(array instanceof Uint32Array&&array.length===1){array[0]=42949672;return array;}return random.call(crypto,array);};
   let r;try{r=await call(who,'action',action(current.data.revision,'server-osia-draw-001',{kind:'recruit',count:1}));}finally{crypto.getRandomValues=random;}
   assert.equal(r.status,200);assert.equal(r.data.result.results[0].id,'osia');assert.equal(r.data.state.gems,1700);
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
     setMisses(59);let n=0;crypto.getRandomValues=function(a){if(a instanceof Uint32Array&&a.length===1){a[0]=++n%2?193273528:42949672;return a;}return random.call(crypto,a);};
     let current=await call(who,'state');assert.equal(current.data.state.pity,59);
     let r=await call(who,'action',{...action(current.data.revision,'soft-pity-server-001',{kind:'recruit',count:1}),pity:0,ssrChance:1});
     assert.equal(r.status,200);assert.equal(r.data.result.results[0].ssrChance,.05);assert.equal(r.data.result.results[0].id,'osia');assert.equal(r.data.state.pity,0);
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
     let r=await draw('osia','server-banner-miss-01',[.01,.99]);assert.ok(['ian','lumi'].includes(r.data.result.results[0].id));assert.equal(r.data.state.banners.osia.guaranteed,true);assert.equal(r.data.state.banners.lava.guaranteed,false);
     r=await draw('lava','server-banner-lava-01',[.01,.01]);assert.equal(r.data.result.results[0].id,'lava');assert.equal(r.data.state.banners.osia.guaranteed,true);assert.equal(r.data.state.banners.lava.guaranteed,false);
     const again=(await t.login('school-banners')).data;current=await call(again,'state');assert.equal(current.data.state.banners.osia.guaranteed,true);assert.equal(current.data.state.units.lava.level,1);
     r=await draw('osia','server-banner-guarantee',[.01,.99]);assert.equal(r.data.result.results[0].id,'osia');assert.equal(r.data.state.banners.osia.guaranteed,false);assert.equal(r.data.state.gems,9700);assert.equal(r.data.state.pity,0);assert.equal(r.data.state.banners.lava.pity,0);
     const row=save(who);assert.equal((await call(who,'action',action(row.revision,'server-banner-invalid',{kind:'recruit',banner:'constructor',count:1}))).status,400);assert.equal(save(who).payload,row.payload);
   }finally{Date.now=realNow;crypto.getRandomValues=random;}
 });
 await test('Lava uses the server cutoff and remains playable after the limited banner closes',async()=>{
   const realNow=Date.now,random=crypto.getRandomValues;let now=Date.parse('2026-11-21T00:00:00+09:00')-1;Date.now=()=>now;
   try{
     const who=(await t.login('school-limited-expiry')).data;let current=await call(who,'state');crypto.getRandomValues=function(array){if(array instanceof Uint32Array&&array.length===1){array[0]=42949672;return array;}return random.call(crypto,array);};
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
     for(const r of retries){assert.equal(r.status,200);assert.equal(r.data.repeated,true);assert.equal(r.data.result.results[0].id,'lava');assert.equal(r.data.state.gems,1700);assert.equal(r.data.state.pulls,1);assert.deepEqual(r.data.state.banners.lava,{pity:0,guaranteed:false});assert.deepEqual(r.data.state.banners.osia,{pity:61,guaranteed:true});}
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
 const couponEnd=Date.parse('2026-11-21T00:00:00+09:00');let couponAccount;
 await test('Coupon rewards use server amounts and time; concurrent normalized codes credit an account once',async()=>{
   const realNow=Date.now;Date.now=()=>couponEnd-60000;
   try{
     couponAccount=(await t.login('school-coupon')).data;const current=await call(couponAccount,'state');
     const forged={kind:'redeem',code:'  osia_debut  ',gold:1e12,gems:1e12,now:couponEnd+1e12,expiresAt:1e15,redeemedCodes:[]};
     const attempts=await Promise.all(['A','B'].map(id=>call(couponAccount,'action',{...action(current.data.revision,'coupon-parallel-0000'+id,forged),now:couponEnd+1e12,gold:1e12,gems:1e12})));
     assert.deepEqual(attempts.map(r=>r.status).sort(),[200,409]);
     const won=attempts.find(r=>r.status===200);assert.equal(won.data.result.kind,'redeem');assert.equal(won.data.result.code,'OSIA_DEBUT');assert.equal(won.data.result.gold,1000);assert.equal(won.data.result.gems,1000);
     let row=save(couponAccount),s=JSON.parse(row.payload);assert.equal(s.gold,1700);assert.equal(s.gems,2800);assert.deepEqual(s.redeemedCodes,['OSIA_DEBUT']);
     const duplicate=await call(couponAccount,'action',action(row.revision,'coupon-duplicate-0001',{kind:'redeem',code:'OSIA_DEBUT',redeemedCodes:[]}));
     assert.equal(duplicate.status,400);assert.equal(save(couponAccount).payload,row.payload);
     const reloaded=await call(couponAccount,'state',{state:{redeemedCodes:[]}});assert.deepEqual(reloaded.data.state.redeemedCodes,['OSIA_DEBUT']);assert.equal(reloaded.data.state.gems,2800);
   }finally{Date.now=realNow;}
 });
 await test('A committed coupon with a lost response is replayed safely and a new request cannot claim it again',async()=>{
   const realNow=Date.now;Date.now=()=>couponEnd-60000;const prepare=t.db.prepare;
   try{
     const current=await call(couponAccount,'state'),intent=action(current.data.revision,'coupon-response-lost01',{kind:'redeem',code:'bug_fix'});let drop=true;
     t.db.prepare=sql=>{const statement=prepare(sql);if(!sql.startsWith('UPDATE school_saves'))return statement;return{bind(...args){const bound=statement.bind(...args);return{...bound,async run(){const result=await bound.run();if(drop){drop=false;throw Error('D1_RESPONSE_LOST');}return result;}};}};};
     const lost=await call(couponAccount,'action',intent);assert.equal(lost.status,503);t.db.prepare=prepare;
     const retries=await Promise.all([call(couponAccount,'action',intent),call(couponAccount,'action',intent)]);
     for(const r of retries){assert.equal(r.status,200);assert.equal(r.data.repeated,true);assert.equal(r.data.result.code,'BUG_FIX');assert.equal(r.data.result.gems,1500);assert.equal(r.data.result.gold,1500);assert.equal(r.data.state.gold,3200);assert.equal(r.data.state.gems,4300);}
     const row=save(couponAccount),s=JSON.parse(row.payload);assert.deepEqual(s.redeemedCodes,['OSIA_DEBUT','BUG_FIX']);assert.ok(G.validate(s));
     assert.equal((await call(couponAccount,'action',action(row.revision,'coupon-new-duplicate01',{kind:'redeem',code:'  BUG_FIX  '}))).status,400);assert.equal(save(couponAccount).payload,row.payload);
   }finally{t.db.prepare=prepare;Date.now=realNow;}
 });
 await test('Coupon expiry includes November 20 KST and ignores forged client clocks at the exact cutoff',async()=>{
   const realNow=Date.now;let now=couponEnd-1;Date.now=()=>now;
   try{
     const who=(await t.login('school-coupon-expiry')).data;let current=await call(who,'state');
     const valid=await call(who,'action',action(current.data.revision,'coupon-last-millisecond',{kind:'redeem',code:'OSIA_DEBUT',now:couponEnd+100000}));
     assert.equal(valid.status,200);assert.equal(valid.data.state.gems,2800);assert.equal(valid.data.state.gold,1700);
     now=couponEnd;const before=save(who);
     const expired=await call(who,'action',{...action(before.revision,'coupon-expired-00001',{kind:'redeem',code:'BUG_FIX',now:couponEnd-86400000}),now:couponEnd-86400000});
     assert.equal(expired.status,400);assert.equal(save(who).payload,before.payload);
     current=await call(who,'state');assert.deepEqual(current.data.state.redeemedCodes,['OSIA_DEBUT']);
   }finally{Date.now=realNow;}
 });
 t.sqlite.close();console.log(`${passed} school server checks passed (SQLite + signed test Google credentials)`);
})().catch(e=>{console.error(e);process.exitCode=1;});
