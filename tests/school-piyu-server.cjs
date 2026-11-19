const assert=require('node:assert/strict'),G=require('../school/engine.js'),{fixture}=require('./account-fixture.cjs');
(async()=>{
 const t=await fixture(),who=(await t.login('piyu-guide-account')).data,other=(await t.login('piyu-second')).data;
 const call=(route,data={},user=who)=>t.call('/api/school/'+route,{catalogVersion:G.CATALOG_VERSION,...data},null,{'X-Account-Session':user.token});
 assert.equal((await t.call('/api/school/state',{catalogVersion:G.CATALOG_VERSION})).status,401);
 let res=await call('state');assert.equal(res.status,200);assert.equal(res.data.state.onboarding.step,0);
 const money=[res.data.state.gold,res.data.state.gems,res.data.state.pulls];
 const input={revision:res.data.revision,requestId:'piyu-tutorial-progress-0001',action:{kind:'onboarding',step:4,gems:999999}};
 const pair=await Promise.all([call('action',input),call('action',input)]);for(const r of pair){assert.equal(r.status,200);assert.equal(r.data.state.onboarding.step,4);assert.deepEqual([r.data.state.gold,r.data.state.gems,r.data.state.pulls],money);}
 let seq=0;
 const action=async(a,user=who)=>{const state=await call('state',{},user);return call('action',{revision:state.data.revision,requestId:'piyu-tutorial-action-'+String(++seq).padStart(4,'0'),action:a},user);};
 assert.equal((await action({kind:'onboarding',step:8})).status,400,'name cannot be skipped');
 assert.equal((await action({kind:'rename',name:'삐유단장'})).status,200);
 assert.equal((await action({kind:'rename',name:'삐유단장'},other)).status,409,'duplicate names rejected');
 assert.equal((await action({kind:'rename',name:'다른단장'},other)).status,200,'retry a different name');
 assert.equal((await action({kind:'onboarding',step:8})).status,200);
 res=await call('state');assert.equal(res.data.state.onboarding.step,8);assert(G.validate({...res.data.state,receipts:[]}));
 assert.equal((await action({kind:'onboarding',step:9})).status,400);
 const row=t.sqlite.prepare('SELECT payload FROM school_saves WHERE account_id=?').get(other.profile.id),old=JSON.parse(row.payload);delete old.onboarding;old.gold=43210;
 t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(old),other.profile.id);
 const legacy=await call('state',{},other);assert.equal(legacy.data.state.onboarding.step,0);assert.equal(legacy.data.state.commanderName,'다른단장');assert(legacy.data.state.gold>=43210);
 console.log('PASS account API: Google required, duplicate/resumable tutorial writes, mandatory unique name, retry, old account introduction, no forged rewards');t.sqlite.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
