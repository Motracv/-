/* Account UI never calculates or submits a match award. The server owns XP. */
"use strict";
window.DuelAccount = (() => {
  const $ = id => document.getElementById(id);
  let getServer, isPlaying, notify, base = "", token = null, profile = null, config = null;
  let generation = 0, challenge = null, sdkPromise, signing = false, reward = null, resultContext = null;
  const checkedMatches = new Set();
  function store() {
    try {
      if (token) sessionStorage.setItem("card-account:" + base, JSON.stringify({ token }));
      else sessionStorage.removeItem("card-account:" + base);
    } catch {}
  }
  async function request(path, data, authenticated = false) {
    const destination = base, version = generation, usedToken = token;
    const response = await fetch(destination + "/api/account/" + path, {
      method: path === "config" ? "GET" : "POST",
      headers: { "Content-Type": "application/json", ...(authenticated && token ? { Authorization: "Bearer " + token } : {}) },
      ...(path === "config" ? {} : { body: JSON.stringify(data || {}) }),
      signal: AbortSignal.timeout(12000), credentials: "omit", referrerPolicy: "no-referrer",
    });
    const body = await response.json();
    if (version !== generation || destination !== getServer() || (authenticated && usedToken !== token))
      throw Error("계정 연결이 변경되었습니다. 다시 시도하세요.");
    if (!response.ok) throw Object.assign(Error(body.error || "계정에 연결하지 못했습니다."), { status: response.status });
    return body;
  }
  function progress(bar, value) {
    bar.max = value.requiredXp; bar.value = value.levelXp;
    bar.setAttribute("aria-label", `다음 레벨까지 경험치 ${value.levelXp}/${value.requiredXp}`);
  }
  function render() {
    $("account-open").textContent = profile ? `내 계정 · Lv.${profile.level}` : "내 계정 · 레벨";
    $("online-account").textContent = profile ? `Lv.${profile.level} · ${profile.title} · 내 계정` : "게스트 · 계정 연결";
    $("account-member").hidden = !profile;
    $("account-guest").hidden = !!profile;
    $("account-logout").disabled = $("account-delete").disabled = signing || isPlaying();
    $("account-room-note").hidden = !isPlaying();
    if (profile) {
      $("account-level").textContent = "Lv." + profile.level;
      $("account-title").textContent = profile.title;
      $("account-xp-text").textContent = `${profile.levelXp} / ${profile.requiredXp} XP · 누적 ${profile.xp}`;
      progress($("account-xp"), profile);
      $("account-stats").textContent = `${profile.matches}전 · ${profile.wins}승 ${profile.losses}패 ${profile.draws}무`;
      $("account-status").textContent = "Google 계정에 저장됨 · 다른 기기에서도 로그인해 이어집니다.";
    }
    renderResult();
  }
  function renderResult() {
    const box = $("result-xp");
    box.hidden = !resultContext?.online || !config?.enabled;
    if (box.hidden) return;
    box.classList.remove("level-up");
    if (!profile) { box.textContent = "계정을 연결하고 새 방에 입장하면 경험치를 모을 수 있어요."; return; }
    if (!reward) { box.textContent = "이 방은 게스트로 참가했습니다. 다음 방부터 경험치가 기록됩니다."; return; }
    if (reward.pending || !resultContext.finished) { box.textContent = "경기가 끝나면 경험치와 전적이 저장됩니다."; return; }
    const reasons = {
      accounts: "로그인한 참가자 2명부터 경험치가 지급됩니다.", short: "1분 미만 경기는 경험치가 지급되지 않습니다.",
      forfeit: "기권·연결 종료로 경험치가 지급되지 않았습니다.", inactive: "카드 사용·방어·교환·합성 2회부터 경험치가 지급됩니다.",
    };
    if (reward.reason !== "complete") { box.textContent = reasons[reward.reason] || "이번 경기 경험치 없음"; return; }
    const leveled = reward.previousLevel && profile.level > reward.previousLevel;
    box.classList.toggle("level-up", !!leveled);
    box.textContent = `${leveled ? "LEVEL UP! · " : ""}+${reward.xp} XP · Lv.${profile.level} · ${profile.levelXp}/${profile.requiredXp}`;
  }
  async function refreshProfile() {
    if (!token) return;
    try {
      const next = (await request("me", {}, true)).profile;
      if (!profile || next.id !== profile.id || (next.xp >= profile.xp && next.matches >= profile.matches)) profile = next;
      render();
    }
    catch (error) {
      if (error.status === 401) { token = profile = null; store(); render(); }
      throw error;
    }
  }
  function sdk() {
    if (window.google?.accounts?.id) return Promise.resolve();
    if (!sdkPromise) sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client"; script.async = true;
      let timer = setTimeout(() => { script.remove(); sdkPromise = null; reject(Error("Google 로그인 창을 불러오지 못했습니다. 다시 시도하세요.")); }, 12000);
      script.onload = () => { clearTimeout(timer); resolve(); };
      script.onerror = () => { clearTimeout(timer); script.remove(); sdkPromise = null; reject(Error("Google 로그인에 연결하지 못했습니다.")); };
      document.head.append(script);
    });
    return sdkPromise;
  }
  async function prepareLogin() {
    $("google-button").replaceChildren();
    $("account-retry").hidden = true;
    if (!config?.enabled || profile || isPlaying()) return;
    const version = generation;
    try {
      $("account-status").textContent = "Google 로그인 준비 중…";
      const [, fresh] = await Promise.all([sdk(), request("challenge")]);
      if (version !== generation || profile || isPlaying()) return;
      challenge = fresh;
      google.accounts.id.initialize({ client_id: config.clientId, nonce: fresh.nonce, auto_select: false,
        callback: async response => {
          if (version !== generation || signing || isPlaying() || challenge !== fresh) return;
          signing = true; render();
          $("account-status").textContent = "계정 확인 중…";
          try {
            const result = await request("google", { credential: response.credential, nonce: fresh.nonce });
            token = result.token; profile = result.profile; store(); challenge = null;
            $("google-button").replaceChildren(); render(); notify("Google 계정 연결 완료");
          } catch (error) {
            $("account-status").textContent = error.message;
            $("account-retry").hidden = false;
          } finally { signing = false; $("account-logout").disabled = $("account-delete").disabled = isPlaying(); }
        },
      });
      google.accounts.id.renderButton($("google-button"), { type: "standard", theme: "outline", size: "large", text: "signin_with", locale: "ko", width: 260 });
      $("account-status").textContent = "구글 실명과 이메일은 상대에게 공개하지 않습니다.";
    } catch (error) {
      if (version !== generation) return;
      $("account-status").textContent = error.message; $("account-retry").hidden = false;
    }
  }
  async function connect() {
    generation++; base = getServer(); token = profile = config = challenge = reward = null;
    checkedMatches.clear(); $("google-button").replaceChildren();
    try { token = JSON.parse(sessionStorage.getItem("card-account:" + base))?.token || null; } catch {}
    $("account-status").textContent = "계정 연결 확인 중…";
    render();
    try {
      config = await request("config");
      if (token && config.enabled) await refreshProfile();
      if (!config.enabled) $("account-status").textContent = "Google 계정 연결을 준비 중입니다. 지금은 게스트 대전을 이용할 수 있습니다.";
      else if (!profile) $("account-status").textContent = "Google 계정으로 레벨과 전적을 저장하세요.";
      render();
    } catch (error) { $("account-status").textContent = error.message; }
  }
  async function open() {
    $("menu-dialog").close();
    $("account-dialog").showModal(); render();
    if (base !== getServer() || !config) await connect();
    if (token && config?.enabled) {
      try { await refreshProfile(); } catch (error) { $("account-status").textContent = error.message; }
    }
    await prepareLogin();
  }
  async function logout(deleting = false) {
    if (signing || isPlaying() || !token) return;
    if (deleting && !window.confirm("카드게임의 레벨·경험치·전적과 학교용병단의 계정 진행(용병·재화·모험)을 모두 영구 삭제할까요? 이 작업은 되돌릴 수 없습니다.")) return;
    signing = true; render();
    try {
      await request(deleting ? "delete" : "logout", deleting ? { confirm: "DELETE" } : {}, true);
      token = profile = reward = null; store(); googleDisable(); render();
      $("account-status").textContent = deleting ? "게임 계정을 삭제했습니다." : "로그아웃했습니다.";
      await prepareLogin();
    } catch (error) { $("account-status").textContent = error.message; }
    finally { signing = false; render(); }
  }
  function googleDisable() { window.google?.accounts?.id?.disableAutoSelect(); }
  function observe(snapshot) {
    if (!config?.enabled) return;
    const next = snapshot.progression;
    if (!next || !profile || next.accountId !== profile.id) { reward = null; renderResult(); return; }
    if (reward?.matchId !== next.matchId) reward = { ...next, previousLevel: profile.level };
    else Object.assign(reward, next);
    renderResult();
    if (!next.pending && !checkedMatches.has(next.matchId)) {
      checkedMatches.add(next.matchId);
      void refreshProfile().catch(error => {
        checkedMatches.delete(next.matchId);
        $("account-status").textContent = error.message;
      });
    }
  }
  function init(options) {
    ({ getServer, isPlaying, notify } = options);
    $("account-open").onclick = $("online-account").onclick = open;
    $("account-logout").onclick = () => logout();
    $("account-delete").onclick = () => logout(true);
    $("account-retry").onclick = async () => { if (!config) await connect(); await prepareLogin(); };
    void connect();
  }
  return { init, connect, observe,
    headers: () => base === getServer() && token && config?.enabled ? { "X-Account-Session": token } : {},
    result: context => { resultContext = context; renderResult(); },
    clearMatch: () => { reward = resultContext = null; renderResult(); },
  };
})();
