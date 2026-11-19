// All codes below are generated afresh for an isolated in-memory Worker. The
// production code/hash is never read, printed, or committed by this test.
const assert = require('node:assert/strict');
const {randomBytes, createHash} = require('node:crypto');
const {fixture} = require('./account-fixture.cjs');
const G = require('../school/engine.js');
const RECEIPT = 'RANK_RECLAIMER_2';

async function setup() {
  const t = await fixture(), code = randomBytes(20).toString('hex').toUpperCase();
  const hash = createHash('sha256').update(code).digest('hex');
  const call = (who, route, data = {}) => t.call('/api/school/' + route, {catalogVersion:G.CATALOG_VERSION, ...data}, null, {'X-Account-Session':who.token});
  const save = who => t.sqlite.prepare('SELECT * FROM school_saves WHERE account_id=?').get(who.profile.id);
  const claim = () => t.sqlite.prepare('SELECT * FROM school_private_reward_claims WHERE receipt_id=?').get(RECEIPT);
  const person = async name => { const who = (await t.login(name)).data; assert.equal((await call(who, 'state')).status, 200); return who; };
  const redeem = (who, requestId, value = code, revision = save(who).revision) => call(who, 'action', {revision, requestId, action:{kind:'redeem', code:value, gems:1e12, avatar:'forged', title:'forged', accountId:'forged'}});
  return {t, code, hash, call, save, claim, person, redeem};
}

