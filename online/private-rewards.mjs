// Only a digest is configured in the worker environment. Never add the input
// code to the public catalog, saved state, receipt results, or application logs.
export const PRIVATE_RANK_RECEIPT = 'RANK_RECLAIMER_2';
const INVALID_CODE = '사용할 수 없는 코드입니다.';
const reject = () => { throw Object.assign(new Error(INVALID_CODE), {status:400}); };

export async function matchesPrivateRankReward(env, input) {
  const expected = env.PRIVATE_RANK_REWARD_HASH;
  if (typeof expected !== 'string' || !/^[a-fA-F0-9]{64}$/.test(expected) || typeof input !== 'string' || input.length > 128) return false;
  const normalized = input.normalize('NFC').trim().toUpperCase();
  if (!/^[A-Z0-9_]{1,40}$/.test(normalized)) return false;
  const actual = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized)));
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual[i] ^ Number.parseInt(expected.slice(i * 2, i * 2 + 2), 16);
  return difference === 0;
}

export function privateRankResult() {
  return {kind:'redeem', code:PRIVATE_RANK_RECEIPT, gold:0, gems:1000, expiresAt:null,
    avatar:'rank-first-2', avatarName:'랭킹 1등 탈환 기념', title:'rank-reclaimer', titleName:'랭킹1등 탈환자'};
}

export async function privateRankRetry(db, accountId, requestId) {
  const row = await db.prepare('SELECT 1 AS claimed FROM school_private_reward_claims WHERE receipt_id=? AND account_id=? AND request_id=?')
    .bind(PRIVATE_RANK_RECEIPT, accountId, requestId).first();
  return row ? privateRankResult() : null;
}

export async function awardPrivateRankReward(db, game, state) {
  const claimed = await db.prepare('SELECT 1 AS claimed FROM school_private_reward_claims WHERE receipt_id=?').bind(PRIVATE_RANK_RECEIPT).first();
  if (claimed || (state.redeemedCodes || []).includes(PRIVATE_RANK_RECEIPT)) reject();
  if (!Number.isSafeInteger(state.gems + 1000)) throw Object.assign(new Error('보유 보석을 확인해 주세요.'), {status:400});
  state.redeemedCodes = [...(state.redeemedCodes || []), PRIVATE_RANK_RECEIPT];
  state.gems += 1000;
  state.profile = {...game.profileInfo(state), avatar:'rank-first-2', title:'rank-reclaimer'};
  return privateRankResult();
}

export async function commitPrivateRankReward(db, {accountId, revision, payload, requestId, now}) {
  // The global receipt and account save commit in one transaction. A failed
  // save CAS cannot consume the code, and competing accounts cannot both win.
  const results = await db.batch([
    db.prepare(`UPDATE school_saves SET payload=?,revision=revision+1,updated_at=?
      WHERE account_id=? AND revision=? AND NOT EXISTS(SELECT 1 FROM school_private_reward_claims WHERE receipt_id=?)`)
      .bind(payload, now, accountId, revision, PRIVATE_RANK_RECEIPT),
    db.prepare(`INSERT INTO school_private_reward_claims(receipt_id,account_id,request_id,created_at)
      SELECT ?,account_id,?,? FROM school_saves WHERE account_id=? AND revision=?
      AND json_extract(payload,'$.receipts[#-1].id')=?
      AND json_extract(payload,'$.receipts[#-1].result.code')=?
      AND NOT EXISTS(SELECT 1 FROM school_private_reward_claims WHERE receipt_id=?)`)
      .bind(PRIVATE_RANK_RECEIPT, requestId, now, accountId, revision + 1, requestId, PRIVATE_RANK_RECEIPT, PRIVATE_RANK_RECEIPT),
  ]);
  return results[0];
}

// Per-account cosmetic redemption. The normal save CAS/receipt transaction
// commits this entitlement; it never changes money, hero ownership or stats.
export async function matchesPrivateHorasSkin(env,input){
  return matchesPrivateRankReward({PRIVATE_RANK_REWARD_HASH:env.PRIVATE_HORAS_SKIN_HASH},input);
}
export function awardPrivateHorasSkin(game,state){
  const skin=game.SKINS.horas_after_school;
  if(game.ownsSkin(state,skin.id))throw Object.assign(new Error('이미 획득한 스킨입니다.'),{status:400});
  state.redeemedCodes=[...(state.redeemedCodes||[]),skin.receipt];
  return {kind:'redeem',code:skin.receipt,skin:skin.id,skinName:skin.name,hero:skin.hero,gold:0,gems:0,expiresAt:null};
}
