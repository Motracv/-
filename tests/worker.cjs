"use strict";
const { test, before } = require("node:test"),
  assert = require("node:assert/strict"),
  { DatabaseSync } = require("node:sqlite"),
  fs = require("node:fs");
const Battle = require("../engine.js");
let createWorker;
before(async () => {
  ({ createWorker } = await import("../online/worker.mjs"));
});
function setup() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    fs.readFileSync(
      require.resolve("../online/migrations/0001_rooms.sql"),
      "utf8",
    ),
  );
  const counters = { conflicts: 0, updates: 0 };
  const db = {
    prepare(sql) {
      return {
        bind(...args) {
          return (this.bound = {
            first: async () => sqlite.prepare(sql).get(...args),
            run: async () => {
              const result = sqlite.prepare(sql).run(...args);
              if (sql.startsWith("UPDATE") && result.changes === 1)
                counters.updates++;
              if (sql.startsWith("UPDATE") && result.changes === 0)
                counters.conflicts++;
              return { meta: { changes: result.changes } };
            },
          });
        },
        first: async () => sqlite.prepare(sql).get(),
      };
    },
  };
  const worker = createWorker(Battle);
  async function call(route, data = {}, token, headers = {}) {
    const result = await worker.fetch(
      new Request("https://card.example" + route, {
        method: route === "/health" ? "GET" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: "Bearer " + token } : {}),
          ...headers,
        },
        ...(route === "/health" ? {} : { body: JSON.stringify(data) }),
      }),
      { DB: db },
    );
    return {
      status: result.status,
      data: await result.json(),
      headers: result.headers,
    };
  }
  const read = (code) =>
    JSON.parse(
      sqlite.prepare("SELECT payload FROM rooms WHERE code=?").get(code)
        .payload,
    );
  function write(code, room) {
    sqlite
      .prepare("UPDATE rooms SET payload=?, version=version+1 WHERE code=?")
      .run(JSON.stringify(room), code);
  }
  function fixture(code, build) {
    const room = read(code),
      g = new Battle.Game(
        room.members.map((m) => m.name),
        { rng: () => 0 },
      );
    for (const p of g.s.players) p.hand = [];
    build(g);
    room.game = JSON.parse(JSON.stringify(g));
    write(code, room);
    return g;
  }
  async function room(n = 5, start = true) {
    const created = await call("/api/create", { name: "P0" }),
      code = created.data.code,
      members = [created.data];
    for (let i = 1; i < n; i++)
      members.push((await call("/api/join", { code, name: "P" + i })).data);
    if (start)
      assert.equal(
        (await call("/api/start", {}, members[0].token)).status,
        200,
      );
    return { code, members };
  }
  return { db, sqlite, counters, call, read, write, fixture, room };
}
function give(g, id, ...cards) {
  return cards.map((n) => {
    const c = g.card(n);
    g.player(id).hand.push(c);
    return c;
  });
}
test("poll health/CORS, five-player capacity and private persisted state", async () => {
  const t = setup(),
    { code, members } = await t.room();
  assert.equal((await t.call("/health")).data.transport, "poll");
  assert.equal(
    (
      await t.call("/api/state", {}, members[0].token, {
        Origin: "https://motracv.github.io",
      })
    ).headers.get("Access-Control-Allow-Origin"),
    "https://motracv.github.io",
  );
  assert.equal(
    (
      await t.call("/api/state", {}, members[0].token, {
        Origin: "https://evil.example",
      })
    ).status,
    403,
  );
  assert.equal((await t.call("/api/join", { name: "P5", code })).status, 400);
  for (const member of members) {
    const r = await t.call("/api/state", {}, member.token);
    assert.equal(r.status, 200);
    assert.equal(r.data.game.players.filter((p) => p.hand).length, 1);
    assert(!JSON.stringify(r.data).includes(member.token));
    assert(!("serial" in r.data.game));
  }
  assert.equal(
    (await t.call("/api/state", {}, code + "." + "0".repeat(48))).status,
    401,
  );
});
test("concurrent lobby joins use CAS and never admit a sixth seat", async () => {
  const t = setup(),
    { code } = await t.room(1, false);
  const results = await Promise.all(
    Array.from({ length: 7 }, (_, i) =>
      t.call("/api/join", { code, name: "J" + i }),
    ),
  );
  assert.equal(results.filter((r) => r.status === 200).length, 4);
  assert.equal(t.read(code).members.length, 5);
  assert(t.counters.conflicts > 0);
  assert.deepEqual(
    t.read(code).members.map((m) => m.id),
    [0, 1, 2, 3, 4],
  );
});
test("concurrent actions commit once; wrong turns and stale revisions fail", async () => {
  const t = setup(),
    { code, members } = await t.room();
  const rev = t.read(code).game.s.revision;
  const results = await Promise.all([
    t.call("/api/action", { kind: "pass", revision: rev }, members[0].token),
    t.call("/api/action", { kind: "pass", revision: rev }, members[0].token),
  ]);
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.equal(t.read(code).game.s.revision, rev + 1);
  assert(t.counters.conflicts > 0);
  assert.equal(
    (
      await t.call(
        "/api/action",
        { kind: "pass", revision: rev },
        members[1].token,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await t.call(
        "/api/action",
        { kind: "pass", revision: rev + 1 },
        members[3].token,
      )
    ).status,
    400,
  );
});
test("restored pending reaction and random damage agree in all five views", async () => {
  const t = setup(),
    { code, members } = await t.room();
  let attack, counter;
  const g = t.fixture(code, (g) => {
    [attack] = give(g, 0, 11);
    [counter] = give(g, 1, 2);
  });
  let r = await t.call(
    "/api/action",
    { kind: "play", card: attack.uid, target: 1, revision: g.s.revision },
    members[0].token,
  );
  assert.equal(r.status, 200);
  assert.equal(r.data.game.phase, "react");
  r = await t.call(
    "/api/action",
    { kind: "react", card: counter.uid, revision: r.data.game.revision },
    members[1].token,
  );
  assert.equal(r.status, 200);
  for (const m of members) {
    const state = (await t.call("/api/state", {}, m.token)).data.game;
    assert.deepEqual(
      state.players.slice(0, 2).map((p) => p.hp),
      [Battle.MAX_HP - 25, Battle.MAX_HP],
    );
  }
});
test("06 reveal is private across persisted polling and selected theft", async () => {
  const t = setup(),
    { code, members } = await t.room();
  let card;
  const g = t.fixture(code, (g) => {
    [card] = give(g, 0, 6);
    give(g, 1, 7, 8);
    give(g, 2, 9);
  });
  let result = await t.call(
    "/api/action",
    { kind: "play", card: card.uid, revision: g.s.revision },
    members[0].token,
  );
  assert.equal(result.status, 200);
  for (let i = 0; i < 5; i++) {
    const view = (await t.call("/api/state", {}, members[i].token)).data.game;
    assert.equal(view.players.filter((p) => p.hand).length, i === 0 ? 5 : 1);
  }
  const room = t.read(code);
  room.members[0].lastAction = 0;
  t.write(code, room);
  result = await t.call(
    "/api/action",
    {
      kind: "steal",
      cards: g.player(1).hand.map((c) => c.uid),
      revision: result.data.game.revision,
    },
    members[0].token,
  );
  assert.equal(result.status, 200);
  assert.equal(result.data.game.players.filter((p) => p.hand).length, 1);
  assert.deepEqual(
    result.data.game.players[0].hand.map((c) => c.id),
    [7, 8],
  );
});
test("deadline timeout and disconnect forfeit run on polls; finished winner stable", async () => {
  const t = setup(),
    { code, members } = await t.room();
  let card;
  const g = t.fixture(code, (g) => {
    g.player(0).hp = 30;
    [card] = give(g, 0, 3);
  });
  await t.call(
    "/api/action",
    { kind: "play", card: card.uid, target: 1, revision: g.s.revision },
    members[0].token,
  );
  let saved = t.read(code);
  saved.game.s.deadline = Date.now() - 1;
  t.write(code, saved);
  let result = await t.call("/api/state", {}, members[0].token);
  assert.equal(result.data.game.players[0].hp, 38);
  assert.equal(result.data.game.phase, "turn");
  saved = t.read(code);
  saved.members[1].lastSeen = Date.now() - 91000;
  t.write(code, saved);
  result = await t.call("/api/state", {}, members[0].token);
  assert.equal(result.data.game.players[1].hp, 0);
  for (let i = 1; i < 5; i++) await t.call("/api/leave", {}, members[i].token);
  const winner = t.read(code).game.s.winner;
  assert.equal(winner, 0);
  await t.call("/api/leave", {}, members[0].token);
  assert.equal(t.read(code).game.s.winner, winner);
  assert.equal((await t.call("/api/state", {}, members[0].token)).status, 401);
});
test("lobby host departure reindexes safely; started room cannot join; TTL expires", async () => {
  const t = setup(),
    { code, members } = await t.room(3, false);
  await t.call("/api/leave", {}, members[0].token);
  const view = (await t.call("/api/state", {}, members[1].token)).data;
  assert.equal(view.me, 0);
  assert.equal(view.host, 0);
  assert.equal((await t.call("/api/start", {}, members[1].token)).status, 200);
  assert.equal((await t.call("/api/join", { code, name: "late" })).status, 400);
  t.sqlite
    .prepare("UPDATE rooms SET expires=? WHERE code=?")
    .run(Date.now() - 1, code);
  assert.equal((await t.call("/api/state", {}, members[1].token)).status, 404);
});
test("payload and entry rate limits are enforced", async () => {
  const t = setup();
  assert.equal(
    (await t.call("/api/create", { name: "x".repeat(9000) })).status,
    413,
  );
  assert.equal((await t.call("/api/create", [])).status, 400);
  for (let i = 0; i < 30; i++)
    await t.call("/api/join", { code: "BADBAD", name: "x" });
  assert.equal((await t.call("/api/create", { name: "x" })).status, 429);
});
test("poll/action race and restored overflow continuation preserve turn and card ownership", async () => {
  const t = setup(),
    { code, members } = await t.room();
  const g = t.fixture(code, (g) => {
    give(g, 0, ...Array(8).fill(8));
    g.checkOverflow();
  });
  const uid = g.player(0).hand[0].uid;
  const results = await Promise.all([
    t.call("/api/state", {}, members[0].token),
    t.call(
      "/api/action",
      { kind: "discard", card: uid, revision: g.s.revision },
      members[0].token,
    ),
    t.call("/api/state", {}, members[1].token),
  ]);
  assert(results.every((r) => r.status === 200));
  const saved = t.read(code);
  assert.equal(saved.game.s.phase, "turn");
  assert.equal(saved.game.s.turn, 0);
  assert.equal(saved.game.s.players[0].hand.length, 7);
  assert(!saved.game.s.players[0].hand.some((c) => c.uid === uid));
  assert.equal(saved.game.s.revision, g.s.revision + 1);
});

test("five active pollers avoid heartbeat write contention while actions commit", async () => {
  const t = setup(),
    { code, members } = await t.room();
  const before = t.counters.updates;
  const revision = t.read(code).game.s.revision;
  const polls = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      t.call("/api/state", {}, members[i % 5].token),
    ),
  );
  assert(polls.every((r) => r.status === 200));
  assert.equal(
    t.counters.updates,
    before,
    "fresh polling must not write the room",
  );
  const results = await Promise.all([
    ...members.map((m) => t.call("/api/state", {}, m.token)),
    t.call("/api/action", { kind: "pass", revision }, members[0].token),
  ]);
  assert(results.every((r) => r.status === 200));
  assert.equal(t.read(code).game.s.revision, revision + 1);
  const room = t.read(code);
  room.members[2].lastSeen = Date.now() - 6000;
  t.write(code, room);
  const stale = room.members[2].lastSeen,
    updates = t.counters.updates;
  assert.equal((await t.call("/api/state", {}, members[2].token)).status, 200);
  assert(t.read(code).members[2].lastSeen > stale);
  assert.equal(
    t.counters.updates,
    updates + 1,
    "stale heartbeat persists once",
  );
});

