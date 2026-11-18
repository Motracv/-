const assert=require('node:assert/strict'),G=require('../school/engine.js'),{fixture}=require('./account-fixture.cjs');
(async()=>{const t=await fixture();let now=Date.parse('2026-11-16T12:00:00+09:00');const native=Date.now;Date.now=()=>now;
try{
 if(process.env.SCHOOL_TEST_BUNDLE){const compiled=(await import(require('node:url').pathToFileURL(process.env.SCHOOL_TEST_BUNDLE).href)).default,original=t.call;t.call=async(route,data={},token,headers={})=>{if(!route.startsWith('/api/school/'))return original(route,data,token,headers);const r=await compiled.fetch(new Request('https://card.example'+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://motracv.github.io',...headers},body:JSON.stringify(data)}),t.env);return{status:r.status,data:await r.json()};};}
 const request=(who,path,data={})=>t.call('/api/school/'+path,{catalogVersion:G.CATALOG_VERSION,...data},null,{'X-Account-Session':who.token});
 const guild=(who,kind,more={})=>request(who,'guild',{kind,requestId:crypto.randomUUID(),...more});
 const raid=(who,kind,more={})=>request(who,'raid',{kind,requestId:crypto.randomUUID(),...more});
 const players=[];for(let i=0;i<3;i++){const who=(await t.login('project-'+i)).data,s=G.create(now);s.commanderName='협동테스트'+i;s.team=['horas','osia','lumi','lava','ryusion','nari'];for(const id of s.team)s.units[id]={level:100,stars:5,xp:0,shards:0,nextSkill:1,basicHits:0};t.sqlite.prepare('INSERT INTO school_saves(account_id,payload,revision,updated_at) VALUES(?,?,0,?)').run(who.profile.id,JSON.stringify(s),now);await request(who,'social',{kind:'state'});players.push(who);}
 const[a,b,c]=players;const created=await guild(a,'create',{name:'공동퀘스트반',emblem:0});assert.equal(created.status,200);const gid=created.data.guild.id;
 async function invite(who){assert.equal((await guild(a,'invite',{guildId:gid,name:'협동테스트'+players.indexOf(who)})).status,200);const s=await guild(who,'state');assert.equal((await guild(who,'accept',{inviteId:s.data.invites[0].id})).status,200);}
 await invite(b);
 const action=async(who,act,id=crypto.randomUUID())=>{const state=await request(who,'state');assert.equal(state.status,200);return request(who,'action',{revision:state.data.revision,requestId:id,action:act});};
 const roomChange={guildId:gid,revision:0,decor:{theme:'moon',rug:'rose',furniture:'books'},requestId:crypto.randomUUID()};
 assert.equal((await guild(b,'furnish',roomChange)).status,403);const changes=await Promise.all([guild(a,'furnish',roomChange),guild(a,'furnish',roomChange)]);assert(changes.every(x=>x.status===200||x.status===409));let view=(await guild(a,'state')).data.guild;
 assert.equal(view.projects.room.theme,'moon');assert.equal(view.projects.room.revision,1);assert.equal((await guild(a,'furnish',roomChange)).data.guild.projects.room.revision,1);
 assert.equal((await guild(a,'furnish',{...roomChange,requestId:crypto.randomUUID()})).status,409);
 assert.equal((await guild(a,'furnish',{guildId:gid,revision:1,decor:{theme:'<script>',rug:'rose',furniture:'books'}})).status,400);
 assert.equal((await guild(a,'furnish',{guildId:gid,revision:1,decor:{theme:'winter',rug:'night',furniture:'trophy'}})).status,409);
 console.log('PASS leader-only shared decorations, stale/duplicate requests and locked trophy');
 for(let day=0;day<5;day++){now=Date.parse('2026-11-17T12:00:00+09:00')+day*86400000;for(const p of [a,b]){const id=crypto.randomUUID();assert.equal((await action(p,{kind:'guild-checkin',guildId:gid},id)).status,200);assert.equal((await action(p,{kind:'guild-checkin',guildId:gid},id)).status,200);}}
 view=(await guild(a,'state')).data.guild;assert.equal(view.projects.quests.find(q=>q.id==='attendance').value,10);assert.equal(view.projects.stars,2);assert.equal(t.sqlite.prepare('SELECT COUNT(*) AS n FROM school_guild_activity').get().n,10);
 for(let i=0;i<5;i++){let r=await raid(a,'create'),roomId=r.data.room.id;assert.equal(r.status,200);await raid(b,'join',{roomId});await raid(a,'ready',{roomId});await raid(b,'ready',{roomId});assert.equal((await raid(a,'start',{roomId})).status,200);now+=91000;const ended=await Promise.all([raid(a,'state'),raid(b,'state')]);assert(ended.every(r=>r.status===200&&r.data.room.status==='finished'));}
 view=(await guild(a,'state')).data.guild;assert.equal(view.projects.quests.find(q=>q.id==='coop').value,5);assert.equal(view.projects.stars,10);assert(view.projects.quests.every(q=>q.complete));assert.equal(t.sqlite.prepare("SELECT COUNT(*) AS n FROM school_guild_activity WHERE kind='raid'").get().n,10);
 console.log('PASS atomic attendance and raid contributions, 2-player run counts once, completion stars awarded once');
 await invite(c);const ineligible=await action(c,{kind:'guild-project-claim',guildId:gid,week:G.week(now),questId:'damage'});assert.equal(ineligible.status,400);assert.match(ineligible.data.error,/참여/);
 const before=await request(a,'state'),q=view.projects.quests.find(q=>q.id==='damage'),body={revision:before.data.revision,requestId:crypto.randomUUID(),action:{kind:'guild-project-claim',guildId:gid,week:G.week(now),questId:q.id,gems:1e12}};
 const paid=await Promise.all(Array.from({length:4},()=>request(a,'action',body)));assert(paid.every(r=>r.status===200));let after=await request(a,'state');assert.equal(after.data.state.gems,before.data.state.gems+q.gems);assert.equal(after.data.state.gold,before.data.state.gold+q.gold);
 assert.equal((await action(a,body.action)).status,400);assert.equal((await guild(a,'furnish',{guildId:gid,revision:1,decor:{theme:'winter',rug:'night',furniture:'trophy'}})).status,200);
 assert.equal((await guild(b,'state')).data.guild.projects.room.furniture,'trophy');console.log('PASS participation requirement, server-only amounts, simultaneous claim once and shared trophy unlock');
 // Leaving/disbanding must never reset an account's weekly reward ledger.
 const member=view.members.find(m=>m.id===b.profile.id);assert.equal((await guild(a,'transfer',{guildId:gid,memberId:b.profile.id,memberKey:member.memberKey})).status,200);assert.equal((await guild(a,'leave',{guildId:gid})).status,200);
 const other=await guild(a,'create',{name:'옮겨온우리반',emblem:1}),gid2=other.data.guild.id;
 t.sqlite.prepare('INSERT INTO school_guild_activity(event_key,guild_id,account_id,week,kind,reference,amount,coop,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run('fixture-hopping',gid2,a.profile.id,G.week(now),'raid','fixture',3000000,0,now);
 assert.equal((await action(a,{kind:'guild-project-claim',guildId:gid2,week:G.week(now),questId:'damage'})).status,400);
 const oldWeek=G.week(now);now=Date.parse('2026-11-23T00:00:00+09:00');view=(await guild(b,'state')).data.guild;assert(view.projects.week>oldWeek);assert(view.projects.quests.every(q=>!q.complete&&q.value===0));assert.equal(view.projects.stars,10);assert.equal(view.projects.room.furniture,'trophy');assert.equal((await action(b,{kind:'guild-project-claim',guildId:gid,week:oldWeek,questId:'damage'})).status,400);
 t.sqlite.prepare('DELETE FROM accounts WHERE id=?').run(b.profile.id);assert.equal(t.sqlite.prepare('SELECT COUNT(*) AS n FROM school_guild_activity WHERE account_id=?').get(b.profile.id).n,0);assert.equal(t.sqlite.prepare('SELECT COUNT(*) AS n FROM school_guild_project_claims WHERE account_id=?').get(b.profile.id).n,0);
 console.log('PASS no guild-hop reward farming, KST Monday reset with permanent cosmetics, account deletion');
}finally{Date.now=native;t.sqlite.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
