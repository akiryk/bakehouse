# Story 19.1 — Neutralize `Chapter`, extract `Paper`

Part of **`docs/epics/epic-19-portfolio-browse.md`** — its Step 1, with Step 0's recon
folded into the opening. Read that epic for the surrounding context and the other docs it
leans on (`CLAUDE.md`, `docs/architecture.md`, `docs/authoring-content.md`,
`docs/design-tokens.md`, `docs/motion.md`).

**Goal:** replace the `paper` / `paperless` boolean on `Chapter.astro` with composition — a
**neutral `Chapter`** (just the `[data-chapter]` marker the engine sequences) plus an
**opt-in `Paper`** (the white card + shadow, wrapped around content when you want that look).
"Sometimes paper, sometimes not" becomes composition, not a negated flag.

**This story ships nothing new that a visitor can see. Its success condition is that
`home` and `about` look and behave exactly as they do today.** It's the prerequisite the
rest of Epic 19 stacks on, done first precisely so the shared-code change is de-risked
before any browse surface piles on top of it.

**Out of scope:** anything browse-facing (the `/work` page, cards, data, motion — later
stories); the Futura→Jost swap (Story 19.2); any visual redesign of the existing chapters.

---

## How we work

Per `CLAUDE.md` → **How we work**: autonomously, quality upheld as you go. **Verify against
the rendered result** — the page and the DOM — not against your own report, in both a
**wide** and a **tall/narrow** window. `astro check` must stay clean throughout (it's the
always-on gate); the format-on-write hook handles formatting. Leave a short note after each
task; continue unless the note holds a question.

---

## Task 0 — Recon, and capture a baseline

Before editing, read the surface this touches so the refactor matches reality:

- `layouts/Base.astro` — confirm `.foreground-stage` is `pointer-events: none` (this is why
  each chapter article must restore `pointer-events: auto`), and how chapter children are
  z-stacked.
- `layouts/StageLeft.astro` (and any `StageCenter`) — how a chapter paper is positioned, so
  you can tell whether re-homing the width (Task 4) shifts anything.
- All four existing `Content.astro` files — `intro`, `services`, `about`, `timeline` — the
  exact migration surface.
- `motion/engine.ts` — confirm the engine targets `[data-chapter]` and transforms **that
  article** (so `will-change` must stay on it, Task 2).

Then **capture a baseline to diff against** — this refactor's whole claim is "nothing
changed," so make that checkable. With the current code, screenshot via Playwright at a wide
and a tall viewport: `home` at rest, `home` mid-fly-away (part-scrolled), `about` at rest,
and `about` under `prefers-reduced-motion`. Keep them for the Task-5 comparison.

**Verify & note:** node ≥ 22.12, dev server + `astro check` clean, aliases in use, which
Stage layout positions each chapter, and that the baselines are captured.

---

## Task 1 — `components/Paper.astro`

Lift the visual card out of the current paper branch of `Chapter.astro` into its own
component. It renders:

