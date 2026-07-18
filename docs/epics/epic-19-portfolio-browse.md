# Epic — Portfolio Browse (desktop)

> Next in sequence — the codebase is past Epic 18, so renumber the filename to fit
> (`epic-19-portfolio-browse.md` or wherever it lands).

**Goal:** stand up a `/work` page that presents projects as a scroll-paged grid of
uniform cards — three per row, the active row dwelling in place before it carries off
the top while the next row arrives and more peek up from below — with every gutter,
size, position, and timing living in one config object. Folded in ahead of it: a small
architectural refactor that replaces the `paper` / `paperless` boolean with composition
(a neutral `Chapter` plus an opt-in `Paper`), and the app-wide **Futura → Jost** font
swap. **Desktop only.** Rough motion is fine to start; real is the bar, polish is later.

**Out of scope:** responsive / small-screen layout (explicitly later); real project copy
and imagery (placeholders now — you'll write and cut as designer); a CMS / content
collections (the data shape stays regular enough to allow it later); cropping cards to the
wobbling mat shape (deferred by prior decision — a plain rectangular exit is all we do
now); the visual design of project detail pages (placeholder copy only); final
easing / dwell tuning.

---

## How we work this epic

Per `CLAUDE.md` → **How we work**: autonomously, quality upheld as you go, pausing only for
genuine decisions. Move through the steps in order; after each, **verify against the
rendered result** — the page and the DOM, in both a **wide** and a **tall/narrow** window,
via Playwright for anything scroll-driven — then leave a short note (what you did, how you
verified, anything hacky/risky/surprising) and continue unless the note holds a question.
The steps are for legibility and verification, not approval gates.

Two decisions are already baked in below; flag if either is wrong before building on it:

- **Placement** — browse is its own `/work` page (matches the nav), `useScrollEngine:
  true`, with the grid as its single chapter.
- **Exit** — a row leaving the top translates fully off the top of the window, sliding
  _under_ the fixed nav/logo (they keep the higher z-index). No clip. If a card visibly
  crossing the nav band mid-flight looks wrong once it's moving, the fallback is a plain
  rectangular `overflow:hidden` band (a straight rectangle — **not** the mat shape); it's a
  one-container change, called out in Step 7.

---

## Step 0 — Recon & inputs

Writing the plan needed six files; executing it touches more. Before changing anything,
read the surface this epic actually edits, so the refactor and the motion match reality
rather than the Epic-01 sketch:

- `layouts/Base.astro` — the `astro:page-load` dispatch (where `initWorkPage()` gets wired),
  the `<head>` (where the Google Fonts embed goes, mirroring the Adobe Fonts `<link>`), the
  `page` prop → `document.body.dataset.page`, and the persistent mat / nav / `.foreground-stage`.
- `layouts/StageLeft.astro` and any `StageCenter` — how a chapter is positioned; whether
  one suits the centered browse grid or the chapter positions its own container.
- **Every** existing `Content.astro` (`intro`, `services`, `about`, `timeline`) — the exact
  migration surface for Step 1.
- `motion/engine.ts` (the `ChapterMotion` type + how `beats()` is scrubbed over a dwell
  window), `motion/page-script.ts` (`at` / `chapter` / `enter` / `exit`), `motion/timeline-kit.ts`
  (`morph` / `hold` / `compile`), `motion/presets.ts` (`fadeInUpFrom/To`, `shiftUp`),
  and `about.script.ts` (the trailing-`hold` pattern + a one-chapter page script).

Also confirm: `node -v` ≥ 22.12; dev server + `astro check` run clean; path aliases in use
(`@components`, `@layouts`, `@motion`; note `pages.ts` is imported relatively). Confirm the
tokens this epic leans on already exist — they do in the copy I have: `--shadow-card`,
`--palette-gray` (#4d4d4d), `--palette-slate` (#8a9ba5), `--font-sans` (currently Futura).

**Verify & note:** versions, alias list, which Stage layout (if any) fits the grid, and a
one-line inventory of the existing chapters and which are paper vs. paperless today.

---

## Step 1 — Refactor: neutralize `Chapter`, extract `Paper`, migrate

This is the honest-exception shared-code change `CLAUDE.md` says to flag — but it's
contained, and it's the prelude the rest of the epic sits on. Do it first and prove the
existing pages are untouched by it before any browse work.

- **New `components/Paper.astro`** — the visual card, lifted from the current paper branch
  of `Chapter.astro`: the `relative isolate w-(--chapter-paper-width)` block, the
  two-element shadow (`.chapter-shadow-wrap` blur + `.chapter-shadow-shape` clip trapezoid,
  driven by the `--paper-shadow-*` tokens), and the padded `.chapter-paper-content` box with
  the optional `header` / `main` / `footer` slots. **Keep the class names** `.chapter-paper-content`,
  `.chapter-shadow-wrap`, `.chapter-shadow-shape` — `global.css` rules (the About
  reduced-motion rule; any others) match on them, so renaming silently breaks them.
  `isolation: isolate` moves here (it's what keeps the shadow at `z-0` behind content at
  `z-1`); `w-(--chapter-paper-width)` moves here (width is a paper concern, not every
  chapter's).
- **`Chapter.astro` → neutral marker** — just the `[data-chapter]` transform target:
  `<article class="chapter relative pointer-events-auto">` with `will-change: transform`
  and a single default `<slot />`. Drop the `paper` prop and the entire bare branch.
  - `will-change: transform` **stays on this article** (the element the engine actually
    transforms), _not_ on `Paper` — this is the compositing detail that's easy to lose in
    the move.
  - `pointer-events-auto` **stays** — `Base.astro` sets `.foreground-stage` to
    `pointer-events:none`, and this is what restores it per chapter (the code comment in the
    old bare branch documents exactly the bug that appears if it's dropped).
- **Migrate the existing chapters** (mechanical, one at a time, each verified):
  - Paper chapters (`intro`, `services`, `about`): wrap their slotted content in `<Paper>` —
    `<Chapter id="intro"><Paper><div slot="main">…</div></Paper></Chapter>`.
  - Paperless chapters (`timeline`): drop `paper={false}`; content goes straight into
    `Chapter`'s default slot (adjust any `slot="main"` wrappers, since the named slots now
    live on `Paper`, not `Chapter`).
- **Resolve the width re-home carefully.** Width was on the article; it's now on `Paper`. If
  the neutral article going full-width shifts a `StageLeft` chapter's paper, fix it in the
  Stage layout / `Paper`, not by special-casing the engine — and let the pixel-identical
  check below be the judge.
- **Update the docs to describe composition, not a boolean:** `architecture.md` (the
  foreground layer + the escape-hatch ladder — "paper is opt-in composition" replaces
  "one paper per chapter, `paper={false}` to skip"), `authoring-content.md` (the
  `Content.astro` shape: `Chapter` + optional `Paper`), and `design-tokens.md`'s **Paper
  shadow tokens** section, which still describes an old `::before` / `--paper-shadow-rotate`
  mechanism that no longer matches the actual `poke-x/y` trapezoid.

**Verify & note:** `home` and `about` render **pixel-identical** to before (Playwright,
wide + tall) — same paper geometry, same shadow, same intro underline/blank. The fly-away
still runs on a composited layer (the transform is on the `[data-chapter]` article). Nav
`Home` is still clickable at max scroll on About. About under reduced motion still shows a
scrollable content box. This step ships nothing new visually — its whole success condition
is "nothing changed."

---

## Step 2 — Fonts: Futura → Jost (app-wide)

- Wire **variable Jost** from Google Fonts as a `<link>` in `Base.astro`'s `<head>`,
  mirroring the existing Adobe Fonts embed pattern. Request the weight axis (or at minimum
  400 + 500 — the card spec uses Regular and Medium).
- In `global.css`, swap the `--font-sans` family to `"Jost", <fallbacks>`. This is
  intentional and app-wide: `--font-sans` was Futura; everything on it (nav, any UI labels)
  moves to Jost.
- Jost's metrics differ from Futura's, so **verify existing `font-sans` usages** (nav
  especially) still sit right — not just the new cards. Confirm the variable weights
  actually resolve (a 400 vs 500 that look identical means the axis isn't loading).

**Verify & note:** which elements changed font, that 400/500 render distinctly, and that
the fallback stack holds before the kit loads. Don't block later steps on the embed — the
fallback should render cleanly meanwhile.

---

## Step 3 — Card look-tokens in `global.css`

Colors, type sizes, and the divider are **look** — they belong in the `@theme` block, named
by role, referencing the palette. (Geometry and timing are _not_ here — they're Step 4's
config object.) No arbitrary values anywhere.

- Add `--palette-black: #000` to the `:root` palette (Project Name is pure black; nothing
  in the palette is).
- Add card semantic colors over the palette: meta / title / role / divider → `--palette-slate`;
  name → `--palette-black`; description → `--palette-gray`; Learn-More background →
  `--palette-slate`, its text → `--color-foreground` (white on slate, per the mock).
- Add card type sizes as `--text-*` tokens (points → px at 96/72, unless you meant these as
  px — flag if so): eyebrow/title 10pt ≈ 13.3px, name/role 14pt ≈ 18.7px, body 12pt ≈ 16px,
  button 12pt ≈ 16px. Weights: Regular 400, Medium 500. Uppercase where the spec says so.
- Divider tokens: width 0.5px, height 20px, x-padding 6px, color `--palette-slate`. The
  half-pixel rule renders inconsistently at 1× DPI, so the component draws it with a crisp
  hairline technique (a 1px element at `transform: scaleX(.5)`, or equivalent) — documented
  inline per `CLAUDE.md`'s CSS-reason 1.

**Verify & note:** each new token resolves; a throwaway swatch proves the colors and sizes;
remove the swatch after.

---

## Step 4 — Project data + the browse config object

Two files, split by concern — content vs. knobs.

- **`src/data/projects.ts`** — a typed array; one entry per project:
  `{ slug, year, name, role, title, description, image? }`. Seed it with the reference dummy
  projects (OceanSpray, Carnival, …) and gray-placeholder images for now. This is the
  content; it's the thing that grows.
- **`src/config/browse.ts`** — **the** single home for every knob you named, in the spirit
  of `config/octagon.ts` / `config/scroll.ts` (GSAP-consumed values, kept out of the styling
  layer). At least: `columns` (default 3), `cardWidth`, `cardAspect` (or explicit
  `cardHeight` — uniform across projects; overflow is your copy problem, as you said),
  `rowGutter`, `colGutter`, `dwellPosition` (where the active row rests — your "top third"),
  `peek` (how far the next row pokes up), `revealDelay` (immediate vs. delayed first-load
  reveal), `beatsPerPage` (dwell + travel per row advance), and the off-top `exitTarget`.
  Everything documented; **nothing baked into a component**. Where CSS needs a geometry value
  (card width, gutters), the grid container injects it as a named CSS var from this object
  (`style={`--browse-col-gutter:${browse.colGutter}px`}` → CSS uses `var(--browse-col-gutter)`),
  so there's one source and no bracketed arbitrary values in the markup.

**Verify & note:** types compile; confirm the injected-var pattern reads cleanly on the
container (so a future you changes a gutter in _one_ obvious place, never hunts for a stray
`21px`).

---

## Step 5 — `ProjectCard.astro`

- Structure per the single-card mock: image region on top, then YEAR / **Name** │ role /
  TITLE / description / **Learn More**. All type from Step 3's tokens (Jost via
  `font-sans`); the lift from `--shadow-card`; the divider from its tokens; card box
  geometry from the Step-4 injected vars. Learn More links to `/work/<slug>`.
- The card is a first-class component, not a `Paper` — different shadow (`--shadow-card`),
  different internal layout.

**Verify & note:** one card at desktop width matches the mock — spacing, the slate/black/gray
split, the hairline divider, the slate button with white uppercase label.

---

## Step 6 — The browse chapter, static grid first (no motion)

Get the layout right on its own before any scroll is involved.

- **`src/chapters/work/browse/Content.astro`** — a neutral `<Chapter id="browse">`
  (no `Paper`) holding the grid: `columns` across, `rowGutter` / `colGutter` from the
  injected vars, rendering a `ProjectCard` per entry in `projects`. Center it via a Stage
  layout if one fits, else its own container. (Note: existing chapters live under
  `chapters/home/…` even for the About page; `chapters/work/browse/` is the clean home here —
  flag if you'd rather match the existing quirk.)
- **The page:** `src/pages/work.astro` → `<Base page="work">` with the browse content; add a
  `work` entry to `config/pages.ts` (`useScrollEngine: true`, the single `browse` chapter);
  add `initWorkPage()` to `motion/page-init.ts` (dynamic-import its script + motion, code-split
  like Home/About); add the `work` case to `Base.astro`'s `astro:page-load` dispatch.

**Verify & note:** `/work` renders the full grid statically — three uniform cards across,
gutters correct and config-driven, cards identical in size across differing copy lengths.
No motion yet; that's Step 7.

---

## Step 7 — Browse motion: reveal, dwell, advance

The paging is native scroll + scrub — no snap, no wheel/touch hijack. The card column is a
single element the chapter's `beats()` timeline translates upward; the "resistance then
release" feel is the dwell (a flat segment) you scroll through before each advance.

- **`browse/motion.ts`** (+ a `script.ts` if you use the timeline-kit DSL): `beats(container)`
  builds the column timeline —
  1. **First-load reveal:** the initial rows fade + rise in (`fadeInUpFrom → fadeInUpTo`),
     never a hard appear; whether it plays immediately or after a delay comes from
     `browse.revealDelay`. On load the band shows row 1 at `dwellPosition` and row 2 peeking
     by `peek`.
  2. **Per advance:** `[dwell beatsPerPage] → translate the column up one row-step
     (rowHeight + rowGutter)`, repeated. Each advance carries the leaving row fully off the
     top (`exitTarget`, "no trace"), brings the next to `dwellPosition`, and reveals the next
     peek. Reversing scroll runs it backward for free (it's a scrubbed timeline).
- **`work.script.ts`** — place `at(0, chapter("browse", { dwellBeats }))` with **dwellBeats
  derived** from `projects.length` and `browse.beatsPerPage` (the data-driven exception
  flagged at the top — computed from the data array + a config constant, _not_ by importing
  the chapter's own `script.ts`, which the framework forbids). Add a trailing `hold(≥1)` —
  `motion.md` is explicit that the last beat is otherwise unreachable at max scroll.
- **Exit vs. nav:** default is rows sliding under the fixed nav/logo off the top. If that
  reads wrong in motion, wrap the column in the rectangular `overflow:hidden` band (Step 0
  decision) — a straight rectangle, not the mat shape.
- **Reduced motion:** mirror About. Under `prefers-reduced-motion`, no paging / no scrub —
  the grid becomes a static, internally-scrollable column (`overflow-y:auto`, capped height)
  with **every** card present in natural order, reachable by ordinary scroll. Wrap all motion
  in `gsap.matchMedia()`.

**Verify & note (Playwright, the riskiest step — be candid):** scrolling pages the rows with
a real dwell between advances; the leaving row ends fully off-screen with no sliver; the next
set lands where the last sat; further rows peek from below; scroll-up reverses it exactly;
the first-load reveal animates rather than popping; keyboard/native scroll and momentum are
intact (nothing hijacked); reduced motion shows all cards scrollable with no pinning. Check
both a wide and a tall window.

---

## Step 8 — Detail placeholder pages

- `src/pages/work/[slug].astro` with `getStaticPaths` over `projects` — a shareable
  `/work/<slug>` per project (e.g. `/work/carnival`), dummy copy for now, on the shared
  `Base` layout.
- Learn More on each card resolves to its page.

**Verify & note:** every card's button navigates to the right URL on both a cold load and an
SPA transition (the `<ClientRouter />` path), and each URL is directly shareable.

---

## Step 9 — Tidy & epic review

- Remove throwaway swatches / test elements. Confirm **every** value traces to a token
  (`global.css`) or to `config/browse.ts` — no stray literal gutters, sizes, or timings.
- Docs pass: the folder map in `CLAUDE.md`, plus `architecture.md` / `authoring-content.md` /
  `design-tokens.md`, describe the `Chapter` + `Paper` composition and the browse page as they
  now really are. Update anything that drifted.

**Verify & note:** summarize what's built, what's rough/known, and propose Epic N+1 — likely
responsive/small-screen browse, real content + imagery, and revisiting whether cards should
crop to the mat shape after all.

---

## Done when

`/work` shows three uniform project cards per row on the tan mat, type set in Jost per the
spec, the first six revealing with a fade-and-rise; scrolling holds the active row for a beat
or two, then carries it fully off the top (no trace) as the next row settles into its place
and further rows peek from below; scrolling back reverses it exactly; each **Learn More** goes
to a shareable `/work/<slug>` placeholder; the whole thing is reduced-motion-safe with every
card reachable; every gutter, size, position, and timing lives in `config/browse.ts` and every
color/font/shadow/size is a token in `global.css` — and the existing `home` and `about` pages
are visually unchanged by the `Chapter` / `Paper` refactor underneath it all.
