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
   for(const catalogVersion of [1,2])assert.equal((await call(a,'state',{catalogVersion})).status,426);assert.equal(save(a).payload,row.payload);
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
   crypto.getRandomValues=function(array){if(array instanceof Uint32Array&&array.length===1){array[0]=++n%2===1?42949672:4294967294;return array;}return random.call(crypto,array);};
   let r;try{r=await call(who,'action',action(current.data.revision,'server-osia-draw-001',{kind:'recruit',count:1}));}finally{crypto.getRandomValues=random;}
   assert.equal(r.status,200);assert.equal(r.data.result.results[0].id,'osia');assert.equal(r.data.state.gems,1700);
   r=await call(who,'action',action(r.data.revision,'server-osia-team-001',{kind:'team',team:['taeo','osia','sua']}));assert.equal(r.status,200);
   const again=(await t.login('school-Osia')).data;r=await call(again,'state');assert.equal(r.data.state.team[1],'osia');assert.equal(r.data.state.units.osia.level,1);
   r=await call(again,'action',action(r.data.revision,'server-osia-train-01',{kind:'train',hero:'osia'}));assert.equal(r.status,200);assert.equal(r.data.state.units.osia.level,2);
 });
 await test('Server owns the soft-pity count and applies 60th-draw odds, 80th guarantee and resets',async()=>{
   const who=(await t.login('school-soft-pity')).data;await call(who,'state');
   const setMisses=misses=>{const s=JSON.parse(save(who).payload);s.pity=misses;t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(s),who.profile.id);};
   setMisses(39);assert.equal((await call(who,'state')).data.state.pity,39);
   const random=crypto.getRandomValues;
   try{
     setMisses(59);let n=0;crypto.getRandomValues=function(a){if(a instanceof Uint32Array&&a.length===1){a[0]=++n%2?193273528:4294967294;return a;}return random.call(crypto,a);};
     let current=await call(who,'state');assert.equal(current.data.state.pity,59);
     let r=await call(who,'action',{...action(current.data.revision,'soft-pity-server-001',{kind:'recruit',count:1}),pity:0,ssrChance:1});
     assert.equal(r.status,200);assert.equal(r.data.result.results[0].ssrChance,.05);assert.equal(r.data.result.results[0].id,'osia');assert.equal(r.data.state.pity,0);
     setMisses(79);crypto.getRandomValues=function(a){if(a instanceof Uint32Array&&a.length===1){a[0]=4294967294;return a;}return random.call(crypto,a);};
     current=await call(who,'state');r=await call(who,'action',action(current.data.revision,'hard-pity-server-001',{kind:'recruit',count:1}));assert.equal(r.status,200);assert.equal(r.data.result.results[0].ssrChance,1);assert.equal(r.data.result.results[0].pity,true);assert.equal(r.data.state.pity,0);
   }finally{crypto.getRandomValues=random;}
 });
 t.sqlite.close();console.log(`${passed} school server checks passed (SQLite + signed test Google credentials)`);
})().catch(e=>{console.error(e);process.exitCode=1;});
