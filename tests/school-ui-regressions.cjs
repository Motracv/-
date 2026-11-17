const assert = require('node:assert/strict');
const G = require('../school/engine.js');
const SAVE = 'school-mercenaries-v5';

// Seed at the next document's first instruction: lifecycle saves from the old
// document must finish before the test fixture replaces storage.
async function installGuestSeed(context) {
  await context.addInitScript(() => {
    const raw = sessionStorage.getItem('school-fixture-next');
    if (!raw) return;
    sessionStorage.removeItem('school-fixture-next');
    const seed = JSON.parse(raw);
    for (const key of Object.keys(localStorage)) if (key.startsWith('school-mercenaries-')) localStorage.removeItem(key);
    localStorage.setItem(seed.key, typeof seed.state === 'string' ? seed.state : JSON.stringify(seed.state));
    if (seed.backup) localStorage.setItem('school-mercenaries-v5-backup', JSON.stringify(seed.backup));
  });
}
async function seedGuest(page, state, key = SAVE, options = {}) {
  await page.evaluate(seed => sessionStorage.setItem('school-fixture-next', JSON.stringify(seed)), { key, state, backup: options.backup });
  await page.reload();
  if (!options.corrupt) await page.waitForFunction(() => document.querySelectorAll('.party-card').length === 3);
}
const freeze = (gold = 700) => {
  const state = G.create(Date.now() + 60000, 26);
  state.gold = gold;
  return state;
};
async function runSchoolRegressions({ pageFor, saved, origin, errors, t, login, setStateDelay, setActionBlock, failStateOnce, schoolActionLog }) {
  const p = await pageFor('save-regressions');
  assert.equal(await p.locator('.bottom-nav [data-tab="roster"]').count(), 0);
  assert.equal(await p.locator('.bottom-nav > button').count(), 3);

  // Wait for a real automatic reward, then reload immediately rather than
  // waiting for an arbitrary autosave interval.
  const payout = G.create(Date.now() + 700, 26);
  payout.gold = 700;
  payout.battle.enemies.forEach(enemy => { enemy.hp = 1; });
  await seedGuest(p, payout);
  await p.waitForFunction(() => Number(document.getElementById('gold').textContent.replaceAll(',', '')) > 700);
  const visible = await p.locator('#gold').textContent();
  const persisted = await saved(p);
  assert.equal(persisted.gold, Number(visible.replaceAll(',', '')), 'Visible combat rewards must already be durable');
  await p.reload();
  assert.ok((await saved(p)).gold >= persisted.gold, 'Refreshing immediately after a reward cannot remove displayed gold');
  console.log('PASS automatic combat gold is durable before display and survives immediate refresh');

  // An automatic XP level-up changes the training price while this dialog is
  // open. The button's actual cost and displayed level must update together.
  const changingCost = G.create(Date.now() + 1200, 28);
  changingCost.gold = 74;
  changingCost.units.harin.xp = G.needXp(1) - 10;
  changingCost.battle.enemies.forEach(enemy => { enemy.hp = 1; });
  await seedGuest(p, changingCost);
  await p.click('#party [data-hero="harin"]');
  assert.match(await p.locator('#train-cost').textContent(), /70/);
  await p.waitForFunction(() => document.getElementById('hero-level').textContent.includes('2'));
  assert.match(await p.locator('#train-cost').textContent(), /90/);
  assert.equal(await p.locator('#gold').textContent(), '90');
  assert.equal(await p.locator('#train-hero').isDisabled(), false);
  await p.click('#train-hero');
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('school-mercenaries-v5')).units.harin.level === 3);
  assert.equal((await saved(p)).gold, 0);
  await p.reload();
  assert.equal((await saved(p)).units.harin.level, 3);
  assert.equal((await saved(p)).gold, 0);
  console.log('PASS party-click training updates after automatic XP level-up; exact available gold succeeds and persists');

  const awakened = freeze(500);
  awakened.units.harin.shards = 10;
  await seedGuest(p, awakened);
  await p.click('#party [data-hero="harin"]');
  await p.click('#awaken-hero');
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('school-mercenaries-v5')).units.harin.stars === 1);
  assert.equal((await saved(p)).units.harin.shards, 0);
  assert.equal((await saved(p)).gold, 500);
  await p.click('#change-hero');
  await p.waitForSelector('#roster [data-hero="harin"]');
  assert.ok(await p.locator('#roster').isVisible());
  await p.click('#back-adventure');
  console.log('PASS party-click awakening and change-hero entry work without a mercenary navigation button');

  // Two real documents share one localStorage namespace and issue a spend at
  // the same time. Both successful clicks must survive, with different costs.
  for (const fallback of [false, true]) {
    if (fallback) await p.context().addInitScript(() => Object.defineProperty(navigator, 'locks', { value: undefined }));
    await seedGuest(p, freeze());
    const second = await p.context().newPage();
    second.on('pageerror', error => errors.push(error.message));
    await second.goto(origin + '/school.html');
    await second.waitForFunction(() => document.querySelectorAll('.party-card').length === 3);
    await p.click('#party [data-hero="harin"]');
    await second.click('#party [data-hero="harin"]');
    await Promise.all([p.click('#train-hero'), second.click('#train-hero')]);
    await p.waitForFunction(() => JSON.parse(localStorage.getItem('school-mercenaries-v5')).units.harin.level === 3);
    const concurrent = await saved(p);
    assert.equal(concurrent.gold, 540);
    await Promise.all([p.reload(), second.reload()]);
    assert.equal((await saved(p)).gold, 540);
    assert.equal((await saved(second)).units.harin.level, 3);
    await second.close();
    console.log(`PASS concurrent guest tabs serialize training with ${fallback ? 'IndexedDB fallback' : 'Web Locks'}`);
  }

  await seedGuest(p, freeze());
  await p.click('#party [data-hero="harin"]');
  await p.evaluate(() => {
    window.restoreStorageSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith('school-mercenaries-v5')) throw new DOMException('Quota exceeded (test)', 'QuotaExceededError');
      return window.restoreStorageSet.call(this, key, value);
    };
  });
  await p.click('#train-hero');
  await p.waitForFunction(() => document.getElementById('save-status').dataset.state === 'error' || /실패|못|차단|불가/.test(document.getElementById('save-status').textContent));
  assert.equal((await saved(p)).gold, 700);
  assert.equal((await saved(p)).units.harin.level, 1);
  assert.equal(await p.locator('#gold').textContent(), '700');
  assert.equal((await p.locator('#hero-level').textContent()).match(/\d+/)[0], '1');
  await p.evaluate(() => { Storage.prototype.setItem = window.restoreStorageSet; });
  await p.waitForFunction(() => !document.getElementById('train-hero').disabled);
  await p.click('#train-hero');
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('school-mercenaries-v5')).units.harin.level === 2);
  assert.equal((await saved(p)).gold, 630);
  await p.reload();
  assert.equal((await saved(p)).units.harin.level, 2);
  assert.equal((await saved(p)).gold, 630);
  console.log('PASS storage failure reports an error, does not spend or level up, and a retry commits once');

  const recovery = freeze(4321);
  recovery.gems = 987;
  await seedGuest(p, '{broken', SAVE, { backup: recovery });
  assert.equal((await saved(p)).gold, 4321);
  assert.equal((await saved(p)).gems, 987);
  assert.equal(await p.evaluate(() => localStorage.getItem('school-mercenaries-v5-recovery')), '{broken');
  await seedGuest(p, '{unrecoverable', SAVE, { corrupt: true });
  await p.waitForFunction(() => /복구|손상|읽지|저장/.test(document.getElementById('connection').textContent));
  assert.equal(await p.evaluate(() => localStorage.getItem('school-mercenaries-v5')), '{unrecoverable');
  assert.ok(await p.locator('#recruit-one').isDisabled());
  console.log('PASS valid backup restores corrupt progress; unrecoverable data is preserved instead of overwritten by a fresh game');
  await p.close();

  const cloud = await pageFor('wallet-preview');
  const who = (await t.login('wallet-preview')).data;
  await t.call('/api/school/state', { catalogVersion: G.CATALOG_VERSION }, null, { 'X-Account-Session': who.token });
  const confirmed = G.create(Date.now() + 1800, 41);
  confirmed.gold = 74;
  confirmed.units.harin.xp = G.needXp(1) - 10;
  confirmed.battle.enemies.forEach(enemy => { enemy.hp = 1; });
  t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(confirmed), who.profile.id);
  await login(cloud);
  assert.equal(await cloud.locator('#gold').textContent(), '74');
  setStateDelay(2200);
  try {
    await cloud.click('#party [data-hero="harin"]');
    await cloud.waitForFunction(() => document.getElementById('hero-level').textContent.includes('2'));
    assert.match(await cloud.locator('#train-cost').textContent(), /90/);
    assert.equal(await cloud.locator('#gold').textContent(), '74', 'Unconfirmed combat rewards cannot appear spendable');
    assert.equal(await cloud.locator('#train-hero').isDisabled(), true);
    const confirmedCache=await cloud.evaluate(()=>JSON.parse(sessionStorage.getItem('school-confirmed-cloud-view')));assert.equal(confirmedCache.state.gold,74);assert.ok(!('receipts' in confirmedCache.state));
    await cloud.reload();
    await cloud.waitForFunction(()=>document.querySelectorAll('.party-card').length===3);
    assert.equal(await cloud.locator('#gold').textContent(),'74','Normal receipt-free server views must restore from the confirmed cache while offline');
    assert.notEqual(await cloud.locator('#gold').textContent(), '700', 'A slow account restore cannot expose the guest wallet');
    await cloud.waitForFunction(() => document.getElementById('account-label').textContent === '계정 저장' && Number(document.getElementById('gold').textContent.replaceAll(',', '')) >= 90);
    assert.ok(Number((await cloud.locator('#gold').textContent()).replaceAll(',', '')) >= 90);
    console.log('PASS delayed cloud acknowledgement keeps the wallet confirmed and refresh does not flash or switch to guest funds');
  } finally { setStateDelay(0); await cloud.close(); }

  const switching=await pageFor('switch-account-A');await login(switching);
  const identityA=(await t.login('switch-account-A')).data.profile.id,identityB=(await t.login('switch-account-B')).data.profile.id;
  const tokenA=await switching.evaluate(base=>JSON.parse(sessionStorage.getItem(`card-account:${base}`)).token,origin);
  setActionBlock(tokenA);
  try {
    await switching.click('.bottom-nav [data-tab="recruit"]');await switching.click('#recruit-one');
    await switching.waitForFunction(()=>!!sessionStorage.getItem('school-pending-action')&&document.getElementById('connection').textContent.length>0);
    const pendingA=await switching.evaluate(()=>JSON.parse(sessionStorage.getItem('school-pending-action')));assert.equal(pendingA.accountId,identityA);
    await switching.click('#account-button');await switching.click('#cloud-login-again');await switching.waitForSelector('#fixture-login');
    await switching.evaluate(()=>{window.fixturePerson='switch-account-B';});failStateOnce();await switching.click('#fixture-login');
    await switching.waitForFunction(id=>JSON.parse(sessionStorage.getItem('school-confirmed-cloud-view')||'null')?.profile?.id===id,identityB,{timeout:15000});
    const tokenB=await switching.evaluate(base=>JSON.parse(sessionStorage.getItem(`card-account:${base}`)).token,origin);
    assert.notEqual(tokenA,tokenB);assert.ok(schoolActionLog.some(r=>r.token===tokenA&&r.accountId===identityA));assert.ok(!schoolActionLog.some(r=>r.token===tokenB&&r.accountId===identityA),'An old account action must never be sent with the new account token');
    const row=t.sqlite.prepare('SELECT payload FROM school_saves WHERE account_id=?').get(identityB),savedB=JSON.parse(row.payload);assert.equal(savedB.pulls,0);assert.equal(savedB.gems,1800);
    assert.equal(await switching.evaluate(()=>sessionStorage.getItem('school-pending-action')),null);
    console.log('PASS account switch plus failed initial restore never replays the old pending purchase on the new account');
  } finally {setActionBlock(null);await switching.close();}

  const expiredAccount=(await t.login('expired-receipt')).data;
  const request=(route,data={})=>t.call('/api/school/'+route,{catalogVersion:G.CATALOG_VERSION,...data},null,{'X-Account-Session':expiredAccount.token});
  let progress=(await request('state')).data;
  const oldPurchase={revision:progress.revision,requestId:'expired-receipt-original-001',accountId:expiredAccount.profile.id,action:{kind:'recruit',count:1}};
  progress=(await request('action',oldPurchase)).data;assert.equal(progress.state.pulls,1);
  for(let i=0;i<21;i++){const r=await request('action',{revision:progress.revision,requestId:`expired-receipt-later-${String(i).padStart(3,'0')}`,action:{kind:'stage',stage:1,mode:'farm'}});assert.equal(r.status,200);progress=r.data;}
  const expired=await pageFor('expired-receipt');await login(expired);
  await expired.evaluate(pending=>sessionStorage.setItem('school-pending-action',JSON.stringify(pending)),oldPurchase);
  const logStart=schoolActionLog.length;await expired.reload();
  await expired.waitForFunction(()=>!sessionStorage.getItem('school-pending-action'));
  await expired.waitForFunction(()=>document.getElementById('save-status').dataset.state==='saved');
  const oldRetries=schoolActionLog.slice(logStart).filter(r=>r.requestId===oldPurchase.requestId);assert.equal(oldRetries.length,1);assert.equal(oldRetries[0].revision,oldPurchase.revision);
  const stillOnce=JSON.parse(t.sqlite.prepare('SELECT payload FROM school_saves WHERE account_id=?').get(expiredAccount.profile.id).payload);assert.equal(stillOnce.pulls,1);assert.equal(stillOnce.gems,1700);
  await expired.close();console.log('PASS expired action receipt rejects a stale retry without rewriting revision or charging twice');
}
module.exports = { installGuestSeed, seedGuest, runSchoolRegressions };
