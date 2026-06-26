# Motion

The scroll engine, how a chapter's motion is described, and the ambient background.

---

## The scroll engine

**Native scroll, never hijacked.** The page has real scrollable height. We use GSAP
**ScrollTrigger** with **pinning** so that the visual effect (a chapter holds, then its
paper flies away as the next arrives) is driven by **scroll progress** — not by
intercepting wheel or touch events. This keeps keyboard navigation, momentum, and mobile
behavior intact, and lets us honor reduced-motion cleanly.

The "slow, then accelerating" departure is a **custom easing curve** applied to that
progress-driven timeline — not a hardcoded animation. We will tune the curve by feel.

`engine.ts` responsibilities:

- Read the active page's chapter list (from `pages.ts`).
- For each chapter, build a pinned ScrollTrigger and a timeline from the chapter's
  enter/exit hooks.
- Sequence them so one chapter's exit overlaps the next chapter's enter as desired.
- Do nothing on pages where `useScrollEngine: false`.

The engine knows only "things that enter and leave on scroll." It does not know what a
paper is. (See `architecture.md` → the engine's contract.)

---

## A chapter's motion: two tracks

Each chapter's motion has **two tracks**:

- **paper** — the foreground rectangle.
- **content** — the markup inside it.

By **default the two are synced** (content rides along with the paper). But they are
**not locked together**: a chapter can offset the content track — e.g. the paper rises
into view, then the content fades in a beat later. This is how we "suggest the letter
metaphor without obeying it literally."

Intended `motion.ts` shape (illustrative):

```ts
import { flyUpAccelerate, fadeIn } from "../../../motion/presets";

export default {
  // Use a named preset for the paper, and offset the content slightly.
  paper: flyUpAccelerate(),
  content: fadeIn({ delay: 0.2 }),
  // Or omit this file's fields entirely to inherit the engine default.
};
```

- **Name presets** for the common path.
- **Go bespoke** by composing GSAP directly in this file instead of naming a preset.
- **Say nothing** and the chapter inherits the default fly-away.

---

## Presets: `src/motion/presets.ts`

A small library of reusable, named motions so chapters stay declarative and the site
feels consistent. Each preset is a factory returning the tween/timeline vars the engine
applies. Starting set (rough, to grow):

- `flyUpAccelerate()` — the default paper exit: slow lift, then rapid acceleration off
  the top.
- `paperRise()` — a paper entering from below into resting position.
- `fadeIn({ delay })` — content easing in, optionally offset from its paper.

Tunable values (durations, eases, distances) should come from `config/motion.ts` where it
makes sense, so motion feel can be adjusted in one place.

---

## Reduced motion

Wrap motion in `gsap.matchMedia()` and provide a `prefers-reduced-motion: reduce`
branch that drops or simplifies movement (e.g. content simply appears; no fly-away).
Content must always be reachable and readable without motion. Motion is a grace note,
not a gate.

---

## The ambient mat

Separate from everything above. The midground mat's vertex wobble is a **continuous,
always-on** animation that lives in `octagon.ts` and runs regardless of scroll or which
chapter is showing (the mat persists in `Base.astro`).

**How it works:** The mat is a `position: fixed` `<div>` clipped with
`clip-path: polygon()`. `octagon.ts` rewrites the polygon string on each GSAP tick,
animating the vertices. Using percentage coordinates in `clip-path` means the shape
always fills the mat box correctly at every window proportion — "50% across" is always
the true middle, and corners are never distorted.

**Vertices:** Eight named points in `config/motion.ts → octagonShape.vertices`
(upperLeft, upperCenter, upperRight, centerRight, lowerRight, lowerCenter, lowerLeft,
centerLeft), each `{x, y, drift?}` where `x`/`y` are percentages of the mat box
(0–100) and `drift` is an optional per-vertex radius in **px**. Editing the mat shape
means editing these numbers — nothing is hardcoded in `Base.astro` or `octagon.ts`.

**Drift in px (not %):** Because a horizontal `%` is more pixels than a vertical `%` on
a wide window, drift radii are expressed in px. `octagon.ts` writes each vertex as
`calc(P% + Dpx)` so the breathing amount is visually even at every aspect ratio.

**Animation model:**

- Each vertex has a fixed home (its config `x`/`y`) and drifts within its `drift` radius.
- Corners use `defaultDrift` (small); edge midpoints use a larger per-vertex `drift` so
  the edges breathe while the corners stay nearly still.
- GSAP tweens the pixel offset for each vertex with `sine.inOut`, `yoyo: true`,
  `repeat: -1` — deliberate, continuous, never jerky.
- Vertices run slightly out of phase via evenly distributed delays (no `Math.random()`).
- Drift directions all point inward so edges bow gently rather than ballooning outward.
- Honor reduced-motion: hold the resting shape when requested.
