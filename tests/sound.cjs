// Actual Web Audio synthesis + browser lifecycle and game-result integration.
const assert = require("node:assert/strict"), { chromium } = require("playwright");
process.env.PORT = process.env.SOUND_PORT || "8796";
const service = require("../server.cjs");
const origin = `http://127.0.0.1:${process.env.PORT}`;
(async () => {
  await new Promise((resolve) => service.server.listen(Number(process.env.PORT), "127.0.0.1", resolve));
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true,
    args: ["--no-sandbox", "--autoplay-policy=user-gesture-required"] });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 } });
    await context.addInitScript(() => {
      window.heardCues = []; window.audioContexts = []; window.liveSources = new Set();
      window.addEventListener("duel-sound-play", (e) => heardCues.push(e.detail.cue));
      const Original = window.AudioContext;
      window.AudioContext = new Proxy(Original, { construct(target, args) {
        const ctx = Reflect.construct(target, args); audioContexts.push(ctx);
        for (const method of ["createOscillator", "createBufferSource"]) {
          const create = ctx[method].bind(ctx);
          ctx[method] = (...args) => {
            const node = create(...args), start = node.start.bind(node);
            node.start = (...args) => {
              liveSources.add(node); node.addEventListener("ended", () => liveSources.delete(node), { once: true });
              return start(...args);
            };
            return node;
          };
        }
        return ctx;
      }});
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(origin + "/game.html");
    assert.equal(await page.evaluate(() => audioContexts.length), 0, "No autoplay AudioContext before a gesture");
    assert.equal(await page.evaluate(() => DuelSound.settings().volume), .4);
    await page.click("#menu-open");
    await page.waitForFunction(() => DuelSound.settings().ready);
    await page.click("#sound-test");
    await page.waitForFunction(() => heardCues.includes("heal") && liveSources.size > 0);
    assert.equal(await page.evaluate(() => audioContexts.length), 1);
    console.log("PASS real user gesture unlocks one AudioContext; preview schedules audible sources");

    const waves = await page.evaluate(async () => {
      const results = [];
      for (const cue of DuelSound.cues) {
        const ctx = new OfflineAudioContext(1, 44100 * 2, 44100);
        DuelSound.renderCue(ctx, ctx.destination, cue);
        const data = (await ctx.startRendering()).getChannelData(0);
        let peak = 0, energy = 0, tail = 0, hash = 0;
        for (let i = 0; i < data.length; i++) {
          if (!Number.isFinite(data[i])) throw Error(`Non-finite waveform: ${cue}`);
          peak = Math.max(peak, Math.abs(data[i])); energy += data[i] * data[i];
          if (i > data.length - 4410) tail = Math.max(tail, Math.abs(data[i]));
          if (i % 7 === 0) hash = (Math.imul(hash, 31) + Math.round(data[i] * 100000)) | 0;
        }
        results.push({ cue, peak, rms: Math.sqrt(energy / data.length), tail, hash });
      }
      return results;
    });
    for (const wave of waves) {
      assert(wave.rms > .001, `${wave.cue} is silent`);
      assert(wave.peak < .99, `${wave.cue} clips (${wave.peak})`);
      assert(wave.tail < .00001, `${wave.cue} does not end cleanly`);
    }
    assert.equal(new Set(waves.map((x) => x.hash)).size, waves.length, "Effects have distinct generated waveforms");
    console.log(`PASS ${waves.length} offline-rendered waveforms: finite, non-silent, distinct, unclipped, clean endings`);

    await page.locator("#sound-volume").fill("25");
    assert.equal(await page.locator("#sound-level").innerText(), "25%");
    await page.click("#sound-toggle");
    await page.waitForFunction(() => liveSources.size === 0);
    assert.equal(await page.evaluate(() => DuelSound.settings().enabled), false);
    const mutedCount = await page.evaluate(() => heardCues.length);
    await page.evaluate(() => DuelSound.event({ seq: 100, kind: "damage", amount: 25 }, DuelSound.capture()));
    assert.equal(await page.evaluate(() => heardCues.length), mutedCount);
    await page.reload();
    assert.deepEqual(await page.evaluate(() => ({ enabled: DuelSound.settings().enabled, volume: DuelSound.settings().volume })), { enabled: false, volume: .25 });
    assert.equal(await page.evaluate(() => audioContexts.length), 0);
    await page.click("#menu-open");
    await page.click("#sound-toggle");
    await page.waitForFunction(() => DuelSound.settings().ready);
    await page.click("#menu-dialog [data-close]");
    console.log("PASS volume and mute persist; muted effects create no voices; toggling back restores audio");

    async function fixture(options) {
      await page.evaluate((options) => {
        localStart(); clearTimeout(aiTimer);
        scheduleAI = () => {};
        for (const p of local.s.players) { p.hp = 100; p.hand = []; p.status = {}; }
        local.rng = () => 0;
        local.player(0).hp = options.hp || 100;
        local.player(0).hand = (options.cards || [37]).map((id) => local.card(id));
        if (options.defense) local.player(1).hand = [local.card(options.defense)];
        local.s.deadline = Date.now() + 3600000;
        refresh(local.view(0)); heardCues.length = 0;
      }, options);
    }
    await fixture({ cards: [37], defense: 10 });
    await page.click('#hand .card[data-card="37"]');
    await page.click('#opponents [data-player="1"]');
    await page.click("#play");
    await page.evaluate(() => {
      local.action(1, { kind: "react", card: local.player(1).hand[0].uid });
      refresh(local.view(0));
    });
    await page.waitForFunction(() => heardCues.includes("block"));
    assert.equal(await page.evaluate(() => view.players[1].hp), 100);
    assert.equal(await page.evaluate(() => heardCues.some((c) => ["hit", "heavy"].includes(c))), false);
    const completed = await page.evaluate(() => heardCues.length);
    await page.evaluate(() => { refresh(local.view(0)); render(); });
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => heardCues.length), completed);
    await fixture({ cards: [8], hp: 50 });
    await page.click('#hand .card[data-card="8"]'); await page.click("#play");
    await page.waitForFunction(() => heardCues.includes("heal"));
    assert.equal(await page.evaluate(() => view.players[0].hp), 58);
    console.log("PASS actual card actions: successful defense has block sound without hit sound; healing and snapshot deduplication");

    await fixture({ cards: [31] });
    await page.evaluate(() => { local.player(0).hp = 10; refresh(local.view(0)); });
    assert.equal(await page.evaluate(() => heardCues.filter((x) => x === "danger").length), 1);
    await page.evaluate(() => { render(); refresh(local.view(0)); });
    assert.equal(await page.evaluate(() => heardCues.filter((x) => x === "danger").length), 1);
    await page.evaluate(() => {
      local.s.players.slice(1).forEach((p) => { p.hp = 0; }); local.endCheck(); refresh(local.view(0));
    });
    assert.equal(await page.evaluate(() => heardCues.filter((x) => x === "win").length), 1);
    await page.click("#result-close"); await page.click("#result-reopen");
    assert.equal(await page.evaluate(() => heardCues.filter((x) => x === "win").length), 1);
    await page.click("#result-rematch");
    await page.waitForFunction(() => liveSources.size === 0);
    console.log("PASS critical-health cue once per entry; victory fanfare once; result reopen silent and rematch cancels voices");

    await page.evaluate(() => {
      heardCues.length = 0;
      local.s.phase = "over"; local.s.winner = 0;
      const snapshot = { ...local.view(0), online: true }; view = null; refresh(snapshot);
    });
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => heardCues.length), 0, "Restored online results and old events are silent");
    await page.evaluate(() => {
      localStart(); clearTimeout(aiTimer);
      window.oldSoundToken = DuelSound.capture();
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForFunction(() => audioContexts[0].state === "suspended");
    const hiddenCount = await page.evaluate(() => heardCues.length);
    await page.evaluate(() => DuelSound.event({ seq: 500, kind: "heal", amount: 8 }, DuelSound.capture()));
    await page.evaluate(() => {
      delete document.hidden; document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForFunction(() => DuelSound.settings().ready);
    await page.evaluate(() => DuelSound.event({ seq: 501, kind: "damage", amount: 8 }, oldSoundToken));
    assert.equal(await page.evaluate(() => heardCues.length), hiddenCount);
    await page.evaluate(() => {
      const token = DuelSound.capture();
      DuelSound.reset();
      DuelSound.event({ seq: 502, kind: "heal", amount: 8 }, token);
    });
    assert.equal(await page.evaluate(() => heardCues.length), hiddenCount);
    await page.evaluate(() => DuelSound.event({ seq: 1, kind: "card", card: 7 }, DuelSound.capture()));
    assert.equal(await page.evaluate(() => heardCues.length), hiddenCount + 1, "Old-match sequence must not silence the fresh match");
    console.log("PASS restore/hidden-tab/new-game generations never replay stale audio");

    await page.evaluate(() => { DuelSound.reset(); heardCues.length = 0; });
    await page.waitForFunction(() => liveSources.size === 0);
    const load = await page.evaluate(() => {
      const token = DuelSound.capture();
      for (let i = 1; i <= 50; i++) DuelSound.event({ seq: i, kind: "heal", amount: 10 }, token);
      return { count: heardCues.length, sources: liveSources.size };
    });
    assert.equal(load.count, 1, "Simultaneous AoE heals coalesce into one cue");
    assert(load.sources <= 5);

    await page.click("#menu-open");
    for (const [width, height] of [[568, 280], [568, 320], [844, 390]]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(70);
      const layout = await page.evaluate(() => {
        const ids = ["sound-quick", "sound-toggle", "sound-volume", "sound-test"];
        return ids.map((id) => { const e = document.getElementById(id), r = e.getBoundingClientRect(); return { id, x: r.x, right: r.right, y: r.y, bottom: r.bottom }; });
      });
      for (const r of layout) assert(r.x >= 0 && r.right <= width && r.y >= 0 && r.bottom <= height, `${r.id} clipped at ${width}x${height}`);
    }
    console.log("PASS bounded simultaneous sound and small-landscape sound controls");

    const mobile = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
    const touchPage = await mobile.newPage();
    touchPage.on("pageerror", (e) => errors.push(e.message));
    await touchPage.goto(origin + "/game.html");
    assert.equal(await touchPage.evaluate(() => DuelSound.settings().ready), false);
    await touchPage.evaluate(() => { window.touchSounds = []; addEventListener("duel-sound-play", (e) => touchSounds.push(e.detail.cue)); });
    await touchPage.locator("#menu-open").tap();
    await touchPage.waitForFunction(() => DuelSound.settings().ready);
    await touchPage.locator("#sound-test").tap();
    await touchPage.waitForFunction(() => touchSounds.includes("heal"));
    console.log("PASS mobile touch unlocks and previews synthesized audio");

    const unsupported = await browser.newContext({ viewport: { width: 844, height: 390 } });
    await unsupported.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
    const fallback = await unsupported.newPage();
    fallback.on("pageerror", (e) => errors.push(e.message));
    await fallback.goto(origin + "/game.html");
    assert(await fallback.locator("#sound-quick").isDisabled());
    await fallback.click("#pass");
    await fallback.waitForFunction(() => view.turn === 1);
    assert.deepEqual(errors, []);
    console.log("PASS unsupported audio still plays the game; no browser JavaScript errors");
  } catch (e) { console.error(e); process.exitCode = 1; }
  finally { await browser.close(); service.stop(); }
})();
