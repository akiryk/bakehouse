# Motion

The scroll engine, how a chapter's motion is described, and the ambient background.

---

## The scroll engine

**Native scroll, never hijacked.** The page has real scrollable height. We use GSAP
**ScrollTrigger** with **scrub** so that the visual effect (a chapter holds while its
content reveals, then its paper flies away as the next arrives) is driven by **scroll
progress** — not by intercepting wheel or touch events. This keeps keyboard navigation,
momentum, and mobile behavior intact, and lets us honor reduced-motion cleanly.

`components/scroll-engine/motion-script.ts` (`initPageEngine`) responsibilities:

- Read the active page's config (from `page-system/config.ts`) and its page script (e.g.
  `pages/home/motion-script.ts`, authored with `page-system/motion-script.ts`'s
  `definePageScript`/`at()`).
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

## Calling `initPageEngine` under the SPA router — `global-scripts/page-init.ts`

`initPageEngine` needs to run **on every visit to a page**, including a _repeat_ visit in
the same browser session (Home → About → Home) — the site navigates via Astro's
`<ClientRouter />` (see `docs/navigation.md` and the page-transitions epic), not full
reloads, and each navigation discards the previous page's spacer/ScrollTrigger along with
its non-persisted DOM.

**The obvious approach doesn't work.** Each page used to call `initPageEngine` from its own
bundled `<script>` tag. Astro's router never re-executes a `<script>` whose exact text it's
already run once in the session (`detectScriptExecuted` in
`node_modules/astro/dist/transitions/swap-functions.js`) — so a _second_ visit to a page
silently skipped `initPageEngine` entirely: no spacer, no scroll height, "scrolling doesn't
work." This is real, not theoretical — it shipped and was caught by manual testing, not by
`astro check` or any of the automated verification.

Astro's documented escape hatch, `data-astro-rerun`, turns out to be **incompatible with
bundled/TypeScript scripts entirely** (confirmed via `astro check`'s own diagnostics, not
assumed from docs):

- Any `<script>` with inline content **and any attribute other than `src`** is silently
  forced into unprocessed `is:inline` treatment — no `import`, no TypeScript.
- The compiler explicitly rejects combining `data-astro-rerun` with `src` on the same tag:
  _"Two out of three is OK: `type="module"`, `src`, or `data-astro-rerun`."_

So there's no way to give a bundled, import-using script tag `data-astro-rerun` at all.

**The fix: centralize.** `src/global-scripts/page-init.ts` exports one function per page
(`initHomePage()`, `initAboutPage()`) — ordinary bundled TypeScript, each dynamically
importing its own page script + chapter motions so Vite still code-splits them per page.
`Base.astro`'s own `<script>` (which only ever needs to run **once** — see
`components/stage/motion-script.ts`'s singleton reasoning above) imports `page-init.ts` and
registers **one** `astro:page-load` listener that dispatches by page identity:

```ts
document.addEventListener("astro:page-load", () => {
  const page = document.body.dataset.page;
  if (page === "home") initHomePage();
  else if (page === "about") initAboutPage();
});
```

This listener never needs to re-run — it's the thing that fires on every future
navigation, cold load or SPA (see the page-transitions module's own notes on
`astro:page-load` firing in both cases). Page identity comes from a `page` prop on
`Base.astro`, rendered as `document.body.dataset.page` — `<body>` isn't `transition:persist`-ed,
so this is always correct for whichever page is currently live.

**The same constraint applies to any other per-page init script.** `ScrollShapes.astro`
used to have its own `data-astro-rerun` script calling `initScrollShapes` — same problem,
same fix: that component now renders only its container + config; `initHomePage()` finds
the container and calls `initScrollShapes` directly. Adding scroll-shapes to a new page
means adding that same call to that page's `global-scripts/page-init.ts` function, not just
the component import.

