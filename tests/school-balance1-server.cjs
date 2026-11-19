const assert=require('node:assert/strict'),G=require('../school/engine.js');
(async()=>{const{fixture}=require('./account-fixture.cjs'),t=await fixture();try{
 if(process.env.SCHOOL_TEST_BUNDLE){const w=(await import(require('node:url').pathToFileURL(process.env.SCHOOL_TEST_BUNDLE).href)).default,original=t.call;t.call=async(route,data={},token,headers={})=>{if(!route.startsWith('/api/school/'))return original(route,data,token,headers);const r=await w.fetch(new Request('https://card.example'+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://motracv.github.io',...headers},body:JSON.stringify(data)}),t.env);return{status:r.status,data:await r.json()};};}
 const a=(await t.login('balance-owner')).data,b=(await t.login('balance-other')).data;
 const call=(who,route,data={})=>t.call('/api/school/'+route,{catalogVersion:G.CATALOG_VERSION,...data},null,{'X-Account-Session':who.token});
 const row=who=>t.sqlite.prepare('SELECT * FROM school_saves WHERE account_id=?').get(who.profile.id),saved=who=>JSON.parse(row(who).payload);
 await call(a,'state');await call(b,'state');
 for(const[code,gems,gold,snow]of[['HYEOKJIN_UPDATE',3000,30000,0],['BALANCE_PATCH_REWARD',3000,50000,0],['WEEKEND_GIFT',1000,0,100]]){
  const before=saved(a),body={revision:row(a).revision,requestId:crypto.randomUUID(),action:{kind:'redeem',code:code.toLowerCase(),gems:1e9,gold:1e9,snowflakes:1e9}};
  const repeats=await Promise.all([call(a,'action',body),call(a,'action',body),call(a,'action',body)]);assert(repeats.every(r=>r.status===200));
  const after=saved(a);assert.equal(after.gems-before.gems,gems);assert.equal(after.gold-before.gold,gold);assert.equal(after.winter.snowflakes-before.winter.snowflakes,snow);assert.equal(after.redeemedCodes.filter(c=>c===code).length,1);
  const duplicate=await call(a,'action',{...body,revision:row(a).revision,requestId:crypto.randomUUID()});assert.equal(duplicate.status,400);assert.equal(saved(a).gems,after.gems);assert.equal(saved(a).gold,after.gold);assert.equal(saved(a).winter.snowflakes,after.winter.snowflakes);
  const otherBefore=saved(b),other=await call(b,'action',{...body,revision:row(b).revision,requestId:crypto.randomUUID()});assert.equal(other.status,200);assert.equal(saved(b).gems-otherBefore.gems,gems);
 }
 assert.equal((await call(a,'state',{catalogVersion:G.CATALOG_VERSION-1})).status,426);
 console.log('PASS all three exact coupon rewards, lowercase input, forged rewards ignored, retry idempotency, one use per account, independent accounts and stale-client rejection');
}finally{t.sqlite.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
