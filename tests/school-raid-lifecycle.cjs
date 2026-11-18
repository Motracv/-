const assert=require('node:assert/strict'),G=require('../school/engine.js'),{fixture}=require('./account-fixture.cjs');
(async()=>{const t=await fixture(),native=Date.now;let now=Date.parse('2026-11-18T12:00:00+09:00');Date.now=()=>now;
try{
 if(process.env.SCHOOL_TEST_BUNDLE){const w=(await import(require('node:url').pathToFileURL(process.env.SCHOOL_TEST_BUNDLE).href)).default,original=t.call;t.call=async(path,data={},token,headers={})=>{if(!path.startsWith('/api/school/'))return original(path,data,token,headers);const r=await w.fetch(new Request('https://card.example'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://motracv.github.io',...headers},body:JSON.stringify(data)}),t.env);return{status:r.status,data:await r.json()};};}
 const call=(p,path,body={})=>t.call('/api/school/'+path,{catalogVersion:G.CATALOG_VERSION,...body},null,{'X-Account-Session':p.token});
 const cmd=(p,kind,roomId,extra={})=>call(p,'raid',{kind,roomId,requestId:crypto.randomUUID(),...extra});
 const guild=(p,kind,extra={})=>call(p,'guild',{kind,requestId:crypto.randomUUID(),...extra});
 async function race(fn){const original=t.db.batch.bind(t.db);let n=0,release;const gate=new Promise(r=>release=r);t.db.batch=async sql=>{if(n<2){if(++n===2)release();await gate;}return original(sql);};try{return await fn();}finally{t.db.batch=original;}}
 const users=[];for(let i=0;i<2;i++){const p=(await t.login('race-'+i)).data,s=G.create(now);s.commanderName='협동검사'+i;s.team=['horas','osia','lumi','lava','ryusion','nari'];for(const id of s.team)s.units[id]={level:100,stars:5,xp:0,shards:0};if(!i){s.redeemedCodes=['RANKING_FIRST_CONGRATS'];s.profile.avatar='rank-first';}t.sqlite.prepare('INSERT INTO school_saves(account_id,payload,revision,updated_at) VALUES(?,?,0,?)').run(p.profile.id,JSON.stringify(s),now);assert.equal((await call(p,'social',{kind:'state'})).status,200);users.push(p);}
 const [a,b]=users;
 for(const p of users)t.sqlite.prepare("UPDATE school_saves SET payload=json_set(payload,'$.activities.towerBest',1) WHERE account_id=?").run(p.profile.id);
 for(const mode of ['level','tower']){const board=await call(a,'rankings',{mode});assert.equal(board.status,200);assert.equal(board.data.entries.find(p=>p.name==='협동검사0').avatar,'rank-first');assert.equal(board.data.me.avatar,'rank-first');assert(!JSON.stringify(board.data).includes('redeemedCodes'));}
 let season=await call(a,'social',{kind:'season_state'});assert.equal(season.status,200);
 for(const p of users)assert.equal((await call(p,'social',{kind:'season_register',seasonId:season.data.season.id})).status,200);
 season=await call(b,'social',{kind:'season_state'});assert.equal(season.data.rankings.find(p=>p.name==='협동검사0').avatar,'rank-first');
 const legacy=t.sqlite.prepare('SELECT payload FROM school_saves WHERE account_id=?').get(a.profile.id).payload;t.sqlite.prepare("UPDATE school_saves SET payload='invalid legacy JSON' WHERE account_id=?").run(a.profile.id);
 const fallback=await call(b,'social',{kind:'season_state'});assert.equal(fallback.status,200);assert.equal(fallback.data.rankings.find(p=>p.name==='협동검사0').avatar,'leader');t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(legacy,a.profile.id);
 console.log('PASS selected profile on level/tower/season rankings, private receipts excluded and malformed legacy fallback');
 const created=await guild(a,'create',{name:'협동검증반',emblem:0});assert.equal(created.status,200);const gid=created.data.guild.id;
 assert.equal((await guild(a,'invite',{guildId:gid,name:'협동검사1'})).status,200);const invited=await guild(b,'state');assert.equal((await guild(b,'accept',{inviteId:invited.data.invites[0].id})).status,200);
 const raw=()=>JSON.parse(t.sqlite.prepare('SELECT payload FROM school_raids WHERE guild_id=?').get(gid).payload);
 let r=await cmd(a,'create'),id=r.data.room.id;await cmd(b,'join',id);await cmd(a,'ready',id);await cmd(b,'ready',id);
 const key=crypto.randomUUID(),starts=await race(()=>Promise.all([cmd(a,'start',id,{requestId:key}),cmd(a,'start',id,{requestId:key})]));assert(starts.every(r=>r.status===200));for(const p of users)assert.equal(t.sqlite.prepare('SELECT used FROM school_raid_days WHERE account_id=?').get(p.profile.id).used,1);
 now+=1000;const views=await race(()=>Promise.all([cmd(a,'state'),cmd(b,'state')]));assert(views.every(r=>r.status===200));const damage=raw().room.battle.damage;assert(damage>0);assert.equal(t.sqlite.prepare('SELECT SUM(damage) n FROM school_raid_scores WHERE guild_id=?').get(gid).n,damage);
 assert.equal(views[0].data.ranks.find(p=>p.name==='협동검사0').avatar,'rank-first');assert(!JSON.stringify(views[0].data.ranks).includes('redeemedCodes'));
 console.log('PASS forced stale-revision race: one entry charged and damage ledger equals actual damage, selected ranking avatar');
 const leaveKey=crypto.randomUUID();assert.equal((await cmd(a,'leave',id,{requestId:leaveKey})).status,200);assert(raw().room.battle.teams.find(p=>p.account===a.profile.id).withdrawn);assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM school_raid_slots WHERE account_id=?').get(a.profile.id).n,0);
 const ownDamage=raw().room.battle.teams.find(p=>p.account===a.profile.id).damage;now+=5000;await cmd(b,'state');assert.equal(raw().room.battle.teams.find(p=>p.account===a.profile.id).damage,ownDamage);
 now+=90000;await cmd(b,'state');assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM school_raid_rewards WHERE room_id=?').get(id).n,2);assert.equal((await cmd(a,'state')).data.remaining,4);
 r=await cmd(a,'create');const nextId=r.data.room.id;await cmd(a,'leave',id,{requestId:leaveKey});assert.equal(raw().room.id,nextId);assert(raw().room.members.some(p=>p.account===a.profile.id));
 await cmd(a,'ready',nextId);assert.equal((await cmd(a,'start',nextId)).status,200);assert.equal((await cmd(a,'state')).data.remaining,3);await cmd(a,'leave',nextId);assert.equal(raw().room.status,'finished');assert.equal((await cmd(a,'state')).data.remaining,3);
 console.log('PASS two fights spend exactly two entries; withdrawal stops own damage, preserves settlement and stale leave cannot remove new room');
 r=await cmd(a,'create');id=r.data.room.id;await cmd(b,'join',id);await cmd(b,'ready',id);await cmd(b,'leave',id);await cmd(b,'join',id);assert.equal(raw().room.members.find(p=>p.account===b.profile.id).ready,false);
 now+=121000;assert.equal((await cmd(a,'state')).data.room,null);assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM school_raid_slots WHERE guild_id=?').get(gid).n,0);
 r=await cmd(a,'create');id=r.data.room.id;await cmd(b,'join',id);await cmd(a,'ready',id);await cmd(b,'ready',id);await cmd(a,'start',id);now+=1000;await cmd(b,'leave',id);t.sqlite.prepare('DELETE FROM accounts WHERE id=?').run(b.profile.id);assert(!JSON.stringify(raw()).includes(b.profile.id));now+=91000;assert.equal((await cmd(a,'state')).status,200);
 console.log('PASS leaving clears readiness, stale presence cannot revive a room, withdrawn account deletion settles without foreign-key failure');
}finally{Date.now=native;t.sqlite.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
