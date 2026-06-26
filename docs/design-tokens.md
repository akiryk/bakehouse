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

Background and paper are both white; the paper reads against the tan midground via a soft
shadow. Decided and placeholder values:

- `--shadow-paper: -2px 4px 3px 0 rgb(0 0 0 / 0.15)` — paper drop shadow (nudged up-left).
- `--color-link` — muted links (provisional: `#8a8278`).
- `--color-accent` — color dots / nav accents (provisional: `#b8a99a`).

---

## Layout inset tokens

These live on `:root` directly (not inside `@theme`) because they are consumed only as
plain CSS custom properties, not as Tailwind utility classes:

```css
/* src/styles/global.css */
:root {
  --mat-inset: clamp(24px, 4vmin, 64px); /* right / bottom / left gutter */
  --mat-inset-top: clamp(64px, 9vmin, 128px); /* larger — logo + nav headroom */
}
```

The mat `<div>` is sized by `top: var(--mat-inset-top)` and
`right/bottom/left: var(--mat-inset)` — no `width` or `height` needed (four insets size
a fixed div on their own). The logo's left edge uses `--mat-inset` so it always tracks
the mat's left edge.

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

Behavioral values GSAP needs, kept out of the styling layer. The file exports two things:

**`octagonShape`** — the midground mat's geometry and wobble config:

```ts
export const octagonShape = {
  defaultDrift: 8, // px — fallback drift radius per vertex
  defaultSpeed: 9, // seconds for one full out-and-back cycle
  vertices: {
    // Eight named points clockwise from upper-left, each {x, y, drift?}.
    // x and y are percentages of the mat box (0–100).
    // drift is in px (not %) so breathing is visually even at every aspect ratio.
    // Resting positions sit at the box edges; the gutter comes from --mat-inset.
    upperLeft: { x: 0, y: 0 },
    upperCenter: { x: 50, y: 0, drift: 14 }, // top edge bows inward
    // ... upperRight, centerRight, lowerRight, lowerCenter, lowerLeft, centerLeft
  },
};
```

`octagon.ts` writes each animated vertex as `calc(P% + Dpx)` inside a
`clip-path: polygon()` string on the mat div. Editing the mat shape means editing
`octagonShape.vertices` — nowhere else.

**`motion`** — scroll / fly-away timing:

```ts
export const motion = {
  scroll: {
    flyUp: { ease: "power2.in", distance: 110 /* vh */ },
  },
};
```

Where motion code needs a **color**, read `var(--color-...)` so color stays single-sourced
in the `@theme` block.
