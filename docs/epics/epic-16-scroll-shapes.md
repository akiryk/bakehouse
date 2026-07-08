# Epic 16 — Scroll-shapes ambient layer

**Goal:** add a purely decorative layer of randomly generated rectangles that drift upward
as the user scrolls, configurable in density, placement, size, color, and speed — and
controllable from page scripts so any page can fade the layer in or out at any beat.

**Depends on:** Epic 15 (page script + `show`/`hide` moments already exist in timeline-kit).

**In scope:** the `ScrollShapes` component and its motion module; a z-index token for the
new layer; wiring into `home.script.ts` as a usage example.

**Out of scope:** any change to the scroll engine, page-script contract, or existing
chapters; reduced-motion handling beyond opacity (shapes simply don't appear).

---

## Why (the design intent)

The beat-ruler devtool produces an unintentional visual effect: labeled spans zoom past on
the right edge of the viewport in sync with scroll, creating a sense of layered depth and
quiet motion. This epic extracts that feeling into a proper design element — refined,
configurable, and living at the right architectural level.

The shapes are atmosphere, not content. They belong:

- **between the midground and the chapter papers** in the z-stack (z-25, above the mat
  polygon, below the white card and nav)
- **removed from the master timeline** in terms of individual shape motion — they run off
  a lightweight ticker that reads `window.scrollY` directly, the same pattern the octagon
  wobble uses. The master timeline is not the right tool for looping, randomly placed
  elements with individually varied speeds.
- **connected to the master timeline** only for visibility: the page script uses the
  existing `show()` / `hide()` moments to fade the layer in and out at authoring-time beats.

This two-responsibility split keeps the component self-contained: remove the import from
`index.astro` and it's gone with no residue.

---

## Architecture

### Layer placement

A new z-index token sits between the nav (z-20) and the foreground stage (z-30):

```css
/* global.css @theme */
--z-shapes: 25;
```

The `ScrollShapes` component renders a single `<div data-el="scroll-shapes" aria-hidden="true">`
container at `z-25` with `pointer-events-none`. Individual shape divs are appended inside it
by the motion module at runtime.

### Config object

```ts
// src/components/scroll-shapes/config.ts
export interface ScrollShapesConfig {
  count: { min: number; max: number };
  xZone: { left: number; right: number }; // viewport fractions 0–1
  height: { min: number; max: number }; // vh
  width: { min: number; max: number }; // vw
  speed: { min: number; max: number }; // scroll-px per shape-px (0.3 = slow, 1.0 = 1:1)
  colors: Array<{ value: string; opacity: number }>;
}

export const defaultConfig: ScrollShapesConfig = {
  count: { min: 4, max: 8 },
  xZone: { left: 0.65, right: 1.0 },
  height: { min: 8, max: 30 }, // vh
  width: { min: 3, max: 10 }, // vw
  speed: { min: 0.3, max: 0.9 },
  colors: [
    { value: "#ffffff", opacity: 0.1 },
    { value: "#000000", opacity: 0.08 },
  ],
};
```

The config is a plain object — pages import it, spread it, and override only what they
need:

```ts
import { defaultConfig } from "@components/scroll-shapes/config";

const homeConfig = { ...defaultConfig, xZone: { left: 0.7, right: 0.95 } };
```

### Motion module

`src/components/scroll-shapes/motion.ts` — called once, at page load:

1. Read config; pick a random count N within range.
2. For each shape, generate and store:
   - `x`: random position within `xZone` (vw → px at call time)
   - `w`, `h`: random width/height within range (vw/vh → px at call time)
   - `color`, `opacity`: randomly selected from the colors array
   - `speed`: random multiplier within range
   - `baseY`: random initial y position, staggered across `[0, 100vh]` so shapes are
     distributed at load rather than all entering from the bottom at once
3. Append shape divs to the container (`position: absolute`, no transition — GSAP drives
   transform directly).
4. Register a `gsap.ticker()` callback. Each shape tracks a `cycleIndex` (derived from
   `Math.floor(rawY / totalH)`). When the cycle index changes — meaning the shape just
   scrolled off-screen — it is reborn with freshly randomized x, width, height, color, and
   optionally speed, before re-entering from the bottom. Appearance is stable while the
   shape is visible; rebirth happens off-screen only. Skip per-shape work while the
   container is hidden (opacity check) — free perf, no behavior change.

   ```ts
   gsap.ticker.add(() => {
     if (container.style.opacity === "0") return; // skip while hidden
     const scrollY = window.scrollY;
     for (const shape of shapes) {
       const rawY = shape.baseY - scrollY * shape.speed;
       const totalH = shape.h + window.innerHeight;
       const newCycle = Math.floor(-rawY / totalH);
       if (newCycle !== shape.cycleIndex) {
         // shape wrapped off-screen — rerandomize before it re-enters
         shape.cycleIndex = newCycle;
         Object.assign(shape, randomizeAttrs(config)); // fresh x, w, h, color, speed
         applyAttrs(shape); // update DOM element styles
       }
       const y = (((rawY % totalH) + totalH) % totalH) - shape.h;
       gsap.set(shape.el, { y });
     }
   });
   ```

   No tween, no scrub — positional read-and-set per frame. The wrap-and-rerandomize loop
   means the layer is endlessly generative: no fixed repeat cycle, no convergence into
   permanent overlap.

### Page script wiring

No new moment types. The container has `data-el="scroll-shapes"`, so the existing
`show()` / `hide()` factories handle visibility. Page-scope moments resolve elements by
querying `[data-el="<id>"]` from the document root (established in Epic 15) — the
`scroll-shapes` container is in the DOM and resolves through that path without any
reference from the motion module. The component exports nothing to the engine or the
page-script system.

```ts
// src/motion/home.script.ts
at(1,  show("scroll-shapes", { over: 0.5 })),
at(5,  hide("scroll-shapes", { over: 0.5 })),
at(7,  show("scroll-shapes", { over: 0.5 })),
```

The shapes layer is hidden by default (`opacity: 0`) and revealed by the first `show()`.
Between `hide` and the next `show` it remains mounted and animating — only opacity changes.
This avoids any regeneration or restart cost.

### Resize policy

x/w/h are converted from vw/vh to px at load time, so a viewport resize leaves shapes
sized for the old dimensions. **Decision: accept staleness.** The wrap-and-rerandomize
loop naturally heals sizes over time as each shape is reborn with fresh px values computed
at the moment of rebirth. For purely decorative shapes this drift is harmless and cheaper
than a debounced recompute. No resize listener is registered.

### Reduced motion

When `prefers-reduced-motion` is active, the ticker is not registered and the container
stays hidden. Content is unaffected (the shapes are `aria-hidden` and carry no information).

---

## File layout

```
src/
  components/
    scroll-shapes/
      ScrollShapes.astro   ← the container element; accepts config as a prop
      config.ts            ← ScrollShapesConfig interface + defaultConfig
      motion.ts            ← shape generation, ticker (no exports to engine or page-script)
```

`ScrollShapes.astro` is added to `Base.astro` (always available, any page) or to individual
page files if the shapes are home-specific. Either placement is one import line.

---

## Steps

1. **Config and types.** `config.ts` with the `ScrollShapesConfig` interface and
   `defaultConfig`. No DOM, no motion yet.
   _Verify:_ TypeScript sees the types; the default values look right in the browser console.

2. **Component shell.** `ScrollShapes.astro` renders the `data-el="scroll-shapes"` container
   with correct z-index, pointer-events, and initial `opacity: 0`. Accept config as a prop
   and pass it to the motion module via a `<script>` that imports the module and calls
   `initScrollShapes(container, config)`. Add `--z-shapes: 25` to `global.css @theme` and
   `z-25` to `Base.astro` or wherever the component is placed.
   _Verify:_ the container div is in the DOM with correct styles; no shapes yet.

3. **Shape generation.** `motion.ts` — `initScrollShapes(container, config)` generates N
   shapes, creates their divs, and appends them to the container. No animation yet.
   _Verify:_ N shapes are visible in the DOM, statically positioned at their random x/y
   values, correct colors and sizes.

4. **Ticker motion.** Add the `gsap.ticker()` callback with wrap-and-rerandomize. Shapes
   move upward as you scroll; when a shape wraps off-screen it receives fresh random
   attributes before re-entering. Hidden-container early-return is also implemented here.
   _Verify:_ scrolling moves shapes upward; shapes reappear from the bottom with visibly
   different sizes/positions after several wraps; faster shapes outpace slower ones;
   scrolling back down reverses direction; no two shapes lock into identical permanent
   motion; browser perf panel shows ticker work stops while the layer is hidden.

5. **Page script wiring.** Add `show("scroll-shapes")` / `hide("scroll-shapes")` entries to
   `home.script.ts`. Confirm the layer is hidden at load and fades in at the authored beat.
   _Verify:_ the beat-ruler shows the show/hide events; the layer fades in and out at the
   right scroll positions; ticker continues running during hidden state.

6. **Reduced motion + cleanup.** Skip ticker registration when `prefers-reduced-motion` is
   set. Confirm no layout shift, no console errors on resize. Document config options with
   JSDoc on the interface.
   _Verify:_ `astro check` clean; with `prefers-reduced-motion: reduce` the container stays
   hidden; shapes are not in the accessibility tree.

---

## Done when

The right side of the viewport shows drifting rectangles in sync with scroll; density,
zone, size, color, and speed are all tunable from a single config object; the layer fades
in and out at beats authored in the page script using existing `show`/`hide` moments; the
component is removable with a one-line import deletion; and `prefers-reduced-motion` users
see nothing.
