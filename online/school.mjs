import "../school/engine.js";

export function createSchool() {
  const game = globalThis.SchoolRPG;
  const requireSchool = (condition, message, status = 400) => {
    if (!condition) throw Object.assign(new Error(message), { status });
  };
  const secure = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
  return {
    async request(path, request, env, data, accounts) {
      try {
      requireSchool(["/api/school/state", "/api/school/action"].includes(path), "지원하지 않는 경로입니다.", 404);
      const signed = await accounts.identity(request, env, Date.now());
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
        if (action && data.revision !== row.revision) {
          return { conflict: true, state: game.view(state), revision: row.revision, serverTime: now };
        }
        game.advance(state, now);
        let result = null;
        if (action) {
          // The client submits intentions only. Time, loot, draws and costs are server-owned.
          try { result = game.action(state, data.action, now, secure); }
          catch (error) { throw Object.assign(error, { status: 400 }); }
          state.receipts.push({ id: data.requestId, result }); state.receipts = state.receipts.slice(-20);
        }
        const payload = JSON.stringify(state);
        if (payload === row.payload) return { state: game.view(state), revision: row.revision, serverTime: now, result };
        const written = await env.DB.prepare("UPDATE school_saves SET payload = ?, revision = revision + 1, updated_at = ? WHERE account_id = ? AND revision = ?")
          .bind(payload, now, signed.id, row.revision).run();
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
