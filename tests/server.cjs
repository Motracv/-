"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const service = require("../server.cjs");
const { Game, MAX_HP } = require("../engine.js");
let origin;
const streams = [];
before(async () => {
  await new Promise((resolve) =>
    service.server.listen(0, "127.0.0.1", resolve),
  );
  origin = `http://127.0.0.1:${service.server.address().port}`;
});
after(() => {
  for (const s of streams) s.destroy();
  service.stop();
});
async function post(route, data = {}, token) {
  const res = await fetch(origin + "/api/" + route, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: JSON.stringify(data),
  });
  return { status: res.status, data: await res.json() };
}
async function connect(token) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      origin + "/api/events",
      { headers: { Authorization: "Bearer " + token } },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(Error("Stream refused"));
          return;
        }
        res.on("data", () => {});
        streams.push(req);
        resolve(req);
      },
    );
    req.on("error", reject);
  });
}
async function roomOf(n = 3, start = true) {
  const first = (await post("create", { name: "P0" })).data;
  const members = [first];
  for (let i = 1; i < n; i++)
    members.push(
      (await post("join", { name: "P" + i, code: first.code })).data,
    );
  for (const m of members) m.connection = await connect(m.token);
  const room = service.rooms.get(first.code);
  if (start) assert.equal((await post("start", {}, first.token)).status, 200);
  return { room, members };
}
function give(g, id, ...ids) {
  return ids.map((n) => {
    const c = g.card(n);
    g.player(id).hand.push(c);
    return c;
  });
}
function fixture(room, setup = () => {}) {
  const g = new Game(
    room.members.map((m) => m.name),
    { rng: () => 0 },
  );
  for (const p of g.s.players) p.hand = [];
  setup(g);
  room.game = g;
  return g;
}
test("five members only, host-only start and per-user private views", async () => {
  const { room, members } = await roomOf(5, false);
  assert.equal(
    (await post("join", { name: "sixth", code: room.code })).status,
    400,
  );
  assert.equal((await post("start", {}, members[1].token)).status, 400);
  assert.equal((await post("start", {}, members[0].token)).status, 200);
  for (const m of members) {
    const r = await post("heartbeat", {}, m.token);
    assert.equal(r.data.game.players.filter((p) => p.hand).length, 1);
    assert(r.data.game.players[r.data.me].hand);
  }
});
test("wrong turn and replayed revision cannot mutate game", async () => {
  const { room, members } = await roomOf();
  const revision = room.game.s.revision;
  assert.equal(
    (await post("action", { kind: "pass", revision }, members[1].token)).status,
    400,
  );
  assert.equal(room.game.s.revision, revision);
  assert.equal(
    (await post("action", { kind: "pass", revision }, members[0].token)).status,
    200,
  );
  assert.equal(
    (await post("action", { kind: "pass", revision }, members[1].token)).status,
    400,
  );
  assert.equal(room.game.s.revision, revision + 1);
});
test("late response expires before action even between server ticks", async () => {
  const { room, members } = await roomOf();
  const revision = room.game.s.revision;
  room.game.s.deadline = Date.now() - 1;
  const response = await post(
    "action",
    { kind: "pass", revision },
    members[0].token,
  );
  assert.equal(response.status, 400);
  assert.equal(room.game.s.turn, 1);
  assert.equal(room.game.s.revision, revision + 1);
});
test("replaced SSE stream keeps current stream and identity alive", async () => {
  const { room, members } = await roomOf();
  const m = room.members[1];
  const old = m.stream;
  await connect(members[1].token);
  assert.notEqual(m.stream, old);
  assert(m.stream);
  members[1].connection.destroy();
  await new Promise((r) => setImmediate(r));
  assert(m.stream);
  assert.equal(m.id, 1);
});
test("host departure reassigns lobby IDs and revokes old credential", async () => {
  const { room, members } = await roomOf(3, false);
  assert.equal((await post("leave", {}, members[0].token)).status, 200);
  assert.equal((await post("heartbeat", {}, members[0].token)).status, 400);
  const state = (await post("heartbeat", {}, members[1].token)).data;
  assert.equal(state.me, 0);
  assert.equal(state.host, 0);
  assert.equal(state.players[0].name, "P1");
  assert.equal((await post("start", {}, members[1].token)).status, 200);
});
test("finished game winner is immutable when players leave", async () => {
  const { room, members } = await roomOf(2);
  const g = room.game;
  await post("leave", {}, members[1].token);
  assert.equal(g.s.winner, 0);
  const revision = g.s.revision;
  await post("leave", {}, members[0].token);
  assert.equal(g.s.winner, 0);
  assert.equal(g.s.revision, revision);
  assert.equal((await post("leave", {}, members[1].token)).status, 400);
});
test("resigning pending defender resumes remaining area targets", async () => {
  const { room, members } = await roomOf();
  const g = fixture(room, (g) => give(g, 1, 10));
  g.attack(0, [1, 2], 8, 7, { multi: true });
  assert.equal(g.s.phase, "react");
  await post("leave", {}, members[1].token);
  assert.equal(g.player(1).hp, 0);
  assert.equal(g.player(2).hp, MAX_HP - 8);
  assert.notEqual(g.s.phase, "react");
});
test("departing a non-current overflow player preserves current turn", async () => {
  const { room, members } = await roomOf();
  const g = fixture(room, (g) => give(g, 1, ...Array(8).fill(8)));
  g.checkOverflow();
  assert.equal(g.s.phase, "discard");
  assert.equal(g.resumePhase, "turn");
  await post("leave", {}, members[1].token);
  assert.equal(g.s.turn, 0);
  assert.equal(g.s.phase, "turn");
});
test("disconnect grace handles pending gift and expired empty lobby", async () => {
  const { room, members } = await roomOf();
  const g = fixture(room, (g) => {
    g.player(0).hp = 30;
    give(g, 0, 3);
  });
  g.action(0, { kind: "play", card: g.player(0).hand[0].uid, target: 1 });
  const m = room.members[1];
  const stream = m.stream;
  m.stream = null;
  stream.end();
  m.lastSeen = Date.now() - 91000;
  service.tickRooms();
  assert.equal(g.player(1).hp, 0);
  assert.equal(g.player(0).hp, 38);
  assert.notEqual(g.s.phase, "gift");
  const solitary = (await post("create", { name: "alone" })).data;
  const empty = service.rooms.get(solitary.code);
  empty.members[0].lastSeen = Date.now() - 91000;
  service.tickRooms();
  assert(!service.rooms.has(solitary.code));
  assert(!service.sessions.has(solitary.token));
});
test("slow request cannot use revoked lobby credentials", async () => {
  const { room, members } = await roomOf(2, false);
  const token = members[0].token;
  let resolveResponse;
  const response = new Promise((r) => (resolveResponse = r));
  const req = http.request(
    origin + "/api/start",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        "Transfer-Encoding": "chunked",
      },
    },
    (res) => {
      res.resume();
      res.on("end", () => resolveResponse(res.statusCode));
    },
  );
  req.write("{");
  await new Promise((r) => setImmediate(r));
  await post("leave", {}, token);
  req.end("}");
  assert.equal(await response, 400);
  assert.equal(room.game, null);
});
