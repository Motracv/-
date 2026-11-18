/* A small DOM lobby. Combat and saving remain in the existing game client. */
window.SchoolLobby = (() => {
  'use strict';
  function create(container, {game, art}) {
    let partyKey = '', captainId = '', ready = false;
    const slots = new Map();
    const text = (id, value) => {
      const node = document.getElementById(id), next = String(value);
      if (node && node.textContent !== next) node.textContent = next;
    };
    const show = (id, value) => {
      const node = document.getElementById(id);
      if (node && node.hidden === value) node.hidden = !value;
    };
    function render(state, now = Date.now(), questBoard) {
      if (!state) return;
      const key = state.team.join('|');
      if (key !== partyKey || !ready) {
        ready = true; partyKey = key; slots.clear();
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < (game.MAX_TEAM || 6); i++) {
          const id = state.team[i], definition = game.BY_ID[id];
          const button = document.createElement('button');
          button.type = 'button'; button.className = 'lobby-unit';
          button.dataset.lobbySlot = String(i);
          if (definition && state.units[id]) {
            button.dataset.hero = id; button.dataset.rarity = definition.rarity;
            button.innerHTML = '<span class="lobby-unit-label"><small></small><b></b></span><span class="lobby-stars" aria-hidden="true"></span><img class="lobby-sprite" alt="" draggable="false">';
            button.querySelector('b').textContent = definition.name;
            button.querySelector('img').src = art.portrait(id);
            slots.set(id, button);
          } else {
            button.classList.add('empty'); button.dataset.tab = 'roster';
            button.setAttribute('aria-label', `${i + 1}번 빈자리 · 출전 용병 편성`);
            button.innerHTML = '<span class="empty-sigil" aria-hidden="true">+</span><span class="empty-lobby-label">동료 배치</span>';
          }
          fragment.append(button);
        }
        container.replaceChildren(fragment);
      }
      for (const [id, button] of slots) {
        const unit = state.units[id], definition = game.BY_ID[id];
        const label = `Lv.${unit.level}`, stars = '★'.repeat(Math.max(0, Math.min(5, unit.stars || 0)));
        if (button.querySelector('small').textContent !== label) button.querySelector('small').textContent = label;
        if (button.querySelector('.lobby-stars').textContent !== stars) button.querySelector('.lobby-stars').textContent = stars;
        const description = `${definition.name} Lv.${unit.level} · ${unit.stars || 0}성 · 눌러서 육성`;
        if (button.getAttribute('aria-label') !== description) button.setAttribute('aria-label', description);
      }
      const leader = state.team[0], appearance=game.profileInfo(state), identity=[leader,appearance.avatar,appearance.title].join('|');
      if (leader && identity !== captainId) {
        captainId = identity;
        const image=document.getElementById('captain-portrait'),custom=document.getElementById('captain-custom-avatar'),label=document.getElementById('captain-title');
        image.src=art.portrait(leader);image.hidden=appearance.avatar!=='leader';custom.hidden=appearance.avatar==='leader';
        custom.innerHTML=appearance.avatar==='leader'?'':window.SchoolGuild.avatar(appearance,leader);
        label.innerHTML=window.SchoolGuild.title(appearance);label.hidden=!appearance.title;
        document.getElementById('captain-button').classList.toggle('has-title',!!appearance.title);
      }
      const next = Math.min(game.MAX_STAGE, state.best + 1);
      text('lobby-party-count', `${state.team.length} / ${game.MAX_TEAM || 6}`);
      text('lobby-next-stage', game.stageName(next));
      text('lobby-next-name', game.CHAPTERS[game.chapter(next)]);
      const title = document.querySelector('#lobby-next > span');
      const nextTitle = state.best >= game.MAX_STAGE ? '모든 지역 돌파' : '다음 지역 도전';
      if (title && title.textContent !== nextTitle) title.textContent = nextTitle;
      const active = state.battle.activity;
      text('lobby-battle-label', active ? (state.activities?.run?.settled ? '던전 결과 확인' : '던전 전투 보기') : `${game.stageName(state.battle.stage)} · 전투 보기`);
      const questReady = (questBoard?.readyCount ?? game.questReady(state, now)) > 0;
      show('lobby-quest-dot', questReady);
      show('lobby-recruit-dot', state.gems >= game.SSR_RECRUIT_COST[10]);
      show('lobby-supply-dot', !!state.offline.seconds || state.daily < game.day(now) || questReady);
    }
    function invalidate() { ready = false; captainId = ''; }
    return {render, invalidate};
  }
  return {create};
})();
