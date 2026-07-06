# Motion

The scroll engine, how a chapter's motion is described, and the ambient background.

---

## The scroll engine

**Native scroll, never hijacked.** The page has real scrollable height. We use GSAP
**ScrollTrigger** with **scrub** so that the visual effect (a chapter holds while its
content reveals, then its paper flies away as the next arrives) is driven by **scroll
progress** — not by intercepting wheel or touch events. This keeps keyboard navigation,
momentum, and mobile behavior intact, and lets us honor reduced-motion cleanly.

`engine.ts` responsibilities:

- Read the active page's chapter list (from `pages.ts`).
- Compute scroll geometry: each chapter gets a beats-dwell window then a fly-away window.
- Build scrubbed ScrollTriggers for fly-aways, color morphs, and beats.
- Do nothing on pages where `useScrollEngine: false`.

The engine knows only "things that enter and leave on scroll." It does not know what a
paper is. (See `architecture.md` → the engine's contract.)

---

## Scroll geometry

For each chapter, in order:

1. **Beats dwell** (`durationBeats` beats, default 1 if a `beats` function is present,
   0 otherwise) — the chapter is visually frontmost (fixed layers handle this implicitly);
   the beats timeline scrubs across this window.
2. **Fly-away** (`chapterExitBeats` = 1.5 beats) — the paper element animates off the
   top; the next chapter is revealed beneath.

`durationBeats` is **in beats** — the same unit as everything else in a chapter's
`motion.ts`. The engine converts to px internally; you never write raw vh or px here.
Chapters with no `paper` motion skip phase 2; `durationBeats` still works without a
`beats` function (useful to hold a chapter static for extra scroll distance).

All ScrollTrigger start/end positions in the engine use arrow functions that compute
px at trigger time (`() => slot.flyStart * window.innerHeight / 100`). GSAP does not
parse `vh` in position strings — it strips the unit suffix and treats the number as raw
px, which would make all scroll ranges wildly wrong.

---

## A chapter's motion: three tracks

Each chapter's `motion.ts` can declare up to three tracks plus a duration:

- **paper** — the foreground rectangle's fly-away. Omit for paperless chapters or a
  chapter that stays on screen (e.g. the last chapter).
- **content** — the markup inside the paper (optional; rides with paper by default).
- **beats** — a function that builds a scrubbed GSAP timeline for intra-chapter reveals.
- **durationBeats** — how many beats this chapter's dwell window occupies (in beats).
  Default: 1 when `beats` is present, 0 otherwise. Works without a `beats` function.

Always type the export as `ChapterMotion` so TypeScript surfaces all available fields:

```ts
import type { ChapterMotion } from "../../../motion/engine";
import { flyUpAccelerate } from "../../../motion/presets";

const motion: ChapterMotion = {
  paper: flyUpAccelerate(), // fly-away
  durationBeats: 2, // hold for 2 beats before the fly-away begins
  // content: fadeIn({ delay: 0.2 }),   // optional content offset
};

export default motion;
```

---

## Presets: `src/motion/presets.ts`

### Paper presets

- `flyUpAccelerate()` — default paper exit: slow lift, rapid acceleration off top.
- `paperRise()` — paper entering from below into resting position.
- `fadeIn({ delay })` — content easing in, optionally offset from its paper.

### Beat presets

Used inside a chapter's `beats()` function to build the scrubbed reveals:

- `fadeInUpFrom()` — initial state: hidden, 40 px below. Pass as `from` in `fromTo()`.
- `fadeInUpTo()` — final state: visible, at natural position. Pass as `to` in `fromTo()`.
- `shiftUp(distance?)` — shift element upward from its current position (default 36 px).
  Use to move a prior beat up while the next one appears.

Example beats timeline:

```ts
import gsap from "gsap";
import { fadeInUpFrom, fadeInUpTo, shiftUp } from "../../../motion/presets";

beats(container) {
  const a = container.querySelector("[data-beat='a']");
  const b = container.querySelector("[data-beat='b']");
  const tl = gsap.timeline();

  tl.fromTo(a, fadeInUpFrom(), fadeInUpTo(), 0);      // beat 1: A rises in
  tl.fromTo(b, fadeInUpFrom(), fadeInUpTo(), 0.55);   // beat 2: B fades in …
  tl.to(a, shiftUp(), 0.55);                          //         … while A shifts up

  return tl;
},
durationBeats: 1.5,    // beats allocated to this chapter's dwell window
```

Mark beat elements in the DOM with `data-beat="a"`, `data-beat="b"`, etc. so the
`beats` function can select them.

---

## Midground color morph

Each chapter declares its midground color via a CSS palette token in `pages.ts`.
As the outgoing chapter flies away, the engine scrubs `--color-midground` from the
outgoing chapter's color to the incoming chapter's color.

**Technique:** a proxy `{ t: 0 }` is tweened 0→1 with `scrub`. `onUpdate` calls
`gsap.utils.interpolate(colorA, colorB)(proxy.t)` and writes the result to
`--color-midground` on `:root`. `@property` was not used — GSAP scrub sets properties
directly (not via CSS transitions), so `@property` would add no benefit and would
require browser support checking.

`--color-nav-text: var(--color-midground)` in `global.css` means the nav color
tracks the morph automatically with no additional animation.

Palette tokens live in `global.css` under `/* Midground color palette */`:

```css
:root {
  --midground-tan: #cfc6b6;
  --midground-slate: #c1caca;
  --midground-slate-deep: #8a9ba5; /* chapter 2 beat-2 target */
}
```

Add new palette entries there; reference them in `pages.ts`.

### Intra-beat midground morphs

The same proxy technique works **inside a `beats()` timeline**, not just at chapter transitions. Add a `proxy` tween to the returned timeline at whatever beat position you need:

```ts
beats(container) {
  const proxy = { t: 0 };
  const interpolate = gsap.utils.interpolate(colorFrom, colorTo);
  const tl = gsap.timeline();

  // … content tweens …

  // Color morph tied to beat 2 (runs 0.55 → end alongside the content reveal)
  tl.fromTo(proxy, { t: 0 }, {
    t: 1,
    ease: "power1.inOut",
    onUpdate() {
      document.documentElement.style.setProperty("--color-midground", interpolate(proxy.t));
    },
  }, 0.55);

  return tl;
},
```

The engine's ScrollTrigger scrubs the entire returned timeline, including the color proxy tween. In reduced motion, `tl.progress(1)` applies the final color immediately, so white text remains legible on the darker background.

**Resolve palette colors at runtime** (not import time) so they stay single-sourced:

```ts
const style = getComputedStyle(document.documentElement);
const colorFrom = style.getPropertyValue("--midground-slate").trim();
const colorTo = style.getPropertyValue("--midground-slate-deep").trim();
```

---

## Reduced motion

All motion is wrapped in `gsap.matchMedia()`. When `prefers-reduced-motion: reduce`:

- No fly-aways, no scrub, no color morph.
- Beat timelines are advanced to `progress(1)` immediately so all beat content is
  visible in its final state.
- Content is always reachable and readable. Motion is a grace note, not a gate.

---

## The ambient mat

Separate from everything above. The midground mat's vertex wobble is a **continuous,
always-on** animation that lives in `octagon.ts` and runs regardless of scroll or which
chapter is showing (the mat persists in `Base.astro`).

### Structure

The mat is a `position: fixed; inset: 0` `<div>` (full viewport). Its visible shape
comes from `clip-path: path()` — a cubic-bezier path emitted by `octagon.ts` every
animation frame. The div itself has no inset gutter; all margins come from where the
vertex homes are placed.

### clip-path: path() — why and the key traps

`polygon()` supports only straight lines. Curves need `path()`, which accepts SVG cubic
beziers (`C`). Since `octagon.ts` already rewrites the clip string every frame for the
wobble, switching its _output_ from `polygon()` to `path()` is a contained change.

Two traps to keep in mind:

- **`path()` is px-only** — no `%`, no `calc()`, no `var()`. Every coordinate must be a
  computed px number. Responsiveness comes from recomputing on resize, not from the
  browser resolving `%`.
- **Don't parse custom-property strings for px values.** `getComputedStyle` returns the
  _unresolved_ string for a custom property (e.g. a `clamp()` expression), not px.
  Instead, measure by setting a probe `<div>`'s dimensions to the CSS vars and reading
  `getBoundingClientRect()` — letting the browser resolve the expression for you.

`Base.astro` keeps a `polygon()` static clip (using CSS vars) for the SSR / pre-JS
instant. Once `octagon.ts` runs it overwrites with the `path()` — the shapes are
identical, so there is no visible jump.

### Safe-area model

Each vertex home sits inset from its nearest edge by a side-specific token. In px
(after measurement at init / resize):

```
upperLeft:   ( insetX,      insetTop    )
upperCenter: ( W × 0.66,   insetTop    )
upperRight:  ( W − insetX,  insetTop    )
centerRight: ( W − insetX,  H × 0.5   )
lowerRight:  ( W − insetX,  H − insetBottom )
lowerCenter: ( W × 0.33,   H − insetBottom )
lowerLeft:   ( insetX,      H − insetBottom )
centerLeft:  ( insetX,      H × 0.5   )
```

**Invariant:** every `--mat-safe-inset-*` value must be >= `motionRadius`. Violation
causes edge clipping; `octagon.ts` logs a warning at init.

### Curved edges — `edgeCurve`

The four **center points** (upperCenter, centerRight, lowerCenter, centerLeft) have
symmetric, edge-parallel bezier handles. The **corners have none** (sharp joins).

- **Handle direction:** top/bottom centers → horizontal; left/right centers → vertical.
- **Handle length:** `edgeCurve × relevant-side` — width for top/bottom, height for
  left/right. Recomputed on resize.
- **Rigid with the vertex:** handles are offset from the center point's current position
  (home + wobble dx/dy), so they translate exactly with the vertex and never rotate or
  scale relative to it.
- **Corner control points** = the corner vertex itself → zero tangent at corners → sharp join.

The single dial is `edgeCurve` in `config/motion.ts` (default `0.035` = 3.5%).

Each edge becomes two cubic segments: `corner → C corner cp2=center−handle center` and
`center → C cp1=center+handle corner corner`. This gives a smooth bow peaking at the
center that straightens toward the corners.

### Animation model (random-circle wander)

Each vertex wanders continuously within a circle of radius `motionRadius` around its home.
Duration per leg varies by ±`LEG_SPEED_VARIANCE`; vertices start staggered so they are
always out of phase.

**Reduced motion:** `gsap.matchMedia()` skips all tweens; the rest-position `path()` is
written once at init and recomputed on resize.

### Measurement & resize (perf)

`octagon.ts` caches `W`, `H`, the resolved inset px values, and the computed handle lengths.
The per-frame wobble tick reads only from the cache — no `getBoundingClientRect` per frame
(that forces a layout every frame → jank). On resize (debounced 100 ms) the cache is
refreshed and the path redrawn.
