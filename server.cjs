"use strict";
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { Game } = require("./engine.js");
const rooms = new Map(),
  sessions = new Map();
const PORT = Number(process.env.PORT || 8787),
  publicOrigin = process.env.ALLOWED_ORIGIN || "https://motracv.github.io";
const id = () => crypto.randomBytes(24).toString("hex");
function json(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}
function memberView(room, m) {
  return {
    code: room.code,
    host: room.host,
    started: !!room.game,
    players: room.members.map((x) => ({
      id: x.id,
      name: x.name,
      connected: !!x.stream,
    })),
    me: m.id,
    ...(room.game ? { game: room.game.view(m.id) } : {}),
  };
}
function disconnect(m) {
  const stream = m.stream;
  m.stream = null;
  m.lastSeen = Date.now();
  stream?.end();
}
function writeStream(m, message) {
  // A paused/abandoned client must not grow an unlimited server-side buffer.
  if (!m.stream) return;
  if (m.stream.destroyed || m.stream.writableLength > 128 * 1024) {
    disconnect(m);
    return;
  }
  try {
    m.stream.write(message);
  } catch {
    disconnect(m);
  }
}
function broadcast(room) {
  for (const m of room.members)
    writeStream(m, `data: ${JSON.stringify(memberView(room, m))}\n\n`);
}
function auth(req) {
  const token = req.headers.authorization?.replace(/^Bearer /, "");
  const session = sessions.get(token);
  if (
    !session ||
    rooms.get(session.room.code) !== session.room ||
    !session.room.members.includes(session.m) ||
    session.m.left
  )
    throw Error("다시 입장하세요.");
  return session;
}
function removeLobbyMembers(room, removed) {
  for (const m of removed) {
    sessions.delete(m.token);
    disconnect(m);
  }
  const oldHost = room.members.find((m) => m.id === room.host);
  room.members = room.members.filter((m) => !removed.includes(m));
  room.members.forEach((m, i) => {
    m.id = i;
  });
  room.host = room.members.includes(oldHost) ? oldHost.id : 0;
  if (!room.members.length) rooms.delete(room.code);
}
function forfeit(room, m, reason) {
  if (room.game.s.phase === "over" || room.game.player(m.id).hp <= 0) return;
  room.game.log(`${m.name} ${reason}`);
  room.game.forfeit(m.id);
}
async function body(req) {
  let data = "";
  for await (const part of req) {
    data += part;
    if (data.length > 8192) throw Error("요청이 너무 큽니다.");
  }
  return JSON.parse(data || "{}");
}
function join(room, name) {
  if (room.game) throw Error("이미 시작한 방입니다.");
  if (room.members.length >= 5) throw Error("방이 가득 찼습니다.");
  const m = {
    id: room.members.length,
    name,
    token: id(),
    lastSeen: Date.now(),
    stream: null,
    lastAction: 0,
  };
  room.members.push(m);
  sessions.set(m.token, { room, m });
  return m;
}
const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin) {
    if (
      origin !== publicOrigin &&
      origin !== `http://localhost:${PORT}` &&
      origin !== `http://127.0.0.1:${PORT}`
    ) {
      json(res, 403, { error: "허용되지 않는 출처입니다." });
      return;
    }
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type",
    );
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  try {
    const u = new URL(req.url, "http://localhost");
    if (
      req.method === "POST" &&
      ["/api/create", "/api/join"].includes(u.pathname)
    ) {
      const data = await body(req),
        name = String(data.name || "").trim();
      if (!name || name.length > 16)
        throw Error("닉네임은 1~16자로 입력하세요.");
      let room;
      if (u.pathname === "/api/create") {
        if (rooms.size >= 1000) throw Error("서버의 방이 가득 찼습니다.");
        let code;
        do {
          code = crypto
            .randomBytes(4)
            .toString("hex")
            .slice(0, 6)
            .toUpperCase();
        } while (rooms.has(code));
        room = {
          code,
          host: 0,
          members: [],
          game: null,
          created: Date.now(),
          active: Date.now(),
        };
        rooms.set(code, room);
      } else {
        room = rooms.get(String(data.code || "").toUpperCase());
        if (!room) throw Error("초대 코드를 확인하세요.");
      }
      const m = join(room, name);
      json(res, 200, { token: m.token, ...memberView(room, m) });
      broadcast(room);
      return;
    }
    if (u.pathname === "/api/events" && req.method === "GET") {
      // Streaming fetch uses an authorization header; tokens never appear in URLs.
      const { room, m } = auth(req);
      if (m.stream) disconnect(m);
      m.lastSeen = Date.now();
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-store",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      m.stream = res;
      broadcast(room);
      res.on("close", () => {
        if (m.stream === res) {
          m.stream = null;
          m.lastSeen = Date.now();
          broadcast(room);
        }
      });
      return;
    }
    if (
      req.method === "POST" &&
      ["/api/start", "/api/action", "/api/heartbeat", "/api/leave"].includes(
        u.pathname,
      )
    ) {
      const data = await body(req);
      // Membership may change while a slow request body is arriving.
      const { room, m } = auth(req);
      m.lastSeen = Date.now();
      room.active = Date.now();
      if (u.pathname === "/api/start") {
        if (m.id !== room.host) throw Error("방장만 시작할 수 있습니다.");
        if (room.game) throw Error("이미 시작했습니다.");
        if (room.members.length < 2) throw Error("2명 이상 필요합니다.");
        if (room.members.some((x) => !x.stream))
          throw Error("모두 연결한 뒤 시작하세요.");
        room.game = new Game(
          room.members.map((x) => x.name),
          { rng: () => crypto.randomInt(0, 0x100000000) / 0x100000000 },
        );
      }
      if (u.pathname === "/api/action") {
        if (!room.game) throw Error("아직 시작하지 않았습니다.");
        if (Date.now() - m.lastAction < 100)
          throw Error("잠시 후 다시 시도하세요.");
        if (!Number.isInteger(data.revision))
          throw Error("게임 상태를 새로 받으세요.");
        const before = room.game.s.revision;
        room.game.timeout();
        if (before !== room.game.s.revision) broadcast(room);
        room.game.action(m.id, data);
        m.lastAction = Date.now();
      }
      if (u.pathname === "/api/leave") {
        if (room.game) {
          forfeit(room, m, "기권");
          m.left = true;
          sessions.delete(m.token);
          disconnect(m);
        } else removeLobbyMembers(room, [m]);
        json(res, 200, { left: true });
        broadcast(room);
        return;
      }
      json(res, 200, memberView(room, m));
      broadcast(room);
      return;
    }
    if (u.pathname === "/health") {
      json(res, 200, { ok: true });
      return;
    }
    if (u.pathname === "/api/account/config" && req.method === "GET") {
      json(res, 200, { enabled: false, clientId: null });
      return;
    }
    if (req.method === "GET") {
      const files = {
        "/": "game.html",
        "/game.html": "game.html",
        "/engine.js": "engine.js",
        "/client.js": "client.js",
        "/game.css": "game.css",
        "/effects.js": "effects.js",
        "/sound.js": "sound.js",
        "/account.js": "account.js",
        "/privacy.html": "privacy.html",
        "/school.html": "school.html",
        "/school/engine.js": "school/engine.js",
        "/school/art.js": "school/art.js",
        "/school/client.js": "school/client.js",
        "/school/style.css": "school/style.css",
        "/school/presentation.js": "school/presentation.js",
        "/school/presentation.css": "school/presentation.css",
        "/school/assets/lava.png": "school/assets/lava.png",
        "/school/assets/dungeon-daily.png": "school/assets/dungeon-daily.png",
        "/school/assets/dungeon-weekly.png": "school/assets/dungeon-weekly.png",
        "/school/assets/dungeon-tower.png": "school/assets/dungeon-tower.png",
        "/school/assets/osia-sprites.png": "school/assets/osia-sprites.png",
        "/effects.css": "effects.css",
        "/assets/cards/manifest.json": "assets/cards/manifest.json",
        "/assets/fonts/PretendardVariable.woff2":
          "assets/fonts/PretendardVariable.woff2",
        "/assets/fonts/OFL.txt": "assets/fonts/OFL.txt",
        "/assets/fonts/Galmuri11.woff2": "assets/fonts/Galmuri11.woff2",
        "/assets/fonts/Galmuri-OFL.txt": "assets/fonts/Galmuri-OFL.txt",
      };
      let file = files[u.pathname];
      if (/^\/assets\/cards\/\d{2}\.webp$/.test(u.pathname))
        file = u.pathname.slice(1);
      if (!file) {
        json(res, 404, { error: "Not found" });
        return;
      }
      const target = path.join(__dirname, file);
      if (!fs.existsSync(target)) {
        json(res, 404, { error: "Not found" });
        return;
      }
      res.setHeader(
        "Content-Type",
        file.endsWith(".woff2")
          ? "font/woff2"
          : file.endsWith(".txt")
            ? "text/plain; charset=utf-8"
            : file.endsWith(".js")
              ? "text/javascript; charset=utf-8"
              : file.endsWith(".css")
                ? "text/css"
                : file.endsWith(".png")
                  ? "image/png"
                : file.endsWith(".webp")
                  ? "image/webp"
                  : file.endsWith(".json")
                    ? "application/json"
                    : "text/html; charset=utf-8",
      );
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.end(fs.readFileSync(target));
      return;
    }
    json(res, 404, { error: "Not found" });
  } catch (e) {
    json(res, 400, { error: e.message });
  }
});
function tickRooms() {
  for (const [code, room] of rooms) {
    if (!room.game) {
      const stale = room.members.filter(
        (m) => !m.stream && Date.now() - m.lastSeen > 90000,
      );
      if (stale.length) {
        removeLobbyMembers(room, stale);
        broadcast(room);
      }
    }
    if (room.game && room.game.s.phase !== "over") {
      try {
        const old = room.game.s.revision;
        for (const m of room.members) {
          if (!m.stream && Date.now() - m.lastSeen > 90000)
            forfeit(room, m, "연결 종료로 탈락");
        }
        room.game.timeout();
        if (old !== room.game.s.revision) broadcast(room);
      } catch (e) {
        console.error("Room tick error", code, e.message);
      }
    }
    for (const m of room.members) writeStream(m, ": heartbeat\n\n");
    if (Date.now() - room.active > 6 * 3600000) {
      for (const m of room.members) {
        sessions.delete(m.token);
        disconnect(m);
      }
      rooms.delete(code);
    }
  }
}
const tick = setInterval(tickRooms, 1000);
if (require.main === module)
  server.listen(PORT, "0.0.0.0", () =>
    console.log(`Card server listening on ${PORT}`),
  );
module.exports = {
  server,
  rooms,
  sessions,
  tickRooms,
  stop: () => {
    clearInterval(tick);
    for (const room of rooms.values())
      for (const m of room.members) disconnect(m);
    rooms.clear();
    sessions.clear();
    server.close();
  },
};
