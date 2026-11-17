"use strict";
window.SchoolArt = (() => {
  const portraits = new Map(), S = SchoolRPG;
  const osiaImage = new Image(), lavaImage = new Image();
  let osiaLoaded = false, lavaLoaded = false;
  const osiaReady = new Promise(resolve => {
    const timer = setTimeout(() => resolve(false), 5000);
    osiaImage.onload = () => { osiaLoaded = true; clearTimeout(timer); portraits.delete("osia"); resolve(true); window.dispatchEvent(new Event("school-art-ready")); };
    osiaImage.onerror = () => { clearTimeout(timer); resolve(false); };
  });
  const lavaReady = new Promise(resolve => {
    const timer = setTimeout(() => resolve(false), 5000);
    lavaImage.onload = () => { lavaLoaded = true; clearTimeout(timer); portraits.delete("lava"); resolve(true); window.dispatchEvent(new Event("school-art-ready")); };
    lavaImage.onerror = () => { clearTimeout(timer); resolve(false); };
  });
  const ready = Promise.all([osiaReady, lavaReady]).then(([osia, lava]) => osia && lava);
  osiaImage.src = "school/assets/osia-sprites.png?v=osia1";
  lavaImage.src = "school/assets/lava.png?v=lava1";
  function rect(c, color, x, y, w, h) { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), w, h); }
  // Fine details use a half-pixel art grid. They are drawn directly into the
  // display-sized canvas, rather than enlarging a 480px raster afterwards.
  function detail(c, color, x, y, w, h) { c.fillStyle = color; c.fillRect(Math.round(x * 2) / 2, Math.round(y * 2) / 2, w, h); }
  const shades = new Map();
  function shade(color, amount) {
    const key = color + amount;
    if (!shades.has(key)) { const n = parseInt(color.slice(1), 16); shades.set(key, '#' + [n >> 16, n >> 8 & 255, n & 255].map(v => Math.max(0, Math.min(255, v + amount)).toString(16).padStart(2, '0')).join('')); }
    return shades.get(key);
  }
  const clamp01 = value => Math.max(0, Math.min(1, value));
  // Movement is expressed in logical battle pixels and consumes the shared
  // simulation clock, so changing battle speed never desynchronises a pose.
  function castingMotion(id, stage, age, reduced = false) {
    if (reduced) return {dx:0, dy:0, lean:0, stretch:1, cloth:0, pose:stage === 1 ? 2 : 1, stage, age, reduced};
    if (age < 0) return {dx:0, dy:0, lean:0, stretch:1.025, cloth:0, pose:1, stage, age, reduced};
    const progress = clamp01(age / (id === "lava" ? 1.35 : stage === 4 ? 1.65 : 1.05));
    const spring = Math.sin(progress * Math.PI), release = clamp01((age - .15) / .45);
    let dx = 0, dy = 0, lean = 0, stretch = 1, cloth = 0, pose = age < .4 ? 1 : 2;
    if (id === "lava") {
      if (stage === 1) { dx = spring * 12; dy = age < .15 ? age * 22 : -Math.sin(clamp01((age - .15) / .85) * Math.PI) * 12; lean = -.11 * Math.sin(progress * Math.PI * 2); cloth = 1.8 * spring; }
      else { dx = Math.sin(progress * Math.PI) * 8; dy = -Math.sin(clamp01(age / 1.1) * Math.PI) * 23; lean = .13 * Math.sin(progress * Math.PI * 2); cloth = 3 * spring; }
      stretch = 1 - (age < .15 ? .09 * (1 - age / .15) : 0) + Math.max(0, -dy) * .0015;
    } else if (stage === 1) { dx = Math.sin(release * Math.PI) * 13; dy = age < .2 ? 3 * Math.sin(age / .2 * Math.PI) : 0; lean = -.08 * Math.sin(progress * Math.PI); stretch = age < .2 ? .94 : 1; }
    else if (stage === 2) { dx = Math.sin(progress * Math.PI * 2) * 8; dy = -spring * 7; lean = .16 * Math.sin(progress * Math.PI * 2); pose = age < .28 ? 2 : age < .62 ? 1 : 2; }
    else if (stage === 3) { dy = -Math.sin(clamp01(age / .9) * Math.PI) * 24; dx = spring * 3; stretch = dy < -6 ? 1.05 : .97; lean = -.035; pose = age < .5 ? 1 : 2; }
    else { dy = -Math.sin(clamp01(age / 1.2) * Math.PI) * 18; dx = Math.sin(clamp01(age / 1.6) * Math.PI) * 11; lean = age < .5 ? .035 : -.09 * spring; stretch = 1.025; pose = age < .55 ? 1 : 2; }
    return {dx,dy,lean,stretch,cloth,pose,stage,age,reduced};
  }
  function osia(c, x, y, scale, frame) {
    c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(scale, scale);
    if (frame.dead) { c.globalAlpha = .4; c.rotate(-Math.PI / 2); }
    if (frame.hit) c.filter = "brightness(1.8)";
    rect(c, "#26333b35", -8, 1 + (frame.shadowY || 0), 17, 2);
    if (frame.motion) c.transform(1, 0, frame.motion.lean, frame.motion.stretch, 0, 0);
    if (osiaLoaded) {
      const tile = osiaImage.naturalWidth / 3, pose = frame.pose ?? (frame.attack || frame.casting ? 2 : frame.ready ? 1 : 0);
      // The atlas is three equal right-facing cells, with identical foot anchors.
      c.drawImage(osiaImage, pose * tile, 0, tile, osiaImage.naturalHeight, -21, -40, 44, 44);
    } else {
      // Small, right-facing fallback when the optional art file cannot load.
      c.translate(0, -7);
      rect(c, "#293b5d", -8, -33, 15, 16); rect(c, "#6e91cd", -7, -32, 14, 13);
      rect(c, "#f3cda7", 1, -28, 7, 9); rect(c, "#f3cda7", 7, -25, 3, 3); rect(c, "#263851", 6, -27, 2, 3);
      rect(c, "#97b5e5", -5, -31, 12, 3); rect(c, "#5578ae", -8, -27, 5, 12); rect(c, "#e7a66f", -6, -35, 6, 5); rect(c, "#ffd499", -4, -37, 3, 6);
      rect(c, "#252c3c", -4, -18, 11, 11); rect(c, "#f9f2e9", -3, -17, 10, 9); rect(c, "#56ad8c", 4, -16, 2, 4);
      rect(c, "#f3cda7", 7, -15, frame.attack ? 10 : 3, 4); rect(c, "#343543", -6, -9, 15, 8); rect(c, "#f4efea", -6, -5, 15, 1); rect(c, "#f4efea", -6, -3, 15, 1);
      rect(c, "#f8f3f1", -4, -1, 4, 5); rect(c, "#f8f3f1", 3, -1, 4, 5); rect(c, "#785039", -4, 3, 5, 7); rect(c, "#785039", 3, 3, 5, 7); rect(c, "#a5754c", -3, 3, 3, 5); rect(c, "#a5754c", 4, 3, 3, 5);
    }
    c.restore();
  }
  function fan(c, x, y, open = true) {
    c.save(); c.translate(x, y);
    if (open) {
      rect(c, "#6a4332", -9, -12, 18, 5); rect(c, "#6a4332", -11, -10, 22, 5);
      rect(c, "#d8eaf0", -8, -11, 16, 9); rect(c, "#eff8f2", -10, -9, 20, 4);
      for (let i = -2; i <= 2; i++) { c.strokeStyle = "#b98d58"; c.lineWidth = .5; c.beginPath(); c.moveTo(0, 1); c.lineTo(i * 4, -10 + Math.abs(i)); c.stroke(); }
      rect(c, "#83adbb", -5, -7, 7, 1); rect(c, "#83adbb", -2, -5, 7, 1);
    } else { rect(c, "#76503b", -1, -12, 3, 13); detail(c, "#f5db9c", 0, -11, 1, 11); }
    rect(c, "#6b4834", -1, 0, 2, 5); rect(c, "#e6c16f", -1, 3, 2, 1); c.restore();
  }
  function lava(c, x, y, scale, frame) {
    c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(scale, scale);
    if (frame.dead) { c.globalAlpha = .4; c.rotate(-Math.PI / 2); }
    if (frame.hit) c.filter = "brightness(1.8)";
    rect(c, "#26333b35", -10, 1 + (frame.shadowY || 0), 21, 2);
    if (frame.motion) c.transform(1, 0, frame.motion.lean, frame.motion.stretch, 0, 0);
    if (lavaLoaded) {
      // The generated source is kept intact. Its known transparent padding is
      // excluded while drawing so Lava shares the party's foot and height scale.
      const crop = {x:245, y:91, width:631, height:1260}, width = 44 * crop.width / crop.height;
      if (frame.motion && !frame.motion.reduced) {
        // Adjacent strips bend the torso and flutter the long skirt separately;
        // the head stays rigid, the feet trail, and the source PNG is untouched.
        const motion = frame.motion;
        for (let row = 0; row < 44; row += 2) {
          const part = row / 44, skirt = part > .48 && part < .86, legs = part >= .86;
          const sway = skirt ? Math.sin(part * 10 - motion.age * 12) * motion.cloth : legs ? Math.sin(motion.age * 9) * motion.cloth * .25 : Math.sin(part * 3) * motion.cloth * .18;
          const spread = skirt ? 1 + Math.sin((part - .48) / .38 * Math.PI) * Math.abs(motion.cloth) * .055 : 1;
          c.drawImage(lavaImage, crop.x, crop.y + row / 44 * crop.height, crop.width, Math.min(2, 44 - row) / 44 * crop.height, -width * spread / 2 + sway, -41 + row, width * spread, 2.12);
        }
      } else c.drawImage(lavaImage, crop.x, crop.y, crop.width, crop.height, -width / 2, -41, width, 44);
      if (frame.attack && !frame.casting) { c.strokeStyle = "#e1f1b9"; c.lineWidth = .8; c.beginPath(); c.arc(15, -22, 12, -1.5, .8); c.stroke(); }
    } else {
      // A human shaman in a hanbok: no fins, horns or animal ears.
      c.scale(.88, .88); c.translate(0, -5);
      rect(c, "#40576b", -8, -39, 16, 17); rect(c, "#8fc6dd", -7, -38, 14, 15);
      rect(c, "#f4d0ae", -1, -34, 9, 12); rect(c, "#f4d0ae", 7, -30, 3, 3);
      rect(c, "#bee6ec", -5, -38, 10, 3); rect(c, "#8fc6dd", -4, -35, 5, 6); rect(c, "#6ea8c5", -8, -32, 4, 12);
      rect(c, "#293f4c", 5, -31, 1, frame.blink ? 1 : 2); detail(c, "#fff5d8", 5, -31, .5, .5); detail(c, "#bf8970", 5, -25, 2, .5);
      rect(c, "#596638", -8, -23, 17, 13); rect(c, "#9eae56", -7, -22, 16, 12);
      rect(c, "#c1cb72", -7, -22, 3, 10); rect(c, "#d58743", -1, -22, 6, 3); rect(c, "#e6b26a", 1, -21, 3, 2);
      rect(c, "#536036", -11, -22, 5, 13); rect(c, "#b4c16a", -10, -21, 4, 11);
      rect(c, "#586439", 7, -22, 7, 10); rect(c, "#bdca78", 8, -21, 5, 8); rect(c, "#f4d0ae", 12, -17, 4, 3);
      rect(c, "#724137", -9, -11, 19, 14); rect(c, "#b35545", -8, -10, 17, 12); rect(c, "#d17b57", -7, -10, 2, 11);
      rect(c, "#933f38", 2, -9, 2, 12); rect(c, "#8e3f39", 7, -8, 2, 10);
      rect(c, "#e9dfc1", -7, 0, 7, 7); rect(c, "#f7eed3", -6, 0, 5, 6); rect(c, "#e9dfc1", 2, 0, 7, 7); rect(c, "#f7eed3", 3, 0, 5, 6);
      rect(c, "#554539", -8, 6, 9, 3); rect(c, "#554539", 2, 6, 10, 3); detail(c, "#ac8761", -7, 6.5, 6, .5); detail(c, "#ac8761", 3, 6.5, 6, .5);
      detail(c, "#e7be75", -2, -13, 10, 1); rect(c, "#d89553", 1, -13, 2, 6); rect(c, "#edc48a", 3, -13, 4, 2);
      fan(c, frame.casting ? 20 : 17, frame.casting ? -28 : -17, true);
    }
    c.restore();
  }
  function hero(c, id, x, y, scale = 2, frame = {}) {
    if (id === "osia") { osia(c, x, y, scale, frame); return; }
    if (id === "lava") { lava(c, x, y, scale, frame); return; }
    const h = S.BY_ID[id], index = S.HEROES.indexOf(h), dead = frame.dead;
    c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(scale * (frame.flip ? -1 : 1), scale);
    if (dead) { c.globalAlpha = .4; c.rotate(-Math.PI / 2); }
    if (frame.hit) c.filter = "brightness(1.8)";
    const skin = index % 3 === 0 ? "#efc69a" : "#f4d6b3", dark = "#263340", boot = "#3b3840";
    rect(c, "#26333b35", -9, -1, 20, 3);
    if (["ian", "lumi", "siu"].includes(id)) { rect(c, dark, -10, -21, 6, 19); rect(c, h.color, -9, -20, 3, 16); }
    if (["yuna", "seoyun", "nari", "lumi"].includes(id)) rect(c, h.hair, -8, -30, 16, 18);
    rect(c, dark, -7, -16, 14, 15); rect(c, h.outfit, -6, -18, 13, 14);
    rect(c, "#f0e7d2", -4, -18, 8, 4); rect(c, h.color, -1, -16, 3, 8);
    rect(c, dark, -8, -19, 3, 13); rect(c, h.outfit, -7, -18, 3, 10);
    rect(c, skin, -7, -9, 3, 3); rect(c, dark, 5, -18, 4, 11); rect(c, h.outfit, 5, -17, 3, 8); rect(c, skin, 6, -9, 3, 4);
    rect(c, "#444e5a", -5, -5, 4, 6); rect(c, "#394451", 2, -5, 4, 6);
    rect(c, boot, -6, 0, 6, 3); rect(c, boot, 2, 0, 6, 3);
    detail(c, shade(h.outfit, 23), -6, -17.5, 1, 10); detail(c, shade(h.outfit, -22), 4.5, -14, 1.5, 9);
    detail(c, "#fff3d8", -3.5, -17.5, 2.5, 1); detail(c, "#fff3d8", 1.5, -17.5, 2, 1);
    detail(c, "#e6c77e", 1, -12.5, 1, 1); detail(c, "#e6c77e", 1, -9.5, 1, 1);
    detail(c, "#1b273b66", -4, -6.5, 8, 1); detail(c, "#657381", -4.5, -4, 1, 4);
    detail(c, "#74777c", -5.5, .5, 4, .5); detail(c, "#74777c", 2.5, .5, 3.5, .5);
    rect(c, dark, -7, -31, 14, 15); rect(c, skin, -6, -29, 12, 11); rect(c, "#d9a47e", -5, -20, 10, 3);
    rect(c, h.hair, -7, -32, 14, 6); rect(c, h.hair, -7, -28, 3, 7); rect(c, h.hair, 4, -28, 3, 4);
    rect(c, h.hair, -5, -34, 10, 3); rect(c, h.hair, -1, -29, 3, 4);
    if (id === "harin" || id === "seoyun") { rect(c, h.hair, -10, -30, 5, 13); rect(c, h.color, -9, -28, 4, 3); }
    if (id === "nari") { rect(c, h.hair, -10, -27, 4, 13); rect(c, h.hair, 7, -27, 4, 13); rect(c, "#e9c883", -10, -18, 4, 2); }
    if (id === "yuna") { rect(c, h.color, -10, -32, 4, 4); rect(c, "#efdab1", -6, -31, 3, 2); }
    if (id === "sua") { rect(c, "#f4edda", -8, -33, 16, 5); rect(c, "#c87b86", -1, -34, 3, 6); rect(c, "#c87b86", -3, -32, 7, 2); }
    if (id === "minjae") { rect(c, dark, -6, -26, 5, 4); rect(c, dark, 2, -26, 5, 4); rect(c, "#9ed9d7", -5, -25, 3, 2); rect(c, "#9ed9d7", 3, -25, 3, 2); rect(c, dark, -1, -25, 3, 1); }
    else { rect(c, dark, -4, -25, 2, frame.blink ? 1 : 3); rect(c, dark, 3, -25, 2, frame.blink ? 1 : 3); rect(c, "#e4ac91", -5, -22, 2, 1); }
    detail(c, shade(h.hair, 26), -5, -32, 7, 1); detail(c, shade(h.hair, 12), -5.5, -30.5, 2, 1);
    detail(c, shade(h.hair, -23), -7, -26, 1, 4); detail(c, "#fff0d9", -.5, -25, 1, 3);
    detail(c, "#b67d69", -.5, -20.5, 2.5, .5);
    if (!frame.blink && id !== "minjae") { detail(c, "#fff9ec", -3.5, -25, .5, 1); detail(c, "#fff9ec", 3.5, -25, .5, 1); }
    if (id === "jiho") { rect(c, "#313b47", -10, -28, 4, 8); rect(c, h.color, -9, -27, 2, 6); rect(c, "#313b47", -7, -35, 15, 3); }
    if (id === "geonu") { rect(c, "#3f4b43", -8, -34, 17, 7); rect(c, "#d5c8a4", -1, -34, 3, 7); }
    if (id === "siu" || id === "lumi") { rect(c, h.outfit, -11, -33, 24, 3); rect(c, h.outfit, -7, -37, 15, 5); rect(c, h.outfit, -4, -42, 9, 6); rect(c, "#f2d18d", -5, -35, 12, 2); rect(c, h.color, 0, -42, 3, 3); }
    if (id === "ian") { rect(c, "#eacb72", -7, -29, 14, 2); rect(c, "#f6e9b1", -2, -32, 3, 5); }
    const reach = frame.attack ? 5 : 0;
    if (h.weapon === "sword") { rect(c, dark, 10 + reach, -27, 3, 23); rect(c, "#dfdfd0", 11 + reach, -26, 1, 17); rect(c, "#e9bd66", 7 + reach, -9, 8, 3); rect(c, "#735449", 10 + reach, -6, 3, 6); }
    if (h.weapon === "shield") { rect(c, "#253b40", 5, -21, 14, 18); rect(c, "#b7c4ae", 6, -20, 12, 15); rect(c, h.color, 8, -18, 8, 11); rect(c, "#e5d5a8", 11, -17, 2, 8); }
    if (h.weapon === "bow") { rect(c, "#8c623b", 11 + reach, -28, 3, 23); rect(c, "#e5ba71", 14 + reach, -25, 3, 17); rect(c, "#f0dec1", 10 + reach, -27, 1, 21); }
    if (h.weapon === "staff") { rect(c, "#775946", 12, -31, 3, 33); rect(c, h.color, 9, -35, 9, 7); rect(c, "#fff0c9", 11, -34, 4, 3); }
    if (h.weapon === "heal") { rect(c, "#614c4c", 6, -15, 12, 11); rect(c, "#f0dfb9", 7, -14, 10, 9); rect(c, h.color, 11, -13, 2, 7); rect(c, h.color, 9, -11, 6, 2); }
    if (h.weapon === "flag") { rect(c, "#6f5140", 12, -34, 2, 35); rect(c, h.color, 14, -34, 12, 10); rect(c, "#ead9a9", 17, -31, 5, 3); }
    if (h.weapon === "shield") { detail(c, "#ecedcd", 6.5, -19, .5, 12); detail(c, "#6c846f", 17, -19, .5, 12); for (const [bx, by] of [[7,-19],[16,-19],[7,-7],[16,-7]]) detail(c, "#f6d78e", bx, by, .5, .5); }
    if (h.weapon === "staff") { detail(c, "#d4a679", 12, -29, .5, 27); detail(c, "#fffce6", 10, -34, 1, 1); detail(c, "#28334077", 16, -33, 1, 3); }
    if (h.weapon === "sword") { detail(c, "#fff9df", 11 + reach, -25, .5, 14); detail(c, "#b48c53", 10 + reach, -4, 3, .5); }
    c.restore();
  }
  function portrait(id) {
    if (!portraits.has(id)) { const canvas = document.createElement("canvas"); canvas.width = 160; canvas.height = 192;
      const c = canvas.getContext("2d"); c.imageSmoothingEnabled = false; c.scale(2, 2); hero(c, id, id === "lava" ? (lavaLoaded ? 40 : 30) : 36, 86, 2); portraits.set(id, canvas.toDataURL()); }
    return portraits.get(id);
  }
  function activityBoss(c, enemy, x, y, frame) {
    const kind = frame.activity.kind, bob = frame.reduced ? 0 : Math.sin((frame.time || 0) * 2) * 2;
    c.save(); c.translate(Math.round(x), Math.round(y + bob)); c.scale(2.45,2.45);
    if (enemy.hp <= 0) c.globalAlpha = .25;
    if (frame.hit) c.filter = "brightness(1.7)";
    rect(c,"#162b3d45",-21,1,43,3);
    if (kind === "daily") {
      // The storehouse guardian is a walking brass-bound supply chest.
      rect(c,"#3c5c62",-23,-35,46,33);rect(c,"#947a48",-20,-33,40,29);rect(c,"#c4a35e",-18,-31,36,24);
      for (let plank=0;plank<4;plank++) { detail(c,"#e8c87c",-17,-30+plank*6,34,.5); detail(c,"#7e623c",-18,-25+plank*6,36,.5); }
      rect(c,"#4e6a6b",-22,-34,5,31);rect(c,"#4e6a6b",17,-34,5,31);rect(c,"#d7bc72",-20,-34,2,30);rect(c,"#d7bc72",19,-34,2,30);
      rect(c,"#405b5a",-24,-42,48,10);rect(c,"#c2a05c",-21,-40,42,6);rect(c,"#f0d991",-19,-40,38,1);
      rect(c,"#e9c778",-5,-24,10,13);rect(c,"#5b5942",-2,-22,4,5);rect(c,"#5b5942",-1,-18,2,5);
      for (const side of [-1,1]) { rect(c,"#324c53",side<0?-30:23,-28,8,21);rect(c,"#6f9691",side<0?-28:24,-26,5,16);rect(c,"#d4be7b",side<0?-27:25,-24,2,2);rect(c,"#324c53",side<0?-16:8,-3,9,7);rect(c,"#7e9b8d",side<0?-15:9,-2,7,3); }
      rect(c,"#283c43",-14,-30,8,4);rect(c,"#283c43",7,-30,8,4);detail(c,"#eff8bd",-12,-30,3,1);detail(c,"#eff8bd",9,-30,3,1);
    } else if (kind === "weekly") {
      // A sealed headmaster spirit floats above its torn academic robes.
      rect(c,"#39283f",-20,-35,40,34);rect(c,"#5d456a",-17,-34,34,31);rect(c,"#8e6d91",-15,-31,5,27);rect(c,"#42364e",10,-31,7,28);
      for (let hem=0;hem<6;hem++) rect(c,"#5d456a",-17+hem*6,-3,4,6+hem%2*3);
      rect(c,"#c7b88f",-4,-34,8,29);detail(c,"#f0d994",-2,-32,1,25);rect(c,"#b68b59",-10,-28,20,2);
      rect(c,"#332d44",-12,-55,24,24);rect(c,"#b7c8be",-10,-53,20,19);rect(c,"#d8e5cc",-7,-51,12,7);
      rect(c,"#453d52",-8,-45,7,5);rect(c,"#453d52",3,-45,7,5);detail(c,"#9ce8df",-6,-44,3,1);detail(c,"#9ce8df",5,-44,3,1);rect(c,"#6b7773",-3,-36,7,2);
      rect(c,"#2a2a3e",-18,-57,36,5);rect(c,"#4e3c59",-11,-63,23,7);detail(c,"#d1b473",-16,-57,32,1);rect(c,"#d3b572",9,-55,1,14);rect(c,"#e9c875",7,-43,5,5);
      for (let link=0;link<5;link++) { const lx=-28+link*13; rect(c,"#b1ada1",lx,-23+link%2*3,6,2);rect(c,"#dcd0af",lx+1,-22+link%2*3,1,4); }
    } else {
      rect(c,"#263b52",-17,-39,34,36);rect(c,"#93b3bb",-14,-37,28,32);rect(c,"#d5e3da",-12,-35,8,27);rect(c,"#5e8397",6,-35,8,29);
      rect(c,"#294354",-12,-54,25,19);rect(c,"#cfddd5",-10,-52,21,16);rect(c,"#55778c",-9,-46,19,3);rect(c,"#e5f5cf",-6,-45,13,1);
      rect(c,"#c4d9cb",-20,-39,8,7);rect(c,"#c4d9cb",13,-39,8,7);rect(c,"#294354",-12,-4,8,8);rect(c,"#294354",5,-4,8,8);
      c.strokeStyle="#b7d9c3";c.lineWidth=1.2;c.beginPath();c.ellipse(0,-29,28,9,frame.reduced?.3:(frame.time||0)*.8,0,Math.PI*2);c.stroke();
      rect(c,"#e5e5b3",24,-51,2,47);rect(c,"#7ea3a9",21,-18,8,3);rect(c,"#e8f5ce",23,-51,4,4);
    }
    c.restore();
  }
  function monster(c, enemy, x, y, frame = {}) {
    if (enemy.boss && frame.activity) { activityBoss(c, enemy, x, y, frame); return; }
    c.save(); c.translate(Math.round(x), Math.round(y)); const z = enemy.boss ? 2.7 : 1.7; c.scale(z, z);
    if (enemy.hp <= 0) c.globalAlpha = .25;
    if (frame.hit) c.filter = "brightness(2)";
    const palettes = [["#477d68", "#9dc497"], ["#6c627e", "#b9a6c7"], ["#796247", "#d1ba85"], ["#4d7651", "#91af64"], ["#666b79", "#a1a4ab"], ["#5c5379", "#ba9dd6"], ["#6c91ad", "#c0e0e7"], ["#48485f", "#8f86a4"], ["#557d80", "#a4d3c6"], ["#526e6c", "#92b89a"], ["#76895c", "#d4df9c"], ["#8d6572", "#e2ccd3"]];
    const [edge, body] = palettes[enemy.kind] || palettes[0]; rect(c, "#20302b35", -13, 0, 27, 3);
    if (enemy.kind === 2) { rect(c, edge, -23, -23, 14, 8); rect(c, body, -21, -22, 11, 5); rect(c, edge, 10, -23, 14, 8); rect(c, body, 11, -22, 11, 5); }
    rect(c, edge, -13, -18, 27, 15); rect(c, edge, -10, -25, 21, 22); rect(c, edge, -6, -29, 13, 5);
    rect(c, body, -11, -17, 23, 12); rect(c, body, -8, -24, 17, 19); rect(c, body, -5, -27, 11, 5);
    detail(c, shade(body, 24), -7.5, -23, 1, 5); detail(c, shade(body, 18), -10, -16, 1, 8);
    detail(c, shade(body, -17), -9, -5.5, 20, 1.5); detail(c, shade(body, -13), 9, -21, 1.5, 15);
    detail(c, shade(body, 12), -4, -26, 7, .5); detail(c, "#ffffff55", -4.5, -22.5, 2, .5);
    rect(c, "#ffffff38", -6, -24, 5, 3); rect(c, "#292d3c", -6, -17, 4, 5); rect(c, "#292d3c", 4, -17, 4, 5);
    rect(c, "#fff7ce", -5, -17, 1, 2); rect(c, "#fff7ce", 5, -17, 1, 2); rect(c, edge, -1, -8, 4, 2);
    if (enemy.kind === 1 || enemy.kind === 5) { rect(c, body, -11, -4, 5, 5); rect(c, body, 0, -5, 5, 6); rect(c, body, 9, -4, 3, 5); }
    if (enemy.kind === 3) { rect(c, "#b99a5b", -17, -22, 6, 3); rect(c, "#b99a5b", 12, -23, 7, 3); rect(c, body, -18, -26, 5, 4); }
    if (enemy.kind === 4) { rect(c, edge, -18, -18, 7, 17); rect(c, edge, 12, -18, 7, 17); rect(c, "#b9d9d4", -5, -23, 12, 4); detail(c, "#e1f1e0", -4, -22.5, 9, .5); for (const bx of [-15, 15]) { detail(c, "#cbd1ca", bx, -15, 1, 1); detail(c, "#303d4d", bx, -5, 1, 1); } for (let i = 0; i < 3; i++) detail(c, edge, -3 + i * 3, -5, 1.5, .5); }
    if (enemy.kind === 6) { for (const [ix,iy] of [[-9,-27],[-2,-32],[6,-28]]) { rect(c,"#719fbd",ix,iy,5,8); rect(c,"#e5f7f4",ix+1,iy+1,1,5); } detail(c,"#effbff",-7,-10,16,.5); }
    if (enemy.kind === 7) { rect(c,"#484457",-12,-3,25,4); for (let i=0;i<5;i++) rect(c,"#716779",-12+i*6,0,3,4-i%2); rect(c,"#e6c1a6",-5,-16,2,1); rect(c,"#e6c1a6",5,-16,2,1); }
    if (enemy.kind === 8) { rect(c,"#68806f",-4,-33,9,8); rect(c,"#e1ca86",-3,-32,7,2); rect(c,"#dff4d7",-8,-23,2,7); detail(c,"#eaffed",-5,-23,7,.5); }
    if (enemy.kind === 9) { rect(c,"#647c6c",-15,-16,4,12); rect(c,"#b5c5a0",-15,-15,2,2); rect(c,"#738b70",12,-13,5,10); detail(c,"#cce0ad",-7,-6,4,1); }
    if (enemy.kind === 10) { rect(c,"#e8e7b8",-17,-19,6,2); rect(c,"#e8e7b8",12,-13,9,2); rect(c,"#9ebd8b",-19,-15,7,1); rect(c,"#edf3cf",9,-25,8,1); }
    if (enemy.kind === 11) { rect(c,"#fff0da",-11,-29,6,11); rect(c,"#fff0da",7,-29,6,11); rect(c,"#bd6c6c",-9,-28,2,6); rect(c,"#bd6c6c",9,-28,2,6); detail(c,"#b76469",-7,-13,3,1); detail(c,"#b76469",6,-13,3,1); }
    if (enemy.boss) { rect(c, "#86663c", -12, -32, 26, 6); rect(c, "#ebc86e", -10, -33, 22, 5); for (const px of [-10, 0, 9]) rect(c, "#ebc86e", px, -38, 3, 8); rect(c, "#f7e3a0", 0, -32, 3, 3); }
    c.restore();
  }
  function snow(c, time, strength = 1) {
    for (let i = 0; i < 36 * strength; i++) {
      const x = (i * 71 + Math.sin(time * .45 + i) * 8 + 490) % 480, y = (i * 37 + time * (7 + i % 4)) % 280;
      rect(c, i % 3 ? "#edf8f0bb" : "#ffffff", x, y, i % 4 === 0 ? 2 : 1, 1);
    }
  }
  function newBackground(c, zone, time) {
    const snowy = zone === 6 || zone === 11, outdoor = snowy || zone === 10;
    const walls = ["#9ab3c1", "#555963", "#6c8587", "#485f67", "#9eafa0", "#768da5"], color = walls[zone - 6] || walls[0];
    rect(c, color, 0, 0, 480, 280);
    if (outdoor) {
      rect(c, zone === 10 ? "#bacdb4" : "#bfd4dc", 0, 40, 480, 50); rect(c, zone === 10 ? "#d8ddba" : "#d7e4e2", 0, 90, 480, 60);
      for (let i = 0; i < 7; i++) { const x = i * 80 - 32; rect(c, snowy ? "#8fa6b5" : "#8fa38b", x, 94 - i % 3 * 12, 100, 57); rect(c, snowy ? "#c6d8dc" : "#afc1a1", x + 22, 87 - i % 3 * 12, 55, 12); }
      if (zone === 6) {
        rect(c, "#7d8f9b", 54, 56, 342, 92); rect(c, "#dbe6df", 49, 51, 352, 8); rect(c, "#9daeb2", 57, 61, 336, 84);
        for (let row = 0; row < 2; row++) for (let col = 0; col < 12; col++) { const x = 67 + col * 27, y = 69 + row * 33; rect(c, "#637f90", x, y, 18, 24); rect(c, "#b4d4d7", x + 2, y + 2, 14, 19); detail(c, "#e0ede5", x + 8, y + 1, 1, 22); detail(c, "#e0ede5", x + 1, y + 11, 16, .5); }
        rect(c, "#758697", 207, 116, 35, 32); rect(c, "#e1e9dc", 205, 113, 39, 4);
      } else {
        // The boundary and snow shrine share the school spirit gate motif.
        const gate = zone === 11 ? "#ae6458" : "#70856a", light = zone === 11 ? "#df9e7e" : "#bec59a";
        for (const x of [205, 338]) { rect(c, "#445758", x - 3, 69, 15, 84); rect(c, gate, x, 69, 10, 83); detail(c, light, x + 1, 71, 1, 79); }
        rect(c, "#445758", 190, 62, 170, 12); rect(c, gate, 191, 62, 168, 8); rect(c, light, 197, 61, 156, 2); rect(c, gate, 200, 86, 151, 7);
        if (zone === 11) { rect(c, "#eaf4ee", 188, 58, 174, 4); rect(c, "#d6e8e2", 201, 84, 150, 2); }
        for (let ribbon = 0; ribbon < 5; ribbon++) { const x = 227 + ribbon * 24, offset = Math.round(Math.sin(time * 2 + ribbon) * 2); rect(c, "#e9e5bf", x, 94, 2, 17); rect(c, "#f7f2d3", x + offset, 110, 6, 4); rect(c, "#dedbbb", x + offset + 3, 114, 4, 5); }
        for (const x of [77, 419]) { rect(c, "#78847e", x, 117, 8, 28); rect(c, "#596f70", x - 7, 112, 22, 6); rect(c, "#a6b4a5", x - 4, 96, 16, 16); rect(c, "#e8dcb1", x - 1, 100, 10, 9); rect(c, "#586c6e", x - 9, 92, 26, 5); if (snowy) rect(c, "#eaf4ed", x - 10, 90, 28, 3); }
      }
      for (const [x,h] of [[12,50],[144,35],[453,53]]) { rect(c, "#6c7776", x + 8, 147 - h, 5, h); for (let level = 0; level < 3; level++) { rect(c, "#6d8c85", x - 7 + level * 4, 106 - h / 3 + level * 13, 38 - level * 7, 12); if (snowy) rect(c, "#e3eeea", x - 5 + level * 4, 104 - h / 3 + level * 13, 32 - level * 7, 4); } }
    } else {
      for (let y = 26; y < 156; y += 24) { detail(c, "#263f4629", 0, y, 480, 1); for (let x = (y % 48 ? 0 : 28); x < 480; x += 56) detail(c, "#263f4629", x, y, 1, 24); }
      rect(c, "#34464c", 0, 17, 480, 7); detail(c, "#a1b1aa", 0, 18, 480, 1); rect(c, "#3d4e50", 0, 143, 480, 12);
      if (zone === 7) {
        for (const x of [31, 118]) { rect(c, "#343c4a", x, 43, 59, 76); rect(c, "#82929b", x + 4, 47, 51, 68); rect(c, "#bec6ba", x + 8, 51, 19, 25); rect(c, "#abbcb9", x + 31, 51, 19, 25); rect(c, "#827152", x - 4, 82, 67, 8); rect(c, "#a48c64", x - 3, 84, 65, 1); rect(c, "#746249", x + 8, 62, 8, 52); }
        rect(c, "#313e48", 275, 44, 81, 101); rect(c, "#6b766d", 280, 48, 71, 96); rect(c, "#a7ae90", 284, 54, 63, 24); rect(c, "#485c62", 289, 58, 53, 16); detail(c, "#c3b787", 337, 101, 2, 9);
        rect(c, "#c1b07a", 282, 93, 67, 4); for (let i = 0; i < 6; i++) rect(c, "#5c5141", 287 + i * 11, 93, 3, 4);
        for (const [x,y] of [[211,49],[393,79],[189,117]]) { detail(c, "#2d394255", x, y, 1, 10); detail(c, "#2d394255", x - 3, y + 10, 4, 1); detail(c, "#2d394255", x - 3, y + 11, 1, 9); }
      } else if (zone === 8) {
        for (const x of [28, 124, 220]) { rect(c, "#425b61", x, 55, 69, 72); rect(c, "#294b54", x + 4, 59, 61, 62); detail(c, "#adc7b7", x + 2, 57, 1, 66); for (let row = 0; row < 2; row++) { rect(c, "#9b9875", x + 4, 85 + row * 34, 61, 3); for (let j = 0; j < 4; j++) { const px = x + 10 + j * 13, py = 66 + row * 34; rect(c, "#bdd9c5", px + 2, py, 3, 5); rect(c, ["#8ab2c4","#b0c980","#b79bc7","#d3b087"][j], px, py + 5, 7, 11); detail(c, "#e4f5df", px + 1, py + 6, 1, 6); } } }
        rect(c, "#3e5758", 352, 62, 66, 68); rect(c, "#82a8a5", 357, 67, 56, 58); rect(c, "#b4d6c5", 365, 76, 39, 39); rect(c, "#87b8ac", 369, 80, 31, 31); rect(c, "#cef1c6", 377, 85, 15, 21); detail(c, "#f0f8d9", 379, 87, 2, 11);
        rect(c, "#858f73", 20, 132, 428, 8); rect(c, "#b1ad83", 18, 130, 432, 3); rect(c, "#4d665f", 42, 140, 8, 14); rect(c, "#4d665f", 417, 140, 8, 14);
      } else {
        for (const x of [28, 177, 326]) { rect(c, "#304a53", x, 51, 107, 99); rect(c, "#54757a", x + 7, 57, 93, 89); rect(c, "#253f4d", x + 15, 69, 77, 75); for (let r = 0; r < 6; r++) detail(c, "#687f7c", x + 18, 78 + r * 11, 71, 1); }
        rect(c, "#506d67", 0, 35, 480, 9); detail(c, "#a2aea0", 0, 36, 480, 1); for (const x of [48, 214, 391]) { rect(c, "#354d4d", x, 31, 6, 18); detail(c, "#a3af9a", x + 1, 33, 1, 13); }
        for (let i = 0; i < 7; i++) { const x = i * 67 + 21, drip = (time * 18 + i * 23) % 97; rect(c, "#9bd2c178", x, 53 + drip, 1, 4); }
      }
    }
    const floor = snowy ? "#d6e3e2" : zone === 7 ? "#73756c" : zone === 8 ? "#82978d" : zone === 9 ? "#507d81" : "#a1b28b";
    rect(c, floor, 0, 153, 480, 127); rect(c, snowy ? "#ecf3e9" : "#b2c0a466", 0, 151, 480, 3);
    for (let y = 156; y < 280; y += 23) { detail(c, snowy ? "#a2bbc42e" : "#3f62513d", 0, y, 480, 1); for (let x = y % 2 ? 0 : 30; x < 480; x += 60) detail(c, snowy ? "#a2bbc42e" : "#3f62513d", x, y, 1, 23); }
    if (zone === 9) for (let i = 0; i < 20; i++) { const x = (i * 53 + time * 8) % 480, y = 162 + i * 17 % 111; detail(c, "#bcdfce77", x, y, 13 + i % 4 * 5, .5); }
    if (zone === 10) { for (let i = 0; i < 15; i++) { const x = (i * 49 + time * 32) % 510 - 20, y = 35 + i * 19 % 199; rect(c, "#edf1d65c", x, y, 11 + i % 4 * 7, 1); } for (let i=0;i<13;i++) { const x=i*41; rect(c,"#718d64",x,147,2,8); rect(c,"#afc585",x+2,149,2,6); } }
    if (snowy) { for (let i = 0; i < 16; i++) { const x = i * 33 + 5, y = 166 + i * 29 % 107; detail(c, "#f4f9ef", x, y, 9, .5); } snow(c, time); }
    rect(c, "#27424c18", 0, 263, 480, 17);
  }
  function activityBackground(c, activity, time, reduced) {
    const kind = activity.kind;
    rect(c, kind === "daily" ? "#796b54" : kind === "weekly" ? "#414154" : "#394d5e", 0, 0, 480, 280);
    if (kind === "daily") {
      rect(c,"#9f9270",0,27,480,123);rect(c,"#554f43",0,18,480,9);detail(c,"#c6b68c",0,28,480,1);
      for (let y=40;y<150;y+=23) { detail(c,"#75694d66",0,y,480,1);for(let x=y%2?15:45;x<480;x+=60)detail(c,"#75694d66",x,y,1,23); }
      for (const x of [17,108,199]) { rect(c,"#524b3d",x,56,79,91);for(let row=0;row<2;row++){rect(c,"#ae8b54",x+3,91+row*43,73,4);detail(c,"#dfbc77",x+3,91+row*43,73,1);for(let box=0;box<3;box++){const bx=x+8+box*22,by=65+row*43;rect(c,"#735d3f",bx,by,18,24);rect(c,"#b0965d",bx+1,by+1,16,21);detail(c,"#dbc289",bx+2,by+2,14,.5);rect(c,"#e1d1a0",bx+7,by+6,5,7);detail(c,"#8a7758",bx+8,by+8,3,.5);}} }
      rect(c,"#536866",314,42,130,107);rect(c,"#81938b",320,48,118,101);rect(c,"#b7bc9e",328,56,102,92);rect(c,"#596c65",338,65,82,83);
      c.strokeStyle="#c3c9a4";c.lineWidth=3;c.beginPath();c.arc(379,106,25,0,Math.PI*2);c.stroke();rect(c,"#d4cd9b",377,88,4,36);rect(c,"#d4cd9b",361,104,36,4);rect(c,"#e6d8a2",375,102,8,8);
      rect(c,"#3d524a",334,33,92,14);c.font="8px Galmuri, monospace";c.fillStyle="#eadbad";c.fillText("방과 후 보급고",345,46);
    } else if (kind === "weekly") {
      rect(c,"#5a5263",0,25,480,126);for(const x of [17,151,306,448]){rect(c,"#343645",x,27,12,127);detail(c,"#9a8977",x+1,28,1,123);}
      for(const x of [39,174]){rect(c,"#2d344b",x,42,97,96);rect(c,"#8a879b",x+6,48,85,82);rect(c,"#50627e",x+11,53,75,72);rect(c,"#c2c9bd",x+22,59,26,27);rect(c,"#50627e",x+17,56,24,24);rect(c,"#35364a",x+44,48,4,82);detail(c,"#bcafa0",x+7,94,81,1);rect(c,"#6c3e54",x-5,36,14,104);rect(c,"#6c3e54",x+89,36,14,104);detail(c,"#b47a79",x-3,39,2,96);}
      rect(c,"#292f3c",334,43,85,102);rect(c,"#78556a",339,48,75,92);rect(c,"#ab8990",342,51,69,2);rect(c,"#4e3b51",346,58,61,76);
      rect(c,"#645041",298,125,154,20);rect(c,"#a3835a",293,122,164,5);detail(c,"#ddbc86",296,122,157,1);rect(c,"#e3d8ad",317,112,31,9);detail(c,"#8b897c",321,115,21,.5);
      c.strokeStyle="#c2b08b88";c.lineWidth=1;for(let i=0;i<4;i++){c.beginPath();c.moveTo(308+i*33,42);c.lineTo(449-i*31,141);c.stroke();}
      rect(c,"#bca981",368,72,17,24);rect(c,"#634950",371,76,11,17);c.font="8px Galmuri, monospace";c.fillStyle="#efdaa3";c.fillText("封",372,88);
    } else {
      // Nested doorways and a vanishing floor make the same corridor appear to
      // fold back into itself. Floor number changes without a finite art limit.
      for(let ring=0;ring<7;ring++){const x=18+ring*31,y=20+ring*11,w=444-ring*62,h=133-ring*11;rect(c,ring%2?"#58707c":"#47616d",x,y,w,h);rect(c,"#263e50",x+7,y+6,w-14,h-6);detail(c,"#a3b9b055",x+1,y+1,w-2,1);detail(c,"#a3b9b033",x+1,y+1,1,h-1);}
      rect(c,"#8ba69d",232,92,33,60);rect(c,"#38596a",237,97,23,55);rect(c,"#b5d0ae",243,106,10,2);rect(c,"#d0debc",254,126,2,3);
      for(const side of [38,419])for(let light=0;light<3;light++){const y=48+light*31;rect(c,"#1c3445",side,y,23,17);rect(c,"#c6deb5",side+5,y+3,13,9);detail(c,"#f0f4cd",side+6,y+4,11,1);}
      c.font="10px Galmuri, monospace";c.textAlign="center";c.fillStyle="#d2e6c4";c.fillText(`뫼비우스의 복도 · ${activity.floor || 1}층`,240,52);c.textAlign="left";
    }
    const floor = kind === "daily" ? "#a18b62" : kind === "weekly" ? "#676477" : "#6a8587";
    rect(c,floor,0,153,480,127);detail(c,"#c4c6a0",0,151,480,2);
    if(kind === "weekly"){rect(c,"#705365",232,153,193,127);detail(c,"#c3a67b",237,153,1,127);detail(c,"#c3a67b",419,153,1,127);}
    for(let y=158;y<280;y+=24){detail(c,"#263f452e",0,y,480,1);for(let x=y%2?18:58;x<480;x+=80)detail(c,"#263f452e",x,y,1,24);}
    if(kind === "tower"){c.save();c.strokeStyle="#b9cfb835";c.lineWidth=.7;for(let x=-240;x<=720;x+=90){c.beginPath();c.moveTo(249,153);c.lineTo(x,280);c.stroke();}c.restore();}
    for(let i=0;i<15;i++){const x=(i*71+(reduced?0:Math.sin(time*.4+i)*9)+480)%480,y=(i*29+(reduced?0:time*3))%250;rect(c,kind==="weekly"?"#d3b9e73d":"#e9edba3d",x,y,1,1);}
    rect(c,"#152d3520",0,263,480,17);
  }
  function background(c, stage, time) {
    const zone = S.chapter(stage), outdoor = zone === 3 || zone === 5;
    if (zone >= 6) { newBackground(c, zone, time); return; }
    const wall = ["#d9c6a1", "#c5c6ab", "#bdab92", "#8cab83", "#b6b6a1", "#626e8d"][zone];
    rect(c, wall, 0, 0, 480, 280);
    // Layered colour bands and small masonry details keep the scenery readable
    // at QHD without introducing a blur filter or stretching a low-res bitmap.
    if (!outdoor) {
      rect(c, shade(wall, 10), 0, 0, 480, 15); rect(c, shade(wall, -8), 0, 129, 480, 8);
      for (let y = 31; y < 132; y += 18) for (let x = 7 + y % 11; x < 480; x += 47) detail(c, "#fff8dc20", x, y, 7, .5);
    }
    if (outdoor) {
      const sky = zone === 5 ? ["#3d456b", "#61698e", "#9897ad"] : ["#9fc6bd", "#c3d5b4", "#e5dcaf"];
      for (let i = 0; i < 3; i++) rect(c, sky[i], 0, i * 47, 480, 48);
      if (zone === 5) { for (let i = 0; i < 24; i++) rect(c, "#e8dfb8", (i * 73 + 27) % 480, (i * 31 + 11) % 117, 2, 2); rect(c, "#e9dfbc", 360, 26, 29, 29); rect(c, sky[0], 353, 20, 24, 25); }
      else { rect(c, "#efe2a1", 390, 24, 31, 31); for (let i = 0; i < 4; i++) { const x = (i * 135 + time * 1.5) % 560 - 60; rect(c, "#e9e7c9", x, 26 + i * 20, 68, 11); rect(c, "#e9e7c9", x + 13, 17 + i * 20, 32, 12); } }
      for (let i = 0; i < 13; i++) { const x = i * 40, by = 108 - (i % 3) * 15; rect(c, zone === 5 ? "#48516b" : "#658978", x, by, 35, 50);
        if (zone === 5) for (let wy = by + 6; wy < 135; wy += 9) for (let wx = x + 5; wx < x + 30; wx += 8) detail(c, (wx + wy) % 3 ? "#a8b7b07d" : "#edda9f9c", wx, wy, 3, 4);
        else { rect(c, "#749b78", x - 5, by - 4, 28, 16); rect(c, "#8cae86", x, by - 8, 16, 8); for (let leaf = 0; leaf < 4; leaf++) detail(c, "#bad09b", x + leaf * 5, by + (leaf % 2) * 3, 2, .5); }
      }
      rect(c, zone === 5 ? "#555f75" : "#62775c", 0, 137, 480, 13); rect(c, "#b7b69b", 0, 136, 480, 4);
      for (let i = 0; i < 10; i++) { rect(c, "#8a947d", i * 55, 116, 5, 26); detail(c, "#cbd1b0", i * 55, 116, 1, 26); }
      detail(c, zone === 5 ? "#c3c8d0" : "#cbd1b0", 0, 119, 480, 1); detail(c, "#d4d8b3", 0, 136, 480, .5);
      if (zone === 3) {
        rect(c, "#927750", 209, 119, 72, 5); rect(c, "#ae9365", 207, 113, 76, 5); rect(c, "#bba16c", 207, 107, 76, 4); rect(c, "#536453", 214, 124, 4, 14); rect(c, "#536453", 272, 124, 4, 14);
        for (let i = 0; i < 14; i++) { const x = i * 34 + 4, y = 142 + (i % 3); detail(c, "#dcd9a9", x, y, 2, .5); detail(c, "#ebc2a3", x + 6, y - 3, 2, 2); detail(c, "#729567", x + 6.5, y, .5, 4); }
      }
    } else {
      rect(c, "#6c6555", 0, 16, 480, 5); rect(c, "#a08f70", 0, 22, 480, 3);
      for (const wx of [24, 105]) {
        rect(c, "#716b58", wx - 3, 35, 72, 83); rect(c, "#e6ddb4", wx, 38, 66, 77);
        rect(c, zone === 2 ? "#94b0aa" : "#9dbfb1", wx + 3, 41, 60, 68);
        rect(c, "#b5cba9", wx + 3, 80, 60, 29); rect(c, "#e5d4a2", wx + 30, 38, 4, 77); rect(c, "#e5d4a2", wx, 71, 66, 4);
        rect(c, "#827359", wx - 6, 115, 78, 5);
        detail(c, "#fff4cf", wx, 38, 66, 1); detail(c, "#f2e7bd", wx, 38, 1, 77); detail(c, "#546d6666", wx + 3, 42, 1, 67);
        for (let i = 0; i < 4; i++) { const tx = wx + 5 + i * 14, ty = 88 + (i % 2) * 5; rect(c, "#9db69a", tx, ty, 11, 18); rect(c, "#abc5a5", tx + 2, ty - 4, 7, 9); }
        // Glints stay inside each glass pane, with opaque pixel edges.
        detail(c, "#eff4db66", wx + 7, 46, 3, 18); detail(c, "#eff4db44", wx + 11, 46, 1, 11);
        detail(c, "#eff4db66", wx + 38, 46, 3, 18); detail(c, "#eff4db44", wx + 42, 46, 1, 11);
        rect(c, "#e5d4a2", wx + 30, 38, 4, 77); rect(c, "#e5d4a2", wx, 71, 66, 4);
        detail(c, "#fff4d0", wx + 30, 38, .5, 77); detail(c, "#fff4d0", wx, 71, 66, .5); detail(c, "#7f806b", wx + 28, 88, 1.5, 5);
        detail(c, "#c1ad83", wx - 6, 115, 78, 1); detail(c, "#4e514531", wx - 3, 120, 72, 2);
      }
      if (zone === 2) {
        for (const sx of [207, 300, 390]) { rect(c, "#745e47", sx, 38, 73, 105); rect(c, "#554d3f", sx + 5, 43, 63, 90); detail(c, "#c5a67c", sx + 1, 39, 1, 103); for (let row = 0; row < 3; row++) { for (let j = 0; j < 8; j++) { const bx = sx + 8 + j * 7, by = 48 + row * 28; rect(c, ["#8d6d5d", "#909c7b", "#c7b17a", "#7e92a0"][(j + row) % 4], bx, by, 5, 21 - (j % 3) * 2); detail(c, "#f0d9a6", bx + 1, by + 3, 3, .5); detail(c, "#f0d9a6", bx + 1, by + 14, 3, .5); detail(c, "#ffffff22", bx, by, .5, 18); } rect(c, "#8e7351", sx + 3, 71 + row * 28, 67, 4); detail(c, "#c7a87c", sx + 3, 71 + row * 28, 67, .5); } }
      } else if (zone === 1) {
        // A hallway has lockers and a notice board instead of a classroom board.
        for (let i = 0; i < 6; i++) { const lx = 210 + i * 23; rect(c, "#687f75", lx, 52, 22, 84); rect(c, i % 2 ? "#9bab8e" : "#aab69a", lx + 1, 53, 20, 81); detail(c, "#d4dabb", lx + 2, 54, .5, 78); detail(c, "#657467", lx + 17, 89, 1, 5); for (let r = 0; r < 3; r++) detail(c, "#778e78", lx + 5, 60 + r * 3, 10, .5); detail(c, "#f2e3b8", lx + 8, 78, 6, 3); }
        rect(c, "#96734d", 372, 49, 83, 65); rect(c, "#c6ad7c", 375, 52, 77, 59);
        for (const [px,py,pw,ph,col] of [[380,58,27,28,"#f5e7be"],[412,58,31,18,"#d4e1bd"],[414,82,28,21,"#e2c8ab"]]) { rect(c,col,px,py,pw,ph); detail(c,"#8d8e7355",px+4,py+7,pw-8,.5); detail(c,"#8d8e7355",px+4,py+11,pw-11,.5); detail(c,"#9d624b",px+pw/2,py+1,1.5,1.5); }
      } else if (zone === 4) {
        // Gym wall panelling, a basketball hoop and a compact school scoreboard.
        for (let wx = 198; wx < 480; wx += 15) { rect(c, "#b99b73", wx, 33, 14, 104); detail(c, "#d1b48a", wx, 33, .5, 103); detail(c, "#9f825f", wx + 13, 33, .5, 103); }
        rect(c, "#5d6b66", 260, 29, 6, 17); rect(c, "#786d57", 232, 44, 68, 47); rect(c, "#efe4c6", 234, 46, 64, 43); rect(c, "#c06e4f", 250, 64, 32, 1); rect(c, "#c06e4f", 250, 64, 1, 21); rect(c, "#c06e4f", 281, 64, 1, 21); rect(c, "#c06e4f", 250, 84, 32, 1);
        rect(c, "#80563e", 251, 87, 30, 3); rect(c, "#d9875d", 252, 87, 28, 1);
        for (let net = 0; net < 6; net++) { detail(c, "#f0e8cc", 253 + net * 5, 91, .5, 12); detail(c, "#ded6ba", 255 + net * 4, 103, .5, 6); } detail(c, "#f0e8cc", 253, 96, 26, .5); detail(c, "#f0e8cc", 256, 104, 21, .5);
        rect(c, "#4f5c4c", 358, 46, 92, 42); rect(c, "#293f3d", 360, 48, 88, 38); c.fillStyle = "#d7d9b5"; c.font = "6px Galmuri, monospace"; c.fillText("HOME    SCHOOL    AWAY", 365, 58); c.fillStyle = "#e8c16e"; c.font = "14px Galmuri, monospace"; c.fillText("24   :   16", 367, 77);
        for (const bx of [387, 415]) { rect(c, "#6e7a6c", bx, 108, 20, 29); rect(c, "#9aa080", bx + 2, 111, 16, 24); detail(c, "#c7c6a0", bx + 3, 112, 1, 22); }
      } else {
        rect(c, "#6e614b", 207, 39, 182, 88); rect(c, "#3b6456", 213, 45, 170, 75); rect(c, "#b7bf97", 227, 57, 62, 2); rect(c, "#b7bf97", 227, 65, 105, 2); rect(c, "#b7bf97", 227, 73, 80, 2);
        c.fillStyle = "#d4d8b4"; c.font = "11px Galmuri, monospace"; c.fillText("방과 후 모험부", 227, 101);
        rect(c, "#9d8460", 202, 125, 193, 5); rect(c, "#c5bca0", 347, 122, 13, 3);
        rect(c, "#776a57", 419, 42, 34, 34); rect(c, "#ede2bf", 423, 46, 26, 26); rect(c, "#675d50", 435, 51, 2, 12); rect(c, "#675d50", 435, 60, 9, 2);
        detail(c, "#b8a477", 208, 40, 180, .5); detail(c, "#829d7c", 214, 46, 168, .5); detail(c, "#244d433b", 214, 118, 168, 1.5);
        for (let i = 0; i < 6; i++) detail(c, "#e1ddad", 226 + i * 4, 83, 2, .5);
        rect(c, "#c6ab77", 418, 91, 36, 37); rect(c, "#f1e2bc", 420, 93, 32, 32); detail(c, "#ab7460", 425, 99, 22, 2);
        for (let r = 0; r < 4; r++) for (let col = 0; col < 5; col++) detail(c, r === 2 && col === 2 ? "#b2785c" : "#b6b394", 425 + col * 4.5, 105 + r * 4, 2, 1.5);
      }
      rect(c, "#a49b7c", 0, 137, 480, 13); rect(c, "#796c53", 0, 148, 480, 6);
      detail(c, "#d6c7a0", 0, 137, 480, 1); detail(c, "#514f412e", 0, 151, 480, 2);
    }
    const floor = outdoor ? (zone === 5 ? "#7e8490" : "#a5ae87") : "#b2946a";
    rect(c, floor, 0, 153, 480, 127);
    for (let y = 155; y < 280; y += 24) { rect(c, outdoor ? "#596b5b28" : "#705b4138", 0, y, 480, 2); for (let x = (y % 48 ? -20 : 20); x < 480; x += 80) rect(c, outdoor ? "#596b5b28" : "#705b4138", x, y, 2, 24); }
    for (let y = 158; y < 279; y += 12) for (let x = (y % 24 ? 15 : 51); x < 480; x += 80) detail(c, outdoor ? "#edf0c31c" : "#f4d7a526", x, y, 13 + x % 7, .5);
    if (zone === 4) { detail(c, "#f2e6b594", 11, 164, 458, 1); detail(c, "#f2e6b594", 240, 164, 1, 116); detail(c, "#f2e6b594", 12, 164, 1, 116); detail(c, "#f2e6b594", 468, 164, 1, 116); c.save(); c.strokeStyle = "#f2e6b594"; c.lineWidth = .8; c.beginPath(); c.ellipse(240, 227, 47, 26, 0, 0, Math.PI * 2); c.stroke(); c.restore(); }
    if (!outdoor) { rect(c, "#f8e8b21a", 29, 155, 63, 20); rect(c, "#f8e8b218", 35, 175, 68, 20); rect(c, "#f8e8b214", 42, 195, 74, 20); rect(c, "#f8e8b21a", 111, 155, 60, 20); rect(c, "#f8e8b218", 118, 175, 66, 20); }
    rect(c, "#2b3d3420", 0, 260, 480, 20);
    if (!outdoor) { rect(c, "#806b4d", 13, 238, 32, 27); rect(c, "#d1b578", 9, 230, 41, 10); detail(c, "#f1d39a", 10, 231, 38, 1); detail(c, "#5a523b", 13, 241, 32, 1); detail(c, "#b89a68", 15, 242, 1, 21); rect(c, "#68795d", 22, 218, 22, 11); rect(c, "#a2ab7e", 29, 208, 13, 15); rect(c, "#697c60", 14, 213, 16, 9); detail(c, "#c3cb8c", 30, 210, 6, 1); detail(c, "#b5c185", 16, 214, 5, .5); detail(c, "#435b48", 27, 220, 2, 9); }
    for (let i = 0; i < 10; i++) { const x = (i * 59 + Math.sin(time * .15 + i) * 15 + 32) % 480, y = (i * 19 + time * 3) % 235; rect(c, "#fff1c745", x, y, 2, 2); }
  }
  const dragon = document.createElement("canvas"); dragon.width = 104; dragon.height = 72;
  const dc = dragon.getContext("2d");
  const spine = [[8,60],[16,63],[25,59],[29,51],[25,43],[20,36],[24,27],[34,24],[44,29],[49,37],[55,43],[64,39],[68,31],[64,23],[64,16],[71,12],[80,15]];
  for (const [size, color] of [[13,"#196ca5"],[9,"#249dd5"],[5,"#6cdced"]]) {
    for (let j = 1; j < spine.length; j++) { const a = spine[j - 1], b = spine[j]; for (let t = 0; t <= 1; t += .12) rect(dc, color, a[0] + (b[0] - a[0]) * t - size / 2, a[1] + (b[1] - a[1]) * t - size / 2, size, size); }
  }
  for (const [x,y] of [[20,40],[32,22],[48,29],[58,42],[63,19]]) { rect(dc,"#b0f5fa",x-3,y-5,4,7); rect(dc,"#6bd9ee",x-5,y-8,3,4); }
  rect(dc,"#186d9f",70,7,18,15); rect(dc,"#35b7e1",71,7,17,12); rect(dc,"#87e9f3",74,7,13,4);
  rect(dc,"#197aa9",84,14,16,8); rect(dc,"#64dbed",84,14,15,5); rect(dc,"#bdfbfa",94,14,5,3);
  rect(dc,"#18769f",81,22,15,4); rect(dc,"#85e6f2",82,22,14,2); rect(dc,"#eafffb",86,19,3,4);
  rect(dc,"#dcffff",82,11,5,3); rect(dc,"#185681",86,11,2,2);
  rect(dc,"#a3f4f6",70,0,3,9); rect(dc,"#6cdbef",67,0,4,3); rect(dc,"#bdfbfa",78,2,3,7); rect(dc,"#60c9eb",80,0,3,3);
  for (const [x,y] of [[62,7],[59,12],[61,17]]) { rect(dc,"#5acdeb",x,y,11,3); rect(dc,"#a6f1f7",x-3,y-2,5,2); }
  rect(dc,"#b0f6fa",94,20,9,2); rect(dc,"#b0f6fa",101,21,2,7); rect(dc,"#8eeaf5",97,27,6,2);
  function waterOrb(c, x, y, radius) {
    const r = Math.round(radius);
    rect(c,"#17649e",x-r,y-r+4,r*2,r*2-8); rect(c,"#17649e",x-r+4,y-r,r*2-8,r*2);
    rect(c,"#259fd0",x-r+3,y-r+5,r*2-6,r*2-10); rect(c,"#63deee",x-r+6,y-r+3,r*2-12,r);
    rect(c,"#d4ffff",x-r+7,y-r+6,Math.max(3,r/2),4); rect(c,"#a1f2f6",x+r-6,y,3,Math.max(3,r-6));
  }
  function waterBurst(c, p, age, reduced, size = 1) {
    const spread = reduced ? 15 * size : (10 + age * 50) * size;
    c.save(); c.globalAlpha *= Math.max(0, 1 - age / .65);
    for(let i=0;i<10;i++){const a=i*Math.PI/5;rect(c,i%2?"#bffbff":"#47cbe8",p.x+Math.cos(a)*spread,p.y-34+Math.sin(a)*spread*.7,4*size,6*size);}
    c.restore();
  }
  function waterDragon(c, source, targets, age, reduced) {
    const destination = Math.min(453, Math.max(...targets.map(p=>p.x)) + 24);
    c.save();
    if(reduced){
      c.globalAlpha=.85; c.drawImage(dragon,age<1?source.x+20:150,44,age<1?145:300,age<1?100:208);
      for(const p of targets)rect(c,"#80e5f0",p.x-22,p.y-10,44,6);
    }else{
      // 0-.5s: the summoning pool opens; .5-1s: the body uncoils and rushes right.
      const summon=Math.min(1,age/.5),rush=Math.max(0,Math.min(1,(age-.5)/.5)),impact=Math.max(0,age-1);
      c.globalAlpha=Math.min(1,summon*2)*Math.max(0,1-impact/.8);
      for(let ring=0;ring<3;ring++){
        c.strokeStyle=["#187ba5","#45cee5","#c3ffff"][ring];c.lineWidth=4-ring;c.beginPath();c.ellipse(source.x+18,source.y-4-ring*4,18+summon*27-ring*5,5+summon*8,0,0,Math.PI*2);c.stroke();
      }
      const nose=source.x+108+(destination-source.x-108)*(rush*rush),headY=179-summon*43-Math.sin(rush*Math.PI)*33;
      // Animated pixel segments bend independently instead of moving a static dragon image.
      for(let i=23;i>=0;i--){
        const x=source.x+18+(nose-96-source.x-18)*(1-i/24),y=headY-8+Math.sin(i*.5-age*10)*(12+i*.65)+i*1.6;
        const size=Math.max(4,(28-i*.8)*summon);
        rect(c,"#176799",x-size/2,y-size/2,size,size);rect(c,"#2aafd5",x-size/2+3,y-size/2+2,Math.max(2,size-5),Math.max(2,size-4));
        rect(c,"#83edf4",x-size/2+4,y-size/2+3,Math.max(2,size-8),Math.max(2,size*.27));
        if(i%4===0&&i<20){rect(c,"#b9ffff",x-2,y-size/2-8,4,10);rect(c,"#60daed",x-5,y-size/2-10,4,5);}
      }
      c.drawImage(dragon,63,0,41,32,Math.round(nose-123),Math.round(headY-57),123,96);
      for(let i=0;i<13;i++){const x=source.x+26+(i*43+age*185)%Math.max(40,nose-source.x-10),y=166+Math.sin(i+age*8)*28;rect(c,"#94edf5",x,y,7+12*rush,3);}
      if(age>=.5)for(let i=0;i<17;i++){const x=source.x+30+i*19;if(x>nose)break;const y=227+Math.sin(i*.7-age*10)*8;rect(c,"#188bc4aa",x,y,22,18);rect(c,"#82e7f1",x,y-2,15,4);}
      if(age>=1){
        for(const p of targets){waterBurst(c,p,impact,false,2);c.strokeStyle="#d3ffff";c.lineWidth=3;c.beginPath();c.ellipse(p.x,p.y-34,12+impact*65,10+impact*45,0,0,Math.PI*2);c.stroke();}
      }
    }
    c.restore();
  }
  function waterEffects(c, effects, positions, time, reduced, pending, cinematic) {
    for (const e of effects) {
      if (e.from !== "osia") continue;
      if (e.kind === "skill-stage" && e.stage === 4 && cinematic?.castId === e.castId) continue;
      const rawAge = time - e.time - (e.kind === "skill-stage" ? (e.cinematicDuration || 0) / 1000 : 0);
      const age = pending && pending.id === e.castId ? Math.min(rawAge, e.impactDelay / 1000 - .001) : rawAge;
      const source = positions.osia; if (!source || age < 0) continue;
      if (e.kind === "skill-stage" && age < (e.stage === 4 ? 1.8 : 1.1)) {
        const targets=e.targets.map(id=>positions[id]).filter(Boolean);if(!targets.length)continue;
        const motion=reduced?.3:age,impactAge=age-e.impactDelay/1000;
        c.save();
        if(e.stage===1){
          for(const p of targets){
            if(age<.5){const progress=reduced?1:Math.min(1,age/.5),x=source.x+23+(p.x-source.x-23)*progress,y=source.y-41+(p.y-source.y+7)*progress-Math.sin(progress*Math.PI)*22;waterOrb(c,x,y,19);if(!reduced){rect(c,"#8eeaf3",x-40,y-3,16,5);rect(c,"#d1ffff",x-56,y-1,10,2);}}
            else {waterOrb(c,p.x,p.y-34,Math.max(6,22-impactAge*24));waterBurst(c,p,impactAge,reduced,1.3);}
          }
        } else if(e.stage===2){
          c.globalAlpha=age<.5?.6+age*.8:Math.max(0,1-impactAge/.65);
          for(const p of targets){
            for(let ring=0;ring<4;ring++){c.strokeStyle=["#176ba1","#229dce","#5bdaed","#cbffff"][ring];c.lineWidth=4-ring*.5;c.beginPath();c.ellipse(p.x,p.y-21-ring*13,34-ring*5,12,-motion*6,0,Math.PI*2);c.stroke();}
            for(let i=0;i<12;i++){const a=i*Math.PI/6+motion*13;rect(c,"#92f0f9",p.x+Math.cos(a)*37,p.y-42+Math.sin(a)*31,4,6);}
          }
        } else if(e.stage===3){
          for(const p of targets){
            const height=reduced?100:age<.5?16+age*180:106-Math.max(0,impactAge)*75;
            c.globalAlpha=age<.8?1:Math.max(0,(1.1-age)/.3);
            rect(c,"#197aaccc",p.x-21,p.y-height,42,height);rect(c,"#2cbbdfcc",p.x-15,p.y-height-8,30,height+8);rect(c,"#a5f8ff",p.x-5,p.y-height-14,9,height+12);rect(c,"#efffff",p.x-2,p.y-height-14,3,height+10);
            for(let i=0;i<6;i++){const spread=(i-2.5)*13;rect(c,"#75e3f4",p.x+spread,p.y-height+Math.abs(spread)*.5-motion*22,5,9);}rect(c,"#c7ffff",p.x-27,p.y-2,54,4);
          }
        } else waterDragon(c,source,targets,age,reduced);
        c.restore();
        c.save();c.font="11px Galmuri, monospace";c.textAlign="center";
        const label=`스킬 ${e.stage}/4 · ${e.name}${e.stage===4?(age<.5?" 소환":age<1?" 돌진":" 명중!"):""}`,width=c.measureText(label).width+24;
        rect(c,"#153c55ed",240-width/2,13,width,23);rect(c,"#8beaff",240-width/2,35,width,2);c.fillStyle="#d4fbff";c.fillText(label,240,29);c.restore();
      }
      if(e.kind==="hit"&&!e.skill&&age<.65){
        const p=positions[e.to];if(!p)continue;
        if(age<.3){const progress=reduced?1:Math.min(1,age/.3),x=source.x+17+(p.x-source.x-17)*progress,y=source.y-38+(p.y-source.y+4)*progress-Math.sin(progress*Math.PI)*13;waterOrb(c,x,y,9);}
        else waterBurst(c,p,age-.3,reduced,.7);
      }
    }
  }
  function windRing(c, x, y, age, reduced, size = 1) {
    c.save(); c.globalAlpha *= Math.max(0, 1 - age / 1.15);
    const turn = reduced ? 0 : age * 6;
    for (let ring = 0; ring < 3; ring++) {
      c.strokeStyle = ["#87bda8", "#c5e9ba", "#f0f7d5"][ring]; c.lineWidth = 2 - ring * .4;
      c.beginPath(); c.ellipse(x, y - 15 - ring * 15 * size, (24 - ring * 3) * size, 6 * size, -.16, turn + ring, turn + ring + 4.7); c.stroke();
    }
    for (let i = 0; i < 7; i++) { const a = i * Math.PI / 3.5 + turn, px = x + Math.cos(a) * 24 * size, py = y - 26 + Math.sin(a) * 22 * size; rect(c, i % 2 ? "#eff3c4" : "#a7d3a9", px, py, 4, 1); detail(c, "#d7f5c8", px + 1, py - 1, 1, 3); }
    c.restore();
  }
  function windShield(c, x, y, color, alpha = 1, size = 1) {
    c.save(); c.globalAlpha *= alpha; c.translate(x, y - 29); c.scale(size, size);
    c.fillStyle = color + "30"; c.strokeStyle = color; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(-20,-22); c.lineTo(0,-29); c.lineTo(20,-22); c.lineTo(18,8); c.lineTo(9,21); c.lineTo(0,27); c.lineTo(-9,21); c.lineTo(-18,8); c.closePath(); c.fill(); c.stroke();
    detail(c, "#f7ffdf", -10, -15, 1, 14); detail(c, "#f7ffdf", -9, -16, 10, 1); c.restore();
  }
  function windRibbon(c, source, target, age, reduced, power = 1) {
    const progress = reduced ? 1 : clamp01(age / .55), sx = source.x + 17, sy = source.y - 38, tx = target.x, ty = target.y - 30;
    const bend = (target.x > source.x ? -1 : 1) * 30 * power;
    c.save(); c.globalAlpha *= Math.max(0, 1 - Math.max(0, age - .55) / .65);
    for (let trail = 2; trail >= 0; trail--) {
      c.strokeStyle = ["#ecffd2", "#bde9b9", "#70b8a6"][trail]; c.lineWidth = (3 - trail * .6) * power; c.beginPath();
      const start = Math.max(0, progress - .5 - trail * .08);
      for (let n = 0; n <= 18; n++) { const t = start + (progress - start) * n / 18, x = sx + (tx - sx) * t, y = sy + (ty - sy) * t + Math.sin(t * Math.PI) * bend + trail * 3; if (n) c.lineTo(x,y); else c.moveTo(x,y); }
      c.stroke();
    }
    const x = sx + (tx - sx) * progress, y = sy + (ty - sy) * progress + Math.sin(progress * Math.PI) * bend;
    rect(c,"#efffd9",x-3,y-2,7,3);rect(c,"#a4d9ad",x-1,y-4,3,7); c.restore();
  }
  function lavaEffects(c, effects, positions, time, reduced) {
    for (const e of effects) {
      if (e.from !== "lava") continue;
      const age = time - e.time; if (age < 0 || age > 1.35) continue;
      const source = positions.lava;
      if (e.kind === "lava-skill") {
        const targets = (e.targets || []).map(id => positions[id]).filter(Boolean);
        c.save();
        if (source) {
          const swing = reduced ? -.35 : -2.1 + clamp01(age / .7) * 4.7, radius = e.stage === 1 ? 37 : 47;
          c.save(); c.globalAlpha = Math.max(0, 1 - age / 1.3);
          for (let ring = 0; ring < 3; ring++) { c.strokeStyle = ["#6baea3", "#c5edd0", "#f4ffda"][ring]; c.lineWidth = 6 - ring * 1.8; c.beginPath(); c.ellipse(source.x + 5, source.y - 34, radius - ring * 4, radius * .7 - ring * 3, -.3, swing, swing + 2.4); c.stroke(); }
          c.translate(source.x + Math.cos(swing + .7) * 21, source.y - 34 + Math.sin(swing + .7) * 18); c.rotate(swing + 1.7); c.scale(1.35,1.35); fan(c,0,0,true); c.restore();
          if (e.stage === 2) { c.save(); c.globalAlpha = Math.max(0, 1 - age / 1.15); for (let wing = -1; wing <= 1; wing += 2) for (let feather = 0; feather < 4; feather++) { c.strokeStyle = feather % 2 ? "#d0f4c7" : "#8ac6af"; c.lineWidth = 2; c.beginPath(); c.moveTo(source.x,source.y-27); c.quadraticCurveTo(source.x+wing*(32+feather*8),source.y-65-feather*5,source.x+wing*(44+feather*8),source.y-37-feather*6); c.stroke(); } c.restore(); }
        }
        for (const p of targets) {
          if (source && p !== source) windRibbon(c, source, p, age, reduced, e.stage === 2 ? 1.2 : .8);
          windRing(c, p.x, p.y, age, reduced, e.stage === 2 ? 1.3 : 1);
          if (e.stage === 1 && age < 1.1) windShield(c, p.x, p.y, "#b8e8c5", Math.max(0, 1 - age / 1.1), 1);
          if (e.stage === 2) {
            const glow = Math.max(0, 1 - age / 1.15); c.globalAlpha = glow;
            rect(c, "#d3eebe66", p.x - 14, p.y - 74, 28, 76); rect(c, "#f1f6cd88", p.x - 5, p.y - 74, 10, 76);
            rect(c, "#f8ffda", p.x - 3, p.y - 59, 6, 24); rect(c, "#f8ffda", p.x - 12, p.y - 50, 24, 6);
          }
        }
        c.globalAlpha = Math.max(0, Math.min(1, (1.35 - age) * 3)); c.font = "10px Galmuri, monospace"; c.textAlign = "center";
        const label = `라바 · ${e.name}`, width = c.measureText(label).width + 20;
        rect(c, "#375548ee", 240 - width / 2, 39, width, 21); detail(c, "#d9edb6", 240 - width / 2, 59, width, 1); c.fillStyle = "#eff8d5"; c.fillText(label, 240, 53); c.restore();
      } else if (e.kind === "guard") {
        const p = positions[e.to]; if (!p) continue;
        windShield(c, p.x, p.y, "#b7e1ad", Math.max(0, 1 - age / 1.25));
        if (e.passive === "ten-hits") { c.save(); c.font = "9px Galmuri, monospace"; c.textAlign = "center"; rect(c,"#3b594be8",p.x-32,p.y-86,64,16); c.fillStyle="#e5f5c9"; c.fillText("바람의 가호",p.x,p.y-75); c.restore(); }
      } else if (e.kind === "rescue") {
        const p = positions[e.to]; if (!p) continue;
        c.save(); c.globalAlpha = Math.max(0, 1 - age / 1.3); windRing(c, p.x, p.y, Math.min(age, 1), reduced, 1.8);
        for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, r = reduced ? 38 : 18 + age * 45; rect(c, "#fff1b2", p.x + Math.cos(a) * r, p.y - 35 + Math.sin(a) * r, 3, 3); }
        c.font = "10px Galmuri, monospace"; c.textAlign = "center"; rect(c, "#68563de8", p.x - 41, p.y - 98, 82, 19); c.fillStyle = "#fff1c2"; c.fillText("생명의 바람", p.x, p.y - 85); c.restore();
      } else if (e.kind === "hit" && !e.skill && age < .48 && source) {
        const target = positions[e.to]; if (!target) continue;
        windRibbon(c, source, target, Math.min(.55, age * 1.8), reduced, .45);
      }
    }
  }
  function osiaCinematic(c, state, time, effects, reduced) {
    const active = state.battle.cinematic, event = effects.findLast(e => e.kind === "cinematic" && e.from === "osia" && (!active || e.castId === active.castId));
    const duration = (event?.duration || active?.duration || S.OSIA_CINEMATIC_MS) / 1000, age = event ? time - event.time : active ? 0 : -1;
    if (age < 0 || !active && age >= duration || !active && !event) return;
    const enter = reduced ? 1 : Math.min(1, age / .12), offset = reduced ? 0 : (1 - enter) * -45;
    c.save(); rect(c, "#081c32b8", 0, 0, 480, 280);
    c.beginPath(); c.rect(0, 61, 480, 143); c.clip(); c.translate(offset, 0);
    rect(c, "#123a55f5", -50, 62, 580, 141); rect(c, "#1a5671", 0, 69, 480, 126);
    for (let i = 0; i < 15; i++) { const x = reduced ? i * 41 : (i * 41 + age * 230) % 550 - 50; rect(c, i % 2 ? "#75d8e741" : "#b6f6f12e", x, 78 + i * 8, 65 + i % 4 * 21, 2); }
    c.globalAlpha = .42; c.drawImage(dragon, 278, 69, 195, 135); c.globalAlpha = 1;
    if (osiaLoaded) { const tile = osiaImage.naturalWidth / 3; c.drawImage(osiaImage, tile * .18, 0, tile * .65, tile * .58, 2, 63, 164, 146); }
    else osia(c, 76, 211, 3.8, { casting:true });
    c.textAlign = "left"; c.font = "11px Galmuri, monospace"; c.fillStyle = "#9ee8ed"; c.fillText("물의 용왕  OSIA", 174, 99);
    c.font = "17px Galmuri, monospace"; c.fillStyle = "#062b43"; c.fillText("용왕의 권능 · 거대 수룡", 175, 132); c.fillStyle = "#f4ffef"; c.fillText("용왕의 권능 · 거대 수룡", 174, 131);
    c.font = "9px Galmuri, monospace"; c.fillStyle = "#bee6e7"; c.fillText("시간 정지 · 궁극기 발동", 175, 155);
    c.restore(); detail(c, "#adf4ed", 0, 61, 480, 1.5); detail(c, "#87c7dc", 0, 202, 480, 1.5);
  }
  function bossEffects(c, battle, positions, effects, time, reduced) {
    const warning = battle.phase === "fight" && battle.enemies.find(enemy => enemy.hp > 0 && enemy.ability && enemy.warnedFor === enemy.nextAbilityAt && enemy.nextAbilityAt - battle.elapsed <= 1000);
    if (warning) {
      c.save(); const remaining = Math.max(0, (warning.nextAbilityAt - battle.elapsed) / 1000), pulse = reduced ? .7 : .55 + Math.sin(time * 8) * .2;
      c.strokeStyle = "#eabb78"; c.fillStyle = "#cd77522a"; c.lineWidth = 1.5;
      for (const member of battle.heroes.filter(h => h.hp > 0)) { const p = positions[member.id]; c.globalAlpha = pulse; c.beginPath(); c.ellipse(p.x,p.y+3,24,8,0,0,Math.PI*2);c.fill();c.stroke(); detail(c,"#ffe1a5",p.x-1,p.y-7,2,6); detail(c,"#ffe1a5",p.x-1,p.y+1,2,2); }
      c.globalAlpha = 1; c.textAlign = "center"; c.font = "9px Galmuri, monospace";
      const label = `광역기 예고 · ${warning.ability} · ${remaining.toFixed(1)}초`, width = c.measureText(label).width + 20;
      rect(c,"#613d36ee",240-width/2,65,width,20);detail(c,"#f0bd78",240-width/2,84,width,1);c.fillStyle="#ffe8b7";c.fillText(label,240,79);c.restore();
    }
    for (const e of effects) {
      const age = time - e.time; if (e.kind !== "boss-skill" || age < 0 || age > .9) continue;
      c.save(); c.globalAlpha = Math.max(0, 1 - age / .9);
      for (const id of e.targets || []) { const p = positions[id]; if (!p) continue; const r = reduced ? 27 : 10 + age * 62; c.strokeStyle="#e29e7a";c.lineWidth=3;c.beginPath();c.ellipse(p.x,p.y-24,r,r*.7,-.2,0,Math.PI*2);c.stroke();for(let shard=0;shard<6;shard++){const a=shard*Math.PI/3;rect(c,shard%2?"#ffe0a5":"#c76f60",p.x+Math.cos(a)*r,p.y-24+Math.sin(a)*r*.7,3,5);} }
      c.textAlign="center";c.font="10px Galmuri, monospace";const label=`광역기 · ${e.name}`,width=c.measureText(label).width+22;rect(c,"#5c3435ed",240-width/2,65,width,20);c.fillStyle="#ffe0b0";c.fillText(label,240,79);c.restore();
    }
  }
  function draw(c, state, time, effects = [], reduced = false) {
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, c.canvas.width, c.canvas.height);
    c.setTransform(c.canvas.width / 480, 0, 0, c.canvas.height / 280, 0, 0); c.imageSmoothingEnabled = false;
    const battle = state.battle, extendedParty = Math.max(battle.heroes.length, state.team?.length || 0) > 3, cinematicEvent = effects.findLast(e => e.kind === "cinematic" && e.castId === battle.cinematic?.castId);
    const sceneTime = battle.cinematic ? cinematicEvent?.time ?? time : time;
    // A slightly closer background camera brings the floor up behind both
    // formation rows; rear allies must not appear to stand on the classroom wall.
    c.save(); if (extendedParty) { c.translate(-36, -42); c.scale(1.15, 1.15); }
    if (battle.activity) activityBackground(c, battle.activity, sceneTime, reduced);
    else background(c, battle.stage, reduced ? 0 : sceneTime);
    c.restore();
    effects = effects.filter(e => (!e.battleId || e.battleId === battle.id) && time >= e.time);
    effects = effects.filter(e => e.kind !== "skill-stage" || battle.osiaCast?.id === e.castId || effects.some(hit => hit.kind === "skill-impact" && hit.castId === e.castId));
    const positions = {};
    const partyPositions = extendedParty ? [{x:228,y:216},{x:160,y:216},{x:92,y:216},{x:202,y:137},{x:134,y:137},{x:66,y:137}] : [{ x: 173, y: 208 }, { x: 115, y: 181 }, { x: 68, y: 221 }];
    battle.heroes.forEach((h, i) => { positions[h.id] = partyPositions[i] || {x:66 + (i % 3) * 68,y:137}; });
    battle.enemies.forEach((e, i) => { positions[e.id] = battle.boss ? { x: 375, y: 210 } : [{ x: 325, y: 207 }, { x: 384, y: 180 }, { x: 425, y: 225 }][i]; });
    const visualPositions = {...positions};
    const items = battle.heroes.map(h => ({ ...h, side: "hero" })).concat(battle.enemies.map(e => ({ ...e, side: "enemy" }))).sort((a, b) => positions[a.id].y - positions[b.id].y);
    for (const item of items) {
      const p = positions[item.id], hit = effects.some(e => e.to === item.id && e.kind === "hit" && time - e.time < .15), attacking = effects.some(e => e.from === item.id && e.kind === "hit" && time - e.time < .25);
      const stunned = item.hp > 0 && (item.stunUntil || 0) > battle.elapsed;
      const bounce = reduced || item.hp <= 0 || stunned || battle.cinematic ? 0 : Math.round(Math.sin(time * 4 + p.x) * 1.5);
      const nudge = attacking && !reduced && !stunned && !battle.cinematic ? (item.side === "hero" ? 8 : -6) : 0;
      const combo = item.side === "hero" && (item.id === "osia" ? effects.findLast(e => e.kind === "skill-stage" && e.from === "osia" && time - e.time < (e.stage === 4 ? 1.8 : 1.1) + (e.cinematicDuration || 0) / 1000) : item.id === "lava" ? effects.findLast(e => e.kind === "lava-skill" && time - e.time < 1.35) : null);
      const castAge = combo ? time - combo.time - (combo.cinematicDuration || 0) / 1000 : 0;
      const motion = combo && item.hp > 0 ? castingMotion(item.id, combo.stage, castAge, reduced || !!battle.cinematic) : null;
      const scale = extendedParty ? 1.3 : 1.8, moveX = motion ? motion.dx : nudge, moveY = motion ? motion.dy : bounce;
      visualPositions[item.id] = {x:p.x + moveX,y:p.y + moveY};
      if (item.side === "hero") hero(c, item.id, p.x + moveX, p.y + moveY, scale, { hit, dead: item.hp <= 0, attack: attacking, pose: motion?.pose, motion, shadowY:-moveY / scale, ready: item.energy >= S.BY_ID[item.id].cooldown - 1, casting: !!combo || effects.some(e => e.kind === "skill" && e.from === item.id && time - e.time < .8), blink: Math.sin(time * .7 + p.x) > .99 });
      else monster(c, item, p.x + nudge, p.y + bounce, { hit, activity:battle.activity, time:sceneTime, reduced });
      if (item.side === "hero" && item.hp > 0 && item.shield > 0) windShield(c, p.x, p.y, "#bce8d3", .3, extendedParty ? .7 : .92);
      const w = item.boss ? 62 : item.side === "hero" && extendedParty ? 31 : 37, by = p.y + 9;
      rect(c, "#28362f", p.x - w / 2 - 1, by - 1, w + 2, 6); rect(c, "#4d5146", p.x - w / 2, by, w, 4);
      rect(c, item.side === "hero" ? "#9dbd7b" : "#d99c73", p.x - w / 2, by, Math.max(0, w * item.hp / item.max), 4);
      if (item.side === "hero") { rect(c, "#536270", p.x - w / 2, by + 7, w, 2); rect(c, "#e2c679", p.x - w / 2, by + 7, w * item.energy / S.BY_ID[item.id].cooldown, 2); }
    }
    waterEffects(c, effects, visualPositions, time, reduced, battle.osiaCast, battle.cinematic);
    lavaEffects(c, effects, visualPositions, time, reduced);
    bossEffects(c, battle, positions, effects, time, reduced);
    for (const e of effects) {
      const age = time - e.time; if (age > 1.1 || age < 0) continue;
      const p = positions[e.to] || positions[e.from]; if (!p) continue;
      c.save(); c.globalAlpha = Math.min(1, (1.1 - age) * 2);
      const y = p.y - 65 - age * 22;
      if (e.kind === "hit" || e.kind === "heal" || e.kind === "shield") {
        const text = e.kind === "heal" ? `+${e.amount}` : e.kind === "shield" ? "방어" : `${e.amount}`;
        c.font = `${e.skill || e.bossSkill ? 14 : 11}px Galmuri, monospace`; c.textAlign = "center";
        c.fillStyle = "#26342e"; c.fillText(text, p.x + 1, y + 1); c.fillStyle = e.kind === "heal" ? "#dbffac" : e.kind === "shield" ? "#bbdded" : e.bossSkill ? "#ffbd9a" : e.skill ? "#ffe5a1" : "#fff6dd"; c.fillText(text, p.x, y);
      }
      if (e.kind === "skill" && e.from !== "osia") { c.font = "9px Galmuri, monospace"; c.textAlign = "center"; const width = c.measureText(e.name).width + 14; rect(c, "#2b3d37dc", p.x - width / 2, p.y - 89 - age * 9, width, 16); c.fillStyle = "#f6df9b"; c.fillText(e.name, p.x, p.y - 77 - age * 9); }
      if (e.kind === "hit" && (e.skill || e.bossSkill) && age < .3) { c.strokeStyle = e.element === "water" ? "#bafaff" : e.bossSkill ? "#ffc3a1" : "#fff3bb"; c.lineWidth = 3; c.beginPath(); c.moveTo(p.x - 18, p.y - 60); c.lineTo(p.x + 17, p.y - 19); c.stroke(); }
      c.restore();
    }
    // Draw control status last so the large water effect cannot hide it.
    if (battle.phase === "fight") for (const enemy of battle.enemies) {
      const remaining = ((enemy.stunUntil || 0) - battle.elapsed) / 1000;
      if (enemy.hp <= 0 || remaining <= 0) continue;
      const p = positions[enemy.id], y = p.y - (enemy.boss ? 115 : 79);
      c.save(); c.textAlign = "center"; c.font = "10px Galmuri, monospace";
      rect(c,"#26324bea",p.x-32,y,64,17); c.fillStyle="#fff0a8"; c.fillText(`기절 ${remaining.toFixed(1)}초`,p.x,y+12);
      for(let i=0;i<3;i++){const x=p.x+(i-1)*15,sy=y-9+(reduced?0:Math.sin(time*7+i*2)*2);rect(c,"#ffdd73",x-4,sy-1,9,3);rect(c,"#ffdd73",x-1,sy-4,3,9);rect(c,"#fff4bc",x-1,sy-1,3,3);}
      c.restore();
    }
    if (battle.phase === "fight") for (const member of battle.heroes) {
      const remaining = ((member.indomitableUntil || 0) - battle.elapsed) / 1000;
      if (member.hp <= 0 || remaining <= 0) continue;
      const p = positions[member.id]; windShield(c, p.x, p.y, "#f2df9f", .8, 1.07);
      c.save(); c.textAlign = "center"; c.font = "9px Galmuri, monospace"; rect(c,"#66553de8",p.x-30,p.y-79,60,16); c.fillStyle="#fff2c4"; c.fillText(`불사 ${remaining.toFixed(1)}초`,p.x,p.y-68); c.restore();
    }
    const osiaHero = battle.heroes.find(h => h.id === "osia" && h.hp > 0);
    if (osiaHero && battle.phase === "fight") {
      const current = battle.osiaCast, next = S.osiaSkill(state), stage = current?.stage || next.stage;
      const label = current ? `스킬 ${stage}/4 · ${S.OSIA_SKILLS[stage-1].name} 시전 중` : `다음 ${stage}/4 · ${next.name} · 충전 ${Math.max(0, S.BY_ID.osia.cooldown-osiaHero.energy)}초`;
      c.save(); c.font="9px Galmuri, monospace"; c.textAlign="left"; const width=c.measureText(label).width+59;
      rect(c,"#153c55ed",480-width-8,257,width,18);
      for(let i=1;i<=4;i++)rect(c,i===stage?"#c5ffff":"#4e7288",480-width-2+(i-1)*10,263,7,6);
      c.fillStyle="#dbffff"; c.fillText(label,480-width+43,270); c.restore();
    }
    const lavaHero = battle.heroes.find(h => h.id === "lava" && h.hp > 0);
    if (lavaHero && battle.phase === "fight" && S.lavaSkill) {
      const next = S.lavaSkill(state), count = state.units.lava.basicHits || 0, y = osiaHero ? 237 : 257;
      const label = `라바 · 다음 ${next.stage}/2 · ${next.name} · ${Math.max(0, S.BY_ID.lava.cooldown - lavaHero.energy)}초`;
      c.save(); c.font = "8px Galmuri, monospace"; c.textAlign = "left"; const width = c.measureText(label).width + 13;
      rect(c, "#35554bed", 8, y, width, 18); c.fillStyle = "#e9f4c9"; c.fillText(label, 14, y + 11);
      for (let i = 0; i < 10; i++) rect(c, i < count ? "#d1eaa7" : "#6d8a70", 14 + i * (width - 18) / 10, y + 14, (width - 28) / 10, 1);
      c.restore();
    }
    if (battle.phase !== "fight") {
      rect(c, "#243a3277", 0, 0, 480, 280); c.textAlign = "center"; c.font = "18px Galmuri, monospace"; c.fillStyle = "#fff1c8";
      const activity = battle.activity;
      c.fillText(activity ? battle.phase === "victory" ? activity.kind === "tower" ? `${activity.floor}층 돌파!` : "던전 클리어!" : "도전 종료" : battle.phase === "victory" ? (battle.boss ? "지역 클리어!" : "WAVE CLEAR") : "다시 준비하는 시간", 240, 112);
      c.font = "10px Galmuri, monospace"; c.fillText(activity ? "결과에서 다음 행동을 선택하세요." : battle.phase === "victory" ? `다음 전투까지 ${Math.ceil(battle.wait)}초` : `${Math.ceil(battle.wait)}초 뒤 자동 재도전`, 240, 135); c.textAlign = "left";
    }
    osiaCinematic(c, state, time, effects, reduced);
    c.restore();
  }
  return { hero, portrait, draw, ready, poseForSkill:castingMotion, assetsReady: (id = 'osia') => id === 'lava' ? lavaLoaded : osiaLoaded };
})();
