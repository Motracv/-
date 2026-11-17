"use strict";
window.SchoolArt = (() => {
  const portraits = new Map(), S = SchoolRPG;
  const osiaImage = new Image();
  let osiaLoaded = false;
  const ready = new Promise(resolve => {
    const timer = setTimeout(() => resolve(false), 5000);
    osiaImage.onload = () => { osiaLoaded = true; clearTimeout(timer); portraits.delete("osia"); resolve(true); window.dispatchEvent(new Event("school-art-ready")); };
    osiaImage.onerror = () => { clearTimeout(timer); resolve(false); };
  });
  osiaImage.src = "school/assets/osia-sprites.png?v=osia1";
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
  function osia(c, x, y, scale, frame) {
    c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(scale, scale);
    if (frame.dead) { c.globalAlpha = .4; c.rotate(-Math.PI / 2); }
    if (frame.hit) c.filter = "brightness(1.8)";
    rect(c, "#26333b35", -8, 1, 17, 2);
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
  function hero(c, id, x, y, scale = 2, frame = {}) {
    if (id === "osia") { osia(c, x, y, scale, frame); return; }
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
      const c = canvas.getContext("2d"); c.imageSmoothingEnabled = false; c.scale(2, 2); hero(c, id, 36, 86, 2); portraits.set(id, canvas.toDataURL()); }
    return portraits.get(id);
  }
  function monster(c, enemy, x, y, frame = {}) {
    c.save(); c.translate(Math.round(x), Math.round(y)); const z = enemy.boss ? 2.7 : 1.7; c.scale(z, z);
    if (enemy.hp <= 0) c.globalAlpha = .25;
    if (frame.hit) c.filter = "brightness(2)";
    const palettes = [["#477d68", "#9dc497"], ["#6c627e", "#b9a6c7"], ["#796247", "#d1ba85"], ["#4d7651", "#91af64"], ["#666b79", "#a1a4ab"], ["#5c5379", "#ba9dd6"]];
    const [edge, body] = palettes[enemy.kind]; rect(c, "#20302b35", -13, 0, 27, 3);
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
    if (enemy.boss) { rect(c, "#86663c", -12, -32, 26, 6); rect(c, "#ebc86e", -10, -33, 22, 5); for (const px of [-10, 0, 9]) rect(c, "#ebc86e", px, -38, 3, 8); rect(c, "#f7e3a0", 0, -32, 3, 3); }
    c.restore();
  }
  function background(c, stage, time) {
    const zone = S.chapter(stage), outdoor = zone === 3 || zone === 5;
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
  function waterEffects(c, effects, positions, time, reduced, pending) {
    for (const e of effects) {
      if (e.from !== "osia") continue;
      const age = pending && pending.id === e.castId ? Math.min(time - e.time, e.impactDelay / 1000 - .001) : time - e.time;
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
  function draw(c, state, time, effects = [], reduced = false) {
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, c.canvas.width, c.canvas.height);
    c.setTransform(c.canvas.width / 480, 0, 0, c.canvas.height / 280, 0, 0); c.imageSmoothingEnabled = false;
    const battle = state.battle; background(c, battle.stage, reduced ? 0 : time);
    effects = effects.filter(e => (!e.battleId || e.battleId === battle.id) && time >= e.time);
    effects = effects.filter(e => e.kind !== "skill-stage" || battle.osiaCast?.id === e.castId || effects.some(hit => hit.kind === "skill-impact" && hit.castId === e.castId));
    const positions = {};
    battle.heroes.forEach((h, i) => { positions[h.id] = [{ x: 173, y: 208 }, { x: 115, y: 181 }, { x: 68, y: 221 }][i]; });
    battle.enemies.forEach((e, i) => { positions[e.id] = battle.boss ? { x: 375, y: 210 } : [{ x: 325, y: 207 }, { x: 384, y: 180 }, { x: 425, y: 225 }][i]; });
    const items = battle.heroes.map(h => ({ ...h, side: "hero" })).concat(battle.enemies.map(e => ({ ...e, side: "enemy" }))).sort((a, b) => positions[a.id].y - positions[b.id].y);
    for (const item of items) {
      const p = positions[item.id], hit = effects.some(e => e.to === item.id && e.kind === "hit" && time - e.time < .15), attacking = effects.some(e => e.from === item.id && e.kind === "hit" && time - e.time < .25);
      const stunned = item.hp > 0 && (item.stunUntil || 0) > battle.elapsed;
      const bounce = reduced || item.hp <= 0 || stunned ? 0 : Math.round(Math.sin(time * 4 + p.x) * 1.5);
      const nudge = attacking && !reduced && !stunned ? (item.side === "hero" ? 8 : -6) : 0;
      const combo = item.id === "osia" && effects.findLast(e => e.kind === "skill-stage" && time - e.time < (e.stage === 4 ? 1.1 : .6));
      if (item.side === "hero") hero(c, item.id, p.x + nudge, p.y + bounce, 1.8, { hit, dead: item.hp <= 0, attack: attacking, pose: combo ? (time - combo.time < combo.impactDelay / 1000 ? 1 : 2) : undefined, ready: item.energy >= S.BY_ID[item.id].cooldown - 1, casting: effects.some(e => e.kind === "skill" && e.from === item.id && time - e.time < .8), blink: Math.sin(time * .7 + p.x) > .99 });
      else monster(c, item, p.x + nudge, p.y + bounce, { hit });
      const w = item.boss ? 62 : 37, by = p.y + 9;
      rect(c, "#28362f", p.x - w / 2 - 1, by - 1, w + 2, 6); rect(c, "#4d5146", p.x - w / 2, by, w, 4);
      rect(c, item.side === "hero" ? "#9dbd7b" : "#d99c73", p.x - w / 2, by, Math.max(0, w * item.hp / item.max), 4);
      if (item.side === "hero") { rect(c, "#536270", p.x - w / 2, by + 7, w, 2); rect(c, "#e2c679", p.x - w / 2, by + 7, w * item.energy / S.BY_ID[item.id].cooldown, 2); }
    }
    waterEffects(c, effects, positions, time, reduced, battle.osiaCast);
    for (const e of effects) {
      const age = time - e.time; if (age > 1.1 || age < 0) continue;
      const p = positions[e.to] || positions[e.from]; if (!p) continue;
      c.save(); c.globalAlpha = Math.min(1, (1.1 - age) * 2);
      const y = p.y - 65 - age * 22;
      if (e.kind === "hit" || e.kind === "heal" || e.kind === "shield") {
        const text = e.kind === "heal" ? `+${e.amount}` : e.kind === "shield" ? "방어" : `${e.amount}`;
        c.font = `${e.skill ? 14 : 11}px Galmuri, monospace`; c.textAlign = "center";
        c.fillStyle = "#26342e"; c.fillText(text, p.x + 1, y + 1); c.fillStyle = e.kind === "heal" ? "#dbffac" : e.kind === "shield" ? "#bbdded" : e.skill ? "#ffe5a1" : "#fff6dd"; c.fillText(text, p.x, y);
      }
      if (e.kind === "skill" && e.from !== "osia") { c.font = "9px Galmuri, monospace"; c.textAlign = "center"; const width = c.measureText(e.name).width + 14; rect(c, "#2b3d37dc", p.x - width / 2, p.y - 89 - age * 9, width, 16); c.fillStyle = "#f6df9b"; c.fillText(e.name, p.x, p.y - 77 - age * 9); }
      if (e.kind === "hit" && e.skill && age < .3) { c.strokeStyle = e.element === "water" ? "#bafaff" : "#fff3bb"; c.lineWidth = 3; c.beginPath(); c.moveTo(p.x - 18, p.y - 60); c.lineTo(p.x + 17, p.y - 19); c.stroke(); }
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
    const osiaHero = battle.heroes.find(h => h.id === "osia" && h.hp > 0);
    if (osiaHero && battle.phase === "fight") {
      const current = battle.osiaCast, next = S.osiaSkill(state), stage = current?.stage || next.stage;
      const label = current ? `스킬 ${stage}/4 · ${S.OSIA_SKILLS[stage-1].name} 시전 중` : `다음 ${stage}/4 · ${next.name} · 충전 ${Math.max(0, S.BY_ID.osia.cooldown-osiaHero.energy)}초`;
      c.save(); c.font="9px Galmuri, monospace"; c.textAlign="left"; const width=c.measureText(label).width+59;
      rect(c,"#153c55ed",480-width-8,257,width,18);
      for(let i=1;i<=4;i++)rect(c,i===stage?"#c5ffff":"#4e7288",480-width-2+(i-1)*10,263,7,6);
      c.fillStyle="#dbffff"; c.fillText(label,480-width+43,270); c.restore();
    }
    if (battle.phase !== "fight") {
      rect(c, "#243a3277", 0, 0, 480, 280); c.textAlign = "center"; c.font = "18px Galmuri, monospace"; c.fillStyle = "#fff1c8";
      c.fillText(battle.phase === "victory" ? (battle.boss ? "지역 클리어!" : "WAVE CLEAR") : "다시 준비하는 시간", 240, 112);
      c.font = "10px Galmuri, monospace"; c.fillText(battle.phase === "victory" ? `다음 전투까지 ${Math.ceil(battle.wait)}초` : `${Math.ceil(battle.wait)}초 뒤 자동 재도전`, 240, 135); c.textAlign = "left";
    }
    c.restore();
  }
  return { hero, portrait, draw, ready, assetsReady: () => osiaLoaded };
})();
