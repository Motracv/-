const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const origin = process.env.TEST_ORIGIN || "http://127.0.0.1:8790";
(async () => {
  const b = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const p = await b.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  try {
    await p.goto(origin);
    await p.evaluate(() => document.fonts.ready);
    assert.equal(await p.evaluate(() => view.players.length), 5);
    for (const [w, h] of [
      [320, 480],
      [320, 568],
      [360, 640],
      [390, 664],
      [390, 844],
      [568, 320],
      [844, 390],
      [1280, 800],
    ]) {
      await p.setViewportSize({ width: w, height: h });
      for (let offset = 0; offset < 30; offset += 7) {
        await p.evaluate((offset) => {
          clearTimeout(aiTimer);
          local = new Game(["나", "서찬", "우진", "태영", "건우"]);
          local.s.deadline = Date.now() + 1e7;
          local.player(0).hand = Array.from({ length: 7 }, (_, i) =>
            local.card(((i + offset) % 30) + 1),
          );
          view = local.view(0);
          selected = new Set([self().hand[0].uid]);
          selectedTarget = null;
          render();
        }, offset);
        const bounds = await p.evaluate(() => ({
          scroll: document.documentElement.scrollHeight,
          width: document.documentElement.scrollWidth,
          cards: [...document.querySelectorAll(".card")].map((x) => {
            const r = x.getBoundingClientRect(),
              t = x.querySelector("b").getBoundingClientRect(),
              type = x.querySelector(".card-type").getBoundingClientRect();
            return {
              id: x.querySelector(".rank").textContent,
              l: r.left,
              r: r.right,
              t: r.top,
              b: r.bottom,
              tl: t.left,
              tr: t.right,
              tt: t.top,
              tb: t.bottom,
              typeb: type.bottom,
              font: parseFloat(getComputedStyle(x.querySelector("b")).fontSize),
            };
          }),
          buttons: [
            ...document.querySelectorAll(".action-tray button:not([hidden])"),
          ].map((x) => {
            const r = x.getBoundingClientRect();
            return { id: x.id, l: r.left, r: r.right, t: r.top, b: r.bottom };
          }),
        }));
        assert(
          bounds.scroll <= h + 1,
          `page height ${w}x${h}: ${bounds.scroll}`,
        );
        assert(bounds.width <= w + 1);
        for (const c of bounds.cards) {
          assert(
            c.l >= 0 && c.r <= w && c.t >= 0 && c.b <= h,
            `card bounds ${w}x${h} ${JSON.stringify(c)}`,
          );
          assert(
            c.tt >= c.t && c.tb <= c.b,
            `title clips ${w}x${h} ${JSON.stringify(c)}`,
          );
          assert(
            c.tt >= c.typeb - 1,
            `type overlaps title ${w}x${h} ${JSON.stringify(c)}`,
          );
          assert(c.font >= (h < w ? 11 : 12));
        }
        for (const x of bounds.buttons)
          assert(
            x.l >= 0 && x.r <= w && x.b <= h,
            `button clips ${w}x${h}: ${JSON.stringify(x)}`,
          );
      }
      console.log(`PASS all 30 names, 7-card grid and controls at ${w}x${h}`);
    }
    await p.setViewportSize({ width: 320, height: 480 });
    await p.evaluate(() => {
      clearTimeout(aiTimer);
      local = new Game(["나", "이름이긴상대입니다", "상대2", "상대3", "상대4"]);
      local.s.deadline = Date.now() + 1e7;
      local.s.field = { id: 1, owner: 0, left: 3, after: 1 };
      local.player(0).hand = [1, 5, 5, 7, 18, 23, 24].map((i) => local.card(i));
      local.player(0).status.noheal = { left: 2 };
      local.player(0).status.invincible = true;
      view = local.view(0);
      selected = new Set([self().hand[3].uid]);
      selectedTarget = 1;
      render();
    });
    assert(
      await p.evaluate(
        () => document.documentElement.scrollHeight <= innerHeight + 1,
      ),
    );
    await p.click("#self .fighter");
    assert((await p.locator("#choice-body").innerText()).includes("회복 금지"));
    assert((await p.locator("#choice-body").innerText()).includes("무적"));
    await p.locator("#choice-actions button").click();
    assert(await p.locator("#stop-field").isVisible());
    assert(await p.locator("#fuse").isVisible());
    console.log(
      "PASS field, long target name, fusion and own status details on 320x480",
    );
    await p.setViewportSize({ width: 390, height: 664 });
    await p.evaluate(() => {
      clearTimeout(aiTimer);
      local = new Game(["나", "상대1", "상대2", "상대3", "상대4"]);
      local.s.deadline = Date.now() + 1e7;
      local.player(0).hand = [
        local.card(7),
        local.card(5),
        local.card(5),
        local.card(18),
      ];
      view = local.view(0);
      selected.clear();
      render();
    });
    await p.locator("#hand .card").first().click();
    const rev = await p.evaluate(() => view.revision);
    await p.locator('#opponents [data-player="3"]').click();
    assert.equal(await p.evaluate(() => view.revision), rev);
    assert.equal(await p.evaluate(() => selectedTarget), 3);
    await p.click("#play");
    await p.waitForFunction((r) => view.revision > r, rev);
    assert.equal(
      await p.evaluate(
        () =>
          local.s.events.find((e) => e.kind === "damage")?.target ??
          local.s.pending?.to,
      ),
      3,
    );
    console.log(
      "PASS selecting a target does not spend a card; use confirms correct target",
    );
    await p.evaluate(() => {
      clearTimeout(aiTimer);
      localStart();
      clearTimeout(aiTimer);
      local.player(0).hand = [local.card(18), local.card(5), local.card(5)];
      view = local.view(0);
      selected = new Set([self().hand[0].uid]);
      render();
    });
    await p.click("#card-details");
    assert(await p.locator("#card-dialog-desc").innerText());
    await p.click("#card-dialog [data-close]");
    await p.click("#new-game");
    await p.selectOption("#practice-count", "2");
    await p.getByRole("button", { name: "시작", exact: true }).click();
    assert.equal(await p.evaluate(() => view.players.length), 2);
    await p.click("#new-game");
    await p.selectOption("#practice-count", "5");
    await p.getByRole("button", { name: "시작", exact: true }).click();
    assert.equal(await p.evaluate(() => view.players.length), 5);
    console.log("PASS full effect detail and 2–5 player practice controls");
    await p.screenshot({ path: "/tmp/hand-redesign-final.png" });
    assert.deepEqual(errors, []);
    console.log("PASS no JavaScript errors");
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await b.close();
  }
})();
