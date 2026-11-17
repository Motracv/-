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
  function osia(c, x, y, scale, frame) {
    c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(scale, scale);
    if (frame.dead) { c.globalAlpha = .4; c.rotate(-Math.PI / 2); }
    if (frame.hit) c.filter = "brightness(1.8)";
    rect(c, "#26333b35", -8, 1, 17, 2);
    if (osiaLoaded) {
      const tile = osiaImage.naturalWidth / 3, pose = frame.attack || frame.casting ? 2 : frame.ready ? 1 : 0;
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
    rect(c, dark, -7, -31, 14, 15); rect(c, skin, -6, -29, 12, 11); rect(c, "#d9a47e", -5, -20, 10, 3);
    rect(c, h.hair, -7, -32, 14, 6); rect(c, h.hair, -7, -28, 3, 7); rect(c, h.hair, 4, -28, 3, 4);
    rect(c, h.hair, -5, -34, 10, 3); rect(c, h.hair, -1, -29, 3, 4);
    if (id === "harin" || id === "seoyun") { rect(c, h.hair, -10, -30, 5, 13); rect(c, h.color, -9, -28, 4, 3); }
    if (id === "nari") { rect(c, h.hair, -10, -27, 4, 13); rect(c, h.hair, 7, -27, 4, 13); rect(c, "#e9c883", -10, -18, 4, 2); }
    if (id === "yuna") { rect(c, h.color, -10, -32, 4, 4); rect(c, "#efdab1", -6, -31, 3, 2); }
    if (id === "sua") { rect(c, "#f4edda", -8, -33, 16, 5); rect(c, "#c87b86", -1, -34, 3, 6); rect(c, "#c87b86", -3, -32, 7, 2); }
    if (id === "minjae") { rect(c, dark, -6, -26, 5, 4); rect(c, dark, 2, -26, 5, 4); rect(c, "#9ed9d7", -5, -25, 3, 2); rect(c, "#9ed9d7", 3, -25, 3, 2); rect(c, dark, -1, -25, 3, 1); }
    else { rect(c, dark, -4, -25, 2, frame.blink ? 1 : 3); rect(c, dark, 3, -25, 2, frame.blink ? 1 : 3); rect(c, "#e4ac91", -5, -22, 2, 1); }
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
    c.restore();
  }
  function portrait(id) {
    if (!portraits.has(id)) { const canvas = document.createElement("canvas"); canvas.width = 80; canvas.height = 96;
      const c = canvas.getContext("2d"); c.imageSmoothingEnabled = false; hero(c, id, 36, 86, 2); portraits.set(id, canvas.toDataURL()); }
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
    rect(c, "#ffffff38", -6, -24, 5, 3); rect(c, "#292d3c", -6, -17, 4, 5); rect(c, "#292d3c", 4, -17, 4, 5);
    rect(c, "#fff7ce", -5, -17, 1, 2); rect(c, "#fff7ce", 5, -17, 1, 2); rect(c, edge, -1, -8, 4, 2);
    if (enemy.kind === 1 || enemy.kind === 5) { rect(c, body, -11, -4, 5, 5); rect(c, body, 0, -5, 5, 6); rect(c, body, 9, -4, 3, 5); }
    if (enemy.kind === 3) { rect(c, "#b99a5b", -17, -22, 6, 3); rect(c, "#b99a5b", 12, -23, 7, 3); rect(c, body, -18, -26, 5, 4); }
    if (enemy.kind === 4) { rect(c, edge, -18, -18, 7, 17); rect(c, edge, 12, -18, 7, 17); rect(c, "#b9d9d4", -5, -23, 12, 4); }
    if (enemy.boss) { rect(c, "#86663c", -12, -32, 26, 6); rect(c, "#ebc86e", -10, -33, 22, 5); for (const px of [-10, 0, 9]) rect(c, "#ebc86e", px, -38, 3, 8); rect(c, "#f7e3a0", 0, -32, 3, 3); }
    c.restore();
  }
  function background(c, stage, time) {
    const zone = S.chapter(stage), outdoor = zone === 3 || zone === 5;
    const wall = ["#d9c6a1", "#c5c6ab", "#bdab92", "#8cab83", "#b6b6a1", "#626e8d"][zone];
    rect(c, wall, 0, 0, 480, 280);
    if (outdoor) {
      const sky = zone === 5 ? ["#3d456b", "#61698e", "#9897ad"] : ["#9fc6bd", "#c3d5b4", "#e5dcaf"];
      for (let i = 0; i < 3; i++) rect(c, sky[i], 0, i * 47, 480, 48);
      if (zone === 5) { for (let i = 0; i < 24; i++) rect(c, "#e8dfb8", (i * 73 + 27) % 480, (i * 31 + 11) % 117, 2, 2); rect(c, "#e9dfbc", 360, 26, 29, 29); rect(c, sky[0], 353, 20, 24, 25); }
      else { rect(c, "#efe2a1", 390, 24, 31, 31); for (let i = 0; i < 4; i++) { const x = (i * 135 + time * 1.5) % 560 - 60; rect(c, "#e9e7c9", x, 26 + i * 20, 68, 11); rect(c, "#e9e7c9", x + 13, 17 + i * 20, 32, 12); } }
      for (let i = 0; i < 13; i++) { const x = i * 40; rect(c, zone === 5 ? "#48516b" : "#658978", x, 108 - (i % 3) * 15, 35, 50); }
      rect(c, zone === 5 ? "#555f75" : "#62775c", 0, 137, 480, 13); rect(c, "#b7b69b", 0, 136, 480, 4);
      for (let i = 0; i < 10; i++) rect(c, "#8a947d", i * 55, 116, 5, 26);
    } else {
      rect(c, "#6c6555", 0, 16, 480, 5); rect(c, "#a08f70", 0, 22, 480, 3);
      for (const wx of [24, 105]) {
        rect(c, "#716b58", wx - 3, 35, 72, 83); rect(c, "#e6ddb4", wx, 38, 66, 77);
        rect(c, zone === 2 ? "#94b0aa" : "#9dbfb1", wx + 3, 41, 60, 68);
        rect(c, "#b5cba9", wx + 3, 80, 60, 29); rect(c, "#e5d4a2", wx + 30, 38, 4, 77); rect(c, "#e5d4a2", wx, 71, 66, 4);
        rect(c, "#827359", wx - 6, 115, 78, 5);
      }
      if (zone === 2) {
        for (const sx of [207, 300, 390]) { rect(c, "#745e47", sx, 38, 73, 105); rect(c, "#554d3f", sx + 5, 43, 63, 90); for (let row = 0; row < 3; row++) { for (let j = 0; j < 8; j++) rect(c, ["#8d6d5d", "#909c7b", "#c7b17a", "#7e92a0"][(j + row) % 4], sx + 8 + j * 7, 48 + row * 28, 5, 21 - (j % 3) * 2); rect(c, "#8e7351", sx + 3, 71 + row * 28, 67, 4); } }
      } else {
        rect(c, "#6e614b", 207, 39, 182, 88); rect(c, "#3b6456", 213, 45, 170, 75); rect(c, "#b7bf97", 227, 57, 62, 2); rect(c, "#b7bf97", 227, 65, 105, 2); rect(c, "#b7bf97", 227, 73, 80, 2);
        c.fillStyle = "#d4d8b4"; c.font = "11px Galmuri, monospace"; c.fillText("방과 후 모험부", 227, 101);
        rect(c, "#9d8460", 202, 125, 193, 5); rect(c, "#c5bca0", 347, 122, 13, 3);
        rect(c, "#776a57", 419, 42, 34, 34); rect(c, "#ede2bf", 423, 46, 26, 26); rect(c, "#675d50", 435, 51, 2, 12); rect(c, "#675d50", 435, 60, 9, 2);
      }
      rect(c, "#a49b7c", 0, 137, 480, 13); rect(c, "#796c53", 0, 148, 480, 6);
    }
    const floor = outdoor ? (zone === 5 ? "#7e8490" : "#a5ae87") : "#b2946a";
    rect(c, floor, 0, 153, 480, 127);
    for (let y = 155; y < 280; y += 24) { rect(c, outdoor ? "#596b5b28" : "#705b4138", 0, y, 480, 2); for (let x = (y % 48 ? -20 : 20); x < 480; x += 80) rect(c, outdoor ? "#596b5b28" : "#705b4138", x, y, 2, 24); }
    rect(c, "#2b3d3420", 0, 260, 480, 20);
    if (!outdoor) { rect(c, "#806b4d", 13, 238, 32, 27); rect(c, "#d1b578", 9, 230, 41, 10); rect(c, "#68795d", 22, 218, 22, 11); rect(c, "#a2ab7e", 29, 208, 13, 15); rect(c, "#697c60", 14, 213, 16, 9); }
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
  function waterEffects(c, effects, positions, time, reduced) {
    for (const e of effects) {
      if (e.from !== "osia") continue;
      const age = time - e.time, source = positions.osia; if (!source || age < 0) continue;
      if (e.kind === "skill" && age < 1.5) {
        c.save(); c.globalAlpha = Math.min(1, (1.5 - age) * 2.5);
        if (reduced) {
          // Readable water-color impact without travel, shaking or flashing.
          for (const [id,p] of Object.entries(positions)) if (id.startsWith("e")) { rect(c,"#66d8ed99",p.x-22,p.y-18,44,8); rect(c,"#c4faff",p.x-15,p.y-21,30,3); }
        } else {
          const progress = Math.min(1, age / .65), x = source.x + 15 + (180 - source.x) * progress;
          for (let i = 0; i < 17; i++) { const wx = source.x + 12 + i * 17, wy = 214 + Math.sin(i * .8 - age * 10) * 9; if (wx > 469) break; rect(c,"#229dcd99",wx,wy,19,8); rect(c,"#a4f3fa",wx+2,wy-3,12,3); }
          c.drawImage(dragon, Math.round(x + age * 24), 35 + Math.round(Math.sin(age * 4) * 5), 218, 151);
          for (let i = 0; i < 12; i++) { const dx = source.x + 45 + i * 23 + age * 30, dy = 184 - Math.sin(age * 3 + i) * 25 - age * 20; if (dx < 476) { rect(c,"#77e2f2",dx,dy,4,7); rect(c,"#d5ffff",dx,dy,2,3); } }
          rect(c,"#62cee9",source.x-17,source.y+3,35,3); rect(c,"#beffff",source.x-10,source.y,22,2);
        }
        c.restore();
      }
      if (e.kind === "hit" && !e.skill && age < .5 && !reduced) {
        const target = positions[e.to]; if (!target) continue;
        const progress = Math.min(1, age / .32), x = source.x + 17 + (target.x - source.x - 17) * progress, y = source.y - 38 + (target.y - source.y - 5) * progress;
        rect(c,"#248fbf",x-5,y-5,11,9); rect(c,"#63d9f0",x-3,y-4,8,7); rect(c,"#daffff",x-2,y-3,3,2); rect(c,"#82e1ef",x-10,y-1,4,2);
      }
    }
  }
  function draw(c, state, time, effects = [], reduced = false) {
    c.imageSmoothingEnabled = false; c.clearRect(0, 0, 480, 280);
    const battle = state.battle; background(c, battle.stage, reduced ? 0 : time);
    const positions = {};
    battle.heroes.forEach((h, i) => { positions[h.id] = [{ x: 173, y: 208 }, { x: 115, y: 181 }, { x: 68, y: 221 }][i]; });
    battle.enemies.forEach((e, i) => { positions[e.id] = battle.boss ? { x: 375, y: 210 } : [{ x: 325, y: 207 }, { x: 384, y: 180 }, { x: 425, y: 225 }][i]; });
    const items = battle.heroes.map(h => ({ ...h, side: "hero" })).concat(battle.enemies.map(e => ({ ...e, side: "enemy" }))).sort((a, b) => positions[a.id].y - positions[b.id].y);
    for (const item of items) {
      const p = positions[item.id], hit = effects.some(e => e.to === item.id && e.kind === "hit" && time - e.time < .15), attacking = effects.some(e => e.from === item.id && e.kind === "hit" && time - e.time < .25);
      const bounce = reduced || item.hp <= 0 ? 0 : Math.round(Math.sin(time * 4 + p.x) * 1.5);
      const nudge = attacking && !reduced ? (item.side === "hero" ? 8 : -6) : 0;
      if (item.side === "hero") hero(c, item.id, p.x + nudge, p.y + bounce, 1.8, { hit, dead: item.hp <= 0, attack: attacking, ready: item.energy >= S.BY_ID[item.id].cooldown - 1, casting: effects.some(e => e.kind === "skill" && e.from === item.id && time - e.time < .8), blink: Math.sin(time * .7 + p.x) > .99 });
      else monster(c, item, p.x + nudge, p.y + bounce, { hit });
      const w = item.boss ? 62 : 37, by = p.y + 9;
      rect(c, "#28362f", p.x - w / 2 - 1, by - 1, w + 2, 6); rect(c, "#4d5146", p.x - w / 2, by, w, 4);
      rect(c, item.side === "hero" ? "#9dbd7b" : "#d99c73", p.x - w / 2, by, Math.max(0, w * item.hp / item.max), 4);
      if (item.side === "hero") { rect(c, "#536270", p.x - w / 2, by + 7, w, 2); rect(c, "#e2c679", p.x - w / 2, by + 7, w * item.energy / S.BY_ID[item.id].cooldown, 2); }
    }
    waterEffects(c, effects, positions, time, reduced);
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
      if (e.kind === "skill") { c.font = "9px Galmuri, monospace"; c.textAlign = "center"; const width = c.measureText(e.name).width + 14; rect(c, "#2b3d37dc", p.x - width / 2, p.y - 89 - age * 9, width, 16); c.fillStyle = "#f6df9b"; c.fillText(e.name, p.x, p.y - 77 - age * 9); }
      if (e.kind === "hit" && e.skill && age < .3) { c.strokeStyle = e.element === "water" ? "#bafaff" : "#fff3bb"; c.lineWidth = 3; c.beginPath(); c.moveTo(p.x - 18, p.y - 60); c.lineTo(p.x + 17, p.y - 19); c.stroke(); }
      c.restore();
    }
    if (battle.phase !== "fight") {
      rect(c, "#243a3277", 0, 0, 480, 280); c.textAlign = "center"; c.font = "18px Galmuri, monospace"; c.fillStyle = "#fff1c8";
      c.fillText(battle.phase === "victory" ? (battle.boss ? "지역 클리어!" : "WAVE CLEAR") : "다시 준비하는 시간", 240, 112);
      c.font = "10px Galmuri, monospace"; c.fillText(battle.phase === "victory" ? `다음 전투까지 ${battle.wait}초` : `${battle.wait}초 뒤 자동 재도전`, 240, 135); c.textAlign = "left";
    }
  }
  return { hero, portrait, draw, ready, assetsReady: () => osiaLoaded };
})();
