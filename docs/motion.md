# Motion

The scroll engine, how a chapter's motion is described, and the ambient background.

---

## The scroll engine

**Native scroll, never hijacked.** The page has real scrollable height. We use GSAP
**ScrollTrigger** with **scrub** so that the visual effect (a chapter holds while its
content reveals, then its paper flies away as the next arrives) is driven by **scroll
progress** — not by intercepting wheel or touch events. This keeps keyboard navigation,
momentum, and mobile behavior intact, and lets us honor reduced-motion cleanly.

`engine.ts` (`initPageEngine`) responsibilities:

- Read the active page's config (from `pages.ts`) and its page script (e.g.
  `home.script.ts`, authored with `page-script.ts`'s `definePageScript`/`at()`).
- Resolve the page script into placed moments (`chapter`, `enter`, `exit`, `morph`,
  `hold`, `show`, `hide`) at page-absolute beats — this replaces the old fixed
  per-chapter dwell-then-fly formula; scroll geometry is now _derived from what the
  script places_, not computed from constants.
- Compile the resolved script into **one master GSAP timeline** and scrub it with a
  **single ScrollTrigger** over the page's total scroll height (`script.totalBeats × vhPerBeat`).
- Do nothing on pages where `useScrollEngine: false`, or that never call `initPageEngine`.

The engine knows only "things that enter and leave on scroll." It does not know what a
paper is. (See `architecture.md` → the engine's contract.)

---

## Scroll geometry

Geometry is authored, not computed from fixed constants — it comes directly from where
things are placed in the page script (`src/motion/home.script.ts`, using the `at()` /
`chapter()` / `enter()` / `exit()` vocabulary from `src/motion/page-script.ts`):

```ts
export const PAGE = definePageScript({
  sequence: [
    at(0, chapter("intro")), // intro's dwell window: 0 beats
    at(0, exit("intro", { over: 1 })), // intro's paper flies off over 1 beat
    at(0.75, enter("services", { over: 0.75 })), // services' paper rises in
    at(2.0, exit("services", { over: 1 })),
    at(3, chapter("timeline", { dwellBeats: 14.4 })),
    at(16.4, hold(1)), // trailing rest
  ],
});
```

- **`chapter(id, { dwellBeats })`** places a chapter's dwell window at a page-absolute
  beat. During that window the chapter's own `beats()` timeline (from its `motion.ts`) is
  scrubbed, chapter-relative. `dwellBeats` defaults to 0 for chapters with no beats.
- **`exit(id, { over, to?, ease? })`** / **`enter(id, { over, from?, ease? })`** animate a
  chapter's `[data-chapter]` paper off/on screen. Defaults come from `scroll.flyUp` in
  `config/scroll.ts` (`distance: 110vh`, `ease: "power2.in"`) unless overridden.
- **`morph({ from, to, over })`** and **`hold(beats)`** place a color morph or dead air at
  an absolute beat — see **Midground color morph** below.

The engine (`buildModelFromPageScript` in `engine.ts`) reads these placements back out to
build each chapter's `scrollVH` window for `ScrollTrigger` and devtools — there is no
separate slot-accumulator pass; the resolved script _is_ the geometry.

All ScrollTrigger start/end positions in the engine use arrow functions that compute
px at trigger time (`() => vhToPx(totalVH)`). GSAP does not parse `vh` in position
strings — it strips the unit suffix and treats the number as raw px, which would make all
scroll ranges wildly wrong.

---

## A chapter's motion: two fields

A chapter's `motion.ts` is much smaller than the page script it's placed by. It declares
only:

- **beats** — an optional function that builds a scrubbed GSAP timeline for intra-chapter
  reveals. Receives the `[data-chapter]` container and the chapter's `ChapterBeats` (for
  devtools). Omit for chapters with no intra-chapter reveals.
- **schedule** — an optional pre-resolved event schedule (built with `resolveSchedule()` in
  `timeline-kit.ts`) for the `?beats` devtools HUD. Omit for scriptless chapters.

