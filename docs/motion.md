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

1. **Beats dwell** (`beatDurationVH` vh, default 100) — the chapter is visually
   frontmost (fixed layers handle this implicitly); the beats timeline scrubs.
2. **Fly-away** (`TRAVEL_PER_CHAPTER_VH` = 150 vh) — the paper element animates off the
   top; the next chapter is revealed beneath.

Chapters with no beats skip phase 1; chapters with no `paper` motion skip phase 2.

---

## A chapter's motion: three tracks

Each chapter's `motion.ts` can declare up to three tracks:

- **paper** — the foreground rectangle's fly-away. Omit for paperless chapters or a
  chapter that stays on screen (e.g. the last chapter).
- **content** — the markup inside the paper (optional; rides with paper by default).
- **beats** — a function that builds a scrubbed GSAP timeline for intra-chapter reveals.

```ts
import { flyUpAccelerate } from "../../../motion/presets";

export default {
  paper: flyUpAccelerate(), // fly-away
  // content: fadeIn({ delay: 0.2 }),   // optional content offset
};
```

Or omit `motion.ts` fields entirely to inherit defaults.

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
beatDurationVH: 150,   // scroll travel for the beats window
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

The mat is a `position: fixed; inset: 0` `<div>` (full viewport). Its visible shape and
margins come entirely from a `clip-path: polygon()` whose eight vertices are placed inward
from the div edges by the `--mat-safe-inset-*` CSS tokens. The div itself has no inset
gutter — that concern belongs to the vertex homes, not the container.

### Safe-area model

Each vertex home sits inset from its nearest edge by a side-specific token:

```
upperLeft:   ( var(--mat-safe-inset-x),               var(--mat-safe-inset-top)    )
upperCenter: ( 66%,                                    var(--mat-safe-inset-top)    )
upperRight:  ( calc(100% - var(--mat-safe-inset-x)),   var(--mat-safe-inset-top)    )
centerRight: ( calc(100% - var(--mat-safe-inset-x)),   50%                          )
lowerRight:  ( calc(100% - var(--mat-safe-inset-x)),   calc(100% - var(--mat-safe-inset-bottom)) )
lowerCenter: ( 33%,                                    calc(100% - var(--mat-safe-inset-bottom)) )
lowerLeft:   ( var(--mat-safe-inset-x),               calc(100% - var(--mat-safe-inset-bottom)) )
centerLeft:  ( var(--mat-safe-inset-x),               50%                          )
```

**Invariant:** every `--mat-safe-inset-*` value must be >= `motionRadius`. Violation
causes edge clipping; `octagon.ts` logs a warning at init.

### Animation model (random-circle wander)

Each vertex wanders continuously within a circle of radius `motionRadius` around its home.
Duration per leg varies by ±`LEG_SPEED_VARIANCE`; vertices start staggered so they are
always out of phase.

**Reduced motion:** `gsap.matchMedia()` skips all tweens; vertices hold their home positions.

### One source, no drift

`octagon.ts` reads `--mat-safe-inset-*` via `getComputedStyle` at init. The static
clip-path in `Base.astro` uses the same tokens via `var()`. Both resolve identically.
