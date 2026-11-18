const assert=require('node:assert/strict'),G=require('../school/engine.js');
const cutoff=Date.parse('2026-11-18T22:46:56Z');
for(const [code,coupon] of Object.entries(G.COUPONS)){
 assert.equal(coupon.expiresAt,cutoff);
 for(const now of [cutoff,cutoff+1,Date.parse('2100-01-01')]){
  const s=G.create(now),before=G.clone(s);for(const name of [code,' '+code.toLowerCase()+' ']){assert.throws(()=>G.action(s,{kind:'redeem',code:name,now:0,gold:1e9,gems:1e9},now),/사용 기간이 지난/);assert.deepEqual(s,before);}
 }
}
for(const code of ['랭킹1등축하드립니다','랭킹1등축하드립니다'.normalize('NFD')]){const s=G.create(cutoff);assert.throws(()=>G.action(s,{kind:'redeem',code},cutoff),/사용 기간이 지난/);assert.equal(s.redeemedCodes.length,0);}
for(const code of ['OSIA_DEBUT','BUG_FIX','LAVA_DEBUT','THANK_YOU','MAJORUPDATE','MAJOR_UPDATE']){const s=G.create(cutoff),before=G.clone(s);assert.throws(()=>G.action(s,{kind:'redeem',code},cutoff));assert.deepEqual(s,before);}
const legacy=G.create(cutoff-1);for(const code of Object.keys(G.COUPONS))G.action(legacy,{kind:'redeem',code},cutoff-1);G.action(legacy,{kind:'profile',avatar:'rank-first'},cutoff-1);const wallet=[legacy.gold,legacy.gems],receipts=[...legacy.redeemedCodes];G.advance(legacy,cutoff+1);assert.deepEqual([legacy.gold,legacy.gems],wallet);assert.deepEqual(legacy.redeemedCodes,receipts);assert.equal(G.profileInfo(legacy).avatar,'rank-first');assert(G.validate(G.clone(legacy)));assert(G.ownsProfileAvatar(legacy,'rank-first'));
console.log('PASS all current codes expire at boundary, aliases normalize, retired codes stay disabled, rejected redemption is unchanged, prior currency/avatar entitlements survive');
(async()=>{
 const {fixture}=require('./account-fixture.cjs'),t=await fixture(),nativeNow=Date.now;let now=cutoff-1;Date.now=()=>now;
 try{
  if(process.env.SCHOOL_TEST_BUNDLE){const w=(await import(require('node:url').pathToFileURL(process.env.SCHOOL_TEST_BUNDLE).href)).default,original=t.call;t.call=async(route,data={},token,headers={})=>{if(!route.startsWith('/api/school/'))return original(route,data,token,headers);const r=await w.fetch(new Request('https://card.example'+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://motracv.github.io',...headers},body:JSON.stringify(data)}),t.env);return{status:r.status,data:await r.json()};};}
  const a=(await t.login('expired-code-owner')).data,b=(await t.login('expired-code-new')).data;
  const call=(who,route,data={})=>t.call('/api/school/'+route,{catalogVersion:G.CATALOG_VERSION,...data},null,{'X-Account-Session':who.token});
  const row=who=>t.sqlite.prepare('SELECT * FROM school_saves WHERE account_id=?').get(who.profile.id),input=(who,action)=>({revision:row(who).revision,requestId:crypto.randomUUID(),action});
  await call(a,'state');await call(b,'state');const awarded=input(a,{kind:'redeem',code:'랭킹1등축하드립니다'});assert.equal((await call(a,'action',awarded)).status,200);now=cutoff+1;
  const retry=await call(a,'action',awarded);assert.equal(retry.status,200);assert.equal(retry.data.repeated,true);assert.deepEqual(retry.data.state.redeemedCodes,['RANKING_FIRST_CONGRATS']);
  const before=row(b).payload;
  for(const code of [...Object.keys(G.COUPONS),'랭킹1등축하드립니다']){const request=input(b,{kind:'redeem',code,now:cutoff-1,gold:1e9,gems:1e9});const both=await Promise.all([call(b,'action',{...request,now:cutoff-1}),call(b,'action',request)]);both.forEach(r=>{assert.equal(r.status,400);assert(JSON.stringify(r.data).includes('사용 기간이 지난'));});assert.equal(row(b).payload,before);}
  assert.equal((await call(a,'action',input(a,{kind:'profile',avatar:'rank-first'}))).status,200);assert.equal((await call(b,'state',{catalogVersion:28})).status,426);
  console.log('PASS authoritative clock, forged past timestamp ignored, concurrent expired requests cannot pay, old receipt retry pays nothing new, owned profile still selectable, old catalog rejected');
 }finally{Date.now=nativeNow;t.sqlite.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
