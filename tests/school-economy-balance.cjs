// Reproducible campaign income sweep. Run: node tests/school-economy-balance.cjs [report.json]
// This measures active 1× combat, including encounter waits and failed fights.
// Repeat quests are amortized; daily/one-time/offline rewards are reported separately.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const G = require('../school/engine.js');
const NOW = Date.UTC(2026, 10, 18), MINUTES = 10, SEEDS = 5;
const TEAM = ['taeo', 'geonu', 'doyoon', 'ian', 'osia', 'lava'];
const PROFILES = [
  { name: 'beginner', level: 5, stars: 0, best: 5, captain: 1 },
  { name: 'low', level: 20, stars: 0, best: 20, captain: 10 },
  { name: 'mid', level: 60, stars: 2, best: 40, captain: 35 },
  { name: 'high', level: 100, stars: 5, best: 60, captain: 100 },
  { name: 'high-UR', level: 100, stars: 5, best: 60, captain: 100, team: TEAM.map(id => id === 'ian' ? 'horas' : id) },
];

// Freeze the previous economic rules while sharing the same combat code. This
// avoids checking in an entire obsolete engine or relying on Git history in CI.
// Returning eligible=true restores old quest/winter farming and unchanged XP.
const oldRules = `
  campaignRewardInfo = function(s, stage = s.battle?.stage ?? s.stage, boss = !!s.battle?.boss) {
    const baseGold = (12 + stage * 4) * (boss ? 3 : 1);
    return { stage, best:s.best, gap:Math.max(0,s.best-stage), eligible:true,
      multiplier:1, stageBonus:1, baseGold, gold:baseGold,
      xp:scaledXp((8 + stage * 2) * (boss ? 2 : 1),PROGRESSION.battleXp),
      captainXp:scaledXp(4 + Math.floor(stage/2),PROGRESSION.captainBattleXp) };
  };
`;
const source = fs.readFileSync(require.resolve('../school/engine.js'), 'utf8');
const marker = '  return { HEROES,';
assert.equal(source.split(marker).length, 2, 'baseline hook must be unambiguous');
const sandbox = { module: { exports: {} } };
vm.runInNewContext(source.replace(marker, oldRules + marker), sandbox, { filename: 'school-economy-baseline.js' });
const BEFORE = sandbox.module.exports;
const progressGold = (counts, kind, integer = false) => G.PROGRESS_QUESTS
  .filter(q => q.category === kind)
  .reduce((sum, q) => sum + q.gold * (kind === 'daily' ? +(counts[q.metric] >= q.goal) : integer ? Math.floor(counts[q.metric] / q.goal) : counts[q.metric] / q.goal), 0);
const progressGems = counts => G.PROGRESS_QUESTS.filter(q => q.category === 'repeat')
  .reduce((sum, q) => sum + q.gems * counts[q.metric] / q.goal, 0);

function saved(api, profile, stage, seed) {
  const s = api.create(NOW, seed), team = profile.team || TEAM;
  for (const id of team) s.units[id] = { level: profile.level, stars: profile.stars, xp: 0, shards: 0 };
  s.captain = { level: profile.captain, xp: 0 }; s.best = profile.best;
  api.action(s, { kind: 'team', team }, NOW);
  api.action(s, { kind: 'stage', stage, mode: 'farm' }, NOW);
  return s;
}

