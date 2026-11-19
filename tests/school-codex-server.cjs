const assert=require('node:assert/strict'),{fixture}=require('./account-fixture.cjs'),G=require('../school/engine.js');
(async()=>{const t=await fixture(),native=Date.now;Date.now=()=>Date.parse('2026-11-19T10:00:00Z');try{
 if(process.env.SCHOOL_TEST_BUNDLE){const w=(await import(require('node:url').pathToFileURL(process.env.SCHOOL_TEST_BUNDLE).href)).default,original=t.call;t.call=async(route,data={},token,headers={})=>{if(!route.startsWith('/api/school/'))return original(route,data,token,headers);const r=await w.fetch(new Request('https://card.example'+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://motracv.github.io',...headers},body:JSON.stringify(data)}),t.env);return{status:r.status,data:await r.json()};};}
 const a=(await t.login('codex-a')).data,b=(await t.login('codex-b')).data;
 const call=(who,route,data={})=>t.call('/api/school/'+route,{catalogVersion:G.CATALOG_VERSION,...data},null,who?{'X-Account-Session':who.token}:{});
 const row=who=>t.sqlite.prepare('SELECT * FROM school_saves WHERE account_id=?').get(who.profile.id),saved=who=>JSON.parse(row(who).payload);
 const input=(who,hero)=>({revision:row(who).revision,requestId:crypto.randomUUID(),action:{kind:'codex-claim',hero,gems:1e9}});
 await call(a,'state');await call(b,'state');const before=saved(a).gems;
 assert.equal((await call(null,'action',input(a,'taeo'))).status,401);
 assert.equal((await call(a,'action',input(a,'osia'))).status,400);
 const claim=input(a,'taeo'),results=await Promise.all([call(a,'action',claim),call(a,'action',claim)]);results.forEach(r=>assert.equal(r.status,200));assert.equal(saved(a).gems,before+100);
 assert.equal((await call(a,'action',input(a,'taeo'))).status,400);assert.equal(saved(b).gems,before);
 const relog=(await t.login('codex-a')).data,restored=await call(relog,'state');assert.deepEqual(restored.data.state.codexClaimed,['taeo']);
 const left=input(a,'harin'),right=input(a,'harin');await Promise.all([call(a,'action',left),call(a,'action',right)]);assert.equal(saved(a).gems,before+200);
 assert.equal((await call(a,'state',{catalogVersion:32})).status,426);assert(G.validate(saved(a)));
 console.log('PASS server authentication, duplicate/concurrent claims once, account isolation, relog and outdated catalog rejection');
 }finally{Date.now=native;t.sqlite.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
