const assert=require('node:assert/strict'),G=require('../school/engine.js'),{createHash}=require('node:crypto');
const cutoff=Date.parse('2026-11-20T10:38:23Z'),keep=['야호업데이트','게임을즐겨주신여러분께감사합니다'];
assert.deepEqual(Object.entries(G.COUPONS).filter(([,c])=>c.expiresAt===null||c.expiresAt>cutoff).map(([k])=>k),keep);
(async()=>{const {fixture}=require('./account-fixture.cjs'),t=await fixture(),native=Date.now;let now=cutoff-1;Date.now=()=>now;try{
 const who=(await t.login('retire-codes')).data,headers={'X-Account-Session':who.token},call=(route,data={})=>t.call('/api/school/'+route,{catalogVersion:G.CATALOG_VERSION,...data},null,headers);await call('state');
 const row=()=>t.sqlite.prepare('SELECT * FROM school_saves WHERE account_id=?').get(who.profile.id),save=()=>JSON.parse(row().payload),redeem=code=>({revision:row().revision,requestId:crypto.randomUUID(),action:{kind:'redeem',code}});
 const old=redeem('NEWNAME');assert.equal((await call('action',old)).status,200);const before=save();now=cutoff;
 assert.equal((await call('action',old)).status,200,'committed response remains recoverable');assert.equal(save().nameChangeTickets,before.nameChangeTickets);
 for(const code of Object.keys(G.COUPONS).filter(k=>!keep.includes(k))){const snap=row();const r=await call('action',redeem(code));assert.equal(r.status,400,code);assert.equal(row().payload,snap.payload,code);assert.equal(row().revision,snap.revision);}
 const fixtureCode='TEST_RETIRED_SECRET',hash=createHash('sha256').update(fixtureCode).digest('hex');for(const key of ['PRIVATE_RANK_REWARD_HASH','PRIVATE_RANK_NTR_REWARD_HASH','PRIVATE_AZURE_CROWN_HASH','PRIVATE_HORAS_SKIN_HASH']){t.env[key]=hash;const snap=row();assert.equal((await call('action',redeem(fixtureCode))).status,400,key);assert.equal(row().payload,snap.payload);delete t.env[key];}
 t.env.PRIVATE_APOLOGY_HASH=createHash('sha256').update('TEST_ACTIVE_APOLOGY').digest('hex');const initial=save();for(const code of [...keep,'TEST_ACTIVE_APOLOGY']){assert.equal((await call('action',redeem(code))).status,200,code);assert.equal((await call('action',redeem(code))).status,400,'account once');}
 assert.equal(save().gems,initial.gems+4800);assert.equal(save().winter.snowflakes,initial.winter.snowflakes+100);assert.equal(save().nameChangeTickets,before.nameChangeTickets);assert(G.validate(save()));
 console.log('PASS only 3 recent rewards active; all earlier public/private codes reject atomically; old rewards/tickets and committed retries preserved; active codes account-once');
}finally{Date.now=native;t.sqlite.close();}})().catch(e=>{console.error(e);process.exitCode=1});
