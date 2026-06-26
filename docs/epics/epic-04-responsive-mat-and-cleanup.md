# Epic 04 — Responsive mat & cleanup

**Goal:** give the midground mat its final responsive behavior — distort-to-fill with a
roughly even, adaptive gutter — and clean up `Base.astro` so it follows our conventions and
its comments tell the truth.

**In scope:** the responsive fill + gutter, and the four `Base.astro` fixes below.

**Out of scope (other epics):** the scroll engine, the letter typography (Epic 03), the
second chapter, navigation/links.

**Don't touch:** the color tokens (beyond adding `--mat-inset`), the wobble *mechanism* and
per-vertex *ranges* (you'll move resting positions, but the structure and ranges stay), and
the scroll engine.

---

## A. The responsive mat (the gutter)

Decided behavior: the mat **distorts to fill** the window's proportions (wide window → wide
mat, tall → tall), framed by a **roughly even gutter that adapts** to window size rather
than a fixed pixel count. The wavy edge should breathe in and out of that gutter.

- **`preserveAspectRatio="none"`** on the SVG — distort-to-fill.
- **The gutter comes from the element's own box, not from coordinates.** Size the mat fixed
  and inset from the viewport by a token:

  ```css
  --mat-inset: clamp(24px, 4vmin, 64px);  /* even, adaptive, clamped */
  ```

  so the mat element is `position: fixed; inset: var(--mat-inset);` (below the paper layer)
  — or the Tailwind equivalent, `fixed inset-[var(--mat-inset)] z-[1]`. Define `--mat-inset`
  as a token alongside the other layout/visual tokens (the `@theme` block / `global.css`).

- **Move resting vertices out to the viewBox edges.** Today they're inset in coordinates
  (e.g. `upperLeft: {x: 34, y: 50}`). Under `none`, a coordinate inset scales unevenly per
  axis and makes the gutter lopsided, so the gutter must come **only** from `--mat-inset`.
  Push the resting positions to (near) the viewBox edges — `x` toward `0`/`1600`, `y` toward
  `0`/`900` — in `config/motion.ts`, **keeping each vertex's drift range** so the edge still
  undulates into the gutter. Keep the named-vertex structure intact.

**Caveat we're accepting (note, don't fix):** `none` stretches the wobble's amplitude per
axis — slightly more horizontal drift on wide windows, less on tall. At these amplitudes
it's negligible and matches the look already approved. If it ever visibly bothers us, the
upgrade is to drop `none` and compute vertex positions proportionally in JS while applying
drift in fixed pixels — explicitly out of scope here.

## B. `Base.astro` cleanup

1. **Tailwind-first.** Move the layout/positioning rules (fixed / inset / flex / z-index on
   the midground and foreground layers and the logo) out of the `<style>` block and onto the
   elements as Tailwind utilities. Keep a scoped `<style>` only for what utilities can't
   express cleanly. Move the `body` reset (margin / overflow) out of the component and into
   `global.css`.

2. **Logo aligns by construction.** Drive the logo's left inset from the **same
   `--mat-inset` token** as the mat box, so the logo's left edge and the mat's left edge
   share one value at every screen size. Remove the hardcoded `left: 32px` and the fragile
   `vw`/`vh` math. (Vertical: a comfortable top inset matching the design.)

3. **Polygon points from config.** Stop hardcoding the `points` attribute. Import
   `octagonShape` in the Astro frontmatter and build the `points` string from
   `octagonShape.vertices`, so the static / reduced-motion / pre-hydration shape **is** the
   config — one source of truth, no drift. (This makes the existing "edit in config, not
   here" comment actually true.)

4. **Comment hygiene.** Delete or repair every comment that no longer matches the code — the
   stale `viewBox 0 0 100 100` / "percentages" block, the logo note that cites
   `preserveAspectRatio="none"` while the element used `slice`, and the `vw`/`vh` logo math
   the code never actually used. A comment should describe what the code does, or not exist.

## Reduced motion

With points generated from config, reduced motion just renders the resting shape (no
wobble). Confirm `octagon.ts` holds still under `prefers-reduced-motion` and that the static
shape equals the config resting shape (no jump on hydration).

---

## Steps

Per `CLAUDE.md` → **How we work**: autonomous; verify and note after each step; continue
unless the note holds a real question.

1. **Gutter + fill.** `none`; add the `--mat-inset` token; mat fixed-inset by the token.
   Move resting vertices to the viewBox edges in `config/motion.ts` (keep ranges). *Verify:*
   resize — the mat fills proportionally (wide→wide, tall→tall) with a roughly even gutter
   that adapts to size; the wobble still reads.
2. **Points from config.** Generate the polygon `points` in the frontmatter from
   `octagonShape`. *Verify:* under reduced-motion (and before hydration) the static shape
   matches the animated resting shape — no jump.
3. **Logo alignment.** Drive the logo's left from `--mat-inset`; remove the hardcoded/`vw`
   math. *Verify:* the logo's left edge tracks the mat's left edge across window sizes.
4. **Tailwind pass.** Layout/positioning → utilities; `body` reset → `global.css`; trim the
   `<style>` block to only what utilities can't do. *Verify:* the visual is unchanged; the
   style block is minimal.
5. **Comment cleanup.** Remove/repair every comment that misstates the code. *Verify:* read
   the file top to bottom — every comment matches reality.
6. **Docs.** Record `--mat-inset` and the responsive behavior in `design-tokens.md` /
   `motion.md`; update if drifted.

## Done when

The mat distorts to fill the window with a roughly even, adaptive gutter; the logo's left
edge stays aligned to the mat's left edge at every size; the polygon renders from config
(static == animated resting); `Base.astro` uses Tailwind utilities for layout with only
essential scoped CSS; and no comment in the file lies about the code.
