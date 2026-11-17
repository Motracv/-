(() => {
  'use strict';
  let promptEvent, registration, registering = false, error = false;
  let prompting = false, guideOpen = false, installMessage = '';
  const standalone = () => (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches) || navigator.standalone === true;
  const targets = new Set();
  const element = (tag, className, text) => {
    const node = document.createElement(tag); node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  function refresh() { for (const node of targets) { if (!node.isConnected) targets.delete(node); else renderControls(node); } }
  function renderControls(container) {
    if (!container) return;
    targets.add(container); container.className = 'install-controls'; container.replaceChildren();
    const title = element('strong', 'install-title', standalone() ? '앱으로 실행 중' : '학교용병단 앱 설치');
    container.append(title);
    if (!standalone()) {
      const button = element('button', 'primary full install-button', prompting ? '설치 창 확인 중…' : '앱 설치 · 다시 시도'); button.type = 'button';
      button.disabled = prompting;
      button.setAttribute('aria-controls', 'school-install-guide');
      button.setAttribute('aria-expanded', String(guideOpen));
      button.addEventListener('click', async () => {
        if (prompting) return;
        const event = promptEvent;
        if (!event) {
          guideOpen = true; installMessage = '브라우저의 설치 메뉴로 다시 설치할 수 있어요.';
          refresh(); container.querySelector('.install-guide')?.focus(); return;
        }
        // The browser grants each event one use. Keep our entry point available
        // after dismissal and use a newly granted event for the next prompt.
        promptEvent = null; prompting = true; guideOpen = false;
        installMessage = '설치 창에서 진행해 주세요.'; refresh();
        try {
          await event.prompt(); const choice = await event.userChoice;
          guideOpen = true;
          installMessage = choice?.outcome === 'accepted'
            ? '설치 요청을 보냈어요. 완료되면 학교용병단 아이콘으로 실행해 주세요.'
            : '설치를 취소했어요. 아래 안내로 다시 설치할 수 있어요.';
        } catch {
          guideOpen = true; installMessage = '설치 창을 열지 못했어요. 아래 안내로 다시 시도해 주세요.';
        } finally {
          prompting = false; refresh();
          if (guideOpen && container.isConnected) container.querySelector('.install-guide')?.focus();
        }
      });
      container.append(button);
    }
    let instruction;
    if (standalone()) instruction = '홈 화면에서 바로 모험을 이어갈 수 있어요.';
    else if (/iPhone|iPad|iPod/.test(navigator.userAgent) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
      instruction = 'Safari의 공유 버튼 → 홈 화면에 추가 → 추가를 눌러 주세요.';
    else if (/Android/.test(navigator.userAgent)) instruction = 'Chrome 메뉴(⋮) → 앱 설치 또는 홈 화면에 추가를 눌러 주세요.';
    else instruction = 'Chrome·Edge 주소창의 설치 아이콘 또는 브라우저 메뉴에서 앱을 설치할 수 있어요.';
    container.append(element('p', 'install-help', instruction));
    if (!standalone()) {
      const status = element('p', 'install-status', installMessage); status.setAttribute('role', 'status');
      const guide = element('div', 'install-guide'); guide.id = 'school-install-guide'; guide.hidden = !guideOpen; guide.tabIndex = -1;
      guide.append(element('strong', '', '다시 설치하는 방법'), element('p', '', instruction));
      guide.append(element('p', '', '이미 설치했다면 홈 화면이나 앱 목록의 학교용병단 아이콘으로 실행해 주세요. 설치 창을 취소한 뒤에는 브라우저가 바로 다시 띄우지 않을 수 있어요.'));
      container.append(status, guide);
    }
    container.append(element('p', 'install-launch', '설치한 앱은 홈페이지를 거치지 않고 학교용병단 게임으로 바로 열려요.'));
    const offline = registration?.active ? '게스트는 오프라인에서도 플레이할 수 있어요. 계정 저장·랭킹에는 인터넷이 필요해요.'
      : error ? '오프라인 준비를 완료하지 못했어요. 연결 후 게임을 다시 열어 주세요.'
      : registering ? '오프라인 실행 파일을 준비하고 있어요…' : '처음에는 인터넷에 연결해 실행해 주세요.';
    container.append(element('p', 'install-state', offline));
    if (registration?.waiting) container.append(element('p', 'install-update', '새 버전이 준비됐어요. 게임 창을 모두 닫고 다시 열면 적용됩니다.'));
  }
  window.SchoolInstall = Object.freeze({renderControls});
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); promptEvent = event; refresh(); });
  window.addEventListener('appinstalled', () => { promptEvent = null; installMessage = '설치가 완료됐어요. 학교용병단 아이콘으로 게임을 실행해 주세요.'; refresh(); });
  matchMedia('(display-mode: standalone)').addEventListener?.('change', refresh);
  async function prepare() {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) { error = true; refresh(); return; }
    registering = true; refresh();
    try {
      registration = await navigator.serviceWorker.register('school-sw.js', {scope:'./school.html', updateViaCache:'none'});
      const watch = worker => {
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'redundant' && !registration.active) { error = true; registering = false; }
          refresh();
        });
      };
      watch(registration.installing);
      registration.addEventListener('updatefound', () => watch(registration.installing));
      navigator.serviceWorker.addEventListener('controllerchange', refresh);
      navigator.serviceWorker.ready.then(ready => { registration = ready; registering = false; refresh(); });
    } catch { registering = false; error = true; refresh(); }
  }
  const schedule = () => { if ('requestIdleCallback' in window) requestIdleCallback(prepare, {timeout:3000}); else setTimeout(prepare, 1000); };
  if (document.readyState === 'complete') schedule(); else window.addEventListener('load', schedule, {once:true});
})();
