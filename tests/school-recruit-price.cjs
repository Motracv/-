const assert=require('node:assert/strict');
const {fixture}=require('./account-fixture.cjs');
const G=require('../school/engine.js');
const NOW=Date.parse('2026-11-18T12:00:00+09:00');
(async()=>{
  let passed=0;
  const test=async(name,run)=>{await run();passed++;console.log('PASS',name);};
  await test('Banner-specific SSR100/1000 and UR160/1600 costs reject insufficient funds atomically',()=>{
    assert.equal(G.CATALOG_VERSION,23);assert.deepEqual(G.RECRUIT_COST,{1:160,10:1600});
    for(const banner of ['horas','osia','lava']){
      const cost=G.recruitCost(banner,10),singleCost=G.recruitCost(banner,1);
      assert(G.bannerAvailable(banner,NOW));
      const s=G.create(NOW);s.gems=cost-1;const before=G.clone(s);let rolls=0;
      assert.throws(()=>G.action(s,{kind:'recruit',banner,count:10,cost:0,gems:999999},NOW,()=>{rolls++;return .99;}),/보석/);
      assert.equal(rolls,0);assert.deepEqual(s,before);
      s.gems=cost;const result=G.action(s,{kind:'recruit',banner,count:10,cost:900},NOW,()=>.99);
      assert.equal(result.cost,cost);assert.equal(result.results.length,10);assert.equal(s.gems,0);assert.equal(s.pulls,10);assert.equal(s.history.length,10);
      assert(result.results.some(r=>G.BY_ID[r.id].rarity!=='R'));assert(G.validate(s));
      s.gems=singleCost-1;const low=G.clone(s);assert.throws(()=>G.action(s,{kind:'recruit',banner,count:1},NOW),/보석/);assert.deepEqual(s,low);
      s.gems=singleCost;const single=G.action(s,{kind:'recruit',banner,count:1,cost:1600},NOW,()=>.99);assert.equal(single.cost,singleCost);assert.equal(s.gems,0);assert.equal(s.pulls,11);
    }
  });
  const realNow=Date.now;Date.now=()=>NOW;
  const t=await fixture();
  const call=(who,path,data={})=>t.call('/api/school/'+path,{catalogVersion:G.CATALOG_VERSION,...data},null,{'X-Account-Session':who.token});
  const row=who=>t.sqlite.prepare('SELECT * FROM school_saves WHERE account_id=?').get(who.profile.id);
  const patch=(who,gems)=>{const state=JSON.parse(row(who).payload);state.gems=gems;t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(state),who.profile.id);};
  try{
    for(const banner of ['horas','osia','lava']){
      const cost=G.recruitCost(banner,10),singleCost=G.recruitCost(banner,1);
      const who=(await t.login(`recruit-price-${banner}`)).data;
      assert.equal((await call(who,'state')).status,200);
      await test(`${banner}: real SQLite insufficient balance ${cost-1} rejects without cost, rolls, pity or revision mutation`,async()=>{
        patch(who,cost-1);const before=row(who);
        const result=await call(who,'action',{revision:before.revision,requestId:`price-${banner}-insufficient1`,action:{kind:'recruit',banner,count:10,cost:900,gems:1e12}});
        assert.equal(result.status,400);assert.equal(row(who).payload,before.payload);assert.equal(row(who).revision,before.revision);assert(!result.data.result);
      });
      await test(`${banner}: catalog 16 cannot spend at the old price or receive a roll`,async()=>{
        patch(who,cost);const before=row(who);
        const result=await call(who,'action',{catalogVersion:16,revision:before.revision,requestId:`price-${banner}-stale-catalog1`,action:{kind:'recruit',banner,count:10,cost:900}});
        assert.equal(result.status,426);assert.equal(row(who).payload,before.payload);assert.equal(row(who).revision,before.revision);assert(!result.data.result);assert(!result.data.state);
      });
      await test(`${banner}: exactly ${cost} buys ten once under concurrent requests and persisted duplicate retries`,async()=>{
        const before=row(who),intent={revision:before.revision,requestId:`price-${banner}-ten-confirmed1`,action:{kind:'recruit',banner,count:10,cost:0}};
        const both=await Promise.all([call(who,'action',intent),call(who,'action',intent)]);
        for(const result of both){assert.equal(result.status,200);assert.equal(result.data.result.cost,cost);assert.equal(result.data.result.results.length,10);assert.equal(result.data.state.gems,0);assert.equal(result.data.state.pulls,10);}
        assert.deepEqual(both[0].data.result,both[1].data.result);const committed=row(who);
        const retry=await call(who,'action',intent);assert.equal(retry.status,200);assert.equal(retry.data.repeated,true);assert.deepEqual(retry.data.result,both[0].data.result);assert.equal(row(who).payload,committed.payload);assert.equal(row(who).revision,committed.revision);
        const secondLogin=(await t.login(`recruit-price-${banner}`)).data,loaded=await call(secondLogin,'state');
        assert.equal(loaded.status,200);assert.equal(loaded.data.state.gems,0);assert.equal(loaded.data.state.pulls,10);assert.deepEqual(loaded.data.state.history,both[0].data.state.history);
      });
      await test(`${banner}: signed single draw charges ${singleCost} and cannot use an invented client cost`,async()=>{
        patch(who,singleCost);const before=row(who);
        const result=await call(who,'action',{revision:before.revision,requestId:`price-${banner}-single-confirm1`,action:{kind:'recruit',banner,count:1,cost:0}});
        assert.equal(result.status,200);assert.equal(result.data.result.cost,singleCost);assert.equal(result.data.result.results.length,1);assert.equal(result.data.state.gems,0);assert.equal(result.data.state.pulls,11);
      });
    }
    console.log(`${passed} recruitment price boundary and SQLite transaction checks passed`);
  }finally{Date.now=realNow;t.sqlite.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
