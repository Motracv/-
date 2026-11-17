/* Public-event-only presentation. Decorative card backs never expose hand data. */
(function (root) {
  "use strict";
  const rows = [
    ["ace-orbit", "✧", "#ffd36e", "필드 전개"],
    ["rebound", "↩", "#7ddfff", "반격 준비"],
    ["gift-box", "🎁", "#ffb2e1", "선물 선택"],
    ["red-book", "▤", "#ff7294", "회복 봉인"],
    ["card-pull", "✦", "#c9a6ff", "카드 훔치기"],
    ["fusion-eye", "◉", "#f0b4ff", "손패 탐색"],
    ["power-fist", "✊", "#ff9366", "진심펀치"],
    ["training-heart", "♥", "#78f7ad", "체력 회복"],
    ["claw-triple", "≋", "#ffc3df", "반격 불가"],
    ["taxi-barrier", "🚕", "#ffe27b", "20 이하 방어"],
    ["giant-fist", "✊", "#ff704f", "대신 공격"],
    ["brush-cleanse", "✎", "#80ffda", "상태 정화"],
    ["split-link", "⋈", "#7cdfff", "피해 분담"],
    ["rank-wings", "✚", "#afffc0", "전원 회복"],
    ["nova-stars", "★", "#ed9fff", "방어 무시"],
    ["lightning-cage", "ϟ", "#9caeff", "행동 제한"],
    ["siphon-heart", "♥", "#ff82b5", "피해만큼 회복"],
    ["judgment-scale", "⚖", "#ffd77f", "천국 · 지옥"],
    ["swap-cards", "⇄", "#92dcff", "카드 교환"],
    ["hand-lock", "🔒", "#a2bbff", "카드 획득 금지"],
    ["car-collection", "🚙", "#ffdf7d", "HP 모으기"],
    ["status-break", "◇", "#95ffeb", "내 상태 정화"],
    ["survival-shield", "◇", "#72dfff", "피해 차감"],
    ["domain-clock", "◷", "#bc8fff", "차례 봉인"],
    ["sealed-heart", "♥", "#d2a6cf", "사용 효과 없음"],
    ["judge-shield", "♜", "#e4c5ff", "압수 방어"],
    ["absolute-dome", "✧", "#b9f3ff", "무적 전개"],
    ["equalize-scale", "⚖", "#93e4ff", "HP 균등 분배"],
    ["dice-cap", "⚅", "#9ddfff", "피해 최대 6"],
    ["luck-star", "✦", "#d1ffd6", "회피 추첨"],
    ["devil-flame", "♠", "#b18aff", "데빌 공격"],
    ["taunt-magnet", "⊂", "#ff93bc", "현비에게 집중"],
    ["phone-spin", "▯", "#c4e8ff", "휴대폰 투척"],
    ["curse-chain", "⛓", "#cb86ff", "지속 저주"],
    ["measure-blade", "Ⅰ", "#ffbf7e", "1~9 공격"],
    ["car-crash", "🚗", "#ff8267", "상대와 나 피해"],
    ["burger-stack", "🍔", "#ffc765", "햄버거 공격"],
    ["baseball-spin", "⚾", "#f1fbff", "공격 후 반격 자세"],
    ["president-crown", "♛", "#ffdf8d", "최고 ↓ 최저 ↑"],
    ["food-steam", "♨", "#9bffc4", "두 차례 회복"],
  ];
  const profiles = Object.freeze(Object.fromEntries(rows.map((row, i) => [i + 1, Object.freeze({ id: i + 1, motif: row[0], icon: row[1], color: row[2], cue: row[3] })])));
  const fallback = profiles[7];
  const active = (ctx) => !ctx.isCurrent || ctx.isCurrent();
  const reduced = (ctx) => !!ctx.reduced?.();
  function tag(node, profile) {
    node.dataset.card = profile.id;
    node.dataset.motif = profile.motif;
    return node;
  }
  function part(parent, cls, text) {
    const node = document.createElement("span");
    node.className = cls;
    if (text !== undefined) node.textContent = text;
    parent.append(node);
    return node;
  }
  function safePoint(ctx, player, padding = 32) {
    const p = ctx.point(player), layer = document.getElementById("effects");
    return { x: Math.max(padding, Math.min(layer.clientWidth - padding, p.x)), y: Math.max(padding, Math.min(layer.clientHeight - padding, p.y)) };
  }
  function stage(ctx) {
    const area = document.getElementById("battle").getBoundingClientRect(), arena = document.getElementById("arena").getBoundingClientRect();
    return { x: (arena.left - area.left) + arena.width * .78, y: (arena.top - area.top) + arena.height * .55 };
  }
  function prop(ctx, profile, at, extra = "") {
    const node = tag(ctx.element(`duel-fx duel-prop motif-${profile.motif} ${extra}`, at, profile.color), profile);
    const core = part(node, "prop-core");
    if (profile.id === 33) {
      core.classList.add("prop-phone");
      part(core, "phone-screen", "ϟ"); part(core, "phone-camera"); part(core, "phone-home");
    } else if (profile.id === 37) {
      core.classList.add("prop-burger");
      for (const cls of ["burger-top", "burger-lettuce", "burger-cheese", "burger-patty", "burger-bottom"]) part(core, cls);
    } else if (profile.id === 38) {
      core.classList.add("prop-baseball"); part(core, "ball-seam seam-left"); part(core, "ball-seam seam-right");
    } else if (profile.id === 29) {
      core.classList.add("prop-dice");
      for (let i = 0; i < 6; i++) part(core, "dice-dot");
    } else if ([2, 10, 23, 26, 27].includes(profile.id)) {
      core.classList.add("prop-shield"); part(core, "shield-glyph", profile.id === 10 ? "20" : profile.id === 23 ? "◇" : profile.id === 26 ? "♜" : profile.id === 2 ? "↩" : "∞");
    } else if (profile.id === 4) {
      core.classList.add("prop-book"); part(core, "book-mark", "♥"); part(core, "book-cross", "×");
    } else if (profile.id === 3) {
      core.classList.add("prop-gift"); part(core, "gift-ribbon"); part(core, "gift-bow", "∞");
    } else if (profile.id === 40) {
      core.classList.add("prop-food"); part(core, "food-steam", "♨"); part(core, "food-bowl", "✚");
    } else if (profile.id === 9) {
      core.classList.add("prop-claw"); for (let i = 0; i < 3; i++) part(core, "claw-mark");
    } else if (profile.id === 35) {
      core.classList.add("prop-ruler"); part(core, "ruler-mark", "1   5   9");
    } else {
      core.classList.add("prop-glyph"); core.textContent = profile.icon;
    }
    return node;
  }
  function floatProp(ctx, profile, at, extra = "", duration = 520) {
    if (!active(ctx)) return Promise.resolve();
    const node = prop(ctx, profile, at, extra);
    const frames = reduced(ctx)
      ? [{ opacity: 0, transform: "translate(-50%,-50%)" }, { opacity: 1, offset: .25, transform: "translate(-50%,-50%)" }, { opacity: 0, transform: "translate(-50%,-50%)" }]
      : [{ opacity: 0, transform: "translate(-50%,-35%) perspective(480px) rotateY(-65deg) rotateX(20deg) scale(.2)" }, { opacity: 1, transform: "translate(-50%,-50%) perspective(480px) rotateY(12deg) rotateX(-8deg) scale(1.18)", offset: .3 }, { opacity: 1, transform: "translate(-50%,-55%) perspective(480px) rotateY(-8deg) rotateX(5deg) scale(1)", offset: .72 }, { opacity: 0, transform: "translate(-50%,-70%) perspective(480px) rotateY(35deg) scale(.75)" }];
    return ctx.animate(node, frames, duration);
  }
  function ground(ctx, at, profile, variant = "") {
    if (!active(ctx)) return Promise.resolve();
    const node = tag(ctx.element(`duel-fx duel-ground ${variant}`, at, profile.color), profile);
    part(node, "ground-inner");
    return ctx.animate(node, reduced(ctx) ? [{ opacity: 0 }, { opacity: .8, offset: .3 }, { opacity: 0 }] : [
      { opacity: 0, transform: "translate(-50%,-50%) perspective(500px) rotateX(64deg) rotateZ(-40deg) scale(.15)" },
      { opacity: .9, transform: "translate(-50%,-50%) perspective(500px) rotateX(64deg) rotateZ(0deg) scale(1)", offset: .3 },
      { opacity: 0, transform: "translate(-50%,-50%) perspective(500px) rotateX(64deg) rotateZ(55deg) scale(1.65)" },
    ], 520);
  }
  function beam(ctx, a, b, profile, extra = "") {
    if (!active(ctx)) return Promise.resolve();
    const dx = b.x - a.x, dy = b.y - a.y, angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const node = tag(ctx.element(`duel-fx duel-beam ${extra}`, a, profile.color), profile);
    node.style.width = Math.max(10, Math.hypot(dx, dy)) + "px";
    return ctx.animate(node, [
      { opacity: 0, transform: `rotate(${angle}deg) scaleX(.02)` },
      { opacity: .95, transform: `rotate(${angle}deg) scaleX(1)`, offset: .3 },
      { opacity: 0, transform: `rotate(${angle}deg) scaleX(1)` },
    ], 420);
  }
  function orbit(ctx, at, profile, icon = profile.icon, count = 4) {
    if (reduced(ctx) || !active(ctx)) return [];
    const jobs = [];
    for (let i = 0; i < count; i++) {
      const node = tag(ctx.element("duel-fx duel-orbit", at, profile.color), profile);
      node.textContent = icon;
      const angle = (i / count) * Math.PI * 2, dx = Math.cos(angle) * 55, dy = Math.sin(angle) * 30;
      jobs.push(ctx.animate(node, [{ opacity: 0, transform: "translate(-50%,-50%) scale(.2)" }, { opacity: .9, transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(1.1)`, offset: .45 }, { opacity: 0, transform: `translate(calc(-50% + ${dx * 1.4}px),calc(-50% + ${dy * 1.4}px)) scale(.5)` }], 520));
    }
    return jobs;
  }
  function cardBack(ctx, a, b, profile, direction = 1, flow = {}) {
    const node = tag(ctx.element("duel-fx duel-card-back", a, profile.color), profile);
    // These are public seat IDs / a presentation destination, never card IDs.
    for (const [key, value] of Object.entries(flow)) node.dataset[key] = String(value);
    part(node, "card-back-seal", "✧");
    const dx = b.x - a.x, dy = b.y - a.y;
    return ctx.animate(node, reduced(ctx) ? [{ opacity: 0 }, { opacity: 1, offset: .3 }, { opacity: 0 }] : [
      { opacity: 0, transform: `translate(-50%,-50%) perspective(400px) rotateY(${80 * direction}deg) scale(.5)` },
      { opacity: 1, transform: `translate(calc(-50% + ${dx * .5}px),calc(-50% + ${dy * .5 - 35}px)) perspective(400px) rotateY(${180 * direction}deg) scale(1.2)`, offset: .5 },
      { opacity: 0, transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) perspective(400px) rotateY(${360 * direction}deg) scale(.5)` },
    ], 520);
  }
  async function card(e, ctx) {
    if (!active(ctx)) return;
    const p = profiles[e.card] || fallback, origin = safePoint(ctx, e.actor), targets = (e.targets || [e.actor]).slice(0, 5), first = safePoint(ctx, targets[0] ?? e.actor);
    const jobs = [];
    if (e.card === 25) {
      const empty = tag(ctx.element("duel-fx duel-empty-card", origin, "#a0a9bc"), p);
      part(empty, "empty-card-seal", "×");
      return ctx.animate(empty, [{ opacity: .8, transform: "translate(-50%,-50%) scale(1)" }, { opacity: .5, transform: "translate(-50%,-65%) scale(.8)", offset: .45 }, { opacity: 0, transform: "translate(-50%,-85%) scale(.1)" }], 480);
    }
    if ([1, 4].includes(e.card)) {
      const zone = document.getElementById("field-zone").getBoundingClientRect(), area = document.getElementById("battle").getBoundingClientRect();
      const at = { x: zone.left - area.left + zone.width / 2, y: zone.top - area.top + zone.height / 2 };
      jobs.push(floatProp(ctx, p, at), ground(ctx, at, p, "ground-field"));
    } else if ([5, 6, 18, 19].includes(e.card)) {
      const at = stage(ctx);
      jobs.push(floatProp(ctx, p, at), ground(ctx, at, p));
      // Stylized backs indicate card manipulation without showing a hidden card.
      // The paths follow the rule, but their decorative count is not an inventory.
      if (e.card === 5) {
        jobs.push(cardBack(ctx, first, origin, p, 1, { from: targets[0], to: e.actor, flow: "steal" }));
      } else if (e.card === 18) {
        for (const target of targets.filter(id => id !== e.actor))
          jobs.push(cardBack(ctx, safePoint(ctx, target), origin, p, 1, { from: target, to: e.actor, flow: "confiscate" }));
      } else if (e.card === 6) {
        // The player has not selected the stolen cards yet: reveal into the eye,
        // without suggesting that anyone's hand has already changed ownership.
        for (const target of targets.filter(id => id !== e.actor))
          jobs.push(cardBack(ctx, safePoint(ctx, target), at, p, 1, { from: target, to: "inspect", flow: "reveal" }));
      } else {
        const players = ctx.getView()?.players || [], index = players.findIndex(player => player.id === e.actor);
        let next;
        for (let offset = 1; index >= 0 && offset < players.length; offset++) {
          const candidate = players[(index + offset) % players.length];
          if (candidate.hp > 0) { next = candidate; break; }
        }
        if (next) {
          const other = safePoint(ctx, next.id);
          jobs.push(cardBack(ctx, origin, other, p, 1, { from: e.actor, to: next.id, flow: "swap" }));
          jobs.push(cardBack(ctx, other, origin, p, -1, { from: next.id, to: e.actor, flow: "swap" }));
        }
      }
    } else if ([14, 21, 24, 28, 39].includes(e.card)) {
      const at = stage(ctx);
      jobs.push(floatProp(ctx, p, at), ground(ctx, at, p));
      for (const target of targets) {
        const atTarget = safePoint(ctx, target);
        jobs.push(beam(ctx, at, atTarget, p, e.card === 24 ? "beam-seal" : ""));
        jobs.push(...orbit(ctx, atTarget, p, e.card === 24 ? "◷" : e.card === 28 ? "=" : e.card === 14 ? "✚" : "◇", 2));
      }
    } else if ([2, 10, 13, 20, 23, 26, 27, 29, 30].includes(e.card)) {
      jobs.push(floatProp(ctx, p, origin, "duel-defense-prop"), ground(ctx, origin, p, "ground-shield"));
      if (e.card === 13) jobs.push(beam(ctx, origin, first, p));
    } else if ([7, 9, 11, 15, 31, 33, 35, 36, 37, 38].includes(e.card)) {
      jobs.push(ground(ctx, origin, p, "ground-charge"));
      jobs.push(...orbit(ctx, origin, p, e.card === 15 ? "★" : "✦", 3));
    } else {
      const at = [3, 12, 16, 17, 32, 34].includes(e.card) ? first : origin;
      jobs.push(floatProp(ctx, p, at), ground(ctx, at, p));
      if ([8, 12, 22, 40].includes(e.card)) jobs.push(...orbit(ctx, at, p, e.card === 12 || e.card === 22 ? "◇" : "✚", 4));
      if (e.card === 32) jobs.push(beam(ctx, origin, at, p, "beam-taunt"));
      if (e.card === 34) jobs.push(...orbit(ctx, at, p, "⛓", 3));
    }
    await Promise.all(jobs);
  }
  async function attack(e, ctx) {
    if (!active(ctx)) return;
    const p = profiles[e.card] || fallback, start = safePoint(ctx, e.from), targets = (e.targets || []).slice(0, 5);
    await Promise.all(targets.map(async (id) => {
      const end = safePoint(ctx, id), dx = end.x - start.x, dy = end.y - start.y;
      const node = prop(ctx, p, start, "fx-projectile duel-missile" + (e.reaction ? " duel-reflection" : ""));
      node.dataset.reaction = e.reaction ? "true" : "false";
      const spin = [33, 38].includes(e.card) ? 570 : e.card === 35 ? 30 : e.reaction ? -120 : 20;
      if (!reduced(ctx)) {
        for (let i = 0; i < 3; i++) {
          const trail = tag(ctx.element("duel-fx duel-speed-line", { x: start.x + dx * (i + 1) / 5, y: start.y + dy * (i + 1) / 5 }, p.color), p);
          trail.style.rotate = `${Math.atan2(dy, dx) * 180 / Math.PI}deg`;
          void ctx.animate(trail, [{ opacity: 0, transform: "scaleX(.1)" }, { opacity: .85, transform: "scaleX(1)", offset: .4 }, { opacity: 0, transform: "scaleX(.6)" }], 420);
        }
      }
      if ([1, 15].includes(e.card)) void beam(ctx, start, end, p, "beam-magic");
      const travel = reduced(ctx)
        ? [{ opacity: 0, transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))` }, { opacity: 1, transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`, offset: .3 }, { opacity: 0, transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))` }]
        : [{ opacity: 0, transform: "translate(-50%,-50%) perspective(450px) rotateY(-35deg) scale(.5)" }, { opacity: 1, transform: `translate(calc(-50% + ${dx * .42}px),calc(-50% + ${dy * .42 - 30}px)) perspective(450px) rotateY(30deg) rotateZ(${spin * .35}deg) scale(1.45)`, offset: .5 }, { opacity: 1, transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) perspective(450px) rotateY(-10deg) rotateZ(${spin}deg) scale(.95)` }];
      await ctx.animate(node, travel, 440);
      // Incoming animation makes no damage claim. Actual hit/block arrives separately.
    }));
  }
  function crossCrack(ctx, at, p, amount) {
    const node = tag(ctx.element("duel-fx duel-impact-crack", at, p.color), p);
    const pieces = reduced(ctx) ? 3 : Math.min(8, 4 + Math.floor(amount / 8));
    for (let i = 0; i < pieces; i++) {
      const ray = part(node, "impact-ray");
      ray.style.rotate = `${i * (360 / pieces) + 17}deg`;
      ray.style.height = `${35 + (i % 3) * 12}px`;
    }
    return ctx.animate(node, reduced(ctx) ? [{ opacity: 0 }, { opacity: .75, offset: .3 }, { opacity: 0 }] : [{ opacity: 0, transform: "translate(-50%,-50%) scale(.2) rotate(-15deg)" }, { opacity: 1, transform: "translate(-50%,-50%) scale(1.2) rotate(0deg)", offset: .25 }, { opacity: 0, transform: "translate(-50%,-50%) scale(1.7) rotate(5deg)" }], 570);
  }
  async function impact(e, ctx) {
    if (!active(ctx) || e.forfeit) return;
    const p = profiles[e.card] || (e.kind === "heal" ? profiles[8] : e.kind === "block" ? profiles[23] : fallback), at = safePoint(ctx, e.target);
    if (e.kind === "heal") {
      const halo = tag(ctx.element("duel-fx duel-heal-wings", at, "#88ffc2"), profiles[8]);
      part(halo, "heal-wing left"); part(halo, "heal-wing right"); part(halo, "heal-center", "✚");
      return ctx.animate(halo, reduced(ctx) ? [{ opacity: 0 }, { opacity: 1, offset: .3 }, { opacity: 0 }] : [{ opacity: 0, transform: "translate(-50%,-50%) scale(.4) rotateY(50deg)" }, { opacity: 1, transform: "translate(-50%,-70%) scale(1.1) rotateY(0)", offset: .3 }, { opacity: 0, transform: "translate(-50%,-110%) scale(1.3)" }], 700);
    }
    if (e.kind === "block") return Promise.all([floatProp(ctx, profiles[23], at, "duel-block-confirmed", 620), ground(ctx, at, profiles[23], "ground-shield")]);
    if (e.kind === "damage" && e.amount > 0 && !e.cost) {
      const jobs = [crossCrack(ctx, at, p, e.amount)];
      if (!reduced(ctx)) {
        for (let i = 0; i < 6; i++) {
          const piece = tag(ctx.element("duel-fx duel-shard", at, p.color), p), a = i * Math.PI / 3;
          jobs.push(ctx.animate(piece, [{ opacity: 1, transform: "translate(-50%,-50%) scale(1)" }, { opacity: 0, transform: `translate(calc(-50% + ${Math.cos(a) * 58}px),calc(-50% + ${Math.sin(a) * 44}px)) rotate(${i * 71}deg) scale(.1)` }], 570));
        }
      }
      return Promise.all(jobs);
    }
  }
  async function status(e, ctx) {
    if (!active(ctx)) return;
    const ids = { red: 4, noheal: 17, touch: 20, xerath: 16, skip: 24, invincible: 27, taunt: 32, curse: 34, baseball: 38, regen: 40 };
    const target = e.target ?? e.targets?.[0] ?? e.source ?? e.from;
    const at = safePoint(ctx, target), p = profiles[e.card || ids[e.status]] || profiles[22];
    if (e.kind === "cleanse") {
      return Promise.all([floatProp(ctx, profiles[22], at, "duel-status-prop"), ...orbit(ctx, at, profiles[22], "◇", 4)]);
    }
    if (e.kind === "miss") {
      const node = prop(ctx, profiles[e.card] || profiles[33], at, "duel-status-prop duel-missed");
      return ctx.animate(node, [{ opacity: .7, transform: "translate(-50%,-50%) scale(.7)" }, { opacity: 0, transform: "translate(40%,-90%) rotate(60deg) scale(.5)" }], 450);
    }
    if (e.kind === "phone-roll" || e.kind === "class-president") return;
    if (e.kind === "roulette") {
      return Promise.all([floatProp(ctx, profiles[3], at, "duel-status-prop"), ...orbit(ctx, at, profiles[3], "✦", 5)]);
    }
    if (e.kind === "status-tick") {
      if (e.status === "regen" && e.amount > 0) return; // heal event has the actual gain.
      return floatProp(ctx, p, at, "duel-status-prop");
    }
    if (e.kind !== "status") return;
    const jobs = [floatProp(ctx, p, at, "duel-status-prop")];
    if (["red", "noheal", "touch", "xerath", "curse"].includes(e.status)) {
      const seal = tag(ctx.element("duel-fx duel-seal", at, p.color), p);
      seal.textContent = e.status === "curse" ? "⛓" : "×";
      jobs.push(ctx.animate(seal, [{ opacity: 0, transform: "translate(-50%,-50%) scale(1.8) rotate(-35deg)" }, { opacity: .9, transform: "translate(-50%,-50%) scale(1) rotate(0)", offset: .3 }, { opacity: 0, transform: "translate(-50%,-50%) scale(1.05)" }], 650));
    }
    if (e.status === "taunt") {
      const players = ctx.getView()?.players || [];
      for (const player of players.filter(x => x.hp > 0 && x.id !== target).slice(0, 4)) jobs.push(beam(ctx, safePoint(ctx, player.id), at, p, "beam-taunt"));
    }
    return Promise.all(jobs);
  }
  root.DuelFX = Object.freeze({ profiles, card, attack, status, impact });
})(globalThis);
