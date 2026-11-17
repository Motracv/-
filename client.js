"use strict";
const { Game, CARDS, defense, MAX_HP } = Battle,
  $ = (id) => document.getElementById(id);
const typeIcons = {
  공격: "⚔",
  방어: "◈",
  반격: "↩",
  회복: "✚",
  마법: "ϟ",
  필드: "✧",
  특수: "✦",
};
const statusNames = {
  red: "빨간노트", noheal: "회복 금지", touch: "획득 금지", xerath: "제라스",
  skip: "차례 생략", invincible: "무적", taunt: "현비 · 공격 집중",
  curse: "팬티 · 2턴마다 −10", baseball: "야구공 · 반격 5", regen: "음식 · +5 회복",
};
let artFiles = new Set();
const shownResults = new Set();
let local,
  view,
  online = null,
  selected = new Set(),
  exchange = false,
  selectedTarget = null,
  practicePlayers = Number(localStorage.getItem("practice-players")) || 5,
  busy = false,
  lastEvent = 0,
  aiTimer,
  toastTimer,
  streamAbort,
  transport = "sse",
  lastPlayed = null,
  fxQueue = Promise.resolve();
let server =
  localStorage.getItem("card-server") ||
  (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? location.origin : "");
const sessionKey = "card-session";
const DEFAULT_SERVER = "https://motracv-card-room.densedormouse4.chatgpt.site";
if (!server) server = DEFAULT_SERVER;
const shortEffects = [
  "전체 4 × 3회",
  "막고 +3 반격",
  "룰렛 8–18",
  "회복 금지 2턴",
  "무작위 1장 훔치기",
  "원하는 2장 훔치기",
  "피해 6–16",
  "회복 8–16",
  "피해 8–12",
  "20 이하 방어",
  "피해 21 · HP −5",
  "상태이상 해제",
  "피해 절반 분담",
  "회복 18–25",
  "전체 피해 6",
  "행동 제한 1턴",
  "피해만큼 회복",
  "카드 압수 · 심판",
  "무작위 카드 교환",
  "카드 획득 금지",
  "HP 모아 회복",
  "내 상태 해제",
  "방어 10 / 35",
  "차례 1 / 2회 생략",
  "회복 금지 2턴",
  "압수 수치 방어",
  "다음 내 차례까지 무적",
  "HP 균등 분배",
  "피해 최대 6",
  "50% 피해 회피",
  "피해 8",
  "공격을 한 명에게 집중",
  "0–100 · 반격 관통 50%",
  "2턴마다 피해 10",
  "피해 1–9",
  "상대 30 · 나도 30",
  "피해 20",
  "피해 15 · 자동 반격 5",
  "최고 −25 · 최저 +25",
  "다음 2턴 +5씩",
];
const targetedCards = new Set([3, 4, 5, 7, 9, 11, 12, 16, 17, 31, 32, 33, 34, 35, 36, 37, 38]);
function roleOf(card) {
  const role = card.id === 40 ? "회복" : card.id === 26 ? "방어" : card.type;
  return { label: role, icon: typeIcons[role], css: { 공격: "attack", 방어: "counter", 반격: "counter", 회복: "heal", 마법: "magic", 필드: "field", 특수: "special" }[role] };
}
function cardSummary(c) {
  return c.id === 26 ? `방어 ${c.armor || 0}` : shortEffects[c.id - 1];
}

