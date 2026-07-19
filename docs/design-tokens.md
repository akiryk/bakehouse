# Design tokens

Two homes, split by concern:

- **Look** -- colors, fonts, type -- live in the **Tailwind v4 `@theme` block** in
  `src/styles/global.css`. Declaring them there generates both utility classes
  (`bg-mat`, `text-ink`, `font-serif`) **and** `:root` CSS variables
  (`var(--color-mat)`), so the same token is reachable from markup and from JS/CSS.
- **Motion** -- wobble radius, speed -- live in `src/components/stage/config.ts` and
  `src/components/scroll-engine/config.ts`, because they're consumed by GSAP, not by styling.

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

The paper's shadow is a two-element system, not a pseudo-element: a blurred wrapper div
containing a clipped trapezoid shape, so the blur bleeds past the polygon edges instead
of being clipped to them. Every aspect is one token.

```css
/* src/styles/global.css — :root */
:root {
  --paper-shadow-color: var(--palette-shadow);
  --paper-shadow-opacity: 0.4;
  --paper-shadow-blur: 6px;
  --paper-shadow-poke-x: 5px; /* how far the shadow juts past the card's right edge */
  --paper-shadow-poke-y: 10px; /* how far the shadow juts past the card's bottom edge */
  --paper-shadow-inset: 12px; /* how far the shadow polygon is inset from left/top/bottom */
}
```

Layering model, split across `Chapter.astro` and `Paper.astro` (no `z-index: -1`, no
`overflow: hidden`):

- `Chapter.astro`'s `[data-chapter]` article -- the transform target: `position: relative;
will-change: transform`. Just the marker the scroll engine sequences; it renders no
  visual card of its own.
- `Paper.astro`'s root -- the shadow stage, composed inside `Chapter`: `position: relative;
isolation: isolate; width: var(--chapter-paper-width)`
- `.chapter-shadow-wrap` -- blur wrapper at `z-index: 0`, insets pulled out by
  `--paper-shadow-poke-x/y` and blurred by `--paper-shadow-blur`
- `.chapter-shadow-shape` -- the clipped trapezoid inside it (`clip-path: polygon()`,
  inset by `--paper-shadow-inset`), colored by `--paper-shadow-color` /
  `--paper-shadow-opacity`
- `.chapter-paper-content` -- the crisp white card at `z-index: 1`

`isolation: isolate` (on `Paper`'s root) creates a stacking context so the shadow sits
behind the content without a negative z-index. `will-change: transform` stays on
`Chapter`'s article — the element the engine actually transforms — not on `Paper`,
promoting the compositing layer before scroll starts and keeping the fly-away paint-free.

Paper is opt-in composition: a chapter that doesn't wrap its content in `<Paper>` renders
no card or shadow at all. See `authoring-content.md`.

The old `--shadow-paper` `box-shadow` token is retired (Epic 07). There is exactly one
shadow mechanism on the paper.

---

## Mat safe-area tokens

These live on `:root` directly (not inside `@theme`) because they are consumed as plain
CSS custom properties -- by the static clip-path in `Base.astro` and by
`components/stage/motion-script.ts` via `getComputedStyle` -- not as Tailwind utility
classes.

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
a false flat edge. `components/stage/motion-script.ts` logs a warning at init if this is
violated.

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

## Font: Jost (via Google Fonts)

`--font-sans` is **Jost**, loaded as a **variable** font from a Google Fonts `<link>` in
`Base.astro`'s `<head>` (alongside the Adobe Fonts embed, not replacing it -- Caslon still
comes from Typekit):

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Jost:wght@200..600&display=swap"
  rel="stylesheet"
/>
```

