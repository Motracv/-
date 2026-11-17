// Test-only Google signing authority. Production always fetches Google's HTTPS JWKS.
const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs"), path = require("node:path");
const Battle = require("../engine.js");
const CLIENT_ID = "123-card-test.apps.googleusercontent.com";
async function fixture({ keysResponse } = {}) {
  const { createWorker } = await import("../online/worker.mjs");
  const { createAccounts } = await import("../online/accounts.mjs");
  const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const jwk = { ...await crypto.subtle.exportKey("jwk", pair.publicKey), kid: "fixture-google-key", alg: "RS256", use: "sig" };
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  for (const file of ["0001_rooms.sql", "0002_accounts.sql", "0003_school.sql"]) sqlite.exec(fs.readFileSync(path.join(__dirname, "../online/migrations", file), "utf8"));
  let failBatch = false, keyReads = 0;
  const db = {
    prepare(sql) {
      const statement = args => ({
        bind: (...next) => statement(next),
        first: async () => sqlite.prepare(sql).get(...args) || null,
        all: async () => ({ results: sqlite.prepare(sql).all(...args) }),
        run: async () => ({ meta: { changes: sqlite.prepare(sql).run(...args).changes } }),
        execute: () => ({ meta: { changes: sqlite.prepare(sql).run(...args).changes } }),
      });
      return statement([]);
    },
    async batch(statements) {
      if (failBatch) { failBatch = false; throw Error("Simulated storage interruption"); }
      sqlite.exec("BEGIN");
      try { const results = statements.map(s => s.execute()); sqlite.exec("COMMIT"); return results; }
      catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  };
  const accounts = createAccounts({ fetchKeys: async (url, options) => {
    // Cloudflare Workers supports follow/manual, but throws before the network
    // request for redirect:error. Node's fetch accepts it, hiding this failure.
    if (options?.redirect === "error") throw new TypeError("Unsupported redirect mode: error");
    if (options?.redirect !== "manual") throw Error("Google keys must not follow redirects");
    if (url !== "https://www.googleapis.com/oauth2/v3/certs") throw Error("Unexpected certificate origin");
    keyReads++; return keysResponse || new Response(JSON.stringify({ keys: [jwk] }), { headers: { "Cache-Control": "max-age=3600" } });
  } });
  const worker = createWorker(Battle, { accounts });
  const env = { DB: db, GOOGLE_CLIENT_ID: CLIENT_ID };
  async function call(route, data = {}, token, headers = {}) {
    const get = ["/health", "/api/account/config"].includes(route);
    const response = await worker.fetch(new Request("https://card.example" + route, {
      method: get ? "GET" : "POST", headers: { "Content-Type": "application/json", Origin: "https://motracv.github.io", ...(token ? { Authorization: "Bearer " + token } : {}), ...headers },
      ...(get ? {} : { body: JSON.stringify(data) }),
    }), env);
    return { status: response.status, data: await response.json(), headers: response.headers };
  }
  async function credential(nonce, sub = "google-person-0", claims = {}, header = {}) {
    const now = Math.floor(Date.now() / 1000);
    const encode = data => Buffer.from(JSON.stringify(data)).toString("base64url");
    const input = encode({ alg: "RS256", kid: jwk.kid, typ: "JWT", ...header }) + "." + encode({ iss: "https://accounts.google.com", aud: CLIENT_ID, iat: now, exp: now + 3600, sub, nonce, email: "never-store@example.test", name: "Never Publish Real Name", ...claims });
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, Buffer.from(input));
    return input + "." + Buffer.from(signature).toString("base64url");
  }
  async function login(sub = "google-person-0") {
    const challenge = await call("/api/account/challenge");
    if (challenge.status !== 200) throw Error(JSON.stringify(challenge.data));
    return call("/api/account/google", { nonce: challenge.data.nonce, credential: await credential(challenge.data.nonce, sub) });
  }
  const read = code => JSON.parse(sqlite.prepare("SELECT payload FROM rooms WHERE code=?").get(code).payload);
  function write(code, room) { sqlite.prepare("UPDATE rooms SET payload=?, version=version+1 WHERE code=?").run(JSON.stringify(room), code); }
  async function room(count = 2, signedCount = count) {
    const signed = [], members = [];
    for (let i = 0; i < count; i++) {
      const account = i < signedCount ? (await login("room-person-" + i)).data : null;
      signed.push(account);
      const r = await call(i ? "/api/join" : "/api/create", { name: "P" + i, code: members[0]?.code }, null, account ? { "X-Account-Session": account.token } : {});
      if (r.status !== 200) throw Error(JSON.stringify(r.data));
      members.push(r.data);
    }
    await call("/api/start", {}, members[0].token);
    return { members, signed, code: members[0].code };
  }
  function finishSetup(code, { elapsed = 61000, actions = 2 } = {}) {
    const saved = read(code), g = new Battle.Game(saved.members.map(m => m.name), { rng: () => 0 });
    g.s.revision = (saved.game?.s.revision || 0) + 1;
    for (const p of g.s.players) { p.hand = []; if (p.id > 1) p.hp = 0; }
    g.player(1).hp = 8; const card = g.card(31); g.player(0).hand = [card];
    saved.game = JSON.parse(JSON.stringify(g)); saved.startedAt = Date.now() - elapsed;
    for (const m of saved.members) { m.accountActions = actions; m.lastAction = 0; }
    write(code, saved);
    return { kind: "play", card: card.uid, target: 1, revision: g.s.revision };
  }
  return { worker, accounts, env, db, sqlite, call, credential, login, read, write, room, finishSetup,
    failNextBatch: () => { failBatch = true; }, keyReads: () => keyReads };
}
module.exports = { fixture, CLIENT_ID };
