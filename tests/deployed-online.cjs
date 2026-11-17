// Real public server integration. LOCAL_FRONTEND serves local static files under
// the real Pages origin; all backend requests still go to the public network.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs/promises"),
  path = require("node:path");
const backend =
  process.env.BACKEND_ORIGIN ||
  "https://motracv-card-room.densedormouse4.chatgpt.site";
const localFrontend = process.env.LOCAL_FRONTEND === "1";
const frontend = localFrontend
  ? "https://motracv.github.io/-/game.html"
  : process.env.FRONTEND_URL || "https://motracv.github.io/-/game.html";
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const pages = [],
    errors = [];
  let code;
  try {
    for (let i = 0; i < 5; i++) {
      const context = await browser.newContext({
        viewport: { width: 844, height: 390 },
      });
      await context.addInitScript(() => {
        window.publicSounds = [];
        window.addEventListener("duel-sound-play", (e) => publicSounds.push(e.detail.cue));
      });
      await context.addInitScript(
        (url) => localStorage.setItem("card-server", url),
        backend,
      );
      if (localFrontend)
        await context.route("https://motracv.github.io/-/**", async (route) => {
          const u = new URL(route.request().url()),
            relative = u.pathname.replace(/^\/-\//, "");
          if (
            route.request().method() !== "GET" ||
            !/^(game\.html|engine\.js|client\.js|game\.css|effects\.js|effects\.css|sound\.js|assets\/cards\/manifest\.json|assets\/fonts\/(PretendardVariable\.woff2|OFL\.txt))$/.test(
              relative,
            )
          ) {
            await route.continue();
            return;
          }
          const body = await fs.readFile(path.join(__dirname, "..", relative));
          const contentType = relative.endsWith(".js")
            ? "text/javascript"
            : relative.endsWith(".css")
              ? "text/css"
              : relative.endsWith(".json")
                ? "application/json"
                : relative.endsWith(".woff2")
                  ? "font/woff2"
                  : relative.endsWith(".txt")
                    ? "text/plain"
                    : "text/html";
          await route.fulfill({ status: 200, body, contentType });
        });
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("requestfailed", (r) =>
        console.error("Request failed", r.url(), r.failure()?.errorText),
      );
      page.on("response", (r) => {
        if (r.url().startsWith(backend) && r.status() >= 400)
          console.error("Backend HTTP", r.status(), new URL(r.url()).pathname);
      });
      await page.goto(frontend);
      await page.waitForFunction(
        () => typeof view !== "undefined" && view?.players.length === 5,
      );
      assert.equal(await page.evaluate(() => Object.keys(window.DuelFX?.profiles || {}).length), 40);
      assert.equal(await page.evaluate(() => DuelSound.cues.length), 24);
      pages.push(page);
    }
    console.log(
      `Frontend ${localFrontend ? "local assets at real Pages origin" : frontend}; backend ${backend} (real network)`,
    );
    const [host, ...guests] = pages;
    await host.click("#online-open");
    await host.fill("#nickname", "검증 방장");
    await host.click("#create-room");
    await host.waitForSelector("#lobby-dialog[open]", { timeout: 30000 });
    code = await host.locator("#invite-code").innerText();
    for (let i = 0; i < guests.length; i++) {
      const p = guests[i];
      await p.click("#online-open");
      await p.fill("#nickname", "검증 " + (i + 1));
      await p.fill("#room-code", code);
      await p.click("#join-room");
      await p.waitForSelector("#lobby-dialog[open]", { timeout: 30000 });
    }
    await host.waitForFunction(
      () =>
        document.querySelectorAll("#lobby-players li").length === 5 &&
        !document.querySelector("#start-room").disabled,
      null,
      { timeout: 30000 },
    );
    await host.click("#start-room");
    await Promise.all(
      pages.map((p) =>
        p.waitForFunction(
          () => view?.online && view.players.length === 5,
          null,
          { timeout: 30000 },
        ),
      ),
    );
    async function privacy() {
      for (const p of pages) {
        const snap = await p.evaluate(() => view);
        assert.equal(snap.players.filter((p) => p.hand).length, 1);
        assert(snap.players[snap.me].hand);
        assert(snap.players.every((p) => p.hp >= 0 && p.hp <= 100));
      }
    }
    await privacy();
    assert(await host.evaluate(() => view.players.every((p) => p.hp === 100)));
    console.log(
      "PASS public server: five independent browser sessions join/start, HP100, private hands",
    );
    for (const p of pages) assert(await p.evaluate(() => DuelSound.settings().ready), "Sound is unlocked by the player's room-entry touch");
    const bad = await guests[0].evaluate(async () => {
      try {
        await api("/api/action", { kind: "pass", revision: view.revision });
        return 200;
      } catch (e) {
        return e.status;
      }
    });
    assert.equal(bad, 400);
    console.log("PASS public server rejects wrong-turn action");
    const stale = await host.evaluate(() => view.revision);
    const concurrent = await host.evaluate(async () =>
      Promise.all(
        [1, 2].map(async () => {
          try {
            const result = await api("/api/action", {
              kind: "pass",
              revision: view.revision,
            });
            receive(result);
            return 200;
          } catch (e) {
            return e.status;
          }
        }),
      ),
    );
    assert.equal(concurrent.filter((s) => s === 200).length, 1);
    assert(concurrent.some((s) => s === 400 || s === 429));
    await Promise.all(
      pages.map((p) =>
        p.waitForFunction((r) => view.revision >= r, stale + 1, {
          timeout: 30000,
        }),
      ),
    );
    assert.equal(await host.evaluate(() => view.revision), stale + 1);
    console.log("PASS concurrent duplicate action commits once");
    for (let turn = 0; turn < 10; turn++) {
      const state = await host.evaluate(() => ({
        turn: view.turn,
        revision: view.revision,
        phase: view.phase,
      }));
      assert.equal(state.phase, "turn");
      const actor = pages[state.turn];
      await actor.waitForFunction((r) => view.revision >= r, state.revision);
      await actor.click("#pass");
      await Promise.all(
        pages.map((p) =>
          p.waitForFunction((r) => view.revision > r, state.revision, {
            timeout: 30000,
          }),
        ),
      );
      await privacy();
    }
    console.log("PASS ten UI turn passes synchronized to all five browsers");
    assert.equal(await host.evaluate(() => CARDS.length), 40);
    for (const page of pages)
      await page.evaluate(() => {
        window.publicCardCasts = [];
        window.publicDuelCards = [];
        new MutationObserver((records) => {
          for (const record of records)
            for (const node of record.addedNodes)
              if (node.nodeType === 1) {
                if (node.classList.contains("fx-cast")) window.publicCardCasts.push(node.textContent);
                if (node.matches(".duel-fx[data-card]")) window.publicDuelCards.push(Number(node.dataset.card));
              }
        }).observe(document.querySelector("#effects"), { childList: true });
      });
    const playedNewCards = new Map();
    for (let step = 0; step < 40; step++) {
      const state = await host.evaluate(() => ({
        turn: view.turn, revision: view.revision, phase: view.phase,
        pending: view.pending,
      }));
      if (playedNewCards.size >= 2 && state.phase === "turn") break;
      assert(["turn", "react"].includes(state.phase), `Unexpected phase ${state.phase}`);
      const actingId = state.phase === "react" ? state.pending.to : state.turn;
      const actor = pages[actingId];
      const audioCounts = await Promise.all(pages.map((p) => p.evaluate(() => publicSounds.length)));
      await actor.waitForFunction((r) => view.revision === r, state.revision);
      let chosen;
      if (state.phase === "react") {
        await actor.click("#take");
      } else {
        chosen = await actor.evaluate((used) => {
          const hand = view.players[view.me].hand;
          const priority = [37, 31, 35, 38, 33, 32, 34, 40, 39, 36];
          const id = priority.find((id) => !used.includes(id) && hand.some((c) => c.id === id));
          const card = hand.find((c) => c.id === id);
          if (!card) return null;
          const target = view.players.filter((p) => p.hp > 0 && p.id !== view.me && p.id !== 0)
            .sort((a, b) => b.hp - a.hp)[0] || view.players.find((p) => p.hp > 0 && p.id !== view.me);
          return { id: card.id, name: CARDS[card.id - 1].name, target: target.id };
        }, [...playedNewCards.keys()]);
        if (chosen) {
          await actor.locator(`#hand .card[data-card="${chosen.id}"]`).first().click();
          if (chosen.id <= 38)
            await actor.locator(`#opponents [data-player="${chosen.target}"]`).click();
          await actor.click("#play");
        } else {
          // All card acquisition remains a normal, server-validated exchange.
          await actor.click("#exchange");
          await actor.locator("#hand .card").nth(0).click();
          await actor.locator("#hand .card").nth(1).click();
          await actor.click("#play");
        }
      }
      await Promise.all(pages.map((page) => page.waitForFunction(
        (r) => view.revision > r, state.revision, { timeout: 30000 },
      )));
      await privacy();
      const publicStates = await Promise.all(pages.map((page) => page.evaluate(() => ({
        revision: view.revision, turn: view.turn, phase: view.phase,
        hp: view.players.map((p) => p.hp), statuses: view.players.map((p) => p.status),
        field: view.field,
      }))));
      for (const publicState of publicStates.slice(1)) assert.deepEqual(publicState, publicStates[0]);
      if (chosen) {
        for (const [i, page] of pages.entries()) {
          assert(await page.evaluate((id) => view.events.some((e) => e.kind === "card" && e.card === id), chosen.id));
          await page.waitForFunction((name) => window.publicCardCasts.some((text) => text.includes(name)), chosen.name);
          await page.waitForFunction((id) => window.publicDuelCards.includes(id), chosen.id);
          await page.waitForFunction((count) => publicSounds.length > count, audioCounts[i]);
        }
        playedNewCards.set(chosen.id, chosen.name);
        console.log(`PASS public card ${chosen.id}: synchronized state, private hands, distinct effects and synthesized sound on all five browsers`);
      }
    }
    assert(playedNewCards.size >= 2, "Two distinct new cards must be acquired and used through normal public-server play");
    assert.equal(await host.evaluate(() => view.phase), "turn");
    await host.screenshot({ path: "/tmp/deployed-landscape.png" });
    const identity = await pages[3].evaluate(() => ({
      me: view.me,
      revision: view.revision,
      code: online.code,
      token: online.token,
      lastCard: view.events.findLast((event) => event.kind === "card")?.card,
    }));
    await pages[3].addInitScript(() => {
      window.replayedCasts = [];
      document.addEventListener("DOMContentLoaded", () => {
        new MutationObserver((records) => {
          for (const record of records)
            for (const node of record.addedNodes)
              if (node.nodeType === 1 && (node.classList.contains("fx-cast") || node.classList.contains("duel-fx")))
                window.replayedCasts.push(node.textContent);
        }).observe(document.querySelector("#effects"), { childList: true });
      }, { once: true });
    });
    await pages[3].reload();
    await pages[3].waitForFunction(
      (me) => view?.online && view.me === me,
      identity.me,
      { timeout: 30000 },
    );
    const rejoined = await pages[3].evaluate(() => ({
      me: view.me,
      revision: view.revision,
      code: online.code,
      token: online.token,
    }));
    assert.equal(rejoined.me, identity.me);
    assert.equal(rejoined.code, identity.code);
    assert.equal(rejoined.revision, identity.revision);
    assert(rejoined.token === identity.token, "Resume token changed");
    await pages[3].waitForTimeout(1500);
    assert.deepEqual(await pages[3].evaluate(() => window.replayedCasts), []);
    assert.deepEqual(await pages[3].evaluate(() => publicSounds), []);
    assert(await pages[3].evaluate((id) =>
      document.querySelector("#played-slot").textContent.includes(CARDS[id - 1].name),
    identity.lastCard));
    console.log(
      "PASS reload restores identity, revision and latest-card description without replaying historical effects",
    );
    for (let i = 1; i < 5; i++) {
      if (await pages[i].locator("#result-dialog").evaluate((x) => x.open)) {
        const watch = pages[i].locator("#result-watch");
        await (await watch.isVisible() ? watch : pages[i].locator("#result-close")).click();
      }
      await pages[i].click("#menu-open");
      await pages[i].click("#new-game");
      for (let attempt = 0; attempt < 3; attempt++) {
        await pages[i]
          .locator("#choice-actions button")
          .filter({ hasText: "나가기" })
          .click();
        try {
          await pages[i].waitForFunction(() => !online, null, {
            timeout: 15000,
          });
          break;
        } catch (error) {
          if (attempt === 2) throw error;
          assert(
            await pages[i].evaluate(() => !!online),
            "Failed leave must preserve online identity",
          );
          console.log("Retrying rejected resignation through the retained UI");
        }
      }
      await host.waitForFunction((id) => view.players[id].hp === 0, i, {
        timeout: 30000,
      });
    }
    await host.waitForFunction(() => view.phase === "over", null, {
      timeout: 30000,
    });
    assert.equal(await host.evaluate(() => view.winner), 0);
    await host.waitForFunction(() => {
      const dialog = document.querySelector("#result-dialog");
      return dialog.open && dialog.dataset.outcome === "win";
    });
    assert((await host.locator("#result-title").innerText()).trim());
    assert.equal(await host.evaluate(() => publicSounds.filter((cue) => cue === "win").length), 1);
    await host.screenshot({ path: "/tmp/deployed-result.png", animations: "disabled" });
    await host.click("#result-close");
    await host.waitForTimeout(1500);
    assert.equal(await host.locator("#result-dialog").evaluate((x) => x.open), false);
    await host.click("#result-reopen");
    assert.equal(await host.locator("#result-dialog").getAttribute("data-outcome"), "win");
    assert.equal(await host.evaluate(() => publicSounds.filter((cue) => cue === "win").length), 1);
    console.log(
      "PASS four UI resignations produce public-server victory, a winner dialog and intentional result reopen without polling reopen",
    );
    assert.deepEqual(errors, []);
    console.log("PASS no browser JavaScript errors");
  } catch (e) {
    console.error(e);
    for (const p of pages)
      console.error(
        "UI state",
        await p.evaluate(() => ({
          toast: document.querySelector("#toast")?.textContent,
          lobby: document.querySelector("#lobby-dialog")?.open,
          transport: typeof transport !== "undefined" ? transport : "unknown",
        })),
      );
    process.exitCode = 1;
  } finally {
    // Explicitly leave any surviving test identities; never expose their tokens.
    await Promise.allSettled(
      pages.map((p) =>
        p.evaluate(async () => {
          if (online) {
            streamAbort?.abort();
            await api("/api/leave").catch(() => {});
            online = null;
          }
        }),
      ),
    );
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
