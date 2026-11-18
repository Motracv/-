const assert=require('node:assert/strict'),G=require('../school/engine.js'),{fixture}=require('./account-fixture.cjs');
(async()=>{const t=await fixture(),{collectYetiRewards:collect}=await import('../online/yeti.mjs'),nativeNow=Date.now;const now=Date.parse('2026-11-19T01:00:00+09:00');Date.now=()=>now;
try{
 const p=(await t.login('automatic-yeti')).data,id=p.profile.id;
 const call=(path,data={})=>t.call('/api/school/'+path,{catalogVersion:G.CATALOG_VERSION,...data},null,{'X-Account-Session':p.token});
 assert.equal((await call('state')).status,200);
 const row=()=>t.sqlite.prepare('SELECT * FROM school_saves WHERE account_id=?').get(id),save=()=>JSON.parse(row().payload);
 const award=(name,men=1)=>t.sqlite.prepare('INSERT INTO school_yeti_rewards(account_id,room_id,snowflakes,snowmen,created_at) VALUES(?,?,?,?,?)').run(id,name,35,men,now);
 const claimed=name=>t.sqlite.prepare('SELECT claimed FROM school_yeti_rewards WHERE account_id=? AND room_id=?').get(id,name).claimed;
 async function race(fn){const batch=t.db.batch.bind(t.db);let n=0,release;const gate=new Promise(r=>release=r);t.db.batch=async sql=>{if(n<2){if(++n===2)release();await gate;}return batch(sql);};try{return await fn();}finally{t.db.batch=batch;}}
 award('parallel');const before=save();const payouts=await race(()=>Promise.all([collect(t.db,G,id,now),collect(t.db,G,id,now)]));
 assert.equal(payouts.flat().length,1);assert.equal(save().winter.snowflakes,before.winter.snowflakes+35);assert.equal(save().winter.snowmen,1);assert.equal(claimed('parallel'),1);assert(G.validate(save()));
 console.log('PASS simultaneous auto collectors: one payout and valid save');
 award('rollback');const preRollback=row().payload;
 t.sqlite.exec("CREATE TRIGGER fail_yeti_claim BEFORE UPDATE ON school_yeti_rewards WHEN NEW.room_id='rollback' BEGIN SELECT RAISE(ABORT,'simulated acknowledgement failure'); END;");
 await assert.rejects(collect(t.db,G,id,now),/acknowledgement failure/);assert.equal(row().payload,preRollback);assert.equal(claimed('rollback'),0);
 t.sqlite.exec('DROP TRIGGER fail_yeti_claim');assert.equal((await call('state')).status,200);assert.equal(claimed('rollback'),1);assert.equal(save().winter.snowmen,2);
 console.log('PASS payout/receipt rollback together; login retries pending reward');
 award('lost-response');const original=t.db.batch.bind(t.db);let lost=false;t.db.batch=async sql=>{const r=await original(sql);if(!lost){lost=true;throw Error('response lost after commit');}return r;};
 try{await assert.rejects(collect(t.db,G,id,now),/response lost/);}finally{t.db.batch=original;}
 assert.equal(claimed('lost-response'),1);const afterLoss=save().winter.snowflakes;await collect(t.db,G,id,now);assert.equal(save().winter.snowflakes,afterLoss);assert.equal(save().winter.snowmen,3);
 console.log('PASS lost successful response cannot grant twice');
 award('old-manual-race',0);const revision=row().revision,oldFlakes=save().winter.snowflakes;
 const results=await race(()=>Promise.all([collect(t.db,G,id,now),call('action',{revision,requestId:crypto.randomUUID(),action:{kind:'yeti-claim',roomId:'old-manual-race'}})]));
 assert([200,400,409].includes(results[1].status));assert.equal(claimed('old-manual-race'),1);assert.equal(save().winter.snowflakes,oldFlakes+35);assert.equal(save().winter.snowmen,3);
 console.log('PASS old manual client racing automatic payout cannot duplicate reward');
 award('save-conflict');const oldGold=save().gold,oldRev=row().revision;let conflict=false;
 t.db.batch=async sql=>{if(!conflict){conflict=true;t.sqlite.prepare("UPDATE school_saves SET payload=json_set(payload,'$.gold',?),revision=revision+1 WHERE account_id=?").run(oldGold+123,id);}return original(sql);};
 try{await collect(t.db,G,id,now);}finally{t.db.batch=original;}
 assert.equal(save().gold,oldGold+123);assert.equal(row().revision,oldRev+2);assert.equal(claimed('save-conflict'),1);assert.equal(save().winter.snowmen,4);
 console.log('PASS revision retry preserves concurrent currency changes');
 // D1 binds are bounded; a large historical backlog drains over state syncs.
 for(let i=0;i<65;i++)award('backlog-'+i,0);const balance=save().winter.snowflakes;
 for(let i=0;i<3;i++)assert.equal((await call('state')).status,200);
 assert.equal(save().winter.snowflakes,balance+65*35);assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM school_yeti_rewards WHERE claimed=0').get().n,0);assert.equal(save().winter.snowmen,4);
 console.log('PASS historical backlog drains automatically without inventing snowmen');
}finally{Date.now=nativeNow;t.sqlite.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
