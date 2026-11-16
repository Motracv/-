/* Shared authoritative rules. Only view() may cross the network boundary. */
(function (root, factory) {
  if (typeof module === "object") module.exports = factory();
  else root.Battle = factory();
})(globalThis, () => {
  "use strict";
  const names = [
    "혁진이의 원탭 Ace",
    "우진이의 안타",
    "건우의 선물",
    "현승이의 빨간노트",
    "타카나시 호시노",
    "찬이의 타카나시 호시노",
    "정민이의 진심펀치",
    "현중이의 트레이닝",
    "혁진이의 냥냥펀치",
    "택시비 줄테니까 따라나와",
    "오성아 대신 때려줘",
    "태영이의 그림",
    "찬아 나 대신 맞아줘",
    "랭커 찍겠는데?",
    "윤찬이의 조이",
    "혁진이의 제라스",
    "X의 유명인 오태영",
    "염라 이건우",
    "나랑 카드 바꾸자",
    "우진이의 엉덩이",
    "현승이의 자동차",
    "상태창!!",
    "재능유저 서찬의 발로생존기",
    "윤찬이의 영역전개",
    "오 이스마엘이다",
    "심판 대행자 오태영",
    "서찬의 영역표시",
    "우진이의 공산주의",
    "오늘 주사위 6이다",
    "초심자의 행운",
  ];
  const types = [
    "필드",
    "반격",
    "특수",
    "필드",
    "마법",
    "특수",
    "공격",
    "회복",
    "공격",
    "방어",
    "공격",
    "마법",
    "방어",
    "회복",
    "공격",
    "마법",
    "마법",
    "특수",
    "마법",
    "반격",
    "특수",
    "마법",
    "방어",
    "마법",
    "특수",
    "특수",
    "방어",
    "특수",
    "방어",
    "방어",
  ];
  const descriptions = [
    "내 다음 차례부터 차례 시작 시 다른 전원에게 피해 4. 3회 후 종료. 내 차례에 무료 중단 가능.",
    "이번 공격을 막고 원래 피해 +3 반격(최대 20). 원탭 Ace 반격 시 필드 종료 후 사용자에게 피해 14.",
    "지정한 상대가 받기/거절 선택. 받으면 사용자/대상 중 무작위 한 명에게 피해 8~18. 거절/시간 초과 시 사용자 HP 8 회복.",
    "대상의 다음 두 차례 종료까지 회복 금지. 태영이의 그림 또는 필드 교체 시 해제.",
    "상대 손패 무작위 1장 훔치기. 손패에 2장 있으면 두 장을 소모해 06 합성(행동 1회).",
    "다른 생존자의 손패를 사용자만 보고 원하는 카드 총 2장 가져오기. 같은 상대에게서 2장 가능. 합성 전용.",
    "상대 한 명에게 피해 6~16.",
    "자신의 HP 8~16 회복.",
    "상대 한 명에게 피해 8~12. 반격 불가, 일반 방어 가능.",
    "피해 20 이하 공격 완전 방어. 21 이상은 전부 받음.",
    "상대 한 명에게 피해 21. 사용자 HP 5 감소.",
    "자신 또는 생존자 한 명의 해로운 상태 전부 해제. 빨간노트·제라스도 해제.",
    "단일 공격 피해를 다른 생존자와 절반씩 분담. 홀수 나머지 1은 대신 맞는 사람이 받음. 재반격·재전가 불가.",
    "자신 HP 18~25 회복, 다른 생존자 전원 HP 10 회복.",
    "다른 전원에게 피해 6. 방어·반격·전가·무적·피해 상한 무시.",
    "상대의 다음 차례에는 회복·방어·교환만 허용. 사용자 HP 5 감소.",
    "상대에게 25 생성 및 2차례 회복 금지. 대상의 다음 2차례 종료까지 실제 받은 피해만큼 이 카드 사용자 회복.",
    "다른 최대 2명에게 각각 천국/지옥 선택. 천국은 회복 카드 전부, 지옥은 공격 카드 전부 압수. 표기 최대 수치 합산 방어력을 가진 26 획득.",
    "다음 차례의 생존 상대와 손패 무작위 1장씩 교환.",
    "공격자에게 다음 2차례 동안 모든 카드 획득 금지 부여. 이번 공격 피해는 받음.",
    "모든 생존자로부터 HP 최대 5씩 수집. 탈락 확정 후 생존자 무작위 1명에게 모인 만큼 회복. 전원 탈락이면 무승부.",
    "자신의 해로운 상태 전부 해제.",
    "이번 피해 10 차감. 손패에 원탭 Ace 보유 시 35 차감. Ace는 소모하지 않음. 남는 방어력 소멸.",
    "다른 전원의 차례 1회 생략. 손패에 27 보유 시 2회. 27은 소모하지 않음. 생략 차례에도 지속효과는 처리, 보충 없음.",
    "17로 생성될 때 받은 대상에게 2차례 회복 금지. 사용/분실해도 금지 유지. 사용 효과 없음. 생성 전용.",
    "18의 압수 수치만큼 이번 피해 차감. 남은 방어력 소멸. 생성 전용.",
    "사용 직후부터 자신의 다음 차례 시작 직전까지 무적.",
    "생존자 HP 합계를 균등 분배. 나머지는 현재 차례부터 생존 순서로 1씩.",
    "이번 피해를 최대 6으로 제한. 원래 피해가 더 작으면 그대로.",
    "50% 확률로 이번 피해 완전 회피. 실패하면 원래 피해.",
  ];
  const CARDS = names.map((name, i) => ({
    id: i + 1,
    name,
    type: types[i],
    desc: descriptions[i],
    generated: [6, 25, 26].includes(i + 1),
    image: `assets/cards/${String(i + 1).padStart(2, "0")}.webp`,
  }));
  const pool = CARDS.filter((c) => !c.generated).map((c) => c.id);
  const defense = new Set([2, 10, 13, 20, 23, 26, 27, 29, 30]);
  const harmful = ["red", "noheal", "touch", "xerath", "skip"];
  const values = { 7: 16, 8: 16, 9: 12, 11: 21, 14: 25, 15: 6 };
  function check(ok, msg = "허용되지 않는 행동입니다.") {
    if (!ok) throw Error(msg);
  }
  class Game {
    constructor(
      names,
      {
        rng = Math.random,
        now = Date.now,
        turnMs = 45000,
        responseMs = 20000,
      } = {},
    ) {
      check(names.length >= 2 && names.length <= 5, "2~5명이 필요합니다.");
      this.rng = rng;
      this.now = now;
      this.turnMs = turnMs;
      this.responseMs = responseMs;
      this.serial = 0;
      this.s = {
        players: names.map((name, id) => ({
          id,
          name,
          hp: 60,
          hand: [],
          status: {},
          turns: 0,
        })),
        turn: 0,
        phase: "turn",
        field: null,
        pending: null,
        queue: [],
        links: [],
        logs: [],
        events: [],
        revision: 0,
        deadline: 0,
        winner: null,
      };
      for (const p of this.s.players) this.refill(p);
      this.begin();
    }
    rand(a, b) {
      return a + Math.floor(this.rng() * (b - a + 1));
    }
    card(id, extra = {}) {
      return { uid: ++this.serial, id, ...extra };
    }
    player(id) {
      check(Number.isInteger(id), "잘못된 플레이어입니다.");
      const p = this.s.players[id];
      check(p, "잘못된 플레이어입니다.");
      return p;
    }
    alive() {
      return this.s.players.filter((p) => p.hp > 0);
    }
    log(message) {
      this.s.logs.unshift(message);
      this.s.logs.length = Math.min(60, this.s.logs.length);
    }
    event(kind, data = {}) {
      this.s.events.push({ seq: ++this.serial, kind, ...data });
      this.s.events = this.s.events.slice(-20);
    }
    acquire(p, card) {
      if (p.hp <= 0 || p.status.touch) return false;
      p.hand.push(card);
      return true;
    }
    refill(p) {
      if (p.hp <= 0 || p.status.touch) return;
      while (p.hand.length < 5)
        this.acquire(p, this.card(pool[this.rand(0, pool.length - 1)]));
    }
    heal(p, n) {
      if (p.hp <= 0 || p.status.red || p.status.noheal) return 0;
      const amount = Math.min(n, 60 - p.hp);
      p.hp += amount;
      if (amount) {
        this.log(`${p.name} HP ${amount} 회복`);
        this.event("heal", { target: p.id, amount });
      }
      return amount;
    }
    damage(p, n, { bypass = false } = {}) {
      if (p.hp <= 0) return 0;
      if (p.status.invincible && !bypass) {
        this.event("block", { target: p.id, amount: n });
        return 0;
      }
      const hit = Math.min(p.hp, n);
      p.hp -= hit;
      this.log(`${p.name} 피해 ${hit}`);
      this.event("damage", { target: p.id, amount: hit });
      for (const link of this.s.links.filter((x) => x.target === p.id))
        this.heal(this.player(link.owner), hit);
      return hit;
    }
    payHP(p, n) {
      // An HP cost is paid even while invincible, but is not attack damage.
      const amount = Math.min(p.hp, n);
      p.hp -= amount;
      this.log(`${p.name} HP ${amount} 지불`);
      this.event("damage", { target: p.id, amount, cost: true });
      return amount;
    }
    endCheck() {
      if (this.s.phase === "over") return true;
      const live = this.alive();
      if (live.length > 1) return false;
      this.s.phase = "over";
      this.s.winner = live[0]?.id ?? -1;
      this.s.pending = null;
      this.s.queue = [];
      this.log(live.length ? `${live[0].name} 승리` : "무승부");
      return true;
    }
    forfeit(actor) {
      const s = this.s,
        p = this.player(actor);
      if (s.phase === "over" || p.hp <= 0) return false;
      p.hp = 0;
      p.hand = [];
      this.event("damage", { target: actor, amount: 0, forfeit: true });
      if (s.phase === "react") {
        // Already launched damage still resolves, including other AoE targets.
        if (s.pending.to === actor) this.advanceQueue();
      } else if (s.phase === "gift" && s.pending.target === actor) {
        this.heal(this.player(s.pending.owner), 8);
        s.pending = null;
        this.finish();
      } else if (
        ["gift", "steal"].includes(s.phase) &&
        s.pending.owner === actor
      ) {
        s.pending = null;
        this.finish();
      } else if (s.phase === "discard" && s.pending.actor === actor) {
        this.overflowContinue();
        this.endCheck();
      } else if (!this.endCheck() && s.phase === "turn" && s.turn === actor) {
        this.endTurn();
      }
      s.revision++;
      return true;
    }
    replaceField(field) {
      if (this.s.field?.id === 4)
        delete this.player(this.s.field.target).status.red;
      this.s.field = field;
    }
    cleanse(p) {
      for (const key of harmful) delete p.status[key];
      this.s.links = this.s.links.filter((l) => l.target !== p.id);
      if (this.s.field?.id === 4 && this.s.field.target === p.id)
        this.replaceField(null);
    }
    begin() {
      if (this.endCheck()) return;
      const s = this.s,
        p = this.player(s.turn);
      p.turns++;
      delete p.status.invincible;
      s.phase = "turn";
      s.deadline = this.now() + this.turnMs;
      this.skipping = !!p.status.skip;
      if (
        s.field?.id === 1 &&
        s.field.owner === p.id &&
        p.turns > s.field.after
      ) {
        s.field.left--;
        this.s.queue = this.alive()
          .filter((x) => x.id !== p.id)
          .map((x) => ({
            from: p.id,
            to: x.id,
            amount: 4,
            card: 1,
            multi: true,
          }));
        if (s.field.left === 0) this.replaceField(null);
        this.afterQueue = "begin";
        this.advanceQueue();
        return;
      }
      this.finishBegin();
    }
    finishBegin() {
      if (this.endCheck()) return;
      const p = this.player(this.s.turn);
      if (p.hp <= 0) {
        this.endTurn();
        return;
      }
      if (this.skipping) {
        this.log(`${p.name} 차례 생략`);
        this.endTurn();
        return;
      }
      this.s.phase = "turn";
      this.refill(p);
      this.s.deadline = this.now() + this.turnMs;
      this.checkOverflow();
    }
    endTurn() {
      const p = this.player(this.s.turn);
      for (const key of ["red", "noheal", "touch", "xerath", "skip"]) {
        const st = p.status[key];
        if (st && p.turns > st.after) {
          st.left--;
          if (st.left <= 0) {
            delete p.status[key];
            if (
              key === "red" &&
              this.s.field?.id === 4 &&
              this.s.field.target === p.id
            )
              this.replaceField(null);
          }
        }
      }
      this.s.links = this.s.links.filter(
        (l) => l.target !== p.id || p.turns <= l.after || --l.left > 0,
      );
      if (this.endCheck()) return;
      let i = this.s.turn;
      do {
        i = (i + 1) % this.s.players.length;
      } while (this.player(i).hp <= 0);
      this.s.turn = i;
      this.begin();
    }
    status(p, key, left) {
      p.status[key] = { left, after: p.turns };
    }
    checkOverflow() {
      if (this.s.phase === "over") return;
      const p = this.alive().find((x) => x.hand.length > 7);
      if (p) {
        this.resumePhase = this.s.phase;
        this.resumeDeadline = this.s.deadline;
        this.s.phase = "discard";
        this.s.pending = { actor: p.id };
        this.s.deadline = this.now() + this.responseMs;
      }
    }
    overflowContinue() {
      const p = this.alive().find((x) => x.hand.length > 7);
      if (p) {
        this.s.pending = { actor: p.id };
        this.s.deadline = this.now() + this.responseMs;
        return;
      }
      this.s.phase = this.resumePhase;
      this.s.pending = null;
      this.s.deadline = this.resumeDeadline;
      if (this.s.phase === "finish") this.endTurn();
    }
    finish() {
      if (this.endCheck()) return;
      this.s.phase = "finish";
      this.checkOverflow();
      if (this.s.phase === "finish") this.endTurn();
    }
    attack(
      from,
      targets,
      amount,
      card,
      { bypass = false, multi = false } = {},
    ) {
      this.s.queue = targets.map((to) => ({
        from,
        to,
        amount,
        card,
        bypass,
        multi,
      }));
      this.afterQueue = "finish";
      this.advanceQueue();
    }
    advanceQueue() {
      const s = this.s;
      while (s.queue.length) {
        const attack = s.queue.shift(),
          p = this.player(attack.to);
        if (p.hp <= 0) continue;
        if (attack.bypass || p.status.invincible) {
          this.damage(p, attack.amount, { bypass: attack.bypass });
          continue;
        }
        if (p.hand.some((c) => this.canReact(c, attack))) {
          s.phase = "react";
          s.pending = attack;
          s.deadline = this.now() + this.responseMs;
          return;
        }
        this.damage(p, attack.amount);
      }
      s.pending = null;
      if (this.endCheck()) return;
      if (this.afterQueue === "begin") this.finishBegin();
      else this.finish();
    }
    canReact(c, a) {
      return (
        defense.has(c.id) &&
        !(a.card === 9 && [2, 20].includes(c.id)) &&
        !(c.id === 13 && (a.multi || this.alive().length < 2))
      );
    }
    consume(p, uid) {
      const i = p.hand.findIndex((c) => c.uid === uid);
      check(i >= 0, "손패에 없는 카드입니다.");
      return p.hand.splice(i, 1)[0];
    }
    target(id, owner, allowSelf = false) {
      const p = this.player(id);
      check(
        p.hp > 0 && (allowSelf || id !== owner),
        "살아 있는 대상을 선택하세요.",
      );
      return p;
    }
    action(actor, input) {
      const s = this.s;
      check(s.phase !== "over", "종료된 게임입니다.");
      check(input && typeof input === "object");
      if (input.revision !== undefined)
        check(input.revision === s.revision, "이미 처리된 행동입니다.");
      const p = this.player(actor);
      check(p.hp > 0, "탈락한 플레이어입니다.");
      // Validate everything before mutation. Revision advances only on a successful command.
      if (s.phase === "discard") {
        check(s.pending.actor === actor, "버리기 대상이 아닙니다.");
        check(input.kind === "discard");
        check(p.hand.some((c) => c.uid === input.card));
        this.consume(p, input.card);
        this.overflowContinue();
      } else if (s.phase === "react") {
        const a = s.pending;
        check(a.to === actor, "방어 대상이 아닙니다.");
        check(["take", "react"].includes(input.kind));
        let c = null,
          split = null;
        if (input.kind === "react") {
          c = p.hand.find((x) => x.uid === input.card);
          check(c && this.canReact(c, a), "지금 사용할 수 없는 방어입니다.");
          if (c.id === 13) split = this.target(input.target, actor);
        }
        if (c) this.consume(p, c.uid);
        if (c) this.event("card", { actor, card: c.id });
        let amount = a.amount;
        if (c?.id === 2) {
          amount = 0;
          if (a.card === 1) {
            this.replaceField(null);
            this.damage(this.player(a.from), 14);
          } else this.damage(this.player(a.from), Math.min(20, a.amount + 3));
        }
        if (c?.id === 10 && amount <= 20) amount = 0;
        if (c?.id === 13) {
          this.damage(split, Math.ceil(amount / 2));
          amount = Math.floor(amount / 2);
        }
        if (c?.id === 20) this.status(this.player(a.from), "touch", 2);
        if (c?.id === 23)
          amount = Math.max(
            0,
            amount - (p.hand.some((x) => x.id === 1) ? 35 : 10),
          );
        if (c?.id === 26) amount = Math.max(0, amount - (c.armor || 0));
        if (c?.id === 27) {
          p.status.invincible = true;
          amount = 0;
        }
        if (c?.id === 29) amount = Math.min(6, amount);
        if (c?.id === 30) {
          const success = this.rng() < 0.5;
          this.log(
            `${p.name} 초심자의 행운: ${success ? "회피 성공" : "회피 실패"}`,
          );
          if (success) amount = 0;
        }
        this.damage(p, amount);
        s.pending = null;
        this.advanceQueue();
      } else if (s.phase === "gift") {
        check(s.pending.target === actor, "선물 대상이 아닙니다.");
        check(["accept", "reject"].includes(input.kind));
        const owner = this.player(s.pending.owner);
        if (input.kind === "accept") {
          const victim = this.rng() < 0.5 ? owner : p,
            n = this.rand(8, 18);
          this.log(`룰렛: ${victim.name}, 피해 ${n}`);
          this.damage(victim, n);
        } else this.heal(owner, 8);
        s.pending = null;
        this.finish();
      } else if (s.phase === "steal") {
        check(s.pending.owner === actor);
        check(input.kind === "steal");
        check(Array.isArray(input.cards));
        const desired = Math.min(
          2,
          this.alive()
            .filter((x) => x.id !== actor)
            .reduce((n, x) => n + x.hand.length, 0),
        );
        check(input.cards.length === desired, "가져올 카드를 선택하세요.");
        check(new Set(input.cards).size === desired);
        const picked = input.cards.map((uid) => {
          const owner = this.alive().find(
            (x) => x.id !== actor && x.hand.some((c) => c.uid === uid),
          );
          check(owner, "잘못된 카드입니다.");
          return [owner, uid];
        });
        check(
          !p.status.touch || desired === 0,
          "카드 획득이 금지되어 있습니다.",
        );
        for (const [owner, uid] of picked)
          this.acquire(p, this.consume(owner, uid));
        s.pending = null;
        this.finish();
      } else {
        check(
          s.phase === "turn" && s.turn === actor,
          "자기 차례에만 행동할 수 있습니다.",
        );
        if (input.kind === "stop") {
          check(s.field?.owner === actor && s.field.id === 1);
          this.replaceField(null);
        } else if (input.kind === "exchange") {
          check(
            Array.isArray(input.cards) &&
              input.cards.length <= 2 &&
              input.cards.length >= 1,
          );
          check(new Set(input.cards).size === input.cards.length);
          check(!p.status.touch, "카드 획득이 금지되어 있습니다.");
          check(input.cards.every((uid) => p.hand.some((c) => c.uid === uid)));
          for (const uid of input.cards) {
            this.consume(p, uid);
            this.acquire(p, this.card(pool[this.rand(0, pool.length - 1)]));
          }
          this.finish();
        } else if (input.kind === "fuse") {
          check(
            !p.status.xerath && !p.status.touch,
            "지금 합성할 수 없습니다.",
          );
          const cards = p.hand.filter((c) => c.id === 5);
          check(cards.length >= 2);
          this.consume(p, cards[0].uid);
          this.consume(p, cards[1].uid);
          this.acquire(p, this.card(6));
          this.event("card", { actor, card: 6 });
          this.finish();
        } else if (input.kind === "pass") {
          this.finish();
        } else {
          check(input.kind === "play");
          const c = p.hand.find((x) => x.uid === input.card);
          check(c, "손패에 없는 카드입니다.");
          const id = c.id;
          check(
            !p.status.xerath || ["회복", "방어"].includes(CARDS[id - 1].type),
            "제라스: 회복·방어·교환만 가능합니다.",
          );
          check(
            ![2, 10, 13, 20, 23, 26, 29, 30].includes(id),
            "이 카드는 공격받을 때 사용합니다.",
          );
          let target = null;
          if ([3, 4, 5, 7, 9, 11, 12, 16, 17].includes(id))
            target = this.target(input.target, actor, id === 12);
          let judgments = [];
          if (id === 18) {
            const n = Math.min(2, this.alive().length - 1);
            check(Array.isArray(input.targets) && input.targets.length === n);
            check(new Set(input.targets.map((x) => x.id)).size === n);
            judgments = input.targets.map((x) => {
              check(["heaven", "hell"].includes(x.mode));
              return { p: this.target(x.id, actor), mode: x.mode };
            });
            check(!p.status.touch, "카드 획득이 금지되어 있습니다.");
          }
          if ([5, 6, 17].includes(id))
            check(
              !(id === 17 ? target : p).status.touch,
              "카드 획득이 금지되어 있습니다.",
            );
          this.consume(p, c.uid);
          this.event("card", { actor, card: id });
          this.log(`${p.name} · ${CARDS[id - 1].name}`);
          switch (id) {
            case 1:
              this.replaceField({ id, owner: actor, after: p.turns, left: 3 });
              break;
            case 3:
              s.phase = "gift";
              s.pending = { owner: actor, target: target.id };
              s.deadline = this.now() + this.responseMs;
              break;
            case 4:
              this.replaceField({ id, owner: actor, target: target.id });
              this.status(target, "red", 2);
              break;
            case 5:
              if (target.hand.length)
                this.acquire(
                  p,
                  this.consume(
                    target,
                    target.hand[this.rand(0, target.hand.length - 1)].uid,
                  ),
                );
              break;
            case 6:
              s.phase = "steal";
              s.pending = { owner: actor };
              s.deadline = this.now() + this.responseMs;
              if (!this.alive().some((x) => x.id !== actor && x.hand.length)) {
                s.pending = null;
                s.phase = "turn";
              }
              break;
            case 7:
              this.attack(actor, [target.id], this.rand(6, 16), id);
              break;
            case 8:
              this.heal(p, this.rand(8, 16));
              break;
            case 9:
              this.attack(actor, [target.id], this.rand(8, 12), id);
              break;
            case 11:
              this.payHP(p, 5);
              this.attack(actor, [target.id], 21, id);
              break;
            case 12:
              if (s.field?.id === 4 && s.field.target === actor)
                this.replaceField(null);
              this.cleanse(target);
              break;
            case 14:
              this.heal(p, this.rand(18, 25));
              for (const other of this.alive())
                if (other.id !== actor) this.heal(other, 10);
              break;
            case 15:
              this.attack(
                actor,
                this.alive()
                  .filter((x) => x.id !== actor)
                  .map((x) => x.id),
                6,
                id,
                { bypass: true, multi: true },
              );
              break;
            case 16:
              this.status(target, "xerath", 1);
              this.payHP(p, 5);
              break;
            case 17:
              this.acquire(target, this.card(25));
              this.status(target, "noheal", 2);
              s.links = s.links.filter(
                (l) => !(l.owner === actor && l.target === target.id),
              );
              s.links.push({
                owner: actor,
                target: target.id,
                left: 2,
                after: target.turns,
              });
              break;
            case 18: {
              let armor = 0;
              for (const j of judgments) {
                const matching = j.p.hand.filter(
                  (x) =>
                    CARDS[x.id - 1].type ===
                    (j.mode === "heaven" ? "회복" : "공격"),
                );
                for (const x of matching) {
                  armor += values[x.id] || 0;
                  this.acquire(p, this.consume(j.p, x.uid));
                }
              }
              this.acquire(p, this.card(26, { armor }));
              break;
            }
            case 19: {
              let i = actor;
              do {
                i = (i + 1) % s.players.length;
              } while (this.player(i).hp <= 0);
              const other = this.player(i);
              if (
                p.hand.length &&
                other.hand.length &&
                !p.status.touch &&
                !other.status.touch
              ) {
                const a = this.consume(
                    p,
                    p.hand[this.rand(0, p.hand.length - 1)].uid,
                  ),
                  b = this.consume(
                    other,
                    other.hand[this.rand(0, other.hand.length - 1)].uid,
                  );
                this.acquire(p, b);
                this.acquire(other, a);
              } else this.log("교환 가능한 손패가 없어 교환하지 않음");
              break;
            }
            case 21: {
              let total = 0;
              for (const other of this.alive()) {
                const paid = Math.min(5, other.hp);
                other.hp -= paid;
                total += paid;
                this.event("damage", { target: other.id, amount: paid });
              }
              const live = this.alive();
              if (live.length)
                this.heal(live[this.rand(0, live.length - 1)], total);
              break;
            }
            case 22:
              this.cleanse(p);
              break;
            case 24:
              for (const other of this.alive())
                if (other.id !== actor)
                  this.status(
                    other,
                    "skip",
                    p.hand.some((x) => x.id === 27) ? 2 : 1,
                  );
              break;
            case 25:
              break;
            case 27:
              p.status.invincible = true;
              break;
            case 28: {
              const live = this.alive(),
                total = live.reduce((n, x) => n + x.hp, 0),
                base = Math.floor(total / live.length);
              let rem = total % live.length;
              for (let d = 0; d < s.players.length; d++) {
                const other = this.player((actor + d) % s.players.length);
                if (other.hp > 0) other.hp = base + (rem-- > 0 ? 1 : 0);
              }
              break;
            }
            default:
              throw Error("지원하지 않는 카드");
          }
          if (s.phase === "turn" && ![7, 9, 11, 15].includes(id)) this.finish();
        }
      }
      s.revision++;
      return this.view(actor);
    }
    timeout() {
      const s = this.s;
      if (s.phase === "over" || this.now() < s.deadline) return;
      const actor =
        s.pending?.actor ??
        s.pending?.to ??
        s.pending?.target ??
        s.pending?.owner ??
        s.turn;
      let input = { kind: "pass" };
      if (s.phase === "react") input = { kind: "take" };
      if (s.phase === "gift") input = { kind: "reject" };
      if (s.phase === "discard")
        input = { kind: "discard", card: this.player(actor).hand.at(-1).uid };
      if (s.phase === "steal") {
        const cards = this.alive()
          .filter((x) => x.id !== actor)
          .flatMap((x) => x.hand)
          .slice(0, 2)
          .map((c) => c.uid);
        input = { kind: "steal", cards };
      }
      this.log(`${this.player(actor).name} 응답 시간 초과`);
      this.action(actor, input);
    }
    view(actor) {
      const s = this.s;
      return {
        players: s.players.map((p) => ({
          id: p.id,
          name: p.name,
          hp: p.hp,
          status: structuredClone(p.status),
          turns: p.turns,
          count: p.hand.length,
          ...(p.id === actor ||
          (s.phase === "steal" && s.pending.owner === actor)
            ? { hand: structuredClone(p.hand) }
            : {}),
        })),
        turn: s.turn,
        phase: s.phase,
        field: structuredClone(s.field),
        pending: structuredClone(s.pending),
        logs: [...s.logs],
        events: structuredClone(s.events),
        revision: s.revision,
        deadline: s.deadline,
        winner: s.winner,
        me: actor,
      };
    }
  }
  return { Game, CARDS, pool, defense };
});
