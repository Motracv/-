(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SchoolRPG = api;
})(globalThis, function () {
  "use strict";
  const MAX_STAGE = 60, MAX_LEVEL = 100, CAPTAIN_MAX_LEVEL = 200, MAX_TEAM = 6, MAX_TOWER_FLOOR = 1000000, OFFLINE_CAP = 8 * 3600, CATALOG_VERSION = 11;
  const STEP_MS = 500;
  const OSIA_CINEMATIC_MS = 1000;
  const OSIA_SKILLS = [
    { stage: 1, impactDelay: 500, name: "대형 물탄" },
    { stage: 2, impactDelay: 500, name: "소용돌이" },
    { stage: 3, impactDelay: 500, name: "물기둥" },
    { stage: 4, impactDelay: 1000, name: "거대 수룡", stunMs: 1500 },
  ];
  const osiaSkill = s => OSIA_SKILLS[(s.units.osia?.nextSkill || 1) - 1];
  const LAVA_SKILLS = [
    { stage: 1, name: "바람의 부채", healMultiplier: 1.6, shieldMultiplier: .9 },
    { stage: 2, name: "바람의 상처", healMultiplier: 4.5 },
  ];
  const lavaSkill = s => LAVA_SKILLS[(s.units.lava?.nextSkill || 1) - 1];
  const HORAS_RULES = Object.freeze({ maxStacks: 5, basicMs: 2000, basicMotionMs: 900, hitStackMs: 1000, mergeMs: 1000, impactDelay: 1500, minCastMs: 3000, basicMultiplier: 2, primaryMultiplier: 12, splashMultiplier: .7, stunMultiplier: 1.5, missChance: .1, markMs: 6000, refundStacks: 2 });
  const UR_RECRUIT_RATES = Object.freeze({ UR: .003, SSR: .01, SR: .26, R: .727 });
  const RECRUIT_RATES = { SSR: .01, SR: .26, R: .73 };
  const RECRUIT_PITY = { hard: 80, soft: 60, stepPercent: 1 };
  const STANDARD_SSR = Object.freeze(["osia", "ian", "lumi"]);
  const BANNERS = Object.freeze({
    horas: Object.freeze({ id: "horas", name: "호라스 픽업뽑기", featured: "horas", rarity: "UR", limited: false, expiresAt: null }),
    osia: Object.freeze({ id: "osia", name: "오시아 상시 모집", featured: "osia", limited: false, expiresAt: null }),
    lava: Object.freeze({ id: "lava", name: "라바 한정 모집", featured: "lava", limited: true, expiresAt: Date.parse("2026-11-21T00:00:00+09:00") }),
  });
  // The deadline is exclusive: codes work throughout November 20 in Korea.
  const COUPONS = Object.freeze({
    MAJORUPDATE: Object.freeze({ gold: 0, gems: 3000, expiresAt: null }),
    OSIA_DEBUT: Object.freeze({ gold: 1000, gems: 1000, expiresAt: Date.parse("2026-11-21T00:00:00+09:00") }),
    BUG_FIX: Object.freeze({ gold: 1500, gems: 1500, expiresAt: Date.parse("2026-11-21T00:00:00+09:00") }),
    LAVA_DEBUT: Object.freeze({ gold: 1000, gems: 1000, expiresAt: Date.parse("2026-11-21T00:00:00+09:00") }),
    THANK_YOU: Object.freeze({ gold: 500, gems: 500, expiresAt: Date.parse("2026-11-21T00:00:00+09:00") }),
  });
  const DUNGEONS = Object.freeze({
    daily: Object.freeze({ id: "daily", name: "방과 후 보급고", cap: 3, unlocks: [0, 10, 20, 35, 50], stages: [5, 15, 30, 45, 60] }),
    weekly: Object.freeze({ id: "weekly", name: "봉인된 이사장실", cap: 2, unlocks: [0, 15, 30, 45, 60], stages: [5, 15, 30, 45, 60] }),
    tower: Object.freeze({ id: "tower", name: "뫼비우스의 복도", cap: null }),
  });
  const BOSS_RULES = Object.freeze({ storyHp: 2.6, storyAttack: 1, aoeEvery: 6000, aoeMultiplier: 1.6, rageEvery: 15000, rageStep: .12 });
  const PROGRESSION = Object.freeze({ unitRequirement: 3, battleXp: .2, dungeonXp: .35, offlineXp: .2, captainBattleXp: .25, captainOfflineDivisor: 8 });
  const CRITICAL = Object.freeze({ chance: .12, multiplier: 1.5 });
  const PARTY_SYNERGIES = Object.freeze([
    Object.freeze({ id: "tank", name: "철벽 전열", required: 3, description: "수호 3명 · 아군 전체 받는 피해 15% 감소" }),
    Object.freeze({ id: "damage", name: "집중 공세", required: 3, description: "전사·사수·마법 3명 · 아군 전체 공격 피해 15% 증가" }),
    Object.freeze({ id: "healer", name: "생명의 합주", required: 3, description: "치유 3명 · 아군 전체 회복량 20% 증가" }),
  ]);
  const WINTER_EVENT = Object.freeze({ id: "first-snow-2026", name: "겨울의 첫눈", startsAt: Date.parse("2026-11-18T00:00:00+09:00"), endsAt: null, dropChance: .2,
    shop: Object.freeze({ gold: Object.freeze({ cost: 10, limit: 30, gold: 1000, gems: 0 }), gems: Object.freeze({ cost: 20, limit: 15, gold: 0, gems: 100 }) }) });
  // Use integer percentages so 1400 × 35% is exactly 490, not 489.999… .
  const scaledXp = (amount, multiplier) => amount > 0 ? Math.max(1, Math.floor(amount * Math.round(multiplier * 100) / 100)) : 0;
  function recruitRates(misses, banner = "osia") {
    if (banner === "horas") {
      const next = misses + 1;
      if (next >= RECRUIT_PITY.hard) return { UR: 1, SSR: 0, SR: 0, R: 0 };
      const ur = (3 + Math.max(0, next - RECRUIT_PITY.soft + 1) * 10) / 1000;
      return { UR: ur, SSR: UR_RECRUIT_RATES.SSR, SR: UR_RECRUIT_RATES.SR, R: 1 - ur - UR_RECRUIT_RATES.SSR - UR_RECRUIT_RATES.SR };
    }
    const next = misses + 1;
    if (next >= RECRUIT_PITY.hard) return { SSR: 1, SR: 0, R: 0 };
    const ssrPercent = RECRUIT_RATES.SSR * 100 + Math.max(0, next - RECRUIT_PITY.soft + 1) * RECRUIT_PITY.stepPercent;
    // Soft pity takes its extra probability from R, keeping SR at 26%.
    return { SSR: ssrPercent / 100, SR: RECRUIT_RATES.SR, R: (100 - ssrPercent - RECRUIT_RATES.SR * 100) / 100 };
  }
  function bannerAvailable(id, now = Date.now()) {
    return typeof id === "string" && Object.hasOwn(BANNERS, id) && Number.isFinite(now) && (BANNERS[id].expiresAt === null || now < BANNERS[id].expiresAt);
  }
  function bannerState(s, id = "osia") {
    if (!Object.hasOwn(BANNERS, id)) return null;
    const saved = s.banners?.[id];
    // Read old saves without changing them; the first successful update persists
    // both independent counters and preserves the original permanent pity.
    return { pity: saved?.pity ?? (id === "osia" ? s.pity : 0), guaranteed: saved?.guaranteed ?? false };
  }
  function bannerHeroRates(s, id = "osia") {
    const progress = bannerState(s, id); if (!progress) return {};
    const rates = recruitRates(progress.pity, id), featured = BANNERS[id].featured;
    const otherSSR = STANDARD_SSR.filter(hero => hero !== featured);
    const result = Object.fromEntries(HEROES.map(hero => [hero.id, 0]));
    for (const grade of ["R", "SR"]) {
      const pool = HEROES.filter(hero => hero.rarity === grade);
      for (const hero of pool) result[hero.id] = rates[grade] / pool.length;
    }
    if (id === "horas") {
      result.horas = rates.UR;
      for (const hero of STANDARD_SSR) result[hero] = rates.SSR / STANDARD_SSR.length;
      return result;
    }
    result[featured] = rates.SSR * (progress.guaranteed ? 1 : .5);
    for (const hero of otherSSR) result[hero] = progress.guaranteed ? 0 : rates.SSR * .5 / otherSSR.length;
    return result;
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
    { id: "doyoon", name: "도윤", club: "안전부", role: "수호", rarity: "SR", hp: 180, atk: 10, skill: "안전한 귀갓길", cooldown: 4, color: "#6e9dbc", hair: "#574035", outfit: "#476b8b", weapon: "shield", desc: "최대 체력 25%의 보호막. 받는 피해 28% 감소. 수호 3인 편성으로 철벽 전열을 완성할 수 있습니다." },
    { id: "ian", name: "이안", club: "풍기위원", role: "전사", rarity: "SSR", hp: 155, atk: 19, skill: "황혼의 발도", cooldown: 4, color: "#dfb354", hair: "#d8d1b7", outfit: "#344a51", weapon: "sword", desc: "한 명에게 공격력 300%의 발도. 높은 체력과 공격력." },
    { id: "lumi", name: "루미", club: "오컬트부", role: "마법", rarity: "SSR", hp: 128, atk: 21, skill: "달빛 소환", cooldown: 4, color: "#c89ed4", hair: "#b9b2db", outfit: "#5c527d", weapon: "staff", desc: "적 전체에게 공격력 170%의 달빛. 빠른 광역 공격." },
    { id: "osia", name: "오시아", latin: "Osia", club: "물의 용왕", species: "물고기", element: "water", role: "마법", rarity: "SSR", hp: 136, atk: 20, skill: "용왕의 해일", skillMultiplier: 2.2, cooldown: 5, passive: "용왕의 권능", passiveDesc: "물폭탄 평타로 싸우며 스킬을 충전합니다. 충전할 때마다 대형 물탄 → 소용돌이 → 물기둥 → 거대 수룡 순서로 하나씩 사용하고 반복합니다. 마지막 수룡은 명중한 적을 1.5초 기절시킵니다.", color: "#59bdd7", hair: "#6587bb", outfit: "#f6f3eb", weapon: "water", desc: "5초 충전마다 다음 단계 스킬 하나로 적 전체에게 공격력 220%의 물 피해. 스킬 사이에는 물폭탄 평타를 사용합니다." },
    { id: "lava", name: "라바", latin: "Lava", gender: "남성", species: "인간", club: "바람의 무당", element: "wind", role: "치유", rarity: "SSR", hp: 142, atk: 15, cooldown: 5, skill: "바람의 부채 · 바람의 상처", passive: "신내림", passiveDesc: "본인의 평타가 10회 명중하면 체력 비율이 가장 낮은 생존 아군에게 공격력 200% + 대상 최대 체력 8%의 방어막을 줍니다. 방어막은 최대 체력 60%까지 쌓입니다.", passive2: "긴급생존", passive2Desc: "라바가 살아 있으면 웨이브당 한 번, 아군의 치명적인 피해를 HP 1로 버티게 하고 2초 동안 쓰러지지 않게 합니다. 보호 중에도 회복할 수 있습니다.", color: "#81c4ab", hair: "#91d7f1", outfit: "#9caa65", skirt: "#b9564d", weapon: "wind", desc: "5초 충전마다 교대로 사용합니다. 바람의 부채: 아군 전체 공격력 160% 회복 + 공격력 90% 방어막. 바람의 상처: 체력 비율이 가장 낮은 생존 아군 한 명을 공격력 450%만큼 회복." },
  ];
  HEROES.push({ id: "horas", name: "호라스", latin: "Horas", gender: "여성", club: "벚꽃의 의식", element: "blossom", role: "사수", rarity: "UR", hp: 128, atk: 22, cooldown: 5, skill: "벚꽃의식", passive: "별빛 축적", passiveDesc: "두 손짓의 느린 평타가 적중하거나 공격을 받으면 벚꽃 구슬을 1개 쌓습니다. 피격 획득은 1초당 한 번. 5개를 합쳐 벚꽃의식을 사용합니다.", passive2: "벚꽃의 잔향", passive2Desc: "기절 중인 적에게 주는 피해 1.5배. 의식이 적중한 주 대상에게 6초간 표식을 남깁니다. 아군 누구든 표식 대상을 처치하면 2스택을 한 번 회수합니다.", color: "#f3a2d0", hair: "#f2a6d0", outfit: "#d6e5ff", weapon: "blossom", desc: "2초 간격으로 공격력 200% 평타. 5스택을 소모하여 구슬을 합친 뒤 한 명에게 공격력 1200%, 인접한 적에게 70% 피해. 의식은 10% 확률로 빗나갑니다. 의식 시작 간격은 최소 3초입니다." });
  const BY_ID = Object.fromEntries(HEROES.map(h => [h.id, h]));
  const CHAPTERS = ["오래된 교실", "방과 후 복도", "비밀의 도서관", "뒤뜰의 정원", "체육관 결계", "별이 내리는 옥상", "눈 내린 운동장", "잊혀진 별관", "마력 실험실", "지하 통로", "학교의 경계", "바람의 성소"];
  const ENEMIES = ["분필 슬라임", "낙서 유령", "종이 박쥐", "덩굴 정령", "체육관 골렘", "별가루 망령", "눈송이 정령", "종이 갑옷", "마력 실험체", "그림자 박쥐", "경계 파수꾼", "폭풍 정령"];
  const ENEMY_VARIANTS = [
    ["분필 슬라임", "지우개 미믹", "연필 꼬마악마"], ["시계 정령", "사물함 미믹", "대걸레 유령"],
    ["책 박쥐", "두루마리 망령", "잉크 거미"], ["화분 덩굴", "물뿌리개 요정", "갈퀴 허수아비"],
    ["폭주 농구공", "아령 집게", "호루라기 정령"], ["별빛 망원경", "천체구 정령", "종이학 환영"],
    ["서리 종", "목도리 눈사람", "얼음 표지콘"], ["빈 교복 기사", "책상 미믹", "금간 칠판병"],
    ["마력 플라스크", "현미경 감시자", "자석 골렘"], ["양동이 소라게", "배수관 장어", "젖은 우산 요괴"],
    ["바람 깃발", "나침반 파수꾼", "연 가오리"], ["신당의 방울", "부적 망령", "설원의 여우탈"],
  ];
  const BOSSES = ["칠판의 수호자", "잃어버린 종소리", "금서의 파수꾼", "오래된 나무", "철벽 체육부장", "옥상의 달그림자", "얼어붙은 운동장지기", "별관의 잊힌 기사", "폭주한 마력핵", "지하의 눈먼 수호자", "경계를 삼키는 그림자", "성소의 폭풍왕"];
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
  const week = now => Math.floor((day(now) + 3) / 7);
  function normalizeCommanderName(raw) {
    if (typeof raw !== "string" || raw.length > 128 || /[\p{C}<>]/u.test(raw)) return null;
    const name = raw.normalize("NFC").trim().replace(/\p{Zs}+/gu, " ");
    const length = Array.from(name).length;
    return length >= 2 && length <= 12 && /^[\p{L}\p{N} _-]+$/u.test(name) ? name : null;
  }
  function commanderNameInfo(s) {
    const changes = s.nameChanges ?? (s.commanderName && s.commanderName !== "새내기 단장" ? 1 : 0);
    return { changes, cost: changes > 0 ? 3000 : 0 };
  }
  function partySynergies(s) {
    const counts = { tank: 0, damage: 0, healer: 0 };
    for (const id of new Set(s.team || [])) {
      const role = BY_ID[id]?.role;
      if (role === "수호") counts.tank++;
      if (["전사", "사수", "마법"].includes(role)) counts.damage++;
      if (role === "치유") counts.healer++;
    }
    return { counts, active: PARTY_SYNERGIES.filter(def => counts[def.id] >= def.required).map(def => ({ ...def, count: counts[def.id] })),
      damageMultiplier: counts.damage >= 3 ? 1.15 : 1, healMultiplier: counts.healer >= 3 ? 1.2 : 1, incomingMultiplier: counts.tank >= 3 ? .85 : 1 };
  }
  function newWinter() { return { id: WINTER_EVENT.id, snowflakes: 0, earned: 0, exchanges: { gold: 0, gems: 0 } }; }
  function validWinter(w) {
    return w === undefined || !!(w && w.id === WINTER_EVENT.id && Number.isSafeInteger(w.snowflakes) && w.snowflakes >= 0 && Number.isSafeInteger(w.earned) && w.earned >= w.snowflakes &&
      w.exchanges && Object.keys(WINTER_EVENT.shop).every(id => Number.isInteger(w.exchanges[id]) && w.exchanges[id] >= 0 && w.exchanges[id] <= WINTER_EVENT.shop[id].limit));
  }
  function winterInfo(s, now = Date.now()) {
    const w = s.winter || newWinter(), active = Number.isFinite(now) && now >= WINTER_EVENT.startsAt && (WINTER_EVENT.endsAt === null || now < WINTER_EVENT.endsAt);
    return { id: WINTER_EVENT.id, name: WINTER_EVENT.name, active, snowflakes: w.snowflakes, earned: w.earned,
      items: Object.entries(WINTER_EVENT.shop).map(([id, item]) => ({ id, ...item, bought: w.exchanges[id], remaining: item.limit - w.exchanges[id], canBuy: active && w.exchanges[id] < item.limit && w.snowflakes >= item.cost })) };
  }
  function winterDrop(s) {
    if (!winterInfo(s, s.at).active || random(s) >= WINTER_EVENT.dropChance) return 0;
    const w = s.winter ||= newWinter(), amount = s.battle.boss ? 2 : 1;
    if (w.earned > Number.MAX_SAFE_INTEGER - amount) return 0;
    w.snowflakes += amount; w.earned += amount;
    event(s, "snowflake", { amount, total: w.snowflakes });
    return amount;
  }
  function damageReport(s) {
    const b = s.battle, elapsedMs = b.elapsed || 0;
    const rows = b.heroes.map(hero => {
      const record = b.damage?.[hero.id] || {};
      const row = { id: hero.id, damage: record.damage || 0, healing: record.healing || 0, taken: record.taken || 0, criticals: record.criticals || 0 };
      return { ...row, dps: Math.round(row.damage / Math.max(1, elapsedMs / 1000)) };
    });
    return { battleId: b.id, elapsedMs, rows, totals: rows.reduce((sum, row) => { for (const key of ["damage", "healing", "taken", "criticals"]) sum[key] += row[key]; return sum; }, { damage: 0, healing: 0, taken: 0, criticals: 0 }) };
  }
  function meter(s, id, key, amount) {
    if (!Object.hasOwn(BY_ID, id) || !Number.isFinite(amount) || amount <= 0) return;
    const records = s.battle.damage ||= {}, record = records[id] ||= { damage: 0, healing: 0, taken: 0, criticals: 0 };
    record[key] = (record[key] || 0) + amount;
  }
  function activityReward(kind, value) {
    if (kind === "tower") return { gold: 100 + 5 * value, gems: 10 + Math.floor(value / 5), xp: 0 };
    return kind === "daily" ? { gold: 2000 + 1500 * (value - 1), gems: 80 + 30 * (value - 1), xp: scaledXp(200 + 100 * (value - 1), PROGRESSION.dungeonXp) }
      : { gold: 12000 + 6000 * (value - 1), gems: 600 + 200 * (value - 1), xp: scaledXp(1000 + 400 * (value - 1), PROGRESSION.dungeonXp) };
  }
  function newActivities(now) {
    return { daily: { period: day(now), used: 0 }, weekly: { period: week(now), used: 0 }, towerBest: 0, run: null, lastResult: null };
  }
  function refreshActivities(s, now) {
    s.activities ??= newActivities(now);
    for (const kind of ["daily", "weekly"]) {
      const period = kind === "daily" ? day(now) : week(now);
      if (period > s.activities[kind].period) s.activities[kind] = { period, used: 0 };
    }
    return s.activities;
  }
  // Pure UI projection: opening a panel does not replenish or spend a key.
  function activityInfo(s, now = Date.now()) {
    const at = Number.isFinite(now) && now >= 0 ? now : s.at, saved = s.activities || newActivities(at), result = {};
    for (const kind of ["daily", "weekly"]) {
      const def = DUNGEONS[kind], current = kind === "daily" ? day(at) : week(at);
      const period = Math.max(current, saved[kind].period), used = period === saved[kind].period ? saved[kind].used : 0;
      result[kind] = { id: kind, name: def.name, keys: def.cap - used, cap: def.cap, period,
        resetAt: (kind === "daily" ? period + 1 : (period + 1) * 7 - 3) * 86400000 - 9 * 3600000,
        tiers: def.unlocks.map((best, i) => ({ tier: i + 1, unlocked: s.best >= best, requiredBest: best, unlockBest: best, stage: def.stages[i], reward: activityReward(kind, i + 1) })) };
    }
    const nextFloor = Math.min(MAX_TOWER_FLOOR, saved.towerBest + 1);
    result.tower = { id: "tower", name: DUNGEONS.tower.name, best: saved.towerBest, nextFloor, reward: activityReward("tower", nextFloor), maxFloor: MAX_TOWER_FLOOR };
    result.run = saved.run ? clone(saved.run) : null; result.result = saved.lastResult ? clone(saved.lastResult) : null;
    return result;
  }
  function validActivities(a) {
    if (a === undefined) return true;
    if (!a || typeof a !== "object" || Array.isArray(a)) return false;
    for (const kind of ["daily", "weekly"]) if (!a[kind] || !Number.isSafeInteger(a[kind].period) || !Number.isInteger(a[kind].used) || a[kind].used < 0 || a[kind].used > DUNGEONS[kind].cap) return false;
    if (!Number.isInteger(a.towerBest) || a.towerBest < 0 || a.towerBest > MAX_TOWER_FLOOR) return false;
    function validRun(r) {
      return r && Number.isSafeInteger(r.id) && r.id > 0 && Object.hasOwn(DUNGEONS, r.kind) && typeof r.settled === "boolean" &&
        (r.kind === "tower" ? Number.isInteger(r.floor) && r.floor >= 1 && r.floor <= MAX_TOWER_FLOOR
          : Number.isInteger(r.tier) && r.tier >= 1 && r.tier <= 5 && Number.isSafeInteger(r.period));
    }
    if (a.run !== null && !validRun(a.run)) return false;
    const r = a.lastResult;
    return r === null || !!(r && Number.isSafeInteger(r.runId) && r.runId > 0 && Object.hasOwn(DUNGEONS, r.kind) && typeof r.won === "boolean" && typeof r.firstClear === "boolean" && typeof r.refunded === "boolean" && typeof r.reason === "string" && r.reward && ["gold", "gems", "xp"].every(k => Number.isFinite(r.reward[k]) && r.reward[k] >= 0));
  }
  const needXp = level => (20 + level * 12 + Math.floor(level * level * 1.5)) * PROGRESSION.unitRequirement;
  const captainNeed = level => 20 + level * 10 + level * level * 5;
  const trainingCost = unit => 50 + unit.level * 16 + unit.level * unit.level * 2;
  const awakeningCost = unit => 10 + unit.stars * 10;
  function stats(id, unit) {
    const h = BY_ID[id], factor = 1 + unit.stars * .15;
    return { hp: Math.round((h.hp + (unit.level - 1) * 14) * factor), atk: Math.round((h.atk + (unit.level - 1) * 3) * factor), defense: h.role === "수호" ? .28 : .05, critChance: CRITICAL.chance, critMultiplier: CRITICAL.multiplier };
  }
  function stageName(stage) { return `${Math.floor((stage - 1) / 5) + 1}-${(stage - 1) % 5 + 1}`; }
  function chapter(stage) { return clamp(Math.floor((stage - 1) / 5), 0, CHAPTERS.length - 1); }
  function event(s, kind, data = {}) {
    const e = { seq: ++s.seq, kind, at: s.at, simAt: s.simTime || 0, battleId: s.battle?.id, ...data };
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
    while (s.captain.level < CAPTAIN_MAX_LEVEL && s.captain.xp >= captainNeed(s.captain.level)) {
      s.captain.xp -= captainNeed(s.captain.level); s.captain.level++; s.gems += 30;
      event(s, "captain", { level: s.captain.level }); log(s, `단장 Lv.${s.captain.level} · 보석 +30`);
    }
    if (s.captain.level === CAPTAIN_MAX_LEVEL) s.captain.xp = 0;
  }
  function rates(s) { return { gold: 20 + s.best * 7, xp: scaledXp(8 + s.best * 2, PROGRESSION.offlineXp) }; }
  function campaignScale(stage) {
    const late = Math.max(0, stage - 30) / 30, middle = Math.max(0, Math.min(20, stage - 10)) / 20;
    return { hp: Math.pow(1.18, Math.min(29, stage - 1)) * Math.pow(1.055, Math.max(0, stage - 30)) * (1 + middle * .25 + late * (BOSS_RULES.storyHp - 1.25)),
      atk: Math.pow(1.14, Math.min(29, stage - 1)) * Math.pow(1.015, Math.max(0, stage - 30)) * (1 + late * (BOSS_RULES.storyAttack - 1)) };
  }
  function freshHeroes(s, previousOsia) {
    const synergy = partySynergies(s);
    return s.team.map(id => { const st = stats(id, s.units[id]); return { id, hp: st.hp, max: st.hp, atk: st.atk, defense: 1 - (1 - st.defense) * synergy.incomingMultiplier, damageMultiplier: synergy.damageMultiplier, healMultiplier: synergy.healMultiplier, critChance: st.critChance, critMultiplier: st.critMultiplier, energy: id === "osia" && previousOsia ? previousOsia.energy : 0, shield: 0 }; });
  }
  function monsterAbility(enemy, stage) {
    if (enemy.boss || stage < 11) return enemy;
    const roles = ["melee", "ranged", "healer"], role = roles[enemy.variant || 0];
    enemy.combatRole = role;
    enemy.monsterSkill = role === "melee" ? "결계 돌진" : role === "ranged" ? "마력 탄환" : "회복의 종";
    // Introduce charge and ranged skills in chapter 3; support casters join in 4.
    if (role === "healer" && stage < 16) return enemy;
    enemy.skillEvery = role === "healer" ? 8000 : 6000;
    enemy.nextSkillAt = enemy.skillEvery + (enemy.variant || 0) * 1000;
    enemy.skillPower = 1 + Math.min(1, Math.max(0, stage - 11) / 49) * .3;
    return enemy;
  }
  function bossAbility(enemy, strength = 1, name = "결계 붕괴") {
    Object.assign(enemy, { ability: name, aoeEvery: BOSS_RULES.aoeEvery, aoeMultiplier: BOSS_RULES.aoeMultiplier * strength,
      nextAbilityAt: BOSS_RULES.aoeEvery, rageEvery: BOSS_RULES.rageEvery, rageStep: BOSS_RULES.rageStep, warnedFor: 0 });
    return enemy;
  }
  function spawn(s, carry = false) {
    const boss = s.wave === 4, zone = chapter(s.stage);
    // Existing in-progress battles keep their saved stats. New late-game waves
    // accommodate six units, while the first ten areas retain their old curve.
    const scale = campaignScale(s.stage);
    const previousHoras = carry && s.battle?.phase === "victory" && s.battle.heroes.some(h => h.id === "horas" && h.hp > 0) ? s.battle.horas : null;
    const previousOsia = carry && s.battle?.phase === "victory" && s.battle.heroes.find(h => h.id === "osia" && h.hp > 0);
    s.battle = { id: s.seq + 1, stage: s.stage, wave: s.wave, boss, phase: "fight", wait: 0, tick: 0, elapsed: 0, buff: 0, lavaRescueUsed: false, damage: {}, synergies: partySynergies(s),
      heroes: freshHeroes(s, previousOsia),
      enemies: Array.from({ length: boss ? 1 : 3 }, (_, i) => {
        const variant = (s.stage + s.wave - 2 + i) % 3;
        const e = { id: `e${i}`, kind: zone, name: boss ? BOSSES[zone] : ENEMY_VARIANTS[zone][variant], ...(boss ? {} : { variant }), hp: Math.round((boss ? 155 : 30) * scale.hp), max: Math.round((boss ? 155 : 30) * scale.hp), atk: Math.round((boss ? 10 : 3) * scale.atk), boss };
        return boss && s.stage > 30 ? bossAbility(e, .65 + (s.stage - 30) / 30 * .35) : monsterAbility(e, s.stage);
      }),
    };
    if (s.team.includes("horas")) s.battle.horas = newHoras(previousHoras?.stacks || 0);
    event(s, "wave", { stage: s.stage, wave: s.wave, boss });
  }
  function spawnActivity(s) {
    const run = s.activities.run, tower = run.kind === "tower", stage = tower ? Math.min(MAX_STAGE, Math.ceil(run.floor / 5)) : DUNGEONS[run.kind].stages[run.tier - 1];
    const boss = !tower || run.floor % 5 === 0, scale = campaignScale(stage), weekly = run.kind === "weekly";
    const difficulty = weekly ? 1.25 : 1.05, hp = tower ? (80 + 20 * run.floor + 2 * run.floor * run.floor) * (boss ? 3.2 : 1) : 155 * scale.hp * difficulty;
    const atk = tower ? (5 + .9 * run.floor + .012 * run.floor * run.floor) * (boss ? 1.1 : 1) : 10 * scale.atk;
    const activity = { kind: run.kind, ...(tower ? { floor: run.floor } : { tier: run.tier }) };
    s.battle = { id: run.id, runId: run.id, stage, wave: 4, boss, activity, phase: "fight", wait: 0, tick: 0, elapsed: 0, buff: 0, lavaRescueUsed: false, damage: {}, synergies: partySynergies(s),
      heroes: freshHeroes(s), enemies: Array.from({ length: boss ? 1 : 3 }, (_, i) => {
        const e = { id: `e${i}`, kind: chapter(stage), name: tower ? boss ? "뫼비우스의 감시자" : "복도의 잔영" : weekly ? "봉인의 이사장" : "보급고의 수호자", ...(boss ? {} : { variant: (stage + 2 + i) % 3 }), hp: Math.round(hp), max: Math.round(hp), atk: Math.round(atk), boss };
        return boss && (tower || run.tier >= 3) ? bossAbility(e, 1, tower ? "뒤틀린 종소리" : weekly ? "봉인 해방" : "보급고 대격돌") : monsterAbility(e, stage);
      }) };
    if (s.team.includes("horas")) s.battle.horas = newHoras();
  }
  function settleActivity(s, won, reason) {
    const a = refreshActivities(s, s.at), run = a.run;
    if (!run || run.settled) return a.lastResult;
    run.settled = true;
    let reward = { gold: 0, gems: 0, xp: 0 }, refunded = false;
    const firstClear = won && run.kind === "tower" && run.floor > a.towerBest;
    if (won && (run.kind !== "tower" || firstClear)) reward = activityReward(run.kind, run.kind === "tower" ? run.floor : run.tier);
    if (firstClear) a.towerBest = run.floor;
    if (!won && run.kind !== "tower" && a[run.kind].period === run.period && a[run.kind].used > 0) { a[run.kind].used--; refunded = true; }
    s.gold += reward.gold; s.gems += reward.gems;
    if (won && (run.kind !== "tower" || firstClear)) winterDrop(s);
    if (reward.xp) for (const id of s.team) addUnitXp(s, id, reward.xp);
    a.lastResult = { runId: run.id, kind: run.kind, ...(run.kind === "tower" ? { floor: run.floor } : { tier: run.tier }), won, reason, firstClear, reward, refunded };
    s.battle.phase = won ? "victory" : "defeat"; s.battle.wait = 0; delete s.battle.osiaCast; delete s.battle.horasCast; delete s.battle.cinematic;
    event(s, "activity-result", { ...a.lastResult, kind: "activity-result", activityKind: run.kind }); log(s, `${DUNGEONS[run.kind].name} ${won ? "승리" : reason === "exit" ? "도전 종료" : "패배"}${refunded ? " · 열쇠 반환" : ""}`);
    return a.lastResult;
  }
  function create(now = Date.now(), seed = 123456789) {
    fail(Number.isFinite(now) && now >= 0, "잘못된 시간입니다.");
    const s = { version: 1, at: now, speed: 1, simCredit: 0, simTime: 0, seed: (seed >>> 0) || 123456789, seq: 0, events: [], logs: [],
      gold: 700, gems: 1800, commanderName: "새내기 단장", nameChanges: 0, winter: newWinter(), captain: { level: 1, xp: 0 }, units: {}, team: ["taeo", "harin", "sua"],
      stage: 1, wave: 1, best: 0, mode: "progress", kills: 0, pulls: 0, pity: 0, losses: 0,
      banners: { osia: { pity: 0, guaranteed: false }, lava: { pity: 0, guaranteed: false }, horas: { pity: 0, guaranteed: false } },
      offline: { seconds: 0, gold: 0, xp: 0, captainXp: 0 }, claimed: [], daily: -1, receipts: [], history: [], redeemedCodes: [], activities: newActivities(now) };
    for (const id of s.team) s.units[id] = { level: 1, xp: 0, stars: 0, shards: 0 };
    log(s, "방과 후, 학교용병단의 모험이 시작됩니다."); spawn(s); return s;
  }
  function validate(s) {
    return !!(s && s.version === 1 && Number.isFinite(s.at) && s.at >= 0 && Number.isInteger(s.seed) &&
      Number.isFinite(s.gold) && s.gold >= 0 && Number.isFinite(s.gems) && s.gems >= 0 &&
      (s.commanderName === undefined || typeof s.commanderName === "string" && normalizeCommanderName(s.commanderName) === s.commanderName) &&
      (s.nameChanges === undefined || Number.isSafeInteger(s.nameChanges) && s.nameChanges >= 0) && validWinter(s.winter) &&
      (s.speed === undefined || s.speed === 1 || s.speed === 1.5) &&
      (s.simCredit === undefined || Number.isFinite(s.simCredit) && s.simCredit >= 0 && s.simCredit < STEP_MS) &&
      (s.simTime === undefined || Number.isSafeInteger(s.simTime) && s.simTime >= 0) &&
      s.units && Object.keys(s.units).every(id => Object.hasOwn(BY_ID, id) && Number.isInteger(s.units[id].level) && s.units[id].level >= 1 && s.units[id].level <= MAX_LEVEL && Number.isFinite(s.units[id].xp) && Number.isInteger(s.units[id].stars) && s.units[id].stars >= 0 && s.units[id].stars <= 5 && Number.isFinite(s.units[id].shards)) &&
      Array.isArray(s.team) && s.team.length >= 1 && s.team.length <= MAX_TEAM && new Set(s.team).size === s.team.length && s.team.every(id => typeof id === "string" && Object.hasOwn(BY_ID, id) && Object.hasOwn(s.units, id)) &&
      Number.isInteger(s.stage) && s.stage >= 1 && s.stage <= MAX_STAGE && Number.isInteger(s.wave) && s.wave >= 1 && s.wave <= 4 &&
      Number.isInteger(s.best) && s.best >= 0 && s.best <= MAX_STAGE && Number.isInteger(s.pity) && s.pity >= 0 && s.pity < RECRUIT_PITY.hard &&
      (s.banners === undefined || s.banners && typeof s.banners === "object" && !Array.isArray(s.banners) && Object.keys(s.banners).every(id => Object.hasOwn(BANNERS, id)) && Object.values(s.banners).every(b => b && Number.isInteger(b.pity) && b.pity >= 0 && b.pity < RECRUIT_PITY.hard && typeof b.guaranteed === "boolean")) &&
      (s.units.osia?.nextSkill == null || Number.isInteger(s.units.osia.nextSkill) && s.units.osia.nextSkill >= 1 && s.units.osia.nextSkill <= 4) &&
      (s.units.lava?.nextSkill == null || s.units.lava.nextSkill === 1 || s.units.lava.nextSkill === 2) &&
      (s.units.lava?.basicHits == null || Number.isInteger(s.units.lava.basicHits) && s.units.lava.basicHits >= 0 && s.units.lava.basicHits < 10) &&
      s.battle && Array.isArray(s.battle.heroes) && s.battle.heroes.length >= 1 && s.battle.heroes.length <= MAX_TEAM && new Set(s.battle.heroes.map(h => h.id)).size === s.battle.heroes.length && Array.isArray(s.battle.enemies) && s.battle.heroes.every(h => Object.hasOwn(BY_ID, h.id) && Number.isFinite(h.hp) && (h.indomitableUntil === undefined || Number.isFinite(h.indomitableUntil) && h.indomitableUntil >= 0)) &&
      (s.battle.lavaRescueUsed === undefined || typeof s.battle.lavaRescueUsed === "boolean") &&
      (s.battle.cinematic === undefined || s.battle.cinematic && s.battle.cinematic.from === "osia" && [STEP_MS, OSIA_CINEMATIC_MS].includes(s.battle.cinematic.duration) && Number.isFinite(s.battle.cinematic.remaining) && s.battle.cinematic.remaining > 0 && s.battle.cinematic.remaining <= s.battle.cinematic.duration && Number.isInteger(s.battle.cinematic.resumeIndex) && s.battle.cinematic.resumeIndex >= 1 && s.battle.cinematic.resumeIndex <= s.battle.heroes.length) &&
      validHoras(s.battle) &&
      validActivities(s.activities) &&
      (s.battle.activity === undefined || s.activities?.run && s.battle.runId === s.activities.run.id && s.battle.activity.kind === s.activities.run.kind) &&
      (!s.activities?.run || s.battle.activity && (s.activities.run.settled ? s.activities.lastResult?.runId === s.activities.run.id && ["victory", "defeat"].includes(s.battle.phase) : s.battle.phase === "fight")) &&
      Array.isArray(s.events) && Array.isArray(s.logs) && Array.isArray(s.claimed) && Array.isArray(s.receipts) && Array.isArray(s.history) &&
      (s.redeemedCodes === undefined || Array.isArray(s.redeemedCodes) && s.redeemedCodes.length <= 1000 && new Set(s.redeemedCodes).size === s.redeemedCodes.length && s.redeemedCodes.every(code => typeof code === "string" && /^[A-Z0-9_]{1,40}$/.test(code))) &&
      s.offline && Number.isFinite(s.offline.seconds) && Number.isFinite(s.offline.gold) && Number.isFinite(s.offline.xp) &&
      (s.offline.captainXp === undefined || Number.isFinite(s.offline.captainXp) && s.offline.captainXp >= 0) &&
      s.captain && Number.isInteger(s.captain.level) && s.captain.level >= 1 && s.captain.level <= CAPTAIN_MAX_LEVEL && Number.isFinite(s.captain.xp) && s.captain.xp >= 0);
  }
  function newHoras(stacks = 0) {
    return { stacks, nextBasicAt: HORAS_RULES.basicMs, basicPose: 1, lastHitStackAt: -HORAS_RULES.hitStackMs, lastCastAt: -HORAS_RULES.minCastMs };
  }
  function horasInfo(s) {
    const b = s.battle, h = b?.heroes?.find(h => h.id === "horas"), progress = b?.horas || newHoras();
    const cast = b?.horasCast;
    return { stacks: progress.stacks, maxStacks: HORAS_RULES.maxStacks, casting: !!cast && !!h && h.hp > 0 && b.phase === "fight", cast: cast || null,
      nextBasicMs: Math.max(0, progress.nextBasicAt - (b?.elapsed || 0)), basicPose: progress.basicPose, skill: "벚꽃의식" };
  }
  function validHoras(b) {
    const h = b.horas, c = b.horasCast;
    const finite = value => Number.isFinite(value) && value >= 0;
    if (h !== undefined && (!h || !Number.isInteger(h.stacks) || h.stacks < 0 || h.stacks > HORAS_RULES.maxStacks || ![1, 2].includes(h.basicPose) || !finite(h.nextBasicAt) || !Number.isFinite(h.lastHitStackAt) || h.lastHitStackAt < -HORAS_RULES.hitStackMs || !Number.isFinite(h.lastCastAt) || h.lastCastAt < -HORAS_RULES.minCastMs)) return false;
    if (c !== undefined && (!c || !h || !Number.isSafeInteger(c.id) || c.id < 0 || !finite(c.began) || !finite(c.simBegan) || typeof c.targetId !== "string" || typeof c.missed !== "boolean" || c.impactDelay !== HORAS_RULES.impactDelay || c.mergeMs !== HORAS_RULES.mergeMs || !Array.isArray(c.targets) || !c.targets.length || c.targets.length > b.enemies.length || new Set(c.targets.map(t => t.id)).size !== c.targets.length || !c.targets.every(t => t && typeof t.id === "string" && finite(t.amount) && finite(t.splashAmount) && typeof t.critical === "boolean" && typeof t.primary === "boolean") || !c.targets.some(t => t.id === c.targetId && t.primary))) return false;
    return b.enemies.every(e => e.horasMark === undefined || e.horasMark && finite(e.horasMark.until) && Number.isSafeInteger(e.horasMark.castId) && e.horasMark.castId >= 0);
  }
  function horasStack(s, amount, source, to) {
    const b = s.battle;
    if (!b.heroes.some(h => h.id === "horas" && h.hp > 0)) return 0;
    const hs = b.horas ||= newHoras(), before = hs.stacks;
    hs.stacks = Math.min(HORAS_RULES.maxStacks, hs.stacks + amount);
    const gained = hs.stacks - before;
    if (gained) event(s, "horas-stack", { from: "horas", ...(to ? { to } : {}), stacks: hs.stacks, amount: gained, source, element: "blossom" });
    return gained;
  }
  function horasTurn(s, hero, enemies) {
    const b = s.battle, hs = b.horas ||= newHoras();
    // Her gauge is stacks, never the generic elapsed-time energy skill.
    hero.energy = 0;
    if (b.horasCast) return;
    if (hs.stacks >= HORAS_RULES.maxStacks && b.elapsed >= hs.lastCastAt + HORAS_RULES.minCastMs) {
      hs.stacks = 0; hs.lastCastAt = b.elapsed;
      hs.nextBasicAt = b.elapsed + HORAS_RULES.impactDelay + HORAS_RULES.basicMs;
      const target = enemies[0], missed = random(s) < HORAS_RULES.missChance;
      const start = event(s, "skill", { from: "horas", name: "벚꽃의식", role: "사수", element: "blossom" });
      b.horasCast = { id: start.seq, began: b.elapsed, simBegan: s.simTime, targetId: target.id, missed, mergeMs: HORAS_RULES.mergeMs, impactDelay: HORAS_RULES.impactDelay,
        targets: enemies.map(enemy => {
          const critical = random(s) < (hero.critChance ?? CRITICAL.chance);
          const power = hero.atk * (hero.damageMultiplier || 1) * (b.buff ? 1.3 : 1) * (.9 + random(s) * .2) * (critical ? hero.critMultiplier || CRITICAL.multiplier : 1);
          return { id: enemy.id, primary: enemy.id === target.id, critical, amount: Math.round(power * HORAS_RULES.primaryMultiplier), splashAmount: Math.round(power * HORAS_RULES.splashMultiplier) };
        }) };
      event(s, "horas-cast", { from: "horas", castId: start.seq, targetId: target.id, targets: [target.id], name: "벚꽃의식", mergeMs: HORAS_RULES.mergeMs, impactDelay: HORAS_RULES.impactDelay, element: "blossom" });
      return;
    }
    if (b.elapsed < hs.nextBasicAt) return;
    hs.nextBasicAt = b.elapsed + HORAS_RULES.basicMs;
    const target = enemies[0], pose = hs.basicPose;
    hs.basicPose = pose === 1 ? 2 : 1;
    event(s, "horas-basic", { from: "horas", to: target.id, pose, duration: HORAS_RULES.basicMotionMs, element: "blossom" });
    const critical = random(s) < (hero.critChance ?? CRITICAL.chance);
    hurt(s, "horas", target, hero.atk * HORAS_RULES.basicMultiplier * (hero.damageMultiplier || 1) * (b.buff ? 1.3 : 1) * (.9 + random(s) * .2) * (critical ? hero.critMultiplier || CRITICAL.multiplier : 1), "enemy", false, { critical, pose });
    horasStack(s, 1, "basic", target.id);
  }
  function horasStep(s) {
    const b = s.battle;
    for (const enemy of b.enemies) if (enemy.horasMark && b.elapsed >= enemy.horasMark.until) delete enemy.horasMark;
    const cast = b.horasCast;
    if (!cast) return false;
    if (!b.heroes.some(h => h.id === "horas" && h.hp > 0)) { delete b.horasCast; return false; }
    if (b.elapsed < cast.began + cast.impactDelay) return false;
    const previousIndex = b.enemies.findIndex(e => e.id === cast.targetId);
    const candidates = b.enemies.filter(e => e.hp > 0 && cast.targets.some(t => t.id === e.id));
    // If an ally defeated the original target during the ritual, reacquire the
    // nearest surviving saved target without rerolling damage, critical or miss.
    const target = candidates.find(e => e.id === cast.targetId) || candidates.reduce((a, e) => !a || Math.abs(b.enemies.indexOf(e) - previousIndex) < Math.abs(b.enemies.indexOf(a) - previousIndex) ? e : a, null);
    delete b.horasCast;
    if (!target) return true;
    const index = b.enemies.indexOf(target);
    const victims = candidates.filter(e => e === target || Math.abs(b.enemies.indexOf(e) - index) <= 1);
    event(s, "horas-impact", { from: "horas", castId: cast.id, targetId: target.id, missed: cast.missed, targets: cast.missed ? [] : victims.map(e => e.id), name: "벚꽃의식", element: "blossom" });
    if (cast.missed) { event(s, "miss", { from: "horas", to: target.id, castId: cast.id, element: "blossom" }); return true; }
    // At most one mark remains. Mark before damage so a killing blow refunds it.
    for (const enemy of b.enemies) delete enemy.horasMark;
    target.horasMark = { until: b.elapsed + HORAS_RULES.markMs, castId: cast.id };
    event(s, "horas-mark", { from: "horas", to: target.id, until: target.horasMark.until, duration: HORAS_RULES.markMs, castId: cast.id, element: "blossom" });
    // Main target first, then low-damage neighbours: each death is settled once.
    for (const enemy of [target, ...victims.filter(e => e !== target)]) {
      const hit = cast.targets.find(t => t.id === enemy.id), primary = enemy === target;
      hurt(s, "horas", enemy, primary ? hit.amount : hit.splashAmount, "enemy", true, { castId: cast.id, primary, critical: hit.critical });
    }
    return true;
  }
  function hurt(s, from, target, raw, side, skill = false, detail = {}) {
    if (target.hp <= 0) return 0;
    // Stun amplification is decided at the actual hit, not at cast start.
    const stunBonus = from === "horas" && side === "enemy" && s.battle.elapsed < (target.stunUntil || 0);
    let amount = Math.max(1, Math.round(raw * (stunBonus ? HORAS_RULES.stunMultiplier : 1)));
    if (stunBonus) detail = { ...detail, stunBonus: true };
    if (side === "hero") {
      amount = Math.max(1, Math.round(amount * (1 - target.defense)));
      const shield = Math.min(target.shield, amount); target.shield -= shield; amount -= shield;
      if (shield) event(s, "shield", { to: target.id, amount: shield });
      const b = s.battle;
      if (amount >= target.hp && !b.lavaRescueUsed && b.heroes.some(h => h.id === "lava" && h.hp > 0)) {
        b.lavaRescueUsed = true; target.indomitableUntil = b.elapsed + 2000;
        event(s, "rescue", { from: "lava", to: target.id, duration: 2000, until: target.indomitableUntil, element: "wind" });
      }
      if (b.elapsed < (target.indomitableUntil || 0)) amount = Math.min(amount, target.hp - 1);
    }
    amount = Math.min(target.hp, amount); target.hp -= amount;
    if (side === "enemy") { meter(s, from, "damage", amount); if (detail.critical && amount > 0) meter(s, from, "criticals", 1); }
    else meter(s, target.id, "taken", amount);
    event(s, "hit", { from, to: target.id, side, amount, skill, critical: !!detail.critical, impact: detail.critical ? "critical" : skill ? "heavy" : "normal", ...(BY_ID[from]?.element ? { element: BY_ID[from].element } : {}), ...detail });
    if (side === "hero" && target.id === "horas" && target.hp > 0) {
      const hs = s.battle.horas ||= newHoras();
      if (s.battle.elapsed >= hs.lastHitStackAt + HORAS_RULES.hitStackMs) {
        hs.lastHitStackAt = s.battle.elapsed; horasStack(s, 1, "hit", from);
      }
    }
    if (target.hp <= 0 && side === "enemy") {
      s.kills++;
      if (target.horasMark && s.battle.elapsed < target.horasMark.until) {
        delete target.horasMark;
        const credited = horasStack(s, HORAS_RULES.refundStacks, "mark", target.id);
        if (credited) event(s, "horas-refund", { from: "horas", to: target.id, amount: credited, stacks: s.battle.horas.stacks, element: "blossom" });
      }
    }
    return amount;
  }
  function lowestAlive(b) {
    return b.heroes.filter(h => h.hp > 0).reduce((lowest, hero) => !lowest || hero.hp / hero.max < lowest.hp / lowest.max ? hero : lowest, null);
  }
  function lavaGuard(s, hero, target, raw, passive) {
    const amount = Math.max(0, Math.min(Math.round(raw), Math.round(target.max * .6) - target.shield));
    target.shield += amount;
    if (amount) event(s, "guard", { from: hero.id, to: target.id, amount, shield: target.shield, passive, element: "wind" });
  }
  function lavaHeal(s, hero, target, raw, stage) {
    const amount = Math.min(target.max - target.hp, Math.round(raw * (hero.healMultiplier || 1))); target.hp += amount;
    meter(s, hero.id, "healing", amount);
    if (amount) event(s, "heal", { from: hero.id, to: target.id, amount, stage, element: "wind" });
  }
  function victory(s) {
    if (s.battle.activity) { settleActivity(s, true, "victory"); return; }
    const b = s.battle, gold = (12 + s.stage * 4) * (b.boss ? 3 : 1), xp = scaledXp((8 + s.stage * 2) * (b.boss ? 2 : 1), PROGRESSION.battleXp);
    s.gold += gold; for (const id of s.team) addUnitXp(s, id, xp);
    captainXp(s, scaledXp(4 + Math.floor(s.stage / 2), PROGRESSION.captainBattleXp));
    event(s, "reward", { gold, xp, boss: b.boss });
    winterDrop(s);
    if (b.boss) {
      s.losses = 0;
      if (s.stage > s.best) { s.best = s.stage; s.gems += 60; event(s, "clear", { stage: s.stage, gems: 60 }); log(s, `${stageName(s.stage)} 클리어! 보석 +60`); }
      if (s.mode === "progress" && s.stage < MAX_STAGE) s.stage++;
      if (s.stage === MAX_STAGE && s.best === MAX_STAGE) s.mode = "farm";
      s.wave = 1;
    } else s.wave++;
    b.phase = "victory"; b.wait = b.boss ? 4 : 2; delete b.osiaCast; delete b.horasCast; delete b.cinematic;
  }
  function osiaStep(s) {
    const b = s.battle, cast = b.osiaCast;
    if (!cast) return false;
    if (!b.heroes.some(h => h.id === "osia" && h.hp > 0)) { delete b.osiaCast; return false; }
    const step = OSIA_SKILLS[cast.stage - 1];
    if (b.elapsed < cast.began + step.impactDelay) return false;
    const targets = b.enemies.filter(e => e.hp > 0 && cast.targets.some(t => t.id === e.id));
    event(s, "skill-impact", { from: "osia", castId: cast.id, stage: step.stage, name: step.name, element: "water", targets: targets.map(e => e.id) });
    for (const enemy of targets) {
      const hit = cast.targets.find(t => t.id === enemy.id);
      hurt(s, "osia", enemy, hit.amount, "enemy", true, { castId: cast.id, stage: step.stage, critical: !!hit.critical });
      if (step.stunMs && enemy.hp > 0) {
        enemy.stunUntil = Math.max(enemy.stunUntil || 0, b.elapsed + step.stunMs);
        event(s, "stun", { from: "osia", to: enemy.id, duration: step.stunMs, until: enemy.stunUntil });
      }
    }
    delete b.osiaCast;
    return true;
  }
  function tick(s) {
    const b = s.battle;
    // Old saves have no half-second clock. Keep their existing attack cadence.
    b.elapsed ??= b.tick * 1000; b.id ??= s.seq;
    if (b.activity && s.activities?.run?.settled) return;
    if (b.phase !== "fight") { if ((b.wait -= STEP_MS / 1000) <= 0) spawn(s, true); return; }
    if (b.cinematic) {
      const cutin = b.cinematic;
      if (!b.heroes.some(h => h.id === "osia" && h.hp > 0)) { delete b.osiaCast; cutin.remaining = 0; }
      else cutin.remaining -= STEP_MS;
      if (cutin.remaining <= 0) {
        event(s, "cinematic-end", { from: "osia", castId: cutin.castId }); delete b.cinematic;
        // Resume the interrupted turn instead of costing later allies an attack.
        combatTurn(s, cutin.resumeIndex ?? b.heroes.length, false);
      }
      // All combat timers, including enemy stun, stay still during the cut-in.
      return;
    }
    b.elapsed += STEP_MS;
    if (b.activity && b.heroes.every(h => h.hp <= 0)) { settleActivity(s, false, "defeat"); return; }
    const osiaImpact = osiaStep(s);
    horasStep(s);
    if (b.enemies.every(e => e.hp <= 0)) { victory(s); return; }
    for (const enemy of b.enemies) {
      if (enemy.hp <= 0 || !enemy.ability || enemy.warnedFor === enemy.nextAbilityAt || b.elapsed < enemy.nextAbilityAt - 1000) continue;
      enemy.warnedFor = enemy.nextAbilityAt;
      event(s, "boss-warning", { from: enemy.id, name: enemy.ability, targets: b.heroes.filter(h => h.hp > 0).map(h => h.id), atElapsed: enemy.nextAbilityAt, duration: Math.max(0, enemy.nextAbilityAt - b.elapsed) });
    }
    if (b.elapsed % 1000) return;
    b.tick = b.elapsed / 1000;
    if (b.buff > 0) b.buff--;
    combatTurn(s, 0, osiaImpact);
  }
  function combatTurn(s, startIndex, osiaImpact) {
    const b = s.battle;
    for (let index = startIndex; index < b.heroes.length; index++) {
      const hero = b.heroes[index]; if (hero.hp <= 0) continue;
      const enemies = b.enemies.filter(e => e.hp > 0); if (!enemies.length) break;
      const def = BY_ID[hero.id];
      if (hero.id === "horas") { horasTurn(s, hero, enemies); continue; }
      hero.energy++;
      if (hero.id === "osia" && (b.osiaCast || osiaImpact)) continue;
      const skill = hero.energy >= def.cooldown;
      if (skill) { hero.energy = 0; event(s, "skill", { from: hero.id, name: hero.id === "osia" ? osiaSkill(s).name : hero.id === "lava" ? lavaSkill(s).name : def.skill, role: def.role, ...(def.element ? { element: def.element } : {}) }); }
      if (skill && hero.id === "osia") {
        const step = osiaSkill(s);
        const cinematicDuration = step.stage === 4 ? OSIA_CINEMATIC_MS : 0;
        b.osiaCast = { id: s.seq, began: b.elapsed, simBegan: s.simTime, stage: step.stage, cinematicDuration, targets: enemies.map(e => {
          const critical = random(s) < (hero.critChance ?? CRITICAL.chance);
          return { id: e.id, critical, amount: Math.round(hero.atk * def.skillMultiplier * (hero.damageMultiplier || 1) * (b.buff ? 1.3 : 1) * (.9 + random(s) * .2) * (critical ? hero.critMultiplier || CRITICAL.multiplier : 1)) };
        }) };
        s.units.osia.nextSkill = step.stage % 4 + 1;
        event(s, "skill-stage", { from: "osia", castId: b.osiaCast.id, stage: step.stage, name: step.name, impactDelay: step.impactDelay, cinematicDuration, element: "water", targets: enemies.map(e => e.id) });
        if (cinematicDuration) {
          b.cinematic = { from: "osia", castId: b.osiaCast.id, duration: cinematicDuration, remaining: cinematicDuration, resumeIndex: index + 1 };
          event(s, "cinematic", { from: "osia", castId: b.osiaCast.id, stage: 4, duration: cinematicDuration });
          return;
        }
        continue;
      }
      if (skill && hero.id === "lava") {
        const step = lavaSkill(s), targets = step.stage === 1 ? b.heroes.filter(h => h.hp > 0) : [lowestAlive(b)];
        s.units.lava.nextSkill = step.stage === 1 ? 2 : 1;
        event(s, "lava-skill", { from: hero.id, stage: step.stage, name: step.name, element: "wind", targets: targets.map(h => h.id) });
        for (const friend of targets) {
          lavaHeal(s, hero, friend, hero.atk * step.healMultiplier, step.stage);
          if (step.shieldMultiplier) lavaGuard(s, hero, friend, hero.atk * step.shieldMultiplier, "fan");
        }
        continue;
      }
      let target = enemies[0], multiplier = skill ? 3 : 1;
      if (skill && def.role === "치유") {
        for (const friend of b.heroes.filter(h => h.hp > 0)) {
          const heal = Math.min(friend.max - friend.hp, Math.round(hero.atk * 2.2 * (hero.healMultiplier || 1))); friend.hp += heal;
          meter(s, hero.id, "healing", heal);
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
        const critical = random(s) < (hero.critChance ?? CRITICAL.chance);
        const dealt = hurt(s, hero.id, enemy, hero.atk * multiplier * (hero.damageMultiplier || 1) * (b.buff ? 1.3 : 1) * (.9 + random(s) * .2) * (critical ? hero.critMultiplier || CRITICAL.multiplier : 1), "enemy", skill, { critical });
        if (hero.id === "lava" && !skill && dealt > 0) {
          const unit = s.units.lava; unit.basicHits = (unit.basicHits || 0) + 1;
          if (unit.basicHits >= 10) { unit.basicHits = 0; const friend = lowestAlive(b); if (friend) lavaGuard(s, hero, friend, hero.atk * 2 + friend.max * .08, "ten-hits"); }
        }
      }
    }
    if (b.enemies.every(e => e.hp <= 0)) { victory(s); return; }
    for (const enemy of b.enemies.filter(e => e.hp > 0)) {
      if (b.elapsed < (enemy.stunUntil || 0)) continue;
      const alive = b.heroes.filter(h => h.hp > 0); if (!alive.length) break;
      const rage = 1 + Math.floor(b.elapsed / (enemy.rageEvery || Infinity)) * (enemy.rageStep || 0);
      if (enemy.ability && b.elapsed >= enemy.nextAbilityAt) {
        event(s, "boss-skill", { from: enemy.id, name: enemy.ability, targets: alive.map(h => h.id), rage, atElapsed: b.elapsed });
        for (const target of alive) hurt(s, enemy.id, target, enemy.atk * enemy.aoeMultiplier * rage * (.9 + random(s) * .2), "hero", true, { bossSkill: true });
        enemy.nextAbilityAt = b.elapsed + enemy.aoeEvery;
      } else if (enemy.monsterSkill && Number.isFinite(enemy.nextSkillAt) && b.elapsed >= enemy.nextSkillAt) {
        const role = enemy.combatRole;
        if (role === "healer") {
          const friend = b.enemies.filter(e => e.hp > 0).reduce((a, e) => !a || e.hp / e.max < a.hp / a.max ? e : a, null);
          const amount = Math.max(0, Math.min(friend.max - friend.hp, Math.round((enemy.atk * 2 + friend.max * .025) * enemy.skillPower)));
          event(s, "monster-skill", { from: enemy.id, name: enemy.monsterSkill, role, targets: [friend.id], element: "healing" });
          friend.hp += amount;
          if (amount) event(s, "enemy-heal", { from: enemy.id, to: friend.id, side: "enemy", amount });
        } else {
          const back = b.heroes.slice(3).filter(h => h.hp > 0), pool = role === "ranged" && back.length ? back : alive;
          const target = role === "ranged" ? pool.reduce((a, h) => h.hp / h.max < a.hp / a.max ? h : a) : alive[0];
          event(s, "monster-skill", { from: enemy.id, name: enemy.monsterSkill, role, targets: [target.id], element: role === "ranged" ? "arcane" : "physical" });
          hurt(s, enemy.id, target, enemy.atk * (role === "melee" ? 1.8 : 1.45) * enemy.skillPower, "hero", true, { monsterSkill: true });
        }
        enemy.nextSkillAt = b.elapsed + enemy.skillEvery;
      } else {
        let target;
        if (b.heroes.length <= 3) target = random(s) < .75 ? alive[0] : alive[Math.floor(random(s) * alive.length)];
        else {
          const front = b.heroes.slice(0, 3).filter(h => h.hp > 0), back = b.heroes.slice(3).filter(h => h.hp > 0);
          const pool = front.length && (!back.length || random(s) < .8) ? front : back.length ? back : alive;
          const weights = pool.map(h => BY_ID[h.id].role === "수호" ? 3 : 1); let pick = random(s) * weights.reduce((a, v) => a + v, 0);
          target = pool[pool.length - 1]; for (let i = 0; i < pool.length; i++) { pick -= weights[i]; if (pick < 0) { target = pool[i]; break; } }
        }
        hurt(s, enemy.id, target, enemy.atk * rage * (.85 + random(s) * .3), "hero");
      }
    }
    if (b.heroes.every(h => h.hp <= 0) || b.tick >= 120) {
      if (b.activity) { settleActivity(s, false, b.tick >= 120 ? "timeout" : "defeat"); return; }
      b.phase = "defeat"; b.wait = 5; s.wave = 1; s.losses++; delete b.osiaCast; delete b.horasCast; delete b.cinematic;
      event(s, "defeat", { boss: b.boss, stage: b.stage, reason: b.tick >= 120 ? "timeout" : "defeat", report: damageReport(s) }); log(s, "잠시 쉬어 갑니다. 용병을 훈련하거나 편성을 바꿔보세요.");
      if (s.losses >= 3 && s.best >= 1) { s.mode = "farm"; s.stage = s.best; s.losses = 0; log(s, "클리어한 지역에서 자동으로 성장합니다. 도전 버튼으로 다시 출발하세요."); }
    }
  }
  function advance(s, now) {
    s.speed ??= 1; s.simCredit ??= 0; s.simTime ??= 0;
    s.commanderName ??= "새내기 단장";
    // Preserve the captain share already earned under the previous bank rate.
    s.offline.captainXp ??= Math.floor(s.offline.xp / 4);
    refreshActivities(s, Number.isFinite(now) && now >= 0 ? Math.max(now, s.at) : s.at);
    s.banners ??= { osia: bannerState(s, "osia"), lava: bannerState(s, "lava") };
    s.banners.osia ??= { pity: s.pity, guaranteed: false }; s.banners.lava ??= { pity: 0, guaranteed: false }; s.banners.horas ??= { pity: 0, guaranteed: false };
    s.pity = s.banners.osia.pity;
    if (s.team.includes("horas")) s.battle.horas ??= newHoras();
    if (s.units.osia) s.units.osia.nextSkill ??= 1;
    if (s.units.lava) { s.units.lava.nextSkill ??= 1; s.units.lava.basicHits ??= 0; }
    // A v4 simultaneous combo must not continue into the new per-cooldown cycle.
    if (s.battle.osiaCast && !s.battle.osiaCast.stage) delete s.battle.osiaCast;
    if (!Number.isFinite(now) || now <= s.at) return { seconds: 0, offline: false };
    const seconds = Math.floor((now - s.at) / 1000);
    const steps = Math.floor((now - s.at) / STEP_MS);
    if (!steps) return { seconds: 0, offline: false };
    if (seconds > 90) {
      const add = Math.min(seconds, Math.max(0, OFFLINE_CAP - s.offline.seconds)), rate = rates(s);
      const xp = Math.floor(rate.xp * add / 60);
      s.offline.seconds += add; s.offline.gold += Math.floor(rate.gold * add / 60); s.offline.xp += xp;
      s.offline.captainXp += xp / PROGRESSION.captainOfflineDivisor;
      s.at += seconds * 1000;
      if (add) event(s, "offline", { seconds: add });
      return { seconds: add, offline: true };
    }
    for (let i = 0; i < steps; i++) consumeRealTime(s, STEP_MS);
    return { seconds: steps * STEP_MS / 1000, offline: false };
  }
  function consumeRealTime(s, milliseconds) {
    s.at += milliseconds; s.simCredit += milliseconds * s.speed;
    while (s.simCredit >= STEP_MS) {
      s.simCredit -= STEP_MS; s.simTime += STEP_MS; tick(s);
    }
  }
  function questValue(s, quest) { return quest.metric === "collection" ? Object.keys(s.units).length : quest.metric === "captain" ? s.captain.level : s[quest.metric]; }
  function recruit(s, count, rng, banner = "osia", now = Date.now()) {
    fail(count === 1 || count === 10, "1회 또는 10회 모집할 수 있습니다.");
    fail(typeof banner === "string" && Object.hasOwn(BANNERS, banner), "모집할 배너를 선택하세요.");
    fail(bannerAvailable(banner, now), "이 모집 배너는 종료되었습니다.");
    const cost = count === 10 ? 900 : 100; fail(s.gems >= cost, "보석이 부족합니다.");
    const progress = bannerState(s, banner), featured = BANNERS[banner].featured;
    const otherSSR = STANDARD_SSR.filter(id => id !== featured);
    const nextBanners = Object.fromEntries(Object.keys(BANNERS).map(id => [id, bannerState(s, id)]));
    const results = []; let premium = false;
    for (let i = 0; i < count; i++) {
      const odds = recruitRates(progress.pity, banner), roll = rng();
      const ur = odds.UR || 0;
      let rarity = roll < ur ? "UR" : roll < Math.round((ur + odds.SSR) * 1e9) / 1e9 ? "SSR" : roll < Math.round((ur + odds.SSR + odds.SR) * 1e9) / 1e9 ? "SR" : "R";
      const pity = progress.pity >= RECRUIT_PITY.hard - 1;
      if (pity) rarity = banner === "horas" ? "UR" : "SSR";
      if (count === 10 && i === 9 && !premium && rarity === "R") rarity = "SR";
      if (rarity !== "R") premium = true;
      // One grade roll and one character roll per slot, including a guaranteed
      // featured SSR, keeps replay and ten-pull sequencing deterministic.
      const pick = Math.max(0, Math.min(1 - Number.EPSILON, rng()));
      const guaranteed = banner === "horas" ? rarity === "UR" && pity : rarity === "SSR" && progress.guaranteed;
      let h;
      if (rarity === "UR") h = BY_ID.horas;
      else if (rarity === "SSR" && banner === "horas") h = BY_ID[STANDARD_SSR[Math.min(STANDARD_SSR.length - 1, Math.floor(pick * STANDARD_SSR.length))]];
      else if (rarity === "SSR") {
        const chosen = guaranteed || pick < .5 ? featured : otherSSR[Math.min(otherSSR.length - 1, Math.floor((pick - .5) * 2 * otherSSR.length))];
        h = BY_ID[chosen]; progress.guaranteed = chosen !== featured;
      } else {
        const candidates = HEROES.filter(hero => hero.rarity === rarity);
        h = candidates[Math.min(candidates.length - 1, Math.floor(pick * candidates.length))];
      }
      progress.pity = rarity === (banner === "horas" ? "UR" : "SSR") ? 0 : progress.pity + 1;
      const fresh = !s.units[h.id], shards = rarity === "UR" ? 30 : rarity === "SSR" ? 20 : rarity === "SR" ? 10 : 5;
      if (fresh) s.units[h.id] = { level: 1, xp: 0, stars: 0, shards: 0 }; else s.units[h.id].shards += shards;
      results.push({ id: h.id, fresh, shards: fresh ? 0 : shards, pity, ssrChance: odds.SSR, ...(banner === "horas" ? { urChance: odds.UR } : {}), banner, featured: h.id === featured, guaranteed, lostFeatured: banner !== "horas" && rarity === "SSR" && h.id !== featured });
    }
    nextBanners[banner] = progress; s.banners = nextBanners; s.pity = nextBanners.osia.pity;
    s.gems -= cost; s.pulls += count; s.history = results.concat(s.history).slice(0, 30);
    event(s, "recruit", { count, banner, ssr: results.some(r => BY_ID[r.id].rarity === "SSR"), ur: results.some(r => BY_ID[r.id].rarity === "UR") });
    log(s, `${BANNERS[banner].name} · ${count}명의 지원서가 도착했습니다.`); return { kind: "recruit", results, cost, banner };
  }
  function action(s, input, now = Date.now(), rng = Math.random) {
    fail(input && typeof input === "object" && !Array.isArray(input), "잘못된 행동입니다.");
    const kind = input.kind;
    if (kind === "rename") {
      const name = normalizeCommanderName(input.name);
      fail(name !== null, "단장 이름은 문자·숫자·공백·_·-를 사용해 2~12자로 입력하세요.");
      const info = commanderNameInfo(s);
      fail(name !== s.commanderName, "이미 사용 중인 이름입니다.");
      fail(s.gems >= info.cost, "이름 변경에는 보석 3,000개가 필요합니다.");
      s.gems -= info.cost; s.commanderName = name; s.nameChanges = info.changes + 1;
      return { kind, name, cost: info.cost };
    }
    if (kind === "winter-exchange") {
      const info = winterInfo(s, now);
      fail(info.active, "겨울 이벤트 기간이 아닙니다.");
      fail(typeof input.item === "string" && Object.hasOwn(WINTER_EVENT.shop, input.item), "교환할 보상을 선택하세요.");
      const item = info.items.find(item => item.id === input.item);
      fail(item.remaining > 0, "이 보상은 모두 교환했어요.");
      fail(info.snowflakes >= item.cost, "눈송이가 부족합니다.");
      const w = s.winter ||= newWinter();
      w.snowflakes -= item.cost; w.exchanges[item.id]++;
      s.gold += item.gold; s.gems += item.gems;
      event(s, "winter-exchange", { item: item.id, cost: item.cost, gold: item.gold, gems: item.gems });
      return { kind, item: item.id, cost: item.cost, gold: item.gold, gems: item.gems, remaining: item.remaining - 1 };
    }
    if (kind === "activity") {
      fail(Number.isFinite(now) && now >= 0, "잘못된 시간입니다.");
      fail(typeof input.mode === "string" && Object.hasOwn(DUNGEONS, input.mode), "도전할 던전을 선택하세요.");
      fail(!s.activities?.run || s.activities.run.settled, "진행 중인 던전을 마치거나 먼저 포기하세요.");
      const mode = input.mode, info = activityInfo(s, now);
      if (mode === "tower") {
        fail(Number.isInteger(input.floor) && input.floor >= 1 && input.floor <= Math.min(MAX_TOWER_FLOOR, info.tower.best + 1), "아직 열리지 않은 층입니다.");
      } else {
        fail(Number.isInteger(input.tier) && input.tier >= 1 && input.tier <= 5, "던전 단계를 선택하세요.");
        fail(info[mode].tiers[input.tier - 1].unlocked, "모험 지역을 더 클리어하면 열립니다.");
        fail(info[mode].keys > 0, "열쇠가 부족합니다. 다음 충전을 기다려 주세요.");
      }
      // Every check above precedes mutation, including key consumption.
      const a = refreshActivities(s, now);
      const run = { id: s.seq + 1, kind: mode, settled: false, ...(mode === "tower" ? { floor: input.floor } : { tier: input.tier, period: a[mode].period }) };
      if (mode !== "tower") a[mode].used++;
      a.run = run; a.lastResult = null; spawnActivity(s);
      event(s, "activity-start", { runId: run.id, ...s.battle.activity, kind: "activity-start", activityKind: mode }); log(s, `${DUNGEONS[mode].name} · ${mode === "tower" ? `${run.floor}층` : `${run.tier}단계`} 도전`);
      return { kind, run: clone(run) };
    }
    if (kind === "activity-exit") {
      fail(Number.isFinite(now) && now >= 0, "잘못된 시간입니다.");
      fail(s.activities?.run, "진행 중인 던전이 없습니다.");
      refreshActivities(s, now);
      if (!s.activities.run.settled) settleActivity(s, false, "exit");
      const result = clone(s.activities.lastResult); s.activities.run = null; spawn(s);
      return { kind, result };
    }
    if (kind === "speed") {
      fail(input.speed === 1 || input.speed === 1.5, "전투 속도는 1배 또는 1.5배를 선택하세요.");
      fail(Number.isFinite(now) && now >= 0, "잘못된 시간입니다.");
      advance(s, now);
      // Fractional real time before the toggle still belongs to the old speed.
      if (now > s.at) consumeRealTime(s, now - s.at);
      s.speed = input.speed;
      return { kind, speed: s.speed };
    }
    if (kind === "redeem") {
      fail(typeof input.code === "string" && input.code.length <= 128, "코드를 확인해 주세요.");
      const code = input.code.trim().toUpperCase();
      fail(code.length > 0, "코드를 입력하세요.");
      fail(/^[A-Z0-9_]{1,40}$/.test(code) && Object.hasOwn(COUPONS, code), "사용할 수 없는 코드입니다.");
      const coupon = COUPONS[code], redeemed = s.redeemedCodes || [];
      fail(!redeemed.includes(code), "이미 사용한 코드입니다.");
      fail(Number.isFinite(now) && now >= 0 && (coupon.expiresAt === null || now < coupon.expiresAt), "사용 기간이 지난 코드입니다.");
      // Client-supplied rewards and timestamps never participate in redemption.
      s.redeemedCodes = [...redeemed, code]; s.gold += coupon.gold; s.gems += coupon.gems;
      log(s, `CODE ${code} · 보석 +${coupon.gems} · 골드 +${coupon.gold}`);
      return { kind, code, gold: coupon.gold, gems: coupon.gems, expiresAt: coupon.expiresAt };
    }
    if (kind === "recruit") return recruit(s, input.count, rng, input.banner === undefined ? "osia" : input.banner, now);
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
      fail(!s.activities?.run || s.activities.run.settled, "진행 중인 던전을 마치거나 먼저 포기하세요.");
      fail(Array.isArray(input.team) && input.team.length >= 1 && input.team.length <= MAX_TEAM && new Set(input.team).size === input.team.length && input.team.every(id => typeof id === "string" && BY_ID[id] && Object.hasOwn(s.units, id)), "보유한 서로 다른 용병 1~6명을 편성하세요.");
      fail(input.team.length !== s.team.length || input.team.some((id, i) => s.team[i] !== id), "이미 같은 편성입니다.");
      if (s.activities?.run?.settled) s.activities.run = null;
      s.team = [...input.team]; spawn(s); log(s, "새로운 편성으로 전투를 시작합니다."); return { kind };
    }
    if (kind === "stage") {
      fail(!s.activities?.run || s.activities.run.settled, "진행 중인 던전을 마치거나 먼저 포기하세요.");
      fail(Number.isInteger(input.stage) && input.stage >= 1 && input.stage <= Math.min(MAX_STAGE, s.best + 1), "아직 열리지 않은 지역입니다.");
      fail(["progress", "farm"].includes(input.mode), "도전 또는 반복을 선택하세요.");
      if (s.activities?.run?.settled) s.activities.run = null;
      s.stage = input.stage; s.wave = 1; s.mode = input.mode; s.losses = 0; spawn(s); return { kind };
    }
    if (kind === "offline") {
      fail(s.offline.seconds > 0, "이미 보상을 받았습니다."); const reward = { ...s.offline };
      const earnedCaptainXp = Math.floor(reward.captainXp ?? reward.xp / 4);
      s.offline = { seconds: 0, gold: 0, xp: 0, captainXp: 0 }; s.gold += reward.gold;
      for (const id of s.team) addUnitXp(s, id, reward.xp); captainXp(s, earnedCaptainXp);
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
  return { HEROES, BY_ID, CHAPTERS, ENEMIES, ENEMY_VARIANTS, BOSSES, QUESTS, MAX_STAGE, MAX_LEVEL, CAPTAIN_MAX_LEVEL, MAX_TEAM, MAX_TOWER_FLOOR, OFFLINE_CAP, CATALOG_VERSION, DUNGEONS, BOSS_RULES, PROGRESSION, CRITICAL, PARTY_SYNERGIES, WINTER_EVENT, winterInfo, partySynergies, damageReport, commanderNameInfo, normalizeCommanderName, activityInfo, activityReward, campaignScale, OSIA_SKILLS, OSIA_CINEMATIC_MS, osiaSkill, LAVA_SKILLS, lavaSkill, HORAS_RULES, horasInfo, UR_RECRUIT_RATES, RECRUIT_RATES, RECRUIT_PITY, COUPONS, BANNERS, STANDARD_SSR, bannerState, bannerAvailable, bannerHeroRates, recruitRates, create, validate, advance, action, stats, stageName, chapter, rates, questValue, needXp, captainNeed, trainingCost, awakeningCost, power, day, week, clone, view };
});
