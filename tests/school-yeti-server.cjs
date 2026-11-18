const assert=require('node:assert/strict'),G=require('../school/engine.js'),{fixture}=require('./account-fixture.cjs');
(async()=>{const t=await fixture(),nativeNow=Date.now;let now=Date.parse('2026-11-18T12:00:00+09:00');Date.now=()=>now;
try{
 if(process.env.SCHOOL_TEST_BUNDLE){const worker=(await import(require('node:url').pathToFileURL(process.env.SCHOOL_TEST_BUNDLE).href)).default,original=t.call;t.call=async(path,data={},token,headers={})=>{if(!path.startsWith('/api/school/'))return original(path,data,token,headers);const r=await worker.fetch(new Request('https://card.example'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://motracv.github.io',...headers},body:JSON.stringify(data)}),t.env);return{status:r.status,data:await r.json()};};}
 const call=(p,path,data={})=>t.call('/api/school/'+path,{catalogVersion:G.CATALOG_VERSION,...data},null,p?{'X-Account-Session':p.token}:{});
 const cmd=(p,kind,extra={})=>call(p,'yeti',{kind,requestId:crypto.randomUUID(),...extra});
 const row=p=>t.sqlite.prepare('SELECT * FROM school_saves WHERE account_id=?').get(p.profile.id),saved=p=>JSON.parse(row(p).payload);
 const act=(p,action,extra={})=>call(p,'action',{revision:row(p).revision,requestId:crypto.randomUUID(),action,...extra});
 const room=id=>JSON.parse(t.sqlite.prepare('SELECT payload FROM school_yeti_rooms WHERE id=?').get(id).payload);
 async function race(fn){const original=t.db.batch.bind(t.db);let count=0,release;const gate=new Promise(r=>release=r);t.db.batch=async statements=>{if(count<2){if(++count===2)release();await gate;}return original(statements);};try{return await fn();}finally{t.db.batch=original;}}
 const users=[];for(let i=0;i<3;i++){const p=(await t.login('yeti-'+i)).data;assert.equal((await call(p,'state')).status,200);const s=G.create(now,1);s.commanderName='겨울단장'+i;s.team=['horas','osia','lava','ryusion','lumi','ian'];for(const id of s.team)s.units[id]={level:100,stars:5,xp:0,shards:0};t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(s),p.profile.id);users.push(p);}
 const [a,b,c]=users;
 assert.equal((await cmd(null,'create')).status,401);assert.equal((await cmd(a,'create',{catalogVersion:24})).status,426);
 const createId=crypto.randomUUID();const creates=await race(()=>Promise.all([cmd(a,'create',{requestId:createId}),cmd(a,'create',{requestId:createId})]));assert(creates.every(r=>r.status===200));assert.equal(creates[0].data.room.id,creates[1].data.room.id);let id=creates[0].data.room.id,code=creates[0].data.room.code;
 assert.equal((await cmd(a,'ready',{roomId:id})).status,200);assert.equal((await cmd(a,'start',{roomId:id})).status,409);
 assert.equal((await cmd(b,'join',{code})).status,200);assert.equal((await cmd(c,'join',{code})).status,409);
 assert.equal((await cmd(c,'state',{roomId:id})).status,403);assert.equal((await cmd(b,'start',{roomId:id})).status,403);
 assert.equal((await cmd(b,'ready',{roomId:id})).status,200);
 const startId=crypto.randomUUID();const starts=await race(()=>Promise.all([cmd(a,'start',{roomId:id,requestId:startId,hp:1}),cmd(a,'start',{roomId:id,requestId:startId,hp:1})]));assert(starts.every(r=>r.status===200));assert.equal(room(id).battle.boss.max,800000);assert.equal(starts[0].data.rules.duration,210000);assert.equal(starts[0].data.rules.recommendedLevel,70);assert.equal(room(id).battle.yetiRules.version,2);
 assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM school_raid_days').get().n,0);
 assert(!JSON.stringify(starts[0].data).includes(a.profile.id));assert(!JSON.stringify(starts[0].data).includes('seed'));assert(!JSON.stringify(starts[0].data).includes('receipts'));
 console.log('PASS authenticated duo-only rooms, one concurrent create/start, capacity/privacy and no guild entry costs');
 const start=now;let firstFreeze=null;
 while(now-start<210000&&!room(id).battle.ended){now+=1000;const views=await Promise.all([cmd(a,'state',{roomId:id}),cmd(b,'state',{roomId:id})]);for(const v of views)assert.equal(v.status,200);assert.equal(views[0].data.room.battle.boss.hp,views[1].data.room.battle.boss.hp);
  const battle=room(id).battle,ti=battle.teams.findIndex(t=>t.frozen);if(ti>=0&&!battle.ended){const target=users[ti],partner=users[1-ti],freezeId=battle.teams[ti].frozen.id;
   if(!firstFreeze){firstFreeze=freezeId;assert.equal((await cmd(target,'thaw',{roomId:id,freezeId})).status,400);assert.equal((await cmd(c,'thaw-start',{roomId:id,freezeId,mode:'keyboard'})).status,403);assert.equal((await cmd(partner,'thaw',{roomId:id,freezeId:'forged'})).status,400);}
   const challenge=await cmd(partner,'thaw-start',{roomId:id,freezeId,mode:'keyboard'});assert.equal(challenge.status,200);const q=challenge.data.room.battle.teams.find(t=>t.isMe).rescue;const thawId=crypto.randomUUID();const rs=await race(()=>Promise.all([cmd(partner,'thaw-submit',{roomId:id,challengeId:q.id,inputs:q.sequence,requestId:thawId}),cmd(partner,'thaw-submit',{roomId:id,challengeId:q.id,inputs:q.sequence,requestId:thawId})]));assert(rs.every(r=>r.status===200));assert.equal(room(id).battle.teams[ti].frozen,null);
   assert.equal((await cmd(partner,'thaw',{roomId:id,freezeId})).status,400);
  }
 }
 assert(firstFreeze);assert.equal(room(id).battle.outcome,'defeated');
 const awards=t.sqlite.prepare('SELECT * FROM school_yeti_rewards WHERE room_id=?').all(id);assert.equal(awards.length,2);assert(awards.every(r=>r.snowflakes>=20&&r.snowflakes<=50&&r.snowmen===1));
 // Settle ordinary idle farming first so this assertion isolates the Yeti award.
 await call(a,'state');await call(b,'state');const beforeFlakes=[saved(a).winter.snowflakes,saved(b).winter.snowflakes];
 const input={revision:row(a).revision,requestId:crypto.randomUUID(),action:{kind:'yeti-claim',roomId:id,snowflakes:1e12}};
 const wins=await Promise.all([call(a,'action',input),call(a,'action',input)]);assert(wins.every(r=>r.status===200));const n=awards.find(r=>r.account_id===a.profile.id).snowflakes;
 assert.equal(saved(a).winter.snowflakes,beforeFlakes[0]+n);assert.equal(saved(b).winter.snowflakes,beforeFlakes[1]);assert.equal((await call(a,'action',input)).data.repeated,true);assert.equal((await act(a,{kind:'yeti-claim',roomId:id})).status,400);assert.equal((await act(c,{kind:'yeti-claim',roomId:id})).status,400);
 assert.equal((await act(b,{kind:'yeti-claim',roomId:id})).status,200);assert.equal(saved(a).winter.snowmen,1);assert.equal(saved(b).winter.snowmen,1);
 console.log('PASS shared HP, ally-only freeze rescue, duplicate thaw safety, victory rewards 20–50 once per account');

 const second=await cmd(a,'create');assert.equal(second.status,200);const id2=second.data.room.id;
 assert.equal((await cmd(a,'leave',{roomId:id})).status,200);assert.equal((await cmd(a,'state')).data.room.id,id2);
 assert.equal((await cmd(a,'leave',{roomId:id2})).status,200);assert.equal((await cmd(a,'state')).data.room,null);
 assert.equal((await cmd(a,'create',{requestId:createId})).data.room,null);assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM school_yeti_rooms').get().n,2);assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM school_yeti_slots WHERE account_id=?').get(a.profile.id).n,0);
 const third=await cmd(a,'create');id=third.data.room.id;code=third.data.room.code;await cmd(b,'join',{code});await cmd(a,'ready',{roomId:id});await cmd(b,'ready',{roomId:id});await cmd(a,'start',{roomId:id});now+=1000;
 assert.equal((await cmd(a,'leave',{roomId:id})).status,200);assert.equal(room(id).outcome,'abandoned');assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM school_yeti_rewards WHERE room_id=?').get(id).n,0);assert.equal((await cmd(b,'state')).data.room,null);
 const fourth=await cmd(a,'create');id=fourth.data.room.id;now+=121000;assert.equal((await cmd(a,'state')).data.room,null);assert.equal((await cmd(a,'create')).status,200);
 console.log('PASS unlimited subsequent attempts, stale leave isolation, create retry tombstone, forfeit and stale lobby cleanup');

 const s=saved(c);delete s.units.horas;s.team=s.team.filter(x=>x!=='horas');s.winter.snowflakes=s.winter.earned=3000;t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(s),c.profile.id);
 let r=await act(c,{kind:'winter-exchange',item:'horas',shards:9999,cost:0});assert.equal(r.status,200);assert.equal(saved(c).heroShards.horas,5);assert(!saved(c).units.horas);
 r=await act(c,{kind:'winter-exchange',item:'horas'});assert.equal(r.status,200);assert.equal((await act(c,{kind:'winter-exchange',item:'horas'})).status,400);assert.equal(saved(c).winter.snowflakes,1000);
 now=Date.parse('2026-11-19T00:00:01+09:00');assert.equal((await act(c,{kind:'winter-exchange',item:'horas'})).status,200);assert.equal(saved(c).heroShards.horas,15);
 // Account deletion must remove room/snapshot identities without breaking the partner.
 const last=await cmd(b,'create');id=last.data.room.id;await cmd(c,'join',{code:last.data.room.code});t.sqlite.prepare('DELETE FROM accounts WHERE id=?').run(c.profile.id);assert(!JSON.stringify(room(id)).includes(c.profile.id));assert.equal((await cmd(b,'state')).status,200);
 console.log('PASS authoritative shard cost/quantity/daily limit, unowned bank, KST reset and deletion cleanup');
}finally{Date.now=nativeNow;t.sqlite.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
