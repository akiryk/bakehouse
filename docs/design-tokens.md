# Design tokens

Two homes, split by concern:

- **Look** -- colors, fonts, type -- live in the **Tailwind v4 `@theme` block** in
  `src/styles/global.css`. Declaring them there generates both utility classes
  (`bg-mat`, `text-ink`, `font-serif`) **and** `:root` CSS variables
  (`var(--color-mat)`), so the same token is reachable from markup and from JS/CSS.
- **Motion** -- wobble radius, speed -- live in `src/config/octagon.ts` and
  `src/config/scroll.ts`, because they're consumed by GSAP, not by styling.

Rule: if a value affects how the site looks or feels, it belongs in one of these -- never
inline in a component.

---

## Colors (initial)

```css
/* src/styles/global.css */
@import "tailwindcss";

@theme {
  --color-background: #ffffff; /* flat backmost layer */
  --color-mat: #cfc6b6; /* the animated polygon (tan); scrubbed by morph() moments */
  --color-foreground: #ffffff; /* the "paper" */
  --color-ink: #79530b; /* body + heading text (warm brown) */
}
```

This generates `bg-background`, `bg-mat`, `bg-foreground`, `text-ink`, etc., plus
the matching CSS variables.

Background and paper are both white; the paper reads against the tan midground via the
pseudo-element shadow (see _Paper shadow tokens_ below). Placeholder values:

- `--color-link` -- muted links (provisional: `#8a8278`).
- `--color-accent` -- color dots / nav accents (provisional: `#b8a99a`).

---

## Paper shadow tokens

The paper's shadow is a `::before` pseudo-element -- a blurred rectangle slightly smaller
than the card, offset and rotated so the blur reveals mainly at one corner (the
lifting-corner effect). Every aspect is one token; `--paper-shadow-rotate` is the key dial.

```css
/* src/styles/global.css — :root */
:root {
  --paper-shadow-color: var(
    --color-ink
  ); /* references ink token, not raw hex */
  --paper-shadow-opacity: 0.15;
  --paper-shadow-blur: 20px;
  --paper-shadow-inset: 6px; /* how much smaller the shadow rect is than the card */
  --paper-shadow-offset-x: 12px; /* shifts shadow toward bottom-right */
  --paper-shadow-offset-y: 8px;
  --paper-shadow-rotate: 2deg; /* the lift angle -- key dial for the effect */
}
```

Layering model in `Chapter.astro` (no `z-index: -1`, no `overflow: hidden`):

- `.chapter-paper` -- shadow stage: `position: relative; isolation: isolate; will-change: transform`
- `.chapter-paper::before` -- the shadow rectangle at `z-index: 0`
- `.chapter-paper-content` -- the crisp white card at `z-index: 1`

`isolation: isolate` creates a stacking context so `::before` sits behind the content
without a negative z-index. `will-change: transform` on both the wrapper and `::before`
promotes compositing layers before scroll starts, keeping the fly-away paint-free.

The old `--shadow-paper` `box-shadow` token is retired (Epic 07). There is exactly one
shadow mechanism on the paper.

---

## Mat safe-area tokens

These live on `:root` directly (not inside `@theme`) because they are consumed as plain
CSS custom properties -- by the static clip-path in `Base.astro` and by `octagon.ts` via
`getComputedStyle` -- not as Tailwind utility classes.

```css
/* src/styles/global.css */
:root {
  --mat-safe-inset-x: 20px; /* left / right -- must stay >= motionRadius */
  --mat-safe-inset-top: 140px; /* reserves logo + nav headroom              */
  --mat-safe-inset-bottom: 40px; /* slightly more than sides for visual balance */
}
```

The mat `<div>` is **full-bleed** (`position: fixed; inset: 0`). Visible margins come
entirely from placing vertex homes this far inside the div edges via `clip-path:
polygon()`. The logo's `left` uses `var(--mat-safe-inset-x)` so it always aligns to the
mat's visible left edge by construction.

**Invariant:** every token value must be >= `motionRadius` (currently 10px). If an inset
falls below the radius, an outward-drifting vertex can reach the clip boundary and produce
a false flat edge. `octagon.ts` logs a warning at init if this is violated.

The visible margin on each side breathes by +/- `motionRadius` around the inset:
sides ~10-30 px, bottom ~30-50 px, top ~130-150 px.

---

## Font: Adobe Caslon Pro (via Adobe Fonts)

Loads from an account web-project embed -- **not npm, not auto-fetchable**. The embed is
ready:

```html
<link rel="stylesheet" href="https://use.typekit.net/edz5xyo.css" />
```

Wire it into `Base.astro`'s `<head>`. Adobe Fonts exposes the family under the CSS name
`adobe-caslon-pro` (confirm in the kit's "Using fonts in CSS" panel). Declare it as a
token:

```css
@theme {
  --font-serif:
    "adobe-caslon-pro", "Big Caslon", "Hoefler Text", Georgia, serif;
}
```

This generates `font-serif` and `var(--font-serif)`. The fallback stack keeps layout
stable before the kit loads and acceptable if it ever fails. Set body copy to `font-serif`.
Don't block other steps on the font -- the fallback renders fine meanwhile.

---

## Type scale & spacing

Define in the same `@theme` block (`--text-*`, `--spacing-*`, etc.) rather than sprinkling
literal sizes in components. Keep it modest and classical to suit Caslon. Exact values are
set during the build; the point is that there's one home for them.

---

## Motion tokens: `src/config/octagon.ts` and `src/config/scroll.ts`

Behavioral values GSAP needs, kept out of the styling layer, split across two files by
domain rather than one shared `config/motion.ts`.

**`src/config/octagon.ts`** exports `octagonShape` -- the mat's wobble and shape config:

```ts
export const octagonShape = {
  motionRadius: 12, // px -- radius of the random-wander circle per vertex
  defaultSpeed: 4, // seconds -- nominal duration of each wander leg
  edgeCurve: 0.035, // fraction of side -- bezier handle length for center points
};
```

`edgeCurve` is the single dial for curviness: `0` = straight edges, `0.035` = gentle bow,
`0.1`+ = pronounced curve. Handle length = `edgeCurve × side` (width for top/bottom edges,
height for left/right). Recomputed on resize.

Vertex homes are **not** stored here. They are derived at runtime in `motion/octagon.ts` by
measuring the viewport and resolving the `--mat-safe-inset-*` tokens via a probe element
(not `getComputedStyle` string-parse, which fails for `clamp()` values). To change the
shape or margins, edit those tokens in `global.css`; `octagon.ts` picks them up automatically.

**`src/config/scroll.ts`** exports the beat unit and scroll/fly-away timing:

```ts
export const vhPerBeat = 100; // vh of scroll per beat
export const minBeatPx = 560; // px floor so a beat can't collapse on short windows

export const scroll = {
  flyUp: { ease: "power2.in", distance: 110 /* vh */ },
};
```

`vhPerBeat`/`minBeatPx` are the scroll engine's timing unit (see `motion.md`); `scroll.flyUp`
is the default a chapter's page-script `exit()` moment falls back to when it doesn't
override `to`/`ease` itself (see `authoring-content.md`).

Where motion code needs a **color**, read `var(--color-...)` so color stays single-sourced
in the `@theme` block.
