import "../school/engine.js";
import { createSocial, ensureSchoolName, nameKey } from './social.mjs';

import { createGuilds } from './guilds.mjs';
import { createCommunity } from './community.mjs';
import { createRaids } from './raids.mjs';
import { createYeti, collectYetiRewards } from './yeti.mjs';
import { createCoop } from './coop.mjs';
import { guildActivity, guildProjectClaim } from './guild-progress.mjs';
import { matchesPrivateTwinGift, awardPrivateTwinGift, matchesPrivateApology, awardPrivateApology, matchesPrivateHorasSkin, awardPrivateHorasSkin, findPrivateRankReward, privateRankRetry, awardPrivateRankReward, commitPrivateRankReward } from './private-rewards.mjs';

export function createSchool() {
  const game = globalThis.SchoolRPG;
  const social = createSocial(game);
  const guilds = createGuilds(game);
  const community = createCommunity(game);
  const raids = createRaids(game);
  const yeti = createYeti(game);
  const coop = createCoop(game,yeti,raids);
  const requireSchool = (condition, message, status = 400) => {
    if (!condition) throw Object.assign(new Error(message), { status });
  };
  const secure = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
  // All scores come from the same server-owned save transaction. CASE also
  // protects public reads from a damaged legacy JSON record.
  const safePayload = "CASE WHEN json_valid(payload) THEN payload ELSE '{}' END";
  const levelScore = `CAST(json_extract(${safePayload}, '$.captain.level') AS INTEGER)`;
  const xpScore = `CAST(COALESCE(json_extract(${safePayload}, '$.captain.xp'), 0) AS INTEGER)`;
  const towerScore = `CAST(COALESCE(json_extract(${safePayload}, '$.activities.towerBest'), 0) AS INTEGER)`;
  async function rankings(env, mode, signed) {
    requireSchool(mode === 'level' || mode === 'tower', '랭킹 종류를 확인하세요.');
    const order = mode === 'level' ? `${levelScore} DESC, ${xpScore} DESC` : `${towerScore} DESC`;
    const valid = `json_valid(payload) AND json_type(${safePayload}, '$.captain.level') = 'integer'
      AND ${levelScore} BETWEEN 1 AND ${game.CAPTAIN_MAX_LEVEL} AND ${xpScore} >= 0
      ${mode === 'tower' ? `AND ${towerScore} > 0` : ''}`;
    const result = await env.DB.prepare(`WITH ranked AS (
      SELECT account_id, RANK() OVER (ORDER BY ${order}) AS rank,
        ROW_NUMBER() OVER (ORDER BY ${order}, account_id ASC) AS position,
        COUNT(*) OVER () AS total
      FROM school_saves WHERE ${valid} AND account_id NOT IN (SELECT id FROM accounts WHERE google_key='school:operator-test:v1')
    ) SELECT ranked.*, json_extract(${safePayload}, '$.commanderName') AS name,
      ${levelScore} AS level, ${towerScore} AS floor, json_object('profile',json_extract(${safePayload},'$.profile'),'team',json_extract(${safePayload},'$.team'),'redeemedCodes',json_extract(${safePayload},'$.redeemedCodes'),'bonds',json_extract(${safePayload},'$.bonds')) AS appearance
      FROM ranked JOIN school_saves USING (account_id)
      WHERE position <= 50 OR account_id = ? ORDER BY position`)
      .bind(signed?.id || '').all();
    const rows = result.results || [];
    const publicEntry = row => ({
      ...game.publicProfile(row.appearance), rank: row.rank, name: game.normalizeCommanderName(row.name) || '새내기 단장',
      level: row.level, floor: Math.max(0, row.floor), isMe: row.account_id === signed?.id,
    });
    const mine = signed && rows.find(row => row.account_id === signed.id);
    return { mode, entries: rows.filter(row => row.position <= 50).map(publicEntry),
      me: mine ? publicEntry(mine) : null, total: rows[0]?.total || 0,
      updatedAt: Date.now(), limit: 50 };
  }
  return {
    async request(path, request, env, data, accounts) {
      try {
      const isolated=await accounts.identity(request,env,Date.now()).catch(error=>{if(error.status===401)return null;throw error;});
      if(isolated?.isTest)requireSchool(['/api/school/state','/api/school/action','/api/school/rankings'].includes(path),'운영 테스트 계정은 공개 랭킹·친구·길드·협동전에 참여하지 않습니다.',403);
      if(path==='/api/school/profile'){
        const name=game.normalizeCommanderName(data.name);requireSchool(name,'단장 이름을 확인해 주세요.');
        const row=await env.DB.prepare('SELECT n.display_name AS name,s.payload FROM school_names n JOIN school_saves s ON s.account_id=n.account_id WHERE n.name_key=?').bind(nameKey(name)).first();
        requireSchool(row,'단장을 찾지 못했어요.',404);let saved;try{saved=JSON.parse(row.payload);}catch{}requireSchool(game.validate(saved),'프로필을 불러올 수 없어요.',409);
        const appearance=game.publicProfile(saved),info=game.profileInfo(saved);
        return {name:row.name,...appearance,title:info.title,level:saved.captain.level,power:game.power(saved),best:saved.best,tower:game.activityInfo(saved).tower.best,team:saved.team.map(id=>({id,skin:game.equippedSkin(saved,id),name:game.BY_ID[id].name,rarity:game.BY_ID[id].rarity,level:saved.units[id].level,stars:saved.units[id].stars}))};
      }
      if (path === '/api/school/coop') return await coop.request(request,env,data,accounts);
      if (path === '/api/school/yeti') return await yeti.request(request, env, data, accounts);
      if (path === '/api/school/raid') return await raids.request(request, env, data, accounts);
      if (path === '/api/school/community') return await community.request(request, env, data, accounts);
      if (path === '/api/school/guild') return await guilds.request(request, env, data, accounts);
      if (path === '/api/school/social') return await social.request(request, env, data, accounts);
      requireSchool(["/api/school/state", "/api/school/action", "/api/school/rankings"].includes(path), "지원하지 않는 경로입니다.", 404);
      const signed = isolated;
      if (path === '/api/school/rankings') {
        requireSchool(data.catalogVersion === game.CATALOG_VERSION, "게임이 업데이트되었습니다. 페이지를 새로고침해 주세요.", 426);
        return await rankings(env, data.mode, signed);
      }
      requireSchool(signed, "계정으로 로그인하세요.", 401);
      // Older bundles cannot render newly recruited heroes. Reject before any
      // write or charge, so a refresh can safely resume the same saved request.
      requireSchool(data.catalogVersion === game.CATALOG_VERSION, "게임이 업데이트되었습니다. 페이지를 새로고침해 주세요.", 426);
      const action = path === "/api/school/action";
      if (action) {
        requireSchool(Number.isInteger(data.revision) && data.revision >= 0, "진행 상황을 다시 불러오세요.", 409);
        requireSchool(typeof data.requestId === "string" && /^[A-Za-z0-9_-]{16,80}$/.test(data.requestId), "행동 요청을 확인하세요.");
        requireSchool(data.action && typeof data.action === "object" && !Array.isArray(data.action), "잘못된 행동입니다.");
      }
      const legacyCodesActive = Date.now() < Date.parse('2026-11-20T10:38:23Z');
      const privateRank = legacyCodesActive && action && data.action.kind === 'redeem' && await findPrivateRankReward(env, data.action.code);
      const privateTwin=action&&data.action.kind==='redeem'&&await matchesPrivateTwinGift(env,data.action.code);
      const privateApology=action&&data.action.kind==='redeem'&&await matchesPrivateApology(env,data.action.code);
      const privateSkin = legacyCodesActive && action && data.action.kind === 'redeem' && await matchesPrivateHorasSkin(env,data.action.code);
      let acceptedRevision = data.revision;
      // Login/state sync also delivers old unclaimed victory rewards.
      if(!action)await collectYetiRewards(env.DB,game,signed.id,Date.now());
      for (let attempt = 0; attempt < 8; attempt++) {
        const now = Date.now();
        let row = await env.DB.prepare("SELECT payload, revision FROM school_saves WHERE account_id = ?").bind(signed.id).first();
        if (!row) {
          const initial = game.create(now, crypto.getRandomValues(new Uint32Array(1))[0]);
          if(signed.isTest){
            initial.commanderName='운영 테스트';initial.nameChanges=1;initial.gold=100000000;initial.gems=1000000;initial.best=game.MAX_STAGE;initial.captain={level:200,xp:0};
            for(const h of game.HEROES)initial.units[h.id]={level:125,stars:5,xp:0,shards:9999};
            initial.winter.snowflakes=100000;initial.winter.earned=100000;initial.winter.snowmen=1000;initial.winter.snowmenEarned=1000;
            initial.activities.towerBest=1000;
            for(const gear of game.GEAR)initial.equipment.inventory[gear.id]={count:10,stars:5};
            initial.redeemedCodes.push(...Object.values(game.SKINS).map(s=>s.receipt));
            game.action(initial,{kind:'team',team:['hyeokjin','horas','osia','kazua','ryusion','spica']},now);
          }
          await env.DB.prepare("INSERT OR IGNORE INTO school_saves (account_id, payload, revision, updated_at) SELECT id, ?, 0, ? FROM accounts WHERE id = ?")
            .bind(JSON.stringify(initial), now, signed.id).run();
          row = await env.DB.prepare("SELECT payload, revision FROM school_saves WHERE account_id = ?").bind(signed.id).first();
          requireSchool(row, "계정이 변경되었습니다. 다시 로그인하세요.", 401);
        }
        const state = JSON.parse(row.payload);
        requireSchool(game.validate(state), "저장 정보를 읽지 못했습니다. 운영자에게 문의하세요.", 500);
        const prior = action && state.receipts.find(r => r.id === data.requestId);
        if (prior) return { state: game.view(state), revision: row.revision, serverTime: now, result: prior.result, repeated: true };
        // The one-use reward keeps its idempotency receipt even after the
        // ordinary bounded action history has expired or its code is disabled.
        const privateRetry = action && data.action.kind === 'redeem' && await privateRankRetry(env.DB, signed.id, data.requestId);
        if (privateRetry) return { state: game.view(state), revision: row.revision, serverTime: now, result: privateRetry, repeated: true };
        if (action && acceptedRevision !== row.revision) {
          return { conflict: true, state: game.view(state), revision: row.revision, serverTime: now };
        }
        if(!signed.isTest)await ensureSchoolName(env.DB, signed.id, state, game, now);
        else state.nameNeedsClaim=false;
        // Every existing account is offered the new introduction exactly once.
        state.onboarding ||= {version:1,step:0};
        // Gear is rolled only while a server-owned encounter settles. The
        // public combat seed must never predict cloud inventory rewards.
        const previousResult = state.activities?.lastResult?.runId;
        game.advance(state, now, { gearRng: secure });
        const settled = state.activities?.lastResult;
        if (action && settled?.runId !== previousResult && settled?.gearDrops?.length) {
          // Commit earned random loot before validating the following intent.
          // Otherwise "equip the SSR if it dropped" could selectively fail an
          // action and roll the uncommitted dungeon reward again for free.
          const advanced = await env.DB.prepare("UPDATE school_saves SET payload = ?, revision = revision + 1, updated_at = ? WHERE account_id = ? AND revision = ?")
            .bind(JSON.stringify(state), now, signed.id, row.revision).run();
          if (advanced.meta.changes === 1) acceptedRevision = row.revision + 1;
          // A lost response here safely recovers via the ordinary revision
          // conflict flow. No action receipt exists until the action commits.
          continue;
        }
        let result = null;
        const privateReward = privateRank ? await awardPrivateRankReward(env.DB, game, state, privateRank) : privateSkin ? awardPrivateHorasSkin(game,state) : privateApology ? awardPrivateApology(state) : privateTwin ? awardPrivateTwinGift(state) : null;
        const renaming = action && data.action.kind === 'rename';
        if (renaming) {
          const normalized = game.normalizeCommanderName(data.action.name);
          requireSchool(normalized && normalized !== '새내기 단장', '사용할 단장 이름을 2~12글자로 정해 주세요.');
          const owner = await env.DB.prepare('SELECT account_id FROM school_names WHERE name_key = ?').bind(nameKey(normalized)).first();
          requireSchool(!owner || owner.account_id === signed.id, '이미 사용 중인 단장 이름이에요.', 409);
        }
        const checkingIn = action && data.action.kind === 'guild-checkin';
        let guildMember = null;
        const claimingProject=action&&data.action.kind==='guild-project-claim';
        const projectReward=claimingProject?await guildProjectClaim(env.DB,game,signed.id,data.action,now):null;
        const yetiClaim=action&&data.action.kind==='yeti-claim';
        let yetiReward=null;
        if(yetiClaim){yetiReward=await env.DB.prepare('SELECT * FROM school_yeti_rewards WHERE account_id=? AND room_id=?').bind(signed.id,String(data.action.roomId||'')).first();requireSchool(yetiReward&&!yetiReward.claimed,'이미 받았거나 받을 수 없는 예티 보상이에요.');requireSchool(Number.isSafeInteger((state.winter?.snowflakes||0)+yetiReward.snowflakes)&&Number.isSafeInteger((state.winter?.earned||0)+yetiReward.snowflakes),'보유 눈송이를 확인하세요.');requireSchool(Number.isSafeInteger((state.winter?.snowmen||0)+yetiReward.snowmen)&&Number.isSafeInteger((state.winter?.snowmenEarned||0)+yetiReward.snowmen),'보유 눈사람을 확인하세요.');}
        const raidClaim = action && data.action.kind === 'raid-claim';
        let raidReward=null;
        if(raidClaim){
          raidReward=await env.DB.prepare('SELECT * FROM school_raid_rewards WHERE account_id=? AND room_id=?').bind(signed.id,String(data.action.roomId||'')).first();
          requireSchool(raidReward && !raidReward.claimed, '이미 받았거나 받을 수 없는 길드전 보상이에요.');
          requireSchool(Number.isSafeInteger(state.gold+raidReward.gold)&&Number.isSafeInteger(state.gems+raidReward.gems),'재화를 확인해 주세요.');
        }
        if (checkingIn) {
          guildMember = await env.DB.prepare('SELECT guild_id,membership_key,joined_at FROM school_guild_members WHERE account_id=?').bind(signed.id).first();
          requireSchool(guildMember && guildMember.guild_id === data.action.guildId, '길드 정보를 다시 확인해 주세요.', 400);
          requireSchool(game.day(guildMember.joined_at) < game.day(now), '가입 다음 날부터 출석할 수 있어요. 한국 시간 자정에 열려요.', 400);
          const taken = await env.DB.prepare('SELECT 1 AS yes FROM school_guild_attendance WHERE account_id=? AND day=?').bind(signed.id,game.day(now)).first();
          requireSchool(!taken, '오늘 출석 보상을 이미 받았어요.', 400);
          requireSchool(Number.isSafeInteger(state.gems + 30), '보유 보석을 확인해 주세요.', 400);
        }
        if (action) {
          // The client submits intentions only. Time, loot, draws and costs are server-owned.
          // Speed changes can consume a fractional combat step and settle a
          // dungeon too, so they share the same authoritative loot context.
          try { if(privateReward){result=privateReward;}else if(yetiClaim){state.winter.snowflakes+=yetiReward.snowflakes;state.winter.earned+=yetiReward.snowflakes;if(yetiReward.snowmen){state.winter.snowmen=(state.winter.snowmen||0)+yetiReward.snowmen;state.winter.snowmenEarned=(state.winter.snowmenEarned||0)+yetiReward.snowmen;}result={kind:'yeti-claim',snowflakes:yetiReward.snowflakes,snowmen:yetiReward.snowmen};}else if(projectReward){requireSchool(Number.isSafeInteger(state.gold+projectReward.gold)&&Number.isSafeInteger(state.gems+projectReward.gems),'재화를 확인해 주세요.');state.gold+=projectReward.gold;state.gems+=projectReward.gems;result={kind:'guild-project-claim',gold:projectReward.gold,gems:projectReward.gems};}else if(raidClaim){state.gold+=raidReward.gold;state.gems+=raidReward.gems;result={kind:'raid-claim',gold:raidReward.gold,gems:raidReward.gems};}else if(checkingIn){state.gems+=30;result={kind:'guild-checkin',gems:30,day:game.day(now)};}else result = game.action(state, data.action, now, secure, { gearRng: secure }); }
          catch (error) { throw Object.assign(error, { status: 400 }); }
          state.receipts.push({ id: data.requestId, result }); state.receipts = state.receipts.slice(-20);
          if (renaming) state.nameNeedsClaim = false;
        }
        const payload = JSON.stringify(state);
        if (payload === row.payload) return { state: game.view(state), revision: row.revision, serverTime: now, result };
        const update = env.DB.prepare("UPDATE school_saves SET payload = ?, revision = revision + 1, updated_at = ? WHERE account_id = ? AND revision = ?")
          .bind(payload, now, signed.id, row.revision);
        let written;
        if(privateRank){
          written=await commitPrivateRankReward(env.DB,{accountId:signed.id,revision:row.revision,payload,requestId:data.requestId,now,receipt:privateRank});
        }else if(yetiClaim){
          const results=await env.DB.batch([
           env.DB.prepare('UPDATE school_saves SET payload=?,revision=revision+1,updated_at=? WHERE account_id=? AND revision=? AND EXISTS(SELECT 1 FROM school_yeti_rewards WHERE account_id=? AND room_id=? AND claimed=0)').bind(payload,now,signed.id,row.revision,signed.id,yetiReward.room_id),
           env.DB.prepare("UPDATE school_yeti_rewards SET claimed=1 WHERE account_id=? AND room_id=? AND claimed=0 AND EXISTS(SELECT 1 FROM school_saves WHERE account_id=? AND revision=? AND json_extract(payload,'$.receipts[#-1].id')=?)").bind(signed.id,yetiReward.room_id,signed.id,row.revision+1,data.requestId)
          ]);written=results[0];
        }else if(projectReward){
          const p=projectReward;
          const results=await env.DB.batch([
            env.DB.prepare(`UPDATE school_saves SET payload=?,revision=revision+1,updated_at=? WHERE account_id=? AND revision=?
             AND EXISTS(SELECT 1 FROM school_guild_members WHERE account_id=? AND guild_id=? AND membership_key=?)
             AND EXISTS(SELECT 1 FROM school_guild_projects WHERE guild_id=? AND week=? AND quest_id=?)
             AND NOT EXISTS(SELECT 1 FROM school_guild_project_claims WHERE account_id=? AND week=? AND quest_id=?)`)
             .bind(payload,now,signed.id,row.revision,signed.id,p.guildId,p.memberKey,p.guildId,p.week,p.id,signed.id,p.week,p.id),
            env.DB.prepare(`INSERT OR IGNORE INTO school_guild_project_claims(account_id,week,quest_id,guild_id,created_at)
             SELECT account_id,?,?,?,? FROM school_saves WHERE account_id=? AND revision=? AND json_extract(payload,'$.receipts[#-1].id')=?`)
             .bind(p.week,p.id,p.guildId,now,signed.id,row.revision+1,data.requestId)
          ]);written=results[0];
        }else if(raidClaim){
          const results=await env.DB.batch([
            env.DB.prepare('UPDATE school_saves SET payload=?,revision=revision+1,updated_at=? WHERE account_id=? AND revision=? AND EXISTS(SELECT 1 FROM school_raid_rewards WHERE account_id=? AND room_id=? AND claimed=0)').bind(payload,now,signed.id,row.revision,signed.id,raidReward.room_id),
            env.DB.prepare("UPDATE school_raid_rewards SET claimed=1 WHERE account_id=? AND room_id=? AND claimed=0 AND EXISTS(SELECT 1 FROM school_saves WHERE account_id=? AND revision=? AND json_extract(payload,'$.receipts[#-1].id')=?)").bind(signed.id,raidReward.room_id,signed.id,row.revision+1,data.requestId)
          ]);written=results[0];
        }else if (checkingIn) {
          const results = await env.DB.batch([
            env.DB.prepare(`UPDATE school_saves SET payload=?,revision=revision+1,updated_at=? WHERE account_id=? AND revision=? AND EXISTS(SELECT 1 FROM school_guild_members WHERE account_id=? AND guild_id=? AND membership_key=?) AND NOT EXISTS(SELECT 1 FROM school_guild_attendance WHERE account_id=? AND day=?)`)
              .bind(payload,now,signed.id,row.revision,signed.id,guildMember.guild_id,guildMember.membership_key,signed.id,game.day(now)),
            env.DB.prepare(`INSERT INTO school_guild_attendance(account_id,day,created_at) SELECT account_id,?,? FROM school_saves WHERE account_id=? AND revision=? AND json_extract(payload,'$.receipts[#-1].id')=? AND NOT EXISTS(SELECT 1 FROM school_guild_attendance WHERE account_id=? AND day=?)`)
              .bind(game.day(now),now,signed.id,row.revision+1,data.requestId,signed.id,game.day(now)),
            guildActivity(env.DB,{key:'attendance:'+signed.id+':'+game.day(now),gid:guildMember.guild_id,account:signed.id,week:game.week(now),kind:'attendance',reference:String(game.day(now)),at:now,
              condition:"EXISTS(SELECT 1 FROM school_saves WHERE account_id=? AND revision=? AND json_extract(payload,'$.receipts[#-1].id')=?)",bindings:[signed.id,row.revision+1,data.requestId]})
          ]); written=results[0];
        } else if (renaming && !signed.isTest) {
          try {
            const results = await env.DB.batch([update, env.DB.prepare(`INSERT INTO school_names(account_id,name_key,display_name,created_at)
              SELECT account_id,?,?,? FROM school_saves WHERE account_id = ? AND revision = ? AND json_extract(payload,'$.receipts[#-1].id') = ?
              ON CONFLICT(account_id) DO UPDATE SET name_key = excluded.name_key, display_name = excluded.display_name`)
              .bind(nameKey(state.commanderName), state.commanderName, now, signed.id, row.revision + 1, data.requestId)]);
            written = results[0];
          } catch (error) {
            if (/UNIQUE constraint failed.*school_names/i.test(error.message || '')) throw Object.assign(new Error('이미 사용 중인 단장 이름이에요.'), {status:409});
            throw error;
          }
        } else written = await update.run();
        if (written.meta.changes === 1) return { state: game.view(state), revision: row.revision + 1, serverTime: now, result };
        // On a CAS conflict, a duplicate action finds its receipt on the next read.
      }
      throw Object.assign(new Error("저장 정보를 동기화 중입니다. 잠시 후 다시 시도하세요."), { status: 409 });
      } catch (error) {
        if (error.status) throw error;
        // A storage timeout may happen after a successful commit. Keep the
        // client's idempotency key pending so it can safely recover the receipt.
        throw Object.assign(new Error("저장 응답을 확인하지 못했습니다. 같은 요청으로 다시 연결하세요."), { status: 503 });
      }
    },
  };
}
