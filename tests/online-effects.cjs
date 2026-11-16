// Fixtures exist only inside this test process, never as a server endpoint.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
process.env.PORT = "8788";
const service = require("../server.cjs");
const { Game, MAX_HP } = require("../engine.js");
(async () => {
  await new Promise((r) => service.server.listen(8788, "127.0.0.1", r));
  const port = service.server.address().port,
    origin = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const pages = [];
  let room;
  try {
    for (let i = 0; i < 5; i++) {
      const ctx = await browser.newContext(),
        p = await ctx.newPage();
      await p.goto(origin);
      await p.evaluate((url) => {
        server = url;
      }, origin);
      pages.push(p);
    }
    await pages[0].evaluate(async () => {
      const r = await api("/api/create", { name: "P0" });
      online = { token: r.token, code: r.code };
      receive(r);
      void stream();
    });
    const code = await pages[0].evaluate(() => online.code);
    for (let i = 1; i < 5; i++)
      await pages[i].evaluate(
        async ({ code, i }) => {
          const r = await api("/api/join", { name: "P" + i, code });
          online = { token: r.token, code };
          receive(r);
          void stream();
        },
        { code, i },
      );
    room = service.rooms.get(code);
    await pages[0].waitForFunction(
      () => document.querySelectorAll("#lobby-players li").length === 5,
    );
    await pages[0].evaluate(async () => receive(await api("/api/start")));
    await Promise.all(pages.map((p) => p.waitForFunction(() => view?.online)));
    assert(room.game.s.players.every((p) => p.hp === MAX_HP));
    let revision = 100;
    async function fixture(build) {
      const g = new Game(["P0", "P1", "P2", "P3", "P4"], { rng: () => 0 });
      for (const p of g.s.players) {
        // These effect fixtures deliberately start damaged at 60 HP.
        p.hp = 60;
        p.hand = [];
      }
      revision += 100;
      g.s.revision = revision;
      build(g);
      room.game = g; // Push using the same production per-user view serializer.
      for (const m of room.members)
        m.stream.write(
          `data: ${JSON.stringify({ code: room.code, host: 0, started: true, players: room.members.map((m) => ({ id: m.id, name: m.name, connected: true })), me: m.id, game: g.view(m.id) })}\n\n`,
        );
      await Promise.all(
        pages.map((p) =>
          p.waitForFunction((r) => view.revision === r, g.s.revision),
        ),
      );
      return g;
    }
    async function action(i, data) {
      await new Promise((r) => setTimeout(r, 110));
      const result = await pages[i].evaluate(
        async (data) =>
          api("/api/action", { ...data, revision: view.revision }),
        data,
      );
      await Promise.all(
        pages.map((p) =>
          p.waitForFunction((r) => view.revision === r, result.game.revision),
        ),
      );
      return result;
    }
    function give(g, id, ...cards) {
      return cards.map((c) => {
        const x = g.card(c);
        g.player(id).hand.push(x);
        return x;
      });
    }
    let c;
    let g = await fixture((g) => {
      [c] = give(g, 0, 6);
      give(g, 1, 7, 8);
      give(g, 2, 9);
    });
    await action(0, { kind: "play", card: c.uid });
    for (let i = 0; i < 5; i++) {
      const snap = await pages[i].evaluate(() => view);
      assert.equal(snap.players.filter((p) => p.hand).length, i === 0 ? 5 : 1);
    }
    const requested = g.player(1).hand.map((c) => c.uid);
    await action(0, { kind: "steal", cards: requested });
    assert(g.player(0).hand.some((c) => c.id === 7));
    assert(g.player(0).hand.some((c) => c.id === 8));
    for (let i = 0; i < 5; i++)
      assert.equal(
        await pages[i].evaluate(
          () => view.players.filter((p) => p.hand).length,
        ),
        1,
      );
    console.log("PASS 06 private reveal, two chosen cards, privacy restored");
    g = await fixture((g) => {
      [c] = give(g, 0, 11);
      give(g, 1, 2);
    });
    await action(0, { kind: "play", card: c.uid, target: 1 });
    const counter = g.player(1).hand[0];
    await action(1, { kind: "react", card: counter.uid });
    for (const p of pages)
      assert.deepEqual(
        await p.evaluate(() => view.players.slice(0, 2).map((p) => p.hp)),
        [35, 60],
      );
    console.log("PASS counter and HP synchronized to all five");
    g = await fixture((g) => {
      [c] = give(g, 0, 3);
    });
    await action(0, { kind: "play", card: c.uid, target: 1 });
    await action(1, { kind: "accept" });
    for (const p of pages)
      assert(
        (await p.evaluate(() => view.logs)).some(
          (x) => x === "룰렛: P0, 피해 8",
        ),
      );
    console.log("PASS one server roulette outcome synchronized");
    g = await fixture((g) => {
      [c] = give(g, 0, 18);
      give(g, 0, 27, 27, 27);
      give(g, 1, 7, 11);
      give(g, 2, 8, 14);
    });
    await action(0, {
      kind: "play",
      card: c.uid,
      targets: [
        { id: 1, mode: "hell" },
        { id: 2, mode: "heaven" },
      ],
    });
    assert.equal(g.player(0).hand.find((c) => c.id === 26).armor, 78);
    await pages[0].waitForFunction(() => view.phase === "discard");
    while (g.s.phase === "discard")
      await action(g.s.pending.actor, {
        kind: "discard",
        card: g.player(g.s.pending.actor).hand.at(-1).uid,
      });
    console.log("PASS judgment choices, confiscation, generated shield");
    g = await fixture((g) => {
      [c] = give(g, 0, 3);
      g.player(0).hp = 30;
    });
    await action(0, { kind: "play", card: c.uid, target: 1 });
    g.s.deadline = Date.now() - 1;
    await pages[0].waitForFunction(
      () => view.phase === "turn" && view.turn === 1,
    );
    assert.equal(g.player(0).hp, 38);
    console.log("PASS unresponsive gift auto-rejects on server timer");
    g = await fixture((g) => {
      [c] = give(g, 0, 3);
      g.player(0).hp = 30;
    });
    await action(0, { kind: "play", card: c.uid, target: 4 });
    await pages[4].evaluate(() => streamAbort.abort());
    await new Promise((r) => setTimeout(r, 200));
    room.members[4].lastSeen = Date.now() - 91000;
    await pages[0].waitForFunction(() => view.players[4].hp === 0);
    assert.equal(g.player(0).hp, 38);
    assert.equal(g.s.phase, "turn");
    await pages[4].evaluate(() => {
      void stream();
    });
    await pages[4].waitForFunction(() => view.players[4].hp === 0);
    console.log(
      "PASS disconnected pending responder eliminated after grace; game continues",
    );
    g = await fixture(() => {});
    // Last survivor via explicit resignations uses the real endpoint.
    for (let i = 1; i < 5; i++) {
      await pages[i].evaluate(() => api("/api/leave"));
      await new Promise((r) => setTimeout(r, 30));
    }
    await pages[0].waitForFunction(() => view.phase === "over");
    assert.equal(await pages[0].evaluate(() => view.winner), 0);
    console.log("PASS final living player wins after four resignations");
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await browser.close();
    service.stop();
  }
})();