function sample(api, profile, stage, seed, resetEveryWave = false) {
  const s = saved(api, profile, stage, seed);
  let waveGold = 0, captainGold = 0, captainGems = 0, earnedCaptainXp = 0;
  let wins = 0, bosses = 0, defeats = 0, firstCycleSeconds = null;
  const counters = { kills: 0, waves: 0, bosses: 0 };
  for (let step = 0; step < MINUTES * 120; step++) {
    const seq = s.seq, reward = api.campaignRewardInfo(s);
    api.advance(s, s.at + 500);
    for (const event of s.events.filter(event => event.seq > seq)) {
      if (event.kind === 'reward') {
        waveGold += event.gold; earnedCaptainXp += reward.captainXp; wins++;
        if (event.boss) { bosses++; firstCycleSeconds ??= (s.at - NOW) / 1000; }
      }
      if (event.kind === 'captain') { captainGold += event.gold; captainGems += event.gems; }
      if (event.kind === 'defeat') defeats++;
    }
    if (s.stage !== stage) break; // Do not silently measure the fallback stage.
    if (resetEveryWave && s.battle.phase === 'victory') api.action(s, { kind: 'stage', stage, mode: 'farm' }, s.at);
  }
  for (const metric of Object.keys(counters)) counters[metric] = s.quests.repeat[metric];
  const minutes = (s.at - NOW) / 60000;
  const repeatGold = progressGold(counters, 'repeat');
  const repeatClaimableGold = progressGold(counters, 'repeat', true);
  const nextCaptainGoldPerXp = api.captainReward(profile.captain + 1).gold / api.captainNeed(profile.captain);
  const futureCaptainGoldPerMinute = earnedCaptainXp / minutes * nextCaptainGoldPerXp;
  return {
    minutes, wins, bosses, defeats, changedStage: s.stage !== stage, firstCycleSeconds,
    waveGoldPerMinute: waveGold / minutes,
    captainGoldPerMinute: captainGold / minutes,
    captainGemsPerMinute: captainGems / minutes,
    captainXpPerMinute: earnedCaptainXp / minutes,
    futureCaptainGoldPerMinute,
    repeatGoldPerMinute: repeatGold / minutes,
    repeatGemsPerMinute: progressGems(counters) / minutes,
    goldPerMinute: (waveGold + captainGold + repeatGold) / minutes,
    claimableGoldPerMinute: (waveGold + captainGold + repeatClaimableGold) / minutes,
    // This alternative replaces observed, lumpy captain payouts with the
    // next level's marginal gold/XP; it is an estimate, not claimable gold.
    marginalGoldPerMinute: (waveGold + repeatGold) / minutes + futureCaptainGoldPerMinute,
    dailyGold: progressGold(s.quests.daily, 'daily'),
    snowflakesPerHour: s.winter.earned / minutes * 60,
    expectedSnowflakesPerHour: api.campaignRewardInfo(s).eligible ? (wins + bosses) * api.WINTER_EVENT.dropChance / minutes * 60 : 0,
    counters,
  };
}

function aggregate(api, profile, stage, resetEveryWave = false) {
  const samples = Array.from({ length: SEEDS }, (_, index) => sample(api, profile, stage, Math.imul(index + 1, 2654435761) >>> 0, resetEveryWave));
  const row = {};
  for (const key of Object.keys(samples[0])) {
    if (typeof samples[0][key] === 'number') row[key] = samples.reduce((sum, sample) => sum + sample[key], 0) / samples.length;
  }
  row.changedStage = samples.some(sample => sample.changedStage);
  row.counters = Object.fromEntries(['kills', 'waves', 'bosses'].map(metric => [metric, samples.reduce((sum, sample) => sum + sample.counters[metric], 0) / samples.length]));
  return row;
}