**Re-running these functions must stay idempotent.** Once a page's init function can
genuinely run more than once per session, anything it registers globally (not scoped to
that page's own now-discarded DOM) needs explicit cleanup first, or it leaks:

- `initPageEngine` now calls `ScrollTrigger.getAll().forEach(st => st.kill())` before
  creating new ones — GSAP does **not** auto-kill a `ScrollTrigger` just because its
  `trigger` element left the DOM.
- `initScrollShapes` tracks its previous `gsap.ticker` callback in a module-level variable
  and removes it before adding a new one, for the same reason.

Neither of these was a directly _reported_ symptom, but both are guaranteed slow leaks
(one more orphaned trigger/ticker callback per repeat visit) once repeat navigation is the
normal case rather than an edge case.

---

## Scroll geometry

Geometry is authored, not computed from fixed constants — it comes directly from where
things are placed in the page script (`src/pages/home/motion-script.ts`, using the `at()` /
`chapter()` / `enter()` / `exit()` vocabulary from `src/components/page-system/motion-script.ts`):

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
  beat. During that window the chapter's own `beats()` timeline (from its
  `motion-script.ts`) is scrubbed, chapter-relative. `dwellBeats` defaults to 0 for
  chapters with no beats.
- **`exit(id, { over, to?, ease? })`** / **`enter(id, { over, from?, ease? })`** animate a
  chapter's `[data-chapter]` paper off/on screen. Defaults come from `scroll.flyUp` in
  `components/scroll-engine/config.ts` (`distance: 110vh`, `ease: "power2.in"`) unless
  overridden.
- **`morph({ from, to, over })`** and **`hold(beats)`** place a color morph or dead air at
  an absolute beat — see **Midground color morph** below.

The engine (`buildModelFromPageScript` in `components/scroll-engine/motion-script.ts`) reads these placements back out to
build each chapter's `scrollVH` window for `ScrollTrigger` and devtools — there is no
separate slot-accumulator pass; the resolved script _is_ the geometry.

All ScrollTrigger start/end positions in the engine use arrow functions that compute
px at trigger time (`() => vhToPx(totalVH)`). GSAP does not parse `vh` in position
strings — it strips the unit suffix and treats the number as raw px, which would make all
scroll ranges wildly wrong.

**The trailing beat isn't optional.** The engine maps the master timeline over
`[0, totalBeats]` onto scroll positions `[0, totalBeats * vhPerBeat px]` — but the page's
actual max `scrollY` is always exactly **one viewport short** of that (`scrollHeight -
innerHeight`; the spacer is the only element contributing document height, and you can
never scroll a page "past" its own last screen). That means the final `vhPerBeat` (1 beat,
100vh) of the master timeline can never actually be reached by scrolling.
`pages/home/motion-script.ts`'s trailing `at(16.4, hold(1))` is invisible there only because
the timeline chapter's real motion (`travel({ to: 2026 })`) finishes with beats to spare
before it. A page script whose real content/motion runs all the way up to its own end —
as `pages/about/motion-script.ts` does, since
its whole chapter is one continuous scrub — needs a trailing `hold(beats)` of **at least 1**
or the last stretch of that motion is measurably unreachable at max scroll (confirmed via
Playwright: dropping it below 1 left the About paper's scrub short of its target).

---

## A chapter's motion: two fields

A chapter's `motion-script.ts` is much smaller than the page script it's placed by. It
declares only:

- **beats** — an optional function that builds a scrubbed GSAP timeline for intra-chapter
  reveals. Receives the `[data-chapter]` container and the chapter's `ChapterBeats` (for
  devtools). Omit for chapters with no intra-chapter reveals.
- **schedule** — an optional pre-resolved event schedule (built with `resolveSchedule()` in
  `components/timeline/motion-script.ts`) for the `?beats` devtools HUD. Omit for scriptless
  chapters.

Everything about _where a chapter sits on the page_ — its dwell length, when its paper
flies away, when it enters — is authored in the page script instead (`chapter()`, `enter()`,
`exit()` in `pages/home/motion-script.ts`; see **Scroll geometry** above), not here. This is the
two-level model from Epic 15: chapter scripts stay chapter-relative; only the page script
knows where chapters sit.

Always type the export as `ChapterMotion` so TypeScript surfaces all available fields:

