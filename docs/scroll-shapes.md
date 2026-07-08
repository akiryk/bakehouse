# Scroll-shapes

A purely decorative, ambient layer of rectangles that drift as the user scrolls.

---

## What it is, and why

The beat-ruler devtool produces an unintentional visual effect: labeled spans zoom past
on the right edge of the viewport in sync with scroll, creating a sense of layered depth
and quiet motion. Scroll-shapes extracts that feeling into a proper design element —
refined, configurable, and living at the right architectural level.

The shapes are atmosphere, not content:

- They sit **between the midground mat and the chapter papers** in the z-stack
  (`--z-shapes: 25` — above the mat at z-20, below the foreground stage at z-30).
- They are **`aria-hidden`** and carry no information — nothing is lost for
  reduced-motion or screen-reader users when they're absent.
- They are **independent of the chapter/beat scroll engine**. Nothing about them rides
  the master timeline; they read `window.scrollY` directly off a `gsap.ticker`, the same
  pattern the ambient mat's octagon wobble uses.
- They are **removable in one line** — delete the `<ScrollShapes />` import from a page
  and the layer is gone with no residue elsewhere.

## Architecture

```
src/components/scroll-shapes/
  ScrollShapes.astro   ← the container element; accepts a config prop
  config.ts            ← ScrollShapesConfig interface + defaultConfig
  motion.ts            ← shape generation + the scroll-driven position formula
```

**`ScrollShapes.astro`** renders a single `position: fixed; inset: 0` container
(`data-el="scroll-shapes"`, `z-25`, `pointer-events-none`) and, in an inline `<script>`,
calls `initScrollShapes(container, config)` once at page load. The resolved config is
passed to the client via a `data-config` JSON attribute (Astro islands have no other way
to hand a plain object to a plain `<script>`).

