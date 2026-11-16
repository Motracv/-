const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
const origin = process.env.TEST_ORIGIN || "http://127.0.0.1:8787";
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const errors = [];
  const pages = [];
  try {
    for (let i = 0; i < 5; i++) {
      const context = await browser.newContext({
          viewport: { width: 390, height: 664 },
        }),
        page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(origin + "/game.html");
      pages.push(page);
    }
    const [host, ...guests] = pages;
    await host.click("#online-open");
    await host.fill("#nickname", "Host");
    await host.click("#create-room");
    await host.waitForSelector("#lobby-dialog[open]");
    const code = await host.locator("#invite-code").innerText();
    for (let i = 0; i < guests.length; i++) {
      const page = guests[i];
      await page.click("#online-open");
      await page.fill("#nickname", "Guest" + (i + 1));
      await page.fill("#room-code", code);
      await page.click("#join-room");
      await page.waitForSelector("#lobby-dialog[open]");
    }
    await host.waitForFunction(
      () =>
        document.querySelectorAll("#lobby-players li").length === 5 &&
        !document.querySelector("#start-room").disabled,
    );
    await host.click("#start-room");
    await Promise.all(
      pages.map((p) =>
        p.waitForFunction(() => view?.online && view.players.length === 5),
      ),
    );
    for (const page of pages) {
      const snapshot = await page.evaluate(() => view);
      assert.equal(
        snapshot.players.filter((p) => p.hand).length,
        1,
        "Only own hand is delivered",
      );
      assert(snapshot.players[snapshot.me].hand);
    }
    console.log(
      "PASS five isolated browser sessions joined and started; hand privacy verified",
    );
    // Explicit tampering and stale revision checks use real HTTP from a participant browser.
    const wrong = await pages[1].evaluate(async () => {
      const r = await fetch(server + "/api/action", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + online.token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ kind: "pass", revision: view.revision }),
      });
      return { status: r.status, data: await r.json() };
    });
    assert.equal(wrong.status, 400);
    console.log("PASS wrong-turn request rejected");
    let reactions = 0,
      gifts = 0,
      steals = 0,
      actions = 0,
      ended = false;
    for (let step = 0; step < 240; step++) {
      const state = await host.evaluate(() => view);
      if (state.phase === "over") {
        ended = true;
        break;
      }
      const actor =
          state.pending?.actor ??
          state.pending?.to ??
          state.pending?.target ??
          state.pending?.owner ??
          state.turn,
        page = pages[actor];
      await page.waitForFunction((r) => view.revision === r, state.revision);
      const result = await page.evaluate(async () => {
        const s = view,
          p = self(),
          other = s.players.find((x) => x.id !== s.me && x.hp > 0);
        let input;
        if (s.phase === "react") {
          const c = p.hand.find(
            (c) =>
              defense.has(c.id) &&
              !(s.pending.card === 9 && [2, 20].includes(c.id)) &&
              !(s.pending.multi && c.id === 13),
          );
          input = c
            ? { kind: "react", card: c.uid, target: other.id }
            : { kind: "take" };
        } else if (s.phase === "gift") input = { kind: "accept" };
        else if (s.phase === "discard")
          input = { kind: "discard", card: p.hand.at(-1).uid };
        else if (s.phase === "steal")
          input = {
            kind: "steal",
            cards: s.players
              .filter((x) => x.id !== s.me && x.hp > 0)
              .flatMap((x) => x.hand)
              .slice(0, 2)
              .map((c) => c.uid),
          };
        else {
          const legal = p.hand.filter(
            (c) =>
              ![2, 10, 13, 20, 23, 26, 29, 30].includes(c.id) &&
              (!p.status.xerath ||
                ["회복", "방어"].includes(CARDS[c.id - 1].type)) &&
              (!p.status.touch || ![5, 6, 18].includes(c.id)) &&
              (c.id !== 17 || !other.status.touch),
          );
          const c =
            legal.find((c) => [7, 9, 11, 15].includes(c.id)) ||
            legal.find((c) => [3, 5, 6, 17, 18].includes(c.id)) ||
            legal[0];
          input = c
            ? {
                kind: "play",
                card: c.uid,
                target: other.id,
                targets: s.players
                  .filter((x) => x.id !== s.me && x.hp > 0)
                  .slice(0, 2)
                  .map((x) => ({ id: x.id, mode: "hell" })),
              }
            : { kind: "pass" };
        }
        input.revision = s.revision;
        const res = await api("/api/action", input);
        return { phase: s.phase, res };
      });
      actions++;
      if (result.phase === "react") reactions++;
      if (result.phase === "gift") gifts++;
      if (result.phase === "steal") steals++;
      await Promise.all(
        pages.map((p) =>
          p.waitForFunction(
            (r) => view.revision >= r,
            result.res.game.revision,
          ),
        ),
      );
      // Allow the intentional server click throttle to elapse without blocking other tools.
      await new Promise((resolve) => setTimeout(resolve, 110));
      for (const p of pages) {
        assert(
          await p.evaluate(
            () =>
              (view.phase === "steal" && view.pending.owner === view.me) ||
              view.players.filter((x) => x.hand).length === 1,
          ),
          "Private hand leaked",
        );
      }
    }
    console.log(JSON.stringify({ actions, reactions, gifts, steals, ended }));
    assert(actions >= 20);
    assert(reactions > 0);
    // Reconnect the same browser identity and ensure the room survives.
    const before = await pages[4].evaluate(() => ({
      me: view.me,
      revision: view.revision,
    }));
    await pages[4].reload();
    await pages[4].waitForFunction(
      (me) => view?.online && view.me === me,
      before.me,
    );
    console.log("PASS browser reload resumes same player");
    // Viewport and seven-card/long-description checks use a separate AI page.
    const ctx = await browser.newContext(),
      mobile = await ctx.newPage();
    mobile.on("pageerror", (e) => errors.push(e.message));
    await mobile.goto(origin + "/game.html");
    for (const [w, h] of [
      [320, 480],
      [320, 568],
      [360, 640],
      [390, 664],
      [390, 844],
      [568, 320],
      [1280, 720],
    ]) {
      await mobile.setViewportSize({ width: w, height: h });
      await mobile.evaluate(() => {
        local.s.players[0].hand = [...Array(7)].map((_, i) =>
          local.card(i === 0 ? 18 : 27),
        );
        view = local.view(0);
        selected = new Set([view.players[0].hand[0].uid]);
        render();
      });
      const bounds = await mobile.evaluate(() => ({
        scroll: document.documentElement.scrollHeight,
        inner: innerHeight,
        cards: [...document.querySelectorAll(".hand .card")].map((x) => {
          const r = x.getBoundingClientRect();
          return { left: r.left, right: r.right, bottom: r.bottom, top: r.top };
        }),
        buttons: [
          ...document.querySelectorAll(".action-tray button:not([hidden])"),
        ].map((x) => {
          const r = x.getBoundingClientRect();
          return { bottom: r.bottom, top: r.top };
        }),
      }));
      assert(
        bounds.scroll <= h + 1,
        `Page scroll at ${w}x${h}: ${bounds.scroll}`,
      );
      assert(
        bounds.cards.every(
          (r) => r.left >= 0 && r.right <= w && r.bottom <= h && r.top >= 0,
        ),
        `Cards outside ${w}x${h}: ${JSON.stringify(bounds.cards)}`,
      );
      assert(
        bounds.buttons.every((r) => r.bottom <= h && r.top >= 0),
        `Buttons outside ${w}x${h}`,
      );
      console.log(`PASS viewport ${w}x${h}, seven cards + long description`);
    }
    assert.deepEqual(errors, []);
    console.log("PASS no browser JavaScript errors");
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