const rows = [], comparisons = [];
for (const profile of PROFILES) {
  for (let stage = 1; stage <= profile.best; stage++) {
    const before = aggregate(BEFORE, profile, stage), after = aggregate(G, profile, stage);
    rows.push({ profile: profile.name, stage, gap: profile.best - stage, before, after });
    if (profile.name === 'beginner') {
      assert.equal(after.goldPerMinute, before.goldPerMinute, `early campaign payout unchanged at ${stage}`);
      assert.equal(after.captainXpPerMinute, before.captainXpPerMinute);
    }
    if (profile.best - stage > G.CAMPAIGN_REWARDS.safeGap) {
      assert.equal(after.repeatGoldPerMinute, 0, 'old-stage quest gold bypass');
      assert.equal(after.repeatGemsPerMinute, 0, 'old-stage quest gems bypass');
      assert.equal(after.dailyGold, 0, 'old-stage daily counters bypass');
      assert.equal(after.snowflakesPerHour, 0, 'old-stage winter exchange bypass');
    }
  }
  const own = rows.filter(row => row.profile === profile.name);
  const best = version => own.filter(row => !row[version].changedStage && row[version].defeats === 0)
    .sort((a, b) => b[version].goldPerMinute - a[version].goldPerMinute)[0];
  const previousBest = best('before'), currentBest = best('after');
  assert.ok(currentBest.gap <= G.CAMPAIGN_REWARDS.safeGap, `${profile.name}: profitable farming should stay near cleared progress`);
  const marginalBest = own.filter(row => !row.after.changedStage && row.after.defeats === 0)
    .sort((a, b) => b.after.marginalGoldPerMinute - a.after.marginalGoldPerMinute)[0];
  assert.ok(marginalBest.gap <= G.CAMPAIGN_REWARDS.safeGap, 'captain level rewards must not reopen weak-stage farming');
  const resetOldStage = aggregate(G, profile, 1, true);
  if (profile.best > 10) {
    assert.equal(resetOldStage.repeatGoldPerMinute, 0);
    assert.equal(resetOldStage.captainXpPerMinute, 0);
    assert.ok(resetOldStage.goldPerMinute < currentBest.after.goldPerMinute * .1, 'manual stage resets cannot restore profitable weak-stage farming');
  }
  const expectedFlakes = currentBest.after.expectedSnowflakesPerHour;
  comparisons.push({
    profile: profile.name, level: profile.level, stars: profile.stars, bestCleared: profile.best,
    oldBestStage: previousBest.stage, oldGoldPerMinute: previousBest.before.goldPerMinute,
    newBestStage: currentBest.stage, newGoldPerMinute: currentBest.after.goldPerMinute,
    newGoldPerHour: currentBest.after.goldPerMinute * 60,
    newClaimableGoldPerMinute: currentBest.after.claimableGoldPerMinute,
    observedCaptainGoldPerMinute: currentBest.after.captainGoldPerMinute,
    marginalCaptainGoldPerMinute: currentBest.after.futureCaptainGoldPerMinute,
    oldStageResetGoldPerMinute: resetOldStage.goldPerMinute,
    expectedFlakesPerHour: expectedFlakes,
    minutesForWinterGold: G.WINTER_EVENT.shop.gold.cost / expectedFlakes * 60,
    minutesForWinterGems: G.WINTER_EVENT.shop.gems.cost / expectedFlakes * 60,
    offlineGoldPerHour: G.rates({ best: profile.best }).gold * 60,
  });
}
const report = {
  rules: G.CAMPAIGN_REWARDS, seeds: SEEDS, minutesPerSample: MINUTES, speed: 1,
  profiles: PROFILES, defaultTeam: TEAM,
  methodology: 'Identical seeded active combat under current and pre-patch economy; five seeds per stage. No account purchases or level-up spending. Units gain battle XP normally. Current daily/one-time grants and offline earnings are excluded from ongoing gold/min; daily gold is listed per sample. Repeat rewards are fractional long-run accrual, alongside actually claimable integer quest cycles. Captain gold is actual payout, with a separately labelled marginal XP estimate. Income is not a promise for all formations, levels, seeds, or 1.5× speed.',
  limitations: 'Late bosses can fail while nearby farming stays viable. Two high-investment formations cover SSR and UR damage. Full winter stock is a daily cap, not an expectation to exhaust it. Prior currency and banked offline rewards are unchanged.',
  comparisons, rows,
};
fs.writeFileSync(process.argv[2] || '/tmp/school-economy-balance.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(comparisons, null, 2));
console.log(`PASS ${rows.length} stage/profile comparisons × ${SEEDS} seeds × before/after; weak-stage quest, winter, captain and reset bypasses closed; beginner rewards unchanged.`);
