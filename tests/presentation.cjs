// Real Chromium presentation checks. Fixtures stay inside this process;
// online snapshots use the production per-player serializer and actual SSE.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { Game } = require("../engine.js");
const port = Number(process.env.PRESENTATION_PORT || 8794);
process.env.PORT = String(port);
const service = require("../server.cjs");
const origin = `http://127.0.0.1:${port}`;

(async () => {
  await new Promise((resolve) => service.server.listen(port, "127.0.0.1", resolve));
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox"],
  });
  const errors = [];
  const pages = [];
  async function pageFor(options = {}) {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, ...options });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(origin + "/game.html");
    await page.evaluate(() => document.fonts.ready);
    return page;
  }
  async function fixture(page, options = {}) {
    await page.evaluate((o) => {
      localStart();
      clearTimeout(aiTimer);
      local.rng = () => 0;
      for (const p of local.s.players) { p.hand = []; p.hp = 100; p.status = {}; }
      const p = local.player(0);
      p.hp = o.hp ?? 100;
      p.hand = (o.cards || [37, 23, 8]).map((id) => local.card(id));
      p.status = o.status || {};
      local.s.turn = o.turn ?? 0;
      local.s.phase = o.phase || "turn";
      if (o.pending) { local.s.pending = o.pending; local.afterQueue = "finish"; }
      if (o.hps) local.s.players.forEach((player, i) => { player.hp = o.hps[i]; });
      if (o.winner !== undefined) local.s.winner = o.winner;
      local.s.deadline = Date.now() + 3600000;
      refresh(local.view(0));
      clearTimeout(aiTimer);
    }, options);
  }
  async function unavailable(page, card, expected, reason) {
    const button = page.locator(`#hand .card[data-card="${card}"]`).first();
    assert.equal(await button.evaluate((x) => x.classList.contains("unavailable")), expected);
    assert.equal(await button.evaluate((x) => x.disabled), false, "Description selection remains available");
    assert.equal(await button.getAttribute("data-playable"), String(!expected));
    if (expected) {
      assert((await button.locator(".card-unavailable").innerText()).trim());
      if (reason) assert((await button.getAttribute("aria-label")).includes(reason));
      const revision = await page.evaluate(() => view.revision);
      await button.click();
      assert(await page.locator("#play").isDisabled());
      assert.equal(await page.evaluate(() => view.revision), revision);
      await page.click("#card-details");
      assert(await page.locator("#card-dialog").evaluate((x) => x.open));
      await page.click("#card-dialog [data-close]");
    }
  }
  try {
    const page = await pageFor();
    for (const [hp, expected] of [[100, "normal"], [26, "normal"], [25, "critical"], [11, "critical"], [10, "last"], [1, "last"]]) {
      await fixture(page, { hp });
      assert.equal(await page.evaluate(() => document.body.dataset.danger), expected);
      if (hp === 10) await page.screenshot({ path: "/tmp/presentation-danger.png" });
      if (expected !== "normal") {
        assert((await page.locator("#danger-label").innerText()).trim());
        assert.equal(await page.locator("#danger-overlay").evaluate((x) => getComputedStyle(x).pointerEvents), "none");
      }
    }
    await fixture(page, { hp: 10, cards: [14] });
    await page.locator("#hand .card").click();
    await page.click("#play");
    await page.waitForFunction(() => self().hp === 28);
    await page.evaluate(() => clearTimeout(aiTimer));
    assert.equal(await page.evaluate(() => document.body.dataset.danger), "normal");
    console.log("PASS HP25/10 danger boundaries, usable controls and healing clears danger");

    await fixture(page, { turn: 1, cards: [37] });
    await unavailable(page, 37, true, "차례");
    await fixture(page, { cards: [23, 37] });
    await unavailable(page, 23, true);
    await unavailable(page, 37, false);
    await fixture(page, { cards: [37, 8], status: { xerath: { left: 1, after: 0 } } });
    await unavailable(page, 37, true);
    await unavailable(page, 8, false);
    await fixture(page, { cards: [5, 37], status: { touch: { left: 2, after: 0 } } });
    await unavailable(page, 5, true);
    await unavailable(page, 37, false);
    await fixture(page, {
      cards: [2, 20, 10, 23], phase: "react", turn: 1,
      pending: { from: 1, to: 0, amount: 16, card: 33, noCounter: true, multi: false },
    });
    await unavailable(page, 2, true);
    await unavailable(page, 20, true);
    await unavailable(page, 10, false);
    await unavailable(page, 23, false);
    console.log("PASS unavailable cards explain turn/reaction/Xerath/acquisition/counter restrictions while remaining inspectable");

    for (const [outcome, options] of [
      ["eliminated", { hps: [0, 100, 100, 100, 100], turn: 1 }],
      ["win", { hps: [100, 0, 0, 0, 0], phase: "over", winner: 0 }],
      ["loss", { hps: [0, 100, 0, 0, 0], phase: "over", winner: 1 }],
      ["draw", { hps: [0, 0, 0, 0, 0], phase: "over", winner: -1 }],
    ]) {
      await fixture(page, options);
      await page.waitForFunction((outcome) => {
        const d = document.querySelector("#result-dialog");
        return d.open && d.dataset.outcome === outcome;
      }, outcome);
      assert((await page.locator("#result-title").innerText()).trim());
      await page.screenshot({ path: `/tmp/presentation-${outcome}.png`, animations: "disabled" });
      await page.click(outcome === "eliminated" ? "#result-watch" : "#result-close");
      await page.evaluate(() => { refresh(local.view(0)); clearTimeout(aiTimer); });
      assert.equal(await page.locator("#result-dialog").evaluate((x) => x.open), false);
      await page.click("#result-reopen");
      assert.equal(await page.locator("#result-dialog").getAttribute("data-outcome"), outcome);
      assert(await page.locator("#result-dialog").evaluate((x) => x.open));
      if (outcome === "eliminated") {
        assert(await page.locator("#result-rematch").isHidden());
        await page.click("#result-watch");
        await page.evaluate(() => { localStart(); clearTimeout(aiTimer); });
      } else await page.click("#result-rematch");
      assert.equal(await page.locator("#result-dialog").evaluate((x) => x.open), false);
      assert.equal(await page.evaluate(() => self().hp), 100);
      assert.equal(await page.evaluate(() => view.phase), "turn");
      assert.equal(await page.evaluate(() => document.body.dataset.danger), "normal");
      assert(await page.locator("#result-reopen").isHidden());
    }
    console.log("PASS win/loss/draw/eliminated dialogs, watch, reopen, one-time opening and rematch reset");

    const profiles = await page.evaluate(() => Object.values(DuelFX.profiles));
    assert.equal(profiles.length, 40);
    assert(profiles.every((p) => p.motif && p.icon && p.color && p.cue));
    const cardFlows = await page.evaluate(async () => {
      const paths = [];
      const ctx = {
        element, isCurrent: () => true, reduced: () => false,
        point: (id) => ({ x: 50 + id * 100, y: 100 }),
        getView: () => ({ players: [0, 1, 2, 3, 4].map((id) => ({ id, hp: id === 2 ? 0 : 100 })) }),
        animate: async (node, frames) => {
          if (node.classList.contains("duel-card-back")) paths.push({
            card: Number(node.dataset.card), from: node.dataset.from,
            to: node.dataset.to, flow: node.dataset.flow, text: node.textContent,
            startX: parseFloat(node.style.left),
            endDX: Number(frames.at(-1).transform.match(/calc\(-50% \+ (-?[\d.]+)px\)/)?.[1]),
          });
          node.remove();
        },
      };
      await DuelFX.card({ card: 5, actor: 0, targets: [3] }, ctx);
      await DuelFX.card({ card: 18, actor: 0, targets: [1, 3] }, ctx);
      await DuelFX.card({ card: 6, actor: 0, targets: [1, 3, 4] }, ctx);
      await DuelFX.card({ card: 19, actor: 1, targets: [1] }, ctx);
      return paths;
    });
    assert.deepEqual(cardFlows.map(({ card, from, to, flow }) => ({ card, from, to, flow })), [
      { card: 5, from: "3", to: "0", flow: "steal" },
      { card: 18, from: "1", to: "0", flow: "confiscate" },
      { card: 18, from: "3", to: "0", flow: "confiscate" },
      { card: 6, from: "1", to: "inspect", flow: "reveal" },
      { card: 6, from: "3", to: "inspect", flow: "reveal" },
      { card: 6, from: "4", to: "inspect", flow: "reveal" },
      { card: 19, from: "1", to: "3", flow: "swap" },
      { card: 19, from: "3", to: "1", flow: "swap" },
    ]);
    for (const flow of cardFlows) {
      assert.equal(flow.text, "✧", "Decorative backs must not contain hidden card information");
      assert.equal(flow.startX, 50 + Number(flow.from) * 100);
      if (flow.to !== "inspect") assert.equal(flow.startX + flow.endDX, 50 + Number(flow.to) * 100);
    }
    console.log("PASS stealing/confiscation/reveal/exchange visual paths follow public targets without exposing cards");
    for (const [card, marker] of [[33, "prop-phone"], [37, "prop-burger"], [38, "prop-baseball"], [23, "prop-shield"], [29, "prop-dice"]]) {
      await fixture(page, { cards: [card], ...(card === 23 || card === 29 ? {
        phase: "react", turn: 1,
        pending: { from: 1, to: 0, amount: 20, card: 31, multi: false },
      } : {}) });
      await page.evaluate(() => {
        window.propMarkup = [];
        new MutationObserver((records) => {
          for (const record of records)
            for (const node of record.addedNodes)
              if (node.nodeType === 1) window.propMarkup.push(node.outerHTML);
        }).observe(document.querySelector("#effects"), { childList: true, subtree: true });
      });
      await page.locator("#hand .card").click();
      if (card <= 38 && card >= 31) await page.locator('#opponents [data-player="1"]').click();
      await page.click("#play");
      await page.evaluate(() => clearTimeout(aiTimer));
      await page.waitForFunction((marker) => window.propMarkup.some((x) => x.includes(marker)), marker);
      if (card === 33) {
        await page.waitForTimeout(120);
        await page.screenshot({ path: "/tmp/presentation-phone.png" });
      }
    }
    await page.evaluate(() => { localStart(); clearTimeout(aiTimer); });
    await page.waitForTimeout(800);
    assert.equal(await page.locator("#effects > *").count(), 0);
    console.log("PASS all 40 effect profiles, phone/burger/baseball/shield/dice props and new-game effect cleanup");

    const reduced = await pageFor({ reducedMotion: "reduce" });
    await fixture(reduced, { hp: 10, cards: [37] });
    await reduced.evaluate(() => {
      window.motionDurations = [];
      new MutationObserver(() => {
        for (const a of document.getAnimations())
          window.motionDurations.push(Number(a.effect.getTiming().duration) || 0);
      }).observe(document.querySelector("#effects"), { childList: true, subtree: true });
    });
    await reduced.locator("#hand .card").click();
    await reduced.locator('#opponents [data-player="1"]').click();
    await reduced.click("#play");
    await reduced.evaluate(() => clearTimeout(aiTimer));
    await reduced.waitForTimeout(1000);
    assert.equal(await reduced.evaluate(() => document.body.dataset.danger), "last");
    assert((await reduced.locator("#danger-label").innerText()).trim());
    const durations = await reduced.evaluate(() => window.motionDurations);
    assert(durations.length > 0);
    assert(durations.every((duration) => duration <= 200), `Reduced motion durations ${durations}`);
    console.log("PASS reduced-motion effects stay brief while danger remains readable");

    for (let i = 0; i < 5; i++) {
      const p = await pageFor();
      pages.push(p);
      await p.click("#online-open");
      await p.fill("#nickname", "결과 " + i);
    }
    await pages[0].click("#create-room");
    await pages[0].waitForSelector("#lobby-dialog[open]");
    const code = await pages[0].locator("#invite-code").innerText();
    for (let i = 1; i < 5; i++) {
      await pages[i].fill("#room-code", code);
      await pages[i].click("#join-room");
      await pages[i].waitForSelector("#lobby-dialog[open]");
    }
    await pages[0].waitForFunction(() => document.querySelectorAll("#lobby-players li").length === 5);
    await pages[0].click("#start-room");
    await Promise.all(pages.map((p) => p.waitForFunction(() => view?.online)));
    const room = service.rooms.get(code);
    const g = new Game(["결과 0", "결과 1", "결과 2", "결과 3", "결과 4"], { rng: () => 0 });
    for (const p of g.s.players) { p.hand = []; p.hp = p.id ? 20 : 100; }
    g.player(0).hand = Array.from({ length: 4 }, () => g.card(37));
    g.serial = 9000; g.s.revision = 9000; g.s.deadline = Date.now() + 3600000;
    room.game = g;
    function broadcast() {
      for (const member of room.members)
        member.stream.write(`data: ${JSON.stringify({ code, host: 0, started: true, players: room.members.map((m) => ({ id: m.id, name: m.name, connected: true })), me: member.id, game: g.view(member.id) })}\n\n`);
    }
    broadcast();
    await Promise.all(pages.map((p) => p.waitForFunction(() => view.revision === 9000)));
    async function synchronizedClick(actor, selector) {
      const revision = g.s.revision;
      await pages[actor].click(selector);
      await Promise.all(pages.map((p) => p.waitForFunction((r) => view.revision > r, revision)));
    }
    for (let victim = 1; victim <= 4; victim++) {
      while (g.s.turn !== 0) await synchronizedClick(g.s.turn, "#pass");
      await pages[0].locator('#hand .card[data-card="37"]').first().click();
      await pages[0].locator(`#opponents [data-player="${victim}"]`).click();
      await synchronizedClick(0, "#play");
      if (g.s.phase === "react") await synchronizedClick(g.s.pending.to, "#take");
      assert.equal(g.player(victim).hp, 0);
      if (victim < 4) {
        await pages[victim].waitForFunction(() => {
          const d = document.querySelector("#result-dialog");
          return d.open && d.dataset.outcome === "eliminated";
        });
        assert(await pages[victim].locator("#result-dialog").evaluate((x) => x.open));
        await pages[victim].click("#result-watch");
      }
    }
    for (let i = 0; i < 5; i++) {
      await pages[i].waitForFunction((outcome) => {
        const d = document.querySelector("#result-dialog");
        return d.open && d.dataset.outcome === outcome;
      }, i === 0 ? "win" : "loss");
      assert.equal(await pages[i].evaluate(() => view.winner), 0);
      assert.equal(await pages[i].evaluate(() => view.players.filter((p) => p.hand).length), 1);
      await pages[i].click("#result-close");
    }
    broadcast();
    await pages[0].waitForTimeout(350);
    for (const p of pages) assert.equal(await p.locator("#result-dialog").evaluate((x) => x.open), false);
    console.log("PASS real five-session SSE: early elimination/watch, one winner/four losses, private hands and repeated snapshots do not reopen results");
    await pages[0].click("#result-reopen");
    await pages[0].click("#result-rematch");
    await pages[0].waitForSelector("#online-dialog[open]");
    assert.equal(await pages[0].evaluate(() => online), null);
    assert.equal(await pages[0].locator("#result-dialog").evaluate((x) => x.open), false);
    console.log("PASS online result rematch leaves the finished room and opens the new-room form");
    assert.deepEqual(errors, []);
    console.log("PASS presentation browser checks without JavaScript errors");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await browser.close();
    service.stop();
  }
})();
