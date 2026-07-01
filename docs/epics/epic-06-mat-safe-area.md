# Epic 06 — Mat safe-area margins (no clipping)

**Goal:** kill the edge-clipping artifact — where an outward-bulging edge gets cut flat at
the mat boundary and reads as a false extra edge — by giving the shape a **safe-area
inset**. The mat div stays full-bleed; the visible margin comes entirely from placing the
vertex homes far enough inside the edge to absorb the full outward motion. Also audit the
tree for any *other* clipping source left over from the SVG→clip-path migration.

**In scope:** the safe-area inset model, the clipping audit, and recording both.

**Out of scope:** the phone breakpoint, the paper/letter, the scroll engine.

**Don't touch:** the wobble's random-circle model (just approved — keep it exactly), colors,
the paper, the scroll engine. This epic changes *where the homes sit* and *what bounds the
motion* — not how the motion works.

---

## The bug

In the clip-path mat the base vertices sit at the div's edges (`0%`/`100%`). The div edge
**is** the clip boundary — `clip-path` shows nothing outside the element. So when an
edge-midpoint wobbles outward it tries to cross `0%`/`100%` and gets cut flat, producing the
false straight segment / phantom edge. The fix: inset the homes so there's room for the full
outward motion before the boundary.

## The model (decided)

- **The mat div is full-bleed** — fills its container/viewport (`inset: 0`), background =
  midground. The margin is **not** a div inset; it comes from the safe area below. (This
  retires Epic 05's `--mat-inset` / `--mat-inset-top` div-gutter approach.)
- **Per-side safe insets (decided).** Each vertex home sits inset from its edge, and the
  inset differs by edge:
  - `--mat-safe-inset-x` (left/right): **20px** base.
  - `--mat-safe-inset-top`: **larger** (default ~140px, tunable) — reserves the top band for
    the logo overlay and the nav (see *Logo & nav, deferred* below).
  - `--mat-safe-inset-bottom`: **slightly larger** than the sides (default ~40px, tunable).
- **`motionRadius = 10px`** — the wobble circle radius (the per-vertex drift). A vertex
  moves randomly within that circle around its home.
- **Visible margin breathes** by ± `motionRadius` around each side's inset: sides ~10–30px,
  bottom ~30–50px, top ~130–150px (all follow whatever the tokens are set to).
- **Invariant (the durable rule): every side's inset ≥ `motionRadius`.** Otherwise a vertex
  on that edge can reach/cross the boundary and clip. The smallest (sides, 20px) clears the
  10px radius with room; keep that true if you retune.

### Units (this is the clean part)

The along-edge anchor is a **%** (`0` / `50` / `100`); the insets and the motion are **px**.
With `X` = side inset, `T` = top inset, `B` = bottom inset:

```
upperLeft:   ( calc(0% + Xpx),   calc(0% + Tpx) )
upperCenter: ( 50%,              calc(0% + Tpx) )
upperRight:  ( calc(100% − Xpx), calc(0% + Tpx) )
centerRight: ( calc(100% − Xpx), 50% )
lowerRight:  ( calc(100% − Xpx), calc(100% − Bpx) )
lowerCenter: ( 50%,              calc(100% − Bpx) )
lowerLeft:   ( calc(0% + Xpx),   calc(100% − Bpx) )
centerLeft:  ( calc(0% + Xpx),   50% )
```

Motion then adds `±` up to `motionRadius` px within the circle. Because only the anchor is a
percentage and everything else is pixels, each margin is a **true constant px** regardless
of window shape — and the earlier %-vs-px wobble unevenness disappears.

### Single source for the insets

Define `--mat-safe-inset-x`, `--mat-safe-inset-top`, `--mat-safe-inset-bottom` on `:root` in
`global.css`. The **logo's left** reads `var(--mat-safe-inset-x)` so it stays aligned to the
visible mat edge by construction, and `octagon.ts` reads the **same** values
(`getComputedStyle`) to compute the homes — one source, no drift. `motionRadius` and
per-vertex drift stay in `config/motion.ts`.

### Logo & nav (deferred — informs the top inset only)

Not built in this epic; recorded so the top/bottom insets are sized for it:

- The **logo** will sit top-left in its own white, slightly-shadowed div that *overlays* the
  shape (it reads as floating over the mat, not inset into a band). The top inset is sized so
  that overlay has room.
- The **nav** ("Home · About · Services · Work") sits upper-right on a baseline a few px
  **above the topmost point of the animating shape** — i.e. just above the top vertices'
  highest reach (`top inset − motionRadius`). The top inset must leave room for the nav text
  above that line.
- A slightly larger **bottom** inset gives the composition a little visual weight at the base.

A later epic implements the logo overlay div and the nav; this one only reserves the space.

## The clipping audit

Before/while fixing, enumerate **every** clipping mechanism in the tree and confirm we're
fighting exactly one boundary, not several:

- the intended `clip-path` on the mat div;
- any `overflow: hidden` on the mat or an ancestor;
- any **leftover `<svg>` / `viewBox` / `<mask>` / `<clipPath>`** from the pre-migration model
  that wasn't fully removed — a residual viewBox *plus* the clip-path is a double boundary
  that no inset math can fix;
- any too-tight container bounding the mat.

Report what's found; remove anything that isn't the single intended `clip-path` boundary.

---

## Steps

Per `CLAUDE.md` → **How we work**: autonomous; verify against the rendered result at both a
wide and a tall/narrow window; note; continue unless a real question.

1. **Audit.** Enumerate clipping sources; confirm no residual SVG/viewBox/mask and no stray
   `overflow: hidden`; report findings and remove strays. *Verify:* the only clip boundary
   is the intended `clip-path`.
2. **Full-bleed div.** Mat div → `inset: 0` (full-bleed); retire the `--mat-inset` /
   `--mat-inset-top` div gutter. *Verify:* the div fills the viewport edge to edge.
3. **Safe-area homes.** Add `--mat-safe-inset-x`, `--mat-safe-inset-top`,
   `--mat-safe-inset-bottom` on `:root`; place homes inset per-side using the %-anchor +
   px-inset model; logo left = `var(--mat-safe-inset-x)`. *Verify:* at rest, a ~20px margin
   on the sides, a larger top, and a slightly larger bottom; the logo's left aligns to the
   mat's left edge.
4. **Bounded motion.** Constrain the wobble so each vertex stays within `motionRadius` (10px)
   of its home; assert `safeInset ≥ motionRadius`. *Verify (the key check):* at a wide **and**
   a tall window, drive the wobble and confirm **no edge is ever cut flat** — outward bulges
   stay rounded, the margin breathes ~10–30px and never reaches 0.
5. **Docs.** Update `motion.md` with the safe-area model (homes inset per-side, motion within
   `motionRadius`, each margin = inset ± radius, invariant per-side `inset ≥ motionRadius`),
   and make sure the wobble description reflects the **random-circle** model (uniform-random
   target in the disc, continuous flow, per-leg duration variance). Update `design-tokens.md`
   for the three `--mat-safe-inset-*` tokens; remove the retired `--mat-inset` /
   `--mat-inset-top` if unused.

## Done when

An outward-bulging edge is never clipped at any window shape; the visible margin breathes by
±`motionRadius` around each side's inset (sides ~10–30px, larger top, slightly larger
bottom); the mat div is full-bleed with the margins owned entirely by the safe-area insets;
and exactly one clip boundary exists in the tree.
