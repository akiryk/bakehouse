# Story 19.3 — Card look-tokens in `global.css`

Part of **`docs/epics/epic-19-portfolio-browse.md`** — its Step 3. The token homes are
described in `docs/design-tokens.md`.

**Goal:** add the design values the portfolio card needs — colors, type sizes, the divider,
the button, the card shadow — to `global.css`, so the card component (a later story) consumes
named tokens and never a literal. This story defines and verifies the tokens; **it does not
build the card.**

**Depends on Story 19.2** (Jost must exist to verify family and the 400/500 weights).
**Independent of Story 19.1** — both touch `global.css`, but 19.3 only *adds* tokens and 19.1
doesn't touch the token blocks at all, so they merge cleanly. `--palette-slate` (#8a9ba5) and
`--palette-gray` (#4d4d4d) already exist; this story adds `--palette-black` and the card tokens.

**Out of scope:** the `ProjectCard` component, the divider's crisp-hairline *rendering*
technique, and the button's markup — all later (Epic 19, Step 5). Only the *values* live here.

---

## The spec, as tokens

The single-card mock maps to these tokens. Sizes default to **pt = px** (see the flag in the
handoff note); weights are Jost 400/500; case is applied in the component.

| Element      | Size token (value)            | Weight | Case  | Color token(s)                                            |
| ------------ | ----------------------------- | ------ | ----- | --------------------------------------------------------- |
| YEAR         | `--text-card-eyebrow` (10px)  | 400    | UPPER | `--color-card-meta` (slate)                               |
| Project Name | `--text-card-name` (14px)     | 500    | —     | `--color-card-heading` (black)                            |
| Divider      | `--card-divider-*` (0.5×20px) | —      | —     | `--card-divider-color` (slate)                            |
| My Role      | `--text-card-name` (14px)     | 500    | —     | `--color-card-meta` (slate)                               |
| TITLE        | `--text-card-eyebrow` (10px)  | 400    | UPPER | `--color-card-meta` (slate)                               |
| Description  | `--text-card-body` (12px)     | 400    | —     | `--color-card-description` (gray)                         |
| Learn More   | `--text-card-body` (12px)     | 400    | UPPER | bg `--color-card-button` (slate) · text `--color-card-on-button` (white) |

Learn-More padding: `--card-button-pad-x` (10px) · `--card-button-pad-y` (4px). Button label
color is white in the mock — assumed `--color-foreground`; flag if it should differ.

---

## How we work

Per `CLAUDE.md` → **How we work**. Every value is a token; **no arbitrary/bracket values**
anywhere. `astro check` stays clean. Verify against the rendered swatch, not the source.

---

## Task 1 — Palette

Add one entry to the `:root` **Color palette** block:

```css
--palette-black: #000; /* project-card name ink; nothing else in the palette is pure black */
```

`--palette-slate` and `--palette-gray` are already present — reuse them, don't re-add.

**Verify & note:** the palette block still has one entry per distinct color.

---

## Task 2 — Type sizes and colors in `@theme`

These generate the utilities the card will use. **Read the collision note before naming
anything.**

```css
@theme {
  /* ── Project card — type sizes (generate text-card-* SIZE utilities) ── */
  --text-card-eyebrow: 10px; /* YEAR, TITLE */
  --text-card-body: 12px;    /* description, Learn More label */
  --text-card-name: 14px;    /* project name, role */

  /* ── Project card — colors (generate text-/bg-card-* COLOR utilities) ──
     COLLISION NOTE: in Tailwind v4 the `text-*` utility is generated from
     BOTH --text-* (size) and --color-* (color). A size suffix and a color
     suffix that match (e.g. --text-card-body + --color-card-body) would
     both emit `.text-card-body` and collide. The color suffixes below
     (meta/heading/description/button/on-button) are kept DISJOINT from the
     size suffixes above (eyebrow/body/name) on purpose. Do NOT add
     --color-card-eyebrow / --color-card-body / --color-card-name. */
  --color-card-meta: var(--palette-slate);        /* YEAR, TITLE, role */
  --color-card-heading: var(--palette-black);     /* project name */
  --color-card-description: var(--palette-gray);   /* description */
  --color-card-button: var(--palette-slate);      /* button background */
  --color-card-on-button: var(--color-foreground); /* button label (white) */
}
```

So the card will compose, e.g., a size utility + a color utility on one element
(`text-card-name text-card-heading` for the project name — different class names, one sets
size, the other color; no conflict).

**Verify & note:** `astro check` clean; each token resolves; confirm no doubled `.text-card-*`
rule slipped in (the collision note is the thing to get right).

---

## Task 3 — Divider, button padding, and the card shadow in `:root`

These are consumed as plain CSS by the (future) card element — no utility needed — so they sit
in `:root` alongside the other geometry/shadow params (the `--paper-shadow-*` precedent):

```css
:root {
  /* ── Project card — divider rule ──
     A thin vertical hairline between name and role. The 0.5px width renders
     inconsistently at 1× DPI; the COMPONENT (Step 5) draws it with a crisp-
     hairline technique — this just holds the values. */
  --card-divider-color: var(--palette-slate);
  --card-divider-width: 0.5px;
  --card-divider-height: 20px;
  --card-divider-gap: 6px; /* left/right padding around the rule */

  /* ── Project card — Learn More button padding ── */
  --card-button-pad-x: 10px;
  --card-button-pad-y: 4px;

  /* ── Project card — shadow ──
     Defaults to the existing --shadow-card lift so the card renders WITH a
     shadow and the keep/soften/drop call can be made from the real grid
     (the mock shows none). To drop it: set this to `none`. To soften it:
     retune here. One line, no card-code change either way. */
  --card-shadow: var(--shadow-card);
}
```

**Verify & note:** all resolve; `--card-shadow` swaps to `none` cleanly when tested.

---

## Task 4 — Prove it with a throwaway swatch, then remove it

Drop a temporary swatch onto any existing page and confirm, in the browser (Jost from 19.2
loaded):

- Each color token renders the right hue (meta/divider/button = slate, heading = black,
  description = gray, on-button = white).
- Each type role renders at the right size/weight/case per the table — and **400 vs 500 are
  visibly distinct** (if not, Jost's variable axis isn't loading; `font-synthesis: none` means
  there's no fake-bold hiding it — fix 19.2 before continuing).
- A divider sample reads as a thin slate hairline ~20px tall; a button sample shows a white
  uppercase label on slate with the padding tokens.

Then **remove the swatch** — this story ships tokens only.

**Verify & note:** attach the swatch screenshot, confirm removal, confirm `astro check` clean.

---

## Task 5 — Docs

In `docs/design-tokens.md`, add a short **Project card** subsection listing these tokens and
their roles, and record the two things a future reader will otherwise trip on: the `text-*`
size/color collision rule (why the suffixes are disjoint), and that `--card-shadow` is the
one-line keep/drop dial for the card lift.

**Verify & note:** the doc matches the tokens as written.

---

## Done when

- `--palette-black` exists; `--palette-slate` / `--palette-gray` reused, not duplicated.
- The card type-size and color tokens are in `@theme` with disjoint `text-*` suffixes (no
  colliding `.text-card-*` rule); the divider, button-padding, and `--card-shadow` tokens are
  in `:root`.
- A throwaway swatch confirmed every token against the mock in Jost, with 400 ≠ 500 rendering
  distinctly — then was removed.
- `docs/design-tokens.md` documents the card tokens, the collision rule, and the shadow dial.
- No arbitrary values anywhere; `astro check` clean.
