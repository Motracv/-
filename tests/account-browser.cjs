// Browser integration with test-signed credentials, not a claim of real Google OAuth validation.
const { chromium } = require("playwright"), assert = require("node:assert/strict");
const http = require("node:http"), fs = require("node:fs"), path = require("node:path");
const { fixture } = require("./account-fixture.cjs");
(async () => {
  const t = await fixture(), origin = "http://127.0.0.1:8797";
  t.env.ALLOWED_ORIGIN = origin;
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, origin);
      if (url.pathname.startsWith("/api/") || url.pathname === "/health") {
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        const body = Buffer.concat(chunks);
        const response = await t.worker.fetch(new Request(url, { method: req.method, headers: req.headers,
          ...(req.method === "GET" || req.method === "OPTIONS" ? {} : { body }) }), t.env);
        res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer())); return;
      }
      const relative = url.pathname.slice(1);
      if (!/^(game\.html|game\.css|client\.js|account\.js|privacy\.html|engine\.js|effects\.(js|css)|sound\.js|assets\/cards\/manifest\.json|assets\/fonts\/PretendardVariable\.woff2)$/.test(relative)) {
        res.writeHead(404); res.end(); return;
      }
      const ext = path.extname(relative), types = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".json": "application/json", ".woff2": "font/woff2" };
      res.writeHead(200, { "Content-Type": types[ext] }); res.end(fs.readFileSync(path.join(__dirname, "..", relative)));
    } catch (error) { res.writeHead(500); res.end(error.message); }
  });
  await new Promise(resolve => server.listen(8797, "127.0.0.1", resolve));
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] });
  const errors = [], pages = [];
  let googleLoads = 0;
  async function pageFor(person, width = 844, height = 390) {
    const context = await browser.newContext({ viewport: { width, height } });
    await context.exposeBinding("testGoogleCredential", (_, nonce) => t.credential(nonce, person));
    await context.route("https://accounts.google.com/gsi/client", async route => {
      googleLoads++;
      await route.fulfill({ contentType: "text/javascript", body: `window.google={accounts:{id:{initialize(options){this.options=options},renderButton(container){const button=document.createElement('button');button.id='test-google-login';button.textContent='Google로 로그인 (테스트 인증)';button.onclick=async()=>this.options.callback({credential:await window.testGoogleCredential(this.options.nonce)});container.append(button)},disableAutoSelect(){}}}};` });
    });
    const page = await context.newPage(); page.on("pageerror", e => errors.push(e.message));
    await page.goto(origin + "/game.html"); pages.push(page); return page;
  }
  async function signIn(page) {
    await page.click("#menu-open"); await page.click("#account-open");
    await page.click("#test-google-login"); await page.waitForSelector("#account-member:not([hidden])");
  }
  try {
    const p = await pageFor("browser-person-0");
    assert.equal(googleLoads, 0, "The Google SDK is lazy");
    await signIn(p);
    assert.equal(await p.locator("#account-level").innerText(), "Lv.1");
    const firstAccount = t.sqlite.prepare("SELECT id FROM accounts").get().id;
    t.sqlite.prepare("INSERT INTO match_awards VALUES (?, ?, ?, ?, ?, ?)").run("prior-fixture-match", firstAccount, 80, "win", "complete", Date.now());
    await p.click("#account-dialog [data-close]"); await p.click("#menu-open"); await p.click("#account-open");
    await p.waitForFunction(() => document.getElementById("account-xp-text").textContent.includes("누적 80"));
    await p.click("#account-dialog [data-close]");
    await p.reload(); await p.click("#menu-open"); await p.click("#account-open");
    await p.waitForFunction(() => document.getElementById("account-xp-text").textContent.includes("누적 80"));
    assert.equal(await p.locator("#google-button button").count(), 0);
    await p.click("#account-dialog [data-close]");
    console.log("PASS Google callback plumbing with signed fixture; persisted session restores server profile, SDK remains lazy");
    for (let i = 1; i < 5; i++) {
      const page = await pageFor("browser-person-" + i); await signIn(page); await page.click("#account-dialog [data-close]");
    }
    await p.click("#online-open"); await p.fill("#nickname", "플레이어0"); await p.click("#create-room");
    await p.waitForSelector("#lobby-dialog[open]"); const code = await p.locator("#invite-code").innerText();
    for (let i = 1; i < 5; i++) {
      const page = pages[i]; await page.click("#online-open"); await page.fill("#nickname", "플레이어" + i);
      await page.fill("#room-code", code); await page.click("#join-room"); await page.waitForSelector("#lobby-dialog[open]");
    }
    await p.waitForFunction(() => document.querySelectorAll("#lobby-players li").length === 5);
    assert.match(await p.locator("#lobby-players").innerText(), /Lv.1/);
    await p.click("#start-room"); await Promise.all(pages.slice(0, 5).map(page => page.waitForFunction(() => view?.online)));
    for (const page of pages.slice(0, 5)) {
      assert.equal(await page.evaluate(() => view.players.filter(p => p.hand).length), 1);
      assert.equal(await page.locator(".fighter-level").count(), 5);
    }
    for (let i = 0; i < 5; i++) {
      await pages[i].waitForFunction(i => view.turn === i, i);
      await pages[i].click("#pass");
    }
    assert(t.read(code).members.every(m => !m.accountActions), "Passes do not count as card participation");
    t.finishSetup(code);
    await p.waitForFunction(() => self().hand.some(c => c.id === 31) && view.players[1].hp === 8);
    await p.click('#hand .card[data-card="31"]'); await p.click('#opponents [data-player="1"]'); await p.click("#play");
    await Promise.all(pages.slice(0, 5).map(page => page.waitForFunction(() => view.phase === "over")));
    await p.waitForFunction(() => document.getElementById("result-xp").textContent.includes("LEVEL UP!"));
    assert.match(await p.locator("#result-xp").innerText(), /\+80 XP · Lv.2/);
    for (const page of pages.slice(1, 5)) {
      await page.waitForFunction(() => document.getElementById("result-xp").textContent.includes("+30 XP"));
    }
    const before = t.sqlite.prepare("SELECT COUNT(*) n FROM match_awards").get().n;
    await p.reload(); await p.waitForFunction(() => view?.online && view.phase === "over");
    await p.waitForFunction(() => document.getElementById("result-xp").textContent.includes("+80 XP"));
    assert(!(await p.locator("#result-xp").innerText()).includes("LEVEL UP!"), "Restoring a finished match must not replay a historical level-up");
    assert.equal(t.sqlite.prepare("SELECT COUNT(*) n FROM match_awards").get().n, before);
    console.log("PASS five independent signed browser sessions: private hands, visible levels, UI turns, synced result XP, one level-up and reload deduplication");
    const secondDevice = await pageFor("browser-person-0", 568, 280); await signIn(secondDevice);
    assert.equal(await secondDevice.locator("#account-level").innerText(), "Lv.2");
    assert.match(await secondDevice.locator("#account-xp-text").innerText(), /누적 160/);
    await secondDevice.locator("#account-dialog [data-close]").scrollIntoViewIfNeeded();
    const bounds = await secondDevice.locator("#account-dialog [data-close]").boundingBox();
    assert(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 568 && bounds.y + bounds.height <= 280);
    await secondDevice.click("#account-dialog [data-close]");
    const clipped = await secondDevice.evaluate(() => [document.getElementById("hand"), document.querySelector(".action-tray")].some(el => { const r = el.getBoundingClientRect(); return r.bottom > innerHeight || r.left < 0 || r.right > innerWidth; }));
    assert.equal(clipped, false);
    await secondDevice.click("#menu-open"); await secondDevice.click("#account-open"); await secondDevice.click("#account-logout");
    await secondDevice.waitForSelector("#account-guest:not([hidden])");
    assert.equal(t.sqlite.prepare("SELECT COUNT(*) n FROM account_sessions WHERE account_id=?").get(firstAccount).n, 1);
    console.log("PASS second browser retrieves same Lv.2; compact mobile account/hand/actions fit; logout revokes just that device");
    delete t.env.GOOGLE_CLIENT_ID;
    const disabled = await pageFor("unconfigured", 568, 320), loads = googleLoads;
    await disabled.click("#menu-open"); await disabled.click("#account-open");
    await disabled.waitForFunction(() => document.getElementById("account-status").textContent.includes("준비 중"));
    assert.equal(googleLoads, loads); assert.equal(await disabled.locator("#test-google-login").count(), 0);
    await disabled.click("#account-dialog [data-close]");
    await disabled.click("#online-open"); await disabled.fill("#nickname", "게스트"); await disabled.click("#create-room");
    await disabled.waitForSelector("#lobby-dialog[open]");
    console.log("PASS absent client ID shows an honest pending state, never a fake Google login; guest room creation remains functional");
    assert.deepEqual(errors, []); console.log("PASS zero browser JavaScript errors");
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
