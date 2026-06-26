# Epic 02 — The mat & its control surface

**Goal:** turn the midground shape from a guessed octagon into a _tweakable mat_ — its
resting geometry stored as a named-vertex object you can edit by hand, scaling responsibly
as one undistorted unit, with each vertex breathing on its own gentle, continuous drift.
The point of this epic isn't to nail the look; it's to build the control surface so **you**
can dial the look in minutes afterward.

**In scope:** the vertex config, the responsive viewBox/scaling fix, and the per-vertex
eased wobble. Nothing else.

**Out of scope (later epics):** logo placement, the second chapter, fly-away easing/travel
tuning, broader responsive polish.

---

## Why this epic exists

Epic 01 proved the three layers and the motion plumbing, but the midground shape was
guessed and carries two structural problems: it's defined inline (hard to tweak) and it
uses `preserveAspectRatio="none"`, which stretches the geometry — and the wobble — with
the viewport. Both are fixed by the same move: a named-vertex resting shape in a fixed
coordinate space.

---

## The vertex config

In `src/config/motion.ts`, the shape's resting geometry becomes the single source of
truth: eight named vertices, each `{x, y}` in viewBox units, clockwise from the top-left.
This replaces Epic 01's single `octagon.vertexRange`.

```ts
// src/config/motion.ts — illustrative; the real numbers are yours to tune
export const motion = {
  octagon: {
    viewBox: { width: 1000, height: 600 },
    defaultRange: 6, // drift (viewBox units) a vertex uses if it omits its own
    vertices: {
      upperLeft: { x: 20, y: 20 },
      upperCenter: { x: 500, y: 14, range: 10 },
      upperRight: { x: 980, y: 20 },
      centerRight: { x: 986, y: 300 },
      lowerRight: { x: 980, y: 580 },
      lowerCenter: { x: 500, y: 586, range: 10 },
      lowerLeft: { x: 20, y: 580 },
      centerLeft: { x: 14, y: 300 },
    },
  },
  scroll: {
    /* fly-away easing + travel — unchanged this epic */
  },
};
```

- **Editing the shape = editing these eight numbers.** That's the whole point.
- Each vertex may carry its own optional `range` (how far it may drift); absent that, it
  uses `defaultRange`. A near-square mat will usually want a small range at the corners
  (they barely move) and a little more at the edge-midpoints, so the long top/bottom edges
  breathe while the corners stay put.
- Both the SVG rendering and the wobble read base positions from here — nothing about the
  shape is hardcoded in the component.

---

## Responsive scaling — decided: `meet`

The SVG uses the fixed `viewBox` above and **`preserveAspectRatio="xMidYMid meet"`** (not
`none`). This scales the shape **uniformly**: it keeps its proportions, and a drift of 6
means 6 units at every screen size — no skew. The SVG element is sized to the viewport via
CSS (width/height 100%).

Tradeoff we accepted: `meet` fits the whole viewBox inside the element and centers it, so
when the viewport's proportion differs from the viewBox there can be slight margins — the
tan may not reach the very edge on every screen. That's fine to start. If we later want
guaranteed edge-to-edge tan, the switch is one attribute — `xMidYMid slice` (scales to
cover, cropping the outermost edge offscreen). **Do not make that switch in this epic;**
leave `meet` and just note where any margin shows.

---

## The wobble

Each vertex drifts **smoothly and continuously** around its base — eased, looping motion,
with vertices slightly out of phase so the edges undulate rather than buzz. **Not**
random-per-frame (that reads as jitter). The natural implementation is a small per-vertex
GSAP tween/timeline easing the point between offsets within its range, each with its own
duration and phase. Keep it barely perceptible. Honor `prefers-reduced-motion` by holding
the resting shape.

---

## Don't touch

Colors, the `@theme` tokens, the paper, and the fly-away all work — leave them. This epic
only changes how the midground geometry is **defined, scaled, and animated.**

---

## Steps

Per `CLAUDE.md` → **How we work**: autonomous; verify and leave a short note after each
step; continue unless the note holds a real question.

1. **Inspect & report.** Show how the shape is currently defined and animated, and what
   would change to reach the structure above. Note anything that already matches.
2. **Vertex config.** Move the resting geometry into the named-vertex object in
   `config/motion.ts` (per-vertex optional `range` + `defaultRange`); render the shape
   from it. _Verify:_ renders identically to before, now sourced from the config.
3. **Responsive fix.** Fixed `viewBox` + `preserveAspectRatio="xMidYMid meet"`, SVG sized
   to the viewport. _Verify:_ resizing the window keeps the shape undistorted and uniformly
   scaled; report whether/where margins appear.
4. **Per-vertex eased wobble.** Rewrite the wobble to read bases from the config and drift
   each vertex on its own gentle eased loop, slightly out of phase, within its range;
   reduced-motion holds still. _Verify:_ edges undulate smoothly (no jitter); corners move
   less than edge-midpoints when ranges differ.
5. **Docs.** Confirm `design-tokens.md` and `motion.md` describe the named-vertex model
   accurately; update if they drifted.

---

## Done when

The midground shape renders from eight editable named vertices in `config/motion.ts`,
scales as one undistorted unit across viewport sizes (`meet`), and breathes via smooth
per-vertex eased drift — so the next thing you do is open `motion.ts`, move points, and
watch the mat become what you want.
