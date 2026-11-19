/* Chapters 16–20. Presentation only: no combat, rewards, or save-state writes. */
window.SchoolAscensionArt = (() => {
  'use strict';
  const themes = ['abyss', 'rose', 'crystal', 'council', 'rift'];
  const palette = [
    ['#082538', '#126077', '#76edfa'],
    ['#301323', '#75404d', '#ff9eae'],
    ['#29224c', '#6f7caa', '#c9f9ff'],
    ['#1d2433', '#535d70', '#d9d8c7'],
    ['#191841', '#4c4079', '#bcacff']
  ];
  const images = [], loadedImages = [];
  let revision = 0;
  const ready = Promise.all(themes.map((name, index) => new Promise(resolve => {
    const image = images[index] = new Image();
    image.onload = () => { loadedImages[index] = true; revision++; resolve(true); };
    image.onerror = () => { loadedImages[index] = false; resolve(false); };
    image.src = `school/assets/ascension/${name}.webp?v=ascension1`;
  })));
  const ink = '#101626', gold = '#d5b67c';
  const box = (c, color, x, y, w, h) => {
    c.fillStyle = color;
    c.fillRect(Math.round(x), Math.round(y), w, h);
  };
  function poly(c, color, points) {
    c.fillStyle = color; c.beginPath();
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (i) c.lineTo(Math.round(p[0]), Math.round(p[1]));
      else c.moveTo(Math.round(p[0]), Math.round(p[1]));
    }
    c.closePath(); c.fill();
  }
  function diamond(c, color, x, y, w, h = w) {
    poly(c, color, [[x, y - h], [x + w, y], [x, y + h], [x - w, y]]);
  }
  function face(c, color, y = -39) {
    box(c, ink, -10, y - 2, 20, 8);
    box(c, color, -8, y, 5, 3); box(c, color, 4, y, 5, 3);
  }
  function legs(c, color) {
    box(c, ink, -14, -12, 11, 16); box(c, ink, 4, -12, 11, 16);
    box(c, color, -12, -11, 7, 11); box(c, color, 6, -11, 7, 11);
    box(c, ink, -16, 1, 13, 4); box(c, ink, 4, 1, 13, 4);
  }
  function themeIndex(type) {
    return typeof type === 'number' ? (Number.isInteger(type) ? type - 15 : -1) : themes.indexOf(type);
  }

  /* Images are decoded once. Per-frame background rendering uses one drawImage. */
  function background(c, chapterIndex, w, h, options = {}) {
    const i = themeIndex(chapterIndex);
    if (i < 0 || i > 4 || !Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return false;
    c.save();
    const image = images[i];
    if (loadedImages[i]) {
      const ratio = Math.max(w / image.naturalWidth, h / image.naturalHeight);
      const sw = w / ratio, sh = h / ratio;
      c.drawImage(image, (image.naturalWidth - sw) / 2, (image.naturalHeight - sh) / 2, sw, sh, 0, 0, w, h);
    } else {
      const colors = palette[i], floor = h * .55;
      box(c, colors[0], 0, 0, w, h); box(c, colors[1], 0, floor, w, h - floor);
      for (let col = 0; col < 5; col++) {
        box(c, colors[1], w * (.05 + col * .21), h * .08, w * .06, h * .47);
        box(c, colors[2], w * (.07 + col * .21), h * .11, w * .012, h * .25);
      }
      c.strokeStyle = '#dae7ff32'; c.lineWidth = 1;
      c.beginPath();
      for (let col = -4; col <= 8; col++) { c.moveTo(w / 2, floor); c.lineTo(col * w * .16, h); }
      for (let row = 1; row <= 4; row++) { const y = floor + (h - floor) * (row / 4) ** 2; c.moveTo(0, y); c.lineTo(w, y); }
      c.stroke();
    }
    /* Original chapters 1–5 in hard mode remain the main renderer's responsibility. */
    if (options.hard) { c.fillStyle = '#36164720'; c.fillRect(0, 0, w, h); }
    c.restore(); return true;
  }

  /* Local sprite bounds are within x ±47, y −79…7; callers own position/scale. */
  function monster(c, type, options = {}) {
    const i = themeIndex(type);
    if (i < 0 || i > 4) return false;
    const rawTime = Number.isFinite(options.time) ? options.time : 0;
    const time = options.reduced ? 0 : rawTime;
    const attack = Math.max(0, Math.min(1, Number(options.attack) || 0));
    const variant = Math.abs(Math.trunc(Number(options.variant) || 0)) % 3;
    const boss = !!options.boss;
    const bob = options.reduced ? 0 : Math.round(Math.sin(time * 2.6 + i) * 1.5);
    c.save();
    c.translate(0, bob);
    if (i === 0) {
      /* Abyss: heavy aquarium guardian, coral diver, floating angler variant. */
      legs(c, '#31596e');
      poly(c, ink, [[-23,-38],[-13,-48],[14,-48],[23,-38],[19,-11],[-19,-11]]);
      box(c, '#31596e', -17, -39, 34, 27); box(c, '#59869a', -14, -38, 7, 22);
      box(c, gold, -15, -20, 30, 4);
      poly(c, ink, [[-20,-48],[-12,-57],[12,-57],[20,-48],[20,-29],[-20,-29]]);
      box(c, '#4c7e91', -16, -49, 32, 17); box(c, '#102e43', -12, -46, 25, 12);
      face(c, '#96fbff', -42); box(c, '#bdfaff', -3, -24, 6, 7);
      box(c, ink, -28-attack*8, -33, 12, 22); box(c, '#3a7889', -26-attack*8, -31, 8, 16);
      c.save(); c.translate(22, -25); c.rotate(-attack * .55);
      box(c, gold, -2, -25, 4, 49); diamond(c, '#aeebf3', 0, -28, 7, 10); c.restore();
      if (boss) {
        poly(c, '#31596e', [[-20,-47],[-34,-57],[-30,-37],[-21,-31]]);
        poly(c, '#31596e', [[20,-47],[34,-57],[30,-37],[21,-31]]);
        box(c, gold, -1, -66, 3, 13); box(c, gold, -1, -68, 14, 3);
        diamond(c, '#99faff', 13, -64, 6, 6);
        for (let n = 0; n < 3; n++) box(c, '#76b5bb', -12 + n * 12, -14, 4, 8 + n % 2 * 3);
      } else if (variant === 1) {
        box(c, '#bb8ab7', -20, -57, 4, 14); box(c, '#e1afd5', -26, -55, 10, 4);
        box(c, '#bb8ab7', 17, -54, 4, 13); box(c, '#e1afd5', 17, -51, 10, 4);
      } else if (variant === 2) {
        poly(c, '#7bbfc9', [[-16,-51],[-8,-63],[5,-62],[17,-51]]);
        box(c, '#c1fbfa', -5, -59, 4, 5);
      }
    } else if (i === 1) {
      /* Rose: thorn knight and the crowned rose sovereign. */
      legs(c, '#374646');
      poly(c, ink, [[-19,-42],[18,-42],[24,-13],[-24,-13]]);
      poly(c, '#4d484d', [[-15,-41],[15,-41],[19,-15],[-19,-15]]);
      box(c, '#aa5368', -4, -38, 8, 25); box(c, '#f3adac', -2, -35, 3, 9);
      for (const x of [-1, 1]) {
        poly(c, '#344d47', [[x*16,-39],[x*29,-48],[x*26,-30],[x*17,-24]]);
        poly(c, '#a44763', [[x*13,-48],[x*20,-56],[x*17,-40],[x*10,-35]]);
      }
      box(c, ink, -15, -54, 30, 24); box(c, '#a24862', -11, -52, 22, 19);
      poly(c, '#ca6b80', [[-12,-51],[0,-58],[13,-49],[0,-40]]); face(c, '#ffdcbb', -41);
      c.save(); c.translate(-22-attack*7, -25); c.rotate(attack*.7);
      box(c, '#537261', -2, -27, 4, 45);
      for (let n=0;n<4;n++) poly(c, '#b77770', [[-2,-19+n*10],[-9,-25+n*10],[-2,-26+n*10]]);
      c.restore();
      box(c, '#a24862', 17, -31, 9, 20);
      if (boss) {
        for (let n=0;n<5;n++) {
          const x=-20+n*10, y=-56-Math.round(Math.sin(n/4*Math.PI)*8);
          diamond(c, '#ba4569', x, y, 9, 9); diamond(c, '#ef8d9c', x, y-1, 4, 4);
        }
        poly(c, '#443849', [[-16,-22],[-30,-9],[-21,0],[-6,-13],[0,-7],[7,-13],[23,0],[30,-9],[16,-22]]);
      } else if (variant === 1) {
        diamond(c, '#e2859b', 18, -45, 10); diamond(c, '#ffc4b9', 18, -45, 4);
      } else if (variant === 2) {
        box(c, '#5e8563', 24, -47, 4, 23); diamond(c, '#f5a0b3', 26, -49, 7, 9);
      }
    } else if (i === 2) {
      /* Crystal: faceted automaton, shard dancer and auditorium conductor. */
      legs(c, '#7a8fad');
      poly(c, ink, [[0,-48],[20,-37],[15,-11],[-16,-11],[-21,-37]]);
      poly(c, '#8195c5', [[0,-45],[16,-35],[12,-14],[-13,-14],[-17,-35]]);
      poly(c, '#d0f5ff', [[0,-44],[0,-16],[-13,-16],[-16,-34]]);
      diamond(c, '#475393', 1, -29, 8, 11); diamond(c, '#f0ffff', 1, -31, 3, 5);
      poly(c, ink, [[-15,-51],[0,-61],[15,-51],[12,-35],[-12,-35]]);
      poly(c, '#c1c8f5', [[-11,-50],[0,-57],[11,-50],[8,-38],[-8,-38]]);
      face(c, '#7df8ff', -45);
      diamond(c, '#8499c7', -22-attack*8, -28, 7, 15);
      diamond(c, '#d9fbff', -24-attack*8, -29, 3, 10);
      diamond(c, '#9fc4e3', 23, -29, 7, 15);
      if (boss) {
        for (let n=0;n<3;n++) for (const sign of [-1,1]) {
          const x=sign*(23+n*7), y=-51+n*12;
          diamond(c, n%2 ? '#aa8cd7' : '#a1c9ef', x, y, 5, 13-n*2);
          box(c, '#f0ffff', x-1, y-4, 2, 6);
        }
        diamond(c, '#e0faff', 0, -69, 5, 7);
        box(c, gold, 27, -54, 3, 39); diamond(c, '#dbbafa', 28, -57, 5, 6);
      } else if (variant === 1) {
        diamond(c, '#9d8bce', 23, -50, 7, 12); diamond(c, '#f0dfff', 23, -51, 3, 7);
      } else if (variant === 2) {
        box(c, gold, 24, -53, 3, 38); diamond(c, '#e0ccff', 25, -56, 5, 8);
      }
    } else if (i === 3) {
      /* Council: paper-and-armor warden with a wax-sealed student crest. */
      legs(c, '#565b6e');
      poly(c, ink, [[-16,-42],[16,-42],[23,-6],[8,-10],[0,-5],[-9,-10],[-23,-6]]);
      poly(c, '#454c61', [[-13,-41],[13,-41],[18,-10],[7,-13],[0,-8],[-7,-13],[-18,-10]]);
      poly(c, '#bebbc3', [[-10,-40],[0,-29],[10,-40],[5,-41],[0,-36],[-5,-41]]);
      box(c, gold, -2, -31, 4, 16); box(c, '#d1c8b2', -14, -22, 8, 6);
      box(c, ink, -14, -54, 28, 22); box(c, '#9498a5', -11, -51, 22, 16);
      box(c, '#363b51', -15, -56, 30, 8); box(c, gold, -12, -50, 24, 2); face(c, '#e6d2a1', -44);
      c.save(); c.translate(-23-attack*8, -24); c.rotate(-attack*.45);
      box(c, ink, -8, -12, 16, 24); box(c, '#c6c1b1', -6, -10, 12, 20);
      box(c, '#68717e', -3, -6, 7, 2); box(c, '#68717e', -3, -1, 7, 2);
      diamond(c, '#b36c67', 0, 6, 4, 4); c.restore();
      box(c, '#6f7486', 16, -32, 9, 20);
      if (boss) {
        poly(c, '#686d82', [[-14,-43],[-29,-36],[-32,-5],[-18,0],[-17,-28]]);
        poly(c, '#686d82', [[14,-43],[29,-36],[32,-5],[18,0],[17,-28]]);
        box(c, gold, -28, -34, 3, 27); box(c, gold, 26, -34, 3, 27);
        poly(c, gold, [[-16,-56],[-17,-65],[-8,-60],[0,-69],[8,-60],[17,-65],[16,-56]]);
        diamond(c, '#d6e4f1', 0, -61, 4, 5);
      } else if (variant === 1) {
        box(c, '#a2a4af', 26, -51, 3, 42); diamond(c, '#d9cfb1', 27, -53, 6, 8);
      } else if (variant === 2) {
        box(c, '#bbc6d6', -22, -61, 13, 10); box(c, '#74849b', -19, -58, 7, 2);
      }
    } else {
      /* Rift: hollow graduation regalia surrounding an unstable star core. */
      poly(c, ink, [[-15,-49],[15,-49],[21,-24],[27,1],[12,-5],[4,4],[-4,-3],[-16,3],[-27,-1],[-21,-24]]);
      poly(c, '#393359', [[-12,-47],[12,-47],[17,-23],[22,-2],[11,-9],[4,-1],[-4,-7],[-16,-2],[-22,-4],[-17,-23]]);
      poly(c, '#75649c', [[-12,-42],[-5,-32],[-11,-9],[-17,-5],[-15,-25]]);
      poly(c, '#75649c', [[12,-42],[5,-32],[11,-9],[17,-5],[15,-25]]);
      diamond(c, '#a98cf0', 0, -29, 10, 15); diamond(c, '#8cf5ff', 0, -30, 6, 11);
      diamond(c, '#f0ffff', 0, -32, 2, 6);
      box(c, ink, -12, -56, 24, 19); face(c, '#debcff', -48);
      poly(c, '#a39abe', [[-23,-58],[0,-66],[23,-58],[0,-50]]);
      poly(c, '#454164', [[-18,-58],[0,-63],[18,-58],[0,-53]]);
      box(c, gold, 17, -58, 3, 18); box(c, gold, 15, -42, 7, 4);
      diamond(c, '#8a78b9', -25-attack*8, -25, 7, 13);
      diamond(c, '#8a78b9', 25, -25, 7, 13);
      if (boss) {
        for (const sign of [-1,1]) {
          poly(c, '#534d86', [[sign*20,-54],[sign*39,-66],[sign*32,-47],[sign*45,-38],[sign*29,-30],[sign*33,-15],[sign*19,-21]]);
          poly(c, '#bca9ee', [[sign*24,-52],[sign*35,-60],[sign*29,-45],[sign*24,-40]]);
          diamond(c, '#b4faff', sign*38, -30, 3, 7);
        }
        diamond(c, '#dcceff', 0, -73, 4, 4);
      } else if (variant === 1) {
        diamond(c, '#d5b8ff', -22, -53, 4, 8); diamond(c, '#a8efff', 25, -8, 3, 6);
      } else if (variant === 2) {
        box(c, gold, 25, -53, 3, 42); diamond(c, '#c1b0ff', 26, -55, 7, 9);
      }
    }
    c.restore(); return true;
  }
  return {
    background, monster, ready,
    get revision() { return revision; },
    get loaded() { return loadedImages.filter(Boolean).length === themes.length; }
  };
})();
