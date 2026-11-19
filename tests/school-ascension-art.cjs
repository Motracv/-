'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { createCanvas, Image } = require('@napi-rs/canvas');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'school/ascension-art.js'), 'utf8');
const types = ['abyss', 'rose', 'crystal', 'council', 'rift'];

class LocalImage extends Image {
  set src(value) { super.src = fs.readFileSync(path.join(root, value.split('?')[0])); }
}
function initialize(ImageConstructor) {
  const context = { window: {}, Image: ImageConstructor };
  vm.runInNewContext(source, context);
  return context.window.SchoolAscensionArt;
}
function hash(canvas) { return crypto.createHash('sha256').update(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data).digest('hex'); }
function sprite(art, type, options) {
  const canvas = createCanvas(128, 128), c = canvas.getContext('2d');
  c.translate(64, 95);
  assert.equal(art.monster(c, type, options), true);
  return canvas;
}

(async () => {
  const art = initialize(LocalImage);
  const results = await art.ready;
  assert.equal(results.every(Boolean), true);
  assert.equal(art.loaded, true);
  assert.equal(art.revision, 5);
  const backgroundHashes = new Set(), spriteHashes = new Set();
  for (let i = 0; i < types.length; i++) {
    const image = new Image(); image.src = fs.readFileSync(path.join(root, `school/assets/ascension/${types[i]}.webp`));
    assert.deepEqual([image.width, image.height], [1024, 512]);
    const canvas = createCanvas(640, 360), c = canvas.getContext('2d');
    c.fillStyle = '#123456';
    assert.equal(art.background(c, 15 + i, 640, 360), true);
    assert.equal(c.fillStyle, '#123456');
    backgroundHashes.add(hash(canvas));
    for (const options of [{ variant: 0 }, { variant: 1 }, { variant: 2 }, { boss: true }]) {
      const picture = sprite(art, types[i], options);
      spriteHashes.add(hash(picture));
      const pixels = picture.getContext('2d').getImageData(0, 0, 128, 128).data;
      let solid = 0;
      for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) if (pixels[(y*128+x)*4+3]) {
        solid++;
        assert.ok(x >= 17 && x <= 111 && y >= 16 && y <= 102, `${types[i]} exceeds sprite bounds`);
      }
      assert.ok(solid > 500, `${types[i]} should not be blank`);
    }
    assert.equal(hash(sprite(art, i+15, { time: 1, reduced: true })), hash(sprite(art, types[i], { time: 999, reduced: true })));
    assert.notEqual(hash(sprite(art, types[i], { attack: 0, reduced: true })), hash(sprite(art, types[i], { attack: 1, reduced: true })));
  }
  assert.equal(backgroundHashes.size, 5);
  assert.equal(spriteHashes.size, 20);
  const c = createCanvas(20, 20).getContext('2d');
  assert.equal(art.background(c, 14, 20, 20), false);
  assert.equal(art.background(c, 20, 20, 20), false);
  assert.equal(art.background(c, 15, 0, 20), false);
  assert.equal(art.monster(c, 'not-a-monster'), false);
  const fallback = initialize(class { set src(value) { queueMicrotask(() => this.onerror()); } });
  await fallback.ready;
  assert.equal(fallback.loaded, false);
  assert.equal(fallback.revision, 0);
  const fallbackHashes = new Set();
  for (let i = 15; i <= 19; i++) {
    const canvas = createCanvas(640, 360);
    assert.equal(fallback.background(canvas.getContext('2d'), i, 640, 360), true);
    fallbackHashes.add(hash(canvas));
  }
  assert.equal(fallbackHashes.size, 5);
  console.log('Ascension art: five 1024×512 backgrounds, 20 distinct bounded monster variants, attack/reduced-motion states, and image-error fallbacks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