**Gotcha: shape generation waits for `window.load`, not script execution.** The scroll
engine (`engine.ts`) gives the page its real scrollable height by appending a spacer to
`<body>` — but that engine script runs _later in document order_ than `ScrollShapes`'s own
script (it's placed in the ambient slot, ahead of the chapters). Measuring
`document.documentElement.scrollHeight` at script-execution time would see the page
_before_ the spacer exists — just a few viewport-heights tall — and badly under-count the
usable entry range (this was a real bug: `scrollZone.end` had no visible effect because
every entry point was being squeezed into the same tiny window). `initScrollShapes` defers
its geometry-dependent setup to the `load` event, which is guaranteed to fire only after
every module script on the page — including the engine's — has finished running.

It's placed on a page via the `ambient` slot on `Base.astro`, **not** inside the default
slot — the ambient slot sits at the root stacking context, outside the
`.foreground-stage`, so scroll-shapes isn't clipped or reordered by the chapter papers'
own stacking context:

```astro
<Base>
  <ScrollShapes config={defaultConfig} slot="ambient" />
  <IntroContent />
  ...
</Base>
```

**`config.ts`** defines `ScrollShapesConfig` — size groups, horizontal zone, vertical
scroll zone, speed range, and a color pool. `defaultConfig` holds the currently-tuned
values (`src/pages/index.astro` passes it straight through, unmodified). A page that needs
different behavior spreads it and overrides only what differs:

```ts
import { defaultConfig } from "../components/scroll-shapes/config";

const otherPageConfig = {
  ...defaultConfig,
  xZone: { left: 0.7, right: 0.95 }, // narrower horizontal band for this page
};
```

**Gotcha: a per-page override replaces the whole nested object, not individual fields.**
`{ ...defaultConfig, scrollZone: { start: X, end: Y } }` replaces `scrollZone` entirely —
it does **not** merge with `defaultConfig.scrollZone`. `index.astro` used to hardcode its
own `scrollZone` override this way, which meant edits to `defaultConfig.scrollZone` in
`config.ts` had _zero effect_ on the home page — the override silently won every time. If
a page doesn't need to diverge from the default for a given field, don't re-specify it.

**`motion.ts`** does the actual work — see **Behavior** below for the model it implements.

## Config reference

Every field on `ScrollShapesConfig`, at a glance (full mechanics for each are in
**Behavior** below):

| Field        | Type                         | Unit                                                      | What it controls                                                                                                                                                                                                                                                                                                |
| ------------ | ---------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sizeGroups` | `{ count, width, height }[]` | width: px, height: vh                                     | Size buckets — e.g. a few large shapes plus many thin ones. Total shape count is the sum of every group's `count`. Groups are shuffled before entry points are assigned, so a group's array position doesn't correlate with where down the page its shapes appear.                                              |
| `xZone`      | `{ left, right }`            | viewport-width fraction (0–1)                             | Horizontal band shapes may appear in, e.g. `{ left: 0.65, right: 1.0 }` confines them to the right third of the screen.                                                                                                                                                                                         |
| `scrollZone` | `{ start, end }`             | vh, anchored to page top (100 = one viewport height down) | Where each shape's entry point (scrollY at which its top reaches the viewport's bottom edge) is randomly drawn from. `start` below 0 lets shapes already be visible at load; `end` is clamped to the page's real max scroll, so a generously high value safely means "keep entering all the way to the bottom." |
| `speed`      | `{ min, max }`               | multiplier on scrollY                                     | Per-shape parallax rate. `1.0` tracks scroll 1:1 (feels closer); lower values drift more slowly (feels farther back).                                                                                                                                                                                           |
| `colors`     | `{ value, opacity }[]`       | CSS color + 0–1 opacity                                   | Pool each shape's fill is randomly picked from.                                                                                                                                                                                                                                                                 |

Every field is a **range or pool that's resolved once per shape at generation time** —
there are no per-frame random draws, so a shape's size, color, and speed are stable for
its whole lifetime; only its position changes as `scrollY` changes.

## Behavior

Each shape is generated once, at load, with:

- a random `x` position within `xZone` (viewport-width fraction, converted to px),
- a random `w` within its size group's `width` range (already px — no conversion),
- a random `h` within its size group's `height` range (vh, converted to px),
- a random `color`/`opacity` from the `colors` pool,
- a random `speed` multiplier within `speed`,
- and a **`scrollEntry`** — the absolute `scrollY` (in px) at which the shape's top edge
  reaches the bottom of the viewport. Entries are spread evenly across
  `scrollZone.start`–`scrollZone.end` (each shape gets one segment of the zone, with a
  random offset inside it), so shapes appear staggered rather than all at once.

**Sizes come from `sizeGroups`, not one flat range.** `sizeGroups` is an array of
`{ count, width, height }` buckets — e.g. a few large shapes plus many thin, narrow ones —
rather than a single width/height range shared by every shape. `width` is in **px**
(not vw), which is what makes a 1px-wide shape easy to specify without doing viewport-width
math; `height` stays in vh, consistent with the rest of the layer's vertical measurements.
The total shape count is the sum of every group's `count`. Before entry points are
assigned, the groups are flattened into one list and **shuffled**, so a group's position
in the array has no bearing on where down the page its shapes tend to appear — sizes are
interspersed throughout the scroll range, not clustered (without the shuffle, all the
"large" shapes would enter first and all the "small" ones only much later, since entries
are assigned to the flattened list in order).

`scrollZone.start`/`.end` are authored in **vh units, anchored to the page top** — not a
fraction of total scroll. 100 means exactly one viewport height down the page (where the
first screen ends). A shape's `scrollEntry` (in scrollY px) is derived from a configured
page position `P` (vh) by `scrollEntry = (P / 100) * viewportHeight - viewportHeight`:

- `start < 100` → some shapes' entry points fall _before_ `scrollY = 0`, so they're
  already partly visible on a fresh load.
- `start > 100` → every entry point falls below the fold — e.g. `start: 110` means
  nothing appears until the user has scrolled 10vh past the first screen.
- `end` has no fixed ceiling. A value at or beyond the page's real height is clamped to
  the page's actual max scroll at runtime (`motion.ts` still measures
  `document.documentElement.scrollHeight` for this one purpose), so "keep entering all
  the way to the bottom" doesn't require knowing or tracking the page's exact length —
  set `end` generously high (e.g. `100_000`) and let the clamp do the work.

**Non-obvious: getting several shapes visible at load takes a `start` well below 0, not
just below 100 — and raising `count` alone barely helps.** Entries are spread evenly
across the whole `[start, end]` span. When `end` reaches all the way down the page (as it
does here, so shapes last through chapter 3), that span covers ~16 viewport-heights —
so only the sliver of it that falls before `scrollY = 0` is ever "already active" on load.
Making `start` a few hundred _negative_ (not just under 100) is what actually grows that
sliver; `count` just controls how many total shapes are spread across the _entire_ span,
so a higher count mostly adds density later in the page, not at the very start. The
current tuned value is `start: -400`, which reliably puts a handful of shapes on screen
at load, spread across the viewport (not clustered at the bottom edge — see next
paragraph for why that clustering happens at low `start` magnitudes).

**Why shapes hug the bottom edge when `start` is only slightly negative.** A shape's
y-position at `scrollY = 0` is `viewportHeight - (0 - scrollEntry) * speed`, i.e. it
depends on how long ago (in scroll-equivalent px) the shape's entry was, scaled by its own
`speed` (always < 1). A shape whose entry was only just before `scrollY = 0` has, by
definition, only just begun rising from the bottom — it hasn't had "time" (scroll
distance) to travel upward yet. `start: -400` gives shapes room to have entered up to
several hundred px of scroll "in the past," which is what lets some of them have already
travelled up the screen by load, rather than all merely peeking in from the bottom edge.

Position is a **pure function of `scrollY`**, recomputed every frame:

```
y = viewportHeight - (scrollY - shape.scrollEntry) * shape.speed
```

This one formula is the entire behavior model:

- **Visibility at `scrollY = 0` is configurable, not fixed.** Whether a shape is already
  on screen at load is entirely a function of where `scrollZone.start` places its
  `scrollEntry` relative to 0 (see above) — the formula itself doesn't special-case load.
- **Shapes enter only by scrolling down**, rising from below the viewport as `scrollY`
  passes each shape's `scrollEntry`.
- **Motion is fully reversible.** Because `y` depends only on the current `scrollY` (not
  on direction or history), scrolling back up retraces the exact same path and scrolling
  back to the top returns every shape to fully hidden. There's no separate "exit" case to
  keep in sync with "entry."
- **No fades, no flashes, no discontinuities.** There's no opacity toggle, no
  show/hide moment, no display change — visibility is entirely a side effect of the
  shape's box moving in or out of the viewport rectangle. A shape is either fully off
  the top, fully off the bottom, or somewhere in between; there's no third "hidden"
  state layered on top that could pop.
- **The position is applied unconditionally, every frame, for every shape** — including
  when the shape is fully off-screen. This matters: an earlier version skipped the
  `gsap.set()` call once a shape was out of the visible range as a perf optimization, but
  that let a shape's transform freeze at its last on-screen value, so it could sit
  statically "poking" into the viewport indefinitely instead of continuing to clear it.
  Always applying the formula guarantees an off-screen shape is exactly where the formula
  says it is on every frame — never stale.
- **Stopping scroll stops motion.** The ticker recomputes `y` every frame, but `y` is a
  function of `scrollY` alone — if `scrollY` isn't changing, `y` isn't either.

### Resize policy

`x`/`w`/`h` are converted from vw/vh to px once, at load. A viewport resize leaves
existing shapes sized/positioned for the old dimensions — **this is an accepted
tradeoff**, not a bug: these are ambient decorative shapes, and a debounced
recompute-and-reposition isn't worth the complexity it would add. No resize listener is
registered.

### Reduced motion

When `prefers-reduced-motion: reduce` is active, `initScrollShapes` returns immediately —
no shapes are generated, no ticker is registered, the container stays an empty div.
Content is unaffected; the shapes carry no information (`aria-hidden="true"`).

## How to modify

- **Density / where shapes appear down the page** → total shape count (sum of
  `sizeGroups[].count`) and `scrollZone` in `config.ts`'s `defaultConfig` (or a
  page-specific override — see the gotcha above about overrides replacing, not merging,
  nested fields). `scrollZone` is expressed in vh, anchored to the page top (100 = one
  viewport height down) — see **Behavior** above for the full model, including why `start`
  needs to be well below 0 (not just below 100) to get several shapes visible at load. The
  current default, `{ start: -400, end: 100_000 }`, shows a handful of shapes at load and
  keeps entries coming all the way to the page's actual end; `{ start: 110, end: 300 }`
  would instead hide everything until 10vh past the fold and stop new entries by 3
  viewport-heights down.
- **Horizontal placement** → `xZone` (viewport-width fractions, e.g. `{ left: 0.65, right:
1.0 }` confines shapes to the right third of the screen).
- **Size mix** → `sizeGroups`, an array of `{ count, width, height }` — e.g.
  `[{ count: 5, width: { min: 80, max: 150 }, height: { min: 60, max: 100 } }, { count: 15,
width: { min: 1, max: 10 }, height: { min: 10, max: 30 } }]` for 5 large shapes and 15
  thin ones. `width` is px; `height` is vh. Add more groups for more size buckets; a single
  group with one wide range behaves like the old flat width/height config.
- **Drift speed** → `speed` range. Higher = faster relative to scroll (`1.0` tracks
  scroll 1:1; lower values drift more slowly, reading as "further back").
- **Color / opacity** → the `colors` pool; each shape picks one entry at random.
- **The z-index itself** → `--z-shapes` in `global.css`'s `@theme` block. Don't hardcode
  a numeric z-index in the component.
- **Adding the layer to a new page** → import `ScrollShapes` and `defaultConfig`, build a
  page-specific config by spreading `defaultConfig`, and render
  `<ScrollShapes config={...} slot="ambient" />` inside `<Base>`.
- **Removing the layer entirely** → delete the `<ScrollShapes />` import/usage from the
  page. No other file references it.

## Non-goals

- No connection to the chapter/beat engine or page-script `show()`/`hide()` moments —
  visibility is scroll-position-only, by design (see **Behavior** above).
- No resize-driven repositioning (see **Resize policy**).
- No content or accessibility role — the layer is `aria-hidden` and inert.
