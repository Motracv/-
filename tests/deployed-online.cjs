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
            !/^(game\.html|engine\.js|client\.js|game\.css|assets\/cards\/manifest\.json|assets\/fonts\/(PretendardVariable\.woff2|OFL\.txt))$/.test(
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
    await host.screenshot({ path: "/tmp/deployed-landscape.png" });
    const identity = await pages[3].evaluate(() => ({
      me: view.me,
      revision: view.revision,
      code: online.code,
      token: online.token,
    }));
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
    console.log(
      "PASS reload restores the same public-server identity and revision",
    );
    for (let i = 1; i < 5; i++) {
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
    console.log(
      "PASS four UI resignations produce last-survivor victory on public server",
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
