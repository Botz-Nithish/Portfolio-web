/* ============================================================
   Sound design: tiny synthesized UI sounds via Web Audio.
   No files, OFF by default, persisted preference, and the
   AudioContext only ever starts from a user gesture.
   ============================================================ */
(function () {
  "use strict";

  var ctx = null;
  var master = null;
  var enabled = false;
  var drone = null;

  function ensureCtx() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return true;
  }

  /* one enveloped oscillator */
  function blip(freq, endFreq, type, dur, vol, delay) {
    if (!enabled || !ensureCtx()) return;
    var t0 = ctx.currentTime + (delay || 0);
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  /* filtered noise sweep, for whooshes */
  function whoosh(fromHz, toHz, dur, vol) {
    if (!enabled || !ensureCtx()) return;
    var t0 = ctx.currentTime;
    var len = Math.ceil(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(fromHz, t0);
    bp.frequency.exponentialRampToValueAtTime(toHz, t0 + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  function startDrone() {
    if (drone || !enabled || !ensureCtx()) return;
    var g = ctx.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.012, ctx.currentTime + 2.5);
    var lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 190;
    var o1 = ctx.createOscillator();
    var o2 = ctx.createOscillator();
    o1.frequency.value = 55;
    o2.frequency.value = 110.7; /* slight detune for slow beating */
    o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(master);
    o1.start(); o2.start();
    drone = { g: g, o1: o1, o2: o2 };
  }

  function stopDrone() {
    if (!drone) return;
    var d = drone;
    drone = null;
    d.g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
    setTimeout(function () { d.o1.stop(); d.o2.stop(); }, 700);
  }

  var lastTick = 0;
  var api = {
    enabled: function () { return enabled; },
    setEnabled: function (v) {
      enabled = !!v;
      try { localStorage.setItem("msSound", enabled ? "1" : "0"); } catch (e) {}
      if (enabled) {
        if (ensureCtx()) {
          blip(660, 990, "sine", 0.12, 0.08);
          startDrone();
        }
      } else {
        stopDrone();
      }
      return enabled;
    },
    toggle: function () { return api.setEnabled(!enabled); },
    tick: function () {
      var now = performance.now();
      if (now - lastTick < 70) return; /* rate limit hover storms */
      lastTick = now;
      blip(1500 + Math.random() * 300, null, "sine", 0.035, 0.035);
    },
    snap: function () { blip(240, 180, "triangle", 0.07, 0.05); },
    open: function () {
      whoosh(220, 950, 0.4, 0.1);
      blip(90, 60, "sine", 0.18, 0.09, 0.02);
    },
    close: function () { whoosh(750, 240, 0.3, 0.07); },
  };

  /* restore preference; context still waits for the first gesture */
  var saved = null;
  try { saved = localStorage.getItem("msSound"); } catch (e) {}
  if (saved === "1") {
    enabled = true;
    var kick = function () {
      if (enabled && ensureCtx()) startDrone();
      window.removeEventListener("pointerdown", kick);
      window.removeEventListener("keydown", kick);
    };
    window.addEventListener("pointerdown", kick);
    window.addEventListener("keydown", kick);
  }

  window.__SOUND__ = api;
})();
