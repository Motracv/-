// Only a digest is configured in the worker environment. Never add the input
// code to the public catalog, saved state, receipt results, or application logs.
export const PRIVATE_RANK_RECEIPT = 'RANK_RECLAIMER_2';
export const PRIVATE_NTR_RECEIPT = 'RANK_NTR_1';
export const PRIVATE_AZURE_RECEIPT = 'RANK_AZURE_FIRST_1';
const rankRewards = Object.freeze({
  [PRIVATE_RANK_RECEIPT]: {hashKey:'PRIVATE_RANK_REWARD_HASH', avatar:'rank-first-2', avatarName:'랭킹 1등 탈환 기념', title:'rank-reclaimer', titleName:'랭킹1등 탈환자'},
  [PRIVATE_NTR_RECEIPT]: {hashKey:'PRIVATE_RANK_NTR_REWARD_HASH', avatar:'rank-ntr', avatarName:'랭킹 1등 기념 · T1', title:'rank-ntr', titleName:'1등 NTR'},
  [PRIVATE_AZURE_RECEIPT]: {hashKey:'PRIVATE_AZURE_CROWN_HASH', gems:3000, title:'rank-azure-first', titleName:'창해의 첫 번째 왕관'}
});
export async function findPrivateRankReward(env,input) {
  for (const [receipt,reward] of Object.entries(rankRewards)) {
    if (await matchesPrivateRankReward({PRIVATE_RANK_REWARD_HASH:env[reward.hashKey]},input)) return receipt;
  }
  return null;
}
const INVALID_CODE = '사용할 수 없는 코드입니다.';
const reject = () => { throw Object.assign(new Error(INVALID_CODE), {status:400}); };

export async function matchesPrivateRankReward(env, input) {
  const expected = env.PRIVATE_RANK_REWARD_HASH;
  if (typeof expected !== 'string' || !/^[a-fA-F0-9]{64}$/.test(expected) || typeof input !== 'string' || input.length > 128) return false;
  const normalized = input.normalize('NFC').trim().toUpperCase();
  if (!/^[A-Z0-9_가-힣]{1,40}$/.test(normalized)) return false;
  const actual = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized)));
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual[i] ^ Number.parseInt(expected.slice(i * 2, i * 2 + 2), 16);
  return difference === 0;
}

export function privateRankResult(receipt = PRIVATE_RANK_RECEIPT) {
  const reward=rankRewards[receipt]; if(!reward) reject();
  const {hashKey,...cosmetics}=reward;
  return {kind:'redeem', code:receipt, gold:0, gems:1000, expiresAt:null,...cosmetics};
}

export async function privateRankRetry(db, accountId, requestId) {
  const row = await db.prepare('SELECT receipt_id FROM school_private_reward_claims WHERE account_id=? AND request_id=?')
    .bind(accountId, requestId).first();
  return row && rankRewards[row.receipt_id] ? privateRankResult(row.receipt_id) : null;
}

export async function awardPrivateRankReward(db, game, state, receipt = PRIVATE_RANK_RECEIPT) {
  const reward=privateRankResult(receipt);
  const claimed = await db.prepare('SELECT 1 AS claimed FROM school_private_reward_claims WHERE receipt_id=?').bind(receipt).first();
  if (claimed || (state.redeemedCodes || []).includes(receipt)) reject();
  if (!Number.isSafeInteger(state.gems + reward.gems)) throw Object.assign(new Error('보유 보석을 확인해 주세요.'), {status:400});
  state.redeemedCodes = [...(state.redeemedCodes || []), receipt];
  state.gems += reward.gems;
  state.profile = {...game.profileInfo(state), ...(reward.avatar ? {avatar:reward.avatar} : {}), title:reward.title};
  return reward;
}

export async function commitPrivateRankReward(db, {accountId, revision, payload, requestId, now, receipt = PRIVATE_RANK_RECEIPT}) {
  // The global receipt and account save commit in one transaction. A failed
  // save CAS cannot consume the code, and competing accounts cannot both win.
  const results = await db.batch([
    db.prepare(`UPDATE school_saves SET payload=?,revision=revision+1,updated_at=?
      WHERE account_id=? AND revision=? AND NOT EXISTS(SELECT 1 FROM school_private_reward_claims WHERE receipt_id=?)`)
      .bind(payload, now, accountId, revision, receipt),
    db.prepare(`INSERT INTO school_private_reward_claims(receipt_id,account_id,request_id,created_at)
      SELECT ?,account_id,?,? FROM school_saves WHERE account_id=? AND revision=?
      AND json_extract(payload,'$.receipts[#-1].id')=?
      AND json_extract(payload,'$.receipts[#-1].result.code')=?
      AND NOT EXISTS(SELECT 1 FROM school_private_reward_claims WHERE receipt_id=?)`)
      .bind(receipt, requestId, now, accountId, revision + 1, requestId, receipt, receipt),
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

// Per-account compensation; only a digest exists on the server.
export async function matchesPrivateApology(env,input){return matchesPrivateRankReward({PRIVATE_RANK_REWARD_HASH:env.PRIVATE_APOLOGY_HASH},input);}
export function awardPrivateApology(state){const code='PRIVATE_APOLOGY_20261120';if((state.redeemedCodes||[]).includes(code))throw Object.assign(Error('이미 받은 보상입니다.'),{status:400});if(!Number.isSafeInteger(state.gems+1600))throw Object.assign(Error('보석 수량을 확인하세요.'),{status:400});state.gems+=1600;state.redeemedCodes=[...(state.redeemedCodes||[]),code];return{kind:'redeem',code,gems:1600,gold:0,expiresAt:null};}

// Private per-account thank-you reward. Plaintext is never shipped to clients.
export async function matchesPrivateTwinGift(env,input){return matchesPrivateRankReward({PRIVATE_RANK_REWARD_HASH:env.PRIVATE_TWIN_GIFT_HASH},input);}
export function awardPrivateTwinGift(state){const code='PRIVATE_TWIN_GIFT_20261120';if((state.redeemedCodes||[]).includes(code))throw Object.assign(Error('이미 받은 보상입니다.'),{status:400});if(!Number.isSafeInteger(state.gems+20000))throw Object.assign(Error('보석 수량을 확인하세요.'),{status:400});state.gems+=20000;state.redeemedCodes=[...(state.redeemedCodes||[]),code];return{kind:'redeem',code,gems:20000,gold:0,expiresAt:null};}
