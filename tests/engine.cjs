const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  { Game, CARDS, pool, MAX_HP, DRAW_WEIGHT_TOTAL } = require("../engine.js");
function setup(n = 3, rng = () => 0) {
  const g = new Game(
    Array.from({ length: n }, (_, i) => "P" + i),
    { rng },
  );
  // Fixed damaged-HP fixture: tests below measure card deltas from 60.
  // New-game HP and the healing ceiling are tested separately against MAX_HP.
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
test("40 cards, generated only excluded from draws", () => {
  assert.equal(CARDS.length, 40);
  for (const id of [6, 25, 26]) assert(!pool.includes(id));
  assert.equal(pool.length, 37);
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
  assert.equal(h.player(2).hp, 56);
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
  h.player(0).hp = MAX_HP - 10;
  play(h, 8);
  assert.equal(h.player(0).hp, MAX_HP);
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
  assert.equal(g.player(0).hp, 69);
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

test("red-note target using Drawing clears field even when cleansing another player", () => {
  const g = setup();
  play(g, 4);
  play(g, 12, 2);
  assert.equal(g.s.field, null);
  assert(!g.player(1).status.red);
});

test("target identifiers cannot disguise illegal self-targets and invalid input is atomic", () => {
  const g = setup();
  const [c] = give(g, 0, 7);
  const before = JSON.stringify(g.s);
  for (const target of ["0", "1", null, {}, -1, 3, 1.5]) {
    assert.throws(() => act(g, 0, { kind: "play", card: c.uid, target }));
    assert.equal(JSON.stringify(g.s), before);
  }
});

test("HP costs bypass invincibility without triggering actual-damage healing", () => {
  for (const id of [11, 16]) {
    const g = setup();
    g.player(0).status.invincible = true;
    g.player(2).hp = 20;
    g.s.links = [{ owner: 2, target: 0, after: 0, left: 2 }];
    play(g, id);
    assert.equal(g.player(0).hp, 55);
    assert.equal(g.player(2).hp, 20);
  }
});

test("simultaneous final elimination from cost and launched attack is a draw", () => {
  const g = setup(2);
  g.player(0).hp = 5;
  g.player(1).hp = 21;
  play(g, 11);
  assert.equal(g.s.winner, -1);
  assert.equal(g.s.phase, "over");
});

test("forfeit resumes pending defense, gift, theft and discard safely", () => {
  const defenseGame = setup(4);
  give(defenseGame, 1, 10);
  play(defenseGame, 7);
  assert.equal(defenseGame.s.phase, "react");
  defenseGame.forfeit(1);
  assert.equal(defenseGame.s.turn, 2);
  assert.equal(defenseGame.s.phase, "turn");

  const giftGame = setup(4);
  giftGame.player(0).hp = 20;
  play(giftGame, 3);
  giftGame.forfeit(1);
  assert.equal(giftGame.player(0).hp, 28);
  assert.equal(giftGame.s.turn, 2);

  const stealGame = setup(4);
  give(stealGame, 1, 7);
  play(stealGame, 6);
  stealGame.forfeit(0);
  assert.equal(stealGame.s.turn, 1);
  assert.equal(stealGame.s.phase, "turn");

  const discardGame = setup(4);
  give(discardGame, 1, ...Array(7).fill(8));
  play(discardGame, 17);
  assert.equal(discardGame.s.phase, "discard");
  discardGame.forfeit(1);
  assert.equal(discardGame.s.phase, "turn");
  assert.equal(discardGame.s.turn, 2);
});

test("forfeiting an attacker keeps launched damage; completed winner remains immutable", () => {
  const g = setup(2);
  g.player(1).hp = 6;
  give(g, 1, 10);
  play(g, 7);
  g.forfeit(0);
  assert.equal(g.s.phase, "react");
  act(g, 1, { kind: "take" });
  assert.equal(g.s.winner, -1);
  assert.equal(g.forfeit(1), false);
  assert.equal(g.s.winner, -1);
  const h = setup(2);
  h.forfeit(1);
  assert.equal(h.s.winner, 0);
  assert.equal(h.forfeit(0), false);
  assert.equal(h.s.winner, 0);
});

test("forfeit during a queued AoE keeps remaining victims and turn progression", () => {
  const g = setup(4);
  play(g, 1);
  give(g, 1, 10);
  act(g, 1, { kind: "pass" });
  act(g, 2, { kind: "pass" });
  act(g, 3, { kind: "pass" });
  assert.equal(g.s.phase, "react");
  g.forfeit(1);
  assert.equal(g.player(2).hp, 56);
  assert.equal(g.player(3).hp, 56);
  assert.equal(g.s.turn, 0);
  assert.equal(g.s.phase, "turn");
});

test("2–5 player seeded games preserve legal state and make progress", () => {
  let games = 0,
    completed = 0;
  for (let n = 2; n <= 5; n++) {
    for (let seed = 1; seed <= 20; seed++) {
      let value = seed * 997 + n;
      const rng = () =>
        (value = (Math.imul(value, 1664525) + 1013904223) >>> 0) / 2 ** 32;
      const g = new Game(
        Array.from({ length: n }, (_, i) => "P" + i),
        { rng },
      );
      for (let step = 0; step < 400 && g.s.phase !== "over"; step++) {
        const s = g.s,
          actor =
            s.pending?.actor ??
            s.pending?.to ??
            s.pending?.target ??
            s.pending?.owner ??
            s.turn;
        const p = g.player(actor);
        assert(p.hp > 0, `dead actor at ${n}/${seed}/${step}/${s.phase}`);
        const others = g.alive().filter((x) => x.id !== actor);
        let options;
        if (s.phase === "react")
          options = p.hand
            .filter((c) => g.canReact(c, s.pending))
            .map((c) => ({ kind: "react", card: c.uid, target: others[0]?.id }))
            .concat({ kind: "take" });
        else if (s.phase === "gift")
          options = [{ kind: rng() < 0.7 ? "accept" : "reject" }];
        else if (s.phase === "steal")
          options = [
            {
              kind: "steal",
              cards: others
                .flatMap((x) => x.hand)
                .slice(0, 2)
                .map((c) => c.uid),
            },
          ];
        else if (s.phase === "discard")
          options = [{ kind: "discard", card: p.hand.at(-1).uid }];
        else {
          assert.equal(s.phase, "turn");
          const sorted = [...p.hand].sort(
            (a, b) =>
              Number([7, 9, 11, 15].includes(b.id)) -
              Number([7, 9, 11, 15].includes(a.id)),
          );
          options = sorted.map((c) => ({
            kind: "play",
            card: c.uid,
            target: others[Math.floor(rng() * others.length)].id,
            targets: others.slice(0, 2).map((x) => ({
              id: x.id,
              mode: rng() < 0.5 ? "hell" : "heaven",
            })),
          }));
          options.push(
            { kind: "fuse" },
            { kind: "exchange", cards: p.hand.slice(0, 2).map((c) => c.uid) },
            { kind: "pass" },
          );
        }
        const beforeRev = s.revision;
        for (const input of options) {
          const before = JSON.stringify(s);
          try {
            g.action(actor, input);
            break;
          } catch (error) {
            assert.equal(
              JSON.stringify(s),
              before,
              `invalid action mutated state: ${error.message}`,
            );
          }
        }
        assert.equal(s.revision, beforeRev + 1);
        for (const x of s.players) {
          assert(Number.isInteger(x.hp) && x.hp >= 0 && x.hp <= MAX_HP);
          const snapshot = g.view(x.id);
          assert(
            snapshot.players.every(
              (y) =>
                !y.hand ||
                y.id === x.id ||
                (s.phase === "steal" && s.pending.owner === x.id),
            ),
          );
        }
        const allCards = s.players.flatMap((x) => x.hand.map((c) => c.uid));
        assert.equal(new Set(allCards).size, allCards.length);
      }
      games++;
      if (g.s.phase === "over") completed++;
      else {
        // Even a long game can be ended cleanly when players leave.
        for (let id = 0; id < n - 1; id++) g.forfeit(id);
        if (g.s.phase !== "over") {
          g.s.deadline = 0;
          g.timeout();
        }
        assert.equal(g.s.phase, "over");
      }
    }
  }
  assert.equal(games, 80);
  assert(completed > 0);
  console.log(
    `Seeded games: ${completed}/${games} finished naturally within 400 actions`,
  );
});

test("new games start at HP 100 and all healing is capped at 100", () => {
  assert.equal(MAX_HP, 100);
  for (let n = 2; n <= 5; n++) {
    const g = new Game(Array.from({ length: n }, (_, i) => `P${i}`));
    assert(g.s.players.every((p) => p.hp === MAX_HP && p.hand.length === 5));
    g.player(0).hp = 95;
    assert.equal(g.heal(g.player(0), 25), 5);
    assert.equal(g.player(0).hp, 100);
    g.player(1).hp = 0;
    assert.equal(g.heal(g.player(1), 100), 0);
  }
});

test("weighted draw has exact published odds and never generates synthesis-only cards", () => {
  assert.equal(DRAW_WEIGHT_TOTAL, 311);
  const g = setup();
  const counts = new Map();
  for (let ticket = 0; ticket < DRAW_WEIGHT_TOTAL; ticket++) {
    g.rng = () => (ticket + 0.5) / DRAW_WEIGHT_TOTAL;
    const id = g.draw().id;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  for (const card of CARDS) {
    assert.equal(counts.get(card.id) || 0, card.weight);
    assert.equal(card.chance, card.weight / DRAW_WEIGHT_TOTAL);
    assert(card.shortDesc.length > 0 && card.rarityLabel.length > 0);
    assert.equal(card.generated, card.weight === 0);
  }
  assert(CARDS[17].chance < CARDS[0].chance);
  assert(CARDS[0].chance < CARDS[6].chance);
  assert(CARDS[2].chance < CARDS[6].chance);
});

test("initial hands, turn refill and exchange all use private adaptive weighted draws", () => {
  let calls = [];
  const original = Game.prototype.draw;
  Game.prototype.draw = function (p) {
    calls.push(p?.id);
    return original.call(this, p);
  };
  try {
    const g = new Game(["P0", "P1"], { rng: () => 0 });
    assert.deepEqual(calls, [0, 0, 0, 0, 0, 1, 1, 1, 1, 1]);
    calls = [];
    g.player(0).hand = [];
    g.refill(g.player(0));
    assert.deepEqual(calls, [0, 0, 0, 0, 0]);
    calls = [];
    const [old] = give(g, 0, 25);
    g.action(0, { kind: "exchange", cards: [old.uid] });
    assert.deepEqual(calls, [0]);
    assert(g.player(0).hand.every((c) => !CARDS[c.id - 1].generated));
  } finally {
    Game.prototype.draw = original;
  }
});

test("public effect events identify actual attack targets, reactions and generated armor", () => {
  const g = setup();
  give(g, 2, 2);
  play(g, 7, 2);
  const launched = g.s.events.find((e) => e.kind === "attack");
  assert.deepEqual(launched.targets, [2]);
  assert.equal(launched.source, 0);
  act(g, 2, { kind: "react", card: g.player(2).hand[0].uid });
  const reaction = g.s.events.find((e) => e.kind === "card" && e.reaction);
  assert.equal(reaction.source, 2);
  assert.deepEqual(reaction.targets, [0]);
  assert.equal(reaction.incoming.amount, 6);
  const counter = g.s.events.find((e) => e.kind === "attack" && e.reaction);
  assert.deepEqual(counter.targets, [0]);
  assert.equal(counter.amount, 9);
  const h = setup();
  h.player(1).hand.push(h.card(26, { armor: 19 }));
  play(h, 11);
  act(h, 1, { kind: "react", card: h.player(1).hand[0].uid });
  assert.equal(
    h.s.events.find((e) => e.kind === "card" && e.card === 26).armor,
    19,
  );
  assert.equal(h.s.events.find((e) => e.kind === "block").amount, 19);
  assert.equal(h.player(1).hp, 58);
});

test("31/35/37 preserve fixed and ranged attack damage", () => {
  for (const [id, rng, expected] of [
    [31, 0, 8],
    [35, 0, 1],
    [35, 0.9999, 9],
    [37, 0, 20],
  ]) {
    const g = setup(3, () => rng);
    play(g, id);
    assert.equal(g.player(1).hp, 60 - expected);
  }
});

test("32 designates target as Hyunbi, redirects all other attacks once, expires at target end", () => {
  const g = setup(4);
  play(g, 32, 2);
  assert(g.player(2).status.taunt);
  assert(!g.player(0).status.taunt);
  play(g, 31, 0);
  assert.equal(g.player(0).hp, 60);
  assert.equal(g.player(2).hp, 52);
  assert.deepEqual(
    g.s.events.filter((e) => e.kind === "attack").at(-1).targets,
    [2],
  );
  play(g, 31, 0); // Hyunbi can freely attack another player.
  assert.equal(g.player(0).hp, 52);
  assert(!g.player(2).status.taunt);
  const h = setup(4);
  play(h, 32, 2);
  play(h, 15);
  assert.deepEqual(
    h.s.players.map((p) => p.hp),
    [60, 60, 54, 60],
  );
  const k = setup(4);
  play(k, 32, 2);
  play(k, 32, 3);
  assert(!k.player(2).status.taunt);
  assert(k.player(3).status.taunt);
  play(k, 31, 0);
  assert.equal(k.player(3).hp, 52);
  assert.equal(k.player(0).hp, 60);
});

test("32 taunt cleanses and disappears from targeting on elimination", () => {
  const g = setup(3);
  play(g, 32, 1);
  play(g, 22);
  assert(!g.player(1).status.taunt);
  const h = setup(4);
  play(h, 32, 2);
  h.forfeit(2);
  play(h, 31, 0);
  assert.equal(h.player(0).hp, 52);
});

test("33 exact ten-thousand-way damage distribution and independent half counter lock", () => {
  const g = setup();
  const counts = new Map();
  let counterLocks = 0;
  for (let roll = 0; roll < 10000; roll++) {
    const numbers = [(roll + 0.5) / 10000, roll % 2 ? 0.75 : 0.25];
    g.rng = () => numbers.shift();
    const result = g.rollPhone();
    counts.set(result.amount, (counts.get(result.amount) || 0) + 1);
    counterLocks += Number(result.noCounter);
  }
  assert.deepEqual(Object.fromEntries(counts), {
    0: 989,
    8: 5000,
    16: 3000,
    32: 1000,
    64: 10,
    100: 1,
  });
  assert.equal(counterLocks, 5000);
  for (const noCounter of [true, false]) {
    const h = setup();
    give(h, 1, 2, 29);
    const nums = [0.8, noCounter ? 0.25 : 0.75];
    h.rng = () => nums.shift() ?? 0;
    play(h, 33);
    assert.equal(h.s.pending.amount, 32);
    assert.equal(h.s.pending.noCounter, noCounter);
    const counter = h.player(1).hand.find((c) => c.id === 2);
    assert.equal(h.canReact(counter, h.s.pending), !noCounter);
    if (noCounter) {
      const before = JSON.stringify(h.s);
      assert.throws(() => act(h, 1, { kind: "react", card: counter.uid }));
      assert.equal(JSON.stringify(h.s), before);
    }
    act(h, 1, {
      kind: "react",
      card: h.player(1).hand.find((c) => c.id === 29).uid,
    });
    assert.equal(h.player(1).hp, 54);
  }
  const miss = setup();
  give(miss, 1, 2);
  const nums = [0.99, 0.25];
  miss.rng = () => nums.shift() ?? 0;
  play(miss, 33);
  assert.equal(miss.player(1).hp, 60);
  assert.equal(miss.s.phase, "turn");
  assert(miss.s.events.some((e) => e.kind === "miss" && e.amount === 0));
});

test("34 curse ticks each second target turn, refreshes without stacking, skips count and cleanse ends it", () => {
  const g = setup();
  play(g, 34, 1);
  act(g, 1, { kind: "pass" });
  assert.equal(g.player(1).hp, 60);
  act(g, 2, { kind: "pass" });
  act(g, 0, { kind: "pass" });
  act(g, 1, { kind: "pass" });
  assert.equal(g.player(1).hp, 50);
  assert.equal(g.player(1).status.curse.ticks, 0);
  act(g, 2, { kind: "pass" });
  play(g, 34, 1);
  assert.equal(g.player(1).status.curse.ticks, 0);
  play(g, 22);
  assert(!g.player(1).status.curse);
  const h = setup();
  h.player(1).status.curse = { source: 0, after: 0, ticks: 0 };
  play(h, 24);
  play(h, 24);
  assert.equal(h.player(1).hp, 50);
  assert(h.player(1).status.curse);
  const k = setup();
  k.player(1).hp = 10;
  k.player(1).status.curse = { source: 0, after: 0, ticks: 1 };
  play(k, 24);
  assert.equal(k.player(1).hp, 0);
  assert.equal(k.s.turn, 0);
});

test("36 mutual damage can cause final draw and own invincibility applies", () => {
  const g = setup(2);
  g.player(0).hp = 30;
  g.player(1).hp = 30;
  play(g, 36);
  assert.equal(g.s.phase, "over");
  assert.equal(g.s.winner, -1);
  const h = setup();
  h.player(0).status.invincible = true;
  play(h, 36);
  assert.equal(h.player(0).hp, 60);
  assert.equal(h.player(1).hp, 30);
});

test("38 baseball retaliates only actual direct attack damage and expires at next owner start", () => {
  const g = setup();
  play(g, 38, 1);
  assert.equal(g.player(1).hp, 45);
  assert(g.player(0).status.baseball);
  play(g, 31, 0);
  assert.equal(g.player(0).hp, 52);
  assert.equal(g.player(1).hp, 40);
  const before = g.player(2).hp;
  g.damage(g.player(0), 5, { source: 2, card: 34, persistent: true });
  assert.equal(g.player(2).hp, before);
  act(g, 2, { kind: "pass" });
  assert(!g.player(0).status.baseball);
  const h = setup();
  h.player(1).status.baseball = true;
  play(h, 9);
  assert.equal(h.player(0).hp, 60);
  const k = setup();
  k.player(0).status.baseball = true;
  give(k, 1, 2);
  play(k, 31);
  act(k, 1, { kind: "react", card: k.player(1).hand[0].uid });
  assert.equal(k.player(0).hp, 49);
  assert.equal(k.player(1).hp, 60);
  const b = setup();
  b.player(1).status.baseball = true;
  give(b, 1, 10);
  play(b, 31);
  act(b, 1, { kind: "react", card: b.player(1).hand[0].uid });
  assert.equal(b.player(0).hp, 60);
  const fatal = setup(2);
  fatal.player(0).hp = 5;
  fatal.player(1).hp = 8;
  fatal.player(1).status.baseball = true;
  play(fatal, 31);
  assert.equal(fatal.s.winner, -1);
});

test("39 uses pre-action HP extrema, independent random ties, damage before healing, no revival", () => {
  const g = setup();
  g.player(0).hp = 80;
  g.player(1).hp = 20;
  g.player(2).hp = 50;
  play(g, 39);
  assert.deepEqual(
    g.s.players.map((p) => p.hp),
    [55, 45, 50],
  );
  const h = setup();
  const random = [0, 0.999];
  h.rng = () => random.shift() ?? 0;
  play(h, 39);
  assert.deepEqual(
    h.s.players.map((p) => p.hp),
    [35, 60, 85],
  );
  const k = setup(2);
  k.player(0).hp = 20;
  k.player(1).hp = 20;
  play(k, 39);
  assert.equal(k.player(0).hp, 0);
  assert.equal(k.s.winner, 1);
});

test("40 heals at next two starts, counts skipped turns and blocked healing, survives harmful cleanse", () => {
  const g = setup();
  play(g, 40);
  assert.equal(g.player(0).hp, 60);
  act(g, 1, { kind: "pass" });
  act(g, 2, { kind: "pass" });
  assert.equal(g.player(0).hp, 65);
  assert.equal(g.player(0).status.regen.left, 1);
  g.cleanse(g.player(0));
  assert(g.player(0).status.regen);
  act(g, 0, { kind: "pass" });
  act(g, 1, { kind: "pass" });
  act(g, 2, { kind: "pass" });
  assert.equal(g.player(0).hp, 70);
  assert(!g.player(0).status.regen);
  const h = setup();
  play(h, 40);
  h.status(h.player(0), "noheal", 2);
  play(h, 24);
  assert.equal(h.player(0).hp, 60);
  assert.equal(h.player(0).status.regen.left, 1);
  act(h, 1, { kind: "pass" });
  act(h, 2, { kind: "pass" });
  assert.equal(h.player(0).hp, 60);
  assert(!h.player(0).status.regen);
  const k = setup();
  play(k, 16, 1);
  const [food] = give(k, 1, 40);
  assert.throws(() => act(k, 1, { kind: "play", card: food.uid }));
});

test("18 confiscates new attack max values, preserving magic type distinctions", () => {
  const g = setup();
  give(g, 1, 31, 33, 35, 36, 37, 38, 34, 40);
  play(g, 18, 1, {
    targets: [
      { id: 1, mode: "hell" },
      { id: 2, mode: "heaven" },
    ],
  });
  assert.equal(g.player(0).hand.find((c) => c.id === 26).armor, 182);
  assert(g.player(1).hand.some((c) => c.id === 34));
  assert(g.player(1).hand.some((c) => c.id === 40));
});

test("adaptive draw improves offense privately while preserving rare weights and generated exclusions", () => {
  const g = setup();
  const base = g.drawOdds();
  assert(base.attackChance > 0.45 && base.attackChance < 0.5);
  give(g, 0, 10, 23, 29);
  const drought = g.drawOdds(0);
  assert.equal(drought.attackMultiplier, 3);
  assert(drought.attackChance > base.attackChance);
  give(g, 0, 31);
  assert.equal(g.drawOdds(0).attackMultiplier, 2);
  g.player(0).hand = [g.card(31)];
  assert.equal(g.drawOdds(0).attackMultiplier, 1);
  g.player(0).hp = 30;
  assert.equal(g.drawOdds(0).healMultiplier, 2);
  g.status(g.player(0), "noheal", 2);
  assert.equal(g.drawOdds(0).healMultiplier, 1);
  assert(
    drought.cards
      .filter((c) => [6, 25, 26].includes(c.id))
      .every((c) => c.weight === 0 && c.chance === 0),
  );
  assert(drought.cards[36].weight < drought.cards[30].weight);
  assert(drought.cards[17].weight < drought.cards[36].weight);
  assert.equal(g.view(1).drawOdds.defenses, 0);
  assert.equal(g.view(1).players[0].hand, undefined);
  const seen = new Map();
  for (let ticket = 0; ticket < drought.total; ticket++) {
    g.player(0).hand = [g.card(10), g.card(23), g.card(29)];
    g.player(0).hp = 60;
    delete g.player(0).status.noheal;
    g.rng = () => (ticket + 0.5) / drought.total;
    const id = g.draw(g.player(0)).id;
    seen.set(id, (seen.get(id) || 0) + 1);
  }
  for (const c of drought.cards) assert.equal(seen.get(c.id) || 0, c.weight);
});

test("five-player AoE with four siphon owners keeps initiating card and complete effect events", () => {
  const g = setup(5);
  for (const player of g.s.players) player.hp = 20;
  // Every victim has active 17 effects from each of the four other players.
  // One JoY therefore produces 4 damage + 16 heal + card + attack events.
  for (let target = 1; target < 5; target++) {
    for (let owner = 0; owner < 5; owner++) {
      if (owner !== target)
        g.s.links.push({ owner, target, after: 0, left: 2 });
    }
  }
  play(g, 15);
  const events = g.view(0).events;
  assert.equal(events.length, 22);
  assert.equal(events[0].kind, "card");
  assert.equal(events[0].card, 15);
  assert.equal(events[1].kind, "attack");
  assert.deepEqual(events[1].targets, [1, 2, 3, 4]);
  assert.equal(events.filter((e) => e.kind === "damage").length, 4);
  assert.equal(events.filter((e) => e.kind === "heal").length, 16);
  assert.deepEqual(
    g.s.players.map((p) => p.hp),
    [44, 32, 32, 32, 32],
  );
  for (let i = 0; i < 90; i++)
    g.event("status", { target: 0, status: "test", left: i });
  assert.equal(g.s.events.length, 80);
  assert.equal(g.s.events.at(-1).left, 89);
});
