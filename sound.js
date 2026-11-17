/* Original procedural effects: no recordings, downloads, or audio assets. */
(function (root) {
  "use strict";
  const CUES = Object.freeze([
    "cast", "field", "spell", "shuffle", "shield-ready", "flight", "phone", "ball",
    "counter", "hit", "heavy", "cost", "block", "heal", "cleanse", "curse", "miss",
    "roulette", "rare", "danger", "win", "loss", "draw", "eliminated",
  ]);
  const noiseBuffers = new WeakMap();
  function noiseBuffer(ctx) {
    if (!noiseBuffers.has(ctx)) {
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .7), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let seed = 0x61c83a;
      for (let i = 0; i < data.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        data[i] = (seed / 4294967296) * 2 - 1;
      }
      noiseBuffers.set(ctx, buffer);
    }
    return noiseBuffers.get(ctx);
  }
  // Also accepts OfflineAudioContext, so the actual waveform can be verified.
  function renderCue(ctx, destination, cue, onEnded = () => {}) {
    const start = ctx.currentTime + .008, voices = [];
    let lastEnd = start;
    function voice(source, at, duration, level, filter) {
      const gain = ctx.createGain(), end = at + duration;
      gain.gain.setValueAtTime(.0001, at);
      gain.gain.exponentialRampToValueAtTime(level, at + Math.min(.009, duration / 4));
      gain.gain.exponentialRampToValueAtTime(.0001, end);
      source.connect(filter || gain);
      if (filter) filter.connect(gain);
      gain.connect(destination);
      const entry = { source, gain, filter };
      voices.push(entry);
      source.onended = () => {
        source.disconnect(); gain.disconnect(); filter?.disconnect();
        entry.ended = true;
        if (voices.every((v) => v.ended)) onEnded();
      };
      source.start(at); source.stop(end + .015);
      lastEnd = Math.max(lastEnd, end + .015);
    }
    function tone(freq, offset = 0, duration = .16, level = .17, type = "sine", to = freq) {
      const osc = ctx.createOscillator(), at = start + offset;
      osc.type = type;
      osc.frequency.setValueAtTime(freq, at);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + duration);
      voice(osc, at, duration, level);
    }
    function noise(offset = 0, duration = .13, level = .2, frequency = 1100, type = "lowpass") {
      const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter();
      source.buffer = noiseBuffer(ctx);
      filter.type = type; filter.frequency.value = frequency; filter.Q.value = .6;
      voice(source, start + offset, duration, level, filter);
    }
    function notes(frequencies, gap = .075, duration = .21, level = .14) {
      frequencies.forEach((frequency, i) => tone(frequency, i * gap, duration, level, "triangle"));
    }
    switch (cue) {
      case "cast": noise(0, .11, .15, 1700, "bandpass"); tone(330, 0, .12, .07, "sine", 500); break;
      case "field": tone(110, 0, .42, .18, "triangle", 165); notes([330, 440, 660], .08, .3, .09); break;
      case "spell": notes([440, 587, 880], .045, .18, .11); noise(0, .2, .07, 2800, "highpass"); break;
      case "shuffle": [0, .07, .14].forEach((t) => noise(t, .055, .23, 1900, "bandpass")); break;
      case "shield-ready": tone(440, 0, .16, .1, "triangle"); tone(660, .055, .17, .09); break;
      case "flight": noise(0, .22, .22, 1300, "bandpass"); tone(250, 0, .2, .07, "sine", 90); break;
      case "phone": tone(800, 0, .26, .12, "triangle", 190); tone(1050, .065, .16, .07, "sine", 320); noise(0, .2, .13, 2500, "bandpass"); break;
      case "ball": noise(0, .2, .25, 1700, "bandpass"); tone(460, 0, .18, .08, "sine", 210); break;
      case "counter": notes([880, 660, 990], .045, .16, .12); noise(.06, .14, .1, 1700, "bandpass"); break;
      case "hit": tone(150, 0, .19, .35, "triangle", 48); noise(0, .14, .3, 950); break;
      case "heavy": tone(110, 0, .31, .4, "triangle", 34); noise(0, .2, .38, 1300); tone(260, 0, .075, .12, "sine", 60); break;
      case "cost": tone(190, 0, .13, .12, "sine", 110); break;
      case "block": tone(960, 0, .25, .17); tone(1450, .015, .15, .07); noise(0, .065, .18, 2900, "highpass"); break;
      case "heal": notes([392, 523.25, 659.25], .09, .3, .16); tone(1046.5, .18, .3, .045); break;
      case "cleanse": notes([523.25, 659.25, 783.99, 1046.5], .055, .25, .12); break;
      case "curse": tone(390, 0, .3, .14, "triangle", 140); tone(415, .02, .27, .08, "sine", 147); break;
      case "miss": noise(0, .19, .12, 1300, "bandpass"); tone(340, 0, .15, .07, "sine", 170); break;
      case "roulette": [550, 620, 690, 760, 850].forEach((f, i) => tone(f, i * .05, .055, .09, "triangle")); break;
      case "rare": notes([523.25, 659.25, 783.99, 1046.5], .065, .27, .13); tone(1568, .2, .2, .035); break;
      case "danger": tone(72, 0, .16, .25, "sine", 46); tone(72, .23, .19, .2, "sine", 42); break;
      case "win":
        notes([392, 523.25, 659.25, 783.99, 1046.5], .14, .28, .17);
        [523.25, 659.25, 783.99].forEach((f) => tone(f, .78, .55, .1, "triangle")); break;
      case "loss": notes([392, 329.63, 261.63, 196], .19, .33, .15); tone(98, .55, .45, .11); break;
      case "draw": notes([392, 440, 392, 330], .15, .3, .13); break;
      case "eliminated": tone(260, 0, .36, .17, "triangle", 98); tone(130, .25, .35, .11, "sine", 65); break;
      default: return null;
    }
    return {
      cue, endTime: lastEnd,
      stop() {
        for (const v of voices) {
          try { v.source.stop(); } catch {}
          v.source.disconnect(); v.gain.disconnect(); v.filter?.disconnect();
        }
      },
    };
  }

  const key = "card-sound-v1", AudioContext = root.AudioContext || root.webkitAudioContext;
  let prefs = { enabled: true, volume: .4 };
  try {
    const saved = JSON.parse(root.localStorage.getItem(key) || "null");
    if (saved && typeof saved.enabled === "boolean") prefs.enabled = saved.enabled;
    if (saved && Number.isFinite(saved.volume)) prefs.volume = Math.max(0, Math.min(1, saved.volume));
  } catch {}
  let context, master, supported = !!AudioContext, generation = 0, lastSeq = 0;
  let terminal = false, quietUntil = 0, previousDanger = "normal";
  const playing = new Set(), cooldowns = new Map();
  const settings = () => ({ ...prefs, supported, ready: context?.state === "running" });
  const announce = () => root.dispatchEvent(new CustomEvent("duel-sound-change", { detail: settings() }));
  function stop() {
    generation++;
    for (const cue of playing) cue.stop();
    playing.clear(); cooldowns.clear();
  }
  function updateGain() {
    if (!master) return;
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setTargetAtTime(prefs.enabled ? prefs.volume * .7 : 0, context.currentTime, .015);
  }
  async function unlock() {
    if (!supported || !prefs.enabled || prefs.volume === 0 || document.hidden) return false;
    try {
      if (!context) {
        context = new AudioContext();
        master = context.createGain();
        master.gain.value = prefs.enabled ? prefs.volume * .7 : 0;
        const compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -12; compressor.knee.value = 12; compressor.ratio.value = 4;
        compressor.attack.value = .005; compressor.release.value = .15;
        master.connect(compressor); compressor.connect(context.destination);
        context.onstatechange = announce;
      }
      if (context.state !== "running") await context.resume();
      announce();
      return context.state === "running";
    } catch {
      if (!context) supported = false;
      announce();
      return false;
    }
  }
  function configure(changes) {
    if (typeof changes.enabled === "boolean") prefs.enabled = changes.enabled;
    if (Number.isFinite(changes.volume)) prefs.volume = Math.max(0, Math.min(1, changes.volume));
    if (!prefs.enabled || prefs.volume === 0) stop();
    updateGain();
    try { root.localStorage.setItem(key, JSON.stringify(prefs)); } catch {}
    announce();
    return settings();
  }
  function audible() {
    return !!(prefs.enabled && prefs.volume > 0 && context?.state === "running" && !document.hidden);
  }
  function capture() {
    return { generation, time: performance.now(), allowed: audible() };
  }
  function play(cue, token = capture(), force = false) {
    if (!CUES.includes(cue) || !token.allowed || token.generation !== generation || performance.now() - token.time > 5000 || !audible()) return false;
    if (!force && (terminal || context.currentTime < quietUntil)) return false;
    const time = context.currentTime;
    if (!force && time - (cooldowns.get(cue) ?? -Infinity) < .085) return false;
    cooldowns.set(cue, time);
    while (playing.size >= 6) {
      const oldest = playing.values().next().value;
      oldest.stop(); playing.delete(oldest);
    }
    try {
      const voice = renderCue(context, master, cue, () => playing.delete(voice));
      if (!voice) return false;
      playing.add(voice);
      // Public cue name only: useful for UI/diagnostics, no game or hand data.
      root.dispatchEvent(new CustomEvent("duel-sound-play", { detail: { cue } }));
      return true;
    } catch { return false; }
  }
  function event(e, token) {
    // A delayed callback from an earlier match must not advance this match's sequence.
    if (token && token.generation !== generation) return false;
    if (!Number.isInteger(e.seq) || e.seq <= lastSeq) return false;
    lastSeq = e.seq;
    let cue;
    if (e.kind === "card") {
      if ([18, 24].includes(e.card)) cue = "rare";
      else if ([1, 4].includes(e.card)) cue = "field";
      else if ([5, 6, 19].includes(e.card)) cue = "shuffle";
      else if ([2, 10, 13, 23, 26, 27, 29, 30].includes(e.card)) cue = "shield-ready";
      else if ([12, 16, 17, 20, 22, 32, 34, 40].includes(e.card)) cue = "spell";
      else cue = "cast";
    } else if (e.kind === "attack") cue = e.reaction ? "counter" : e.card === 33 ? "phone" : e.card === 38 ? "ball" : "flight";
    else if (e.kind === "damage" && e.amount > 0 && !e.forfeit) cue = e.cost ? "cost" : e.amount >= 20 ? "heavy" : "hit";
    else if (e.kind === "block") cue = "block";
    else if (e.kind === "heal" && e.amount > 0) cue = "heal";
    else if (e.kind === "cleanse") cue = "cleanse";
    else if (e.kind === "status" && ["red", "noheal", "touch", "xerath", "skip", "curse"].includes(e.status)) cue = "curse";
    else if (e.kind === "miss") cue = "miss";
    else if (e.kind === "roulette") cue = "roulette";
    else if (e.kind === "phone-roll" && e.amount >= 64) cue = "rare";
    return cue ? play(cue, token) : false;
  }
  function outcome(result, silent = false) {
    stop();
    terminal = result !== "eliminated";
    quietUntil = (context?.currentTime || 0) + 1.4;
    if (!silent) play(result, capture(), true);
  }
  function danger(level, silent = false) {
    const entered = level !== previousDanger;
    previousDanger = level;
    if (entered && level === "last" && !silent) play("danger");
  }
  function reset() {
    stop(); lastSeq = 0; terminal = false; quietUntil = 0; previousDanger = "normal";
  }
  async function preview() {
    const token = generation;
    if (!await unlock() || generation !== token) return false;
    return play("heal", capture(), true);
  }
  // Resume is attempted directly inside the trusted gesture, never by a timer.
  root.addEventListener("pointerdown", () => void unlock(), { capture: true, passive: true });
  root.addEventListener("keydown", () => void unlock(), { capture: true });
  document.addEventListener("visibilitychange", () => {
    stop();
    if (!context) return;
    if (document.hidden) void context.suspend().catch(() => {});
    else if (prefs.enabled && prefs.volume > 0) void unlock();
  });
  root.DuelSound = Object.freeze({ cues: CUES, renderCue, settings, configure, unlock, capture, event, outcome, danger, reset, stop, preview });
})(globalThis);
