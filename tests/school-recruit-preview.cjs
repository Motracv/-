// Deterministic timeline + interaction checks; not a browser rendering/FPS test.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require(process.env.SCHOOL_DOM_MODULE || 'linkedom');
const M = require('../previews/recruit-awakening/model.js');
const dir = path.resolve(__dirname, '../previews/recruit-awakening');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const source = fs.readFileSync(path.join(dir, 'preview.js'), 'utf8');
const flush = async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve)); };

function mount({ reduced = false, fail = '' } = {}) {
  const { window } = parseHTML(html), document = window.document;
  let id = 0, now = 0, failure = fail;
  const frames = new Map();
  const media = { matches: reduced, addEventListener() {} };
  Object.defineProperty(document, 'hidden', { value: false, writable: true });
  window.RecruitPreviewModel = M; window.matchMedia = () => media;
  window.HTMLElement.prototype.focus = function () {};
  class Image {
    naturalWidth = 1024;
    set src(url) {
      assert(fs.existsSync(path.resolve(dir, url)), 'Missing image ' + url);
      queueMicrotask(() => { if (failure && url.includes(failure)) this.onerror?.(); else this.onload?.(); });
    }
    decode() { return Promise.resolve(); }
  }
  vm.runInNewContext(source, {
    window, document, Image, console, setTimeout, clearTimeout,
    requestAnimationFrame(fn) { frames.set(++id, fn); return id; },
    cancelAnimationFrame(handle) { frames.delete(handle); }
  }, { filename: 'recruit-awakening/preview.js' });
  return {
    window, document, frames, $: id => document.getElementById(id),
    step(ms = 100) { now += ms; const batch = [...frames.values()]; frames.clear(); for (const fn of batch) fn(now); assert(frames.size <= 1, 'Only one animation loop'); },
    advance(count) { for (let i = 0; i < count; i++) this.step(); },
    fail(value) { failure = value; }
  };
}

