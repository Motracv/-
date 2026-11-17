const { test } = require("node:test"), assert = require("node:assert/strict");
const { fixture } = require("./account-fixture.cjs");
test("unconfigured auth stays closed and guest play works; account requests require allowed origins", async () => {
  const t = await fixture(); delete t.env.GOOGLE_CLIENT_ID;
  assert.equal((await t.call("/api/account/config")).data.enabled, false);
  assert.equal((await t.call("/api/account/challenge")).status, 503);
  assert.equal((await t.call("/api/create", { name: "guest", accountId: "forged" })).status, 200);
  assert.equal((await t.call("/api/account/challenge", {}, null, { Origin: "https://evil.test" })).status, 403);
  assert.equal(t.sqlite.prepare("SELECT COUNT(*) n FROM accounts").get().n, 0);
});
test("signed Google JWT creates one private account; multiple devices share progress; tokens are hashed", async () => {
  const t = await fixture(), a = await t.login(), b = await t.login();
  assert.equal(a.status, 200); assert.equal(b.status, 200);
  assert.equal(a.data.profile.id, b.data.profile.id); assert.notEqual(a.data.token, b.data.token);
  assert.equal(a.data.profile.level, 1); assert.equal(a.data.profile.xp, 0);
  assert.equal(t.keyReads(), 1);
  const stored = JSON.stringify(t.sqlite.prepare("SELECT * FROM accounts").all()) + JSON.stringify(t.sqlite.prepare("SELECT * FROM account_sessions").all());
  for (const secret of [a.data.token, b.data.token, "google-person-0", "never-store@example.test", "Never Publish Real Name"]) assert(!stored.includes(secret));
  assert(!JSON.stringify(a.data).includes("never-store"));
  assert.equal((await t.call("/api/account/me", {}, a.data.token)).data.profile.id, b.data.profile.id);
  assert.equal((await t.call("/api/account/logout", {}, a.data.token)).status, 200);
  assert.equal((await t.call("/api/account/me", {}, a.data.token)).status, 401);
  assert.equal((await t.call("/api/account/me", {}, b.data.token)).status, 200);
});
test("issuer, audience, expiry, nonce, algorithm and signatures cannot be forged; nonce is consumed once", async () => {
  const t = await fixture(), nonce = (await t.call("/api/account/challenge")).data.nonce;
  for (const [claims, header] of [
    [{ iss: "https://evil.test" }, {}], [{ aud: "other.apps.googleusercontent.com" }, {}],
    [{ exp: Math.floor(Date.now() / 1000) - 1 }, {}], [{ nonce: "0".repeat(64) }, {}],
    [{ azp: "different-client" }, {}], [{ sub: "" }, {}], [{}, { alg: "HS256" }],
  ]) {
    const credential = await t.credential(nonce, "person", claims, header);
    assert.equal((await t.call("/api/account/google", { nonce, credential })).status, 401);
  }
  const valid = await t.credential(nonce), parts = valid.split(".");
  parts[2] = (parts[2][0] === "A" ? "B" : "A") + parts[2].slice(1);
  assert.equal((await t.call("/api/account/google", { nonce, credential: parts.join(".") })).status, 401);
  const results = await Promise.all([t.call("/api/account/google", { nonce, credential: valid }), t.call("/api/account/google", { nonce, credential: valid })]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 401]);
  assert.equal(t.sqlite.prepare("SELECT COUNT(*) n FROM account_sessions").get().n, 1);
});
test("expired challenges/sessions and credential types are rejected", async () => {
  const t = await fixture(), nonce = (await t.call("/api/account/challenge")).data.nonce;
  t.sqlite.prepare("UPDATE login_challenges SET expires=0").run();
  assert.equal((await t.call("/api/account/google", { nonce, credential: await t.credential(nonce) })).status, 401);
  const a = await t.login(); t.sqlite.prepare("UPDATE account_sessions SET expires=0").run();
  assert.equal((await t.call("/api/account/me", {}, a.data.token)).status, 401);
  assert.equal((await t.call("/api/create", { name: "P", accountId: a.data.profile.id }, null, { "X-Account-Session": a.data.profile.id })).status, 401);
  const guest = await t.call("/api/create", { name: "P", accountId: a.data.profile.id });
  assert.equal((await t.call("/api/account/me", {}, guest.data.token)).status, 401);
  assert.equal(t.read(guest.data.code).members[0].accountId, undefined);
});
test("five signed players expose only nickname/level and their own progression; duplicate accounts cannot join", async () => {
  const t = await fixture(), { members, signed, code } = await t.room(5);
  for (let i = 0; i < 5; i++) {
    const r = (await t.call("/api/state", {}, members[i].token)).data;
    assert.equal(r.game.players.filter(p => p.hand).length, 1);
    assert(r.players.every(p => p.level === 1 && !p.accountId));
    assert.equal(r.progression.accountId, signed[i].profile.id);
    for (let j = 0; j < 5; j++) if (j !== i) {
      assert(!JSON.stringify(r).includes(signed[j].profile.id));
      assert(!JSON.stringify(r).includes(signed[j].token));
    }
  }
  const created = await t.call("/api/create", { name: "same" }, null, { "X-Account-Session": signed[0].token });
  const duplicate = await t.call("/api/join", { name: "again", code: created.data.code }, null, { "X-Account-Session": signed[0].token });
  assert.equal(duplicate.status, 400); assert.match(duplicate.data.error, /같은 계정/);
  assert.equal(t.read(code).members.length, 5);
});
test("concurrent lethal actions award server results exactly once; reloads and posted XP cannot add rewards", async () => {
  const t = await fixture(), { members, signed, code } = await t.room();
  const input = { ...t.finishSetup(code), xp: 99999, winner: 1, accountActions: 99999 };
  const actions = await Promise.all([t.call("/api/action", input, members[0].token), t.call("/api/action", input, members[0].token)]);
  assert.equal(actions.filter(r => r.status === 200).length, 1);
  const polls = await Promise.all(Array.from({ length: 15 }, (_, i) => t.call("/api/state", {}, members[i % 2].token)));
  assert(polls.every(r => r.status === 200));
  assert.equal(polls[0].data.progression.xp, 80);
  assert.equal(polls[1].data.progression.xp, 30);
  assert.equal(t.sqlite.prepare("SELECT COUNT(*) n FROM match_awards").get().n, 2);
  assert.equal((await t.call("/api/account/me", { xp: 99999 }, signed[0].token)).data.profile.xp, 80);
  assert.equal((await t.call("/api/account/award", { xp: 99999 }, signed[0].token)).status, 404);
  assert.equal(t.read(code).members[0].accountActions, 3);
  const second = await t.room();
  await t.call("/api/action", t.finishSetup(second.code), second.members[0].token);
  const p = (await t.call("/api/account/me", {}, signed[0].token)).data.profile;
  assert.equal(p.xp, 160); assert.equal(p.level, 2); assert.equal(p.levelXp, 60); assert.equal(p.requiredXp, 150);
  assert.equal(p.matches, 2); assert.equal(p.wins, 2);
});
test("a committed result recovers after award storage fails, without missing or duplicate XP", async () => {
  const t = await fixture(), { members, signed, code } = await t.room();
  const input = t.finishSetup(code); t.failNextBatch();
  assert.notEqual((await t.call("/api/action", input, members[0].token)).status, 200);
  assert.equal(t.read(code).game.s.phase, "over");
  assert.equal(t.sqlite.prepare("SELECT COUNT(*) n FROM match_awards").get().n, 0);
  assert.equal((await t.call("/api/state", {}, members[0].token)).status, 200);
  assert.equal((await t.call("/api/account/me", {}, signed[0].token)).data.profile.xp, 80);
  assert.equal(t.sqlite.prepare("SELECT COUNT(*) n FROM match_awards").get().n, 2);
});
test("unsettled XP survives room expiry and recovers on account login without a room poll", async () => {
  const t = await fixture(), { members, signed, code } = await t.room();
  const input = t.finishSetup(code); t.failNextBatch();
  await t.call("/api/action", input, members[0].token);
  t.sqlite.prepare("UPDATE rooms SET expires=0 WHERE code=?").run(code);
  await t.call("/api/create", { name: "cleanup" });
  assert(t.sqlite.prepare("SELECT code FROM rooms WHERE code=?").get(code));
  assert.equal((await t.call("/api/state", {}, members[0].token)).status, 404);
  assert.equal((await t.call("/api/account/me", {}, signed[0].token)).data.profile.xp, 80);
  await t.call("/api/create", { name: "cleanup again" });
  assert.equal(t.sqlite.prepare("SELECT code FROM rooms WHERE code=?").get(code), undefined);
});
test("short games, insufficient participants, inactivity and forfeits get no XP; stats still record server outcome", async () => {
  for (const mode of ["short", "accounts", "inactive", "forfeit", "disconnect"]) {
    const t = await fixture(), { code, members, signed } = await t.room(2, mode === "accounts" ? 1 : 2);
    const input = t.finishSetup(code, { elapsed: mode === "short" ? 0 : 61000, actions: mode === "inactive" ? 0 : 2 });
    if (mode === "forfeit") await t.call("/api/leave", {}, members[0].token);
    else if (mode === "disconnect") {
      const saved = t.read(code); saved.members[0].lastSeen = Date.now() - 91000; t.write(code, saved);
      await t.call("/api/state", {}, members[1].token);
    } else await t.call("/api/action", input, members[0].token);
    const p = (await t.call("/api/account/me", {}, signed[0].token)).data.profile;
    assert.equal(p.xp, 0, mode); assert.equal(p.matches, 1, mode);
    const award = t.sqlite.prepare("SELECT * FROM match_awards WHERE account_id=?").get(p.id);
    assert.equal(award.reason, mode === "disconnect" ? "forfeit" : mode);
  }
});
test("account deletion removes all devices and progress; rejoining creates a fresh account", async () => {
  const t = await fixture(), { members, signed, code } = await t.room();
  await t.call("/api/action", t.finishSetup(code), members[0].token);
  const device2 = await t.login("room-person-0"), oldId = signed[0].profile.id;
  assert.equal((await t.call("/api/account/delete", {}, signed[0].token)).status, 400);
  assert.equal((await t.call("/api/account/delete", { confirm: "DELETE" }, signed[0].token)).status, 200);
  assert.equal((await t.call("/api/account/me", {}, device2.data.token)).status, 401);
  assert.equal(t.sqlite.prepare("SELECT COUNT(*) n FROM match_awards WHERE account_id=?").get(oldId).n, 0);
  const fresh = await t.login("room-person-0");
  assert.notEqual(fresh.data.profile.id, oldId); assert.equal(fresh.data.profile.xp, 0);
  await t.call("/api/state", {}, members[0].token);
  assert.equal((await t.call("/api/account/me", {}, fresh.data.token)).data.profile.xp, 0);
});
test("a simultaneous draw pays 40 each, and normally eliminated spectators may leave without forfeiting rewards", async () => {
  const t = await fixture(), { members, signed, code } = await t.room();
  t.finishSetup(code);
  const saved = t.read(code), game = saved.game.s;
  game.players[0].hp = game.players[1].hp = 30;
  game.players[0].hand[0].id = 36; t.write(code, saved);
  await t.call("/api/action", { kind: "play", card: game.players[0].hand[0].uid, target: 1, revision: game.revision }, members[0].token);
  for (const account of signed) {
    const p = (await t.call("/api/account/me", {}, account.token)).data.profile;
    assert.equal(p.xp, 40); assert.equal(p.draws, 1);
  }
  const other = await t.room(3); const input = t.finishSetup(other.code);
  await t.call("/api/leave", {}, other.members[2].token);
  assert(!t.read(other.code).members[2].forfeited);
  await t.call("/api/action", input, other.members[0].token);
  assert.equal((await t.call("/api/account/me", {}, other.signed[2].token)).data.profile.xp, 30);
});
test("level thresholds and titles are stable without affecting combat rules", async () => {
  const { accountLevel } = await import("../online/accounts.mjs");
  for (const [xp, level, progress] of [[0, 1, 0], [99, 1, 99], [100, 2, 0], [249, 2, 149], [250, 3, 0], [700, 5, 0]]) {
    const p = accountLevel(xp); assert.equal(p.level, level); assert.equal(p.levelXp, progress);
  }
  assert.equal(accountLevel(700).title, "도전자");
  assert.equal(require("../engine.js").MAX_HP, 100);
});