function el(tag, text, cls) {
  const x = document.createElement(tag);
  if (text !== undefined) x.textContent = text;
  if (cls) x.className = cls;
  return x;
}
function toast(msg) {
  $("toast").textContent = msg;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").hidden = true), 5000);
}
function closeChoice() {
  $("choice-dialog").close();
  $("choice-body").replaceChildren();
  $("choice-actions").replaceChildren();
}
function choice(title, build, { cancel = true } = {}) {
  closeChoice();
  $("choice-title").textContent = title;
  build($("choice-body"), $("choice-actions"));
  if (cancel) {
    const b = el("button", "취소");
    b.onclick = closeChoice;
    $("choice-actions").append(b);
  }
  $("choice-dialog").showModal();
}
function button(where, label, fn) {
  const b = el("button", label);
  b.onclick = fn;
  where.append(b);
  return b;
}
function self() {
  return view.players[view.me];
}
function targets(allowSelf = false) {
  return view.players.filter(
    (p) => p.hp > 0 && (allowSelf || p.id !== view.me),
  );
}
function pickTarget(title, fn, allowSelf = false) {
  choice(title, (body) => {
    for (const p of targets(allowSelf))
      button(body, `${p.name} · HP ${p.hp}`, () => {
        closeChoice();
        fn(p.id);
      });
  });
}
function refresh(next) {
  const was = view;
  view = next;
  const restoring = view.online && !was?.online;
  if (restoring) {
    resetPresentation();
    // A snapshot on join/reload is current state, not 80 past animations.
    epoch++;
    for (const animation of activeAnimations) animation.cancel();
    activeAnimations.clear();
    $("effects").replaceChildren();
    fxQueue = Promise.resolve();
    lastEvent = view.events.at(-1)?.seq || 0;
    lastPlayed = null;
    $("played-slot").disabled = true;
    $("played-slot").replaceChildren(el("small", "최근 사용 카드 · 꾹 눌러 설명"));
    $("last-result").textContent = "";
    const recentCard = view.events.findLast((event) => event.kind === "card");
    if (recentCard) showPlayedCard(recentCard);
  }
  selected = new Set(
    [...selected].filter((uid) => self().hand?.some((c) => c.uid === uid)),
  );
  if (was?.revision !== view.revision) {
    selected.clear();
    selectedTarget = null;
    exchange = false;
    if ($("choice-dialog").open) closeChoice();
  }
  render({ silentPresentation: restoring });
  animateEvents();
  mandatoryChoice();
  scheduleAI();
}
function localStart() {
  clearTimeout(aiTimer);
  resetPresentation();
  epoch++;
  for (const animation of activeAnimations) animation.cancel();
  activeAnimations.clear();
  $("effects").replaceChildren();
  fxQueue = Promise.resolve();
  $("last-result").textContent = "";
  $("played-slot").replaceChildren(el("small", "카드를 골라 시작하세요"));
  practicePlayers = Math.min(5, Math.max(2, practicePlayers));
  local = new Game(
    ["나", "AI 서찬", "AI 우진", "AI 태영", "AI 건우"].slice(
      0,
      practicePlayers,
    ),
  );
  selectedTarget = null;
  exchange = false;
  lastPlayed = null;
  $("played-slot").disabled = true;
  online = null;
  lastEvent = 0;
  selected.clear();
  closeChoice();
  $("lobby-dialog").close();
  refresh(local.view(0));
}
function resetPresentation() {
  window.DuelSound?.reset();
  shownResults.clear();
  $("result-dialog").close();
  $("result-reopen").hidden = true;
  document.body.dataset.danger = "normal";
  $("danger-label").hidden = true;
}
// Selection always remains available for reading; this describes playing it.
function cardAvailability(card) {
  const p = self(), definition = CARDS[card.id - 1];
  if (view.phase === "over") return "게임 종료";
  if (p.hp <= 0) return "탈락 · 관전";
  if (busy) return "처리 중";
  const ownTurn = view.phase === "turn" && view.turn === view.me;
  if (exchange) return !ownTurn ? "내 차례 대기" : p.status.touch ? "획득 금지" : "";
  if (view.phase === "react") {
    const attack = view.pending;
    if (attack.to !== view.me) return "상대 방어 중";
    if (!defense.has(card.id)) return "방어만 가능";
    if ((attack.card === 9 || attack.noCounter) && [2, 20].includes(card.id)) return "반격 불가";
    if (card.id === 13 && (attack.multi || targets().length === 0)) return "전가 불가";
    return "";
  }
  if (!ownTurn) return view.phase === "turn" ? "내 차례 대기" : "선택 처리 중";
  if ([2, 10, 13, 20, 23, 26, 29, 30].includes(card.id)) return "피격 시 사용";
  if (p.status.xerath && !["회복", "방어"].includes(definition.type)) return "행동 제한";
  if (p.status.touch && [5, 6, 18].includes(card.id)) return "획득 금지";
  if (card.id === 17) {
    if (!targets().some((target) => !target.status.touch)) return "대상 없음";
    if (selectedTarget !== null && view.players[selectedTarget]?.status.touch) return "대상 변경";
  }
  return "";
}
function outcome() {
  if (!view) return null;
  if (view.phase === "over") return view.winner === -1 ? "draw" : view.winner === view.me ? "win" : "loss";
  return self().hp <= 0 ? "eliminated" : null;
}
function showResult() {
  const result = outcome();
  if (!result) return;
  const dialog = $("result-dialog"), winner = view.players[view.winner];
  const content = {
    win: ["♛", "VICTORY", "승리!", "마지막까지 살아남았습니다."],
    loss: ["✕", "DEFEAT", "패배", `${winner?.name || "상대"}님이 마지막 생존자가 되었습니다.`],
    draw: ["＝", "DRAW", "무승부", "마지막 생존자 없이 모두 탈락했습니다."],
    eliminated: ["☠", "ELIMINATED", "탈락", "HP가 0이 되었습니다. 남은 대전은 관전할 수 있습니다."],
  }[result];
  dialog.dataset.outcome = result;
  dialog.querySelector(".result-emblem").textContent = content[0];
  dialog.querySelector(".result-kicker").textContent = content[1];
  $("result-title").textContent = content[2];
  $("result-detail").textContent = content[3];
  const players = [...view.players].sort((a, b) => Number(b.id === view.winner) - Number(a.id === view.winner) || b.hp - a.hp || a.id - b.id);
  $("result-standings").replaceChildren(...players.map((p) => {
    const row = el("div", undefined, "result-row" + (p.id === view.me ? " is-me" : "") + (p.id === view.winner ? " is-winner" : ""));
    row.append(el("span", p.id === view.winner ? "★" : p.hp <= 0 ? "×" : "●", "result-place"), el("b", p.name + (p.id === view.me && p.name !== "나" ? " · 나" : "")), el("span", p.hp <= 0 ? "탈락" : `HP ${p.hp}`));
    return row;
  }));
  $("result-watch").hidden = result !== "eliminated";
  $("result-close").hidden = result === "eliminated";
  $("result-rematch").hidden = result === "eliminated";
  $("result-rematch").textContent = online ? "새 온라인 방" : "다시 플레이";
  for (const other of document.querySelectorAll("dialog[open]")) if (other !== dialog) other.close();
  if (!dialog.open) dialog.showModal();
}
function updatePresentation(silent = false) {
  const p = self(), alive = p.hp > 0 && view.phase !== "over";
  const danger = alive && p.hp <= 10 ? "last" : alive && p.hp <= 25 ? "critical" : "normal";
  document.body.dataset.danger = danger;
  $("danger-label").hidden = danger === "normal";
  $("danger-label").textContent = danger === "last" ? `치명적 · HP ${p.hp}` : `위험 · HP ${p.hp}`;
  window.DuelSound?.danger(danger, silent);
  const result = outcome();
  $("result-reopen").hidden = !result;
  if (result && !shownResults.has(result)) {
    shownResults.add(result);
    showResult();
    window.DuelSound?.outcome(result, silent);
  }
}
async function command(input) {
  if (busy) return;
  busy = true;
  render();
  try {
    input.revision = view.revision;
    if (online) {
      const result = await api("/api/action", input);
      receive(result);
    } else {
      local.action(0, input);
      refresh(local.view(0));
    }
  } catch (e) {
    toast(e.message);
  } finally {
    busy = false;
    render();
    mandatoryChoice();
    scheduleAI();
  }
}
function fighter(p) {
  const x = el(
    "button",
    undefined,
    "fighter" +
      (view.turn === p.id ? " active-seat" : "") +
      (p.hp <= 0 ? " dead" : ""),
  );
  x.dataset.player = p.id;
  x.classList.toggle("target", selectedTarget === p.id);
  x.setAttribute("aria-label", `${p.name}, HP ${p.hp}, 손패 ${p.count}장`);
  x.append(el("b", p.name));
  const row = el("div", undefined, "hp-row"),
    track = el("div", undefined, "track"),
    fill = el("div", undefined, "fill");
  fill.style.width = (p.hp / MAX_HP) * 100 + "%";
  track.append(fill);
  row.append(track, el("span", `${p.hp}/${MAX_HP}`));
  x.append(
    row,
    el("small", p.hp <= 0 ? "탈락" : `손패 ${p.count}장`, "hand-meta"),
  );
  const tags = [];
  for (const [key, value] of Object.entries(p.status))
    tags.push((statusNames[key] || key) + (value.left ? ` ${value.left}` : ""));
  x.classList.toggle("has-ward", !!p.status.invincible);
  x.classList.toggle("taunted", !!p.status.taunt);
  if (tags.length) {
    const tag = el(
      "small",
      tags.length === 1 ? tags[0] : `상태 ${tags.length}개`,
      "tags",
    );
    tag.title = tags.join(" · ");
    x.append(tag);
  }
  x.onclick = () => {
    const card = self().hand?.find((c) => selected.has(c.uid));
    const needsTarget =
      card && targetedCards.has(card.id);
    const split =
      card?.id === 13 && view.phase === "react" && view.pending.to === view.me;
    if (
      p.id !== view.me &&
      !exchange &&
      p.hp > 0 &&
      ((needsTarget && view.phase === "turn" && view.turn === view.me) || split)
    ) {
      selectedTarget = p.id;
      render();
    } else {
      choice(p.name, (body) =>
        body.append(
          el("p", `HP ${p.hp} / ${MAX_HP} · 손패 ${p.count}장`),
          el("p", tags.join(" · ") || "상태이상 없음"),
        ),
      );
    }
  };
  return x;
}
function render({ silentPresentation = false } = {}) {
  if (!view) return;
  const p = self();
  $("opponents").replaceChildren(
    ...view.players.filter((x) => x.id !== view.me).map(fighter),
  );
  $("self").replaceChildren(fighter(p));
  $("hand-count").textContent = `${p.count}/7`;
  const odds = view.drawOdds;
  $("draw-hint").hidden = !(odds?.attackMultiplier > 1 || odds?.healMultiplier > 1);
  $("draw-hint").textContent = odds?.attackMultiplier > 1 ? "⚔ 공격 확률 ↑" : "✚ 회복 확률 ↑";
  $("draw-hint").title = odds
    ? `현재 손패 기준 다음 뽑기 공격 확률 ${(odds.attackChance * 100).toFixed(1)}%. 카드를 얻을 때마다 다시 계산합니다.`
    : "";
  $("connection").textContent = online
    ? `${view.players.length}인 개인전 · ${online.code}`
    : `${view.players.length}인 개인전 · AI 연습`;
  $("turn").textContent =
    view.phase === "over"
      ? "게임 종료"
      : `${view.players[view.turn].name}의 차례`;
  const pending = view.pending,
    ownTurn = view.phase === "turn" && view.turn === view.me && p.hp > 0,
    react = view.phase === "react" && pending.to === view.me;
  const phaseTexts = {
    turn: ownTurn ? "내 차례" : "상대가 카드를 고르고 있어요",
    react: react
      ? `공격 도착 · 피해 ${pending?.amount}`
      : `${view.players[pending?.to]?.name} 방어 선택 중`,
    gift: `${view.players[pending?.target]?.name} 선물 응답 중`,
    steal: "호시노 · 카드 2장 선택 중",
    discard: `${view.players[pending?.actor]?.name} 초과 손패 버리기`,
    over:
      view.winner === -1 ? "무승부" : `${view.players[view.winner]?.name} 승리`,
  };
  $("status").textContent = phaseTexts[view.phase] || "처리 중";
  $("field-zone").classList.toggle("active", !!view.field);
  $("field-zone").dataset.field = view.field?.id || "";
  $("arena").dataset.field = view.field?.id || "";
  $("field").disabled = !view.field;
  $("field").replaceChildren(...(view.field
    ? [el("strong", CARDS[view.field.id - 1].name), el("small", view.field.id === 1
      ? `다른 전원 −4 · ${view.field.left}회 남음`
      : `${view.players[view.field.target]?.name} 회복 금지`)]
    : [el("span", "필드 없음")]));
  $("field").onclick = () => {
    if (!view.field) return;
    const card = CARDS[view.field.id - 1];
    $("card-dialog-title").textContent = `활성 필드 · ${card.name}`;
    $("card-dialog-desc").textContent = card.desc;
    $("card-dialog").showModal();
  };
  $("stop-field").hidden = !(
    ownTurn &&
    view.field?.id === 1 &&
    view.field.owner === view.me
  );
  $("hand").replaceChildren();
  const hand = p.hand || [];
  $("hand").style.setProperty(
    "--hand-columns",
    Math.min(7, Math.max(1, hand.length)),
  );
  $("hand").dataset.count = hand.length;
  for (const [i, c] of hand.entries()) {
    const card = CARDS[c.id - 1], role = roleOf(card),
      b = el(
        "button",
        undefined,
        "card" +
          (selected.has(c.uid) ? " selected" : "") +
          " " + role.css,
      );
    b.style.setProperty("--angle", (i - (hand.length - 1) / 2) * 3 + "deg");
    b.style.zIndex = i + 1;
    b.setAttribute(
      "aria-label",
      `${card.id}. ${card.name}. ${card.desc}${c.armor !== undefined ? " 방어력 " + c.armor : ""}`,
    );
    b.setAttribute("aria-pressed", selected.has(c.uid));
    b.dataset.rarity = card.rarity;
    b.dataset.card = card.id;
    b.dataset.role = role.label;
    const unavailable = cardAvailability(c);
    b.classList.toggle("unavailable", !!unavailable);
    b.dataset.playable = String(!unavailable);
    if (unavailable) {
      b.setAttribute("aria-label", `${card.name}. 지금 사용 불가: ${unavailable}. 눌러서 설명 보기. ${card.desc}`);
      b.title = `${unavailable} · 눌러서 설명 보기`;
    }
    b.append(
      el("span", String(card.id).padStart(2, "0"), "rank"),
      el("span", typeIcons[card.type], "icon"),
      el("b", card.name),
      el("small", `${role.icon} ${role.label}`, "card-type"),
      el("span", card.rarityLabel, "rarity"),
      el("span", cardSummary(c), "card-summary"),
    );
    if (unavailable) b.append(el("span", unavailable, "card-unavailable"));
    if (artFiles.has(card.id)) {
      const img = el("img");
      img.className = "art";
      img.alt = "";
      img.src = card.image;
      img.onload = () => b.classList.add("has-art");
      img.onerror = () => img.remove();
      b.append(img);
    }
    b.onclick = () => {
      if (exchange) {
        if (selected.has(c.uid)) selected.delete(c.uid);
        else if (selected.size < 2) selected.add(c.uid);
        else toast("교환은 최대 2장입니다.");
      } else {
        selectedTarget = null;
        if (selected.has(c.uid)) selected.clear();
        else selected = new Set([c.uid]);
      }
      render();
    };
    $("hand").append(b);
  }
  const chosen = hand.find((c) => selected.has(c.uid)),
    data = chosen && CARDS[chosen.id - 1];
  $("selection-title").textContent = data
    ? `${data.id}. ${data.name} · ${data.type}`
    : exchange
      ? "교환할 카드 최대 2장 선택"
      : "카드를 선택하세요";
  $("selection-desc").textContent = data
    ? data.shortDesc +
      (chosen.armor !== undefined ? ` 현재 방어력 ${chosen.armor}.` : "") +
      (react && chosen.id === 10
        ? pending.amount <= 20
          ? " 지금 공격 완전 방어 가능."
          : " 지금 공격 방어 불가."
        : "")
    : exchange
      ? "교환할 카드를 최대 2장 고르세요."
      : "카드 선택 → 상대 선택 → 사용. 카드 교환은 최대 2장입니다.";
  $("card-details").hidden = !data;
  $("card-details").onclick = () => {
    $("card-dialog-title").textContent = $("selection-title").textContent;
    $("card-dialog-desc").textContent =
      data.desc +
      (chosen.armor !== undefined ? ` 현재 방어력 ${chosen.armor}.` : "") +
      probabilityText(data);
    $("card-dialog").showModal();
  };
  const forcedTarget = data?.type === "공격" && view.players.find((x) => x.hp > 0 && x.status.taunt && x.id !== view.me);
  $("target-hint").hidden = selectedTarget === null && !forcedTarget;
  $("target-hint").textContent =
    forcedTarget ? `현비 → ${forcedTarget.name}에게 집중` : selectedTarget === null ? "" : `대상: ${view.players[selectedTarget].name}`;
  const unavailable = chosen ? cardAvailability(chosen) : "";
  const playable = !!chosen && !unavailable;
  if (unavailable) $("selection-desc").textContent = `${unavailable}${unavailable === "대상 변경" ? " · 획득 금지가 아닌 상대를 선택하세요" : " · 지금 사용할 수 없습니다"}. ${$("selection-desc").textContent}`;
  if (react && data && [2, 20].includes(data.id) && (pending.card === 9 || pending.noCounter))
    $("selection-desc").textContent += " 이번 공격은 반격을 관통합니다. 일반 방어를 고르세요.";
  $("play").disabled =
    busy ||
    (exchange ? !(ownTurn && selected.size && !p.status.touch) : !playable);
  $("play").textContent = exchange
    ? `${selected.size}장 교환`
    : react
      ? "방어·반격"
      : selectedTarget === null
        ? "사용"
        : "사용 확정";
  $("exchange").hidden = !ownTurn;
  $("exchange").disabled = busy || !!p.status.touch;
  $("exchange").textContent = exchange ? "교환 취소" : "교환 선택";
  $("take").hidden = !react;
  $("take").disabled = busy;
  $("pass").hidden = !ownTurn;
  $("pass").disabled = busy;
  $("fuse").hidden = !(
    ownTurn &&
    hand.filter((c) => c.id === 5).length >= 2 &&
    !p.status.xerath &&
    !p.status.touch
  );
  $("fuse").disabled = busy;
  $("new-game").textContent = online ? "나가기" : "새 게임";
  $("log").replaceChildren(...view.logs.map((x) => el("li", x)));
  updateClock();
  updatePresentation(silentPresentation);
}
function play(target) {
  if (busy || !view || $("play").disabled) return;
  if (target === undefined && selectedTarget !== null) target = selectedTarget;
  if (exchange) {
    void command({ kind: "exchange", cards: [...selected] });
    return;
  }
  const card = self().hand?.find((c) => selected.has(c.uid));
  if (!card) return;
  const id = card.id;
  if (CARDS[id - 1].type === "공격") {
    const forced = view.players.find((x) => x.hp > 0 && x.status.taunt && x.id !== view.me);
    if (forced) target = forced.id;
  }
  if (view.phase === "react") {
    if (id === 13 && target === undefined) {
      pickTarget(
        "피해를 나눠 받을 상대",
        (t) => void command({ kind: "react", card: card.uid, target: t }),
      );
      return;
    }
    void command({ kind: "react", card: card.uid, target });
    return;
  }
  if (targetedCards.has(id) && target === undefined) {
    pickTarget(
      `${CARDS[id - 1].name} · 대상 선택`,
      (t) => void command({ kind: "play", card: card.uid, target: t }),
      id === 12,
    );
    return;
  }
  if (id === 18) {
    choice("염라 이건우 · 심판 대상과 판정", (body, actions) => {
      const list = targets(),
        n = Math.min(2, list.length),
        rows = [];
      for (let i = 0; i < n; i++) {
        const row = el("div", undefined, "choice-row"),
          who = el("select"),
          mode = el("select");
        for (const p of list) {
          const op = el("option", p.name);
          op.value = p.id;
          who.append(op);
        }
        who.value = list[i].id;
        for (const [value, label] of [
          ["heaven", "천국 · 회복 압수"],
          ["hell", "지옥 · 공격 압수"],
        ]) {
          const op = el("option", label);
          op.value = value;
          mode.append(op);
        }
        row.append(who, mode);
        body.append(row);
        rows.push({ who, mode });
      }
      button(actions, "심판", () => {
        const ts = rows.map((r) => ({
          id: Number(r.who.value),
          mode: r.mode.value,
        }));
        if (new Set(ts.map((x) => x.id)).size !== ts.length) {
          toast("서로 다른 대상을 선택하세요.");
          return;
        }
        closeChoice();
        void command({ kind: "play", card: card.uid, targets: ts });
      });
    });
    return;
  }
  void command({ kind: "play", card: card.uid, target });
}
function mandatoryChoice() {
  if (!view || $("choice-dialog").open || busy) return;
  const s = view,
    actor = s.pending?.actor ?? s.pending?.target ?? s.pending?.owner;
  if (actor !== view.me) return;
  if (s.phase === "gift")
    choice(
      "건우의 선물 · 받으시겠습니까?",
      (body, actions) => {
        body.append(
          el(
            "p",
            "받기: 사용자 또는 내가 무작위 피해 8~18. 거절: 사용자 HP 8 회복.",
          ),
        );
        button(actions, "받기", () => {
          closeChoice();
          void command({ kind: "accept" });
        });
        button(actions, "거절", () => {
          closeChoice();
          void command({ kind: "reject" });
        });
      },
      { cancel: false },
    );
  if (s.phase === "discard")
    choice(
      "손패 7장까지 · 버릴 카드를 선택",
      (body) => {
        for (const c of self().hand)
          button(body, CARDS[c.id - 1].name, () => {
            closeChoice();
            void command({ kind: "discard", card: c.uid });
          });
      },
      { cancel: false },
    );
  if (s.phase === "steal")
    choice(
      "다른 손패에서 총 2장 선택",
      (body, actions) => {
        const cards = s.players
            .filter((p) => p.id !== s.me && p.hp > 0)
            .flatMap((p) =>
              (p.hand || []).map((c) => ({ ...c, owner: p.name })),
            ),
          n = Math.min(2, cards.length),
          picked = new Set(),
          confirm = button(actions, `${n}장 가져오기`, () => {
            closeChoice();
            void command({ kind: "steal", cards: [...picked] });
          });
        confirm.disabled = n !== 0;
        for (const c of cards) {
          const b = button(body, `${c.owner} · ${CARDS[c.id - 1].name}`, () => {
            if (picked.has(c.uid)) picked.delete(c.uid);
            else if (picked.size < n) picked.add(c.uid);
            b.setAttribute("aria-pressed", picked.has(c.uid));
            b.classList.toggle("primary", picked.has(c.uid));
            confirm.disabled = picked.size !== n;
          });
          b.className = "choice-card";
        }
      },
      { cancel: false },
    );
}
function aiInput() {
  const s = local.s,
    actor =
      s.pending?.actor ??
      s.pending?.to ??
      s.pending?.target ??
      s.pending?.owner ??
      s.turn,
    p = local.player(actor);
  if (actor === 0 || s.phase === "over") return null;
  const opponents = local.alive().filter((x) => x.id !== actor);
  const target = opponents[Math.floor(Math.random() * opponents.length)];
  if (s.phase === "react") {
    const c = p.hand.find((c) => local.canReact(c, s.pending));
    return {
      actor,
      input: c
        ? { kind: "react", card: c.uid, target: target?.id }
        : { kind: "take" },
    };
  }
  if (s.phase === "gift") return { actor, input: { kind: "accept" } };
  if (s.phase === "discard")
    return { actor, input: { kind: "discard", card: p.hand.at(-1).uid } };
  if (s.phase === "steal")
    return {
      actor,
      input: {
        kind: "steal",
        cards: local
          .alive()
          .filter((x) => x.id !== actor)
          .flatMap((x) => x.hand)
          .slice(0, 2)
          .map((x) => x.uid),
      },
    };
  const legal = p.hand.filter(
    (c) =>
      ![2, 10, 13, 20, 23, 26, 29, 30].includes(c.id) &&
      (!p.status.xerath || ["회복", "방어"].includes(CARDS[c.id - 1].type)) &&
      (!p.status.touch || ![5, 6, 18].includes(c.id)) &&
      (c.id !== 17 || !target?.status.touch),
  );
  const c =
    (p.hp < 50 && legal.find((c) => [8, 14, 40].includes(c.id))) ||
    legal.find((c) => CARDS[c.id - 1].type === "공격" && (c.id !== 36 || p.hp > 30)) ||
    legal.find((c) => [1, 24, 34, 39].includes(c.id)) ||
    legal[0];
  if (!c)
    return {
      actor,
      input: {
        kind: p.status.touch || p.hand.length === 0 ? "pass" : "exchange",
        cards: p.hand.slice(0, 2).map((x) => x.uid),
      },
    };
  return {
    actor,
    input: {
      kind: "play",
      card: c.uid,
      target: target?.id,
      targets: local
        .alive()
        .filter((x) => x.id !== actor)
        .slice(0, 2)
        .map((x) => ({ id: x.id, mode: "hell" })),
    },
  };
}
function scheduleAI() {
  clearTimeout(aiTimer);
  if (online || !local) return;
  const next = aiInput();
  if (!next) return;
  aiTimer = setTimeout(() => {
    try {
      local.action(next.actor, next.input);
    } catch (e) {
      console.error(e);
      local.timeout();
    }
    refresh(local.view(0));
  }, 900);
}
function updateClock() {
  if (!view) return;
  const secs = Math.max(0, Math.ceil((view.deadline - Date.now()) / 1000));
  $("clock").textContent = view.phase === "over" ? "" : `${secs}초`;
}
setInterval(() => {
  updateClock();
  if (local && !online) {
    const old = local.s.revision;
    local.timeout();
    if (old !== local.s.revision) refresh(local.view(0));
  }
}, 500);
async function api(path, data) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 12000);
  try {
    const r = await fetch(server + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(online ? { Authorization: "Bearer " + online.token } : {}),
      },
      body: JSON.stringify(data || {}),
      signal: controller.signal,
    });
    const result = await r.json();
    if (!r.ok) {
      const error = Error(result.error || "서버 오류");
      error.status = r.status;
      throw error;
    }
    return result;
  } finally {
    clearTimeout(timer);
  }
}
function receive(data) {
  if (!online) return;
  online.code = data.code;
  online.me = data.me;
  if (data.started) {
    local = null;
    clearTimeout(aiTimer);
    $("lobby-dialog").close();
    if (
      data.game.revision >=
      (view?.me === data.me && view?.online ? view.revision : -1)
    ) {
      data.game.online = true;
      refresh(data.game);
    }
  } else {
    view = null;
    $("invite-code").textContent = data.code;
    $("lobby-players").replaceChildren(
      ...data.players.map((p) =>
        el(
          "li",
          `${p.name}${p.id === data.host ? " · 방장" : ""}${p.connected ? " · 연결됨" : " · 연결 대기"}`,
        ),
      ),
    );
    $("start-room").hidden = data.host !== data.me;
    $("start-room").disabled =
      data.players.length < 2 || data.players.some((p) => !p.connected);
    $("lobby-note").textContent =
      data.host === data.me
        ? "2~5명 연결 후 시작하세요."
        : "방장이 시작할 때까지 기다려 주세요.";
    if (!$("lobby-dialog").open) $("lobby-dialog").showModal();
  }
}
async function stream() {
  try {
    const health = await fetch(server + "/health", {
      signal: AbortSignal.timeout(8000),
    }).then((r) => r.json());
    transport = health.transport || "sse";
  } catch {}
  if (transport === "poll") return pollState();
  streamAbort?.abort();
  const controller = new AbortController();
  streamAbort = controller;
  while (online && !controller.signal.aborted) {
    try {
      const r = await fetch(server + "/api/events", {
        headers: { Authorization: "Bearer " + online.token },
        signal: controller.signal,
      });
      if (!r.ok) {
        if (r.status === 400) {
          sessionStorage.removeItem(sessionKey);
          online = null;
          toast("방이 종료되었습니다. 다시 입장하세요.");
          localStart();
          return;
        }
        throw Error("연결 실패");
      }
      const reader = r.body.getReader(),
        decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let index;
        while ((index = buffer.indexOf("\n\n")) >= 0) {
          const block = buffer.slice(0, index);
          buffer = buffer.slice(index + 2);
          if (block.startsWith("data: ")) receive(JSON.parse(block.slice(6)));
        }
      }
    } catch (e) {
      if (controller.signal.aborted) return;
      toast("재연결 중 · 90초 이내 복귀할 수 있습니다.");
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
async function enter(kind) {
  if ($("create-room").disabled) return;
  $("create-room").disabled = $("join-room").disabled = true;
  try {
    if (!server) throw Error("온라인 서버 주소를 먼저 설정하세요.");
    if (online) throw Error("현재 방을 먼저 나가세요.");
    const result = await api("/api/" + kind, {
      name: $("nickname").value,
      code: $("room-code").value.trim(),
    });
    online = { token: result.token, code: result.code };
    window.DuelSound?.stop();
    transport = result.transport || "sse";
    clearTimeout(aiTimer);
    local = null;
    sessionStorage.setItem(
      sessionKey,
      JSON.stringify({ server, ...online, transport }),
    );
    lastEvent = 0;
    $("online-dialog").close();
    receive(result);
    void stream();
  } catch (e) {
    toast(e.message);
  } finally {
    $("create-room").disabled = $("join-room").disabled = false;
  }
}
$("play").onclick = () => play();
$("exchange").onclick = () => {
  exchange = !exchange;
  selected.clear();
  render();
};
$("take").onclick = () => void command({ kind: "take" });
$("pass").onclick = () => void command({ kind: "pass" });
$("fuse").onclick = () => void command({ kind: "fuse" });
$("stop-field").onclick = () => void command({ kind: "stop" });
for (const id of ["rules", "log", "online", "menu"])
  $(id + "-open").onclick = () => {
    $("menu-dialog").close();
    $(id + "-dialog").showModal();
  };
for (const b of document.querySelectorAll("[data-close]"))
  b.onclick = () => b.closest("dialog").close();
$("choice-dialog").addEventListener("cancel", (e) => {
  if (["gift", "steal", "discard"].includes(view?.phase)) e.preventDefault();
});
$("lobby-dialog").addEventListener("cancel", (e) => e.preventDefault());
$("result-close").onclick = $("result-watch").onclick = () => $("result-dialog").close();
$("result-reopen").onclick = showResult;
$("result-rematch").onclick = async () => {
  const button = $("result-rematch");
  button.disabled = true;
  try {
    if (online) {
      if (await leave()) $("online-dialog").showModal();
    } else localStart();
  } finally {
    button.disabled = false;
  }
};
$("new-game").onclick = () => {
  $("menu-dialog").close();
  if (online) {
    choice("현재 대전에서 나갈까요?", (body, actions) => {
      body.append(el("p", "진행 중인 게임에서는 기권 처리됩니다."));
      button(actions, "나가기", leave);
    });
  } else {
    choice("AI 개인전", (body, actions) => {
      const label = el("label", "참가 인원 (나 포함)"),
        select = el("select");
      select.id = "practice-count";
      for (let i = 2; i <= 5; i++) {
        const option = el("option", `${i}명`);
        option.value = i;
        select.append(option);
      }
      select.value = practicePlayers;
      label.append(select);
      body.append(label);
      button(actions, "시작", () => {
        practicePlayers = Number(select.value);
        localStorage.setItem("practice-players", practicePlayers);
        localStart();
      });
    });
  }
};
async function leave() {
  try {
    await api("/api/leave");
  } catch (e) {
    toast(e.message);
    return false;
  }
  streamAbort?.abort();
  online = null;
  sessionStorage.removeItem(sessionKey);
  closeChoice();
  localStart();
  return true;
}
$("leave-room").onclick = leave;
$("create-room").onclick = () => enter("create");
$("join-room").onclick = () => enter("join");
$("server-url").value = server;
$("save-server").onclick = () => {
  try {
    const url = new URL($("server-url").value);
    if (
      url.protocol !== "https:" &&
      !["localhost", "127.0.0.1"].includes(url.hostname)
    )
      throw Error("HTTPS 주소가 필요합니다.");
    server = url.origin;
    localStorage.setItem("card-server", server);
    toast("서버 주소 저장 완료");
  } catch (e) {
    toast(e.message);
  }
};
$("start-room").onclick = async () => {
  try {
    receive(await api("/api/start"));
  } catch (e) {
    toast(e.message);
  }
};
$("copy-code").onclick = async () => {
  try {
    await navigator.clipboard.writeText(online.code);
    toast("초대 코드 복사 완료");
  } catch {
    toast("초대 코드: " + online.code);
  }
};
for (const card of CARDS) {
  const a = el("article"),
    h = el(
      "h3",
      `${String(card.id).padStart(2, "0")}. ${card.name} · ${card.type}`,
    );
  a.append(
    h,
    el("p", card.shortDesc),
    el("p", probabilityText(card)),
    el("p", card.desc),
  );
  $("catalog").append(a);
}
function fitViewport() {
  document.documentElement.style.setProperty(
    "--app-height",
    Math.min(innerHeight, window.visualViewport?.height || innerHeight) + "px",
  );
  if (view) render();
}
window.addEventListener("resize", fitViewport);
window.visualViewport?.addEventListener("resize", fitViewport);
fitViewport();

const activeAnimations = new Set(),
  reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
let epoch = 0;
function point(who) {
  const area = $("battle").getBoundingClientRect(),
    row = document
      .querySelector('[data-player="' + who + '"]')
      ?.getBoundingClientRect();
  return row
    ? {
        x: row.left - area.left + row.width / 2 - $("battle").clientLeft,
        y: row.top - area.top + row.height / 2 - $("battle").clientTop,
      }
    : { x: area.width / 2, y: area.height / 2 };
}
function element(kind, at, color) {
  const el = document.createElement("div");
  el.className = "fx " + kind;
  if (at) {
    el.style.left = at.x + "px";
    el.style.top = at.y + "px";
  }
  if (color) {
    el.style.color = color;
    el.style.setProperty("--fx-color", color);
  }
  // Keep simultaneous five-player effects bounded; labels and main props win.
  const decorative = /particle|heal-cross|shard|spark|trail/.test(kind);
  if (!decorative || $("effects").childElementCount < 120) $("effects").append(el);
  return el;
}
async function animate(el, frames, duration = 600, remove = true) {
  if (!el?.isConnected) return;
  if (reducedMotion.matches) {
    const transform = frames[frames.length - 1].transform;
    frames = frames.map((frame) => ({
      ...frame,
      ...(transform ? { transform } : {}),
    }));
  }
  const a = el.animate(frames, {
    duration: reducedMotion.matches ? Math.min(duration, 160) : duration,
    easing: "cubic-bezier(.2,.7,.2,1)",
    fill: "forwards",
  });
  activeAnimations.add(a);
  try {
    await a.finished;
  } catch {
  } finally {
    activeAnimations.delete(a);
    if (remove) el.remove();
    a.cancel();
  }
}
function burst(at, color, count = 12) {
  if (reducedMotion.matches) return;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2,
      reach = 38 + (i % 3) * 17;
    const el = element("fx-particle", at, color);
    void animate(
      el,
      [
        { transform: "translate(0,0) scale(1.5)", opacity: 1 },
        {
          transform: `translate(${Math.cos(angle) * reach}px,${Math.sin(angle) * reach}px) scale(0)`,
          opacity: 0,
        },
      ],
      550 + (i % 3) * 90,
    );
  }
}
function ring(at, color, shield = false) {
  const el = element("fx-ring" + (shield ? " shield" : ""), at, color);
  if (shield) el.textContent = "◇";
  return animate(
    el,
    [
      { transform: "scale(.35)", opacity: 0 },
      { transform: "scale(1)", opacity: 1, offset: 0.3 },
      { transform: shield ? "scale(1.13)" : "scale(1.9)", opacity: 0 },
    ],
    650,
  );
}
function number(who, value, color, label = "") {
  const el = element("fx-number", point(who), color);
  el.append(document.createTextNode(value));
  if (label) {
    const small = document.createElement("small");
    small.textContent = label;
    el.append(small);
  }
  return animate(
    el,
    [
      { transform: "translate(-50%,0) scale(.6)", opacity: 0 },
      {
        transform: "translate(-50%,-30%) scale(1.12)",
        opacity: 1,
        offset: 0.2,
      },
      { transform: "translate(-50%,-100%) scale(1)", opacity: 1, offset: 0.7 },
      { transform: "translate(-50%,-130%) scale(.95)", opacity: 0 },
    ],
    1350,
  );
}
async function cast(who, card) {
  const colors = {
    attack: "#ff815b",
    magic: "#c3a3ff",
    shield: "#67d8ff",
    heal: "#70f3ae",
    focus: "#ffd66b",
  };
  const color = colors[card.type];
  const el = element("fx-cast", null, color);
  const icon = document.createElement("span");
  icon.className = "cast-icon";
  icon.textContent = card.icon;
  const title = document.createElement("span");
  title.className = "cast-name";
  title.textContent = card.name;
  const owner = document.createElement("span");
  owner.className = "cast-owner";
  owner.textContent = view.players[who].name + " · " + CARDS[card.id - 1].type + " 사용!";
  const cue = document.createElement("span");
  cue.className = "cast-cue";
  cue.textContent = cardSummary(card);
  el.append(icon, title, cue, owner);
  const wash = element("fx-wash", null, color);
  void animate(
    wash,
    [{ opacity: 0 }, { opacity: 1, offset: 0.4 }, { opacity: 0 }],
    650,
  );
  await animate(
    el,
    [
      {
        transform: "translate(-50%,-40%) scale(.75) rotate(-5deg)",
        opacity: 0,
      },
      {
        transform: "translate(-50%,-50%) scale(1.04) rotate(0)",
        opacity: 1,
        offset: 0.25,
      },
      { transform: "translate(-50%,-50%) scale(1)", opacity: 1, offset: 0.75 },
      { transform: "translate(-50%,-60%) scale(.94)", opacity: 0 },
    ],
    700,
  );
}
let lastHealWash = 0;
function healthAura(who) {
  const at = point(who), color = "#65ffac";
  if (Date.now() - lastHealWash > 250) {
    lastHealWash = Date.now();
    const aura = element("fx-health-aura", null, color);
    void animate(aura, [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0.8, offset: 0.6 }, { opacity: 0 }], 1150);
  }
  for (let i = 0; i < (reducedMotion.matches ? 1 : 5); i++) {
    const cross = element("fx-heal-cross", { x: at.x + (i - 2) * 20, y: at.y + 10 + (i % 2) * 10 }, color);
    cross.textContent = "+";
    void animate(cross, [{ opacity: 0, transform: "translateY(5px) scale(.5)" }, { opacity: 1, transform: "translateY(-15px) scale(1.2)", offset: 0.3 }, { opacity: 0, transform: "translateY(-65px) scale(.8)" }], 1050 + i * 70);
  }
  const seat = document.querySelector(`[data-player="${who}"]`);
  if (seat) void animate(seat, [{ boxShadow: "0 0 0 transparent" }, { boxShadow: "0 0 28px #65ffacbb, inset 0 0 18px #65ffac55", offset: 0.3 }, { boxShadow: "0 0 0 transparent" }], 1100, false);
}
function statusEffect(who, label, color = "#d6b4ff") {
  void ring(point(who), color);
  const badge = element("fx-status", point(who), color);
  badge.textContent = label;
  return animate(badge, [{ opacity: 0, transform: "translate(-50%,0) scale(.8)" }, { opacity: 1, transform: "translate(-50%,-40%) scale(1)", offset: 0.2 }, { opacity: 1, offset: 0.7 }, { opacity: 0, transform: "translate(-50%,-80%)" }], 1300);
}
async function support(who, card, amount) {
  const at = point(who),
    color =
      card.type === "shield"
        ? "#9bdcff"
        : card.type === "heal"
          ? "#a7ebbd"
          : "#f0cf89";
  burst(at, color);
  if (card.type === "heal") healthAura(who);
  await Promise.all([
    ring(at, color, card.type === "shield"),
    number(
      who,
      "+" + amount,
      color,
      card.type === "shield"
        ? "보호막"
        : card.type === "heal"
          ? "회복"
          : "마나",
    ),
  ]);
}
async function projectile(from, to, card) {
  const version = epoch;
  const a = point(from),
    b = point(to),
    area = $("battle").getBoundingClientRect();
  const color = card.type === "magic" ? "#a6cfff" : "#ffb394";
  if (card.type === "magic" && !reducedMotion.matches) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "fx fx-lightning");
    svg.setAttribute("viewBox", `0 0 ${area.width} ${area.height}`);
    const path = document.createElementNS(svg.namespaceURI, "path");
    const mid = (a.y + b.y) / 2;
    path.setAttribute(
      "d",
      `M ${a.x} ${a.y} L ${a.x - 32} ${mid + 30} L ${a.x + 34} ${mid - 20} L ${b.x} ${b.y}`,
    );
    svg.append(path);
    $("effects").append(svg);
    void animate(
      svg,
      [
        { opacity: 0 },
        { opacity: 0.9, offset: 0.35 },
        { opacity: 0.3, offset: 0.65 },
        { opacity: 0 },
      ],
      500,
    );
  }
  const el = element("fx-projectile " + card.type + " " + card.id, a, color);
  el.textContent = card.icon;
  await animate(
    el,
    [
      { transform: "translate(0,0) scale(.6) rotate(-25deg)", opacity: 0 },
      {
        transform: `translate(${area.width * 0.12}px,${(b.y - a.y) * 0.4}px) scale(1.35) rotate(${card.id === "dice" ? 180 : 10}deg)`,
        opacity: 1,
        offset: 0.45,
      },
      {
        transform: `translate(${b.x - a.x}px,${b.y - a.y}px) scale(.85) rotate(${card.id === "dice" ? 360 : 35}deg)`,
        opacity: 1,
      },
    ],
    350,
  );
  if (version !== epoch) return;
  burst(b, color, 16);
  if (card.type !== "magic") {
    const slash = element("fx-slash", b, color);
    void animate(
      slash,
      [
        { transform: "rotate(-35deg) scaleX(0)", opacity: 0 },
        { transform: "rotate(-35deg) scaleX(1.2)", opacity: 1, offset: 0.3 },
        { transform: "rotate(-35deg) scaleX(.8)", opacity: 0 },
      ],
      320,
    );
  }
}
async function impact(who, hit, blocked) {
  const jobs = [];
  if (blocked) {
    burst(point(who), "#9bdcff", 9);
    jobs.push(ring(point(who), "#9bdcff", true));
  }
  if (hit) {
    burst(point(who), "#ff9693");
    const seat = document.querySelector(`[data-player="${who}"]`);
    if (seat) void animate(seat, [{ boxShadow: "0 0 0 transparent" }, { boxShadow: "0 0 26px #ff6257cc, inset 0 0 18px #ff625755", offset: 0.25 }, { boxShadow: "0 0 0 transparent" }], 1000, false);
    if (!reducedMotion.matches)
      jobs.push(
        animate(
          document.querySelector('[data-player="' + who + '"]'),
          [
            { transform: "translateX(0)" },
            { transform: "translateX(-7px)", offset: 0.2 },
            { transform: "translateX(6px)", offset: 0.4 },
            { transform: "translateX(-3px)", offset: 0.65 },
            { transform: "translateX(0)" },
          ],
          350,
          false,
        ),
      );
  }
  jobs.push(
    number(
      who,
      hit ? "−" + hit : "방어! ",
      hit ? "#ff9693" : "#9bdcff",
      blocked ? blocked + " 흡수" : "",
    ),
  );
  await Promise.all(jobs);
}

