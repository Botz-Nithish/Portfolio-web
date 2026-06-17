/* ============================================================
   NITHISH RAO - interactions
   GSAP + ScrollTrigger + Lenis. Everything is gated behind
   prefers-reduced-motion; content stays visible without JS.
   ============================================================ */
(function () {
  "use strict";

  var body = document.body;
  var preloader = document.querySelector(".preloader");

  /* if the CDN failed us, degrade gracefully to a static page */
  if (!window.gsap || !window.ScrollTrigger) {
    body.classList.remove("is-loading");
    if (preloader) preloader.remove();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(pointer: fine)").matches &&
                    window.matchMedia("(hover: hover)").matches;

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.scrollTo(0, 0);

  /* ----------------------------------------------------------
     text splitting (lightweight SplitText stand-in)
     ---------------------------------------------------------- */
  function splitChars(el) {
    var nodes = Array.prototype.slice.call(el.childNodes);
    var html = "";
    nodes.forEach(function (node) {
      if (node.nodeType === 3) {
        var words = node.textContent.split(/(\s+)/);
        words.forEach(function (w) {
          if (!w.length) return;
          if (/^\s+$/.test(w)) { html += " "; return; }
          html += '<span class="word" style="display:inline-block;white-space:nowrap">';
          for (var i = 0; i < w.length; i++) {
            html += '<span class="char" style="display:inline-block">' + w[i] + "</span>";
          }
          html += "</span>";
        });
      } else if (node.nodeType === 1) {
        if (node.textContent.trim()) {
          // inline accents (<em>) - split too, chars carry a serif modifier
          var t = node.textContent;
          html += '<span class="word" style="display:inline-block;white-space:nowrap">';
          for (var j = 0; j < t.length; j++) {
            html += '<span class="char char--em" style="display:inline-block">' + t[j] + "</span>";
          }
          html += "</span>";
        } else {
          html += node.outerHTML; // decorative spans (rules etc.) stay intact
        }
      }
    });
    el.innerHTML = html;
    return $$(".char", el);
  }

  function splitWords(el) {
    var html = "";
    Array.prototype.slice.call(el.childNodes).forEach(function (node) {
      if (node.nodeType === 3) {
        node.textContent.split(/\s+/).forEach(function (w) {
          if (w) html += '<span class="word">' + w + "</span> ";
        });
      } else if (node.nodeType === 1) {
        html += '<span class="word word--serif">' + node.outerHTML + "</span> ";
      }
    });
    el.innerHTML = html.trim();
    return $$(".word", el);
  }

  /* ----------------------------------------------------------
     smooth scroll (Lenis) - skipped for reduced motion
     ---------------------------------------------------------- */
  var lenis = null;
  if (!reduced && window.Lenis) {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    var lenisTick = function (t) { lenis.raf(t * 1000); };
    gsap.ticker.add(lenisTick);
    gsap.ticker.lagSmoothing(0);
    lenis.stop(); // released after the preloader
  }

  function scrollToTarget(sel) {
    if (sel === "#top") {
      if (lenis) lenis.scrollTo(0, { duration: 1.4 });
      else window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
      return;
    }
    var el = $(sel);
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { duration: 1.4, offset: 0 });
    else el.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
  }

  $$("[data-scroll-to]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      var target = a.getAttribute("data-scroll-to");
      if (body.classList.contains("menu-open")) {
        closeMenu();
        gsap.delayedCall(reduced ? 0 : 0.55, function () { scrollToTarget(target); });
      } else {
        scrollToTarget(target);
      }
    });
  });

  /* ----------------------------------------------------------
     hero text is split up-front so the intro can use it
     ---------------------------------------------------------- */
  var heroEyebrowChars = $$(".hero__eyebrow [data-split]")
    .reduce(function (acc, el) { return acc.concat(splitChars(el)); }, []);
  var heroLineChars = $$(".hero__title [data-split]").map(function (el) { return splitChars(el); });
  var footerLineChars = $$(".footer__title [data-split]").map(function (el) { return splitChars(el); });

  /* ----------------------------------------------------------
     preloader → hero intro
     ---------------------------------------------------------- */
  var num = $(".preloader__num");
  var barFill = $(".preloader__bar span");

  function buildHeroIntro() {
    var tl = gsap.timeline({ defaults: { ease: "power4.out" } });
    tl.to(".hero__canvas", { opacity: 1, duration: 1.6, ease: "power2.inOut" }, 0)
      .to(heroEyebrowChars, { yPercent: 0, duration: 0.8, stagger: 0.012 }, 0.1)
      .to(".hero__eyebrow-rule", { scaleX: 1, duration: 0.8, ease: "power3.inOut" }, 0.1);
    heroLineChars.forEach(function (chars, i) {
      tl.to(chars, { yPercent: 0, duration: 1.15, stagger: 0.028 }, 0.18 + i * 0.09);
    });
    tl.add(function () {
      scrambleIn($(".hero__coords"));
      scrambleIn($(".hero__year"));
    }, 1.0);
    tl.to(".hero__reg", { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(2)" }, 0.9)
      .to([".hero__blurb", ".hero__cta", ".hero__tags"], { opacity: 1, y: 0, duration: 0.9, stagger: 0.08 }, 0.65)
      .to(".hero__bottom", { opacity: 1, duration: 0.9 }, 0.85)
      .to(".nav", { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }, 0.7);
    return tl;
  }

  function startSite() {
    body.classList.remove("is-loading");
    if (lenis) lenis.start();
    ScrollTrigger.refresh();
  }

  if (reduced) {
    /* no theatrics - quick fade and show everything */
    gsap.set(".hero__canvas", { opacity: 1 });
    gsap.to(preloader, {
      opacity: 0, duration: 0.3, delay: 0.2,
      onComplete: function () { preloader.remove(); startSite(); },
    });
  } else {
    /* initial hidden states (JS-only, so no-JS users still see content) */
    gsap.set(heroEyebrowChars, { yPercent: 110 });
    gsap.set(".hero__eyebrow-rule", { scaleX: 0, transformOrigin: "left center" });
    heroLineChars.forEach(function (chars) { gsap.set(chars, { yPercent: 115 }); });
    gsap.set(".hero__reg", { opacity: 0, scale: 0.4 });
    gsap.set([".hero__blurb", ".hero__cta", ".hero__tags"], { opacity: 0, y: 24 });
    gsap.set([".hero__bottom"], { opacity: 0 });
    gsap.set(".nav", { opacity: 0, y: -18 });

    var seen = false;
    try { seen = sessionStorage.getItem("msSeen") === "1"; } catch (e) {}
    if (seen) {
      /* repeat visit in this session: straight to the hero */
      preloader.remove();
      startSite();
      buildHeroIntro();
    } else {
      runPreloader();
    }
    wireExtras();
  }

  function runPreloader() {
    var counter = { v: 0 };
    var fontsReady = (document.fonts && document.fonts.ready)
      ? Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 1600); })])
      : Promise.resolve();
    var countDone = new Promise(function (resolve) {
      gsap.to(counter, {
        v: 100, duration: 1.5, ease: "power2.inOut",
        onUpdate: function () {
          var v = Math.round(counter.v);
          num.textContent = v < 10 ? "0" + v : String(v);
          barFill.style.transform = "scaleX(" + counter.v / 100 + ")";
        },
        onComplete: resolve,
      });
    });

    Promise.all([fontsReady, countDone]).then(function () {
      var out = gsap.timeline({
        onComplete: function () { preloader.remove(); },
      });
      out.to([".preloader__name", ".preloader__count"], {
            yPercent: -40, opacity: 0, duration: 0.5, ease: "power2.in", stagger: 0.06,
          })
         .to(preloader, { yPercent: -100, duration: 0.9, ease: "expo.inOut" }, "-=0.15")
         .add(function () {
           startSite();
           buildHeroIntro();
           try { sessionStorage.setItem("msSeen", "1"); } catch (e) {}
         }, "-=0.55");
    });
  }

  /* sound toggle, rail highlighting, tab-title wink, logo easter egg */
  function wireExtras() {
    var soundBtn = $(".nav__sound");
    if (soundBtn && window.__SOUND__) {
      var paint = function (on) {
        soundBtn.setAttribute("aria-pressed", on ? "true" : "false");
        soundBtn.querySelector("span").textContent = on ? "[on]" : "[off]";
      };
      paint(window.__SOUND__.enabled());
      soundBtn.addEventListener("click", function () {
        paint(window.__SOUND__.toggle());
      });
    }

    var railMap = {};
    $$(".rail a").forEach(function (a) { railMap[a.getAttribute("data-rail")] = a; });
    [["about", "#about"], ["journey", "#journey"], ["work", "#work"], ["process", "#process"],
     ["services", "#services"], ["contact", "#contact"]].forEach(function (pair) {
      var link = railMap[pair[0]];
      var el = $(pair[1]);
      if (!link || !el) return;
      ScrollTrigger.create({
        trigger: el,
        start: "top 55%",
        end: "bottom 45%",
        onToggle: function (self) { link.classList.toggle("is-active", self.isActive); },
      });
    });

    var baseTitle = document.title;
    document.addEventListener("visibilitychange", function () {
      document.title = document.hidden ? "\u2726 come back" : baseTitle;
    });

    var logo = $(".nav__logo");
    var clicks = 0, timer = null;
    if (logo) logo.addEventListener("click", function () {
      clicks++;
      clearTimeout(timer);
      timer = setTimeout(function () { clicks = 0; }, 700);
      if (clicks >= 3) {
        clicks = 0;
        if (window.__GALLERY__ && window.__GALLERY__.spin) window.__GALLERY__.spin();
      }
    });
  }
  if (reduced) wireExtras();

  /* ----------------------------------------------------------
     hero ↔ WebGL scene wiring + content parallax
     ---------------------------------------------------------- */
  ScrollTrigger.create({
    trigger: ".hero",
    start: "top bottom",
    end: "bottom top",
    onToggle: function (self) {
      if (window.__HERO_SCENE__) window.__HERO_SCENE__.setVisible(self.isActive);
    },
  });

  if (!reduced) {
    ScrollTrigger.create({
      trigger: ".hero",
      start: "top top",
      end: "bottom top",
      scrub: true,
      onUpdate: function (self) {
        if (window.__HERO_SCENE__) window.__HERO_SCENE__.setScroll(self.progress);
      },
    });

    gsap.to(".hero__content", {
      yPercent: -14, opacity: 0.15, ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom 30%", scrub: true },
    });
  }

  /* ----------------------------------------------------------
     nav: blur after scroll, hide on scroll down
     ---------------------------------------------------------- */
  var nav = $(".nav");
  ScrollTrigger.create({
    start: 0,
    end: "max",
    onUpdate: function (self) {
      var y = self.scroll();
      nav.classList.toggle("nav--scrolled", y > 60);
      if (body.classList.contains("menu-open")) return;
      if (self.direction === 1 && y > 400) nav.classList.add("nav--hidden");
      else nav.classList.remove("nav--hidden");
    },
  });

  /* ----------------------------------------------------------
     fullscreen menu
     ---------------------------------------------------------- */
  var burger = $(".nav__burger");
  var menu = $(".menu");
  var menuTl = gsap.timeline({
    paused: true,
    onReverseComplete: function () { gsap.set(menu, { visibility: "hidden" }); },
  });
  menuTl
    .set(menu, { visibility: "visible" })
    .fromTo(".menu__bg",
      { clipPath: "inset(0 0 100% 0)" },
      { clipPath: "inset(0 0 0% 0)", duration: 0.65, ease: "expo.inOut" })
    .fromTo(".menu__links a",
      { y: 70, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, stagger: 0.07, ease: "power3.out" }, "-=0.2")
    .fromTo(".menu__meta",
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, "-=0.35");

  function openMenu() {
    body.classList.add("menu-open");
    burger.setAttribute("aria-label", "Close menu");
    burger.setAttribute("aria-expanded", "true");
    menu.setAttribute("aria-hidden", "false");
    if (lenis) lenis.stop();
    if (reduced) { gsap.set(menu, { visibility: "visible" }); menuTl.progress(1); }
    else menuTl.timeScale(1).play();
  }
  function closeMenu() {
    body.classList.remove("menu-open");
    burger.setAttribute("aria-label", "Open menu");
    burger.setAttribute("aria-expanded", "false");
    menu.setAttribute("aria-hidden", "true");
    if (lenis && !body.classList.contains("is-loading")) lenis.start();
    if (reduced) { menuTl.progress(0); gsap.set(menu, { visibility: "hidden" }); }
    else menuTl.timeScale(1.35).reverse();
  }
  burger.addEventListener("click", function () {
    body.classList.contains("menu-open") ? closeMenu() : openMenu();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (body.classList.contains("menu-open")) closeMenu();
  });

  /* ----------------------------------------------------------
     custom cursor + magnetic elements (fine pointers only)
     ---------------------------------------------------------- */
  if (finePointer && !reduced) {
    document.documentElement.classList.add("has-cursor");
    var dot = $(".cursor__dot");
    var ring = $(".cursor__ring");
    var label = $(".cursor__label");
    gsap.set([dot, ring], { xPercent: -50, yPercent: -50, x: -100, y: -100 });

    var dotX = gsap.quickTo(dot, "x", { duration: 0.1, ease: "power3" });
    var dotY = gsap.quickTo(dot, "y", { duration: 0.1, ease: "power3" });
    var ringX = gsap.quickTo(ring, "x", { duration: 0.45, ease: "power3" });
    var ringY = gsap.quickTo(ring, "y", { duration: 0.45, ease: "power3" });

    window.addEventListener("mousemove", function (e) {
      dotX(e.clientX); dotY(e.clientY);
      ringX(e.clientX); ringY(e.clientY);
    }, { passive: true });

    document.addEventListener("mouseover", function (e) {
      var labelled = e.target.closest("[data-cursor]");
      var interactive = e.target.closest("a, button, .svc__row");
      if (labelled) {
        label.textContent = labelled.getAttribute("data-cursor");
        ring.classList.add("has-label");
        ring.classList.remove("is-active");
      } else if (interactive) {
        ring.classList.add("is-active");
        ring.classList.remove("has-label");
      } else {
        ring.classList.remove("is-active", "has-label");
      }
    });

    document.documentElement.addEventListener("mouseleave", function () {
      gsap.to([dot, ring], { opacity: 0, duration: 0.25 });
    });
    document.documentElement.addEventListener("mouseenter", function () {
      gsap.to([dot, ring], { opacity: 1, duration: 0.25 });
    });

    /* magnetic pull */
    $$("[data-magnetic]").forEach(function (el) {
      var strength = 28;
      el.addEventListener("mousemove", function (e) {
        var r = el.getBoundingClientRect();
        var relX = (e.clientX - r.left) / r.width - 0.5;
        var relY = (e.clientY - r.top) / r.height - 0.5;
        gsap.to(el, { x: relX * strength, y: relY * strength, duration: 0.5, ease: "power3.out" });
      });
      el.addEventListener("mouseleave", function () {
        gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: "elastic.out(1, 0.4)" });
      });
    });
  }

  /* ----------------------------------------------------------
     marquee - infinite loop, speed reacts to scroll velocity
     ---------------------------------------------------------- */
  if (!reduced) {
    var marqueeTween = gsap.to(".marquee__track", {
      xPercent: -50, ease: "none", duration: 24, repeat: -1,
    }).pause();
    /* only animate while the strip is actually on screen */
    ScrollTrigger.create({
      trigger: ".marquee",
      start: "top bottom",
      end: "bottom top",
      onToggle: function (self) {
        if (self.isActive) marqueeTween.play();
        else marqueeTween.pause();
      },
    });
    var calmDown = gsap.delayedCall(0.5, function () {
      gsap.to(marqueeTween, { timeScale: 1, duration: 1.2, overwrite: true });
    }).pause();
    ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: function (self) {
        /* direct set - no tween allocation on every scroll tick */
        gsap.killTweensOf(marqueeTween);
        marqueeTween.timeScale(1 + Math.min(Math.abs(self.getVelocity()) / 1100, 3.5));
        calmDown.restart(true);
      },
    });
  }

  /* ----------------------------------------------------------
     about - manifesto word scrub + stat counters
     ---------------------------------------------------------- */
  var manifestoWords = splitWords($(".manifesto"));
  if (!reduced) {
    gsap.fromTo(manifestoWords,
      { opacity: 0.13 },
      {
        opacity: 1, stagger: 0.04, ease: "none",
        scrollTrigger: { trigger: ".manifesto", start: "top 78%", end: "bottom 45%", scrub: true },
      });
  }

  $$(".stat__num").forEach(function (el) {
    var target = parseFloat(el.getAttribute("data-count"));
    if (reduced) { el.textContent = String(target); return; }
    var obj = { v: 0 };
    gsap.to(obj, {
      v: target, duration: 1.6, ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 88%", once: true },
      onUpdate: function () { el.textContent = String(Math.round(obj.v)); },
    });
  });

  /* ----------------------------------------------------------
     generic reveals (services, awards, section heads, stats…)
     ---------------------------------------------------------- */
  if (!reduced) {
    var revealGroups = [
      { items: $$(".section__head"), y: 26 },
      { items: $$(".svc__row"), y: 46 },
      { items: [$(".footer__mail"), $(".footer__grid"), $(".footer__bottom")].filter(Boolean), y: 30 },
    ];
    revealGroups.forEach(function (group) {
      gsap.set(group.items, { opacity: 0, y: group.y });
      ScrollTrigger.batch(group.items, {
        start: "top 88%",
        once: true,
        onEnter: function (batch) {
          gsap.to(batch, {
            opacity: 1, y: 0, duration: 0.9, stagger: 0.09, ease: "power3.out",
            overwrite: true,
          });
        },
      });
    });

    /* footer headline chars */
    footerLineChars.forEach(function (chars) {
      gsap.set(chars, { yPercent: 115 });
      gsap.to(chars, {
        yPercent: 0, duration: 1.0, stagger: 0.025, ease: "power4.out",
        scrollTrigger: { trigger: ".footer__title", start: "top 85%", once: true },
      });
    });
  }

  /* ----------------------------------------------------------
     editorial break - About flips the whole page to warm paper.
     GSAP tweens the design tokens themselves.
     ---------------------------------------------------------- */
  var THEMES = {
    dark: {
      "--bg": "#0b0b0d", "--text": "#efede6", "--muted": "#8d8d97",
      "--line": "rgba(239,237,230,0.12)", "--line-soft": "rgba(239,237,230,0.07)",
      "--accent-text": "#d2ff3b", "--stroke": "rgba(239,237,230,0.5)",
      "--nav-bg": "rgba(11,11,13,0.88)", "--cursor-ring": "rgba(239,237,230,0.35)",
    },
    light: {
      "--bg": "#eceae2", "--text": "#16160f", "--muted": "#5d5d54",
      "--line": "rgba(22,22,15,0.2)", "--line-soft": "rgba(22,22,15,0.1)",
      "--accent-text": "#5a7607", "--stroke": "rgba(22,22,15,0.55)",
      "--nav-bg": "rgba(236,234,226,0.92)", "--cursor-ring": "rgba(22,22,15,0.4)",
    },
  };
  function setTheme(name) {
    gsap.to("html", Object.assign({ duration: 0.8, ease: "power2.inOut", overwrite: "auto" }, THEMES[name]));
  }
  if (!reduced) {
    ScrollTrigger.create({
      trigger: ".about",
      start: "top 62%",
      end: "bottom 38%",
      onEnter: function () { setTheme("light"); },
      onEnterBack: function () { setTheme("light"); },
      onLeave: function () { setTheme("dark"); },
      onLeaveBack: function () { setTheme("dark"); },
    });
  }

  /* ----------------------------------------------------------
     decode/scramble for mono micro-labels
     ---------------------------------------------------------- */
  function scrambleIn(el) {
    if (!el || reduced || el.children.length) return;
    var original = el.textContent;
    var glyphs = "▖▘▝▗#/\\|=+*-";
    var frame = 0;
    var total = Math.min(26, Math.max(14, Math.round(original.length * 0.8)));
    var iv = setInterval(function () {
      frame++;
      var settle = (frame / total) * original.length * 1.35;
      var out = "";
      for (var i = 0; i < original.length; i++) {
        var ch = original[i];
        if (ch === " ") { out += " "; continue; }
        out += i < settle ? ch : glyphs[(Math.random() * glyphs.length) | 0];
      }
      el.textContent = out;
      if (frame >= total) { el.textContent = original; clearInterval(iv); }
    }, 32);
  }
  $$(".section__hint").forEach(function (el) {
    if (el.children.length) return; // hints with markup keep their accents
    ScrollTrigger.create({
      trigger: el, start: "top 88%", once: true,
      onEnter: function () { scrambleIn(el); },
    });
  });

  /* ----------------------------------------------------------
     process - sticky cards stack; settled cards sink back
     ---------------------------------------------------------- */
  if (!reduced) {
    var pcards = $$(".pcard");
    pcards.forEach(function (card, i) {
      var next = pcards[i + 1];
      if (!next) return;
      gsap.to(card, {
        scale: 0.94,
        opacity: 0.45,
        transformOrigin: "center top",
        ease: "none",
        scrollTrigger: { trigger: next, start: "top 92%", end: "top 22%", scrub: true },
      });
    });
  }

  /* ----------------------------------------------------------
     kind words - drag strip with momentum + arrow nav
     ---------------------------------------------------------- */
  (function () {
    var scroller = $(".words__scroller");
    if (!scroller) return;
    var cards = $$(".tcard", scroller);

    if (!reduced) {
      gsap.set(cards, { opacity: 0, y: 44 });
      ScrollTrigger.create({
        trigger: scroller, start: "top 86%", once: true,
        onEnter: function () {
          gsap.to(cards, { opacity: 1, y: 0, duration: 0.9, stagger: 0.09, ease: "power3.out" });
        },
      });
    }

    var step = function () {
      var c = cards[0];
      return c ? c.offsetWidth + 18 : 420;
    };
    var prev = $("[data-words-prev]");
    var next = $("[data-words-next]");
    if (prev) prev.addEventListener("click", function () {
      scroller.scrollBy({ left: -step(), behavior: reduced ? "auto" : "smooth" });
    });
    if (next) next.addEventListener("click", function () {
      scroller.scrollBy({ left: step(), behavior: reduced ? "auto" : "smooth" });
    });

    /* mouse drag (touch already scrolls natively) */
    if (finePointer) {
      var down = false, startX = 0, startLeft = 0, lastX = 0, vel = 0;
      scroller.addEventListener("pointerdown", function (e) {
        if (e.pointerType !== "mouse") return;
        down = true;
        startX = lastX = e.clientX;
        startLeft = scroller.scrollLeft;
        vel = 0;
        scroller.classList.add("is-dragging");
        scroller.setPointerCapture(e.pointerId);
        gsap.killTweensOf(scroller);
      });
      scroller.addEventListener("pointermove", function (e) {
        if (!down) return;
        scroller.scrollLeft = startLeft - (e.clientX - startX);
        vel = e.clientX - lastX;
        lastX = e.clientX;
      });
      var endDrag = function () {
        if (!down) return;
        down = false;
        scroller.classList.remove("is-dragging");
        if (!reduced && Math.abs(vel) > 3) {
          gsap.to(scroller, { scrollLeft: scroller.scrollLeft - vel * 11, duration: 0.8, ease: "power3.out" });
        }
      };
      scroller.addEventListener("pointerup", endDrag);
      scroller.addEventListener("pointercancel", endDrag);
    }
  })();

  /* ----------------------------------------------------------
     footer scribble - draws itself in
     ---------------------------------------------------------- */
  (function () {
    var path = $(".footer__scribble path");
    if (!path) return;
    var len = path.getTotalLength();
    if (reduced) return;
    gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
    gsap.to(path, {
      strokeDashoffset: 0, duration: 1.2, ease: "power2.inOut", delay: 0.45,
      scrollTrigger: { trigger: ".footer__title", start: "top 85%", once: true },
    });
  })();

  /* ----------------------------------------------------------
     footer local time (Chennai)
     ---------------------------------------------------------- */
  var timeEl = document.getElementById("local-time");
  if (timeEl) {
    var fmt;
    try {
      fmt = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata", hour12: false,
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      });
    } catch (e) { fmt = null; }
    var tick = function () {
      timeEl.textContent = fmt ? fmt.format(new Date()) : new Date().toLocaleTimeString();
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ----------------------------------------------------------
     perf-lite - if this device can't hold a healthy frame rate,
     shed the expensive layers and fall back to native scroll
     ---------------------------------------------------------- */
  var perfLite = false;
  function engagePerfLite() {
    if (perfLite) return;
    perfLite = true;
    document.documentElement.classList.add("perf-lite");
    if (lenis) {
      gsap.ticker.remove(lenisTick);
      lenis.destroy();
      lenis = null;
      if (window.__SITE__) window.__SITE__.lenis = null;
    }
    window.dispatchEvent(new CustomEvent("perf-lite")); /* canvases drop to DPR 1 */
    ScrollTrigger.refresh();
  }

  function sampleFps() {
    if (document.hidden) { gsap.delayedCall(3, sampleFps); return; }
    var frames = 0;
    var t0 = performance.now();
    function tick(now) {
      frames++;
      if (now - t0 < 1500) requestAnimationFrame(tick);
      else if (frames / ((now - t0) / 1000) < 42) engagePerfLite();
    }
    requestAnimationFrame(tick);
  }
  if (!reduced) {
    if (/perf-?lite/i.test(location.search)) gsap.delayedCall(0.2, engagePerfLite);
    else gsap.delayedCall(2.6, sampleFps);
  }

  /* shared hooks for gallery.js */
  window.__SITE__ = { lenis: lenis, reduced: reduced, finePointer: finePointer };

  /* keep measurements honest once everything has loaded */
  window.addEventListener("load", function () { ScrollTrigger.refresh(); });
})();
