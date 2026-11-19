// Google credentials are verified here, never by trusting browser-decoded claims.
// Only opaque, hashed application sessions and a Google subject hash are stored.
const ACCOUNT_SESSION_MS = 30 * 86400000;
const CHALLENGE_MS = 10 * 60000;
const GOOGLE_KEYS = "https://www.googleapis.com/oauth2/v3/certs";
const ACCOUNT_RULES = Object.freeze({ finishXp: 30, winBonus: 50, drawBonus: 10,
  minimumAccounts: 2, minimumSeconds: 60, minimumActions: 2 });
function accountError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}
function accountRandom() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
}
async function accountHash(text) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))), b => b.toString(16).padStart(2, "0")).join("");
}
function accountBytes(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw accountError("잘못된 Google 로그인 응답입니다.", 401);
  return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
}
export function accountLevel(total) {
  const xp = Math.max(0, Math.floor(Number(total) || 0));
  const completed = Math.floor((Math.sqrt(5625 + 100 * xp) - 75) / 50);
  const level = completed + 1, floor = 25 * completed * completed + 75 * completed;
  const levelXp = xp - floor, requiredXp = 100 + 50 * completed;
  const title = level >= 50 ? "전설" : level >= 30 ? "마스터" : level >= 20 ? "베테랑"
    : level >= 10 ? "듀얼리스트" : level >= 5 ? "도전자" : "새내기";
  return { xp, level, levelXp, requiredXp, title };
}
export function accountReward(room, member) {
  if (!member.accountId || !room.matchId) return null;
  const game = room.game?.s;
  if (!game || game.phase !== "over") return { matchId: room.matchId, accountId: member.accountId, pending: true, rules: ACCOUNT_RULES };
  const result = game.winner === -1 ? "draw" : game.winner === member.id ? "win" : "loss";
  let reason = "complete";
  if (room.members.filter(m => m.accountId).length < ACCOUNT_RULES.minimumAccounts) reason = "accounts";
  else if ((room.endedAt - room.startedAt) < ACCOUNT_RULES.minimumSeconds * 1000) reason = "short";
  else if (member.forfeited) reason = "forfeit";
  else if ((member.accountActions || 0) < ACCOUNT_RULES.minimumActions) reason = "inactive";
  const xp = reason === "complete" ? ACCOUNT_RULES.finishXp +
    (result === "win" ? ACCOUNT_RULES.winBonus : result === "draw" ? ACCOUNT_RULES.drawBonus : 0) : 0;
  return { matchId: room.matchId, accountId: member.accountId, result, reason, xp, pending: false };
}
export function createAccounts({ fetchKeys = (...args) => fetch(...args) } = {}) {
  let keyCache = [], keysUntil = 0, fetchedAt = 0, loadingKeys;
  const rates = new Map();
  function clientId(env) {
    const value = env.GOOGLE_CLIENT_ID?.trim();
    return value && /^[\w-]+\.apps\.googleusercontent\.com$/.test(value) ? value : null;
  }
  function config(env) { const id = clientId(env); return { enabled: !!id, clientId: id, rules: ACCOUNT_RULES }; }
  function rate(request, now) {
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    let record = rates.get(ip);
    if (!record || now - record.time >= 60000) record = { time: now, count: 0 };
    rates.set(ip, record); record.count++;
    if (rates.size > 4096) for (const [key, item] of rates) if (now - item.time >= 60000) rates.delete(key);
    if (record.count > 20) throw accountError("로그인 요청이 많습니다. 1분 후 다시 시도하세요.", 429);
  }
  async function keys(kid, now) {
    if (now < keysUntil && keyCache.some(k => k.kid === kid)) return keyCache;
    if (now < keysUntil && now - fetchedAt < 60000) return keyCache;
    if (!loadingKeys) loadingKeys = (async () => {
      let response;
      // Workers rejects redirect:"error" before sending the request. Manual
      // redirects preserve the fixed Google origin; non-2xx responses fail below.
      try { response = await fetchKeys(GOOGLE_KEYS, { signal: AbortSignal.timeout(5000), redirect: "manual" }); }
      catch { throw accountError("Google 로그인 확인에 연결하지 못했습니다. 다시 시도하세요.", 503); }
      if (!response.ok) throw accountError("Google 로그인 확인을 잠시 사용할 수 없습니다.", 503);
      const body = await response.json();
      if (!Array.isArray(body.keys) || !body.keys.length) throw accountError("Google 인증 키를 확인하지 못했습니다.", 503);
      keyCache = body.keys.filter(k => k.kty === "RSA" && k.use === "sig" && k.alg === "RS256");
      fetchedAt = now;
      const seconds = Number(response.headers.get("Cache-Control")?.match(/max-age=(\d+)/)?.[1] || 300);
      keysUntil = now + Math.min(3600, Math.max(60, seconds)) * 1000;
      return keyCache;
    })().finally(() => { loadingKeys = null; });
    return loadingKeys;
  }
  async function verify(credential, nonce, env, now) {
    if (typeof credential !== "string" || credential.length > 7000 || !/^[a-f0-9]{64}$/.test(nonce || ""))
      throw accountError("잘못된 Google 로그인 응답입니다.", 401);
    let header, claims, parts;
    try {
      parts = credential.split(".");
      if (parts.length !== 3) throw Error();
      header = JSON.parse(new TextDecoder().decode(accountBytes(parts[0])));
      claims = JSON.parse(new TextDecoder().decode(accountBytes(parts[1])));
    } catch { throw accountError("잘못된 Google 로그인 응답입니다.", 401); }
    const seconds = Math.floor(now / 1000), id = clientId(env);
    if (header?.alg !== "RS256" || typeof header.kid !== "string" || header.kid.length > 200 ||
      !["https://accounts.google.com", "accounts.google.com"].includes(claims?.iss) || claims.aud !== id ||
      (claims.azp && claims.azp !== id) || !Number.isInteger(claims.exp) || claims.exp <= seconds ||
      !Number.isInteger(claims.iat) || claims.iat > seconds + 60 || claims.iat < seconds - 7200 ||
      typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 255 || claims.nonce !== nonce)
      throw accountError("Google 로그인 확인에 실패했습니다. 다시 로그인하세요.", 401);
    const jwk = (await keys(header.kid, now)).find(k => k.kid === header.kid);
    if (!jwk) throw accountError("Google 인증 서명을 확인하지 못했습니다.", 401);
    let valid = false;
    try {
      const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
      valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, accountBytes(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
    } catch {}
    if (!valid) throw accountError("Google 인증 서명을 확인하지 못했습니다.", 401);
    return accountHash("google:" + claims.sub);
  }
  async function profile(db, id) {
    const exists = await db.prepare("SELECT id,google_key FROM accounts WHERE id = ?").bind(id).first();
    if (!exists) throw accountError("다시 로그인하세요.", 401);
    // If storage was interrupted after committing a finished room, the next
    // account visit completes the durable award even when nobody returns to it.
    for (let i = 0; i < 20; i++) {
      const pending = await db.prepare("SELECT payload FROM rooms WHERE json_extract(payload, '$.game.s.phase') = 'over' AND json_extract(payload, '$.matchId') IS NOT NULL AND COALESCE(json_extract(payload, '$.rewardsReady'), 0) = 0 AND EXISTS (SELECT 1 FROM json_each(payload, '$.members') AS member WHERE json_extract(member.value, '$.accountId') = ?) LIMIT 1").bind(id).first();
      if (!pending) break;
      await settle(db, JSON.parse(pending.payload));
    }
    const totals = await db.prepare("SELECT COALESCE(SUM(xp), 0) AS xp, COUNT(*) AS matches, COALESCE(SUM(result = 'win'), 0) AS wins, COALESCE(SUM(result = 'draw'), 0) AS draws FROM match_awards WHERE account_id = ?").bind(id).first();
    return { id, ...(exists.google_key==='school:operator-test:v1'?{isTest:true}:{}), ...accountLevel(totals.xp), matches: totals.matches, wins: totals.wins, draws: totals.draws,
      losses: totals.matches - totals.wins - totals.draws };
  }
  async function session(db, token, now) {
    if (!/^[a-f0-9]{64}$/.test(token || "")) throw accountError("다시 로그인하세요.", 401);
    const hash = await accountHash(token);
    const row = await db.prepare("SELECT account_id, expires,google_key FROM account_sessions JOIN accounts ON accounts.id=account_sessions.account_id WHERE hash = ? AND expires > ?").bind(hash, now).first();
    if (!row) throw accountError("로그인이 만료되었습니다. 다시 로그인하세요.", 401);
    let expires = row.expires;
    // Renew at most once per week; ordinary state polls remain read-only.
    const isTest=row.google_key==='school:operator-test:v1';
    if (!isTest && expires < now + 23 * 86400000) {
      expires = now + ACCOUNT_SESSION_MS;
      await db.prepare('UPDATE account_sessions SET expires = MAX(expires, ?) WHERE hash = ? AND expires > ?').bind(expires, hash, now).run();
    }
    return { id: row.account_id, hash, expires, ...(isTest?{isTest:true}:{}) };
  }
  async function member(request, env, now) {
    const s = await identity(request, env, now);
    if (!s) return null;
    if(s.isTest)throw accountError('운영 테스트 계정은 공개 대전에 참가하지 않습니다.',403);
    return profile(env.DB, s.id);
  }
  async function identity(request, env, now) {
    const token = request.headers.get("X-Account-Session");
    if (!token) return null;
    return session(env.DB, token, now);
  }
  async function route(path, request, data, env, now) {
    if (path === "/api/account/config") return config(env);
    if(path==='/api/account/test-login'){
      if(!request.headers.get('Origin'))throw accountError('게임 화면에서 로그인하세요.',403);
      // A dedicated credential can only access an isolated game-test account.
      // Store only a hash in server configuration, never the code in a bundle.
      const configured=String(env.SCHOOL_TEST_LOGIN_HASH||'');
      if(!/^[a-f0-9]{64}$/.test(configured))throw accountError('운영 테스트 로그인을 준비 중입니다.',503);
      const key='test-login:'+await accountHash(request.headers.get('CF-Connecting-IP')||'unknown')+':'+Math.floor(now/60000)+':';
      await env.DB.prepare('DELETE FROM login_challenges WHERE expires <= ?').bind(now).run();
      const attempt=await env.DB.prepare('INSERT INTO login_challenges(hash,expires) SELECT ?,? WHERE (SELECT COUNT(*) FROM login_challenges WHERE hash LIKE ?)<5').bind(key+accountRandom(),now+60000,key+'%').run();
      if(attempt.meta.changes!==1)throw accountError('요청이 많습니다. 1분 후 다시 시도하세요.',429);
      const raw=typeof data.code==='string'?data.code.trim():'';
      const actual=await accountHash(raw.length<=128?raw:'');let difference=0;
      for(let i=0;i<64;i++)difference|=configured.charCodeAt(i)^actual.charCodeAt(i);
      if(difference||raw.length<24)throw accountError('테스트 접속 코드를 확인해 주세요.',401);
      const keyName='school:operator-test:v1';
      await env.DB.prepare('INSERT OR IGNORE INTO accounts(id,google_key,created_at) VALUES(?,?,?)').bind(accountRandom(),keyName,now).run();
      const account=await env.DB.prepare('SELECT id FROM accounts WHERE google_key=?').bind(keyName).first();
      const token=accountRandom(),expires=now+12*3600000;
      await env.DB.prepare('INSERT INTO account_sessions(hash,account_id,expires) VALUES(?,?,?)').bind(await accountHash(token),account.id,expires).run();
      return {token,expires,profile:await profile(env.DB,account.id)};
    }
    if (!clientId(env)) throw accountError("Google 로그인 연결을 준비 중입니다. 게스트로 플레이할 수 있습니다.", 503);
    if (path === "/api/account/challenge" || path === "/api/account/google") {
      if (!request.headers.get("Origin")) throw accountError("게임 화면에서 로그인하세요.", 403);
      rate(request, now);
    }
    if (path === "/api/account/challenge") {
      const nonce = accountRandom();
      await env.DB.batch([
        env.DB.prepare("DELETE FROM login_challenges WHERE expires <= ?").bind(now),
        env.DB.prepare("DELETE FROM account_sessions WHERE expires <= ?").bind(now),
        env.DB.prepare("INSERT INTO login_challenges (hash, expires) VALUES (?, ?)").bind(await accountHash(nonce), now + CHALLENGE_MS),
      ]);
      return { nonce, expires: now + CHALLENGE_MS };
    }
    if (path === "/api/account/google") {
      const nonceHash = await accountHash(typeof data.nonce === "string" ? data.nonce : "");
      const challenge = await env.DB.prepare("SELECT hash FROM login_challenges WHERE hash = ? AND expires > ?").bind(nonceHash, now).first();
      if (!challenge) throw accountError("로그인 요청이 만료되었습니다. 다시 시도하세요.", 401);
      const googleKey = await verify(data.credential, data.nonce, env, now);
      const used = await env.DB.prepare("DELETE FROM login_challenges WHERE hash = ? AND expires > ?").bind(nonceHash, now).run();
      if (used.meta.changes !== 1) throw accountError("이미 처리한 로그인입니다. 다시 시도하세요.", 401);
      await env.DB.prepare("INSERT OR IGNORE INTO accounts (id, google_key, created_at) VALUES (?, ?, ?)").bind(accountRandom(), googleKey, now).run();
      const account = await env.DB.prepare("SELECT id FROM accounts WHERE google_key = ?").bind(googleKey).first();
      const token = accountRandom(), expires = now + ACCOUNT_SESSION_MS;
      await env.DB.prepare("INSERT INTO account_sessions (hash, account_id, expires) VALUES (?, ?, ?)").bind(await accountHash(token), account.id, expires).run();
      return { token, expires, profile: await profile(env.DB, account.id) };
    }
    const token = request.headers.get("Authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    const signed = await session(env.DB, token, now);
    if (path === "/api/account/me") return { profile: await profile(env.DB, signed.id), expires: signed.expires };
    if (path === "/api/account/logout") {
      await env.DB.prepare("DELETE FROM account_sessions WHERE hash = ?").bind(signed.hash).run();
      return { loggedOut: true };
    }
    if (path === "/api/account/delete") {
      if (data.confirm !== "DELETE") throw accountError("계정 삭제를 확인하세요.");
      await env.DB.batch([
        env.DB.prepare("DELETE FROM account_sessions WHERE account_id = ?").bind(signed.id),
        env.DB.prepare("DELETE FROM match_awards WHERE account_id = ?").bind(signed.id),
        env.DB.prepare("DELETE FROM accounts WHERE id = ?").bind(signed.id),
      ]);
      return { deleted: true };
    }
    throw accountError("지원하지 않는 경로입니다.", 404);
  }
  async function settle(db, room) {
    if (room.game?.s.phase !== "over" || !room.matchId || room.rewardsReady || !room.members.some(m => m.accountId)) return;
    const inserts = room.members.filter(m => m.accountId).map(m => {
      const r = accountReward(room, m);
      return db.prepare("INSERT OR IGNORE INTO match_awards (match_id, account_id, xp, result, reason, created_at) SELECT ?, id, ?, ?, ?, ? FROM accounts WHERE id = ?")
        .bind(room.matchId, r.xp, r.result, r.reason, room.endedAt, m.accountId);
    });
    await db.batch(inserts);
    // Merge the marker with the latest payload: never overwrite a concurrent leave/heartbeat.
    await db.prepare("UPDATE rooms SET payload = json_set(payload, '$.rewardsReady', json('true')), version = version + 1 WHERE code = ? AND json_extract(payload, '$.matchId') = ? AND COALESCE(json_extract(payload, '$.rewardsReady'), 0) = 0")
      .bind(room.code, room.matchId).run();
  }
  async function cleanExpired(db, now) {
    // Keep an interrupted, unsettled award until it has reached the permanent
    // ledger. Room access still expires normally after six hours.
    await db.prepare("DELETE FROM rooms WHERE expires <= ? AND NOT (json_extract(payload, '$.game.s.phase') = 'over' AND json_extract(payload, '$.matchId') IS NOT NULL AND COALESCE(json_extract(payload, '$.rewardsReady'), 0) = 0 AND EXISTS (SELECT 1 FROM json_each(payload, '$.members') AS member WHERE json_extract(member.value, '$.accountId') IS NOT NULL))").bind(now).run();
  }
  return { config, route, member, identity, settle, cleanExpired };
}
