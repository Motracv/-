(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SchoolRPG = api;
})(globalThis, function () {
  "use strict";
  const MAX_STAGE = 30, MAX_LEVEL = 60, OFFLINE_CAP = 8 * 3600, CATALOG_VERSION = 3;
  const RECRUIT_RATES = { SSR: .04, SR: .26, R: .70 };
  const RECRUIT_PITY = { hard: 80, soft: 60, stepPercent: 1 };
  function recruitRates(misses) {
    const next = misses + 1;
    if (next >= RECRUIT_PITY.hard) return { SSR: 1, SR: 0, R: 0 };
    const ssrPercent = RECRUIT_RATES.SSR * 100 + Math.max(0, next - RECRUIT_PITY.soft + 1) * RECRUIT_PITY.stepPercent;
    // Soft pity takes its extra probability from R, keeping SR at 26%.
    return { SSR: ssrPercent / 100, SR: RECRUIT_RATES.SR, R: (100 - ssrPercent - RECRUIT_RATES.SR * 100) / 100 };
  }
  const HEROES = [
    { id: "harin", name: "하린", club: "검도부", role: "전사", rarity: "R", hp: 102, atk: 12, skill: "일섬", cooldown: 5, color: "#d97852", hair: "#553a31", outfit: "#536c76", weapon: "sword", desc: "한 명에게 공격력 300%의 검격." },
    { id: "taeo", name: "태오", club: "체육부", role: "수호", rarity: "R", hp: 158, atk: 8, skill: "굳건한 수비", cooldown: 5, color: "#568b79", hair: "#343b3e", outfit: "#416d62", weapon: "shield", desc: "최대 체력 25%의 보호막. 받는 피해 28% 감소." },
    { id: "yuna", name: "유나", club: "궁도부", role: "사수", rarity: "R", hp: 88, atk: 14, skill: "정조준", cooldown: 4, color: "#d7a34c", hair: "#8a582f", outfit: "#b08949", weapon: "bow", desc: "체력이 가장 낮은 적에게 공격력 260%의 화살." },
    { id: "minjae", name: "민재", club: "과학부", role: "마법", rarity: "R", hp: 82, atk: 12, skill: "플라스크 폭발", cooldown: 6, color: "#7297ab", hair: "#4c4657", outfit: "#668a9b", weapon: "staff", desc: "적 전체에게 공격력 170%의 마법 피해." },
    { id: "sua", name: "수아", club: "보건부", role: "치유", rarity: "R", hp: 94, atk: 8, skill: "응급 처치", cooldown: 4, color: "#ce8b9d", hair: "#70434a", outfit: "#d1b9a4", weapon: "heal", desc: "살아 있는 아군 전원의 체력을 공격력 220%만큼 회복." },
    { id: "jiho", name: "지호", club: "방송부", role: "지원", rarity: "R", hp: 98, atk: 10, skill: "응원의 방송", cooldown: 5, color: "#a29568", hair: "#725a40", outfit: "#7c7751", weapon: "flag", desc: "3초 동안 아군 전원 공격력 30% 증가." },
    { id: "seoyun", name: "서윤", club: "학생회", role: "전사", rarity: "SR", hp: 125, atk: 15, skill: "질서의 검", cooldown: 4, color: "#a37db0", hair: "#373d63", outfit: "#68517b", weapon: "sword", desc: "한 명에게 공격력 300%의 검격. 빠른 스킬 순환." },
    { id: "siu", name: "시우", club: "천문부", role: "마법", rarity: "SR", hp: 103, atk: 16, skill: "별빛 낙하", cooldown: 5, color: "#7990bf", hair: "#a0a5c6", outfit: "#4d6292", weapon: "staff", desc: "적 전체에게 공격력 170%의 별빛 피해." },
    { id: "nari", name: "나리", club: "음악부", role: "치유", rarity: "SR", hp: 115, atk: 11, skill: "작은 치유곡", cooldown: 4, color: "#b68fab", hair: "#aa7977", outfit: "#8c7088", weapon: "heal", desc: "살아 있는 아군 전원에게 공격력 220%의 회복." },
    { id: "geonu", name: "건우", club: "럭비부", role: "수호", rarity: "SR", hp: 192, atk: 11, skill: "철벽 스크럼", cooldown: 4, color: "#7e9a74", hair: "#776348", outfit: "#68774c", weapon: "shield", desc: "최대 체력 25%의 보호막. 받는 피해 28% 감소." },
    { id: "ian", name: "이안", club: "풍기위원", role: "전사", rarity: "SSR", hp: 155, atk: 19, skill: "황혼의 발도", cooldown: 4, color: "#dfb354", hair: "#d8d1b7", outfit: "#344a51", weapon: "sword", desc: "한 명에게 공격력 300%의 발도. 높은 체력과 공격력." },
    { id: "lumi", name: "루미", club: "오컬트부", role: "마법", rarity: "SSR", hp: 128, atk: 21, skill: "달빛 소환", cooldown: 4, color: "#c89ed4", hair: "#b9b2db", outfit: "#5c527d", weapon: "staff", desc: "적 전체에게 공격력 170%의 달빛. 빠른 광역 공격." },
    { id: "osia", name: "오시아", latin: "Osia", club: "물의 용왕", species: "물고기", element: "water", role: "마법", rarity: "SSR", hp: 136, atk: 20, skill: "용왕의 해일", skillMultiplier: 2.2, cooldown: 5, color: "#59bdd7", hair: "#6587bb", outfit: "#f6f3eb", weapon: "water", desc: "물의 용을 불러 적 전체에게 공격력 220%의 물 피해." },
  ];
  const BY_ID = Object.fromEntries(HEROES.map(h => [h.id, h]));
  const CHAPTERS = ["오래된 교실", "방과 후 복도", "비밀의 도서관", "뒤뜰의 정원", "체육관 결계", "별이 내리는 옥상"];
  const ENEMIES = ["분필 슬라임", "낙서 유령", "종이 박쥐", "덩굴 정령", "체육관 골렘", "별가루 망령"];
  const BOSSES = ["칠판의 수호자", "잃어버린 종소리", "금서의 파수꾼", "오래된 나무", "철벽 체육부장", "옥상의 달그림자"];
  const QUESTS = [
    { id: "first", name: "첫 번째 교실", desc: "1-1 지역 클리어", goal: 1, metric: "best", gold: 200, gems: 100 },
    { id: "recruit", name: "새로운 동료", desc: "용병 10회 모집", goal: 10, metric: "pulls", gold: 300, gems: 150 },
    { id: "collection", name: "우리들의 동아리", desc: "서로 다른 용병 6명 수집", goal: 6, metric: "collection", gold: 500, gems: 200 },
    { id: "chapter", name: "교실 너머로", desc: "1-5 지역 클리어", goal: 5, metric: "best", gold: 700, gems: 200 },
    { id: "captain", name: "믿음직한 단장", desc: "단장 레벨 5 달성", goal: 5, metric: "captain", gold: 900, gems: 250 },
    { id: "veteran", name: "학교를 지키는 사람들", desc: "3-5 지역 클리어", goal: 15, metric: "best", gold: 2000, gems: 400 },
    { id: "graduation", name: "학교의 전설", desc: "6-5 지역 클리어", goal: 30, metric: "best", gold: 5000, gems: 1000 },
  ];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fail = (condition, message) => { if (!condition) throw new Error(message); };
  const clone = value => JSON.parse(JSON.stringify(value));
  function random(s) { let x = s.seed | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; s.seed = x >>> 0; return s.seed / 4294967296; }
  const day = now => Math.floor((now + 9 * 3600000) / 86400000);
  const needXp = level => 20 + level * 12 + Math.floor(level * level * 1.5);
  const captainNeed = level => 30 + level * 20;
  const trainingCost = unit => 50 + unit.level * 20;
  const awakeningCost = unit => 10 + unit.stars * 10;
  function stats(id, unit) {
    const h = BY_ID[id], factor = 1 + unit.stars * .15;
    return { hp: Math.round((h.hp + (unit.level - 1) * 14) * factor), atk: Math.round((h.atk + (unit.level - 1) * 3) * factor), defense: h.role === "수호" ? .28 : .05 };
  }
  function stageName(stage) { return `${Math.floor((stage - 1) / 5) + 1}-${(stage - 1) % 5 + 1}`; }
  function chapter(stage) { return clamp(Math.floor((stage - 1) / 5), 0, 5); }
  function event(s, kind, data = {}) {
    const e = { seq: ++s.seq, kind, ...data };
    s.events.push(e); if (s.events.length > 50) s.events.splice(0, s.events.length - 50);
    return e;
  }
  function log(s, text) { s.logs.unshift(text); s.logs.length = Math.min(s.logs.length, 14); }
  function addUnitXp(s, id, amount) {
    const u = s.units[id]; if (!u || u.level >= MAX_LEVEL) return;
    u.xp += amount;
    const before = u.level;
    while (u.level < MAX_LEVEL && u.xp >= needXp(u.level)) { u.xp -= needXp(u.level); u.level++; }
    if (u.level === MAX_LEVEL) u.xp = 0;
    if (u.level > before) { event(s, "level", { id, level: u.level }); log(s, `${BY_ID[id].name} Lv.${u.level}!`); }
  }
  function captainXp(s, amount) {
    s.captain.xp += amount;
    while (s.captain.level < 50 && s.captain.xp >= captainNeed(s.captain.level)) {
      s.captain.xp -= captainNeed(s.captain.level); s.captain.level++; s.gems += 30;
      event(s, "captain", { level: s.captain.level }); log(s, `단장 Lv.${s.captain.level} · 보석 +30`);
    }
    if (s.captain.level === 50) s.captain.xp = 0;
  }
  function rates(s) { return { gold: 20 + s.best * 7, xp: 8 + s.best * 2 }; }
  function spawn(s) {
    const boss = s.wave === 4, scale = Math.pow(1.18, s.stage - 1), zone = chapter(s.stage);
    s.battle = { stage: s.stage, wave: s.wave, boss, phase: "fight", wait: 0, tick: 0, buff: 0,
      heroes: s.team.map(id => { const st = stats(id, s.units[id]); return { id, hp: st.hp, max: st.hp, atk: st.atk, defense: st.defense, energy: 0, shield: 0 }; }),
      enemies: Array.from({ length: boss ? 1 : 3 }, (_, i) => ({ id: `e${i}`, kind: zone, name: boss ? BOSSES[zone] : ENEMIES[zone], hp: Math.round((boss ? 155 : 30) * scale), max: Math.round((boss ? 155 : 30) * scale), atk: Math.round((boss ? 10 : 3) * Math.pow(1.14, s.stage - 1)), boss })),
    };
    event(s, "wave", { stage: s.stage, wave: s.wave, boss });
  }
  function create(now = Date.now(), seed = 123456789) {
    fail(Number.isFinite(now) && now >= 0, "잘못된 시간입니다.");
    const s = { version: 1, at: now, seed: (seed >>> 0) || 123456789, seq: 0, events: [], logs: [],
      gold: 700, gems: 1800, captain: { level: 1, xp: 0 }, units: {}, team: ["taeo", "harin", "sua"],
      stage: 1, wave: 1, best: 0, mode: "progress", kills: 0, pulls: 0, pity: 0, losses: 0,
      offline: { seconds: 0, gold: 0, xp: 0 }, claimed: [], daily: -1, receipts: [], history: [] };
    for (const id of s.team) s.units[id] = { level: 1, xp: 0, stars: 0, shards: 0 };
    log(s, "방과 후, 학교용병단의 모험이 시작됩니다."); spawn(s); return s;
  }
  function validate(s) {
    return !!(s && s.version === 1 && Number.isFinite(s.at) && s.at >= 0 && Number.isInteger(s.seed) &&
      Number.isFinite(s.gold) && s.gold >= 0 && Number.isFinite(s.gems) && s.gems >= 0 &&
      s.units && Object.keys(s.units).every(id => BY_ID[id] && Number.isInteger(s.units[id].level) && s.units[id].level >= 1 && s.units[id].level <= MAX_LEVEL && Number.isFinite(s.units[id].xp) && Number.isInteger(s.units[id].stars) && s.units[id].stars >= 0 && s.units[id].stars <= 5 && Number.isFinite(s.units[id].shards)) &&
      Array.isArray(s.team) && s.team.length === 3 && new Set(s.team).size === 3 && s.team.every(id => s.units[id]) &&
      Number.isInteger(s.stage) && s.stage >= 1 && s.stage <= MAX_STAGE && Number.isInteger(s.wave) && s.wave >= 1 && s.wave <= 4 &&
      Number.isInteger(s.best) && s.best >= 0 && s.best <= MAX_STAGE && Number.isInteger(s.pity) && s.pity >= 0 && s.pity < RECRUIT_PITY.hard &&
      s.battle && Array.isArray(s.battle.heroes) && Array.isArray(s.battle.enemies) && s.battle.heroes.every(h => BY_ID[h.id] && Number.isFinite(h.hp)) &&
      Array.isArray(s.events) && Array.isArray(s.logs) && Array.isArray(s.claimed) && Array.isArray(s.receipts) && Array.isArray(s.history) &&
      s.offline && Number.isFinite(s.offline.seconds) && Number.isFinite(s.offline.gold) && Number.isFinite(s.offline.xp) && s.captain && Number.isInteger(s.captain.level));
  }
  function hurt(s, from, target, raw, side, skill = false) {
    let amount = Math.max(1, Math.round(raw));
    if (side === "hero") {
      amount = Math.max(1, Math.round(amount * (1 - target.defense)));
      const shield = Math.min(target.shield, amount); target.shield -= shield; amount -= shield;
      if (shield) event(s, "shield", { to: target.id, amount: shield });
    }
    amount = Math.min(target.hp, amount); target.hp -= amount;
    event(s, "hit", { from, to: target.id, side, amount, skill, ...(BY_ID[from]?.element ? { element: BY_ID[from].element } : {}) });
    if (target.hp <= 0 && side === "enemy") s.kills++;
  }
  function victory(s) {
    const b = s.battle, gold = (12 + s.stage * 4) * (b.boss ? 3 : 1), xp = 8 + s.stage * 2;
    s.gold += gold; for (const id of s.team) addUnitXp(s, id, xp * (b.boss ? 2 : 1));
    captainXp(s, 4 + Math.floor(s.stage / 2));
    event(s, "reward", { gold, xp, boss: b.boss });
    if (b.boss) {
      s.losses = 0;
      if (s.stage > s.best) { s.best = s.stage; s.gems += 60; event(s, "clear", { stage: s.stage, gems: 60 }); log(s, `${stageName(s.stage)} 클리어! 보석 +60`); }
      if (s.mode === "progress" && s.stage < MAX_STAGE) s.stage++;
      if (s.stage === MAX_STAGE && s.best === MAX_STAGE) s.mode = "farm";
      s.wave = 1;
    } else s.wave++;
    b.phase = "victory"; b.wait = b.boss ? 4 : 2;
  }
  function tick(s) {
    const b = s.battle;
    if (b.phase !== "fight") { if (--b.wait <= 0) spawn(s); return; }
    b.tick++;
    if (b.buff > 0) b.buff--;
    for (const hero of b.heroes.filter(h => h.hp > 0)) {
      const enemies = b.enemies.filter(e => e.hp > 0); if (!enemies.length) break;
      const def = BY_ID[hero.id]; hero.energy++;
      const skill = hero.energy >= def.cooldown;
      if (skill) { hero.energy = 0; event(s, "skill", { from: hero.id, name: def.skill, role: def.role, ...(def.element ? { element: def.element } : {}) }); }
      let target = enemies[0], multiplier = skill ? 3 : 1;
      if (skill && def.role === "치유") {
        for (const friend of b.heroes.filter(h => h.hp > 0)) {
          const heal = Math.min(friend.max - friend.hp, Math.round(hero.atk * 2.2)); friend.hp += heal;
          if (heal) event(s, "heal", { from: hero.id, to: friend.id, amount: heal });
        }
        continue;
      }
      if (skill && def.role === "수호") { hero.shield += Math.round(hero.max * .25); event(s, "guard", { to: hero.id, amount: hero.shield }); multiplier = 1; }
      if (skill && def.role === "지원") { b.buff = 4; multiplier = 1; }
      if (skill && def.role === "사수") { target = enemies.reduce((a, e) => a.hp < e.hp ? a : e); multiplier = 2.6; }
      const victims = skill && def.role === "마법" ? enemies : [target];
      if (skill && def.role === "마법") multiplier = def.skillMultiplier || 1.7;
      for (const enemy of victims) {
        const critical = random(s) < .12;
        hurt(s, hero.id, enemy, hero.atk * multiplier * (b.buff ? 1.3 : 1) * (.9 + random(s) * .2) * (critical ? 1.5 : 1), "enemy", skill);
      }
    }
    if (b.enemies.every(e => e.hp <= 0)) { victory(s); return; }
    for (const enemy of b.enemies.filter(e => e.hp > 0)) {
      const alive = b.heroes.filter(h => h.hp > 0); if (!alive.length) break;
      const target = random(s) < .75 ? alive[0] : alive[Math.floor(random(s) * alive.length)];
      hurt(s, enemy.id, target, enemy.atk * (.85 + random(s) * .3), "hero");
    }
    if (b.heroes.every(h => h.hp <= 0) || b.tick >= 120) {
      b.phase = "defeat"; b.wait = 5; s.wave = 1; s.losses++;
      event(s, "defeat"); log(s, "잠시 쉬어 갑니다. 용병을 훈련하거나 편성을 바꿔보세요.");
      if (s.losses >= 3 && s.best >= 1) { s.mode = "farm"; s.stage = s.best; s.losses = 0; log(s, "클리어한 지역에서 자동으로 성장합니다. 도전 버튼으로 다시 출발하세요."); }
    }
  }
  function advance(s, now) {
    if (!Number.isFinite(now) || now <= s.at) return { seconds: 0, offline: false };
    const seconds = Math.floor((now - s.at) / 1000);
    if (!seconds) return { seconds: 0, offline: false };
    if (seconds > 90) {
      const add = Math.min(seconds, Math.max(0, OFFLINE_CAP - s.offline.seconds)), rate = rates(s);
      s.offline.seconds += add; s.offline.gold += Math.floor(rate.gold * add / 60); s.offline.xp += Math.floor(rate.xp * add / 60);
      s.at += seconds * 1000;
      if (add) event(s, "offline", { seconds: add });
      return { seconds: add, offline: true };
    }
    for (let i = 0; i < seconds; i++) tick(s);
    s.at += seconds * 1000;
    return { seconds, offline: false };
  }
  function questValue(s, quest) { return quest.metric === "collection" ? Object.keys(s.units).length : quest.metric === "captain" ? s.captain.level : s[quest.metric]; }
  function recruit(s, count, rng) {
    fail(count === 1 || count === 10, "1회 또는 10회 모집할 수 있습니다.");
    const cost = count === 10 ? 900 : 100; fail(s.gems >= cost, "보석이 부족합니다.");
    const results = []; let premium = false;
    for (let i = 0; i < count; i++) {
      const odds = recruitRates(s.pity), roll = rng(); let rarity = roll < odds.SSR ? "SSR" : roll < odds.SSR + odds.SR ? "SR" : "R";
      const pity = s.pity >= RECRUIT_PITY.hard - 1;
      if (pity) rarity = "SSR";
      if (count === 10 && i === 9 && !premium && rarity === "R") rarity = "SR";
      if (rarity !== "R") premium = true;
      s.pity = rarity === "SSR" ? 0 : s.pity + 1;
      const candidates = HEROES.filter(h => h.rarity === rarity), h = candidates[Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))];
      const fresh = !s.units[h.id], shards = rarity === "SSR" ? 20 : rarity === "SR" ? 10 : 5;
      if (fresh) s.units[h.id] = { level: 1, xp: 0, stars: 0, shards: 0 }; else s.units[h.id].shards += shards;
      results.push({ id: h.id, fresh, shards: fresh ? 0 : shards, pity, ssrChance: odds.SSR });
    }
    s.gems -= cost; s.pulls += count; s.history = results.concat(s.history).slice(0, 30);
    event(s, "recruit", { count, ssr: results.some(r => BY_ID[r.id].rarity === "SSR") });
    log(s, `${count}명의 지원서가 도착했습니다.`); return { kind: "recruit", results, cost };
  }
  function action(s, input, now = Date.now(), rng = Math.random) {
    fail(input && typeof input === "object" && !Array.isArray(input), "잘못된 행동입니다.");
    const kind = input.kind;
    if (kind === "recruit") return recruit(s, input.count, rng);
    if (kind === "train") {
      const u = s.units[input.hero]; fail(u && BY_ID[input.hero], "보유한 용병을 선택하세요.");
      fail(u.level < MAX_LEVEL, "최대 레벨입니다."); const cost = trainingCost(u); fail(s.gold >= cost, "골드가 부족합니다.");
      s.gold -= cost; addUnitXp(s, input.hero, needXp(u.level) - u.xp);
      return { kind, hero: input.hero, level: u.level };
    }
    if (kind === "awaken") {
      const u = s.units[input.hero]; fail(u && BY_ID[input.hero], "보유한 용병을 선택하세요.");
      fail(u.stars < 5, "최대 각성입니다."); const cost = awakeningCost(u); fail(u.shards >= cost, "같은 용병의 조각이 부족합니다.");
      u.shards -= cost; u.stars++; event(s, "awaken", { id: input.hero, stars: u.stars }); return { kind, hero: input.hero, stars: u.stars };
    }
    if (kind === "team") {
      fail(Array.isArray(input.team) && input.team.length === 3 && new Set(input.team).size === 3 && input.team.every(id => typeof id === "string" && BY_ID[id] && Object.hasOwn(s.units, id)), "보유한 서로 다른 용병 3명을 편성하세요.");
      fail(input.team.some((id, i) => s.team[i] !== id), "이미 같은 편성입니다.");
      s.team = [...input.team]; spawn(s); log(s, "새로운 편성으로 전투를 시작합니다."); return { kind };
    }
    if (kind === "stage") {
      fail(Number.isInteger(input.stage) && input.stage >= 1 && input.stage <= Math.min(MAX_STAGE, s.best + 1), "아직 열리지 않은 지역입니다.");
      fail(["progress", "farm"].includes(input.mode), "도전 또는 반복을 선택하세요.");
      s.stage = input.stage; s.wave = 1; s.mode = input.mode; s.losses = 0; spawn(s); return { kind };
    }
    if (kind === "offline") {
      fail(s.offline.seconds > 0, "이미 보상을 받았습니다."); const reward = { ...s.offline };
      s.offline = { seconds: 0, gold: 0, xp: 0 }; s.gold += reward.gold;
      for (const id of s.team) addUnitXp(s, id, reward.xp); captainXp(s, Math.floor(reward.xp / 4));
      log(s, `방치 보상 골드 +${reward.gold} · 용병 경험치 +${reward.xp}`); return { kind, reward };
    }
    if (kind === "daily") {
      const today = day(now); fail(s.daily < today, "오늘의 보급은 이미 받았습니다.");
      s.daily = today; s.gold += 250; s.gems += 150; return { kind, gold: 250, gems: 150 };
    }
    if (kind === "quest") {
      const quest = QUESTS.find(q => q.id === input.quest);
      fail(quest && !s.claimed.includes(quest.id) && questValue(s, quest) >= quest.goal, "달성한 임무 보상을 선택하세요.");
      s.claimed.push(quest.id); s.gold += quest.gold; s.gems += quest.gems; return { kind, gold: quest.gold, gems: quest.gems };
    }
    throw Error("지원하지 않는 행동입니다.");
  }
  function view(s) { const result = clone(s); delete result.receipts; return result; }
  function power(s) { return s.team.reduce((sum, id) => { const st = stats(id, s.units[id]); return sum + st.atk * 5 + Math.round(st.hp / 4); }, 0); }
  return { HEROES, BY_ID, CHAPTERS, ENEMIES, BOSSES, QUESTS, MAX_STAGE, MAX_LEVEL, OFFLINE_CAP, CATALOG_VERSION, RECRUIT_RATES, RECRUIT_PITY, recruitRates, create, validate, advance, action, stats, stageName, chapter, rates, questValue, needXp, captainNeed, trainingCost, awakeningCost, power, day, clone, view };
});
