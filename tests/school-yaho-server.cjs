const assert=require('node:assert/strict'),G=require('../school/engine.js');
(async()=>{const{fixture}=require('./account-fixture.cjs'),t=await fixture();try{
 if(process.env.SCHOOL_TEST_BUNDLE){const w=(await import(require('node:url').pathToFileURL(process.env.SCHOOL_TEST_BUNDLE).href)).default,original=t.call;t.call=async(route,data={},token,headers={})=>{if(!route.startsWith('/api/school/'))return original(route,data,token,headers);const r=await w.fetch(new Request('https://card.example'+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://motracv.github.io',...headers},body:JSON.stringify(data)}),t.env);return{status:r.status,data:await r.json()};};}
 const a=(await t.login('yaho-owner')).data,call=(route,data={})=>t.call('/api/school/'+route,{catalogVersion:G.CATALOG_VERSION,...data},null,{'X-Account-Session':a.token});
 await call('state');const row=()=>t.sqlite.prepare('SELECT * FROM school_saves WHERE account_id=?').get(a.profile.id),save=JSON.parse(row().payload);
 save.gems=10000;save.banners.horas={pity:42,guaranteed:false};save.banners.yaho={pity:79,guaranteed:true};t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(save),a.profile.id);
 const before=row(),input={revision:before.revision,requestId:crypto.randomUUID(),action:{kind:'recruit',banner:'yaho',count:1,cost:0,pity:79,guaranteed:true}},responses=await Promise.all([call('action',input),call('action',input)]);
 assert(responses.every(r=>r.status===200));assert(responses.every(r=>r.data.result.results[0].id==='yaho'));
 const after=JSON.parse(row().payload);assert.equal(after.gems,9900);assert.equal(after.banners.horas.pity,42);assert.equal(after.banners.yaho.pity,0);assert.equal(after.units.yaho.shards,0);
 const formed=await call('action',{revision:row().revision,requestId:crypto.randomUUID(),action:{kind:'team',team:['yaho','taeo','sua']}});assert.equal(formed.status,200);assert(formed.data.state.battle.heroes.some(u=>u.id==='yaho'));assert(G.validate(JSON.parse(row().payload)));
 const bad=await call('action',{revision:row().revision,requestId:crypto.randomUUID(),action:{kind:'recruit',banner:'yaho',count:-1}});assert.equal(bad.status,400);assert.equal((await call('state',{catalogVersion:35})).status,426);
 console.log('PASS authenticated pickup-only SSR recruit, idempotent simultaneous request, server pricing/pity, formation persistence, invalid draw and stale-client rejection');
 }finally{t.sqlite.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
