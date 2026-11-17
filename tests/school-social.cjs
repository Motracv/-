const assert=require('node:assert/strict');
const {fixture}=require('./account-fixture.cjs');
const G=require('../school/engine.js');
(async()=>{
 const t=await fixture(), realNow=Date.now;let now=Date.parse('2026-11-18T18:00:00+09:00'),passed=0;Date.now=()=>now;
 const test=async(name,fn)=>{await fn();console.log('PASS',name);passed++;};
 const call=(who,path,data={})=>t.call('/api/school/'+path,{catalogVersion:G.CATALOG_VERSION,...data},null,who?{'X-Account-Session':who.token}:{});
 const social=(who,kind,data={})=>call(who,'social',{kind,...data});
 const row=who=>t.sqlite.prepare('SELECT * FROM school_saves WHERE account_id=?').get(who.profile.id);
 const patch=(who,change)=>{const s=JSON.parse(row(who).payload);change(s);t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(s),who.profile.id);};
 const rename=async(who,name,id)=>{const current=await call(who,'state');return call(who,'action',{revision:current.data.revision,requestId:id,action:{kind:'rename',name}});};
 const a=(await t.login('social-a')).data,b=(await t.login('social-b')).data,c=(await t.login('social-c')).data;
 for(const who of[a,b,c])await call(who,'state');
 try{
 await test('Unnamed account state works, but unauthenticated social and unnamed invitations are rejected',async()=>{
  assert.equal((await social(null,'state')).status,401);const state=await social(a,'state');assert.equal(state.status,200);assert.equal(state.data.me.canName,true);assert.equal(state.data.me.renameCost,0);assert.equal((await social(a,'friend_request',{name:'누군가'})).status,409);
 });
 await test('Unique names ignore case and normalized whitespace; first name free and each later change costs exactly 3000',async()=>{
  let r=await rename(a,'Alpha단장','social-first-name-0001');assert.equal(r.status,200);assert.equal(r.data.state.gems,1800);
  r=await rename(b,'alpha단장','social-duplicate-name01');assert.equal(r.status,409);assert.equal(JSON.parse(row(b).payload).gems,1800);
  assert.equal((await rename(b,'Beta단장','social-second-name001')).status,200);assert.equal((await rename(c,'Gamma단장','social-third-name0001')).status,200);
  assert.equal((await rename(a,'NewAlpha','social-poor-rename001')).status,400);
  patch(a,s=>s.gems=6000);const current=await call(a,'state'),intent={revision:current.data.revision,requestId:'social-paid-rename0001',action:{kind:'rename',name:'NewAlpha'}};
  const attempts=await Promise.all([call(a,'action',intent),call(a,'action',intent)]);for(const out of attempts){assert.equal(out.status,200);assert.equal(out.data.state.gems,3000);}assert.equal((await social(a,'state')).data.me.name,'NewAlpha');
 });
 await test('Simultaneous claims of one new name have one owner and the losing account is not charged',async()=>{
  patch(b,s=>s.gems=6000);patch(c,s=>s.gems=6000);const attempts=await Promise.all([rename(b,'유일한단장','unique-race-name-0001'),rename(c,'유일한단장','unique-race-name-0002')]);assert.deepEqual(attempts.map(r=>r.status).sort(),[200,409]);
  for(let i=0;i<2;i++)assert.equal(JSON.parse(row([b,c][i]).payload).gems,attempts[i].status===200?3000:6000);
 });
 await test('Friend requests require actual names and receiver consent, with no private account or save fields',async()=>{
  const bName=(await social(b,'state')).data.me.name;assert.equal((await social(a,'friend_request',{name:'NewAlpha'})).status,400);assert.equal((await social(a,'friend_request',{name:'모르는단장'})).status,400);
  const sent=await social(a,'friend_request',{name:bName});assert.equal(sent.status,200);assert.equal(sent.data.requests.outgoing.length,1);const req=sent.data.requests.outgoing[0].id;
  assert.equal((await social(a,'friend_accept',{id:req})).status,403);assert.equal((await social(c,'friend_accept',{id:req})).status,404);
  assert.equal((await social(b,'friend_accept',{id:req})).status,200);const state=await social(a,'state');assert.equal(state.data.friends.length,1);assert.equal(state.data.friends[0].name,bName);
  const publicJSON=JSON.stringify(state.data);for(const secret of[a.token,b.token,a.profile.id,b.profile.id,'google_key','receipts','gems','units'])assert.ok(!publicJSON.includes(secret),secret);
 });
 let invite,match;
 await test('Arena uses owned six-unit server snapshots, rejects third parties and returns one persisted replay for concurrent acceptance',async()=>{
  for(const who of[a,b])patch(who,s=>{s.team=['taeo','geonu','doyoon','osia','lava','nari'];for(const id of s.team)s.units[id]={level:60,stars:3,xp:0,shards:0};});
  const friend=(await social(a,'state')).data.friends[0];assert.equal((await social(c,'arena_invite',{id:friend.id,requestId:'forged-friend-invite1'})).status,403);
  const sent=await social(a,'arena_invite',{id:friend.id,requestId:'real-arena-invite-001',winner:0,state:{team:[]}});assert.equal(sent.status,200);invite=sent.data.invites.outgoing[0].id;
  assert.equal((await social(a,'arena_invite',{id:friend.id,requestId:'real-arena-invite-001'})).status,200);assert.equal(t.sqlite.prepare('SELECT count(*) n FROM school_arena').get().n,1);
  assert.equal((await social(a,'arena_accept',{id:invite})).status,403);assert.equal((await social(c,'arena_accept',{id:invite})).status,404);
  const before=[row(a).payload,row(b).payload];const accepts=await Promise.all([social(b,'arena_accept',{id:invite,winner:1,damage:1e99}),social(b,'arena_accept',{id:invite})]);accepts.forEach(r=>assert.equal(r.status,200));assert.deepEqual(accepts[0].data.match,accepts[1].data.match);match=accepts[0].data.match;
  assert.equal(match.teams[0].units.length,6);assert.equal(match.teams[1].units.length,6);assert.equal(match.meSide,1);assert.ok(match.events.length>10);assert.ok(match.events.some(e=>e.crit));assert.ok(match.events.some(e=>e.kind==='heal'));assert.ok(match.events.some(e=>e.kind==='shield'));assert.ok(match.events.some(e=>e.from==='osia'&&e.stage===4));
  assert.equal(row(a).payload,before[0]);assert.equal(row(b).payload,before[1]);
  const mine=await social(a,'arena_match',{id:invite});assert.equal(mine.status,200);assert.equal(mine.data.match.meSide,0);assert.deepEqual(mine.data.match.events,match.events);assert.equal((await social(c,'arena_match',{id:invite})).status,404);
  for(const event of match.events){assert.ok(event.t>=0&&event.t<=90000);assert.ok(event.hp>=0);assert.ok(event.amount>=0);}
 });
 await test('Arena replays are deterministic, damage totals reflect actual HP loss and no currency is awarded',async()=>{
  const {simulateArena}=await import('../online/arena.mjs');const saves=[JSON.parse(row(a).payload),JSON.parse(row(b).payload)];const replay=simulateArena(G,saves,match.teams.map(t=>t.name),match.seed);
  assert.deepEqual(replay.events,match.events);assert.equal(replay.winner,match.winner);assert.equal(replay.rules.rewards,false);
  for(let side=0;side<2;side++)for(const meter of match.damage[side])assert.equal(meter.damage,match.events.filter(e=>e.side===side&&e.from===meter.id&&['attack','skill'].includes(e.kind)).reduce((sum,e)=>sum+e.amount,0));
 });
 await test('Expired invites and deleted friendships cannot launch battles; forged invite time is ignored',async()=>{
  now+=60000;const friend=(await social(a,'state')).data.friends[0];let sent=await social(a,'arena_invite',{id:friend.id,requestId:'expire-arena-invite01',expiresAt:1e99});const id=sent.data.invites.outgoing[0].id;now+=120001;assert.equal((await social(b,'arena_accept',{id})).status,409);
  sent=await social(a,'arena_invite',{id:friend.id,requestId:'remove-friend-invite1'});const next=sent.data.invites.outgoing[0].id;assert.equal((await social(b,'friend_remove',{id:friend.id})).status,200);assert.equal((await social(b,'arena_accept',{id:next})).status,409);assert.equal((await social(a,'state')).data.friends.length,0);
 });
 await test('Concurrent friend requests cannot exceed either participant’s 100-entry limit',async()=>{
  const aid=a.profile.id;
  for(let i=0;i<99;i++)t.sqlite.prepare('INSERT INTO accounts(id,google_key,created_at) VALUES(?,?,?)').run('limit-peer-'+i,'limit-google-'+i,now);
  const fill=()=>{
   t.sqlite.prepare('DELETE FROM school_friends WHERE requester = ? OR target = ?').run(aid,aid);
   for(let i=0;i<99;i++){const peer='limit-peer-'+i;t.sqlite.prepare("INSERT INTO school_friends(id,pair_key,requester,target,status,created_at) VALUES(?,?,?,?,'accepted',?)").run('limit-edge-'+i,[aid,peer].sort().join(':'),aid,peer,now);}
  };
  const count=()=>t.sqlite.prepare('SELECT COUNT(*) n FROM school_friends WHERE requester = ? OR target = ?').get(aid,aid).n;
  try{
   fill();const names=await Promise.all([social(b,'state'),social(c,'state')]);
   const sent=await Promise.all(names.map(r=>social(a,'friend_request',{name:r.data.me.name})));
   assert.ok(sent.every(r=>[200,400,409].includes(r.status)));assert.equal(count(),100);
   assert.equal(t.sqlite.prepare("SELECT COUNT(*) n FROM school_friends WHERE requester = ? AND status = 'pending'").get(aid).n,1);
   fill();const received=await Promise.all([social(b,'friend_request',{name:'NewAlpha'}),social(c,'friend_request',{name:'NewAlpha'})]);
   assert.ok(received.every(r=>[200,400,409].includes(r.status)));assert.equal(count(),100);
   assert.equal(t.sqlite.prepare("SELECT COUNT(*) n FROM school_friends WHERE target = ? AND status = 'pending'").get(aid).n,1);
  }finally{
   t.sqlite.prepare('DELETE FROM school_friends WHERE requester = ? OR target = ?').run(aid,aid);
   t.sqlite.prepare('DELETE FROM accounts WHERE id LIKE ?').run('limit-peer-%');
  }
 });
 await test('Legacy duplicate display names keep progression and get a free unique replacement',async()=>{
  const old=(await t.login('social-old')).data;await call(old,'state');patch(old,s=>{s.commanderName='NewAlpha';delete s.nameChanges;s.gold=12345;s.gems=100;});const read=await call(old,'state');assert.equal(read.data.state.commanderName,'NewAlpha');assert.equal(read.data.state.nameNeedsClaim,true);assert.equal(read.data.state.nameChanges,0);const changed=await rename(old,'레거시단장','legacy-new-name-00001');assert.equal(changed.status,200);assert.equal(changed.data.state.gems,100);assert.equal(changed.data.state.gold,12345);
 });
 await test('Active accounts renew to thirty days, logout revokes the token and all social access',async()=>{
  now+=8*86400000;let me=await t.call('/api/account/me',{},a.token);assert.equal(me.status,200);assert.equal(me.data.expires,now+30*86400000);assert.equal((await t.call('/api/account/logout',{},a.token)).status,200);assert.equal((await social(a,'state')).status,401);
 });
 console.log(`${passed} school social/arena checks passed`);
 }finally{Date.now=realNow;t.sqlite.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
