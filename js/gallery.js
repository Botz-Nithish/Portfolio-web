/* ============================================================
   SPHERE GALLERY — phantom.land-style project wall.
   You stand inside a sphere tiled with project cards:
   drag (with inertia) to look around, scroll sweeps the wall,
   click a card to open its project page.
   Three.js r128 + GSAP. All artwork is generated on canvas.
   ============================================================ */
(function () {
  "use strict";

  var canvas = document.getElementById("gallery-canvas");
  var section = document.querySelector(".sphere");
  if (!canvas || !section) return;

  var stage = section.querySelector(".sphere__stage");
  var hud = section.querySelector(".sphere__hud");
  var live = section.querySelector(".sphere__live");
  var fallbackList = section.querySelector(".sphere__fallback");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(pointer: fine)").matches &&
                    window.matchMedia("(hover: hover)").matches;

  function showFallback() {
    canvas.style.display = "none";
    if (hud) hud.style.display = "none";
    if (fallbackList) {
      fallbackList.hidden = false;
      fallbackList.style.overflowY = "auto";
    }
    section.style.height = "100svh";
  }

  if (!window.THREE || !window.gsap || !window.ScrollTrigger) { showFallback(); return; }

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas, antialias: true, alpha: true, powerPreference: "high-performance",
    });
  } catch (e) { showFallback(); return; }

  renderer.outputEncoding = THREE.sRGBEncoding;

  /* ----------------------------------------------------------
     data — real projects (Nithish Rao Perumenki)
     swap `media:"assets/projects/<file>.gif"` onto any entry to
     show real footage; see README for the drop-in steps.
     ---------------------------------------------------------- */
  var PROJECTS = [
    { slug: "zingbot",   title: "ZINGBOT",    client: "Zingbizz Digital",   year: "2026", sector: "SaaS Platform",   role: "Full-Stack Developer", tags: ["Next.js", "Supabase"],     a: "#25d366", b: "#08160e", motif: "wave",  media: "assets/projects/zingbot.svg", lede: "A multi-tenant SaaS for WhatsApp & Instagram automation: a visual workflow builder, analytics dashboard and live bot-preview, scaled for 50+ clients." },
    { slug: "wms",       title: "WMS",        client: "Zingbizz Digital",   year: "2026", sector: "Enterprise",      role: "Full-Stack Developer", tags: ["NestJS", "Prisma"],        a: "#5cc8ff", b: "#0a141d", motif: "grid",  media: "assets/projects/wms.mp4", poster: "assets/projects/wms.svg", lede: "A warehouse management system: 38+ modules with JWT role-based access control across 8 user roles, on NestJS, Prisma and PostgreSQL." },
    { slug: "pixelpipe", title: "PIXELPIPE",  client: "Zingbizz Digital",   year: "2026", sector: "Infrastructure",  role: "Backend Engineer",     tags: ["Nginx", "WebP/AVIF"],      a: "#ff7847", b: "#1d0e08", motif: "bars",  media: "assets/projects/pixelpipe.svg", lede: "A self-hosted image-delivery pipeline with dynamic WebP/AVIF optimization and Nginx disk caching, cutting front-end image load times by 5x." },
    { slug: "vmeet",     title: "V-MEET",     client: "Academic Project",   year: "2025", sector: "Cloud Platform",  role: "Full-Stack Developer", tags: ["Azure", "Gemini AI"],      a: "#b59cff", b: "#13102a", motif: "rings", media: "assets/projects/vmeet.mp4", poster: "assets/projects/vmeet.svg", lede: "Automated Azure VM provisioning for academic labs: one-click deployment for whole classes, role-based teacher/student/admin portals and a Gemini assistant." },
    { slug: "neurorythm",title: "NEURORYTHM", client: "Academic Project",   year: "2025", sector: "Health Tech",     role: "Full-Stack Developer", tags: ["Python", "FastAPI"],       a: "#54e0e0", b: "#07171a", motif: "wave",  media: "assets/projects/neurorythm.svg", lede: "An EEG-to-music mapper for autism support: brainwave bands (Delta to Gamma) translated into therapeutic MIDI, with real-time processing and visualization." },
    { slug: "scholar",   title: "SCHOLAR",    client: "Academic Project",   year: "2025", sector: "Data Viz",        role: "Full-Stack Developer", tags: ["React", "Chart.js"],       a: "#ffd84d", b: "#1c1604", motif: "type",  media: "assets/projects/scholar.svg", lede: "A scholarly profile viewer: citations, co-authors and metrics pulled from Google Scholar via SerpAPI, with AI-generated author summaries." },
    { slug: "kallos",    title: "KALLOS",     client: "Techno Kallos '24",  year: "2024", sector: "E-Commerce",      role: "Designer & Front-End", tags: ["UI Design", "1st Place"],  a: "#d2ff3b", b: "#11160a", motif: "orb",   media: "assets/projects/kallos.mp4", poster: "assets/projects/kallos.svg", lede: "A luxury e-commerce concept and full UI redesign, hand-built under time pressure — 1st place at the Techno Kallos design summit." },
    { slug: "finsol",    title: "FINSOL",     client: "Finsol Consultancy", year: "2025", sector: "Fintech",         role: "Front-End Intern",     tags: ["React", "Redux"],          a: "#9cff5a", b: "#0d1607", motif: "arc",   media: "assets/projects/finsol.svg", lede: "Migrated a legacy AngularJS app to React, with Tailwind styling, Axios API integration and Redux global state for a cleaner, faster UI." },
  ];

  /* deterministic pseudo-random per slug, so art is stable */
  function seeded(slug) {
    var s = 0;
    for (var i = 0; i < slug.length; i++) s = (s * 31 + slug.charCodeAt(i)) >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /* ----------------------------------------------------------
     procedural artwork
     ---------------------------------------------------------- */
  function paintArt(ctx, w, h, p) {
    var rnd = seeded(p.slug);
    var g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, p.b);
    g.addColorStop(1, "#060607");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    if (p.motif === "orb") {
      var cx = w * (0.38 + rnd() * 0.24), cy = h * (0.34 + rnd() * 0.2), r = Math.min(w, h) * 0.34;
      var rg = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r * 1.6);
      rg.addColorStop(0, p.a);
      rg.addColorStop(0.55, p.a + "55");
      rg.addColorStop(1, "transparent");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = p.a;
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.62, 0, 7); ctx.fill();
    } else if (p.motif === "rings") {
      var cx2 = w * 0.5, cy2 = h * (0.4 + rnd() * 0.1);
      ctx.strokeStyle = p.a;
      for (var i = 0; i < 5; i++) {
        ctx.globalAlpha = 1 - i * 0.17;
        ctx.lineWidth = Math.max(2, w * 0.012);
        ctx.beginPath();
        ctx.arc(cx2, cy2, (Math.min(w, h) * 0.09) * (i + 1), 0, 7);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (p.motif === "bars") {
      var n = 9, bw = w / (n * 1.8);
      for (var j = 0; j < n; j++) {
        var bh = h * (0.18 + rnd() * 0.5);
        ctx.fillStyle = p.a;
        ctx.globalAlpha = 0.35 + rnd() * 0.65;
        ctx.fillRect(w * 0.08 + j * (w * 0.84 / n), h * 0.78 - bh, bw, bh);
      }
      ctx.globalAlpha = 1;
    } else if (p.motif === "wave") {
      ctx.strokeStyle = p.a;
      ctx.lineCap = "round";
      for (var k = 0; k < 3; k++) {
        ctx.globalAlpha = 1 - k * 0.3;
        ctx.lineWidth = Math.max(3, w * 0.014);
        ctx.beginPath();
        var yy = h * (0.32 + k * 0.16);
        ctx.moveTo(-10, yy);
        ctx.bezierCurveTo(w * 0.3, yy - h * (0.16 + rnd() * 0.1), w * 0.6, yy + h * (0.14 + rnd() * 0.1), w + 10, yy - h * 0.08);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (p.motif === "grid") {
      ctx.fillStyle = p.a;
      var step = w / 11;
      for (var gx = 1; gx < 11; gx++) {
        for (var gy = 1; gy < Math.round(h / step); gy++) {
          ctx.globalAlpha = 0.16 + 0.5 * rnd();
          ctx.beginPath();
          ctx.arc(gx * step, gy * step, w * 0.008, 0, 7);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      ctx.fillRect(w * 0.55, h * 0.22, step * 1.6, step * 1.6);
    } else if (p.motif === "type") {
      ctx.fillStyle = p.a;
      ctx.font = "900 " + Math.round(h * 0.74) + 'px "Clash Display", "Arial Black", sans-serif';
      ctx.textBaseline = "middle";
      ctx.fillText(p.title[0], w * 0.16, h * 0.46);
    } else { /* arc */
      var aw = w * 0.46;
      var grad2 = ctx.createLinearGradient(0, h * 0.2, 0, h);
      grad2.addColorStop(0, p.a);
      grad2.addColorStop(1, p.a + "22");
      ctx.fillStyle = grad2;
      ctx.beginPath();
      ctx.moveTo(w / 2 - aw / 2, h);
      ctx.lineTo(w / 2 - aw / 2, h * 0.46);
      ctx.arc(w / 2, h * 0.46, aw / 2, Math.PI, 0);
      ctx.lineTo(w / 2 + aw / 2, h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    paintOverlay(ctx, w, h, p);
  }

  /* caption + vignette, shared by generated art and real media frames */
  function paintOverlay(ctx, w, h, p) {
    var vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.85);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "rgba(239,237,230,0.92)";
    ctx.font = "500 " + Math.round(w * 0.082) + 'px "Clash Display", "Segoe UI", sans-serif';
    ctx.textBaseline = "alphabetic";
    ctx.fillText(p.title, w * 0.07, h * 0.9);
    ctx.fillStyle = p.a;
    ctx.font = "400 " + Math.round(w * 0.05) + "px monospace";
    ctx.fillText("+", w * 0.88, h * 0.9);
  }

  /* tile texture: artwork square + mono captions in the margins */
  var TILE_W = 512, TILE_H = 680, ART_Y = 92, ART_S = 512;
  function makeTileTexture(p, index) {
    var c = document.createElement("canvas");
    c.width = TILE_W; c.height = TILE_H;
    var ctx = c.getContext("2d");

    ctx.save();
    ctx.translate(0, ART_Y);
    roundRect(ctx, 0, 0, ART_S, ART_S, 26);
    ctx.clip();
    paintArt(ctx, ART_S, ART_S, p);
    ctx.restore();

    var mono = '500 21px "Cascadia Code", Consolas, monospace';
    /* above: client — title */
    ctx.font = mono;
    ctx.fillStyle = "rgba(239,237,230,0.55)";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(p.client.toUpperCase(), 2, 40);
    ctx.fillStyle = "rgba(239,237,230,0.85)";
    var tw = ctx.measureText(p.title).width;
    ctx.fillText(p.title, TILE_W - tw - 2, 40);
    ctx.fillStyle = "rgba(239,237,230,0.35)";
    ctx.fillText(String(index + 1).padStart(2, "0"), 2, 74);

    /* below: year — tag chips */
    var byY = ART_Y + ART_S + 46;
    ctx.fillStyle = "rgba(239,237,230,0.55)";
    ctx.fillText(p.year, 2, byY);
    var x = TILE_W;
    for (var i = p.tags.length - 1; i >= 0; i--) {
      var t = p.tags[i].toUpperCase();
      var w2 = ctx.measureText(t).width + 34;
      x -= w2 + (i < p.tags.length - 1 || true ? 10 : 0);
      ctx.strokeStyle = "rgba(239,237,230,0.35)";
      ctx.lineWidth = 2;
      roundRect(ctx, x, byY - 28, w2, 40, 20);
      ctx.stroke();
      ctx.fillStyle = "rgba(239,237,230,0.7)";
      ctx.fillText(t, x + 17, byY);
    }

    var tex = new THREE.CanvasTexture(c);
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    tex.encoding = THREE.sRGBEncoding;

    /* real project media (PNG/JPG/WebP/GIF first frame) replaces the
       generated art once it loads; captions and vignette are re-baked */
    var still = tileStill(p);
    if (still) {
      var img = new Image();
      img.onload = function () {
        ctx.save();
        ctx.translate(0, ART_Y);
        roundRect(ctx, 0, 0, ART_S, ART_S, 26);
        ctx.clip();
        var s = Math.max(ART_S / img.width, ART_S / img.height);
        var dw = img.width * s, dh = img.height * s;
        ctx.drawImage(img, (ART_S - dw) / 2, (ART_S - dh) / 2, dw, dh);
        paintOverlay(ctx, ART_S, ART_S, p);
        ctx.restore();
        tex.needsUpdate = true;
      };
      img.src = still;
    }
    return tex;
  }

  /* media that can be drawn to a canvas (videos need a poster for the wall) */
  function tileStill(p) {
    if (p.poster) return p.poster;
    if (p.media && !/\.(mp4|webm)(\?|$)/i.test(p.media)) return p.media;
    return null;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* hero art for the project page (wide) */
  function heroArt(p) {
    var c = document.createElement("canvas");
    c.width = 1280; c.height = 760;
    paintArt(c.getContext("2d"), 1280, 760, p);
    return c.toDataURL("image/png");
  }

  /* ----------------------------------------------------------
     scene
     ---------------------------------------------------------- */
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(74, 1, 0.1, 120);
  camera.rotation.order = "YXZ";
  scene.add(camera);

  var RADIUS = 28;
  var planeGeo = new THREE.PlaneGeometry(9.2, 12.2);
  var tiles = [];
  var textures = PROJECTS.map(function (p, i) { return makeTileTexture(p, i); });

  /* a grid wall wrapping the sphere: GRID_ROWS x COLS tiles. The assignment
     (col + row*3) % N means no two neighbouring tiles ever share a project,
     and any 3x3 patch shows all N projects with just one repeat. COLS is a
     multiple of N so the wrap-around seam stays clean (left exits -> right
     enters seamlessly as you rotate). */
  var N = PROJECTS.length;             // 8
  var COLS = 16;
  var GRID_ROWS = [0.47, 0.0, -0.47];  // top / middle / bottom latitudes
  for (var r = 0; r < GRID_ROWS.length; r++) {
    for (var c = 0; c < COLS; c++) {
      var theta = (c / COLS) * Math.PI * 2;
      var phi = GRID_ROWS[r];
      var pi = (c + r * 3) % N;
      var mat = new THREE.MeshBasicMaterial({
        map: textures[pi], transparent: true, depthWrite: false,
      });
      var mesh = new THREE.Mesh(planeGeo, mat);
      var cp = Math.cos(phi), sp = Math.sin(phi);
      mesh.position.set(
        RADIUS * cp * Math.sin(theta),
        RADIUS * sp,
        -RADIUS * cp * Math.cos(theta)
      );
      mesh.lookAt(0, 0, 0);
      scene.add(mesh);
      tiles.push({ mesh: mesh, p: PROJECTS[pi], dir: mesh.position.clone().normalize(), base: 1 });
    }
  }

  /* ----------------------------------------------------------
     sizing
     ---------------------------------------------------------- */
  var isCoarse = window.matchMedia("(pointer: coarse)").matches;
  var dprCap = isCoarse ? 1.2 : 1.5;
  function resize() {
    var w = stage.clientWidth, h = stage.clientHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    baseFov = w / h < 0.8 ? 92 : 74;
    fovCurrent = baseFov;
    camera.fov = baseFov;
    camera.updateProjectionMatrix();
  }
  var baseFov = 74;
  resize();
  window.addEventListener("resize", resize);

  window.addEventListener("perf-lite", function () {
    dprCap = 1;
    resize();
  });

  /* pre-warm: compile the program and upload all textures while the
     preloader still covers the screen, so entering the section is hitch-free */
  renderer.compile(scene, camera);
  renderer.render(scene, camera);

  /* ----------------------------------------------------------
     rotation state — drag + inertia + scroll sweep
     ---------------------------------------------------------- */
  var yaw = 0, pitch = 0, targetYaw = 0, targetPitch = 0, scrollYaw = 0;
  var PITCH_MAX = 0.62;
  var dragging = false, moved = 0, lastX = 0, lastY = 0, velX = 0;
  var hudHidden = false;

  function dragScale() { return 2.4 / Math.max(640, stage.clientWidth); }

  canvas.addEventListener("pointerdown", function (e) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    dragging = true;
    moved = 0;
    lastX = e.clientX; lastY = e.clientY;
    velX = 0;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointers */ }
    if (ring) ring.classList.add("is-active");
  });

  canvas.addEventListener("pointermove", function (e) {
    if (dragging) {
      var dx = e.clientX - lastX;
      var dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      var k = dragScale();
      targetYaw -= dx * k;
      targetPitch = clamp(targetPitch + dy * k * 0.85, -PITCH_MAX, PITCH_MAX);
      velX = velX * 0.7 + dx * 0.3;
      if (!hudHidden && moved > 24) {
        hudHidden = true;
        hud.classList.add("is-hidden");
      }
    } else if (e.pointerType !== "touch") {
      updateHover(e);
    }
  });

  function wrapAngle(a) {
    a = (a + Math.PI) % (Math.PI * 2);
    if (a < 0) a += Math.PI * 2;
    return a - Math.PI;
  }

  /* ease the nearest tile to dead centre (magnetic settle) */
  function snapToNearest() {
    var yawT = targetYaw + scrollYaw;
    var bestD = Infinity, dYaw = 0, dPitch = targetPitch;
    for (var i = 0; i < tiles.length; i++) {
      var d = tiles[i].dir;
      var theta = Math.atan2(d.x, -d.z);
      var phi = Math.asin(d.y);
      var dy = wrapAngle(-theta - yawT);
      var dp = clamp(phi, -PITCH_MAX, PITCH_MAX) - targetPitch;
      var score = dy * dy + dp * dp * 1.3;
      if (score < bestD) { bestD = score; dYaw = dy; dPitch = clamp(phi, -PITCH_MAX, PITCH_MAX); }
    }
    targetYaw += dYaw;
    targetPitch = dPitch;
    if (bestD > 0.02 && window.__SOUND__) window.__SOUND__.snap();
  }

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    if (ring) ring.classList.remove("is-active");
    if (!reduced && Math.abs(velX) > 2) {
      targetYaw -= velX * dragScale() * 16; /* fling */
    }
    if (moved < 7 && e.type === "pointerup") {
      var hit = pick(e);
      if (hit) { openProject(hit.p, hit); return; }
    }
    snapToNearest();
  }
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /* ----------------------------------------------------------
     raycast hover / pick
     ---------------------------------------------------------- */
  var raycaster = new THREE.Raycaster();
  var ndc = new THREE.Vector2();
  var meshList = tiles.map(function (t) { return t.mesh; });
  var hovered = null;
  var ring = document.querySelector(".cursor__ring");
  var ringLabel = document.querySelector(".cursor__label");
  var hasCursor = document.documentElement.classList.contains("has-cursor");

  function pick(e) {
    var r = canvas.getBoundingClientRect();
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    var hits = raycaster.intersectObjects(meshList);
    if (!hits.length) return null;
    var m = hits[0].object;
    for (var i = 0; i < tiles.length; i++) if (tiles[i].mesh === m) return tiles[i];
    return null;
  }

  function setHover(tile) {
    if (hovered === tile) return;
    if (hovered) gsap.to(hovered, { base: 1, duration: 0.45, ease: "power3.out" });
    hovered = tile;
    if (hovered) {
      gsap.to(hovered, { base: 1.06, duration: 0.45, ease: "power3.out" });
      if (window.__SOUND__) window.__SOUND__.tick();
      if (hasCursor && ring) { ring.classList.add("has-label"); ringLabel.textContent = "View"; }
    } else if (hasCursor && ring) {
      ring.classList.remove("has-label");
    }
  }

  var pendingHover = null;
  function updateHover(e) {
    if (!finePointer) return;
    pendingHover = { clientX: e.clientX, clientY: e.clientY };
  }
  canvas.addEventListener("pointerleave", function () { pendingHover = null; setHover(null); });

  /* ----------------------------------------------------------
     keyboard support
     ---------------------------------------------------------- */
  canvas.addEventListener("keydown", function (e) {
    var step = Math.PI * 2 / COLS; /* one column */
    if (e.key === "ArrowLeft") { targetYaw += step; snapToNearest(); e.preventDefault(); }
    else if (e.key === "ArrowRight") { targetYaw -= step; snapToNearest(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { targetPitch = clamp(targetPitch + 0.31, -PITCH_MAX, PITCH_MAX); snapToNearest(); e.preventDefault(); }
    else if (e.key === "ArrowDown") { targetPitch = clamp(targetPitch - 0.31, -PITCH_MAX, PITCH_MAX); snapToNearest(); e.preventDefault(); }
    else if (e.key === "Enter" || e.key === " ") {
      if (centered) { openProject(centered.p, centered); e.preventDefault(); }
    }
  });

  /* ----------------------------------------------------------
     render loop — eased rotation, angle-based dimming
     ---------------------------------------------------------- */
  var running = false;
  var camDir = new THREE.Vector3();
  var centered = null;
  var lastLive = "";
  var smoothVel = 0;
  var fovCurrent = 74;

  function frame() {
    if (!running || document.hidden) { running = false; return; }
    requestAnimationFrame(frame);

    if (!dragging && !reduced && !projOpen) targetYaw -= 0.00042; /* idle drift */

    var ease = reduced ? 0.4 : 0.075;
    var prevYaw = yaw;
    yaw += (targetYaw + scrollYaw - yaw) * ease;
    pitch += (targetPitch - pitch) * ease;
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;

    /* motion feel: squash/stretch with angular velocity + fov dolly */
    smoothVel += ((yaw - prevYaw) - smoothVel) * 0.12;
    var stretch = reduced ? 0 : Math.min(0.13, Math.abs(smoothVel) * 5.5);
    var targetFov = baseFov + (dragging ? 2.5 : 0) + Math.min(8, Math.abs(smoothVel) * 220);
    if (reduced) targetFov = baseFov;
    fovCurrent += (targetFov - fovCurrent) * 0.09;
    if (Math.abs(fovCurrent - camera.fov) > 0.02) {
      camera.fov = fovCurrent;
      camera.updateProjectionMatrix();
    }

    if (pendingHover) { setHover(pick(pendingHover)); pendingHover = null; }

    camera.getWorldDirection(camDir);
    var best = null, bestDot = -1;
    for (var i = 0; i < tiles.length; i++) {
      var t = tiles[i];
      var dot = t.dir.dot(camDir);
      if (dot > bestDot) { bestDot = dot; best = t; }
      var b = clamp((dot - 0.42) / 0.5, 0, 1);
      b = 0.1 + 0.9 * Math.pow(b, 1.5);
      if (t === hovered) b = 1;
      t.mesh.material.color.setScalar(b);
      t.mesh.scale.set(t.base * (1 + stretch), t.base * (1 - stretch * 0.55), t.base);
    }
    centered = best;
    renderer.render(scene, camera);
  }

  function play() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && stInView) play();
  });

  /* announce the centred project for screen readers (throttled) */
  setInterval(function () {
    if (!running || !centered || dragging) return;
    var msg = centered.p.title + ", " + centered.p.sector + ", " + centered.p.year;
    if (msg !== lastLive) { lastLive = msg; if (live) live.textContent = msg; }
  }, 900);

  /* ----------------------------------------------------------
     scroll wiring — sweep the wall while the section is pinned
     ---------------------------------------------------------- */
  var stInView = false;
  var bar = section.querySelector(".sphere__bar i");
  ScrollTrigger.create({
    trigger: section,
    start: "top bottom",
    end: "bottom top",
    onUpdate: function (self) {
      if (!reduced) scrollYaw = -self.progress * 3.2;
      if (bar) bar.style.transform = "scaleX(" + self.progress + ")";
    },
    onToggle: function (self) {
      stInView = self.isActive;
      if (stInView) play(); else running = false;
    },
  });

  /* build-in: tiles bloom into place the first time you arrive */
  if (!reduced) {
    tiles.forEach(function (t) {
      t.base = 0.62;
      t.mesh.material.opacity = 0;
    });
    ScrollTrigger.create({
      trigger: section,
      start: "top 70%",
      once: true,
      onEnter: function () {
        play();
        var shuffled = tiles.slice().sort(function () { return Math.random() - 0.5; });
        shuffled.forEach(function (t, i) {
          gsap.to(t, { base: 1, duration: 1.1, ease: "power3.out", delay: i * 0.018 });
          gsap.to(t.mesh.material, { opacity: 1, duration: 0.9, ease: "power2.out", delay: i * 0.018 });
        });
      },
    });
  }

  canvas.addEventListener("webglcontextlost", function (e) {
    e.preventDefault();
    showFallback();
  });

  /* ----------------------------------------------------------
     project page
     ---------------------------------------------------------- */
  var proj = document.querySelector(".project");
  var projInner = proj.querySelector(".project__inner");
  var heroCache = {};
  var currentIdx = 0;

  var ghost = document.querySelector(".flip-ghost");
  var projHero = proj.querySelector(".project__hero");
  var PROJ_CONTENT = [".project__bar", ".project__head", ".project__grid", ".project__foot"];
  var currentTile = null;

  gsap.set(proj, { opacity: 0 });

  /* screen-space rect of a tile's artwork area (for the FLIP ghost) */
  function tileScreenRect(tile) {
    var mesh = tile.mesh;
    mesh.updateWorldMatrix(true, false);
    var sr = stage.getBoundingClientRect();
    var w = sr.width, h = sr.height;
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    var v = new THREE.Vector3();
    var corners = [[-4.6, -6.1], [4.6, -6.1], [4.6, 6.1], [-4.6, 6.1]];
    for (var i = 0; i < 4; i++) {
      v.set(corners[i][0], corners[i][1], 0).applyMatrix4(mesh.matrixWorld).project(camera);
      var sx = (v.x * 0.5 + 0.5) * w;
      var sy = (-v.y * 0.5 + 0.5) * h;
      if (sx < minX) minX = sx;
      if (sy < minY) minY = sy;
      if (sx > maxX) maxX = sx;
      if (sy > maxY) maxY = sy;
    }
    var W = maxX - minX, Hh = maxY - minY;
    /* artwork occupies the middle band of the tile texture */
    return {
      x: sr.left + minX,
      y: sr.top + minY + Hh * (92 / 680),
      w: W,
      h: Hh * (512 / 680),
    };
  }

  function ghostBg(p) {
    var still = tileStill(p);
    if (still) return 'url("' + still + '")';
    if (!heroCache[p.slug]) heroCache[p.slug] = heroArt(p);
    return 'url("' + heroCache[p.slug] + '")';
  }

  function field(name) { return proj.querySelector('[data-project-field="' + name + '"]'); }

  function fillProject(p) {
    currentIdx = PROJECTS.indexOf(p);
    proj.style.setProperty("--project-accent", p.a);
    proj.querySelector(".project__title").textContent = p.title;
    field("index").textContent = String(currentIdx + 1).padStart(2, "0");
    field("client").textContent = p.client;
    field("client2").textContent = p.client;
    field("year").textContent = p.year;
    field("role").textContent = p.role;
    field("sector").textContent = p.sector;
    field("lede").textContent = p.lede;
    field("next").textContent = PROJECTS[(currentIdx + 1) % PROJECTS.length].title;
    proj.querySelector(".project__tags").innerHTML = p.tags.map(function (t) {
      return "<li>" + t + "</li>";
    }).join("");
    var img = proj.querySelector(".project__art");
    var vid = proj.querySelector(".project__art-video");
    var isVideo = p.media && /\.(mp4|webm)(\?|$)/i.test(p.media);
    vid.pause();
    if (isVideo) {
      img.hidden = true;
      vid.hidden = false;
      if (vid.getAttribute("src") !== p.media) vid.src = p.media;
      vid.play().catch(function () {});
    } else {
      vid.hidden = true;
      vid.removeAttribute("src");
      img.hidden = false;
      if (p.media) {
        img.src = p.media; /* GIFs animate natively here */
      } else {
        if (!heroCache[p.slug]) heroCache[p.slug] = heroArt(p);
        img.src = heroCache[p.slug];
      }
      img.alt = p.title + " key visual";
    }
    var fsBtn = proj.querySelector(".project__fs");
    if (fsBtn) fsBtn.hidden = !isVideo;
    projInner.scrollTop = 0;
  }

  var projOpen = false;
  function siteLenis() { return (window.__SITE__ || {}).lenis; }

  function openProject(p, tile) {
    fillProject(p);
    currentTile = tile || null;
    projOpen = true;
    document.body.classList.add("project-open");
    proj.setAttribute("aria-hidden", "false");
    var l1 = siteLenis(); if (l1) l1.stop();
    if (window.__SOUND__) window.__SOUND__.open();

    if (reduced || !currentTile) {
      gsap.set(proj, { visibility: "visible", opacity: 1 });
      gsap.set([projHero].concat(PROJ_CONTENT), { clearProps: "opacity,transform" });
    } else {
      /* FLIP: the tile's artwork flies into the project hero */
      gsap.set(proj, { visibility: "visible", opacity: 0 });
      var r1 = projHero.getBoundingClientRect();
      var r0 = tileScreenRect(currentTile);
      ghost.style.backgroundImage = ghostBg(p); /* huge data-URLs choke GSAP's string parser */
      gsap.set(ghost, {
        visibility: "visible", opacity: 1,
        left: r0.x, top: r0.y, width: r0.w, height: r0.h,
        borderRadius: Math.max(10, r0.w * 0.05) + "px",
      });
      gsap.set(projHero, { opacity: 0 });
      gsap.set(PROJ_CONTENT, { opacity: 0, y: 30 });
      gsap.timeline()
        .to(proj, { opacity: 1, duration: 0.45, ease: "power2.out" }, 0)
        .to(ghost, {
          left: r1.left, top: r1.top, width: r1.width, height: r1.height,
          borderRadius: "22px", duration: 0.75, ease: "expo.inOut",
        }, 0.05)
        .to(PROJ_CONTENT, { opacity: 1, y: 0, duration: 0.6, stagger: 0.07, ease: "power3.out" }, 0.42)
        .add(function () {
          gsap.set(projHero, { opacity: 1 });
          gsap.to(ghost, {
            opacity: 0, duration: 0.22,
            onComplete: function () { gsap.set(ghost, { visibility: "hidden" }); },
          });
        }, 0.82);
    }
    gsap.delayedCall(reduced ? 0.05 : 0.5, function () {
      proj.querySelector(".project__back").focus();
    });
  }

  function closeProject() {
    var v = proj.querySelector(".project__art-video");
    if (v) v.pause();
    projOpen = false;
    document.body.classList.remove("project-open");
    proj.setAttribute("aria-hidden", "true");
    var l2 = siteLenis(); if (l2 && !document.body.classList.contains("menu-open")) l2.start();
    if (window.__SOUND__) window.__SOUND__.close();

    if (reduced || !currentTile) {
      gsap.set(proj, { visibility: "hidden", opacity: 0 });
    } else {
      /* fly the artwork back to wherever the tile is now */
      var pNow = PROJECTS[currentIdx];
      var r1 = projHero.getBoundingClientRect();
      var r0 = tileScreenRect(currentTile);
      ghost.style.backgroundImage = ghostBg(pNow);
      gsap.set(ghost, {
        visibility: "visible", opacity: 1,
        left: r1.left, top: r1.top, width: r1.width, height: r1.height,
        borderRadius: "22px",
      });
      gsap.set(projHero, { opacity: 0 });
      gsap.timeline()
        .to(proj, { opacity: 0, duration: 0.4, ease: "power2.in" }, 0.05)
        .to(ghost, {
          left: r0.x, top: r0.y, width: r0.w, height: r0.h,
          borderRadius: Math.max(10, r0.w * 0.05) + "px",
          duration: 0.65, ease: "expo.inOut",
        }, 0)
        .add(function () {
          gsap.set(proj, { visibility: "hidden" });
          gsap.set(projHero, { opacity: 1 });
          gsap.to(ghost, {
            opacity: 0, duration: 0.2,
            onComplete: function () { gsap.set(ghost, { visibility: "hidden" }); },
          });
        });
    }
    canvas.focus({ preventScroll: true });
  }

  /* play the hero video fullscreen (iOS uses its own video API) */
  function enterVideoFullscreen() {
    var v = proj.querySelector(".project__art-video");
    if (!v || v.hidden) return;
    v.muted = true;
    if (v.requestFullscreen) { v.controls = true; v.requestFullscreen().catch(function () {}); }
    else if (v.webkitRequestFullscreen) { v.controls = true; v.webkitRequestFullscreen(); }
    else if (v.webkitEnterFullscreen) { v.webkitEnterFullscreen(); } /* iOS Safari */
    if (v.paused) v.play().catch(function () {});
  }
  function onFsChange() {
    var v = proj.querySelector(".project__art-video");
    if (!v) return;
    if (!(document.fullscreenElement || document.webkitFullscreenElement)) {
      v.controls = false; /* back to the chrome-free muted loop */
      if (projOpen && v.hidden === false) v.play().catch(function () {});
    }
  }
  document.addEventListener("fullscreenchange", onFsChange);
  document.addEventListener("webkitfullscreenchange", onFsChange);

  proj.addEventListener("click", function (e) {
    if (e.target.closest("[data-project-close]")) { closeProject(); return; }
    if (e.target.closest(".project__fs")) { enterVideoFullscreen(); return; }
    if (e.target.closest("[data-project-next]")) {
      var nextP = PROJECTS[(currentIdx + 1) % PROJECTS.length];
      if (reduced) { fillProject(nextP); return; }
      gsap.to(projInner, {
        opacity: 0, duration: 0.18, ease: "power1.in",
        onComplete: function () {
          fillProject(nextP);
          gsap.fromTo(projInner, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" });
        },
      });
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && projOpen) closeProject();
    if (e.key !== "Tab" || !projOpen) return;
    var f = proj.querySelectorAll("button, a[href]");
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  });

  /* test hooks */
  window.__GALLERY__ = {
    spin: function () { targetYaw -= Math.PI * 2; },
    yaw: function () { return yaw; },
    centered: function () { return centered ? centered.p.slug : null; },
    isOpen: function () { return projOpen; },
    tileCount: tiles.length,
  };
})();