function probabilityText(card) {
  return card.generated
    ? " 합성·생성 전용 · 일반 뽑기 0%."
    : ` ${card.rarityLabel} · 기본 뽑기 ${(card.chance * 100).toFixed(2)}%. 손패 구성에 따라 다음 뽑기의 공격 확률이 보정됩니다.`;
}
async function pollState() {
  streamAbort?.abort();
  const ctrl = new AbortController();
  streamAbort = ctrl;
  const token = online?.token;
  while (online?.token === token && !ctrl.signal.aborted) {
    try {
      const state = await api("/api/state");
      if (ctrl.signal.aborted || online?.token !== token) return;
      receive(state);
    } catch (e) {
      if (ctrl.signal.aborted) return;
      if (e.status === 401 || e.status === 404) {
        sessionStorage.removeItem(sessionKey);
        online = null;
        localStart();
        toast("방이 종료되었습니다. 새 방으로 입장하세요.");
        return;
      }
      toast("서버에 다시 연결하고 있습니다.");
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
async function openFullscreen() {
  try {
    if (!document.fullscreenElement)
      await document.documentElement.requestFullscreen();
  } catch {}
  try {
    await screen.orientation.lock("landscape");
  } catch {}
}
$("fullscreen").onclick = openFullscreen;
$("rotate-fullscreen").onclick = openFullscreen;
function openPlayedCard() {
  if (!lastPlayed) return;
  const c = CARDS[lastPlayed.card - 1];
  $("card-dialog-title").textContent =
    `${view.players[lastPlayed.actor]?.name || ""} · ${c.name}`;
  $("card-dialog-desc").textContent =
    c.shortDesc +
    "\n\n" +
    c.desc +
    (lastPlayed.armor !== undefined ? ` 방어력 ${lastPlayed.armor}.` : "");
  $("card-dialog").showModal();
}
let pressTimer, pressStart;
$("played-slot").addEventListener("pointerdown", (e) => {
  if (!lastPlayed) return;
  pressStart = { x: e.clientX, y: e.clientY };
  pressTimer = setTimeout(() => {
    pressTimer = null;
    openPlayedCard();
  }, 450);
});
function cancelPress() {
  clearTimeout(pressTimer);
  pressTimer = null;
}
$("played-slot").addEventListener("pointermove", (e) => {
  if (
    pressStart &&
    Math.hypot(e.clientX - pressStart.x, e.clientY - pressStart.y) > 10
  )
    cancelPress();
});
for (const type of ["pointerup", "pointercancel", "pointerleave"])
  $("played-slot").addEventListener(type, cancelPress);
$("played-slot").addEventListener("contextmenu", (e) => e.preventDefault());
$("played-slot").onclick = openPlayedCard;

function showPlayedCard(event) {
  lastPlayed = event;
  const card = CARDS[event.card - 1];
  $("played-slot").disabled = false;
  $("played-slot").dataset.role = roleOf(card).css;
  $("played-slot").replaceChildren(
    el("span", typeIcons[card.type]),
    el("small", `${view.players[event.actor]?.name} 사용 · ${card.name}`),
  );
  $("played-slot").title = "길게 누르면 카드 설명";
}
function effectContext(version) {
  return { element, animate, point, ring, burst, number, getView: () => view, reduced: () => reducedMotion.matches, isCurrent: () => epoch === version };
}
function animateEvents() {
  const fresh = view.events.filter((e) => e.seq > lastEvent);
  if (!fresh.length) return;
  const version = epoch;
  const ctx = effectContext(version);
  const soundToken = window.DuelSound?.capture();
  for (const e of fresh) {
    lastEvent = e.seq;
    if (e.kind === "card") showPlayedCard(e);
  }
  const results = fresh.filter((e) => ["damage", "heal", "block", "miss", "status", "cleanse", "phone-roll"].includes(e.kind) && !e.forfeit);
  if (results.length) {
    const text = results.slice(-3).map((e) => {
      const name = view.players[e.target ?? e.to]?.name || "";
      if (e.kind === "damage") return `${name} −${e.amount}${e.cost ? " 비용" : " HP"}`;
      if (e.kind === "heal") return `${name} +${e.amount} HP`;
      if (e.kind === "block") return `${name} 방어`;
      if (e.kind === "miss") return "휴대폰 빗나감 · 피해 0";
      if (e.kind === "phone-roll") return `휴대폰 ${e.amount} 피해${e.noCounter ? " · 반격 관통" : ""}`;
      if (e.kind === "cleanse") return `${name} 상태 해제`;
      return `${name} ${statusNames[e.status] || "효과 적용"}`;
    }).join(" · ");
    $("last-result").textContent = text;
    $("last-result").dataset.kind = results.at(-1).kind;
  } else if (fresh.some((e) => e.kind === "card")) {
    const card = fresh.findLast((e) => e.kind === "card");
    $("last-result").textContent = card ? cardSummary({id:card.card, armor:card.armor}) : "";
    $("last-result").dataset.kind = "card";
  }
  fxQueue = fxQueue
    .catch(() => {})
    .then(async () => {
      for (const e of fresh) {
        if (epoch !== version) return;
        window.DuelSound?.event(e, soundToken);
        if (e.kind === "card") {
          const d = CARDS[e.card - 1],
            type = {
              공격: "attack",
              방어: "shield",
              반격: "shield",
              회복: "heal",
              필드: "magic",
              마법: "magic",
              특수: "focus",
            }[d.type];
          await Promise.all([
            cast(e.actor, { ...d, type, armor: e.armor, icon: typeIcons[d.type] }),
            window.DuelFX?.card(e, ctx),
          ]);
          if (epoch !== version) return;
          if (d.type === "필드") {
            const zone = $("field-zone");
            void animate(zone, [{ boxShadow: "0 0 0 transparent" }, { boxShadow: "0 0 40px #ffcf6a, inset 0 0 20px #ffcf6a66", offset: 0.25 }, { boxShadow: "0 0 0 transparent" }], 1300, false);
          }
        }
        if (e.kind === "attack") {
          const d = CARDS[e.card - 1];
          if (window.DuelFX) await DuelFX.attack(e, ctx);
          else await Promise.all(
            e.targets.map((id) =>
              projectile(e.from, id, {
                ...d,
                type: "attack",
                icon: { 31: "♜", 33: "▣", 35: "⚔", 36: "➤", 37: "🍔", 38: "⚾" }[d.id] || typeIcons[d.type],
              }),
            ),
          );
          if (epoch !== version) return;
        }
        if (e.kind === "damage" && e.amount > 0 && !e.forfeit)
          void impact(e.target, e.amount, 0);
        if (e.kind === "heal")
          void support(e.target, { type: "heal" }, e.amount);
        if (e.kind === "block") void impact(e.target, 0, e.amount);
        if (e.kind === "miss") void statusEffect(e.targets?.[0] ?? e.from, "빗나감 · 0 피해", "#cbd4e5");
        if (e.kind === "status") void statusEffect(e.target, statusNames[e.status] || "효과 적용");
        if (e.kind === "cleanse") void statusEffect(e.target, "상태이상 해제", "#70f3ae");
        if (e.kind === "status-tick" && e.status === "curse") void statusEffect(e.target, "팬티 · 지속 피해", "#d6a6ff");
        if (e.kind === "status-tick" && e.status === "regen" && !e.amount) void statusEffect(e.target, "음식 · 회복 0", "#90baa5");
        if (e.kind === "attack" && e.noCounter) void statusEffect(e.targets[0], "반격 관통", "#ffa36b");
        if (["status", "cleanse", "status-tick", "roulette", "miss", "phone-roll", "class-president"].includes(e.kind))
          void window.DuelFX?.status(e, ctx);
        if (["damage", "block", "heal"].includes(e.kind) && !e.forfeit)
          void window.DuelFX?.impact(e, ctx);
      }
    });
}

function updateSoundControls() {
  const setting = window.DuelSound?.settings() || { supported: false };
  const on = setting.supported && setting.enabled && setting.volume > 0;
  $("sound-quick").textContent = on ? "♪" : "♪×";
  $("sound-quick").setAttribute("aria-pressed", String(!!on));
  $("sound-quick").setAttribute("aria-label", on ? "효과음 끄기" : "효과음 켜기");
  $("sound-quick").title = on ? "효과음 끄기 · 메뉴에서 볼륨 조절" : "효과음 켜기";
  $("sound-toggle").setAttribute("aria-pressed", String(!!on));
  $("sound-toggle").textContent = on ? "켜짐" : "꺼짐";
  $("sound-volume").value = Math.round((setting.volume ?? .4) * 100);
  $("sound-level").textContent = $("sound-volume").value + "%";
  for (const id of ["sound-quick", "sound-toggle", "sound-volume", "sound-test"]) $(id).disabled = !setting.supported;
  $("sound-status").textContent = !setting.supported ? "이 브라우저에서는 효과음을 지원하지 않습니다."
    : !on ? "효과음이 꺼져 있습니다." : setting.ready ? "공격·방어·회복에 맞춰 재생돼요." : "첫 터치 후 소리가 재생됩니다.";
}
function toggleSound() {
  const setting = DuelSound.settings(), on = setting.enabled && setting.volume > 0;
  DuelSound.configure({ enabled: !on, volume: setting.volume || .4 });
  if (!on) void DuelSound.unlock();
}
$("sound-quick").onclick = $("sound-toggle").onclick = toggleSound;
$("sound-volume").oninput = () => {
  const volume = Number($("sound-volume").value) / 100;
  DuelSound.configure({ volume, enabled: volume > 0 });
  if (volume > 0) void DuelSound.unlock();
};
$("sound-test").onclick = async () => {
  const setting = DuelSound.settings();
  if (!setting.enabled || setting.volume === 0) {
    toast("효과음을 켜고 볼륨을 올려주세요.");
    return;
  }
  if (!await DuelSound.preview()) toast("미리 듣기를 다시 눌러 소리를 켜주세요.");
};
window.addEventListener("duel-sound-change", updateSoundControls);
updateSoundControls();

localStart();
try {
  const saved = JSON.parse(sessionStorage.getItem(sessionKey) || "null");
  if (saved) {
    server = saved.server;
    online = { token: saved.token, code: saved.code };
    transport = saved.transport || "sse";
    local = null;
    lastEvent = 0;
    void stream();
  }
} catch {
  sessionStorage.removeItem(sessionKey);
}

fetch("assets/cards/manifest.json")
  .then((r) => (r.ok ? r.json() : []))
  .then((ids) => {
    artFiles = new Set(ids);
    if (view) render();
  })
  .catch(() => {});
