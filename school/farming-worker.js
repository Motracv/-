/* Dedicated background analysis. Never reads storage or writes a game save. */
'use strict';
importScripts('./engine.js?v=school-osia-breath1');
const G = self.SchoolRPG, cache = new Map();
let generation = 0;
self.onmessage = async ({ data }) => {
  if (!data || typeof data !== 'object') return;
  if (data.kind === 'cancel') { generation++; return; }
  if (data.kind !== 'recommend') return;
  const run = ++generation, id = data.id;
  try {
    if (!G.validate(data.state)) throw Error('편성 정보를 불러오지 못했습니다. 잠시 후 다시 시도하세요.');
    const state = data.state, fingerprint = G.farmingFingerprint(state);
    if (cache.has(fingerprint)) { self.postMessage({ kind: 'result', id, fingerprint, data: cache.get(fingerprint), cached: true }); return; }
    const stages = G.farmingCandidates(state), rows = [];
    self.postMessage({ kind: 'progress', id, fingerprint, completed: 0, total: stages.length });
    for (const stage of stages) {
      // Yield between stages so a cancellation or replacement request is handled.
      await new Promise(resolve => setTimeout(resolve, 0));
      if (run !== generation) return;
      rows.push(G.simulateFarmingStage(state, stage));
      if (run !== generation) return;
      self.postMessage({ kind: 'progress', id, fingerprint, completed: rows.length, total: stages.length });
    }
    const result = G.farmingRecommendations(state, rows);
    cache.set(fingerprint, result); if (cache.size > 8) cache.delete(cache.keys().next().value);
    self.postMessage({ kind: 'result', id, fingerprint, data: result, cached: false });
  } catch (error) {
    if (run === generation) self.postMessage({ kind: 'error', id, message: String(error?.message || '파밍 분석을 완료하지 못했습니다.') });
  }
};
