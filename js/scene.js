/* ============================================================
   Hero WebGL scene — domain-warped fbm "aurora" on a fullscreen
   quad. Deliberately dark & atmospheric so type stays readable.
   Mouse-reactive, scroll-aware, DPR-capped, pauses off-screen.
   ============================================================ */
(function () {
  "use strict";

  var canvas = document.getElementById("webgl");
  if (!canvas || !window.THREE) return;

  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isCoarse = window.matchMedia("(pointer: coarse)").matches;
  var hero = canvas.parentElement;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
  } catch (e) {
    canvas.style.display = "none";
    return;
  }

  var DPR = Math.min(window.devicePixelRatio || 1, isCoarse ? 1.1 : 1.5);
  renderer.setPixelRatio(DPR);

  var scene = new THREE.Scene();
  var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  var uniforms = {
    u_time: { value: 0 },
    u_res: { value: new THREE.Vector2(1, 1) },
    u_mouse: { value: new THREE.Vector2(0, 0) },
    u_scroll: { value: 0 },
  };

  var material = new THREE.ShaderMaterial({
    uniforms: uniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: [
      "void main() {",
      "  gl_Position = vec4(position, 1.0);",
      "}",
    ].join("\n"),
    fragmentShader: [
      "precision highp float;",
      "uniform float u_time;",
      "uniform vec2  u_res;",
      "uniform vec2  u_mouse;",
      "uniform float u_scroll;",
      "",
      "float hash(vec2 p) {",
      "  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);",
      "}",
      "",
      "float noise(vec2 p) {",
      "  vec2 i = floor(p);",
      "  vec2 f = fract(p);",
      "  vec2 u = f * f * (3.0 - 2.0 * f);",
      "  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),",
      "             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);",
      "}",
      "",
      "float fbm(vec2 p) {",
      "  float v = 0.0;",
      "  float a = 0.5;",
      "  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);",
      "  for (int i = 0; i < 3; i++) {",
      "    v += a * noise(p);",
      "    p = rot * p * 2.0 + vec2(7.3, 2.1);",
      "    a *= 0.5;",
      "  }",
      "  return v;",
      "}",
      "",
      "void main() {",
      "  vec2 uv = gl_FragCoord.xy / u_res;",
      "  vec2 p = uv;",
      "  p.x *= u_res.x / u_res.y;",
      "",
      "  float t = u_time * 0.055;",
      "  p += u_mouse * 0.16;",
      "  p.y += u_scroll * 0.45;",
      "",
      "  vec2 q = vec2(fbm(p * 1.1 + vec2(0.0, t)),",
      "                fbm(p * 1.1 + vec2(5.2, 1.3) - t * 0.7));",
      "  vec2 r = vec2(fbm(p * 1.1 + 3.2 * q + vec2(1.7, 9.2) + t * 0.4),",
      "                fbm(p * 1.1 + 3.2 * q + vec2(8.3, 2.8) - t * 0.3));",
      "  float v = fbm(p * 1.1 + 3.0 * r);",
      "",
      "  vec3 base    = vec3(0.043, 0.043, 0.051);",   // #0b0b0d
      "  vec3 deep    = vec3(0.078, 0.075, 0.137);",   // midnight indigo
      "  vec3 violet  = vec3(0.165, 0.145, 0.290);",   // dusk violet
      "  vec3 lime    = vec3(0.824, 1.000, 0.231);",   // #d2ff3b
      "",
      "  vec3 col = base;",
      "  col = mix(col, deep,   smoothstep(0.25, 0.85, v));",
      "  col = mix(col, violet, smoothstep(0.55, 1.0, v) * 0.8);",
      "",
      "  // electric ridge — thin lime filaments where the field folds",
      "  float ridge = smoothstep(0.46, 0.5, v) * smoothstep(0.56, 0.5, v);",
      "  col += lime * ridge * 0.30;",
      "",
      "  // soft glow following the cursor",
      "  vec2 m = (u_mouse * 0.5 + 0.5);",
      "  m.x *= u_res.x / u_res.y;",
      "  float md = distance(p - u_mouse * 0.16 - vec2(0.0, u_scroll * 0.45), m);",
      "  col += lime * 0.05 * smoothstep(0.75, 0.0, md) * (0.6 + 0.4 * q.x);",
      "",
      "  // vignette",
      "  float vig = smoothstep(1.25, 0.35, distance(uv, vec2(0.5, 0.45)));",
      "  col *= mix(0.55, 1.0, vig);",
      "",
      "  // dither to kill banding",
      "  col += (hash(gl_FragCoord.xy) - 0.5) * 0.012;",
      "",
      "  gl_FragColor = vec4(col, 1.0);",
      "}",
    ].join("\n"),
  });

  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

  /* ---------- sizing ---------- */
  function resize() {
    var w = hero.clientWidth;
    var h = hero.clientHeight;
    renderer.setSize(w, h, false);
    uniforms.u_res.value.set(w * DPR, h * DPR);
  }
  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("perf-lite", function () {
    DPR = 1;
    renderer.setPixelRatio(1);
    resize();
  });

  /* ---------- mouse (lerped for weight) ---------- */
  var targetMouse = { x: 0, y: 0 };
  var smoothMouse = { x: 0, y: 0 };
  if (!isCoarse && !prefersReduced) {
    window.addEventListener("mousemove", function (e) {
      targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      targetMouse.y = -((e.clientY / window.innerHeight) * 2 - 1);
    }, { passive: true });
  }

  /* ---------- render loop ---------- */
  var visible = true;   // hero in viewport (main.js can toggle)
  var running = false;
  var start = performance.now();

  function frame(now) {
    running = visible && !document.hidden;
    if (!running) return;
    requestAnimationFrame(frame);

    smoothMouse.x += (targetMouse.x - smoothMouse.x) * 0.045;
    smoothMouse.y += (targetMouse.y - smoothMouse.y) * 0.045;
    uniforms.u_mouse.value.set(smoothMouse.x, smoothMouse.y);
    uniforms.u_time.value = (now - start) / 1000;

    renderer.render(scene, camera);
  }

  function play() {
    if (running || prefersReduced) return;
    running = true;
    requestAnimationFrame(frame);
  }

  if (prefersReduced) {
    // single static frame — still beautiful, zero motion
    uniforms.u_time.value = 26.0;
    renderer.render(scene, camera);
  } else {
    play();
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) play();
    });
  }

  canvas.addEventListener("webglcontextlost", function (e) {
    e.preventDefault();
    canvas.style.display = "none";
  });

  /* hooks for main.js */
  window.__HERO_SCENE__ = {
    setVisible: function (v) {
      visible = v;
      if (v) play();
    },
    setScroll: function (p) {
      uniforms.u_scroll.value = p;
    },
  };
})();