// Persist every step through the same Worker API; resetting only the request-rate
// timestamp avoids sleeping in unit tests and never changes game rules/state.
async function actionAt(t, code, members, actor, input) {
  const room = t.read(code);
  room.members[actor].lastAction = 0;
  t.write(code, room);
  return t.call(
    "/api/action",
    { ...input, revision: room.game.s.revision },
    members[actor].token,
  );
}
async function allPrivateViews(t, members) {
  const result = [];
  for (const member of members) {
    const response = await t.call("/api/state", {}, member.token);
    assert.equal(response.status, 200);
    assert.equal(response.data.game.players.filter((p) => p.hand).length, 1);
    assert(!("serial" in response.data.game));
    assert(!JSON.stringify(response.data).includes(member.token));
    result.push(response.data.game);
  }
  return result;
}

test("32 persisted taunt redirects to its target and only that defender may respond", async () => {
  const t = setup(),
    { code, members } = await t.room();
  let taunt, attack, defend;
  t.fixture(code, (g) => {
    [taunt] = give(g, 0, 32);
    [attack] = give(g, 1, 37);
    [defend] = give(g, 2, 29);
  });
  let r = await actionAt(t, code, members, 0, {
    kind: "play",
    card: taunt.uid,
    target: 2,
  });
  assert.equal(r.status, 200);
  assert(r.data.game.players[2].status.taunt);
  r = await actionAt(t, code, members, 1, {
    kind: "play",
    card: attack.uid,
    target: 4,
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.game.phase, "react");
  assert.equal(r.data.game.pending.to, 2);
  const bad = await actionAt(t, code, members, 4, {
    kind: "react",
    card: defend.uid,
  });
  assert.equal(bad.status, 400);
  r = await actionAt(t, code, members, 2, { kind: "react", card: defend.uid });
  assert.equal(r.status, 200);
  for (const view of await allPrivateViews(t, members)) {
    assert.equal(view.players[2].hp, Battle.MAX_HP - 6);
    assert.equal(view.players[4].hp, Battle.MAX_HP);
  }
});

test("33 noCounter pending flag survives D1 restore and cannot be bypassed by a forged reaction", async () => {
  const t = setup(),
    { code, members } = await t.room();
  let counter, guard;
  t.fixture(code, (g) => {
    [counter, guard] = give(g, 1, 2, 29);
    g.attack(0, [1], 16, 33, { noCounter: true });
  });
  for (const view of await allPrivateViews(t, members)) {
    assert.equal(view.phase, "react");
    assert.equal(view.pending.noCounter, true);
  }
  const before = t.read(code).game.s.revision;
  assert.equal(
    (await actionAt(t, code, members, 1, { kind: "react", card: counter.uid }))
      .status,
    400,
  );
  assert.equal(t.read(code).game.s.revision, before);
  assert(
    t.read(code).game.s.players[1].hand.some((c) => c.uid === counter.uid),
  );
  const result = await actionAt(t, code, members, 1, {
    kind: "react",
    card: guard.uid,
  });
  assert.equal(result.status, 200);
  for (const view of await allPrivateViews(t, members))
    assert.equal(view.players[1].hp, Battle.MAX_HP - 6);
});

test("34 curse counts target turns across persisted requests and cleanses correctly", async () => {
  const t = setup(),
    { code, members } = await t.room();
  let curse, cleanse;
  t.fixture(code, (g) => {
    [curse] = give(g, 0, 34);
    [cleanse] = give(g, 1, 22);
  });
  assert.equal(
    (
      await actionAt(t, code, members, 0, {
        kind: "play",
        card: curse.uid,
        target: 1,
      })
    ).status,
    200,
  );
  assert.equal(
    (await actionAt(t, code, members, 1, { kind: "pass" })).status,
    200,
  );
  assert.equal(t.read(code).game.s.players[1].hp, Battle.MAX_HP);
  for (const actor of [2, 3, 4, 0, 1])
    assert.equal(
      (await actionAt(t, code, members, actor, { kind: "pass" })).status,
      200,
    );
  for (const view of await allPrivateViews(t, members)) {
    assert.equal(view.players[1].hp, Battle.MAX_HP - 10);
    assert(view.players[1].status.curse);
  }
  for (const actor of [2, 3, 4, 0])
    assert.equal(
      (await actionAt(t, code, members, actor, { kind: "pass" })).status,
      200,
    );
  const result = await actionAt(t, code, members, 1, {
    kind: "play",
    card: cleanse.uid,
  });
  assert.equal(result.status, 200);
  assert(!result.data.game.players[1].status.curse);
});

test("38 passive retaliation survives restore and uses one synchronized damage result", async () => {
  const t = setup(),
    { code, members } = await t.room();
  let baseball, attack;
  t.fixture(code, (g) => {
    [baseball] = give(g, 0, 38);
    [attack] = give(g, 1, 37);
  });
  let result = await actionAt(t, code, members, 0, {
    kind: "play",
    card: baseball.uid,
    target: 1,
  });
  assert.equal(result.status, 200);
  assert(result.data.game.players[0].status.baseball);
  result = await actionAt(t, code, members, 1, {
    kind: "play",
    card: attack.uid,
    target: 0,
  });
  assert.equal(result.status, 200);
  for (const view of await allPrivateViews(t, members))
    assert.deepEqual(
      view.players.slice(0, 2).map((p) => p.hp),
      [Battle.MAX_HP - 20, Battle.MAX_HP - 20],
    );
});

test("40 regeneration survives polling and heals only the next two own starts", async () => {
  const t = setup(),
    { code, members } = await t.room();
  let regen;
  t.fixture(code, (g) => {
    g.player(0).hp = 60;
    [regen] = give(g, 0, 40);
  });
  assert.equal(
    (await actionAt(t, code, members, 0, { kind: "play", card: regen.uid }))
      .status,
    200,
  );
  assert.equal(t.read(code).game.s.players[0].hp, 60);
  for (const actor of [1, 2, 3, 4])
    assert.equal(
      (await actionAt(t, code, members, actor, { kind: "pass" })).status,
      200,
    );
  assert.equal(t.read(code).game.s.players[0].hp, 65);
  for (const actor of [0, 1, 2, 3, 4])
    assert.equal(
      (await actionAt(t, code, members, actor, { kind: "pass" })).status,
      200,
    );
  for (const view of await allPrivateViews(t, members)) {
    assert.equal(view.players[0].hp, 70);
    assert(!view.players[0].status.regen);
  }
  for (const actor of [0, 1, 2, 3, 4])
    assert.equal(
      (await actionAt(t, code, members, actor, { kind: "pass" })).status,
      200,
    );
  assert.equal(t.read(code).game.s.players[0].hp, 70);
});

test("36 concurrent lethal play applies both costs once and skips eliminated seats", async () => {
  const t = setup(),
    { code, members } = await t.room();
  let attack;
  const g = t.fixture(code, (g) => {
    g.player(0).hp = 30;
    g.player(1).hp = 30;
    [attack] = give(g, 0, 36);
  });
  const input = {
    kind: "play",
    card: attack.uid,
    target: 1,
    revision: g.s.revision,
  };
  const results = await Promise.all([
    t.call("/api/action", input, members[0].token),
    t.call("/api/action", input, members[0].token),
  ]);
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  const saved = t.read(code).game.s;
  assert.deepEqual(
    saved.players.slice(0, 2).map((p) => p.hp),
    [0, 0],
  );
  assert.equal(saved.turn, 2);
  assert.equal(saved.revision, g.s.revision + 1);
  for (const view of await allPrivateViews(t, members)) {
    assert.equal(view.turn, 2);
    assert.equal(view.phase, "turn");
  }
});
