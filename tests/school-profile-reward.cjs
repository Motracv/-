const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const G = require('../school/engine.js');
const now = Date.parse('2026-11-18T12:00:00+09:00');
const code = '랭킹1등축하드립니다', avatar = 'rank-first';
const s = G.create(now, 7), before = G.clone(s), power = G.power(s);
assert.equal(G.ownsProfileAvatar(s, avatar), false);
assert.throws(() => G.action(s, {kind:'profile', avatar, unlocked:true}, now), /해금/);
assert.equal(G.validate({...s, profile:{...s.profile, avatar}}), false);
assert.deepEqual(s, before);
const reward = G.action(s, {kind:'redeem', code:'  '+code.normalize('NFD')+'\n', gold:1e9, gems:1e9, avatar:'bird'}, now);
assert.equal(reward.avatar, avatar);
assert.equal(reward.displayCode, code);
assert.equal(reward.avatarName, '랭킹 1등 기념');
assert.equal(G.ownsProfileAvatar(s, avatar), true);
assert.equal(s.profile.avatar, 'leader');
assert.deepEqual([s.gold,s.gems,G.power(s)], [before.gold,before.gems,power]);
assert.deepEqual(s.redeemedCodes, ['RANKING_FIRST_CONGRATS']);
for (const duplicate of [code, ' '+code+' ', 'ranking_first_congrats']) {
  const checkpoint = G.clone(s);
  assert.throws(() => G.action(s, {kind:'redeem', code:duplicate}, now), /이미 사용/);
  assert.deepEqual(s, checkpoint);
}
G.action(s, {kind:'profile', avatar}, now);
const restored = JSON.parse(JSON.stringify(s));
assert(G.validate(restored));
G.advance(restored, now);
assert.equal(restored.profile.avatar, avatar);
assert(G.ownsProfileAvatar(restored, avatar));
assert.equal(G.power(restored), power);
G.action(restored, {kind:'profile', avatar:'cat'}, now);
G.action(restored, {kind:'profile', avatar}, now);
assert.equal(restored.profile.avatar, avatar);
assert.equal(G.ownsProfileAvatar(G.create(now), avatar), false);
console.log('PASS Korean/NFD code, cosmetic-only reward, one-time alias receipt, ownership enforcement and reload');

const old = G.create(now); delete old.profile; delete old.redeemedCodes;
old.gold = 5860; old.gems = 290;
G.advance(old, now);
G.action(old, {kind:'redeem', code}, now);
G.action(old, {kind:'profile', avatar, title:'beta'}, now);
assert(G.validate(old));
assert.equal(old.profile.title, 'beta');
assert.deepEqual([old.gold,old.gems], [5860,290]);
G.action(old, {kind:'redeem', code:'THANKS_FOR_REPORTING'}, now);
assert.deepEqual([old.gold,old.gems], [6360,790]);
for (const wrong of ['랭킹2등축하드립니다','랭킹1등 축하드립니다','__proto__','<img>']) {
  assert.throws(() => G.action(old, {kind:'redeem', code:wrong}, now));
}
console.log('PASS legacy progress/title and existing currency codes preserved');

const context = {window:{SchoolRPG:G, SchoolArt:{portrait:id=>'portrait/'+id+'.png'}}};
vm.runInNewContext(fs.readFileSync(require.resolve('../school/guild.js'),'utf8'), context);
assert.match(context.window.SchoolGuild.avatar(G.profileInfo(s)), /class="profile-avatar reward-avatar/);
assert.match(context.window.SchoolGuild.avatar(G.profileInfo(s)), /school\/assets\/profile\/rank-first.webp\?v=rank-profile1/);
assert.match(context.window.SchoolGuild.avatar({avatar:'cat'}), /painted-avatar/);
assert.match(context.window.SchoolGuild.avatar({avatar:'https://untrusted.test/'}), /portrait\/taeo.png/);
console.log('PASS shared lobby/profile/guild avatar renderer uses the new local portrait and retains existing avatars');
