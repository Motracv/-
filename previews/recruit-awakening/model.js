(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RecruitPreviewModel = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const RANK = Object.freeze({ R: 0, SR: 1, SSR: 2, UR: 3 });
  const ART = '../../school/assets/';
  const HEROES = Object.freeze({
    horas: { id: 'horas', name: '호라스', rarity: 'UR', title: '벚꽃의 의식', greeting: '좋은 꿈 꿨어요, 단장님? 이제 저와 함께 가요.', reveal: 'assets/horas-greeting.webp', wake: 'assets/horas-wake.webp', profile: ART + 'bonds/horas-profile.webp' },
    osia: { id: 'osia', name: '오시아', rarity: 'SSR', title: '물의 용왕', greeting: '드디어 일어났네! 기다리고 있었어, 단장.', reveal: 'assets/osia-greeting.webp', wake: 'assets/osia-greeting.webp', profile: ART + 'bonds/osia-profile.webp' },
    nari: { id: 'nari', name: '나리', rarity: 'SR', title: '작은 치유곡', greeting: '잘 주무셨어요? 오늘도 제가 곁에 있을게요.', reveal: 'assets/nari-greeting.webp', wake: 'assets/nari-greeting.webp', sheet: 'students-a', row: 1 },
    geonu: { id: 'geonu', name: '건우', rarity: 'SR', sheet: 'students-a', row: 0 },
    harin: { id: 'harin', name: '하린', rarity: 'SR', sheet: 'students-a', row: 2 },
    taeo: { id: 'taeo', name: '태오', rarity: 'R', sheet: 'students-b', row: 0 },
    yuna: { id: 'yuna', name: '유나', rarity: 'R', sheet: 'students-b', row: 1 },
    minjae: { id: 'minjae', name: '민재', rarity: 'R', sheet: 'students-b', row: 2 },
    sua: { id: 'sua', name: '수아', rarity: 'R', sheet: 'students-b', row: 3 }
  });
  const SCENARIOS = Object.freeze({
    UR: ['minjae', 'nari', 'osia', 'geonu', 'horas', 'sua', 'harin', 'nari', 'taeo', 'yuna'],
    SSR: ['minjae', 'sua', 'taeo', 'osia', 'harin', 'yuna', 'geonu', 'nari', 'minjae', 'taeo'],
    SR: ['minjae', 'nari', 'taeo', 'geonu', 'sua', 'yuna', 'harin', 'nari', 'minjae', 'taeo']
  });
  const MARKS = Object.freeze({ sleep: 1, approach: 3.7, wake: 5.9, opening: 8.2, reveal: 9.5, hold: 11.2 });
  function highest(results) {
    if (!Array.isArray(results) || !results.length) throw new Error('모집 결과가 없어요.');
    let best = null;
    for (const entry of results) {
      const hero = typeof entry === 'string' ? HEROES[entry] : entry;
      if (!hero || !Object.hasOwn(RANK, hero.rarity)) throw new Error('알 수 없는 모집 결과예요.');
      // Equal rarity keeps the first received result: no random reroll on replay.
      if (!best || RANK[hero.rarity] > RANK[best.rarity]) best = hero;
    }
    return best;
  }
  function scenario(rarity) {
    if (!Object.hasOwn(SCENARIOS, rarity)) throw new Error('지원하지 않는 미리보기예요.');
    return SCENARIOS[rarity].map(id => ({ ...HEROES[id] }));
  }
  function phaseAt(time) {
    if (time >= MARKS.hold) return 'hold';
    if (time >= MARKS.reveal) return 'reveal';
    if (time >= MARKS.opening) return 'opening';
    if (time >= MARKS.wake) return 'wake';
    if (time >= MARKS.approach) return 'approach';
    if (time >= MARKS.sleep) return 'sleep';
    return 'blackout';
  }
  // One clock drives every visual. Hide/resume never skips the reveal, and low
  // frame rates do not enqueue timers or spawn duplicate callbacks.
  function createClock() {
    let time = 0, last = null, running = false;
    return {
      start() { time = 0; last = null; running = true; },
      pause() { running = false; last = null; },
      resume() { if (time < MARKS.hold) running = true; last = null; },
      seek(value) { time = Math.max(0, Math.min(MARKS.hold, Number(value) || 0)); last = null; if (time === MARKS.hold) running = false; },
      tick(now) {
        if (running) {
          if (last !== null) time = Math.min(MARKS.hold, time + Math.max(0, Math.min(.1, (now - last) / 1000)));
          last = now;
          if (time === MARKS.hold) running = false;
        }
        return { time, running, phase: phaseAt(time) };
      },
      get time() { return time; },
      get running() { return running; }
    };
  }
  return Object.freeze({ HEROES, SCENARIOS, RANK, MARKS, highest, scenario, phaseAt, createClock });
});
