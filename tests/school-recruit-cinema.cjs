'use strict';
// Exercise the actual Canvas renderer with decoded production atlases. This is
// rendering QA, not a browser screenshot or a device-frame-rate guarantee.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const C = require('../previews/recruit-awakening/cinema.js');
const F = require('../previews/recruit-awakening/frames.js');
const M = require('../previews/recruit-awakening/model.js');
const base = path.resolve(__dirname, '../previews/recruit-awakening');
(async () => {
  const images = Object.create(null);
  await Promise.all([...new Set(Object.values(F).flat().map(f => f.file))].map(async file => { images[file] = await loadImage(path.join(base, file)); }));
  const art = createCanvas(900, 1400), a = art.getContext('2d');
  for (const [hero, frames] of Object.entries(F)) {
    for (let pose = 0; pose <= 3; pose += .25) {
      C.actor(a, images, frames, art.width, art.height, pose, 14, false);
      const pixels = a.getImageData(0, 0, art.width, art.height).data;
      let occupied = 0; for (let p = 3; p < pixels.length; p += 4) if (pixels[p] > 128) occupied++;
      assert(occupied > 100000, hero + ' remains visible through pose blending');
    }
  }
  const fx = createCanvas(960, 540), fc = fx.getContext('2d');
  for (const element of Object.keys(C.THEMES)) {
    for (const time of [0, 8.7, 9.5, 10.6, 11.5, 12.4, 12.7, 13.5, 16]) {
      for (const foreground of [false, true]) {
        C.effects(fc, 960, 540, time, element, 'UR', foreground);
        assert.equal(fc.globalAlpha, 1, 'Effects restore alpha');
        assert.equal(fc.globalCompositeOperation, 'source-over', 'Effects restore blending');
      }
    }
  }
  C.effects(fc,960,540,12.5,'water','SSR',true,true);
  assert.equal(fc.getImageData(480,270,1,1).data[3],0,'Reduced motion removes the flash and burst');
  // The same renderer also works in a portrait viewport without NaNs/clipping errors.
  const tall = createCanvas(390,488);
  C.effects(tall.getContext('2d'),390,488,11.5,'blossom','UR');

  if (process.env.RECRUIT_RENDER_PROOF) {
    const width = 960, height = 540, contact = createCanvas(width * 2, height * 3), out = contact.getContext('2d');
    const room = await loadImage(path.join(base,'assets/classroom.webp'));
    const panel = createCanvas(width,height), p = panel.getContext('2d');
    let row = 0;
    for (const hero of ['horas','osia','nari']) {
      for (const [col,time] of [[0,9.8],[1,14.8]]) {
        p.clearRect(0,0,width,height); p.drawImage(room,0,0,width,height);
        C.effects(fc,width,height,time,M.ELEMENTS[hero],M.HEROES[hero].rarity); p.drawImage(fx,0,0);
        if (col) {
          const wash = p.createLinearGradient(0,0,width,0); wash.addColorStop(0,'#effaffee');wash.addColorStop(.5,'#e9f5ff99');wash.addColorStop(1,'#e9f5ff00');p.fillStyle=wash;p.fillRect(0,0,width,height);
          art.width=Math.round(width*.52);art.height=Math.round(height*.96);
          C.actor(a,images,F[hero],art.width,art.height,3,time);
          p.drawImage(art,width*.43,0,width*.52,height*.96);
          p.fillStyle='#26465f';p.font='bold 58px sans-serif';p.fillText(M.HEROES[hero].rarity,70,200);p.font='36px sans-serif';p.fillText(hero.toUpperCase(),70,250);
        }
        C.effects(fc,width,height,time,M.ELEMENTS[hero],M.HEROES[hero].rarity,true);p.drawImage(fx,0,0);
        out.drawImage(panel,col*width,row*height);
      }
      row++;
    }
    fs.writeFileSync(process.env.RECRUIT_RENDER_PROOF,contact.toBuffer('image/png'));
  }
  console.log('PASS production Canvas rendering: 39 pose blends, 54 elemental FX samples, portrait viewport, reduced motion and restored draw state.');
})().catch(error=>{console.error(error);process.exitCode=1;});
