# Design tokens

Two homes, split by concern:

- **Look** — colors, fonts, type — live in the **Tailwind v4 `@theme` block** in
  `src/styles/global.css`. Declaring them there generates both utility classes
  (`bg-midground`, `text-ink`, `font-serif`) **and** `:root` CSS variables
  (`var(--color-midground)`), so the same token is reachable from markup and from JS/CSS.
- **Motion** — wobble ranges, easings, durations — live in `src/config/motion.ts`,
  because they're consumed by GSAP, not by styling.

Rule: if a value affects how the site looks or feels, it belongs in one of these — never
inline in a component.

---

## Colors (initial)

```css
/* src/styles/global.css */
@import "tailwindcss";

@theme {
  --color-background: #ffffff; /* flat backmost layer */
  --color-midground: #cfc6b6; /* the animated polygon (tan) */
  --color-foreground: #ffffff; /* the "paper" */
  --color-ink: #79530b; /* body + heading text (warm brown) */
}
```

This generates `bg-background`, `bg-midground`, `bg-foreground`, `text-ink`, etc., plus
the matching CSS variables.

Background and paper are both white to start; the paper reads against the tan midground
(and a soft shadow). Add these **TBD placeholders** now with provisional values so nothing
gets hardcoded later, then tune against the design:

- `--color-link` — the muted links in the copy (grey-ish in the reference).
- `--color-accent` — the small color dots / future nav accents.
- `--shadow-paper` — the paper's soft drop shadow. **Decided:**
  `-2px 4px 3px 0 rgb(0 0 0 / 0.15)` (black 15%, x −2px, y +4px, blur 3px — nudged up-left).

---

## Font: Adobe Caslon Pro (via Adobe Fonts)

Loads from an account web-project embed — **not npm, not auto-fetchable**. The embed is
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
Don't block other steps on the font — the fallback renders fine meanwhile.

---

## Type scale & spacing

Define in the same `@theme` block (`--text-*`, `--spacing-*`, etc.) rather than sprinkling
literal sizes in components. Keep it modest and classical to suit Caslon. Exact values are
set during the build; the point is that there's one home for them.

---

## Motion tokens: `src/config/motion.ts`

Behavioral values GSAP needs, kept out of the styling layer:

```ts
// src/config/motion.ts  (illustrative)
export const motion = {
  octagon: {
    viewBox: { width: 1000, height: 600 }, // fixed coordinate space for the shape
    defaultRange: 6, // drift (viewBox units) if a vertex omits its own
    vertices: {
      // eight named points, clockwise from top-left; each may carry its own `range`
      upperLeft: { x: 20, y: 20 },
      upperCenter: { x: 500, y: 14, range: 10 },
      // ...upperRight, centerRight, lowerRight, lowerCenter, lowerLeft, centerLeft
    },
  },
  scroll: {
    // easing + distance for the paper fly-away, tuned by feel
  },
};
```

The shape is rendered and animated from `octagon.vertices`, so editing the mat means
editing these named points. The SVG uses this `viewBox` with
`preserveAspectRatio="xMidYMid meet"` (never `none`) so the geometry scales uniformly at
every screen size. See `motion.md` → "The ambient octagon" and `epic-02-mat-shape.md`.

Keep defaults subtle. See `motion.md` → "The ambient octagon." Where motion code needs a
**color**, read the CSS variable (`var(--color-...)`) so color stays single-sourced in the
`@theme` block.
