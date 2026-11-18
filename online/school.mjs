import "../school/engine.js";
import { createSocial, ensureSchoolName, nameKey } from './social.mjs';

export function createSchool() {
  const game = globalThis.SchoolRPG;
  const social = createSocial(game);
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
      FROM school_saves WHERE ${valid}
    ) SELECT ranked.*, json_extract(${safePayload}, '$.commanderName') AS name,
      ${levelScore} AS level, ${towerScore} AS floor
      FROM ranked JOIN school_saves USING (account_id)
      WHERE position <= 50 OR account_id = ? ORDER BY position`)
      .bind(signed?.id || '').all();
    const rows = result.results || [];
    const publicEntry = row => ({
      rank: row.rank, name: game.normalizeCommanderName(row.name) || '새내기 단장',
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
      if (path === '/api/school/social') return await social.request(request, env, data, accounts);
      requireSchool(["/api/school/state", "/api/school/action", "/api/school/rankings"].includes(path), "지원하지 않는 경로입니다.", 404);
      let signed;
      try { signed = await accounts.identity(request, env, Date.now()); }
      catch (error) {
        // Public boards remain readable after a session expires. Only absence
        // of identity is ignored; database/service failures still surface.
        if (path !== '/api/school/rankings' || error.status !== 401) throw error;
        signed = null;
      }
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
      let acceptedRevision = data.revision;
      for (let attempt = 0; attempt < 8; attempt++) {
        const now = Date.now();
        let row = await env.DB.prepare("SELECT payload, revision FROM school_saves WHERE account_id = ?").bind(signed.id).first();
        if (!row) {
          const initial = game.create(now, crypto.getRandomValues(new Uint32Array(1))[0]);
          await env.DB.prepare("INSERT OR IGNORE INTO school_saves (account_id, payload, revision, updated_at) SELECT id, ?, 0, ? FROM accounts WHERE id = ?")
            .bind(JSON.stringify(initial), now, signed.id).run();
          row = await env.DB.prepare("SELECT payload, revision FROM school_saves WHERE account_id = ?").bind(signed.id).first();
          requireSchool(row, "계정이 변경되었습니다. 다시 로그인하세요.", 401);
        }
        const state = JSON.parse(row.payload);
        requireSchool(game.validate(state), "저장 정보를 읽지 못했습니다. 운영자에게 문의하세요.", 500);
        const prior = action && state.receipts.find(r => r.id === data.requestId);
        if (prior) return { state: game.view(state), revision: row.revision, serverTime: now, result: prior.result, repeated: true };
        if (action && acceptedRevision !== row.revision) {
          return { conflict: true, state: game.view(state), revision: row.revision, serverTime: now };
        }
        await ensureSchoolName(env.DB, signed.id, state, game, now);
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
        const renaming = action && data.action.kind === 'rename';
        if (renaming) {
          const normalized = game.normalizeCommanderName(data.action.name);
          requireSchool(normalized && normalized !== '새내기 단장', '사용할 단장 이름을 2~12글자로 정해 주세요.');
          const owner = await env.DB.prepare('SELECT account_id FROM school_names WHERE name_key = ?').bind(nameKey(normalized)).first();
          requireSchool(!owner || owner.account_id === signed.id, '이미 사용 중인 단장 이름이에요.', 409);
        }
        if (action) {
          // The client submits intentions only. Time, loot, draws and costs are server-owned.
          // Speed changes can consume a fractional combat step and settle a
          // dungeon too, so they share the same authoritative loot context.
          try { result = game.action(state, data.action, now, secure, { gearRng: secure }); }
          catch (error) { throw Object.assign(error, { status: 400 }); }
          state.receipts.push({ id: data.requestId, result }); state.receipts = state.receipts.slice(-20);
          if (renaming) state.nameNeedsClaim = false;
        }
        const payload = JSON.stringify(state);
        if (payload === row.payload) return { state: game.view(state), revision: row.revision, serverTime: now, result };
        const update = env.DB.prepare("UPDATE school_saves SET payload = ?, revision = revision + 1, updated_at = ? WHERE account_id = ? AND revision = ?")
          .bind(payload, now, signed.id, row.revision);
        let written;
        if (renaming) {
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
