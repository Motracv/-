const assert=require('node:assert/strict'),G=require('../school/engine.js'),{fixture}=require('./account-fixture.cjs');
(async()=>{const t=await fixture(),nativeNow=Date.now;let now=Date.parse('2026-11-18T03:00Z');Date.now=()=>now;
try{
 if(process.env.SCHOOL_TEST_BUNDLE){const worker=(await import(require('node:url').pathToFileURL(process.env.SCHOOL_TEST_BUNDLE).href)).default,original=t.call;t.call=async(path,data={},token,headers={})=>{if(!path.startsWith('/api/school/'))return original(path,data,token,headers);const r=await worker.fetch(new Request('https://card.example'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://motracv.github.io',...headers},body:JSON.stringify(data)}),t.env);return{status:r.status,data:await r.json()};};}
 const call=(p,path,data={})=>t.call('/api/school/'+path,{catalogVersion:G.CATALOG_VERSION,...data},null,p?{'X-Account-Session':p.token}:{});
 const users=[];for(let i=0;i<2;i++){const p=(await t.login('rescue-shop-'+i)).data;await call(p,'state');users.push(p);}
 const [a,b]=users,row=p=>t.sqlite.prepare('SELECT * FROM school_saves WHERE account_id=?').get(p.profile.id),saved=p=>JSON.parse(row(p).payload);
 const act=(p,action)=>call(p,'action',{revision:row(p).revision,requestId:crypto.randomUUID(),action});
 assert.equal((await act(a,{kind:'rename',name:'공개프로필가'})).status,200);
 const s=saved(a);s.gems=10000;s.best=60;t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(s),a.profile.id);
 const purchase={revision:row(a).revision,requestId:crypto.randomUUID(),action:{kind:'shop-buy',item:'daily-coins',price:0,gold:1e15}};
 const rs=await Promise.all([call(a,'action',purchase),call(a,'action',purchase)]);assert(rs.every(r=>r.status===200));assert.equal(saved(a).gems,9940);assert.equal(saved(a).gold,s.gold+65000);assert.equal((await call(a,'action',purchase)).data.repeated,true);assert.equal((await act(a,{kind:'shop-buy',item:'daily-coins'})).status,400);
 let p=await call(null,'profile',{name:'공개프로필가'});assert.equal(p.status,200);assert.equal(p.data.name,'공개프로필가');assert.equal(p.data.team.length,3);for(const key of ['gems','gold','seed','receipts','redeemedCodes','token','email','equipment'])assert(!Object.hasOwn(p.data,key));assert(!JSON.stringify(p.data).includes(a.profile.id));assert.equal((await call(null,'profile',{name:'없는단장'})).status,404);
 console.log('PASS authoritative purchase/duplicate response/concurrent retry, public profile whitelist and missing-name lookup');
 const cmd=(p,kind,extra={})=>call(p,'yeti',{kind,requestId:crypto.randomUUID(),...extra});
 const created=await cmd(a,'create'),roomId=created.data.room.id;await cmd(b,'join',{code:created.data.room.code});await cmd(a,'ready',{roomId});await cmd(b,'ready',{roomId});await cmd(a,'start',{roomId});
 const room=()=>JSON.parse(t.sqlite.prepare('SELECT payload FROM school_yeti_rooms WHERE id=?').get(roomId).payload);
 const r=room();r.battle.teams[1].frozen={id:'ice-fixture',at:0};for(const team of r.battle.teams)for(const u of team.units)u.hp=u.max=1e8;t.sqlite.prepare('UPDATE school_yeti_rooms SET payload=? WHERE id=?').run(JSON.stringify(r),roomId);
 assert.equal((await cmd(a,'thaw',{roomId,freezeId:'ice-fixture'})).status,400);
 const started=await cmd(a,'thaw-start',{roomId,freezeId:'ice-fixture',mode:'keyboard'});assert.equal(started.status,200);const q=started.data.room.battle.teams.find(t=>t.isMe).rescue;
 assert(!(await cmd(b,'state',{roomId})).data.room.battle.teams.find(t=>!t.isMe).rescue);
 assert.equal((await cmd(a,'thaw-submit',{roomId,challengeId:q.id,inputs:['Wrong']})).status,200);assert.equal(room().battle.teams[0].rescueLockUntil,15000);assert.equal(room().battle.teams[1].frozen.id,'ice-fixture');
 await cmd(a,'thaw-submit',{roomId,challengeId:q.id,inputs:q.sequence});assert.equal(room().battle.teams[0].rescueLockUntil,15000);
 now+=15250;await cmd(a,'state',{roomId});const next=await cmd(a,'thaw-start',{roomId,freezeId:'ice-fixture',mode:'touch'});assert.equal(next.status,200);const q2=next.data.room.battle.teams.find(t=>t.isMe).rescue;now+=3000;
 assert.equal((await cmd(a,'thaw-submit',{roomId,challengeId:q2.id,inputs:[0,1,2,3]})).status,200);assert.equal(room().battle.teams[0].rescue.outcome,'failed');assert(room().battle.teams[1].frozen);
 console.log('PASS legacy thaw disabled, challenge privacy, wrong-input penalty once, 15s retry lock and server deadline');
}finally{Date.now=nativeNow;t.sqlite.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