(async () => {
  assert.equal(M.highest(['nari', 'osia', 'horas']).id, 'horas');
  assert.equal(M.highest(['nari', 'geonu']).id, 'nari', 'Equal ranks keep original order');
  assert.throws(() => M.highest([])); assert.throws(() => M.highest(['unknown']));
  for (const tier of ['SR', 'SSR', 'UR']) {
    const result = M.scenario(tier); assert.equal(result.length, 10); assert.equal(M.highest(result).rarity, tier);
    result[0].name = 'modified'; assert.notEqual(M.scenario(tier)[0].name, 'modified');
  }
  const clock = M.createClock(); clock.start(); clock.tick(0); clock.tick(100);
  assert.equal(clock.time, .1); clock.pause(); clock.tick(50000); assert.equal(clock.time, .1);
  clock.resume(); clock.tick(90000); assert.equal(clock.time, .1, 'Resume has no hidden-tab jump');
  clock.tick(91000); assert.equal(clock.time, .2, 'A slow frame does not skip a full scene');
  clock.seek(999); assert.equal(clock.time, M.MARKS.hold); assert.equal(clock.running, false);

  const h = mount();
  const seen = new Set();
  for (const node of h.document.querySelectorAll('[id]')) { assert(!seen.has(node.id), 'Duplicate ID: ' + node.id); seen.add(node.id); }
  for (const node of h.document.querySelectorAll('script[src],link[href],img[src]')) {
    const url = (node.getAttribute('src') || node.getAttribute('href')).split('?')[0];
    assert(fs.existsSync(path.resolve(dir, url)), 'Missing file: ' + url);
  }
  assert(h.$('start').disabled); h.$('start').click(); assert.equal(h.frames.size, 0);
  await flush(); assert.equal(h.$('stage').getAttribute('aria-busy'), 'false'); assert(!h.$('start').disabled);
  assert(!h.$('visitor-rig').hasAttribute('hidden'), 'The SVG arm rig is visible for Horas');
  assert(h.$('fullscreen').hidden, 'Unsupported fullscreen stays hidden');
  assert.equal(h.document.querySelectorAll('.petal').length, 22);
  h.$('start').click(); assert.equal(h.frames.size, 1); h.advance(40);
  assert.equal(h.$('stage').dataset.phase, 'approach');
  h.$('pause').click(); const progress = h.$('progress').style.width;
  assert.equal(h.frames.size, 0); h.step(60000); assert.equal(h.$('progress').style.width, progress);
  h.$('pause').click(); h.step(); assert.equal(h.$('progress').style.width, progress);
  h.document.hidden = true; h.document.dispatchEvent(new h.window.Event('visibilitychange'));
  assert.equal(h.frames.size, 0); h.step(60000);
  h.document.hidden = false; h.document.dispatchEvent(new h.window.Event('visibilitychange')); h.step();
  assert.equal(h.$('progress').style.width, progress);
  h.advance(85); assert.equal(h.$('stage').dataset.phase, 'hold'); assert.equal(h.frames.size, 0);
  assert(!h.$('continue').hidden); assert(h.$('results').hidden); assert(h.$('line').textContent.includes('좋은 꿈'));
  h.$('continue').click(); h.$('continue').click();
  assert.equal(h.document.querySelectorAll('.result-card').length, 10, 'Repeated clicks cannot duplicate results');
  assert.equal(h.document.querySelector('.result-card.best .card-name').textContent, '호라스');
  assert.equal(h.$('stage').dataset.paused, 'false', 'Result entrance animations are not accidentally paused');
  h.$('replay-result').click(); h.$('restart').click(); h.$('restart').click(); assert.equal(h.frames.size, 1);
  h.$('skip').click(); assert.equal(h.frames.size, 0); assert(!h.$('results').hidden);
  h.document.querySelector('.rarity-controls button[data-rarity=SSR]').click();
  h.document.querySelector('.rarity-controls button[data-rarity=SR]').click(); await flush();
  assert.equal(h.$('hero-name').textContent, '나리', 'A stale asset response cannot overwrite the latest selection');
  assert(h.$('visitor-rig').hasAttribute('hidden'), 'Other characters do not inherit the Horas arm rig');
  assert.equal(h.$('stage').dataset.rarity, 'SR'); assert.equal(h.$('home').style.opacity, '1');
  h.$('start').click(); h.advance(120); assert.equal(h.$('stage').dataset.phase, 'hold');
  assert.equal(h.$('speaker').textContent, '나리'); h.$('continue').click();
  assert.equal(h.document.querySelector('.result-card.best .card-name').textContent, '나리');
  assert.equal(h.document.querySelectorAll('.petal').length, 22, 'Replays reuse a bounded particle pool');

  const bad = mount({ fail: 'horas-greeting' }); await flush();
  assert(!bad.$('retry').hidden); assert(bad.$('start').disabled); assert.equal(bad.frames.size, 0);
  bad.fail(''); bad.$('retry').click(); await flush(); assert(!bad.$('start').disabled); assert(bad.$('loading').hidden);
  const low = mount({ reduced: true }); await flush(); low.$('start').click(); low.advance(25);
  assert.equal(low.$('stage').dataset.phase, 'hold'); assert.equal(low.$('flash').style.opacity, '0');
  assert.equal(low.$('stage').dataset.reduced, 'true'); assert.equal(low.frames.size, 0);
  assert(!/\b(?:fetch|XMLHttpRequest|localStorage|sessionStorage|SchoolRPG)\b/.test(source), 'The preview cannot call real draws or alter saves');
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'assets/manifest.json')));
  assert.equal(manifest.length, 6);
  for (const asset of manifest) { assert(asset.width >= 1000); assert(asset.height >= 900); assert.equal(fs.statSync(path.join(dir, 'assets', asset.file)).size, asset.bytes); }
  console.log('PASS: highest-rarity selection, ordered results, pause/resume, hidden tabs, replay/skip, rapid tier changes, missing-asset recovery, reduced motion, bounded particles, preview isolation and original-resolution assets.');
})().catch(error => { console.error(error); process.exitCode = 1; });