Everything about _where a chapter sits on the page_ — its dwell length, when its paper
flies away, when it enters — is authored in the page script instead (`chapter()`, `enter()`,
`exit()` in `home.script.ts`; see **Scroll geometry** above), not here. This is the
two-level model from Epic 15: chapter scripts stay chapter-relative; only the page script
knows where chapters sit.

Always type the export as `ChapterMotion` so TypeScript surfaces all available fields:

```ts
import type { ChapterMotion } from "../../../motion/engine";
import { compile, resolveSchedule } from "../../../motion/timeline-kit";
import { SCRIPT } from "./script";

const motion: ChapterMotion = {
  schedule: import.meta.env.DEV ? resolveSchedule(SCRIPT) : undefined,
  beats(container, chapterBeats) {
    return compile(container, SCRIPT, chapterBeats);
  },
};

export default motion;
```

A chapter with no intra-chapter reveals at all (just a paper that arrives and later flies
away) exports an empty `{}` — see `chapters/home/intro/motion.ts`.

---

## Presets: `src/motion/presets.ts`

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
// dwell length for this window is set where the chapter is placed in the page
// script — e.g. at(0, chapter("intro", { dwellBeats: 1.5 })) — not here.
```

Mark beat elements in the DOM with `data-beat="a"`, `data-beat="b"`, etc. so the
`beats` function can select them.

---

## Midground color morph

Color choreography is authored explicitly in the page script (or a chapter's own
`script.ts`, for an intra-chapter morph) as a `morph({ from, to, over })` moment placed
with `at()` — it's no longer a static field a chapter declares. As the moment plays, the
engine scrubs `--color-mat` (not `--color-midground`) from one palette token's resolved
color to another's:

```ts
at(0, morph({ from: "--palette-tan", to: "--palette-yellow", over: 1 })),
```

**Technique:** a proxy `{ t: 0 }` is tweened 0→1 with `scrub`. `onUpdate` calls
`gsap.utils.interpolate(colorA, colorB)(proxy.t)` and writes the result to
`--color-mat` on `:root`. `@property` was not used — GSAP scrub sets properties
directly (not via CSS transitions), so `@property` would add no benefit and would
require browser support checking. This compiler lives in `page-script.ts`'s `morph` case
(page scope) and `timeline-kit.ts`'s `morph` case (chapter scope) — both write the same
property via the same technique.

`--color-nav-text: var(--color-mat)` in `global.css` means the nav color
tracks the morph automatically with no additional animation.

Palette tokens live in `global.css`'s `:root` block under `/* Color palette */`:

```css
:root {
  --palette-tan: #cfc6b6;
  --palette-sage: #d9dccc;
  --palette-yellow: #e6d063;
  --palette-slate: #8a9ba5;
  /* … */
}
```

Add new palette entries there; reference them by name in a `morph()` moment.

### Intra-beat midground morphs

`timeline-kit.ts` already provides a `morph({ from, to, over })` moment for a chapter's own
`sequence` — reach for that first (see `script.ts` examples in `chapters/home/timeline/`).
The same proxy technique it uses can also be hand-rolled directly **inside a `beats()`
timeline**, for cases outside that DSL. Add a `proxy` tween to the returned timeline at
whatever beat position you need:

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
      document.documentElement.style.setProperty("--color-mat", interpolate(proxy.t));
    },
  }, 0.55);

  return tl;
},
```

The engine's ScrollTrigger scrubs the entire returned timeline, including the color proxy tween. In reduced motion, `tl.progress(1)` applies the final color immediately, so white text remains legible on the darker background.

**Resolve palette colors at runtime** (not import time) so they stay single-sourced:

```ts
const style = getComputedStyle(document.documentElement);
const colorFrom = style.getPropertyValue("--palette-slate").trim();
const colorTo = style.getPropertyValue("--palette-blue").trim();
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

The single dial is `edgeCurve` in `config/octagon.ts` (default `0.035` = 3.5%).

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