- Root: `relative isolate w-(--chapter-paper-width)`. **`isolation: isolate` lives here now**
  — it's what keeps the shadow at `z-0` behind content at `z-1` without a negative z-index —
  and the width lives here too (a paper concern, not every chapter's).
- The two-element shadow, unchanged: `.chapter-shadow-wrap` (the `blur()` + `calc(-1 * poke)`
  insets) containing `.chapter-shadow-shape` (the `clip-path: polygon()` trapezoid + color +
  opacity), all driven by the existing `--paper-shadow-*` tokens.
- `.chapter-paper-content` — the padded white box (`pr-16 pb-12 pl-12 min-h-(--min-h-chapter)`,
  `bg-foreground`, `relative z-1`) with the **optional `header` / `main` / `footer` slots**.
  The named-slot ergonomics move here; `Chapter` no longer offers them.

**Preserve the class names** `.chapter-paper-content`, `.chapter-shadow-wrap`,
`.chapter-shadow-shape` verbatim. `global.css` matches on them — notably the About
reduced-motion rule `[data-chapter="about"] .chapter-paper-content { … overflow-y: auto }`.
Renaming silently breaks that rule (and any like it).

Drop the static `id="chapter-paper"` / `id="chapter-paper-content"` attributes while you're
here — nothing references them (the engine uses `[data-chapter]`, `global.css` uses the
classes), and they currently render **duplicated** on Home, where `intro` and `services` are
both paper chapters. Invisible correctness win.

**Verify & note:** `Paper` renders in isolation (a scratch page or an existing chapter) with
its shadow and padding identical to today's paper.

---

## Task 2 — `Chapter.astro` → neutral marker

Reduce `Chapter` to the transform target and nothing visual:

- `<article class="chapter relative pointer-events-auto" data-chapter={id}>` with
  `will-change: transform` and a single default `<slot />`.
- **Remove the `paper` prop and the entire bare branch.** `Chapter` no longer knows what a
  card is.

Two placements are load-bearing, both confirmed against the current code:

- **`will-change: transform` stays on this article** — it's the element the engine actually
  transforms, so the fly-away must be promoted here, not on `Paper`. (In the old code it sat
  on `.chapter-paper` / `.chapter-bare`, i.e. the article — same place.)
- **`pointer-events: auto` stays** — `Base.astro` sets `.foreground-stage` to
  `pointer-events: none`; this is the per-chapter opt-back-in. The old bare branch carried a
  comment about exactly the bug that appears without it (content unselectable, events falling
  through to the mat).

**Verify & note:** `astro check` clean; no remaining references to a `paper` prop anywhere.

---

## Task 3 — Migrate the four chapters

Mechanical, one at a time, each eyeballed against its baseline before moving on:

- **Paper chapters — `intro`, `services`, `about`:** wrap the slotted content in `<Paper>`,
  add the `@components/Paper.astro` import. The slot attributes now target `Paper`:
  ```astro
  <StageLeft>
    <Chapter id="intro">
      <Paper>
        <div slot="main" class="pt-16">…</div>
      </Paper>
    </Chapter>
  </StageLeft>
  ```
  `intro`'s scoped `.link` / `.blank` `<style>` is unaffected (it targets elements in
  `intro`'s own template) — but confirm the custom underline and the ruled name-blank still
  render, they're a sharp pixel-identical tell.
- **Paperless chapter — `timeline`:** drop `paper={false}`; move its slot content **verbatim**
  into `Chapter`'s default slot (no `slot="main"` wrapper now — the named slots live on
  `Paper`, which the timeline doesn't use). Its internal structure (`.tl-stage`,
  `.tl-card-anchor`, the `ProductCard`s, `--tl-line-x`) sits *inside* that content and is
  untouched. **This is the highest-risk migration** — the most internal structure, and the
  `.tl-*` machinery in `global.css` assumes it renders where it does. Verify the timeline
  chapter especially carefully, and watch for any dependence on the old `.chapter-bare-content`
  or `.chapter-main` wrapper classes (there shouldn't be — neither appears in `global.css` —
  but confirm rather than assume).

**Verify & note:** all four chapters render; call out anything that shifted by even a hair.

---

## Task 4 — Re-home the width; confirm Stage geometry

Width moved from the article to `Paper` (Task 1). If the now-full-width neutral article
shifts a `StageLeft` chapter's paper horizontally, fix it in the Stage layout or `Paper` —
**not** by special-casing the engine. Let the baseline diff be the judge, at both viewports.

**Verify & note:** each chapter's paper sits exactly where it did.

---

## Task 5 — Update the docs, then diff

The docs currently describe the thing you just removed:

- `architecture.md` — the foreground layer and the escape-hatch ladder: "paper is opt-in
  composition (`Chapter` + `Paper`)" replaces "one paper per chapter; `paper={false}` to skip."
- `authoring-content.md` — the `Content.astro` shape: `Chapter` wraps content; `Paper` is the
  optional card with the `header` / `main` / `footer` slots. Update the standard/paperless
  examples accordingly.
- `design-tokens.md` — the **Paper shadow tokens** section still describes an old `::before` /
  `--paper-shadow-rotate` mechanism. That's already stale versus the real two-element
  `poke-x/y` trapezoid; correct it to match what `Paper` now renders.

Then **diff against the Task-0 baselines**: `home` at rest and mid-fly-away, `about` at rest
and under reduced motion, wide and tall.

**Verify & note:** confirm the docs describe reality and attach/point to the before/after
comparison.

---

## Done when

- `Chapter.astro` has no `paper` prop and no card markup — just the `[data-chapter]` article,
  `pointer-events: auto`, `will-change: transform`, and a default slot.
- `Paper.astro` renders the card (isolation, width, two-element shadow, padded
  `.chapter-paper-content` with header/main/footer slots), with those class names preserved.
- `intro`, `services`, `about` compose `Chapter` + `Paper`; `timeline` uses a bare `Chapter`.
- `home` and `about` are **visually indistinguishable** from the baselines at both viewports;
  the fly-away still runs on a composited layer; `Home` is still clickable at max scroll on
  About; About under reduced motion still shows a scrollable content box.
- `astro check` is clean and the three docs match the new composition.
