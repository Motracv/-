const assert=require('node:assert/strict'),G=require('../school/engine.js');
const {fixture}=require('./account-fixture.cjs');
(async()=>{
 const t=await fixture(),realNow=Date.now,realRandom=crypto.getRandomValues;let now=Date.parse('2026-11-18T08:00:00Z'),serial=0;
 Date.now=()=>now;
 const compiled=process.env.SCHOOL_TEST_BUNDLE?(await import(require('node:url').pathToFileURL(process.env.SCHOOL_TEST_BUNDLE).href)).default:null;
 const call=async(who,route,data={})=>{const body={catalogVersion:G.CATALOG_VERSION,...data};if(!compiled)return t.call('/api/school/'+route,body,null,who?{'X-Account-Session':who.token}:{});const r=await compiled.fetch(new Request('https://card.example/api/school/'+route,{method:'POST',headers:{Origin:'https://motracv.github.io','Content-Type':'application/json',...(who?{'X-Account-Session':who.token}:{})},body:JSON.stringify(body)}),t.env);return{status:r.status,data:await r.json()};};
 const row=a=>t.sqlite.prepare('SELECT * FROM school_saves WHERE account_id=?').get(a.profile.id),saved=a=>JSON.parse(row(a).payload);
 const patch=(a,fn)=>{const s=saved(a);fn(s);assert(G.validate(s));t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(s),a.profile.id);};
 const intent=(a,action)=>({revision:row(a).revision,requestId:'ryusion-test-'+String(++serial).padStart(8,'0'),action});
 const act=(a,action)=>call(a,'action',intent(a,action));
 try{
  const a=(await t.login('ryusion-account-a')).data,b=(await t.login('ryusion-account-b')).data;assert.equal((await call(a,'state')).status,200);assert.equal((await call(b,'state')).status,200);const untouched=row(b).payload;
  const before=saved(a),q=intent(a,{kind:'redeem',code:'RYUSION_UPDATE',gems:99999999,gold:99999999});const rs=await Promise.all(Array.from({length:4},()=>call(a,'action',q)));assert(rs.every(r=>r.status===200));assert.equal(saved(a).gems,before.gems+2000);assert.equal(saved(a).gold,before.gold+5000);assert.equal((await act(a,{kind:'redeem',code:'RYUSION_UPDATE'})).status,400);
  assert.equal((await act(a,{kind:'redeem',code:'THANKS_FOR_PLAYING'})).status,200);assert.equal(saved(a).gems,before.gems+3000);assert.equal(saved(a).gold,before.gold+15000);assert.equal(row(b).payload,untouched);console.log('PASS signed coupons exact once under concurrent requests, no client reward control, account isolation');
  patch(a,s=>{s.gems=5000;s.banners.ryusion={pity:79,guaranteed:true};});const pull=intent(a,{kind:'recruit',banner:'ryusion',count:10,cost:0});assert.equal((await call(a,'action',{...pull,catalogVersion:18})).status,426);assert.equal((await call(null,'action',pull)).status,401);
  const r=await call(a,'action',pull);assert.equal(r.status,200);assert.equal(r.data.result.results[0].id,'ryusion');assert.equal(saved(a).gems,4000);assert.equal((await call(a,'action',pull)).data.repeated,true);assert.equal(saved(a).gems,4000);console.log('PASS server SSR price, guaranteed pickup, old-client rejection and idempotent recruitment');
  assert.equal((await act(a,{kind:'train',hero:'ryusion'})).status,200);assert.equal((await act(a,{kind:'team',team:['ryusion','harin','sua']})).status,200);patch(a,s=>{for(const h of s.battle.heroes){h.hp=h.max=100000;h.atk=1;}for(const e of s.battle.enemies){e.hp=e.max=1000000;e.atk=10;}});const start=now;now+=8500;let state=await call(a,'state');assert.equal(state.status,200);assert(state.data.state.events.some(e=>e.kind==='ryusion-impact'));assert(state.data.state.events.some(e=>e.kind==='ryusion-taunt'));
  now=start+16500;state=await call(a,'state');assert(state.data.state.events.some(e=>e.kind==='earth-guard'));const again=(await t.login('ryusion-account-a')).data;assert.equal((await call(again,'state')).data.state.units.ryusion.level,2);assert.equal(row(b).payload,untouched);console.log('PASS account battle taunt, delayed charge and all-party shield, reconnect retains Ryusion');
 }finally{Date.now=realNow;crypto.getRandomValues=realRandom;t.sqlite.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