- **`wght@200..600`, normal only, no `ital` axis** -- covers ExtraLight (200) through
  SemiBold (600) in one file instead of separate weight downloads. A weight requested
  outside a variable face's declared range clamps to the nearest in-range value rather
  than erroring -- the original `400..600` (set in Story 19.2) silently rendered the
  timeline chapter's `font-light` (300) years as Regular; widened once that surfaced, to
  cover the lighter weights actually in use, not just Regular/Medium. Requesting italics
  _merged into_ a normal weight range hits a standing Google Fonts bug (google/fonts
  #2445) where the italics silently fail to render; italics aren't used on `font-sans`
  today, but if they ever are, request them as a **separate** family line, not merged
  into this one.
- **`display=swap`** shows the fallback stack first, then swaps to Jost once it loads --
  expect a small reflow on swap given the two typefaces' different metrics; not chased for
  CLS on this (desktop-only) pass.

```css
@theme {
  --font-sans: "Jost", "Century Gothic", sans-serif;
}
```

Replaces the old Futura/Typekit `futura-pt` stack. `body` sets `font-synthesis: none`, so
weights the loaded font doesn't actually have are never faked -- Jost's variable axis
supplies genuine 400/500/600 instances, so a `font-medium` element renders as real Medium,
not a synthetic bold-lite. If two different declared weights ever render identically, the
axis isn't loading; check the embed before assuming it's a design choice.

**Follow-up, not yet actioned:** the retired `futura-pt` token pointed at an Adobe Typekit
family, almost certainly served by the same kit (`use.typekit.net/edz5xyo…`) that still
serves Caslon. Nothing in the codebase references `futura-pt` anymore, but the kit will
keep shipping that font file until it's pruned from the Adobe web-project config --
an account-level action, not a code change.

---

## Project card tokens

Values for the portfolio `ProjectCard` (Epic 19; the component itself is a later story —
this is tokens only). Sizes, colors, the divider, the button padding, and the shadow, all
named so the component never hardcodes a literal.

**Type sizes and colors — `@theme` in `global.css`:**

```css
@theme {
  --text-card-eyebrow: 10px; /* YEAR, TITLE */
  --text-card-body: 12px; /* description, Learn More label */
  --text-card-name: 14px; /* project name, role */

  --color-card-meta: var(--palette-slate); /* YEAR, TITLE, role */
  --color-card-heading: var(--palette-black); /* project name */
  --color-card-description: var(--palette-gray); /* description */
  --color-card-button: var(--palette-slate); /* button background */
  --color-card-on-button: var(--color-foreground); /* button label (white) */
}
```

**Collision rule:** Tailwind v4 generates the `text-*` utility from _both_ `--text-*`
(size) and `--color-*` (color) tokens. A size suffix and a color suffix that match (e.g.
a hypothetical `--text-card-body` + `--color-card-body`) would both try to emit
`.text-card-body` and collide. The color suffixes here (`meta` / `heading` / `description`
/ `button` / `on-button`) are kept deliberately disjoint from the size suffixes
(`eyebrow` / `body` / `name`) — don't add a color token whose suffix matches a size
token's. The card composes a size class and a color class on the same element (e.g.
`text-card-name text-card-heading` for the project name) precisely because they're
different utility names.

**Divider, button padding, and shadow — plain `:root` custom properties** (no utility
needed; the card reads these directly as CSS, same pattern as `--paper-shadow-*`):

```css
:root {
  --card-divider-color: var(--palette-slate);
  --card-divider-width: 0.5px;
  --card-divider-height: 20px;
  --card-divider-gap: 6px; /* left/right padding around the rule */

  --card-button-pad-x: 10px;
  --card-button-pad-y: 4px;

  --card-shadow: var(--shadow-card);
}
```

`--card-shadow` is the one-line keep/soften/drop dial for the card's lift: it defaults to
the existing `--shadow-card`, so the card renders with a shadow out of the box even
though the mock shows none — set it to `none` to drop the shadow, or retune the value to
soften it, without touching any card component code either way.

The 0.5px divider width renders inconsistently at 1× DPI; that's a rendering-technique
concern for the component (a crisp-hairline trick), not something these tokens solve —
see the component story when it lands.

---

## Type scale & spacing

Define in the same `@theme` block (`--text-*`, `--spacing-*`, etc.) rather than sprinkling
literal sizes in components. Keep it modest and classical to suit Caslon. Exact values are
set during the build; the point is that there's one home for them.

---

## Motion tokens: `src/components/stage/config.ts` and `src/components/scroll-engine/config.ts`

Behavioral values GSAP needs, kept out of the styling layer, split across two files by
domain rather than one shared config file.

**`src/components/stage/config.ts`** exports `octagonShape` -- the mat's wobble and shape config:

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

Vertex homes are **not** stored here. They are derived at runtime in
`components/stage/motion-script.ts` by measuring the viewport and resolving the
`--mat-safe-inset-*` tokens via a probe element (not `getComputedStyle` string-parse,
which fails for `clamp()` values). To change the shape or margins, edit those tokens in
`global.css`; `motion-script.ts` picks them up automatically.

**`src/components/scroll-engine/config.ts`** exports the beat unit and scroll/fly-away timing:

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

---

## Portfolio browse: `src/pages/work-browse/config.ts` and `src/pages/work-browse/projects-data.ts`

Same split as `stage/config.ts`/`scroll-engine/config.ts` above, applied to the `/work`
grid (Epic 19): content and knobs live in separate files, and knobs are further split by
who consumes them.

- **`src/pages/work-browse/projects-data.ts`** exports the typed `Project[]` array -- the
  content (slug, year, name, role, title, description, optional image). This is what grows
  as real case studies replace the dummy entries; nothing here is a design/geometry value.
- **`src/pages/work-browse/config.ts`** exports `BrowseConfig` and the `browse` object -- every gutter,
  card dimension, dwell length, and reveal timing the grid, the card, and the paging motion
  need. Split within the file by who reads it:
  - **Geometry (px)** -- `columns`, `cardWidth/cardHeight/imageHeight`, `rowGutter`/`colGutter`
    -- is CSS-bound. It doesn't get read as CSS directly; `browseCssVars()` turns it into a
    `Record<string, string>` of `--browse-*` custom properties (e.g. `--browse-card-width:
360px`) that the grid/card container spreads as inline `style`, so markup never carries a
    bracketed arbitrary value -- CSS just reads `var(--browse-card-width)`.
  - **Timing (beats) and behavior** -- `dwellBeats`, `advanceBeats`, `reveal`, `clipToBand` --
    stays JS-only, read directly by the paging motion (Epic 19 Step 7). No CSS equivalent.

`work-browse/config.ts` is the single home for every one of these values -- a later story tuning a
gutter or a dwell length edits the `browse` object, once, rather than a literal buried in a
component.
