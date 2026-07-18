# Story 19.5 — `ProjectCard.astro`

Part of **`docs/epics/epic-19-portfolio-browse.md`** — its Step 5. The first story that
renders something you can see; it's where 19.3's tokens and 19.4's geometry finally meet.

**Goal:** a single card component that renders one `Project` to match the single-card mock —
image region, the YEAR / **Name** │ role / TITLE / description block, and a Learn More link —
composed entirely from the 19.3 tokens and the 19.4 geometry vars, with no literal values.

**Depends on 19.3** (card tokens), **19.4** (`Project` type + `browseCssVars` + `browse`
geometry), and **19.2** (Jost, so 400/500 render). **Independent of 19.1** — a card is not a
`Chapter`/`Paper`. All prerequisites are done.

**Out of scope:** the grid, the `/work` page, and any motion (Steps 6–7). This story renders
one card, verified on a throwaway harness. Real images are still placeholders.

---

## How we work

Per `CLAUDE.md` → **How we work** and **Conventions**: **Tailwind-first, no arbitrary/bracket
values.** Every color, size, and geometry value is a generated utility or a
`utility-(--token)` custom-property reference (which `CLAUDE.md` explicitly allows —
`left-(--tl-line-x)` is the precedent). Custom CSS only under the three documented reasons.
Verify against the rendered card, wide window.

---

## The card, as structure + tokens

`src/components/ProjectCard.astro` takes one prop and reads geometry from ancestor-injected
vars (the grid sets them in Step 6; the harness sets them here):

```astro
---
import type { Project } from "../data/projects";
interface Props { project: Project }
const { project } = Astro.props;
const { slug, year, name, role, title, description, image } = project;
---
```

Structure and the exact token→utility mapping — this is the spec, assemble from it:

- **Card root** `<article>` — `font-sans` (Jost; without it the card inherits Caslon),
  `bg-foreground`, `overflow-hidden` (enforces uniform height — long copy is clipped, as you
  said you'd cut to fit), `flex flex-col`, `w-(--browse-card-width) h-(--browse-card-height)`,
  `shadow-(--card-shadow)`. No rounding (mock is square-cornered). `--card-shadow` defaults to
  the lift and drops to `none` from `global.css` alone — the toggle we discussed, no card edit.

- **Image region** `<div class="w-full h-(--browse-image-height) overflow-hidden shrink-0">` —
  if `image`, an `<img class="w-full h-full object-cover" alt={name}>`; else a placeholder
  `<div class="w-full h-full bg-neutral-400" aria-hidden="true">`. The neutral fill is
  temporary scaffolding that disappears with real imagery — not worth a brand token; flag if
  you'd rather tokenize it.

- **Content region** `<div class="flex flex-col p-6 gap-2">` — internal padding/rhythm use the
  Tailwind spacing scale (tune `p-6`/`gap-2`), distinct from the config-driven *card* geometry.

  | Element     | Classes (size + color + weight + case)                                                   |
  | ----------- | ---------------------------------------------------------------------------------------- |
  | YEAR        | `text-card-eyebrow text-card-meta font-normal uppercase`                                  |
  | Name        | `text-card-name text-card-heading font-medium`                                            |
  | Divider     | `w-(--card-divider-width) h-(--card-divider-height) bg-(--card-divider-color) mx-(--card-divider-gap) shrink-0` + `aria-hidden` |
  | Role        | `text-card-name text-card-meta font-medium`                                               |
  | TITLE       | `text-card-eyebrow text-card-meta font-normal uppercase`                                  |
  | Description | `text-card-body text-card-description font-normal` (optional `line-clamp-3` for graceful truncation) |

  Name + divider + role sit in one `<div class="flex items-center">`. Note this is exactly the
  19.3 collision design paying off: `text-card-eyebrow` (size) and `text-card-meta` (color)
  coexist on YEAR because they're different generated utilities.

- **Learn More** `<a href={`/work/${slug}`}>` styled as the button —
  `inline-block bg-card-button text-card-on-button text-card-body font-normal uppercase
  px-(--card-button-pad-x) py-(--card-button-pad-y)`. Give it `aria-label={`Learn more about
  ${name}`}` — "Learn More" alone is poor link text out of context. It's an `<a>`, so it's
  shareable and works under the SPA router. (Per your spec only the button navigates; whole-
  card-clickable is an easy later enhancement if you want it.)

The **divider** is the one crispness watch-point: `--card-divider-width` is `0.5px`, which is
crisp on 2× displays but can thin-out or vanish at 1× DPI. Start with the token-driven
utilities above; if 1× rendering disappoints, the fallback is a 1px element with
`transform: scaleX(.5)` in a small `<style>` block (custom CSS justified under `CLAUDE.md`
reason 1, with the comment). Don't reach for that unless the plain version actually fails.

---

## Task 1 — Build the component

Assemble `ProjectCard.astro` per the mapping above. Placeholder branch for missing images;
`font-sans` on the root; the button as a real link to `/work/<slug>`.

**Verify & note:** `astro check` clean; props typed against `Project`.

---

## Task 2 — Verify on a throwaway harness

Stand up a temporary page that spreads `browseCssVars()` onto a wrapper and renders a few
cards from `projects`, then check at desktop width against the mock:

- Proportions and the YEAR / Name │ role / TITLE / description / button layout match; type is
  Jost with **400 vs 500 visibly distinct** (name/role medium, the rest regular).
- The slate/black/gray split is right; the divider reads as a thin slate hairline ~20px tall
  with the 6px gaps; the button is a white uppercase label on slate with the padding tokens.
- **Uniform height holds** — render one card with a short description and one with a long one;
  both are the same height, the long one clipped (this is the whole point of the fixed
  `--browse-card-height`).
- `--card-shadow: none` in `global.css` drops the lift cleanly, card code untouched.
- Learn More points at `/work/<slug>` and is keyboard-focusable.

Then **remove the harness** — Step 6 provides the real mount (the grid on `/work`).

**Verify & note:** attach a screenshot beside the mock; confirm uniform height across copy
lengths, the shadow toggle, and the hrefs; confirm harness removed.

---

## Done when

- `src/components/ProjectCard.astro` renders one `Project` matching the mock, entirely from
  19.3 tokens and 19.4 geometry vars — no arbitrary/bracket values, Tailwind-first, custom CSS
  only if the divider forced it (documented).
- `font-sans` is on the root; 400/500 render distinctly; the gray placeholder shows when an
  image is absent.
- Uniform card height holds across differing copy; `--card-shadow` toggles keep/drop from
  `global.css` alone.
- Learn More is an accessible `<a>` to `/work/<slug>`.
- `astro check` clean; the verification harness is removed.
