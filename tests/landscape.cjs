// Real Chromium verification of landscape layout and five isolated SSE sessions.
process.env.PORT = process.env.LANDSCAPE_PORT || "8791";
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const service = require("../server.cjs");
const origin = `http://127.0.0.1:${process.env.PORT}`;
const viewports = [
  [568, 320],
  [667, 375],
  [844, 390],
  [932, 430],
  [1280, 720],
];
(async () => {
  await new Promise((resolve) =>
    service.server.listen(Number(process.env.PORT), "127.0.0.1", resolve),
  );
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const errors = [],
    problems = [];
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(origin + "/game.html");
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => view.players.length), 5);
    assert(
      await page
        .locator("#self")
        .innerText()
        .then((t) => t.includes("100/100")),
    );
    for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      for (let first = 1; first <= 30; first++) {
        await page.evaluate((first) => {
          clearTimeout(aiTimer);
          local = new Game(["나", "긴이름상대서찬", "우진", "태영", "건우"]);
          local.s.deadline = Date.now() + 3600000;
          for (const p of local.s.players) {
            p.hand = [];
            p.status = {};
          }
          local.s.field = { id: 1, owner: 0, left: 3, after: 0 };
          local.player(0).hand = Array.from({ length: 7 }, (_, i) =>
            local.card(((first - 1 + i) % 30) + 1, { armor: 37 }),
          );
          local.player(0).status = {
            red: { left: 2, after: 0 },
            touch: { left: 1, after: 0 },
          };
          view = local.view(0);
          selected = new Set([view.players[0].hand[0].uid]);
          selectedTarget = null;
          exchange = false;
          render();
        }, first);
        const result = await page.evaluate(() => {
          const rect = (x) => {
            const r = x.getBoundingClientRect();
            return {
              left: r.left,
              right: r.right,
              top: r.top,
              bottom: r.bottom,
              width: r.width,
              height: r.height,
            };
          };
          const visible = (x) =>
            getComputedStyle(x).display !== "none" &&
            getComputedStyle(x).visibility !== "hidden";
          return {
            w: innerWidth,
            h: innerHeight,
            scroll: document.documentElement.scrollHeight,
            cards: [...document.querySelectorAll("#hand .card")].map((x) => {
              const title = x.querySelector("b"),
                range = document.createRange();
              range.selectNodeContents(title);
              return {
                name: title.textContent,
                box: rect(x),
                title: rect(title),
                glyph: rect({
                  getBoundingClientRect: () => range.getBoundingClientRect(),
                }),
                type: rect(x.querySelector(".card-type")),
                rarity: visible(x.querySelector(".rarity"))
                  ? rect(x.querySelector(".rarity"))
                  : null,
                font: parseFloat(getComputedStyle(title).fontSize),
              };
            }),
            buttons: [
              ...document.querySelectorAll(".action-tray button,#stop-field"),
            ]
              .filter(visible)
              .map((x) => ({ id: x.id, ...rect(x) })),
            rotate: getComputedStyle(document.querySelector("#rotate-screen"))
              .display,
          };
        });
        if (result.scroll > height + 1)
          problems.push(
            `${width}x${height} card${first}: page scroll ${result.scroll}`,
          );
        if (result.rotate !== "none")
          problems.push(
            `${width}x${height}: rotation overlay incorrectly visible`,
          );
        for (const c of result.cards) {
          if (
            c.box.left < -1 ||
            c.box.right > width + 1 ||
            c.box.top < 0 ||
            c.box.bottom > height + 1
          )
            problems.push(`${width}x${height} ${c.name}: card out of viewport`);
          if (
            c.glyph.left < c.box.left - 1 ||
            c.glyph.right > c.box.right + 1 ||
            c.glyph.top < c.box.top - 1 ||
            c.glyph.bottom > c.box.bottom + 1
          )
            problems.push(`${width}x${height} ${c.name}: title outside card`);
          if (c.glyph.top < c.type.bottom - 0.5)
            problems.push(`${width}x${height} ${c.name}: type overlaps title`);
          if (
            c.rarity &&
            c.type.right > c.rarity.left + 0.5 &&
            c.type.bottom > c.rarity.top + 0.5 &&
            c.type.top < c.rarity.bottom - 0.5
          )
            problems.push(`${width}x${height} ${c.name}: type overlaps rarity`);
          if (c.font < 12)
            problems.push(`${width}x${height} ${c.name}: font ${c.font}`);
        }
        for (const b of result.buttons)
          if (
            b.left < 0 ||
            b.right > width + 1 ||
            b.top < 0 ||
            b.bottom > height + 1
          )
            problems.push(`${width}x${height} ${b.id}: button out of viewport`);
      }
      console.log(
        `CHECK ${width}x${height}: all 30 titles in seven-card hands`,
      );
    }
    if (problems.length) {
      await page.setViewportSize({ width: 568, height: 320 });
      await page.screenshot({ path: "/tmp/landscape-failure.png" });
      console.error([...new Set(problems)].slice(0, 80).join("\n"));
    }
    assert.deepEqual([...new Set(problems)], [], "Landscape layout failures");

    await page.setViewportSize({ width: 844, height: 390 });
    await page.evaluate(() => {
      localStart();
      clearTimeout(aiTimer);
      local.s.deadline = Date.now() + 3600000;
      local.player(0).hand = [local.card(18)];
      view = local.view(0);
      selected = new Set([view.players[0].hand[0].uid]);
      render();
    });
    await page.click("#card-details");
    assert(
      await page
        .locator("#card-dialog-desc")
        .innerText()
        .then((t) => t.includes("무작위") || t.includes("최대")),
    );
    assert.equal(
      await page.evaluate(() =>
        document
          .querySelector("#card-dialog-desc")
          .textContent.startsWith(CARDS[17].desc),
      ),
      true,
    );
    await page.click("#card-dialog [data-close]");
    const used = await page.evaluate(() => {
      localStart();
      for (const p of local.s.players) p.hand = [];
      const card = local.card(11);
      local.player(0).hand = [card];
      local.action(0, { kind: "play", card: card.uid, target: 2 });
      refresh(local.view(0));
      clearTimeout(aiTimer);
      local.s.deadline = Date.now() + 3600000;
      return {
        revision: view.revision,
        description: CARDS[10].desc,
        name: CARDS[10].name,
      };
    });
    const slot = await page.locator("#played-slot").boundingBox();
    await page.mouse.move(slot.x + slot.width / 2, slot.y + slot.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(500);
    assert(await page.locator("#card-dialog").evaluate((x) => x.open));
    assert(
      (await page.locator("#card-dialog-desc").innerText()).includes(
        used.description,
      ),
    );
    assert(
      (await page.locator("#card-dialog-title").innerText()).includes(
        used.name,
      ),
    );
    assert.equal(await page.evaluate(() => view.revision), used.revision);
    await page.mouse.up();
    await page.click("#card-dialog [data-close]");
    console.log(
      "PASS full own-card details and 450ms used-card hold without game action",
    );

    await page.evaluate(() => {
      Object.defineProperty(document.documentElement, "requestFullscreen", {
        value: () => Promise.reject(Error("unsupported")),
        configurable: true,
      });
      Object.defineProperty(screen.orientation, "lock", {
        value: () => Promise.reject(Error("unsupported")),
        configurable: true,
      });
    });
    await page.click("#fullscreen");
    await page.waitForTimeout(50);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(
      () =>
        getComputedStyle(document.querySelector("#rotate-screen")).display ===
        "flex",
    );
    assert.equal(
      await page
        .locator("main")
        .evaluate((x) => getComputedStyle(x).visibility),
      "hidden",
    );
    await page.click("#rotate-fullscreen");
    await page.waitForTimeout(50);
    await page.setViewportSize({ width: 844, height: 390 });
    assert.equal(
      await page
        .locator("#rotate-screen")
        .evaluate((x) => getComputedStyle(x).display),
      "none",
    );
    console.log(
      "PASS portrait rotate screen and unsupported fullscreen fallback",
    );

    const pages = [];
    let streamCount = 0;
    for (let i = 0; i < 5; i++) {
      const ctx = await browser.newContext({
          viewport: { width: 844, height: 390 },
        }),
        p = await ctx.newPage();
      p.on("pageerror", (e) => errors.push(e.message));
      p.on("response", (r) => {
        if (r.url().endsWith("/api/events") && r.status() === 200)
          streamCount++;
      });
      await p.goto(origin + "/game.html");
      await p.click("#online-open");
      await p.fill("#nickname", "Player" + i);
      pages.push(p);
    }
    await pages[0].click("#create-room");
    await pages[0].waitForSelector("#lobby-dialog[open]");
    const code = await pages[0].locator("#invite-code").innerText();
    for (let i = 1; i < 5; i++) {
      await pages[i].fill("#room-code", code);
      await pages[i].click("#join-room");
      await pages[i].waitForSelector("#lobby-dialog[open]");
    }
    await pages[0].waitForFunction(
      () =>
        document.querySelectorAll("#lobby-players li").length === 5 &&
        !document.querySelector("#start-room").disabled,
    );
    await pages[0].click("#start-room");
    await Promise.all(
      pages.map((p) =>
        p.waitForFunction(() => view?.online && view.players.length === 5),
      ),
    );
    for (const p of pages) {
      const s = await p.evaluate(() => view);
      assert(s.players.every((x) => x.hp === 100));
      assert.equal(s.players.filter((x) => x.hand).length, 1);
    }
    assert.equal(streamCount, 5);
    for (let i = 0; i < 5; i++) {
      await pages[i].click("#pass");
      await Promise.all(
        pages.map((p) =>
          p.waitForFunction((turn) => view.turn === turn, (i + 1) % 5),
        ),
      );
    }
    console.log(
      "PASS five isolated SSE sessions: room, start, HP100, private hands, complete round",
    );
    assert.deepEqual(errors, []);
    console.log("PASS no browser JavaScript errors");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await browser.close();
    service.stop();
  }
})();
