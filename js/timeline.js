/* ============================================================
   JOURNEY — scroll-driven 3D life timeline (vectrfl.com-style).
   A glowing lime "road" the camera flies along as you scroll;
   point-cloud stations ignite as the path reaches each life
   event, and a pinned dated list highlights the active one.
   Three.js r128 + GSAP ScrollTrigger + Lenis. Self-contained,
   reduced-motion + perf-lite aware, degrades to a static list.
   ============================================================ */
(function () {
  "use strict";

  var canvas = document.getElementById("journey-canvas");
  var section = document.querySelector(".journey");
  if (!canvas || !section) return;

  var stage = section.querySelector(".journey__stage");
  var bar = section.querySelector(".journey__bar i");
  var live = section.querySelector(".journey__live");
  var items = Array.prototype.slice.call(section.querySelectorAll(".jx"));
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isCoarse = window.matchMedia("(pointer: coarse)").matches;
  var finePointer = window.matchMedia("(pointer: fine)").matches &&
                    window.matchMedia("(hover: hover)").matches;

  /* ----------------------------------------------------------
     life events — drive both the 3D stations and the list.
     NOTE: "Consultancy" and the hackathon are placeholders —
     rename them to the real org once you confirm the names.
     ---------------------------------------------------------- */
  var N = items.length || 9;

  function showFallback(noScene) {
    section.classList.add("is-static");
    if (noScene) section.classList.add("is-noscene");
    items.forEach(function (el) { el.classList.add("is-active"); });
  }

  if (!window.THREE || !window.gsap || !window.ScrollTrigger) { showFallback(true); return; }
  if (window.gsap && window.ScrollTrigger) {
    try { gsap.registerPlugin(ScrollTrigger); } catch (e) {}
  }
  /* reduced motion: skip WebGL entirely — the static, fully-expanded list
     is content-complete and costs no GPU. */
  if (reduced) { showFallback(true); return; }

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas, antialias: true, alpha: true, powerPreference: "high-performance",
    });
  } catch (e) { showFallback(true); return; }
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.setClearColor(0x000000, 0); /* CSS radial shows through; additive glow on dark */

  /* ----------------------------------------------------------
     colours (match the portfolio: lime accent + cyan support)
     ---------------------------------------------------------- */
  var LIME = new THREE.Color(0xd2ff3b);
  var CYAN = new THREE.Color(0x5cc8ff);
  var WHITE = new THREE.Color(0xeffff0);

  /* ----------------------------------------------------------
     scene + camera
     ---------------------------------------------------------- */
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(58, 1, 0.1, 400);
  scene.add(camera);

  /* ----------------------------------------------------------
     the path — one waypoint per life event, weaving forward
     into -Z so scrolling feels like travelling through time.
     ---------------------------------------------------------- */
  var waypoints = [];
  for (var i = 0; i < N; i++) {
    waypoints.push(new THREE.Vector3(
      Math.sin(i * 1.15) * 7.6,
      Math.cos(i * 0.8) * 2.7 + Math.sin(i * 0.5) * 1.4,
      -i * 15
    ));
  }
  var curve = new THREE.CatmullRomCurve3(waypoints, false, "catmullrom", 0.5);
  /* station positions in arc-length space (u, 0..1) — getPointAt() works in
     arc-length, so sample densely and snap each waypoint to its closest u. */
  var stationT = [];
  (function () {
    var SAMP = 160;
    var pos = new THREE.Vector3();
    for (var w = 0; w < N; w++) {
      var best = Infinity, bestU = w / (N - 1);
      for (var k = 0; k <= SAMP; k++) {
        var u = k / SAMP;
        curve.getPointAt(u, pos);
        var dd = pos.distanceToSquared(waypoints[w]);
        if (dd < best) { best = dd; bestU = u; }
      }
      stationT[w] = bestU;
    }
  })();

  /* ----------------------------------------------------------
     glowing road — a tube revealed up to uProgress, with a
     bright comet "head". A wider, softer twin fakes the bloom.
     ---------------------------------------------------------- */
  var TUBE_SEG = 600;
  function roadMaterial(intensity, radiusGhost) {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uProgress: { value: 0 },
        uTime: { value: 0 },
        uIntensity: { value: intensity },
        uColA: { value: LIME.clone() },
        uColB: { value: WHITE.clone() },
        uGhost: { value: radiusGhost },
      },
      vertexShader: [
        "varying vec2 vUv;",
        "varying float vDepth;",
        "void main() {",
        "  vUv = uv;",
        "  vec4 mv = modelViewMatrix * vec4(position, 1.0);",
        "  vDepth = -mv.z;",
        "  gl_Position = projectionMatrix * mv;",
        "}",
      ].join("\n"),
      fragmentShader: [
        "precision highp float;",
        "uniform float uProgress; uniform float uTime; uniform float uIntensity;",
        "uniform float uGhost; uniform vec3 uColA; uniform vec3 uColB;",
        "varying vec2 vUv; varying float vDepth;",
        "void main() {",
        "  float t = vUv.x;",                    // 0..1 along the road
        "  float drawn = 1.0 - smoothstep(uProgress, uProgress + 0.01, t);",
        "  float ahead = uProgress - t;",        // >0 behind the head
        "  float head = (1.0 - smoothstep(0.0, 0.055, ahead)) * step(0.0, ahead);",
        "  float lanes = pow(abs(sin(vUv.y * 9.4248)), 5.0);",  // 3 filaments around the tube
        "  float around = 0.2 + 0.8 * lanes;",                  // multi-strand 'ribbon' read
        "  vec3 col = mix(uColA, uColB, clamp(head, 0.0, 1.0));",
        "  float a = drawn * 0.85 + (1.0 - drawn) * uGhost;",  // faint road ahead
        "  a += head * 0.7;",
        "  a *= (0.4 + 0.6 * around);",
        "  a *= smoothstep(160.0, 4.0, vDepth);",            // distance fade -> depth
        "  a *= uIntensity;",
        "  gl_FragColor = vec4(col * (1.0 + head * 1.6), a);",
        "}",
      ].join("\n"),
    });
  }

  var roadCoreGeo = new THREE.TubeGeometry(curve, TUBE_SEG, 0.05, 8, false);
  var roadHaloGeo = new THREE.TubeGeometry(curve, TUBE_SEG, 0.22, 8, false);
  var roadCoreMat = roadMaterial(1.0, 0.06);
  var roadHaloMat = roadMaterial(0.3, 0.04);
  var roadCore = new THREE.Mesh(roadCoreGeo, roadCoreMat);
  var roadHalo = new THREE.Mesh(roadHaloGeo, roadHaloMat);
  scene.add(roadHalo);
  scene.add(roadCore);

  /* ----------------------------------------------------------
     stations — a point cloud burst per event, ignites as the
     road head passes its arc-length position.
     ---------------------------------------------------------- */
  var PER_STATION = 70;
  var stPos = new Float32Array(N * PER_STATION * 3);
  var stStation = new Float32Array(N * PER_STATION);
  var stRand = new Float32Array(N * PER_STATION);
  (function () {
    var ptr = 0;
    for (var s = 0; s < N; s++) {
      var c = waypoints[s];
      for (var j = 0; j < PER_STATION; j++) {
        /* denser core, sparse halo: r biased small */
        var rr = Math.pow(Math.random(), 1.7) * 2.6;
        var th = Math.random() * Math.PI * 2;
        var ph = Math.acos(2 * Math.random() - 1);
        stPos[ptr * 3] = c.x + rr * Math.sin(ph) * Math.cos(th);
        stPos[ptr * 3 + 1] = c.y + rr * Math.sin(ph) * Math.sin(th) * 0.8;
        stPos[ptr * 3 + 2] = c.z + rr * Math.cos(ph);
        stStation[ptr] = stationT[s];
        stRand[ptr] = Math.random();
        ptr++;
      }
    }
  })();
  var stGeo = new THREE.BufferGeometry();
  stGeo.setAttribute("position", new THREE.BufferAttribute(stPos, 3));
  stGeo.setAttribute("aStation", new THREE.BufferAttribute(stStation, 1));
  stGeo.setAttribute("aRand", new THREE.BufferAttribute(stRand, 1));
  var stMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uProgress: { value: 0 }, uTime: { value: 0 },
      uSize: { value: 17.0 }, uDpr: { value: 1 },
      uCold: { value: CYAN.clone() }, uHot: { value: LIME.clone() },
    },
    vertexShader: [
      "attribute float aStation; attribute float aRand;",
      "uniform float uProgress; uniform float uTime; uniform float uSize; uniform float uDpr;",
      "varying float vIgnite; varying float vRand;",
      "void main() {",
      "  vRand = aRand;",
      "  float ig = smoothstep(aStation - 0.012, aStation + 0.03, uProgress);",
      "  vIgnite = ig;",
      "  vec4 mv = modelViewMatrix * vec4(position, 1.0);",
      "  float tw = 0.7 + 0.3 * sin(uTime * 2.2 + aRand * 6.2831);",
      "  float size = uSize * (0.3 + ig * 1.0) * tw * uDpr;",
      "  gl_PointSize = size * (1.0 / max(1.0, -mv.z) * 18.0);",
      "  gl_Position = projectionMatrix * mv;",
      "}",
    ].join("\n"),
    fragmentShader: [
      "precision highp float;",
      "uniform vec3 uCold; uniform vec3 uHot;",
      "varying float vIgnite; varying float vRand;",
      "void main() {",
      "  vec2 uv = gl_PointCoord - 0.5;",
      "  float d = length(uv);",
      "  float mask = smoothstep(0.5, 0.0, d);",
      "  vec3 col = mix(uCold, uHot, vIgnite);",
      "  float a = mask * (0.1 + vIgnite * 0.5);",
      "  gl_FragColor = vec4(col, a);",
      "}",
    ].join("\n"),
  });
  var stations = new THREE.Points(stGeo, stMat);
  scene.add(stations);

  /* ----------------------------------------------------------
     ambient dust — faint drifting field for depth + parallax
     ---------------------------------------------------------- */
  var DUST = isCoarse ? 900 : 1600;
  var duPos = new Float32Array(DUST * 3);
  var duRand = new Float32Array(DUST);
  for (var d = 0; d < DUST; d++) {
    duPos[d * 3] = (Math.random() - 0.5) * 60;
    duPos[d * 3 + 1] = (Math.random() - 0.5) * 34;
    duPos[d * 3 + 2] = -Math.random() * (N * 15 + 20) + 10;
    duRand[d] = Math.random();
  }
  var duGeo = new THREE.BufferGeometry();
  duGeo.setAttribute("position", new THREE.BufferAttribute(duPos, 3));
  duGeo.setAttribute("aRand", new THREE.BufferAttribute(duRand, 1));
  var duMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uDpr: { value: 1 }, uColor: { value: CYAN.clone() } },
    vertexShader: [
      "attribute float aRand;",
      "uniform float uTime; uniform float uDpr;",
      "varying float vTw;",
      "void main() {",
      "  vec3 p = position;",
      "  p.y += sin(uTime * 0.4 + aRand * 6.2831) * 0.6;",
      "  vTw = 0.4 + 0.6 * sin(uTime * 1.3 + aRand * 12.0);",
      "  vec4 mv = modelViewMatrix * vec4(p, 1.0);",
      "  gl_PointSize = (1.0 + aRand * 2.0) * uDpr * (1.0 / max(1.0, -mv.z) * 20.0);",
      "  gl_Position = projectionMatrix * mv;",
      "}",
    ].join("\n"),
    fragmentShader: [
      "precision highp float;",
      "uniform vec3 uColor; varying float vTw;",
      "void main() {",
      "  vec2 uv = gl_PointCoord - 0.5;",
      "  float mask = smoothstep(0.5, 0.0, length(uv));",
      "  gl_FragColor = vec4(uColor, mask * vTw * 0.22);",
      "}",
    ].join("\n"),
  });
  var dust = new THREE.Points(duGeo, duMat);
  scene.add(dust);

  /* ----------------------------------------------------------
     themed low-poly buildings — one recognisable structure per
     life event, built from primitives and rendered as glowing
     wireframe edges that ignite (cyan -> lime) as the road
     head reaches the station. Echoes vectr's low-poly scenery,
     but tells *your* story: hospital, school, trophy, cap...
     ---------------------------------------------------------- */
  /* positioned primitive -> BufferGeometry (local space) */
  function pBox(w, h, d, x, y, z, rx) {
    var g = new THREE.BoxGeometry(w, h, d);
    if (rx) g.rotateX(rx);
    g.translate(x, y, z); return g;
  }
  function pCyl(rt, rb, h, seg, x, y, z) {
    var g = new THREE.CylinderGeometry(rt, rb, h, seg);
    g.translate(x, y, z); return g;
  }
  function pCone(r, h, seg, x, y, z, ry) {
    var g = new THREE.ConeGeometry(r, h, seg);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z); return g;
  }
  /* merge each part's edges into ONE line geometry (1 draw call/building) */
  function mergeEdges(parts) {
    var chunks = [], total = 0, i;
    for (i = 0; i < parts.length; i++) {
      var e = new THREE.EdgesGeometry(parts[i]);
      var arr = e.attributes.position.array;
      chunks.push(arr); total += arr.length;
      e.dispose(); parts[i].dispose();
    }
    var merged = new Float32Array(total), off = 0;
    for (i = 0; i < chunks.length; i++) { merged.set(chunks[i], off); off += chunks[i].length; }
    var bg = new THREE.BufferGeometry();
    bg.setAttribute("position", new THREE.BufferAttribute(merged, 3));
    return bg;
  }

  var BUILDERS = [
    function hospital() {                       /* 2004 — born */
      return mergeEdges([
        pBox(3, 3, 2.4, 0, 1.5, 0),
        pBox(0.5, 1.6, 0.2, 0, 2.0, 1.25),     /* cross | */
        pBox(1.4, 0.5, 0.2, 0, 2.0, 1.25),     /* cross — */
        pBox(1.0, 1.1, 0.1, 0, 0.55, 1.25),    /* entrance */
      ]);
    },
    function school() {                          /* 2022 — finished school */
      return mergeEdges([
        pBox(3.6, 1.8, 2.2, 0, 0.9, 0),
        pCone(2.5, 1.2, 4, 0, 2.4, 0, Math.PI / 4),  /* pitched roof */
        pBox(0.08, 1.7, 0.08, 1.55, 2.6, 0),         /* flagpole */
        pBox(0.7, 0.45, 0.04, 1.9, 3.25, 0),         /* flag */
        pBox(0.9, 0.9, 0.1, 0, 0.45, 1.1),           /* door */
      ]);
    },
    function college() {                         /* 2022 — engineering college */
      var parts = [
        pBox(4.4, 0.5, 3, 0, 0.25, 0),               /* steps */
        pBox(4.2, 0.45, 2.8, 0, 2.4, 0),             /* entablature */
        pCone(2.7, 0.9, 4, 0, 3.05, 0, Math.PI / 4), /* low roof */
      ];
      for (var c = 0; c < 5; c++) parts.push(pCyl(0.16, 0.16, 1.9, 6, -1.6 + c * 0.8, 1.45, 1.0));
      return mergeEdges(parts);
    },
    function trophy() {                          /* 2024 — 1st place */
      return mergeEdges([
        pBox(1.5, 0.4, 1.5, 0, 0.2, 0),              /* pedestal */
        pCyl(0.22, 0.22, 0.7, 6, 0, 0.75, 0),        /* stem */
        pCyl(0.95, 0.45, 1.0, 10, 0, 1.6, 0),        /* cup */
        pCone(0.5, 0.5, 4, 0, 2.5, 0, Math.PI / 4),  /* star */
      ]);
    },
    function office() {                          /* 2024 — first internship */
      var parts = [pBox(2.2, 5, 2.2, 0, 2.5, 0)];
      for (var f = 1; f <= 4; f++) parts.push(pBox(2.3, 0.06, 2.3, 0, f * 1.0, 0)); /* floors */
      return mergeEdges(parts);
    },
    function monitor() {                         /* 2025 — website build sprint */
      return mergeEdges([
        pBox(2.6, 1.7, 0.15, 0, 1.9, 0),             /* screen */
        pCyl(0.12, 0.12, 0.5, 6, 0, 0.95, 0),        /* neck */
        pBox(1.1, 0.1, 0.6, 0, 0.65, 0),             /* base */
        pBox(2.2, 0.25, 0.05, 0, 2.45, 0.1),         /* page header */
        pBox(0.9, 0.8, 0.05, -0.55, 1.6, 0.1),       /* content L */
        pBox(0.9, 0.8, 0.05, 0.55, 1.6, 0.1),        /* content R */
      ]);
    },
    function laptop() {                          /* 2025 — hackathon */
      return mergeEdges([
        pBox(2.6, 0.12, 1.7, 0, 0.06, 0),            /* keyboard */
        pBox(2.6, 1.6, 0.1, 0, 0.86, -0.78, -0.34),  /* lid (tilted) */
        pBox(1.5, 0.7, 0.04, 0, 0.95, -0.68, -0.34), /* code on screen */
      ]);
    },
    function server() {                          /* 2026 — full-stack intern */
      var parts = [pBox(2, 4, 1.7, 0, 2, 0)];
      for (var u = 0; u < 6; u++) {
        parts.push(pBox(1.9, 0.32, 1.6, 0, 0.55 + u * 0.6, 0));        /* units */
        parts.push(pBox(0.12, 0.12, 0.06, -0.7, 0.55 + u * 0.6, 0.82)); /* LED */
      }
      return mergeEdges(parts);
    },
    function gradcap() {                         /* 2026 — graduated */
      return mergeEdges([
        pCyl(0.72, 0.72, 0.7, 8, 0, 0.6, 0),         /* head band */
        pBox(2.3, 0.12, 2.3, 0, 1.05, 0),            /* mortarboard */
        pBox(0.18, 0.18, 0.18, 0, 1.2, 0),           /* button */
        pCyl(0.04, 0.04, 1.0, 4, 1.0, 0.6, 0),       /* tassel cord */
        pCone(0.13, 0.26, 5, 1.0, 0.0, 0),           /* tassel end */
      ]);
    },
  ];

  var buildings = [];
  (function () {
    var p2 = new THREE.Vector3(), t2 = new THREE.Vector3(), side = new THREE.Vector3();
    var worldUp = new THREE.Vector3(0, 1, 0);
    for (var i = 0; i < N; i++) {
      curve.getPointAt(stationT[i], p2);
      curve.getTangentAt(Math.min(0.999, stationT[i]), t2).normalize();
      side.crossVectors(t2, worldUp).normalize();    /* horizontal perpendicular to the road */
      var sign = (i % 2 === 0) ? 1 : -1;
      var sideOff = 3.6, ahead = 1.2, down = 1.9;
      var geo = BUILDERS[i % BUILDERS.length]();
      var mat = new THREE.LineBasicMaterial({
        color: CYAN.clone(), transparent: true, opacity: 0.14,
        depthWrite: false, blending: THREE.AdditiveBlending,
      });
      var ls = new THREE.LineSegments(geo, mat);
      /* sit just ahead of the waypoint, beside + below the road so the camera
         frames it on arrival (alternating sides) */
      ls.position.set(
        p2.x + t2.x * ahead + side.x * sideOff * sign,
        p2.y - down,
        p2.z + t2.z * ahead + side.z * sideOff * sign
      );
      ls.scale.setScalar(isCoarse ? 0.9 : 1.0);
      ls.userData.t = i / (N - 1);   /* ignite in scroll space, aligned to active index */
      scene.add(ls);
      buildings.push(ls);
    }
  })();

  function smooth01(e0, e1, x) {
    var t = (x - e0) / (e1 - e0);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return t * t * (3 - 2 * t);
  }
  function updateBuildings(p) {
    for (var i = 0; i < buildings.length; i++) {
      /* ramp up as the camera approaches; stay lit once "unlocked" (a trail) */
      var ig = smooth01(buildings[i].userData.t - 0.08, buildings[i].userData.t - 0.01, p);
      var m = buildings[i].material;
      m.opacity = 0.14 + ig * 0.86;
      m.color.copy(CYAN).lerp(LIME, ig);
    }
  }

  /* ----------------------------------------------------------
     sizing — base off the canvas box (works pinned or static)
     ---------------------------------------------------------- */
  var dprCap = isCoarse ? 1.2 : 1.5;
  function dpr() { return Math.min(window.devicePixelRatio || 1, dprCap); }
  function resize() {
    var w = canvas.clientWidth || stage.clientWidth;
    var h = canvas.clientHeight || stage.clientHeight;
    if (!w || !h) return;
    var pr = dpr();
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.85 ? 70 : 58;
    camera.updateProjectionMatrix();
    stMat.uniforms.uDpr.value = pr;
    duMat.uniforms.uDpr.value = pr;
  }
  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("perf-lite", function () {
    dprCap = 1;
    if (dust) dust.visible = false;        /* 1600 additive points — pure decoration */
    if (roadHalo) roadHalo.visible = false; /* cosmetic bloom twin */
    resize();
  });

  /* ----------------------------------------------------------
     camera flight — eased so it lingers at each station, then
     accelerates between them ("stops" at each life event).
     ---------------------------------------------------------- */
  var _p = new THREE.Vector3();
  var _tan = new THREE.Vector3();
  var _look = new THREE.Vector3();
  var _camPrev = new THREE.Vector3();
  var _up = new THREE.Vector3(0, 1, 0);
  var CAM_BACK = 6.5, CAM_UP = 2.4, CAM_LEAD = 0.03;

  function stationEase(p) {
    /* ease through the ACTUAL arc-length position of each station so the
       camera truly lingers at every waypoint (stations aren't uniform in u) */
    var seg = p * (N - 1);
    var i = Math.floor(seg);
    if (i >= N - 1) return stationT[N - 1];
    var f = seg - i;
    var fe = f * f * (3 - 2 * f); /* smoothstep */
    return stationT[i] + (stationT[i + 1] - stationT[i]) * fe;
  }

  function placeCamera(p) {
    var camT = stationEase(p);
    var uHead = Math.min(1, camT + CAM_LEAD);
    curve.getPointAt(camT, _p);
    curve.getPointAt(uHead, _look);
    /* forward dir by finite difference of two samples we already take
       (getTangentAt would allocate 2 Vector3 per frame in r128) */
    _tan.subVectors(_look, _p);
    if (_tan.lengthSq() < 1e-6) {                 /* at the very end of the curve */
      curve.getPointAt(Math.max(0, camT - 0.02), _camPrev);
      _tan.subVectors(_p, _camPrev);
    }
    _tan.normalize();
    /* sit behind + above the road, looking slightly ahead */
    camera.position.set(
      _p.x - _tan.x * CAM_BACK + camMouse.x,
      _p.y - _tan.y * CAM_BACK + CAM_UP + camMouse.y,
      _p.z - _tan.z * CAM_BACK
    );
    _look.y += 0.4;
    camera.up.copy(_up);
    camera.lookAt(_look);
    var uProg = Math.min(1, camT + CAM_LEAD + 0.012);
    roadCoreMat.uniforms.uProgress.value = uProg;
    roadHaloMat.uniforms.uProgress.value = uProg;
    stMat.uniforms.uProgress.value = uProg;
  }

  /* subtle mouse parallax (fine pointers only) */
  var camMouse = { x: 0, y: 0 };
  var tMouse = { x: 0, y: 0 };
  if (finePointer && !reduced) {
    stage.addEventListener("mousemove", function (e) {
      var r = stage.getBoundingClientRect();
      tMouse.x = ((e.clientX - r.left) / r.width - 0.5) * 1.6;
      tMouse.y = -((e.clientY - r.top) / r.height - 0.5) * 1.0;
    }, { passive: true });
  }

  /* ----------------------------------------------------------
     active-event tracking -> list highlight + progress bar
     ---------------------------------------------------------- */
  var activeIdx = -1;
  function setActive(idx) {
    if (idx === activeIdx) return;
    activeIdx = idx;
    for (var i2 = 0; i2 < items.length; i2++) {
      var on = i2 === idx;
      items[i2].classList.toggle("is-active", on);
      if (on) items[i2].setAttribute("aria-current", "true");
      else items[i2].removeAttribute("aria-current");
    }
    /* announce the focal event for screen readers (mirrors .sphere__live) */
    if (live && idx >= 0 && items[idx]) {
      var yr = items[idx].querySelector(".jx__yr");
      var tt = items[idx].querySelector(".jx__t");
      live.textContent = (yr ? yr.textContent + " — " : "") +
        (tt ? tt.textContent : "") + ", " + (idx + 1) + " of " + N;
    }
  }

  /* ----------------------------------------------------------
     render loop
     ---------------------------------------------------------- */
  var running = false;
  var inView = false;
  var contextLost = false;
  var scrollP = 0;     /* target progress from ScrollTrigger */
  var dispP = 0;       /* smoothed progress actually rendered */
  var animT = 0;       /* monotonic animation clock (continuous across pause/resume) */
  var lastNow = 0;

  function now0() { return window.performance ? performance.now() : 0; }

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    var dt = (now - lastNow) / 1000;
    lastNow = now;
    animT += Math.min(dt, 0.05);   /* cap absorbs tab-hide gaps -> no phase jump */

    dispP += (scrollP - dispP) * 0.12;
    if (Math.abs(scrollP - dispP) < 0.0002) dispP = scrollP;
    camMouse.x += (tMouse.x - camMouse.x) * 0.05;
    camMouse.y += (tMouse.y - camMouse.y) * 0.05;

    placeCamera(dispP);
    setActive(Math.round(dispP * (N - 1)));
    updateBuildings(dispP);

    stMat.uniforms.uTime.value = animT;
    duMat.uniforms.uTime.value = animT;
    if (bar) bar.style.transform = "scaleX(" + dispP + ")";

    renderer.render(scene, camera);
  }
  function play() {
    if (running || reduced || contextLost) return;
    running = true;
    lastNow = now0();
    requestAnimationFrame(frame);
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) running = false;                 /* stop scheduling on hide */
    else if (inView && !reduced && !contextLost) play();  /* explicit, clock-resetting resume */
  });

  /* pre-warm so entering the section is hitch-free */
  placeCamera(0);
  updateBuildings(0);
  setActive(0);                 /* show the first event before the loop starts */
  renderer.compile(scene, camera);
  renderer.render(scene, camera);

  /* ----------------------------------------------------------
     scroll wiring — sticky stage; scrub drives the flight
     ---------------------------------------------------------- */
  ScrollTrigger.create({
    trigger: section,
    start: "top top",
    end: "bottom bottom",
    onUpdate: function (self) { scrollP = self.progress; },
    onToggle: function (self) {
      inView = self.isActive;
      if (inView) play(); else running = false;
    },
  });

  canvas.addEventListener("webglcontextlost", function (e) {
    e.preventDefault();
    contextLost = true;
    inView = false;
    running = false;
    showFallback(true);
  });

  /* ----------------------------------------------------------
     test / debug hooks (used by .dev/verify-journey.js)
     ---------------------------------------------------------- */
  window.__JOURNEY__ = {
    count: N,
    progress: function () { return dispP; },
    activeIndex: function () { return activeIdx; },
    inView: function () { return inView; },
    /* force a progress for clean screenshots, bypassing scroll */
    debugProgress: function (p) {
      scrollP = dispP = Math.max(0, Math.min(1, p));
      placeCamera(dispP);
      setActive(Math.round(dispP * (N - 1)));
      updateBuildings(dispP);
      if (bar) bar.style.transform = "scaleX(" + dispP + ")";
      renderer.render(scene, camera);
    },
  };
})();
