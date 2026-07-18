# Story 19.4 — Project data + the browse config object

Part of **`docs/epics/epic-19-portfolio-browse.md`** — its Step 4. Config-file conventions
follow the existing `src/config/octagon.ts` / `src/config/scroll.ts` pattern (typed objects
consumed by GSAP, kept out of the styling layer — see `docs/design-tokens.md`).

**Goal:** two typed TypeScript files — the **content** (`src/data/projects.ts`, the list of
projects) and the **knobs** (`src/config/browse.ts`, every gutter/size/dwell/timing value the
grid, the card, and the motion will read). Nothing baked into a component later: this is the
single place a gutter or card size gets changed.

**Fully standalone.** No `global.css`, no components, no `Base.astro`. Independent of
19.1/19.2/19.3 — it can land in any order and in parallel. It *enables* the card (Step 5),
the grid (Step 6), and the motion (Step 7), which read from these files.

**Out of scope:** rendering anything — no card, no grid, no images. Placeholder imagery and
the card's internal layout come with `ProjectCard` (Step 5). The `.astro` glue that spreads
these vars onto a container is Step 6.

---

## How we work

Per `CLAUDE.md` → **How we work**. `astro check` clean. The one rule that matters here:
**this is the single source.** If a later story needs a gutter, a card dimension, or a dwell
length, it reads it from here — it does not reintroduce a literal.

---

## Task 1 — `src/data/projects.ts`

A typed array of dummy projects. Keep the shape regular so a CMS/content-collection migration
stays open later (per `CLAUDE.md`); a plain typed array is enough for now.

```ts
export interface Project {
  slug: string;        // url-safe; drives /work/<slug> (Step 8)
  year: string;        // e.g. "2011–2012"
  name: string;        // project / client name — the bold line
  role: string;        // "My Role" — e.g. "Senior Art Director"
  title: string;       // the small UPPERCASE label above the description
                       // (the mock's "TITLE"; the reference's "BRIEF") — NOT the project name
  description: string; // the brief body; kept short — copy is cut to fit a uniform card
  image?: string;      // optional; the card renders a gray placeholder when absent (Step 5)
}

export const projects: Project[] = [
  /* Seed from the reference mock — enough entries for several rows so the paging
     motion (Step 7) has something to advance through (aim for ~9 → 3 rows). Dummy
     copy is fine; you'll rewrite as designer. */
];
```

Seed roughly nine entries drawn from the reference (OceanSpray / Wine Smarts Guide, Carnival
Cruise Lines, the cranberry-smoothie recipe, the registry/furniture/WCRB peekers, etc.) with
short placeholder descriptions and no images yet.

**Verify & note:** `astro check` clean; the array is typed; slugs are unique and url-safe.

---

## Task 2 — `src/config/browse.ts`

The knobs, with documented starting-point defaults. Split by who consumes them: **geometry**
(px) is read by CSS via injected vars; **timing** (beats) and **behavior** are read by
GSAP/JS. Values are starting points — the whole reason they're here is to be tuned from the
rendered grid, not guessed perfectly now.

```ts
export interface BrowseConfig {
  columns: number; // cards per row

  // ── Card geometry (px) — uniform across every project ──
  cardWidth: number;
  cardHeight: number;  // fixed; copy is cut to fit (uniform cards)
  imageHeight: number; // image region; the text block fills the remainder

  // ── Gutters (px) ──
  rowGutter: number;   // vertical gap between rows (stays constant between rows)
  colGutter: number;   // horizontal gap between columns

  // ── Vertical placement ──
  dwellTop: number;    // fraction of viewport height where the resting row's top sits (~top third)
  peek: number;        // px of the next row left visible below the resting row

  // ── Scroll timing (beats) — consumed by the motion, not CSS ──
  dwellBeats: number;   // pause per row before it advances ("a beat or two")
  advanceBeats: number; // scroll length of one row→row transition

  // ── First-load reveal (fade + rise) ──
  reveal: {
    delayBeats: number; // 0 = immediate; >0 = hold before revealing (the "right away vs after a delay" knob)
    overBeats: number;  // reveal duration
    rise: number;       // px the cards rise from as they fade in
  };

  // ── Exit behavior ──
  clipToBand: boolean; // false = leaving rows slide off-top under the nav; true = clip at a rectangular band
}

export const browse: BrowseConfig = {
  columns: 3,
  cardWidth: 360,
  cardHeight: 420,
  imageHeight: 190,
  rowGutter: 40,
  colGutter: 40,
  dwellTop: 0.3,
  peek: 60,
  dwellBeats: 1.5,
  advanceBeats: 1,
  reveal: { delayBeats: 0, overBeats: 0.75, rise: 40 },
  clipToBand: false,
};
```

Then the **geometry → CSS bridge**, so the card and grid can style themselves off named vars
(no bracketed arbitrary values in markup) from this one source:

```ts
/** The geometry CSS needs, as custom properties. Timing/behavior stay JS-only.
    Steps 5–6 spread this onto the card/grid container; CSS reads var(--browse-*). */
export function browseCssVars(c: BrowseConfig = browse): Record<string, string> {
  return {
    "--browse-columns": String(c.columns),
    "--browse-card-width": `${c.cardWidth}px`,
    "--browse-card-height": `${c.cardHeight}px`,
    "--browse-image-height": `${c.imageHeight}px`,
    "--browse-row-gutter": `${c.rowGutter}px`,
    "--browse-col-gutter": `${c.colGutter}px`,
  };
}
```

**Verify & note:** `astro check` clean; `browseCssVars()` returns the expected keys/values
(a quick logged call or a small assertion, per `docs/testing.md`'s conventions); every field
is documented so the next reader changes a value here, once, without hunting.

---

## Task 3 — Docs

Add a short **Browse** entry to `docs/design-tokens.md` (or wherever config files are indexed)
noting the split: geometry in px → CSS via `browseCssVars`; timing in beats → the motion; and
that `browse.ts` is the single home for the grid's gutters, sizes, dwell, and reveal timing.

**Verify & note:** the doc points a future reader at `browse.ts` for these knobs.

---

## Done when

- `src/data/projects.ts` exports a typed `Project[]` with ~9 unique-slug dummy entries and the
  `title` field documented as the label (not the name).
- `src/config/browse.ts` exports a typed `BrowseConfig`, the `browse` object with documented
  defaults, and `browseCssVars()` emitting the geometry custom properties.
- Geometry (px, CSS-bound) and timing (beats, JS-bound) are cleanly separated and each field
  is commented.
- `docs/design-tokens.md` records `browse.ts` as the single home for the grid knobs.
- `astro check` clean; no rendering introduced.
