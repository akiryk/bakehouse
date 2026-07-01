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
paper is. (See `architecture.md` -> the engine's contract.)

---

## A chapter's motion: two tracks

Each chapter's motion has **two tracks**:

- **paper** -- the foreground rectangle.
- **content** -- the markup inside it.

By **default the two are synced** (content rides along with the paper). But they are
**not locked together**: a chapter can offset the content track -- e.g. the paper rises
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

- `flyUpAccelerate()` -- the default paper exit: slow lift, then rapid acceleration off
  the top.
- `paperRise()` -- a paper entering from below into resting position.
- `fadeIn({ delay })` -- content easing in, optionally offset from its paper.

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

### Structure

The mat is a `position: fixed; inset: 0` `<div>` (full viewport). Its visible shape and
margins come entirely from a `clip-path: polygon()` whose eight vertices are placed inward
from the div edges by the `--mat-safe-inset-*` CSS tokens. The div itself has no inset
gutter -- that concern belongs to the vertex homes, not the container.

### Safe-area model

Each vertex home sits inset from its nearest edge by a side-specific token:

```
upperLeft:   ( var(--mat-safe-inset-x),               var(--mat-safe-inset-top)    )
upperCenter: ( 50%,                                    var(--mat-safe-inset-top)    )
upperRight:  ( calc(100% - var(--mat-safe-inset-x)),   var(--mat-safe-inset-top)    )
centerRight: ( calc(100% - var(--mat-safe-inset-x)),   50%                          )
lowerRight:  ( calc(100% - var(--mat-safe-inset-x)),   calc(100% - var(--mat-safe-inset-bottom)) )
lowerCenter: ( 50%,                                    calc(100% - var(--mat-safe-inset-bottom)) )
lowerLeft:   ( var(--mat-safe-inset-x),               calc(100% - var(--mat-safe-inset-bottom)) )
centerLeft:  ( var(--mat-safe-inset-x),               50%                          )
```

The along-edge anchor is a `%` (0 / 50 / 100%); the inset from that anchor is a `px`
token. Because the inset and the motion are both in px, each visible margin is a **true
constant px** independent of window shape -- no aspect-ratio wobble.

**Invariant:** every `--mat-safe-inset-*` value must be >= `motionRadius`. If an inset
shrinks below the radius, an outward-drifting vertex can reach the clip boundary and get
cut flat (the false-edge artifact). `octagon.ts` logs a console warning if this is
violated at init.

### Animation model (random-circle wander)

Each vertex wanders continuously within a circle of radius `motionRadius` (px) around
its home:

1. Pick a uniformly random point inside the circle (angle uniform in [0, 2pi]; radius =
   sqrt(rand) \* motionRadius for uniform area distribution -- without sqrt, points cluster
   near the center).
2. Tween toward it (GSAP, configurable ease and duration).
3. On arrival, go to 1 -- forever.

This produces organic, non-repeating paths with no fixed direction and no ping-pong rail.
Duration per leg varies by +/-`LEG_SPEED_VARIANCE` so vertices never synchronise.
Vertices start staggered by `defaultSpeed / 8` so they are always out of phase.

**Velocity continuity** at leg boundaries is controlled by two constants in `octagon.ts`:

- `LEG_EASE` -- ease per leg. `"none"` (linear) = no deceleration hitch at targets.
  `"sine.in"` or `"power1.in"` are alternatives if linear feels mechanical.
- `LEG_OVERLAP` -- fraction of a leg at which the next begins. `0` = purely sequential.
  `0.1`-`0.2` blends velocity when using a non-linear ease.

**Reduced motion:** `gsap.matchMedia()` skips all tweens when
`prefers-reduced-motion: reduce` is set; vertices hold their home positions.

### One source, no drift

`octagon.ts` reads `--mat-safe-inset-*` via `getComputedStyle` at init and computes home
positions in the same px arithmetic the CSS uses. The static clip-path in `Base.astro`
uses the same tokens via `var()`. Both resolve identically -- no discrepancy between
before-JS and after-JS rendering.
