// Cloudflare Worker + D1. Every room change uses optimistic compare-and-swap.
// Only Game.view(actor), never a persisted game or member token, reaches a client.
const TTL = 6 * 60 * 60 * 1000;
const GRACE = 90000;
const MAX_BODY = 8192;
class RequestError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const requireValue = (ok, message, status) => {
  if (!ok) throw new RequestError(message, status);
};
function randomHex(bytes) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
}
function secureRandom() {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
}
function sameToken(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  let different = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    different |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return different === 0;
}
async function readBody(request) {
  requireValue(
    Number(request.headers.get("Content-Length") || 0) <= MAX_BODY,
    "요청이 너무 큽니다.",
    413,
  );
  let length = 0,
    parts = [];
  const reader = request.body?.getReader();
  if (reader)
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY) {
        await reader.cancel();
        throw new RequestError("요청이 너무 큽니다.", 413);
      }
      parts.push(value);
    }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  let data;
  try {
    data = JSON.parse(new TextDecoder().decode(bytes) || "{}");
  } catch {
    throw new RequestError("잘못된 JSON입니다.");
  }
  requireValue(
    data && typeof data === "object" && !Array.isArray(data),
    "잘못된 요청입니다.",
  );
  return data;
}
function tokenFor(request) {
  const token = request.headers
    .get("Authorization")
    ?.match(/^Bearer ([A-F0-9]{6}\.[a-f0-9]{48})$/)?.[1];
  requireValue(token, "다시 입장하세요.", 401);
  return token;
}
const gameKeys = [
  "s",
  "serial",
  "afterQueue",
  "skipping",
  "resumePhase",
  "resumeDeadline",
];
function saveGame(game) {
  return Object.fromEntries(
    gameKeys.filter((k) => game[k] !== undefined).map((k) => [k, game[k]]),
  );
}
function restoreGame(Game, data, now) {
  if (!data) return null;
  return Object.assign(Object.create(Game.prototype), data, {
    rng: secureRandom,
    now: () => now,
    turnMs: 45000,
    responseMs: 20000,
  });
}
function removeLobby(room, removed) {
  const hostToken = room.members.find((m) => m.id === room.host)?.token;
  room.members = room.members.filter((m) => !removed.includes(m));
  room.members.forEach((m, i) => (m.id = i));
  room.host = room.members.find((m) => m.token === hostToken)?.id ?? 0;
}
function maintenance(room, game, now) {
  if (!game) {
    removeLobby(
      room,
      room.members.filter((m) => now - m.lastSeen > GRACE),
    );
    return;
  }
  for (const member of room.members)
    if (
      !member.left &&
      now - member.lastSeen > GRACE &&
      game.player(member.id).hp > 0 &&
      game.s.phase !== "over"
    ) {
      game.log(`${member.name} 연결 종료로 탈락`);
      game.forfeit(member.id);
    }
  game.timeout();
}
function snapshot(room, game, member, now) {
  return {
    code: room.code,
    host: room.host,
    started: !!game,
    me: member.id,
    transport: "poll",
    players: room.members.map((m) => ({
      id: m.id,
      name: m.name,
      connected: !m.left && now - m.lastSeen < 15000,
    })),
    ...(game ? { game: game.view(member.id) } : {}),
  };
}
export function createWorker(Battle) {
  const { Game } = Battle;
  // Best-effort abuse brake per live isolate, supplemented by hard body/room TTL limits.
  const entryRates = new Map();
  function limitEntry(request, now) {
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const prior = entryRates.get(ip),
      rate =
        prior && now - prior.since < 60000 ? prior : { since: now, count: 0 };
    rate.count++;
    entryRates.set(ip, rate);
    if (entryRates.size > 4096)
      for (const [key, value] of entryRates)
        if (now - value.since >= 60000) entryRates.delete(key);
    requireValue(
      rate.count <= 30,
      "입장 요청이 너무 많습니다. 잠시 후 다시 시도하세요.",
      429,
    );
  }
  async function mutate(db, code, operation) {
    for (let attempt = 0; attempt < 12; attempt++) {
      const now = Date.now();
      const row = await db
        .prepare("SELECT payload, version, expires FROM rooms WHERE code = ?")
        .bind(code)
        .first();
      requireValue(
        row && row.expires > now,
        "방이 없거나 종료되었습니다.",
        404,
      );
      const room = JSON.parse(row.payload),
        game = restoreGame(Game, room.game, now);
      maintenance(room, game, now);
      let result, failure;
      try {
        result = await operation(room, game, now);
      } catch (error) {
        failure = error;
      }
      if (game) room.game = saveGame(game);
      const payload = JSON.stringify(room);
      // Polls may return a consistent snapshot without writing. Heartbeats are
      // coalesced below, so five clients cannot continuously invalidate an action.
      if (payload === row.payload) {
        if (failure) throw failure;
        return result;
      }
      const changed = await db
        .prepare(
          "UPDATE rooms SET payload = ?, version = version + 1 WHERE code = ? AND version = ? AND expires > ?",
        )
        .bind(payload, code, row.version, now)
        .run();
      if (changed.meta.changes === 1) {
        if (failure) throw failure;
        return result;
      }
      // Desynchronize clients that read the same room version at once.
      if (attempt < 11)
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            15 + Math.floor(secureRandom() * 60 * Math.min(attempt + 1, 3)),
          ),
        );
    }
    throw new RequestError("방 상태가 갱신 중입니다. 다시 시도하세요.", 409);
  }
  return {
    async fetch(request, env) {
      const url = new URL(request.url),
        origin = request.headers.get("Origin");
      const allowed =
        origin === url.origin ||
        origin === "https://motracv.github.io" ||
        (env.ALLOWED_ORIGIN && origin === env.ALLOWED_ORIGIN);
      const headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      };
      if (allowed)
        Object.assign(headers, {
          "Access-Control-Allow-Origin": origin,
          Vary: "Origin",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        });
      const reply = (value, status = 200) =>
        new Response(JSON.stringify(value), { status, headers });
      if (origin && !allowed)
        return reply({ error: "허용되지 않는 출처입니다." }, 403);
      if (request.method === "OPTIONS")
        return new Response(null, { status: 204, headers });
      try {
        if (url.pathname === "/health")
          return reply({ ok: true, transport: "poll" });
        requireValue(
          request.method === "POST",
          "지원하지 않는 요청입니다.",
          405,
        );
        requireValue(env.DB, "게임 저장소가 설정되지 않았습니다.", 503);
        const routes = [
          "/api/create",
          "/api/join",
          "/api/start",
          "/api/action",
          "/api/state",
          "/api/heartbeat",
          "/api/leave",
        ];
        requireValue(
          routes.includes(url.pathname),
          "지원하지 않는 경로입니다.",
          404,
        );
        const data = await readBody(request),
          now = Date.now();
        if (["/api/create", "/api/join"].includes(url.pathname)) {
          limitEntry(request, now);
          requireValue(
            typeof data.name === "string" &&
              data.name.trim().length > 0 &&
              data.name.trim().length <= 16,
            "닉네임은 1~16자로 입력하세요.",
          );
          const name = data.name.trim();
          if (url.pathname === "/api/create") {
            await env.DB.prepare("DELETE FROM rooms WHERE expires <= ?")
              .bind(now)
              .run();
            const count = await env.DB.prepare(
              "SELECT COUNT(*) AS count FROM rooms",
            ).first();
            requireValue(count.count < 1000, "서버의 방이 가득 찼습니다.", 503);
            for (let attempt = 0; attempt < 8; attempt++) {
              const code = randomHex(3).toUpperCase(),
                token = code + "." + randomHex(24),
                member = {
                  id: 0,
                  name,
                  token,
                  lastSeen: now,
                  lastAction: 0,
                  left: false,
                };
              const room = {
                code,
                host: 0,
                members: [member],
                game: null,
                created: now,
              };
              const inserted = await env.DB.prepare(
                "INSERT OR IGNORE INTO rooms (code, payload, version, expires) VALUES (?, ?, 0, ?)",
              )
                .bind(code, JSON.stringify(room), now + TTL)
                .run();
              if (inserted.meta.changes === 1)
                return reply({ token, ...snapshot(room, null, member, now) });
            }
            throw new RequestError(
              "방을 만들지 못했습니다. 다시 시도하세요.",
              503,
            );
          }
          requireValue(
            typeof data.code === "string" && /^[a-fA-F0-9]{6}$/.test(data.code),
            "초대 코드를 확인하세요.",
          );
          const code = data.code.toUpperCase(),
            token = code + "." + randomHex(24);
          const result = await mutate(env.DB, code, (room, game, now) => {
            requireValue(!game, "이미 시작한 방입니다.");
            requireValue(room.members.length < 5, "방이 가득 찼습니다.");
            const member = {
              id: room.members.length,
              name,
              token,
              lastSeen: now,
              lastAction: 0,
              left: false,
            };
            room.members.push(member);
            return { token, ...snapshot(room, null, member, now) };
          });
          return reply(result);
        }
        const token = tokenFor(request),
          code = token.split(".")[0];
        const result = await mutate(env.DB, code, (room, game, now) => {
          const member = room.members.find(
            (m) => sameToken(m.token, token) && !m.left,
          );
          requireValue(member, "다시 입장하세요.", 401);
          const polling = ["/api/state", "/api/heartbeat"].includes(
            url.pathname,
          );
          if (!polling || now - member.lastSeen >= 5000) member.lastSeen = now;
          if (["/api/state", "/api/heartbeat"].includes(url.pathname))
            return snapshot(room, game, member, now);
          if (url.pathname === "/api/start") {
            requireValue(member.id === room.host, "방장만 시작할 수 있습니다.");
            requireValue(!game, "이미 시작했습니다.");
            requireValue(
              room.members.length >= 2 && room.members.length <= 5,
              "2~5명이 필요합니다.",
            );
            requireValue(
              room.members.every((m) => now - m.lastSeen < 15000),
              "모두 연결한 뒤 시작하세요.",
            );
            game = new Game(
              room.members.map((m) => m.name),
              {
                rng: secureRandom,
                now: () => now,
                turnMs: 45000,
                responseMs: 20000,
              },
            );
            room.game = saveGame(game);
            return snapshot(room, game, member, now);
          }
          if (url.pathname === "/api/action") {
            requireValue(game, "아직 시작하지 않았습니다.");
            requireValue(
              Number.isInteger(data.revision),
              "게임 상태를 새로 받으세요.",
            );
            requireValue(
              now - member.lastAction >= 100,
              "잠시 후 다시 시도하세요.",
              429,
            );
            game.action(member.id, data);
            member.lastAction = now;
            return snapshot(room, game, member, now);
          }
          if (game) {
            if (game.s.phase !== "over" && game.player(member.id).hp > 0) {
              game.log(`${member.name} 기권`);
              game.forfeit(member.id);
            }
            member.left = true;
          } else removeLobby(room, [member]);
          return { left: true };
        });
        return reply(result);
      } catch (error) {
        return reply(
          {
            error: error.status
              ? error.message
              : error instanceof TypeError || error.message?.includes("D1_")
                ? "서버 요청을 처리하지 못했습니다."
                : error.message || "서버 오류",
          },
          error.status || 400,
        );
      }
    },
  };
}
