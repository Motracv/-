const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  { Game, CARDS, pool } = require("../engine.js");
function setup(n = 3, rng = () => 0) {
  const g = new Game(
    Array.from({ length: n }, (_, i) => "P" + i),
    { rng },
  );
  for (const p of g.s.players) {
    p.hand = [];
    p.hp = 60;
  }
  return g;
}
function give(g, p, ...ids) {
  return ids.map((id) => {
    const c = g.card(id);
    g.player(p).hand.push(c);
    return c;
  });
}
function play(g, id, target = 1, extra = {}) {
  const [c] = give(g, g.s.turn, id);
  g.action(g.s.turn, { kind: "play", card: c.uid, target, ...extra });
  return c;
}
function block(g, id, extra = {}) {
  const [c] = give(g, g.s.pending.to, id);
  g.action(g.s.pending.to, { kind: "react", card: c.uid, ...extra });
}
function act(g, actor, input) {
  g.action(actor, input);
}
test("30 cards, generated only excluded from draws", () => {
  assert.equal(CARDS.length, 30);
  for (const id of [6, 25, 26]) assert(!pool.includes(id));
  assert.equal(pool.length, 27);
});
test("01: starts next owner turn, three pulses, stop is free", () => {
  const g = setup();
  play(g, 1);
  assert.equal(g.player(1).hp, 60);
  act(g, 1, { kind: "pass" });
  act(g, 2, { kind: "pass" });
  assert.equal(g.player(1).hp, 56);
  assert.equal(g.player(2).hp, 56);
  act(g, 0, { kind: "stop" });
  assert.equal(g.s.turn, 0);
  assert.equal(g.s.field, null);
});
test("02: counter cap and Ace cancellation", () => {
  const g = setup();
  give(g, 1, 2);
  play(g, 11);
  assert.equal(g.s.phase, "react");
  act(g, 1, { kind: "react", card: g.player(1).hand[0].uid });
  assert.equal(g.player(1).hp, 60);
  assert.equal(g.player(0).hp, 35);
  const h = setup();
  play(h, 1);
  act(h, 1, { kind: "pass" });
  give(h, 1, 2);
  act(h, 2, { kind: "pass" });
  act(h, 1, {
    kind: "react",
    card: h.player(1).hand.find((c) => c.id === 2).uid,
  });
  assert.equal(h.s.field, null);
  assert.equal(h.player(0).hp, 46);
  assert.equal(h.player(2).hp, 60);
});
test("03: accept named roulette and reject heal", () => {
  let g = setup();
  play(g, 3);
  act(g, 1, { kind: "accept" });
  assert.equal(g.player(0).hp, 52);
  assert(g.s.logs.some((x) => x.includes("룰렛: P0, 피해 8")));
  g = setup();
  g.player(0).hp = 40;
  play(g, 3);
  act(g, 1, { kind: "reject" });
  assert.equal(g.player(0).hp, 48);
});
test("04/12: red lasts target two ends, replacement/cleanse ends it", () => {
  const g = setup();
  play(g, 4);
  assert(g.player(1).status.red);
  g.heal(g.player(1), 5);
  act(g, 1, { kind: "pass" });
  assert.equal(g.player(1).status.red.left, 1);
  act(g, 2, { kind: "pass" });
  play(g, 1);
  assert(!g.player(1).status.red);
  const h = setup();
  play(h, 4);
  play(h, 12, 1);
  assert.equal(h.s.field, null);
});
test("05/06: theft, fusion, private reveal and chosen two", () => {
  const g = setup();
  give(g, 1, 7);
  play(g, 5);
  assert(g.player(0).hand.some((c) => c.id === 7));
  const h = setup();
  give(h, 0, 5, 5);
  act(h, 0, { kind: "fuse" });
  assert(h.player(0).hand.some((c) => c.id === 6));
  assert(!h.player(0).hand.some((c) => c.id === 5));
  const k = setup();
  give(k, 1, 7, 8);
  give(k, 2, 9);
  play(k, 6);
  assert(k.view(0).players[1].hand);
  assert(!k.view(1).players[2].hand);
  const cards = k.player(1).hand.map((c) => c.uid);
  act(k, 0, { kind: "steal", cards });
  assert.equal(k.player(0).hand.length, 2);
  assert.equal(k.player(1).hand.length, 5); // next turn refill
});
test("07/08/09: random ranges, heal capped, nyan no counters", () => {
  const g = setup();
  play(g, 7);
  assert.equal(g.player(1).hp, 54);
  const h = setup(3, () => 0.9999);
  h.player(0).hp = 50;
  play(h, 8);
  assert.equal(h.player(0).hp, 60);
  const k = setup();
  give(k, 1, 2, 20);
  play(k, 9);
  assert.equal(k.player(1).hp, 52);
  assert.equal(k.s.phase, "turn");
});
test("10/11: threshold and HP price", () => {
  const g = setup();
  give(g, 1, 10);
  play(g, 11);
  act(g, 1, { kind: "react", card: g.player(1).hand[0].uid });
  assert.equal(g.player(1).hp, 39);
  assert.equal(g.player(0).hp, 55);
});
test("13: odd split, no new reaction on transferred damage", () => {
  const g = setup();
  give(g, 1, 13);
  give(g, 2, 2);
  play(g, 11);
  act(g, 1, { kind: "react", card: g.player(1).hand[0].uid, target: 2 });
  assert.equal(g.player(1).hp, 50);
  assert.equal(g.player(2).hp, 49);
  assert.equal(g.player(2).hand.length, 1);
});
test("14: self gets once, all other living get 10", () => {
  const g = setup();
  for (const p of g.s.players) p.hp = 20;
  play(g, 14);
  assert.deepEqual(
    g.s.players.map((p) => p.hp),
    [38, 30, 30],
  );
});
test("15: ignores invincible and defense cap", () => {
  const g = setup();
  g.player(1).status.invincible = true;
  give(g, 1, 29);
  play(g, 15);
  assert.equal(g.player(1).hp, 54);
  assert.equal(g.player(2).hp, 54);
});
test("16: cost and restriction until target turn ends", () => {
  const g = setup();
  play(g, 16);
  assert.equal(g.player(0).hp, 55);
  const [c] = give(g, 1, 7);
  assert.throws(() => act(g, 1, { kind: "play", card: c.uid, target: 0 }));
  assert(g.player(1).hand.includes(c));
  act(g, 1, { kind: "pass" });
  assert(!g.player(1).status.xerath);
});
test("17/25: owner siphons actual damage, generated card loss does not cleanse", () => {
  const g = setup();
  g.player(0).hp = 30;
  play(g, 17);
  const c = g.player(1).hand.find((c) => c.id === 25);
  act(g, 1, { kind: "play", card: c.uid });
  assert(g.player(1).status.noheal);
  play(g, 7, 1);
  assert.equal(g.player(0).hp, 36);
  assert.equal(g.player(1).hp, 54);
  assert.equal(g.heal(g.player(1), 10), 0);
});
test("18/26: all matching confiscated, max values sum, duel one target", () => {
  const g = setup(2);
  give(g, 1, 7, 9, 11, 8);
  play(g, 18, 1, { targets: [{ id: 1, mode: "hell" }] });
  const c = g.player(0).hand.find((c) => c.id === 26);
  assert.equal(c.armor, 49);
  assert.equal(g.player(0).hand.length, 4);
  assert(g.player(1).hand.some((c) => c.id === 8));
  const h = setup();
  const shield = h.card(26, { armor: 12 });
  h.player(1).hand.push(shield);
  play(h, 11);
  act(h, 1, { kind: "react", card: shield.uid });
  assert.equal(h.player(1).hp, 51);
});
test("19: swaps one random each with next living", () => {
  const g = setup();
  give(g, 0, 8);
  give(g, 1, 7);
  play(g, 19);
  assert(g.player(0).hand.some((c) => c.id === 7));
  assert(g.player(1).hand.some((c) => c.id === 8));
});
test("20: receives damage, blocks acquisition for two target turns", () => {
  const g = setup();
  give(g, 1, 20);
  play(g, 7);
  act(g, 1, { kind: "react", card: g.player(1).hand[0].uid });
  assert.equal(g.player(1).hp, 54);
  assert(g.player(0).status.touch);
  assert.equal(g.acquire(g.player(0), g.card(8)), false);
  const len = g.player(0).hand.length;
  g.refill(g.player(0));
  assert.equal(g.player(0).hand.length, len);
});
test("21: low HP eliminated before lottery; all low yields draw", () => {
  const g = setup();
  g.player(1).hp = 4;
  play(g, 21);
  assert.equal(g.player(1).hp, 0);
  assert.equal(g.player(0).hp, 60);
  const h = setup();
  for (const p of h.s.players) p.hp = 5;
  play(h, 21);
  assert.equal(h.s.winner, -1);
});
test("22: cleanses own harmful conditions", () => {
  const g = setup();
  g.status(g.player(0), "noheal", 2);
  g.status(g.player(0), "touch", 2);
  play(g, 22);
  assert.deepEqual(g.player(0).status, {});
});
test("23: Ace held gives 35, no consumption", () => {
  const g = setup();
  give(g, 1, 23, 1);
  play(g, 11);
  act(g, 1, {
    kind: "react",
    card: g.player(1).hand.find((c) => c.id === 23).uid,
  });
  assert.equal(g.player(1).hp, 60);
  assert(g.player(1).hand.some((c) => c.id === 1));
});
test("24: two skips when mark held, no refill, duration processed", () => {
  const g = setup();
  give(g, 0, 27);
  play(g, 24);
  assert.equal(g.s.turn, 0);
  assert.equal(g.player(1).turns, 1);
  assert.equal(g.player(1).hand.length, 0);
  assert.equal(g.player(1).status.skip.left, 1);
  act(g, 0, { kind: "pass" });
  assert.equal(g.s.turn, 0);
  assert.equal(g.player(1).turns, 2);
  assert(!g.player(1).status.skip);
  assert(g.player(0).hand.some((c) => c.id === 27));
});
test("27: invincible through next owner start, ordinary hit blocked", () => {
  const g = setup();
  play(g, 27);
  play(g, 7, 0);
  assert.equal(g.player(0).hp, 60);
  act(g, 2, { kind: "pass" });
  assert(!g.player(0).status.invincible);
});
test("28: exact conservation with current-first remainder, dead excluded", () => {
  const g = setup();
  g.player(0).hp = 1;
  g.player(1).hp = 2;
  g.player(2).hp = 1;
  play(g, 28);
  assert.deepEqual(
    g.s.players.map((p) => p.hp),
    [2, 1, 1],
  );
});
test("29/30: cap below six unchanged and both luck branches", () => {
  let g = setup();
  give(g, 1, 29);
  play(g, 11);
  act(g, 1, { kind: "react", card: g.player(1).hand[0].uid });
  assert.equal(g.player(1).hp, 54);
  for (const [r, hp] of [
    [0, 60],
    [0.99, 44],
  ]) {
    g = setup(3, () => r);
    give(g, 1, 30);
    play(g, 7);
    act(g, 1, { kind: "react", card: g.player(1).hand[0].uid });
    assert.equal(g.player(1).hp, hp);
  }
});
test("privacy, invalid turn, stale command, overflow ownership", () => {
  const g = setup();
  give(g, 0, 7);
  assert(!g.view(1).players[0].hand);
  assert.throws(() => act(g, 1, { kind: "pass" }));
  const rev = g.s.revision;
  act(g, 0, { kind: "pass", revision: rev });
  assert.throws(() => act(g, 1, { kind: "pass", revision: rev }));
  const h = setup();
  give(h, 0, ...Array(9).fill(8));
  h.checkOverflow();
  assert.equal(h.s.phase, "discard");
  assert.throws(() =>
    act(h, 1, { kind: "discard", card: h.player(0).hand[0].uid }),
  );
  act(h, 0, { kind: "discard", card: h.player(0).hand[0].uid });
  assert.equal(h.s.phase, "discard");
  act(h, 0, { kind: "discard", card: h.player(0).hand[0].uid });
  assert.equal(h.player(0).hand.length, 7);
});
test("timeout gift auto rejects, turn auto passes", () => {
  let now = 100;
  const g = new Game(["a", "b"], { now: () => now, rng: () => 0 });
  g.player(0).hp = 30;
  play(g, 3);
  now += 21000;
  g.timeout();
  assert.equal(g.player(0).hp, 38);
  assert.equal(g.s.turn, 1);
  now += 46000;
  g.timeout();
  assert.equal(g.s.turn, 0);
});
test("Ace expires after exactly three triggers, all-target queue resolves before elimination", () => {
  const g = setup(2);
  play(g, 1);
  for (let i = 0; i < 3; i++) {
    act(g, 1, { kind: "pass" });
    if (i < 2) act(g, 0, { kind: "pass" });
  }
  assert.equal(g.player(1).hp, 48);
  assert.equal(g.s.field, null);
  const h = setup(2);
  h.player(0).hp = 5;
  h.player(1).hp = 5;
  give(h, 1, 2);
  play(h, 11);
  act(h, 1, { kind: "react", card: h.player(1).hand[0].uid });
  assert.equal(h.s.winner, 1);
});
test("taxi successful block; dice cap does not increase low damage", () => {
  const g = setup();
  give(g, 1, 10);
  play(g, 7);
  act(g, 1, { kind: "react", card: g.player(1).hand[0].uid });
  assert.equal(g.player(1).hp, 60);
  const h = setup();
  play(h, 1);
  give(h, 1, 29);
  act(h, 1, { kind: "pass" });
  act(h, 2, { kind: "pass" });
  act(h, 1, {
    kind: "react",
    card: h.player(1).hand.find((c) => c.id === 29).uid,
  });
  assert.equal(h.player(1).hp, 56);
});

test('red-note target using Drawing clears field even when cleansing another player', () => {
  const g = setup();
  play(g, 4);
  play(g, 12, 2);
  assert.equal(g.s.field, null);
  assert(!g.player(1).status.red);
});
