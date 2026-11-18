// Browser lifecycle checks use real dialog and WAAPI objects. No game rewards
// or account state are involved; these effects only display confirmed results.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'warning') errors.push(message.text()); });
    await page.setContent('<meta name="viewport" content="width=device-width, initial-scale=1"><button id="school">학교로</button>');
    await page.addStyleTag({ path: path.join(__dirname, '../school/presentation.css') });
    await page.addScriptTag({ path: path.join(__dirname, '../school/presentation.js') });
    await page.evaluate(() => {
      window.portraitDraws = 0;
      window.SchoolArt = { recruitPortrait(context) { portraitDraws++; context.fillRect(0, 0, 8, 8); } };
      SchoolPresentation.configure({ soundEnabled: () => false, reducedMotion: () => false, heroInfo: id => ({ name: id, rarity: id === 'horas' ? 'UR' : 'SSR' }) });
    });

    await page.evaluate(() => {
      window.firstResult = null;
      window.first = SchoolPresentation.captain({ level: 5, reward: 30, key: 'native-close' }).then(result => { firstResult = result; });
    });
    await page.waitForSelector('#school-presentation[open]');
    await page.evaluate(() => document.getElementById('school-presentation').close());
    await page.waitForFunction(() => !SchoolPresentation.busy && firstResult, null, { timeout: 600 });
    assert.deepEqual(await page.evaluate(() => firstResult), { skipped: true, cancelled: false });
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
    console.log('PASS native dialog close immediately releases busy and active animations');

    await page.evaluate(() => {
      window.recruitResult = null;
      window.recruit = SchoolPresentation.recruit({ results: [{ id: 'osia' }], key: 'paused-native-close' }).then(result => { recruitResult = result; });
    });
    await page.waitForSelector('#school-presentation[open]');
    await page.waitForTimeout(100);
    assert.ok(await page.evaluate(() => portraitDraws > 1), 'Live portrait actually scheduled animation frames');
    // A suspended browser timeline must not make native close depend on an
    // animation finishing. Pause actual Animation objects, not their promises.
    await page.evaluate(() => { for (const animation of document.getAnimations()) animation.pause(); document.getElementById('school-presentation').close(); });
    await page.waitForFunction(() => !SchoolPresentation.busy && recruitResult, null, { timeout: 600 });
    assert.deepEqual(await page.evaluate(() => recruitResult), { skipped: true, cancelled: false });
    const portraitDraws = await page.evaluate(() => window.portraitDraws);
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => window.portraitDraws), portraitDraws, 'Closed recruitment leaves no portrait rAF loop');
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
    console.log('PASS native close with paused WAAPI settles the result and stops the live portrait');

    await page.evaluate(() => {
      window.queueResults = [];
      SchoolPresentation.captain({ level: 6, reward: 30, key: 'queued-captain' }).then(result => queueResults.push(['captain', result]));
      SchoolPresentation.recruit({ results: [{ id: 'osia' }], key: 'queued-recruit' }).then(result => queueResults.push(['recruit', result]));
    });
    await page.waitForSelector('#school-presentation[open][data-kind="captain"]');
    await page.evaluate(() => SchoolPresentation.skip());
    await page.waitForSelector('#school-presentation[open][data-kind="recruit"]');
    await page.waitForTimeout(120);
    assert.equal(await page.evaluate(() => SchoolPresentation.busy), true);
    assert.equal(await page.evaluate(() => document.getElementById('school-presentation').open), true);
    assert.equal(await page.evaluate(() => queueResults.length), 1, 'Old close event must not finish the next job');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !SchoolPresentation.busy && queueResults.length === 2);
    const drawsBeforeDuplicate = await page.evaluate(() => portraitDraws);
    const duplicate = await page.evaluate(() => SchoolPresentation.recruit({ results: [{ id: 'osia' }], key: 'queued-recruit' }));
    assert.deepEqual(duplicate, { skipped: true, cancelled: false });
    assert.equal(await page.evaluate(() => portraitDraws), drawsBeforeDuplicate);
    assert.equal(await page.evaluate(() => SchoolPresentation.busy), false);
    console.log('PASS a stale close event preserves the next queued result; Escape and duplicate keys remain correct');

    await page.evaluate(() => {
      SchoolPresentation.recruit({ results: [{ id: 'osia' }], key: 'reward-queue-blocker' });
    });
    await page.waitForSelector('#school-presentation[open][data-kind="recruit"]');
    await page.evaluate(() => {
      window.rewardResults = [];
      const first = { level: 7, gems: 160, gold: 1200, key: 'account-a:captain:7' };
      SchoolPresentation.captain(first).then(result => rewardResults.push(result));
      SchoolPresentation.captain(first);
      SchoolPresentation.captain({ level: 8, gems: 160, gold: 1300, key: 'account-a:captain:8' }).then(result => rewardResults.push(result));
      SchoolPresentation.skip();
    });
    await page.waitForSelector('#school-presentation[open][data-kind="captain"]');
    assert.match(await page.locator('#presentation-description').innerText(), /Lv\.8/);
    assert.match(await page.locator('[data-currency="gems"]').innerText(), /320/);
    assert.match(await page.locator('[data-currency="gold"]').innerText(), /2,500/);
    await page.evaluate(() => SchoolPresentation.skip());
    await page.waitForFunction(() => rewardResults.length === 2 && !SchoolPresentation.busy);
    console.log('PASS queued captain levels sum actual gems and gold; duplicate receipt adds neither currency');

    await page.setViewportSize({ width: 755, height: 330 });
    await page.evaluate(() => {
      window.urResult = null;
      window.urInput = Object.freeze({ results: Object.freeze([Object.freeze({ id: 'horas', fresh: true })]), key: 'ur-full' });
      window.urBefore = JSON.stringify(urInput);
      window.urPhases = [];
      window.urObserver = new MutationObserver(() => { const phase = document.querySelector('#school-presentation')?.dataset.phase; if (phase && urPhases.at(-1) !== phase) urPhases.push(phase); });
      urObserver.observe(document.getElementById('school-presentation'), { attributes: true, attributeFilter: ['data-phase'] });
      SchoolPresentation.recruit(urInput).then(result => { urResult = result; });
    });
    await page.waitForSelector('#school-presentation[open][data-cinematic="horas"][data-phase="constellation"]');
    assert.equal(await page.locator('.ur-cinematic-orb').count(), 5);
    await page.waitForSelector('#school-presentation[open][data-phase="fusion"]');
    await page.waitForFunction(() => urPhases.includes('opening'), null, { timeout: 3000 });
    await page.waitForSelector('#school-presentation[open][data-phase="revealed"]', { timeout: 3000 });
    assert.equal(await page.locator('.ur-cinematic-name').innerText(), '호라스');
    const skipBox = await page.locator('[data-presentation-skip]').boundingBox();
    assert(skipBox.height >= 44 && skipBox.y >= 0 && skipBox.y + skipBox.height <= 330 && skipBox.x + skipBox.width <= 755, 'UR skip remains a visible touch target');
    await page.waitForFunction(() => !SchoolPresentation.busy && urResult, null, { timeout: 4000 });
    assert.deepEqual(await page.evaluate(() => urResult), { skipped: false, cancelled: false });
    assert.equal(await page.evaluate(() => JSON.stringify(urInput)), await page.evaluate(() => urBefore));
    assert.deepEqual(await page.evaluate(() => urPhases), ['constellation', 'fusion', 'opening', 'revealed']);
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
    await page.evaluate(() => urObserver.disconnect());
    console.log('PASS full four-phase UR ritual, five merging orbs, large reveal, mobile skip and immutable confirmed result');

    await page.evaluate(() => {
      window.cancelledUR = [];
      SchoolPresentation.recruit({ results: [{ id: 'horas' }], key: 'ur-cancel' }).then(result => cancelledUR.push(result));
      SchoolPresentation.captain({ level: 9, gems: 160, gold: 1400, key: 'account-a:captain:9' }).then(result => cancelledUR.push(result));
    });
    await page.waitForSelector('#school-presentation[open][data-phase="fusion"]');
    await page.evaluate(() => { for (const animation of document.getAnimations()) animation.pause(); SchoolPresentation.cancel(); });
    await page.waitForFunction(() => !SchoolPresentation.busy && cancelledUR.length === 2, null, { timeout: 600 });
    assert((await page.evaluate(() => cancelledUR)).every(result => result.cancelled && result.skipped));
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
    await page.waitForTimeout(100);
    assert.equal(await page.locator('#school-presentation').evaluate(el => el.open), false);

    await page.evaluate(() => {
      window.reducedUR = null;
      SchoolPresentation.setPreferences({ reduced: true });
      SchoolPresentation.recruit({ results: [{ id: 'horas' }], key: 'ur-reduced' }).then(result => { reducedUR = result; });
    });
    await page.waitForSelector('#school-presentation[open][data-motion="reduced"][data-phase="revealed"]');
    assert.equal(await page.locator('.ur-cinematic-orbit').isVisible(), false);
    assert(await page.locator('.ur-cinematic-name').isVisible());
    assert((await page.evaluate(() => document.getAnimations().map(animation => animation.effect.getTiming().duration))).every(duration => duration <= 140));
    await page.waitForFunction(() => !SchoolPresentation.busy && reducedUR, null, { timeout: 800 });
    assert.deepEqual(await page.evaluate(() => reducedUR), { skipped: false, cancelled: false });
    const duplicateUR = await page.evaluate(() => SchoolPresentation.recruit({ results: [{ id: 'horas' }], key: 'ur-reduced' }));
    assert.deepEqual(duplicateUR, { skipped: false, cancelled: false });
    assert.equal(await page.evaluate(() => SchoolPresentation.busy), false);
    console.log('PASS UR cancellation with paused timeline cancels queued account effects; reduced motion and duplicate receipts settle once');

    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
