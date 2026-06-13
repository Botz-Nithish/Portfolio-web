# NITHISH RAO® — Portfolio Landing Page

An awwwards-style portfolio for Nithish Rao Perumenki, a full-stack developer
with a creative-front-end edge. Dark editorial aesthetic with a scroll-triggered
light "editorial break", lime signal accent, Clash Display + Satoshi + Instrument
Serif italics, a Three.js shader hero, an inside-a-sphere WebGL project gallery,
and GSAP-driven scroll choreography.

Contact/identity, the 8 real projects, and the CV (`assets/cv.pdf`) are wired in.
To deploy: make `og:image` an absolute URL, and replace project artwork with real
media per the steps below.

## Adding your real project media

Drop files into `assets/projects/` (GIF, PNG, JPG, WebP, MP4 or WebM), then
register each one in the `PROJECTS` array in `js/gallery.js`:

```js
{ slug: "lumen", media: "assets/projects/lumen.gif", title: "LUMEN", ... }
```

- **GIF / image** → the gallery tile shows it (first frame for GIFs, captions
  re-baked on top) and the project page plays the full animated file.
- **MP4 / WebM** → the project page plays it in a muted looping `<video>`;
  add `poster: "assets/projects/lumen.jpg"` for the tile, otherwise the tile
  keeps its generated artwork.
- Recommended: square-ish crop, ≥ 800 px, 2–6 s loops, under ~3 MB each.
  Projects without `media` keep their procedural artwork, so you can migrate
  one at a time.

## Run it

Any static server works — no build step:

```bash
python -m http.server 4173
# → http://127.0.0.1:4173/
```

## Stack

| Layer | Choice |
|---|---|
| 3D / WebGL | Three.js r128 — fullscreen quad, custom domain-warped fbm "aurora" shader |
| Animation | GSAP 3.12 + ScrollTrigger (CDN) |
| Smooth scroll | Lenis 1.1 |
| Type | Clash Display + Satoshi (Fontshare), Instrument Serif italic (Google) |
| Everything else | Hand-rolled HTML/CSS/JS — zero build tooling, zero images (all visuals are CSS/SVG) |

## Experience map

- **Preloader** — counter + progress bar, gated on `document.fonts.ready`, curtain lift into the hero
- **Hero** — mouse-reactive WebGL aurora (DPR-capped, pauses off-screen), char-staggered headline, scramble-decoded micro-labels, lime CTA + ghost CTA, parallax exit
- **Marquee** — infinite loop, speed reacts to scroll velocity; alternates outlined caps with serif italics
- **About — the editorial break** — the entire page tweens its design tokens to warm cream and back (GSAP animating CSS custom properties via ScrollTrigger); scroll-scrubbed manifesto with serif accent words, count-up stats
- **Selected Work — the sphere gallery** (phantom.land-style) — you stand *inside* a sphere tiled with 64 project cards (12 projects, artwork generated on canvas with baked mono captions). Left-click-drag to look around with eased inertia, then the nearest tile **magnetically snaps to centre**; tiles **squash and stretch** with drag velocity and the camera **dollies** while you drag. Page scroll sweeps the wall while the section is pinned; tiles dim with angle; hover scales the card and the cursor says "View". Arrow keys step one tile at a time, Enter opens the centred project, an `aria-live` region announces it. WebGL failure falls back to a plain list
- **FLIP project transition** — clicking a tile makes its artwork **fly from its exact spot on the sphere into the project hero** while the page fades in around it; closing flies it back to wherever the tile has rotated to. Focus-trapped dialog with Escape close and focus restoration
- **Sound design** — synthesized Web Audio (no files): hover ticks, snap clicks, open/close whooshes and a faint drone. **Off by default**, toggled in the nav, preference persisted
- **Job-hunt practicals** — `assets/og-image.png` + Twitter card meta for link previews (regenerate after personalising; make the URL absolute when deployed), a downloadable CV button in the nav (`assets/cv.pdf` is a placeholder), the preloader skips on repeat visits in a session, and a section index rail tracks your position (desktop)
- **Process** — sticky stacking cards (Discover → Define → Design → Deliver); settled cards scale back and dim as the next arrives
- **Kind Words** — drag-to-explore testimonial strip: pointer drag with momentum on desktop, native touch scroll on mobile, arrow buttons + keyboard for everyone else
- **Recognition / Contact** — hover-flood rows; footer headline mixes caps with serif italic, a lime scribble underline draws itself in, magnetic mail button, live Tokyo clock
- **Chrome** — custom cursor with contextual labels ("View", "Drag", "Say hi"), hide-on-scroll nav, fullscreen menu, film grain

## Accessibility & resilience

- `prefers-reduced-motion`: smooth scroll, marquee, cursor, theme flip, scramble and all reveals disabled; shader renders one static frame; case overlay opens instantly
- Case overlay: `role="dialog"` + `aria-modal`, focus trap, Escape close, opener focus restored
- Testimonial strip is a real scroll region (`tabindex` + arrow keys); drag is an enhancement
- No-JS: `<noscript>` removes the preloader/canvas, full content remains readable
- Skip link, focus-visible styles, semantic landmarks, aria states on menu controls
- WebGL failure / context loss degrades to the CSS gradient backdrop

## Verified (headless Chrome — see `.dev/`)

- Desktop 1440×900 & mobile 390×844: **0 console errors, 0 failed requests, 0 horizontal overflow**
- Sphere gallery: scroll sweeps yaw, mouse drag + fling rotates, keyboard rotates, click/tap opens the project page (desktop, mobile and reduced-motion), Escape closes and restores scroll
- Mobile: horizontal pan rotates the wall while vertical swipes still scroll the page (`touch-action: pan-y`)
- Theme flips to `rgb(236,234,226)` inside About, back to `rgb(11,11,13)` outside — and stays dark under reduced motion
- Drag strip: arrow buttons scroll one card; mouse drag + momentum verified
- Page weight: ~282 KB transferred / 11 requests, DCL ~900 ms

## Performance budget

Every continuous cost is bounded: the grain overlay is a 1.2×-viewport layer
(not 9×), the nav uses an opaque bar instead of `backdrop-filter`, the marquee
pauses off-screen and never allocates tweens on scroll, both WebGL canvases
cap DPR (1.5 desktop / ≤1.2 mobile, hero shader runs 3-octave noise) and pause
when out of view, and all gallery GPU uploads happen behind the preloader.

**Auto perf-lite:** ~2.6 s after load the site samples its real frame rate;
under 42 fps it sheds the grain, destroys Lenis (native scroll), and drops
both canvases to DPR 1. Force it for testing with `?perf-lite` in the URL.

`.dev/` holds the Playwright verification scripts (`node .dev/verify.js`,
`node .dev/final-check.js`) and screenshots; it is tooling only and can be
deleted without affecting the site.
