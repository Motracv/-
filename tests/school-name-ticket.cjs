const assert = require('node:assert/strict');
const {fixture} = require('./account-fixture.cjs');
const G = require('../school/engine.js');

(async()=>{
  const t=await fixture(),realNow=Date.now;let now=Date.parse('2026-11-20T08:00:00Z'),sequence=0;
  if(process.env.SCHOOL_TEST_BUNDLE){
    const worker=(await import(require('node:url').pathToFileURL(process.env.SCHOOL_TEST_BUNDLE).href)).default,original=t.call;
    t.call=async(route,data={},token,headers={})=>{
      if(!route.startsWith('/api/school/'))return original(route,data,token,headers);
      const r=await worker.fetch(new Request('https://card.example'+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://motracv.github.io',...headers},body:JSON.stringify(data)}),t.env);
      return {status:r.status,data:await r.json()};
    };
  }
  Date.now=()=>now;
  const call=(who,route,data={})=>t.call('/api/school/'+route,{catalogVersion:G.CATALOG_VERSION,...data},null,{'X-Account-Session':who.token});
  const row=who=>t.sqlite.prepare('SELECT * FROM school_saves WHERE account_id=?').get(who.profile.id);
  const saved=who=>JSON.parse(row(who).payload);
  const intent=(who,action)=>({revision:row(who).revision,requestId:'name-ticket-action-'+(++sequence),action});
  const act=(who,action)=>call(who,'action',intent(who,action));
  const account=async id=>{now+=61000;const r=await t.login('name-ticket-'+id);assert.equal(r.status,200);const who=r.data;assert.equal((await call(who,'state')).status,200);return who;};
  const patch=(who,change)=>{const s=saved(who);change(s);assert(G.validate(s));t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(s),who.profile.id);};
  try{
    const a=await account('first'),b=await account('other');
    const old=saved(a);delete old.nameChangeTickets;assert(G.validate(old));assert.equal(G.commanderNameInfo(old).tickets,0);
    for(const value of [-1,.5,'1',NaN,Number.MAX_SAFE_INTEGER+1])assert.equal(G.validate({...old,nameChangeTickets:value}),false);
    console.log('PASS existing saves load; malformed ticket balances are rejected');

    assert.equal((await call(a,'state')).status,200);
    const before=saved(a),request=intent(a,{kind:'redeem',code:' newname ',nameChangeTickets:99999,gems:99999});
    const duplicate=await Promise.all([call(a,'action',request),call(a,'action',request)]);
    for(const r of duplicate){assert.equal(r.status,200);assert.equal(r.data.result.nameChangeTickets,1);}
    assert.equal(saved(a).nameChangeTickets,1);assert.equal(saved(a).gems,before.gems);assert.equal(saved(a).gold,before.gold);
    assert.equal((await act(a,{kind:'redeem',code:'NEWNAME'})).status,400);
    assert.equal((await call(a,'action',request)).data.repeated,true);assert.equal(saved(a).nameChangeTickets,1);
    console.log('PASS NEWNAME grants exactly one ticket; forged amounts and duplicate claims cannot add rewards');

    let r=await act(a,{kind:'rename',name:'티켓단장'});assert.equal(r.status,200);assert.equal(r.data.result.ticketUsed,false);assert.equal(saved(a).nameChangeTickets,1);
    assert.equal((await act(b,{kind:'rename',name:'예약된단장'})).status,200);
    for(const name of ['예약된단장','티켓단장','<script>']){const before=row(a).payload;r=await act(a,{kind:'rename',name});assert([400,409].includes(r.status));assert.equal(row(a).payload,before);}
    console.log('PASS first naming keeps the ticket; duplicate or invalid names never consume it');

    patch(a,s=>s.gems=0);
    const first=intent(a,{kind:'rename',name:'무료변경완료'}),second=intent(a,{kind:'rename',name:'두번째변경'});
    const racers=await Promise.all([call(a,'action',first),call(a,'action',second)]);assert.deepEqual(racers.map(r=>r.status).sort(),[200,409]);
    const winning=racers.find(r=>r.status===200);assert.equal(winning.data.result.ticketUsed,true);assert.equal(winning.data.result.cost,0);assert.equal(saved(a).nameChangeTickets,0);assert.equal(saved(a).gems,0);
    const retry=await call(a,'action',racers[0].status===200?first:second);assert.equal(retry.status,200);assert.equal(retry.data.repeated,true);assert.equal(saved(a).nameChangeTickets,0);
    assert.equal((await act(a,{kind:'rename',name:'보석필요'})).status,400);
    patch(a,s=>s.gems=3000);r=await act(a,{kind:'rename',name:'보석변경완료'});assert.equal(r.status,200);assert.equal(r.data.result.cost,3000);assert.equal(saved(a).gems,0);
    console.log('PASS simultaneous renames use one ticket, retries are free, later changes retain the normal cost');

    const c=await account('race1'),d=await account('race2');
    for(const [who,name]of[[c,'레이스단장일'],[d,'레이스단장이']]){assert.equal((await act(who,{kind:'rename',name})).status,200);assert.equal((await act(who,{kind:'redeem',code:'NEWNAME'})).status,200);}
    const collision=await Promise.all([act(c,{kind:'rename',name:'하나뿐인이름'}),act(d,{kind:'rename',name:'하나뿐인이름'})]);
    assert.deepEqual(collision.map(r=>r.status).sort(),[200,409]);
    for(const [i,who]of[c,d].entries())assert.equal(saved(who).nameChangeTickets,collision[i].status===200?0:1);
    console.log('PASS cross-account name collision rolls back the losing account’s ticket');

    const owner=collision[0].status===409?c:d,oldName=saved(owner).commanderName,balance=saved(owner).gems;
    const rollback=intent(owner,{kind:'rename',name:'저장재시도'});t.failNextBatch();assert.equal((await call(owner,'action',rollback)).status,503);
    assert.equal(saved(owner).nameChangeTickets,1);assert.equal(saved(owner).commanderName,oldName);assert.equal(saved(owner).gems,balance);
    assert.equal((await call(owner,'action',rollback)).status,200);assert.equal(saved(owner).nameChangeTickets,0);
    const social=await t.call('/api/school/social',{kind:'state',catalogVersion:G.CATALOG_VERSION},null,{'X-Account-Session':b.token});assert.equal(social.status,200);assert.equal(social.data.me.renameCost,3000);
    assert.equal((await act(b,{kind:'redeem',code:'NEWNAME'})).status,200);
    const free=await t.call('/api/school/social',{kind:'state',catalogVersion:G.CATALOG_VERSION},null,{'X-Account-Session':b.token});assert.equal(free.data.me.renameCost,0);assert.equal(free.data.me.nameChangeTickets,1);
    console.log('PASS failed storage leaves the ticket intact; social profile reports the ticket price');
  }finally{Date.now=realNow;t.sqlite.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
