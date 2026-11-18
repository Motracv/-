const assert = require('node:assert/strict');
const {fixture} = require('./account-fixture.cjs');
const G = require('../school/engine.js');
(async () => {
  const t = await fixture(), nativeNow = Date.now;
  Date.now = () => Date.parse('2026-11-18T12:00:00+09:00');
  try {
    // Also exercise the exact production bundle, keeping Google keys local to
    // signed test accounts. No requests touch production players or saves.
    if (process.env.SCHOOL_TEST_BUNDLE) {
      const worker = (await import(require('node:url').pathToFileURL(process.env.SCHOOL_TEST_BUNDLE).href)).default;
      const original = t.call;
      t.call = async (route, data={}, token, headers={}) => {
        if (!route.startsWith('/api/school/')) return original(route,data,token,headers);
        const r = await worker.fetch(new Request('https://card.example'+route, {method:'POST', headers:{'Content-Type':'application/json',Origin:'https://motracv.github.io',...headers},body:JSON.stringify(data)}), t.env);
        return {status:r.status,data:await r.json()};
      };
    }
    const call = (who, path, data={}) => t.call('/api/school/'+path, {catalogVersion:G.CATALOG_VERSION,...data}, null, who?{'X-Account-Session':who.token}:{});
    const row = who => t.sqlite.prepare('SELECT * FROM school_saves WHERE account_id=?').get(who.profile.id);
    const saved = who => JSON.parse(row(who).payload);
    const body = (who, action) => ({revision:row(who).revision,requestId:crypto.randomUUID(),action});
    const act = (who, action) => call(who,'action',body(who,action));
    const a = (await t.login('profile-reward-a')).data, b = (await t.login('profile-reward-b')).data;
    assert.equal((await call(a,'state')).status,200);
    assert.equal((await call(b,'state')).status,200);
    assert.equal((await call(null,'action',{action:{kind:'redeem',code:'랭킹1등축하드립니다'}})).status,401);
    assert.equal((await call(a,'state',{catalogVersion:22})).status,426);
    assert.equal((await act(a,{kind:'profile',avatar:'rank-first',redeemedCodes:['RANKING_FIRST_CONGRATS']})).status,400);
    const wallet = [saved(a).gold,saved(a).gems];
    const input = body(a,{kind:'redeem',code:'랭킹1등축하드립니다',gold:1e9,gems:1e9,avatar:'cat'});
    const both = await Promise.all([call(a,'action',input),call(a,'action',input)]);
    for (const r of both) {assert.equal(r.status,200);assert.equal(r.data.result.avatar,'rank-first');}
    assert.deepEqual(both[0].data.result,both[1].data.result);
    assert.deepEqual(saved(a).redeemedCodes,['RANKING_FIRST_CONGRATS']);
    assert.deepEqual([saved(a).gold,saved(a).gems],wallet);
    assert.equal((await act(a,{kind:'redeem',code:'RANKING_FIRST_CONGRATS'})).status,400);
    assert.equal((await act(b,{kind:'profile',avatar:'rank-first'})).status,400);
    console.log('PASS server entitlement, Korean code, simultaneous same-request retry, alias duplicate and account isolation');

    const again = (await t.login('profile-reward-a')).data;
    const retry = await call(again,'action',input);
    assert.equal(retry.status,200);assert.equal(retry.data.repeated,true);
    assert.equal((await act(again,{kind:'profile',avatar:'rank-first'})).status,200);
    const loaded = (await call(again,'state')).data.state;
    assert.equal(loaded.profile.avatar,'rank-first');assert(G.validate(saved(again)));
    assert(G.ownsProfileAvatar(loaded,'rank-first'));
    assert.deepEqual([loaded.gold,loaded.gems],wallet);
    const requests = [body(b,{kind:'redeem',code:'랭킹1등축하드립니다'}),body(b,{kind:'redeem',code:'랭킹1등축하드립니다'})];
    const race = await Promise.all(requests.map(r=>call(b,'action',r)));
    assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
    assert.deepEqual(saved(b).redeemedCodes,['RANKING_FIRST_CONGRATS']);
    assert.equal(saved(b).profile.avatar,'leader');
    assert.equal((await act(a,{kind:'redeem',code:'THANKS_FOR_REPORTING'})).status,200);
    assert.deepEqual([saved(a).gold,saved(a).gems],[wallet[0]+500,wallet[1]+500]);
    console.log('PASS reconnect, equipped portrait persistence, distinct-request contention and existing coupon rewards');
  } finally {Date.now = nativeNow;t.sqlite.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
