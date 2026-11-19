const assert=require('node:assert/strict');const {fixture}=require('./account-fixture.cjs');const G=require('../school/engine.js');
(async()=>{const t=await fixture(),nativeNow=Date.now;Date.now=()=>Date.parse('2026-11-19T12:00:00+09:00');try{
 if(process.env.SCHOOL_TEST_BUNDLE){const w=(await import(require('node:url').pathToFileURL(process.env.SCHOOL_TEST_BUNDLE).href)).default,original=t.call;t.call=async(route,data={},token,headers={})=>{if(!route.startsWith('/api/school/'))return original(route,data,token,headers);const r=await w.fetch(new Request('https://card.example'+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://motracv.github.io',...headers},body:JSON.stringify(data)}),t.env);return{status:r.status,data:await r.json()};};}
 const a=(await t.login('bond-a')).data,b=(await t.login('bond-b')).data;
 const call=(who,route,data={})=>t.call('/api/school/'+route,{catalogVersion:G.CATALOG_VERSION,...data},null,who?{'X-Account-Session':who.token}:{});
 const row=who=>t.sqlite.prepare('SELECT * FROM school_saves WHERE account_id=?').get(who.profile.id),saved=who=>JSON.parse(row(who).payload);
 const action=(who,input)=>({revision:row(who).revision,requestId:crypto.randomUUID(),action:input});
 await call(a,'state');await call(b,'state');assert.equal((await call(null,'action',action(a,{kind:'bond-read',episode:1}))).status,401);
 assert.equal((await call(a,'action',action(a,{kind:'bond-read',episode:4,xp:650,read:[1,2,3]}))).status,400);
 let s=saved(a);s.units.osia={level:70,xp:0,stars:2,shards:0};s.bonds={osia:{xp:90,read:[1],daily:{day:G.day(s.at),waves:10,bosses:0,dragons:0,earned:10,claimed:[]}}};s.captain.level=20;
 t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(s),a.profile.id);
 const wallet=[s.gold,s.gems],input=action(a,{kind:'bond-read',episode:2,avatar:'rank-first',gold:1e10});
 const both=await Promise.all([call(a,'action',input),call(a,'action',input)]);both.forEach(r=>assert.equal(r.status,200));assert.deepEqual(saved(a).bonds.osia.read,[1,2]);assert.deepEqual([saved(a).gold,saved(a).gems],wallet);
 assert.equal((await call(b,'action',action(b,{kind:'profile',avatar:'osia-memory'}))).status,400);
 assert.equal((await call(a,'action',action(a,{kind:'profile',avatar:'osia-memory'}))).status,200);
 const tasks=action(a,{kind:'bond-mission',mission:'waves',xp:1e9});const claims=await Promise.all([call(a,'action',tasks),call(a,'action',tasks)]);claims.forEach(r=>assert.equal(r.status,200));assert.equal(saved(a).bonds.osia.xp,98);assert.equal((await call(a,'action',action(a,{kind:'bond-mission',mission:'waves'}))).status,400);
 const relog=(await t.login('bond-a')).data;const loaded=(await call(relog,'state')).data.state;assert.equal(loaded.profile.avatar,'osia-memory');assert.equal(loaded.bonds.osia.xp,98);assert.deepEqual(loaded.bonds.osia.read,[1,2]);assert(G.validate(saved(a)));
 const board=await call(a,'rankings',{mode:'level'});assert.equal(board.status,200);assert.equal(board.data.me.avatar,'osia-memory');
 assert.equal((await call(a,'action',action(a,{kind:'rename',name:'파도의 단장'}))).status,200);const profile=await call(a,'profile',{name:'파도의 단장'});assert.equal(profile.status,200);assert.equal(profile.data.avatar,'osia-memory');
 assert.equal(saved(b).bonds,undefined);assert.equal((await call(a,'state',{catalogVersion:27})).status,426);
 let next=saved(a);next.units.ryusion={level:29,xp:0,stars:0,shards:0};next.bonds.ryusion={xp:650,read:[1],daily:{day:G.day(next.at),waves:10,bosses:0,dragons:0,earned:0,claimed:[]}};next.shardExchange={SR:0,SSR:100};
 t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(next),a.profile.id);
 assert.equal((await call(a,'action',action(a,{kind:'bond-read',hero:'ryusion',episode:2,level:70}))).status,400);
 const exchange=action(a,{kind:'shard-select',hero:'ryusion'});const exchanged=await Promise.all([call(a,'action',exchange),call(a,'action',exchange)]);exchanged.forEach(r=>assert.equal(r.status,200));assert.equal(saved(a).units.ryusion.shards,5);assert.equal(saved(a).shardExchange.SSR,90);
 assert.equal((await call(b,'action',action(b,{kind:'shard-select',hero:'ryusion'}))).status,400);
 next=saved(a);next.units.ryusion.level=70;t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(next),a.profile.id);
 for(let chapter=2;chapter<=4;chapter++)assert.equal((await call(a,'action',action(a,{kind:'bond-read',hero:'ryusion',episode:chapter}))).status,200);
 assert.equal((await call(a,'action',action(a,{kind:'profile',avatar:'ryusion-memory',title:'ryusion-oath'}))).status,200);
 const ryusionProfile=await call(a,'profile',{name:'파도의 단장'});assert.equal(ryusionProfile.data.avatar,'ryusion-memory');assert.equal(ryusionProfile.data.title,'ryusion-oath');assert(G.validate(saved(a)));
 // The new UR shares the same authoritative story, reward and public-profile path.
 assert.equal((await call(b,'action',action(b,{kind:'bond-read',hero:'hyeokjin',episode:1}))).status,400);
 assert.equal((await call(b,'action',action(b,{kind:'profile',avatar:'hyeokjin-memory',title:'hyeokjin-oath'}))).status,400);
 next=saved(a);next.units.hyeokjin={level:29,xp:0,stars:0,shards:0};next.bonds.hyeokjin={xp:650,read:[],daily:{day:G.day(next.at),waves:0,bosses:0,dragons:0,earned:0,claimed:[]}};
 t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(next),a.profile.id);
 assert.equal((await call(a,'action',action(a,{kind:'bond-read',hero:'hyeokjin',episode:1}))).status,200);
 assert.equal((await call(a,'action',action(a,{kind:'bond-read',hero:'hyeokjin',episode:2,level:100}))).status,400);
 for(const [chapter,level]of [[2,30],[3,50],[4,70]]){
  next=saved(a);next.units.hyeokjin.level=level;t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(next),a.profile.id);
  const read=action(a,{kind:'bond-read',hero:'hyeokjin',episode:chapter});const retries=await Promise.all([call(a,'action',read),call(a,'action',read)]);assert(retries.every(r=>r.status===200));
 }
 assert.deepEqual(saved(a).bonds.hyeokjin.read,[1,2,3,4]);
 assert.equal((await call(a,'action',action(a,{kind:'profile',avatar:'hyeokjin-memory',title:'hyeokjin-oath'}))).status,200);
 const renewed=(await t.login('bond-a')).data,persisted=(await call(renewed,'state')).data.state;
 assert(G.bondInfo(persisted,persisted.at,'hyeokjin').dialogue);assert.equal(persisted.profile.avatar,'hyeokjin-memory');assert.equal(persisted.profile.title,'hyeokjin-oath');
 const hyeokjinRank=await call(renewed,'rankings',{mode:'level'});assert.equal(hyeokjinRank.data.me.avatar,'hyeokjin-memory');
 const hyeokjinProfile=await call(renewed,'profile',{name:'파도의 단장'});assert.equal(hyeokjinProfile.data.avatar,'hyeokjin-memory');assert.equal(hyeokjinProfile.data.title,'hyeokjin-oath');assert(G.validate(saved(a)));
 console.log('PASS account-owned bond progression, forged rewards rejected, concurrent retry once, duplicate missions, relog persistence, ranked/profile projection and catalog compatibility; Hyeokjin chapters, growth gates, avatar/title/dialogue and public display');
 }finally{Date.now=nativeNow;t.sqlite.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
