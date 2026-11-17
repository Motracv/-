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
    await page.setContent('<button id="school">학교로</button>');
    await page.addStyleTag({ path: path.join(__dirname, '../school/presentation.css') });
    await page.addScriptTag({ path: path.join(__dirname, '../school/presentation.js') });
    await page.evaluate(() => {
      window.portraitDraws = 0;
      window.SchoolArt = { recruitPortrait(context) { portraitDraws++; context.fillRect(0, 0, 8, 8); } };
      SchoolPresentation.configure({ soundEnabled: () => false, reducedMotion: () => false, heroInfo: id => ({ name: id, rarity: 'SSR' }) });
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

    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
