# Epic 10 — Curved mat edges (polygon → path)

**Goal:** give the mat's four edges a soft, symmetric bow through their center points by
adding fixed bezier handles to the top-center, bottom-center, left-center, and right-center
vertices. The corners stay sharp/unchanged. This requires migrating the clip from
`clip-path: polygon()` (straight lines only) to `clip-path: path()` (supports cubic beziers).

**In scope:** the polygon→path migration in `octagon.ts`, the fixed center-point handles, the
`edgeCurve` token, and the resize/measurement handling that `path()` requires.

**Out of scope:** anything about the corners (unchanged), the safe-area margins (Epic 06),
the color morph (Epic 08), the paper.

**Don't touch:** the wobble motion model (random-circle targets — keep exactly), the
safe-area insets, the color system, the corners.

---

## Why `path()`, and the two traps

`clip-path: polygon()` draws only straight lines — no beziers. Curves need
`clip-path: path()`, which takes an SVG path string and supports cubic beziers (`C`). Since
`octagon.ts` **already** rewrites the clip string every frame (that's the wobble), switching
its *output* from a `polygon()` string to a `path()` string is a contained change, not a
re-architecture. But two things bite if done naively:

- **`path()` is pixel-only — no `%`, no `calc()`, no `var()`.** So `octagon.ts` can no longer
  emit `%`-anchored `calc()` strings; it must compute **every coordinate in px** from the
  measured element size. Responsiveness therefore comes from recomputing on resize (see
  below), not from the browser resolving `%`.
- **Resolving the `clamp()` safe insets to px.** `getComputedStyle(el).getPropertyValue('--mat-safe-inset-top')`
  returns the *unresolved* string (`clamp(...)`), not px — a custom property is substituted,
  not computed. Don't parse it. Instead **measure** the resolved safe area: e.g. read a probe
  element positioned with those insets (`getBoundingClientRect`), letting the browser resolve
  the `clamp()`. That gives real px for the homes.

## Measurement & resize (perf)

- Measure the element size and resolve the safe-area px **once on init and on resize**
  (debounced), and **cache** them. The per-frame wobble tick uses the cached values — do
  **not** call `getBoundingClientRect` every frame (that forces layout each frame → jank).
- On resize, recompute the cached size, the resolved insets, **and** the curve-handle lengths
  (they're a fraction of a side, so size-dependent).
- Reduced motion: compute the static resting `path()` once, and on resize.

## The curves

Only the **four center points** get handles; the **corners have none** (sharp joins).

- Each center point has **two symmetric, opposite handles** of equal length, **parallel to
  the relevant edge**: top/bottom centers → horizontal handles (parallel to top/bottom edge);
  left/right centers → vertical handles (parallel to the sides).
- **Length = `edgeCurve` × the relevant side** — top/bottom use the measured **width**,
  sides use the measured **height**. (1000×700 → top/bottom handles 35px, side handles
  24.5px, matching the spec.)
- The handles are **rigid relative to their point**: fixed length and angle *relative to the
  center point*, so they **translate with the point** as it wobbles but never rotate or
  scale relative to it. Their px length only recomputes on resize (since it's a fraction of a
  side).
- Construction: each edge becomes **two cubic segments meeting at its center point** — the
  center's two edge-parallel handles are the control points on the center side; the
  corner-side control points sit at/near the corners so the corners stay sharp. Result: a
  smooth bow peaking at the center with an edge-parallel tangent, straightening toward the
  corners.

## The token

Add **`edgeCurve` = `0.035`** (3.5% of the relevant side), as the single dial for curviness.
Natural home is `config/motion.ts` alongside `motionRadius` (it's JS-consumed geometry); if
you'd rather keep all mat knobs as CSS vars for consistency with the insets, `--mat-edge-curve`
on `:root` read by JS works too — pick one and document it.

---

## Steps

Per `CLAUDE.md` → **How we work**: autonomous; verify against the rendered result at both a
wide and a tall window; note; continue unless a real question.

1. **Confirm support.** Verify `clip-path: path()` behaves in the target browsers (it's
   well-supported, but confirm). *Verify:* a trivial `path()` clip renders.
2. **polygon → path (no curves yet).** Rewrite `octagon.ts` to measure the element + resolve
   the safe area (probe-measure, not string-parse), cache size/insets, and emit a **px
   `path()`** string with straight segments — reproducing today's shape exactly. Add the
   debounced resize recompute. *Verify:* the mat looks identical to before at wide and tall
   windows, margins still constant px, wobble unchanged, no per-frame layout thrash.
3. **Add center-point handles.** Add `edgeCurve` (0.035); give the four center points fixed,
   symmetric, edge-parallel bezier handles (length = fraction × relevant side); corners stay
   sharp. *Verify:* each edge bows smoothly through its center, corners unchanged; tweak
   `edgeCurve` and confirm the single dial changes curviness.
4. **Motion + reduced-motion.** Confirm the handles translate rigidly with their wobbling
   center points (no rotate/scale relative to the point), and reduced-motion renders the
   static curved resting shape (recomputing on resize). *Verify:* bows stay smooth through
   the wobble; reduced-motion holds a curved static shape.
5. **Docs.** Record the polygon→path migration, the `edgeCurve` token, and the px/measurement
   notes in `motion.md` / `design-tokens.md`.

## Done when

The mat's four edges bow smoothly and symmetrically through their center points with the
corners still sharp, the curviness is one `edgeCurve` dial, the shape stays correct and
constant-margined at every window size (recomputing on resize), the wobble is unchanged, and
there's no per-frame layout thrash.