```ts
import type { ChapterMotion } from "@components/scroll-engine/motion-script";
import { compile, resolveSchedule } from "@components/timeline/motion-script";
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
away) exports an empty `{}` — see `pages/home/_chapters/01-intro/motion-script.ts`.

---

## Presets: `src/components/motion-presets/motion-script.ts`

### Beat presets

Used inside a chapter's `beats()` function to build the scrubbed reveals:

- `fadeInUpFrom()` — initial state: hidden, 40 px below. Pass as `from` in `fromTo()`.
- `fadeInUpTo()` — final state: visible, at natural position. Pass as `to` in `fromTo()`.
- `shiftUp(distance?)` — shift element upward from its current position (default 36 px).
  Use to move a prior beat up while the next one appears.

Example beats timeline:

```ts
import gsap from "gsap";
import { fadeInUpFrom, fadeInUpTo, shiftUp } from "@components/motion-presets/motion-script";

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

## A page's resting color vs. scroll-driven morphs

Two separate mechanisms, for two separate kinds of fact:

- **`PageConfig.matColor`** (`page-system/config.ts`) — a static per-page fact: what color
  the stage rests at, independent of scroll. Applied once, unconditionally, by
  `initPageEngine()` before the `useScrollEngine` check and before the reduced-motion
  branch — so it's correct on cold load, on SPA navigation, and under reduced motion alike,
  with no tween involved at all.
- **`morph({ from, to, over })`** (below) — a scroll-linked color _change_, placed as a
  moment on a page's own scrubbed timeline. Use this when the color should visibly
  transition as the user scrolls (home's tan → yellow → slate).

**Don't use `morph()` to set a page's resting color**, even with `over: 0` — a moment
placed at beat 0 of a _scrubbed_ (not _played_) timeline is a zero-duration edge case GSAP
doesn't reliably render until the first real scroll event, so the page would show the wrong
color until the user scrolls. This was a real bug, not a hypothetical: the `/work` page's
mat stayed tan on arrival and only flipped to its intended color once scrolled, until the
resting color was pulled out into `matColor` instead. If a page wants to _start_ at one
color and then morph to another as chapters progress, both apply together: `matColor` sets
where it starts, `morph()` moments in that page's own script (e.g. `home/motion-script.ts`)
still transition it from there exactly as before.

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
require browser support checking. This compiler lives in `page-system/motion-script.ts`'s
`morph` case (page scope) and `timeline/motion-script.ts`'s `morph` case (chapter scope) —
both write the same property via the same technique.

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

`components/timeline/motion-script.ts` already provides a `morph({ from, to, over })` moment
for a chapter's own `sequence` — reach for that first (see `script.ts` examples in
`pages/home/_chapters/03-timeline/`).
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
always-on** animation that lives in `components/stage/motion-script.ts` and runs regardless of scroll or which
chapter is showing (the mat persists in `Base.astro`).

### Structure

The mat is a `position: fixed; inset: 0` `<div>` (full viewport). Its visible shape
comes from `clip-path: path()` — a cubic-bezier path emitted by `components/stage/motion-script.ts` every
animation frame. The div itself has no inset gutter; all margins come from where the
vertex homes are placed.

### clip-path: path() — why and the key traps

`polygon()` supports only straight lines. Curves need `path()`, which accepts SVG cubic
beziers (`C`). Since `components/stage/motion-script.ts` already rewrites the clip string every frame for the
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
instant. Once `components/stage/motion-script.ts` runs it overwrites with the `path()` — the shapes are
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
causes edge clipping; `components/stage/motion-script.ts` logs a warning at init.

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

The single dial is `edgeCurve` in `components/stage/config.ts` (default `0.035` = 3.5%).

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

`components/stage/motion-script.ts` caches `W`, `H`, the resolved inset px values, and the computed handle lengths.
The per-frame wobble tick reads only from the cache — no `getBoundingClientRect` per frame
(that forces a layout every frame → jank). On resize (debounced 100 ms) the cache is
refreshed and the path redrawn.
