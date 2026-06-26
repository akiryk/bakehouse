# Epic 05 — Mat migration: clip-path

**Goal:** move the midground mat off the viewBox-SVG / `preserveAspectRatio="none"` approach
and onto a `position: fixed` box clipped with a percentage `clip-path: polygon()`. This is
the only approach that gives **even-ish margins on all sides AND undistorted corners** at
every desktop/tablet proportion — the two things `none` could never deliver at once. The
eight-vertex wobble is **preserved exactly**; only where its numbers get written changes.

**In scope:** the mat container, the percentage vertices, porting the wobble to write
clip-path, the inset tokens, logo alignment, and retiring the viewBox approach in the docs.

**Out of scope:** the phone breakpoint (its own follow-up), the paper/letter, the scroll
engine, chapter content, any second chapter.

**Don't touch:** colors, the paper, the scroll engine, the letter typography.

---

## Why we're migrating (read once)

An SVG is a replaced element with an intrinsic aspect ratio. A fixed SVG inset on all four
sides collapses to its 16:9 ratio when height is `auto` (the measured 514px height); adding
`h-full w-full` makes height resolve against the **viewport**, not the inset box, so it
overshoots and overflows. There is no clean middle for an SVG without a wrapper — which is
why the fix kept ping-ponging between "too short" and "too wide."

A plain `<div>` has **no intrinsic ratio**, so a fixed div with four independent insets
sizes itself to exactly that region. Express the shape as a `clip-path: polygon()` in
**percentages of that box**, and "50% across" is always the true middle and a corner is
always a clean corner — at every window shape, with zero distortion. The margins come from
the box's insets; the shape comes from percentages. The two concerns stop fighting.

## What is preserved (do not rebuild)

The **animation model is unchanged**: eight vertices, each with a fixed home, each easing
toward a random target within a small radius of its home, reaching it, then reversing toward
a new target — deliberate, continuous, never drifting away, never jerky. GSAP is still just
tweening numbers; the only change is that on each tick it writes a `clip-path: polygon()`
string instead of an SVG `points` attribute. Keep `octagon.ts`'s structure (homes,
per-vertex range, eased random-target-then-reverse loop).

---

## A. The container

A single `position: fixed` `<div>` (the mat), filling the viewport minus **independent**
inset sides — slightly more room up top for the logo/nav, small and even on the other three:

```css
:root {
  --mat-inset: clamp(24px, 4vmin, 64px); /* right / bottom / left */
  --mat-inset-top: clamp(64px, 9vmin, 128px); /* larger — logo + nav headroom */
}
/* mat div */
.mat {
  position: fixed;
  top: var(--mat-inset-top);
  right: var(--mat-inset);
  bottom: var(--mat-inset);
  left: var(--mat-inset);
  background: var(--color-midground);
}
```

No `width`/`height`, no `h-full w-full` — the four insets size a div correctly on their own.
Both tokens live on `:root` in `global.css` (Tailwind `@theme` doesn't reliably emit them).

## B. The vertices (percentages)

Eight named vertices in `config/motion.ts`, now expressed as **percentages of the box**,
clockwise from top-left — homes at/near the box edges so the shape fills the box at rest and
the wavy edge breathes inward:

```ts
octagon: {
  // homes in %, drift in px for visual evenness (see C)
  defaultDrift: 8,            // px each vertex may move from home
  vertices: {
    upperLeft:   { x: 0,   y: 0 },
    upperCenter: { x: 50,  y: 0,   drift: 14 },
    upperRight:  { x: 100, y: 0 },
    centerRight: { x: 100, y: 50 },
    lowerRight:  { x: 100, y: 100 },
    lowerCenter: { x: 50,  y: 100, drift: 14 },
    lowerLeft:   { x: 0,   y: 100 },
    centerLeft:  { x: 0,   y: 50 },
  },
}
```

## C. The wobble (ported, not rebuilt)

Keep the eased random-target-then-reverse loop. On each tick, recompose the clip-path string
from the current vertex positions and write it to the mat div
(`el.style.clipPath = 'polygon(...)'`). Reduced motion holds the homes (no tween).

**One tuning detail (verify by eye, not a capability question):** drift expressed as a raw
`%` is uneven on a non-square window (a horizontal `%` is more pixels than a vertical `%`).
To keep the breathing visually even, express each point as `calc(P% ± D px)` so the drift
amount is a constant pixel offset regardless of window shape. Confirm `calc()` inside
`polygon()` behaves across target browsers; if it's awkward, fall back to per-axis `%`
tuned by eye. The _amount_ will need a pass on screen — the motion model is faithful, the
magnitude is a dial.

## D. Logo alignment

Keep the logo's left driven by `--mat-inset` so it aligns to the mat's left edge by
construction. It now sits in the larger top gutter (`--mat-inset-top`); place it there.

## E. Retire the old approach in the docs

Update `motion.md` and `design-tokens.md`: remove the viewBox / `preserveAspectRatio="none"`
/ `h-full w-full` gotcha material (no longer applicable) and replace it with the clip-path
mechanism and the two inset tokens. Leave no stale `meet`/`slice`/`none` guidance behind.

> If we ever want true SVG features on this shape later (gradients, strokes, filters), the
> same percentage model can be done as a percentage-based SVG instead of clip-path. Not now;
> clip-path is the simplest thing that meets the goal.

---

## Steps

Per `CLAUDE.md` → **How we work**: autonomous; verify (against the rendered result, at both
a wide and a tall/narrow window); note; continue unless a real question.

1. **Container.** Replace the SVG with a fixed mat `<div>`; add `--mat-inset` /
   `--mat-inset-top` on `:root`; background = midground. _Verify (numeric):_ at a MacBook
   window the div's box sits fully inside the viewport — all four edges visible — with a
   small even margin on three sides and more up top; no overflow. Resize wide → tall: still
   no overflow, margins stay roughly even.
2. **Vertices + static shape.** Put the percentage vertices in `config/motion.ts`; render
   the resting `clip-path: polygon()` from them. _Verify:_ corners are clean (no diagonal
   slashing) at wide, square, and tall windows.
3. **Port the wobble.** Move `octagon.ts` to write clip-path each tick; keep the
   random-target/reverse model; reduced-motion holds the homes. _Verify:_ movement is
   deliberate and continuous (not jerky), edges breathe inward, corners stay clean.
4. **Even-drift tuning.** Apply the `calc(P% ± Dpx)` approach (or tuned per-axis %); confirm
   the breathing looks even at very wide and very tall windows. _Verify by eye_ at both
   extremes.
5. **Logo.** Left from `--mat-inset`; seat it in the top gutter. _Verify:_ left edge tracks
   the mat across sizes.
6. **Docs.** Retire the viewBox material in `motion.md` / `design-tokens.md`; document the
   clip-path mechanism + the two inset tokens. _Verify:_ no stale aspect-ratio guidance
   remains.

## Done when

At any desktop/tablet window proportion the mat sits fully within the viewport with even-ish
margins (more up top), undistorted corners, and the same deliberate eight-vertex breathing
as before — and nothing overflows at any size. The viewBox/`preserveAspectRatio` approach is
gone from code and docs.