async function main() {
  let passed = 0;
  async function test(name, run) {
    const ctx = await setup();
    try { await run(ctx); passed++; console.log('PASS', name); }
    finally { ctx.t.sqlite.close(); }
  }
  await test('Missing/malformed configuration and wrong codes share the generic rejection and grant nothing', async ({t, code, hash, person, redeem, save, claim}) => {
    const who = await person('private-disabled'), before = save(who).payload;
    const absent = await redeem(who, 'private-disabled-request');
    t.env.PRIVATE_RANK_REWARD_HASH = 'misconfigured';
    const malformed = await redeem(who, 'private-malformed-request');
    t.env.PRIVATE_RANK_REWARD_HASH = hash;
    const wrong = await redeem(who, 'private-wrong-request00', code === 'A'.repeat(40) ? 'B'.repeat(40) : 'A'.repeat(40));
    const publicReceipt = await redeem(who, 'private-receipt-request', RECEIPT);
    for (const response of [absent, malformed, wrong, publicReceipt]) { assert.equal(response.status, 400); assert.equal(response.data.error, '사용할 수 없는 코드입니다.'); }
    assert.equal(save(who).payload, before); assert.equal(claim(), undefined);
    assert.throws(() => G.action(G.create(Date.now(), 1), {kind:'redeem', code}), /사용할 수 없는 코드/);
    assert.throws(() => G.action(G.create(Date.now(), 1), {kind:'redeem', code:RECEIPT}), /사용할 수 없는 코드/);
  });
  await test('Valid normalized input grants exactly the fixed rewards and persists only a non-secret receipt', async ({t, code, hash, person, redeem, save, claim}) => {
    t.env.PRIVATE_RANK_REWARD_HASH = hash;
    const who = await person('private-award'), initial = JSON.parse(save(who).payload);
    const result = await redeem(who, 'private-success-request', '  ' + code.toLowerCase() + '  ');
    assert.equal(result.status, 200); assert.equal(result.data.result.code, RECEIPT);
    assert.equal(result.data.state.gems, initial.gems + 1000); assert.equal(result.data.state.gold, initial.gold);
    assert.deepEqual(result.data.state.redeemedCodes, [RECEIPT]);
    assert.equal(result.data.state.profile.avatar, 'rank-first-2'); assert.equal(result.data.state.profile.title, 'rank-reclaimer');
    assert.ok(G.validate(JSON.parse(save(who).payload))); assert.ok(G.ownsProfileAvatar(result.data.state, 'rank-first-2')); assert.ok(G.ownsProfileTitle(result.data.state, 'rank-reclaimer'));
    assert.equal(claim().account_id, who.profile.id); assert.equal(claim().request_id, 'private-success-request');
    for (const text of [save(who).payload, JSON.stringify(result.data), JSON.stringify(claim())]) { assert.ok(!text.includes(code)); assert.ok(!text.includes(hash)); }
    assert.equal((await redeem(who, 'private-second-request0')).status, 400);
    assert.equal(JSON.parse(save(who).payload).gems, initial.gems + 1000);
  });
  await test('Concurrent same-ID requests, receipt eviction and disabled-code retries remain idempotent', async ({t, code, hash, person, redeem, save, claim}) => {
    t.env.PRIVATE_RANK_REWARD_HASH = hash;
    const who = await person('private-idempotent'), initial = save(who), requestId = 'private-idempotent-request';
    const replies = await Promise.all([redeem(who, requestId, code, initial.revision), redeem(who, requestId, code, initial.revision)]);
    replies.forEach(reply => assert.equal(reply.status, 200)); assert.deepEqual(replies[0].data.result, replies[1].data.result);
    const state = JSON.parse(save(who).payload); assert.equal(state.gems, 2800); state.receipts = [];
    t.sqlite.prepare('UPDATE school_saves SET payload=?,revision=revision+25 WHERE account_id=?').run(JSON.stringify(state), who.profile.id);
    delete t.env.PRIVATE_RANK_REWARD_HASH;
    const retry = await redeem(who, requestId, code, initial.revision);
    assert.equal(retry.status, 200); assert.equal(retry.data.repeated, true); assert.equal(retry.data.result.code, RECEIPT); assert.equal(retry.data.state.gems, 2800);
    assert.equal(claim().request_id, requestId);
  });
  await test('Two accounts race for a single global claim; foreign retries and account deletion cannot reopen it', async ({t, code, hash, person, redeem, save, claim, call}) => {
    t.env.PRIVATE_RANK_REWARD_HASH = hash;
    const people = [await person('private-race-A'), await person('private-race-B')];
    const replies = await Promise.all(people.map((who, i) => redeem(who, 'private-global-request-' + i)));
    assert.deepEqual(replies.map(reply => reply.status).sort(), [200, 400]);
    const winnerIndex = replies.findIndex(reply => reply.status === 200), winner = people[winnerIndex], loser = people[1 - winnerIndex];
    assert.equal(JSON.parse(save(winner).payload).gems, 2800); assert.equal(JSON.parse(save(loser).payload).gems, 1800);
    assert.equal((await redeem(loser, 'private-global-request-' + winnerIndex, code)).status, 400);
    assert.equal(claim().account_id, winner.profile.id);
    assert.equal((await t.call('/api/account/delete', {confirm:'DELETE'}, winner.token)).status, 200);
    assert.equal(claim().account_id, null); assert.equal((await call(loser, 'state')).status, 200);
    assert.equal((await redeem(loser, 'private-after-delete00')).status, 400);
    assert.equal(JSON.parse(save(loser).payload).gems, 1800);
  });
  await test('A competing ordinary action with the same ID cannot consume the one-use code after a lost save CAS', async ({t, hash, person, redeem, save, claim, call}) => {
    t.env.PRIVATE_RANK_REWARD_HASH = hash;
    const who = await person('private-cas'), initial = save(who), requestId = 'private-shared-cas-id00', batch = t.db.batch.bind(t.db);
    let once = true;
    t.db.batch = async statements => {
      if (once) { once = false; const other = await call(who, 'action', {revision:initial.revision, requestId, action:{kind:'train', hero:'harin'}}); assert.equal(other.status, 200); }
      return batch(statements);
    };
    const lost = await redeem(who, requestId); t.db.batch = batch;
    assert.equal(lost.status, 200); assert.equal(lost.data.repeated, true); assert.equal(lost.data.result.kind, 'train');
    assert.equal(claim(), undefined); assert.equal(JSON.parse(save(who).payload).gems, 1800);
    const retry = await redeem(who, 'private-fresh-after-cas'); assert.equal(retry.status, 200); assert.equal(retry.data.state.gems, 2800);
  });
  await test('Transaction failure grants nothing and a lost response recovers the committed global receipt', async ({t, code, hash, person, redeem, save, claim}) => {
    t.env.PRIVATE_RANK_REWARD_HASH = hash;
    const who = await person('private-storage'), initial = save(who), requestId = 'private-storage-request';
    t.failNextBatch();
    const failed = await redeem(who, requestId); assert.equal(failed.status, 503); assert.equal(save(who).payload, initial.payload); assert.equal(claim(), undefined);
    const batch = t.db.batch.bind(t.db); let drop = true;
    t.db.batch = async statements => { const result = await batch(statements); if (drop) { drop = false; throw Error('Simulated lost storage response'); } return result; };
    const lost = await redeem(who, requestId, code, initial.revision); t.db.batch = batch;
    assert.equal(lost.status, 503); assert.equal(JSON.parse(save(who).payload).gems, 2800); assert.ok(claim());
    const retry = await redeem(who, requestId, code, initial.revision);
    assert.equal(retry.status, 200); assert.equal(retry.data.repeated, true); assert.equal(retry.data.state.gems, 2800);
  });
  console.log(`${passed} private reward tests passed`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
