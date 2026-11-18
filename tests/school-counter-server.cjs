const assert=require('node:assert/strict'),{fixture}=require('./account-fixture.cjs'),G=require('../school/engine.js');
(async()=>{
 const t=await fixture(),realNow=Date.now;let now=Date.parse('2026-11-18T09:00:00Z'),serial=0,passed=0;Date.now=()=>now;
 const compiled=process.env.SCHOOL_TEST_BUNDLE?(await import(require('node:url').pathToFileURL(process.env.SCHOOL_TEST_BUNDLE).href)).default:null;
 const call=async(who,path,data={})=>{const body={catalogVersion:G.CATALOG_VERSION,...data};if(!compiled)return t.call('/api/school/'+path,body,null,who?{'X-Account-Session':who.token}:{});const r=await compiled.fetch(new Request('https://card.example/api/school/'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://motracv.github.io',...(who?{'X-Account-Session':who.token}:{})},body:JSON.stringify(body)}),t.env);return {status:r.status,data:await r.json()};};
 const row=who=>t.sqlite.prepare('SELECT * FROM school_saves WHERE account_id=?').get(who.profile.id),saved=who=>JSON.parse(row(who).payload);
 async function ready(name){now+=61000;const who=(await t.login('counter-'+name)).data;assert.equal((await call(who,'state')).status,200);const s=G.create(now,123);for(const h of s.battle.heroes){h.max=h.hp=100000;h.atk=10;}for(const e of s.battle.enemies){e.max=e.hp=100000;e.atk=10;}for(let i=0;i<240&&!G.counterInfo(s).active;i++)G.advance(s,s.at+500);assert(G.counterInfo(s).active);now=s.at;assert(G.validate(s));t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(s),who.profile.id);return who;}
 const intent=who=>{const s=saved(who);return {revision:row(who).revision,requestId:'counter-intent-'+String(++serial).padStart(8,'0'),action:{kind:'counter',battleId:s.battle.id,opportunityId:s.counter.opportunity?.id}};};
 const test=async(name,run)=>{await run();console.log('PASS',name);passed++;};
 try{
  await test('Only authenticated current clients can counter; forged HP, target and clocks are ignored',async()=>{
   const a=await ready('auth'),q=intent(a),before=saved(a);assert.equal((await call(null,'action',q)).status,401);assert.equal((await call(a,'action',{...q,catalogVersion:17})).status,426);assert.deepEqual(saved(a),before);
   const r=await call(a,'action',{...q,now:now-100000,action:{...q.action,amount:1e15,target:'e99',hp:0,now:0}});assert.equal(r.status,200);assert.equal(r.data.result.amount,18);const e=before.counter.opportunity.enemyId;assert.equal(before.battle.enemies.find(x=>x.id===e).hp-saved(a).battle.enemies.find(x=>x.id===e).hp,18);assert.equal(saved(a).gems,before.gems);
  });
  await test('Five simultaneous clicks and replay after expiry produce exactly one counter',async()=>{
   const a=await ready('same'),q=intent(a),before=saved(a),rs=await Promise.all(Array.from({length:5},()=>call(a,'action',q)));assert(rs.every(r=>r.status===200));assert(rs.every(r=>JSON.stringify(r.data.result)===JSON.stringify(rs[0].data.result)));assert.equal(saved(a).events.filter(e=>e.kind==='counter').length,1);const after=row(a).payload;now+=10000;const replay=await call(a,'action',q);assert(replay.data.repeated);assert.equal(row(a).payload,after);assert.equal(saved(a).gems,before.gems);
  });
  await test('Different concurrent requests conflict; consumed opportunity cannot be reused at a fresh revision',async()=>{
   const a=await ready('distinct'),x=intent(a),y=intent(a),rs=await Promise.all([call(a,'action',x),call(a,'action',y)]);assert.deepEqual(rs.map(r=>r.status).sort(),[200,409]);const before=row(a).payload;assert.equal((await call(a,'action',{...intent(a),action:x.action})).status,400);assert.equal(row(a).payload,before);
  });
  await test('Expired, foreign and fabricated opportunities never alter the save',async()=>{
   const a=await ready('expired'),q=intent(a);now=saved(a).counter.opportunity.expiresAt;const before=row(a).payload;assert.equal((await call(a,'action',{...q,now:now-99999,action:{...q.action,expiresAt:now+99999}})).status,400);assert.equal(row(a).payload,before);
   const b=await ready('forged'),base=intent(b),snap=row(b).payload;assert.equal((await call(b,'action',{...base,action:{...base.action,opportunityId:q.action.opportunityId+'foreign'}})).status,400);assert.equal(row(b).payload,snap);
  });
  await test('Lost commit response retries its receipt without a second hit',async()=>{
   const a=await ready('lost'),q=intent(a),prepare=t.db.prepare;let lost=false;
   t.db.prepare=sql=>{const statement=prepare(sql);if(!sql.startsWith('UPDATE school_saves'))return statement;return {bind(...args){const bound=statement.bind(...args);return {...bound,async run(){const r=await bound.run();if(!lost&&r.meta.changes){lost=true;throw Error('D1_RESPONSE_LOST_AFTER_COUNTER');}return r;}};}};};
   const first=await call(a,'action',q);t.db.prepare=prepare;assert.equal(first.status,503);const after=row(a).payload;const retry=await call(a,'action',q);assert.equal(retry.status,200);assert(retry.data.repeated);assert.equal(row(a).payload,after);assert.equal(saved(a).events.filter(e=>e.kind==='counter').length,1);
  });
  console.log(`${passed} counter SQLite security groups passed`);
 }finally{Date.now=realNow;t.sqlite.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
