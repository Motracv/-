// Real Chromium verification of landscape layout and five isolated SSE sessions.
process.env.PORT = process.env.LANDSCAPE_PORT || "8791";
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const service = require("../server.cjs");
const { CARDS, Game } = require("../engine.js");
const origin = `http://127.0.0.1:${process.env.PORT}`;
const viewports = [
  [568, 320],
  [568, 280],
  [667, 375],
  [844, 390],
  [844, 320],
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
      for (let first = 1; first <= CARDS.length; first++) {
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
            local.card(((first - 1 + i) % CARDS.length) + 1, { armor: 37 }),
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
                typeVisible: visible(x.querySelector(".card-type")),
                typeLabel: x.querySelector(".card-type").textContent,
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
            field: rect(document.querySelector("#field-zone")),
            fieldActive: document.querySelector("#field-zone").classList.contains("active"),
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
        if (!result.fieldActive)
          problems.push(`${width}x${height}: active field not marked`);
        if (result.field.left < 0 || result.field.right > width + 1 ||
            result.field.top < 0 || result.field.bottom > height + 1)
          problems.push(`${width}x${height}: field zone out of viewport`);
        for (const c of result.cards) {
          if (!c.typeVisible || !c.typeLabel.trim())
            problems.push(`${width}x${height} ${c.name}: missing card type`);
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
      await page.evaluate(() => {
        local.player(0).hand = [5, 5, 37, 8, 23, 1, 39].map((id) => local.card(id));
        local.player(0).status = {};
        view = local.view(0);
        selected = new Set([view.players[0].hand[0].uid]);
        selectedTarget = 2;
        render();
        document.querySelector("#last-result").textContent =
          "아주아주긴이름플레이어 −100 HP · 또다른아주긴플레이어 +25 HP · 이름이아주긴플레이어 −30 HP";
      });
      const crowdedBoard = await page.evaluate(() => ({
        resultBottom: document.querySelector("#last-result").getBoundingClientRect().bottom,
        fieldBottom: document.querySelector("#field-zone").getBoundingClientRect().bottom,
        handTop: document.querySelector(".hand-heading").getBoundingClientRect().top,
      }));
      if (crowdedBoard.resultBottom > crowdedBoard.handTop + 1 ||
          crowdedBoard.fieldBottom > crowdedBoard.handTop + 1)
        problems.push(`${width}x${height}: long result/field overlaps own HP`);
      const fusionLayout = await page.evaluate(() =>
        [...document.querySelectorAll(".action-tray .controls button")]
          .filter((b) => !b.hidden)
          .map((b) => {
            const r = b.getBoundingClientRect();
            return { id: b.id, left: r.left, right: r.right, top: r.top, bottom: r.bottom };
          }),
      );
      assert(fusionLayout.some((b) => b.id === "fuse"));
      for (const b of fusionLayout)
        if (b.left < 0 || b.right > width + 1 || b.top < 0 || b.bottom > height + 1)
          problems.push(`${width}x${height} fusion ${b.id}: button out of viewport`);
      if ([568, 844, 1280].includes(width) && [320, 390, 720].includes(height)) {
        await page.evaluate(() => {
          document.querySelector("#last-result").textContent = "";
          local.player(0).hand = [37, 8, 23, 32, 1, 39, 33].map((id) => local.card(id));
          local.player(0).status = {};
          view = local.view(0);
          selected = new Set([view.players[0].hand[0].uid]);
          selectedTarget = 2;
          render();
        });
        await page.screenshot({ path: `/tmp/duel-${width}x${height}.png` });
      }
      console.log(
        `CHECK ${width}x${height}: all ${CARDS.length} titles in seven-card hands`,
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
      localStart();
      clearTimeout(aiTimer);
      window.healEffects = [];
      new MutationObserver((records) => {
        for (const record of records)
          for (const node of record.addedNodes)
            if (node.nodeType === 1)
              window.healEffects.push(node.getAttribute("class") || "");
      }).observe(document.querySelector("#effects"), { childList: true });
      local.player(0).hp = 50;
      const heal = local.card(8);
      local.player(0).hand = [heal];
      local.action(0, { kind: "play", card: heal.uid });
      refresh(local.view(0));
      clearTimeout(aiTimer);
      local.s.deadline = Date.now() + 3600000;
    });
    await page.waitForFunction(() => window.healEffects.some((c) => c.includes("fx-health-aura")));
    assert(await page.evaluate(() => self().hp >= 58 && self().hp <= 66));
    assert(await page.evaluate(() => window.healEffects.some((c) => c.includes("fx-heal-cross"))));
    console.log("PASS healing shows full-battle health aura and rising heal particles");

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
    // Seed only this test process, then use real clicks and the production SSE
    // serializer. No fixture or debug endpoint is exposed by the game server.
    const room = service.rooms.get(code);
    const g = new Game(["Player0", "Player1", "Player2", "Player3", "Player4"]);
    for (const player of g.s.players) player.hand = [];
    const attack = g.card(37);
    g.player(0).hand = [attack];
    g.s.revision = 1000;
    g.serial = 1000;
    g.s.deadline = Date.now() + 3600000;
    room.game = g;
    for (const member of room.members)
      member.stream.write(
        `data: ${JSON.stringify({ code, host: 0, started: true, players: room.members.map((m) => ({ id: m.id, name: m.name, connected: true })), me: member.id, game: g.view(member.id) })}\n\n`,
      );
    await Promise.all(pages.map((p) => p.waitForFunction(() => view.revision === 1000)));
    for (const p of pages)
      await p.evaluate(() => {
        window.observedEffects = [];
        new MutationObserver((records) => {
          for (const record of records)
            for (const node of record.addedNodes)
              if (node.nodeType === 1 && node.classList.contains("fx"))
                window.observedEffects.push({ className: node.getAttribute("class"), text: node.textContent });
        }).observe(document.querySelector("#effects"), { childList: true });
      });
    await pages[0].locator("#hand .card").click();
    await pages[0].locator('#opponents [data-player="2"]').click();
    assert((await pages[0].locator("#target-hint").innerText()).includes("Player2"));
    await pages[0].click("#play");
    await Promise.all(pages.map((p) => p.waitForFunction(() => view.players[2].hp === 80)));
    for (const p of pages) {
      await p.waitForFunction(() => window.observedEffects.some((e) => e.className.includes("fx-number")));
      const state = await p.evaluate(() => ({
        effects: window.observedEffects,
        privateHands: view.players.filter((x) => x.hand).length,
        used: document.querySelector("#played-slot").textContent,
      }));
      assert.equal(state.privateHands, 1);
      assert(state.used.includes(CARDS[36].name));
      assert(state.effects.some((e) => e.className.includes("fx-cast")));
      assert(state.effects.some((e) => e.className.includes("fx-projectile")));
      assert(state.effects.some((e) => e.className.includes("fx-number") && e.text.includes("20")));
    }
    console.log("PASS five browsers: card37 selected, target clicked, 20 damage synchronized, cast/projectile/damage effects and hand privacy");
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
