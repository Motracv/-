const assert=require('node:assert/strict'),G=require('../school/engine.js'),{fixture}=require('./account-fixture.cjs');
(async()=>{const t=await fixture(),native=Date.now;let now=Date.parse('2026-11-19T03:00:00+09:00');Date.now=()=>now;
try{
 if(process.env.SCHOOL_TEST_BUNDLE){const w=(await import(require('node:url').pathToFileURL(process.env.SCHOOL_TEST_BUNDLE).href)).default,original=t.call;t.call=async(path,data={},token,headers={})=>{if(!path.startsWith('/api/school/'))return original(path,data,token,headers);const r=await w.fetch(new Request('https://card.example'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://motracv.github.io',...headers},body:JSON.stringify(data)}),t.env);return{status:r.status,data:await r.json()};};}
 const call=(p,path,data={})=>t.call('/api/school/'+path,{catalogVersion:G.CATALOG_VERSION,...data},null,p?{'X-Account-Session':p.token}:{});
 const cmd=(p,path,kind,data={})=>call(p,path,{kind,requestId:crypto.randomUUID(),...data});
 const users=[];for(let i=0;i<4;i++){const p=(await t.login('coop-'+i)).data;await call(p,'state');const s=G.create(now,42);s.captain.level=10;s.commanderName='초대단장'+i;s.gold=100000;s.gems=100000;s.units.osia={level:70,stars:2,xp:0,shards:0};s.team=['osia','taeo','sua'];t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(s),p.profile.id);await call(p,'state');users.push(p);}
 const [a,b,c,d]=users;
 const friend=(x,y)=>t.sqlite.prepare("INSERT OR IGNORE INTO school_friends(id,pair_key,requester,target,status,created_at) VALUES(?,?,?,?,'accepted',?)").run(crypto.randomUUID(),[x.profile.id,y.profile.id].sort().join(':'),x.profile.id,y.profile.id,now);
 friend(a,b);friend(a,c);friend(b,c);
 const room=id=>JSON.parse(t.sqlite.prepare('SELECT payload FROM school_yeti_rooms WHERE id=?').get(id).payload);
 const invite=(p,q,mode,id,extra={})=>cmd(p,'coop','invite',{mode,roomId:id,targetId:q.profile.id,...extra});
 const accept=(p,id)=>cmd(p,'coop','accept',{inviteId:id});
 const leave=(p,id)=>cmd(p,'yeti','leave',{roomId:id});
 assert.equal((await call(null,'coop',{kind:'state'})).status,401);assert.equal((await call(a,'coop',{kind:'state',catalogVersion:1})).status,426);
 let r=await cmd(a,'yeti','create'),id=r.data.room.id;
 await cmd(b,'coop','state');r=await cmd(a,'coop','candidates',{mode:'yeti',roomId:id});assert.equal(r.status,200);assert(r.data.candidates.some(x=>x.id===b.profile.id&&x.online));assert(!r.data.candidates.some(x=>x.id===d.profile.id));assert(!JSON.stringify(r.data).includes('receipts'));assert(!JSON.stringify(r.data).includes('equipment'));
 // Presence is per window: backgrounding one window cannot hide another active one.
 t.sqlite.prepare('DELETE FROM school_coop_presence WHERE account_id=?').run(b.profile.id);
 const one=crypto.randomUUID(),two=crypto.randomUUID(),presence=()=>cmd(a,'coop','candidates',{mode:'yeti',roomId:id});
 await cmd(b,'coop','state',{clientId:one});assert((await presence()).data.candidates.find(x=>x.id===b.profile.id).online);
 await cmd(b,'coop','state',{clientId:two});await cmd(b,'coop','presence',{clientId:one,online:false});assert((await presence()).data.candidates.find(x=>x.id===b.profile.id).online);
 await cmd(b,'coop','presence',{clientId:two,online:false});assert(!(await presence()).data.candidates.find(x=>x.id===b.profile.id).online);
 await cmd(b,'coop','state',{clientId:one});now+=16000;assert(!(await presence()).data.candidates.find(x=>x.id===b.profile.id).online,'disconnected windows expire');await cmd(b,'coop','state',{clientId:one});assert((await presence()).data.candidates.find(x=>x.id===b.profile.id).online);
 assert.equal((await cmd(b,'coop','state',{clientId:'invalid'})).status,400);await cmd(c,'coop','state',{clientId:crypto.randomUUID()});
 console.log('PASS per-window online/offline presence, immediate background departure, remaining active window, timeout and reconnect');
 assert.equal((await invite(d,b,'yeti',id)).status,409);assert.equal((await invite(a,d,'yeti',id)).status,403);
 const requestId=crypto.randomUUID();const sends=await Promise.all([invite(a,b,'yeti',id,{requestId}),invite(a,b,'yeti',id,{requestId})]);assert(sends.every(x=>x.status===200));assert.equal(sends[0].data.id,sends[1].data.id);let invitation=sends[0].data.id;
 r=await cmd(b,'coop','state');assert.equal(r.data.incoming.length,1);assert.equal(r.data.incoming[0].name,'초대단장0');assert.equal((await accept(d,invitation)).status,404);
 await cmd(b,'coop','decline',{inviteId:invitation});assert.equal((await cmd(b,'coop','state')).data.incoming.length,0);assert.equal((await accept(b,invitation)).status,409);assert.equal((await invite(a,b,'yeti',id)).status,429);
 now+=16000;r=await invite(a,b,'yeti',id);assert.equal(r.status,200);invitation=r.data.id;now+=121000;assert.equal((await cmd(b,'coop','state')).data.incoming.length,0);assert.equal((await accept(b,invitation)).status,409);await leave(a,id);
 console.log('PASS authenticated friend/guild candidates, online presence, privacy, duplicate send, decline, cooldown and expiry');
 r=await cmd(a,'yeti','create');id=r.data.room.id;const ib=(await invite(a,b,'yeti',id)).data.id,ic=(await invite(a,c,'yeti',id)).data.id;
 const accepts=await Promise.all([accept(b,ib),accept(c,ic)]);assert.equal(accepts.filter(x=>x.status===200).length,1);assert.equal(accepts.filter(x=>x.status===409).length,1);assert.equal(room(id).members.length,2);
 const win=accepts[0].status===200?b:c,winId=win===b?ib:ic;assert.equal((await accept(win,winId)).data.repeated,true);assert.equal(room(id).members.length,2);assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM school_raid_days').get().n,0);
 await cmd(a,'yeti','ready',{roomId:id});await cmd(win,'yeti','ready',{roomId:id});assert.equal((await cmd(a,'yeti','start',{roomId:id})).status,200);assert.equal((await cmd(win===b?c:b,'coop','state')).data.incoming.length,0);assert.equal((await accept(win,winId)).status,200);await leave(a,id);
 console.log('PASS simultaneous acceptance respects two-player capacity, duplicate acceptance and started-room invalidation');
 now+=16000;r=await cmd(a,'yeti','create');id=r.data.room.id;invitation=(await invite(a,b,'yeti',id)).data.id;
 t.sqlite.exec(`CREATE TRIGGER lose_accept_response BEFORE UPDATE ON school_coop_invites WHEN NEW.id='${invitation}' AND NEW.status='accepted' BEGIN SELECT RAISE(ABORT,'lost acknowledgement'); END;`);
 assert.equal((await accept(b,invitation)).status,503);assert(room(id).members.some(x=>x.account===b.profile.id));t.sqlite.exec('DROP TRIGGER lose_accept_response');assert.equal((await accept(b,invitation)).status,200);assert.equal(room(id).members.length,2);assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM school_coop_accepts').get().n,0);await leave(b,id);await leave(a,id);
 console.log('PASS join committed before response failure recovers without a second join or lingering lock');
 now+=16000;r=await cmd(a,'yeti','create');id=r.data.room.id;invitation=(await invite(a,c,'yeti',id)).data.id;t.sqlite.prepare('DELETE FROM school_friends WHERE pair_key=?').run([a.profile.id,c.profile.id].sort().join(':'));assert.equal((await accept(c,invitation)).status,409);assert.equal((await cmd(c,'coop','state')).data.incoming.length,0);await leave(a,id);
 // Set up an actual guild through its public API.
 r=await cmd(a,'guild','create',{name:'협동초대반',emblem:0});assert.equal(r.status,200);const gid=r.data.guild.id;
 await cmd(a,'guild','invite',{guildId:gid,name:'초대단장1'});r=await cmd(b,'guild','state');assert.equal((await cmd(b,'guild','accept',{inviteId:r.data.invites[0].id})).status,200);
 let raid=await cmd(a,'raid','create');const raidId=raid.data.room.id;assert.equal((await invite(a,c,'raid',raidId)).status,403);
 now+=16000;const raidInvite=(await invite(a,b,'raid',raidId)).data.id;
 r=await cmd(c,'yeti','create');const competing=r.data.room.id;const otherInvite=(await invite(c,b,'yeti',competing)).data.id;
 const cross=await Promise.all([accept(b,raidInvite),accept(b,otherInvite)]);assert.equal(cross.filter(x=>x.status===200).length,1,JSON.stringify(cross));assert.equal(cross.filter(x=>x.status===409).length,1);
 if(cross[1].status===200){await leave(b,competing);await leave(c,competing);assert.equal((await accept(b,raidInvite)).status,200);}else await leave(c,competing);
 assert.equal((await cmd(b,'raid','state')).data.remaining,5);assert.equal((await accept(b,raidInvite)).status,200);
 await cmd(a,'raid','ready',{roomId:raidId});await cmd(b,'raid','ready',{roomId:raidId});assert.equal((await cmd(a,'raid','start',{roomId:raidId})).status,200);assert.equal((await cmd(b,'raid','state')).data.remaining,4);
 console.log('PASS revoked friendship, guild-only raid invitations, cross-mode accept locking; entry spent only at explicit start');
 t.sqlite.prepare('DELETE FROM accounts WHERE id=?').run(c.profile.id);assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM school_coop_invites WHERE sender=? OR target=?').get(c.profile.id,c.profile.id).n,0);assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM school_coop_presence WHERE account_id=?').get(c.profile.id).n,0);
 assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM school_coop_sessions WHERE account_id=?').get(c.profile.id).n,0);
 console.log('PASS deleted accounts leave no invitations or presence');
}finally{Date.now=native;t.sqlite.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
