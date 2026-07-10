# Epic 18 — Real projects on the timeline, via a shared product card

**Goal:** replace the two example timeline overlays (WineSmarts, the "sample-2011"
placeholder) with the 9 real projects listed in `docs/epics/addendum-epic-18-content.md`,
rendered through one shared, reusable `ProductCard` component instead of per-project
hand-authored markup and CSS.

**Depends on:** the existing `stopTimelineAt`/`reveal` mechanism in `motion/timeline-kit.ts`
(Epic 09/10-era work) — this epic does **not** change that mechanism; it's already exactly
"hidden until this year, dwell, then animate away," which is what's being asked for. See
`docs/motion.md`'s timeline-kit section and `src/chapters/home/timeline/script.ts` for the
existing WineSmarts stop as the working prototype this epic generalizes.

**In scope:** a new shared `ProductCard.astro` component; a project-data file transcribed
from the addendum; reworking `Content.astro` to render one card per project instead of two
hardcoded ones; reworking `script.ts` to place all 9 stops instead of the two example ones,
with a per-project configurable dwell (smart default: 3 beats); removing the now-dead
placeholder CSS/markup.

**Out of scope:** hand-tuning per-project timing, positions, or travel pacing beyond a
sensible first-pass default — the user has said explicitly they'll fine-tune motion and
timing themselves once real content is in place. Also out of scope: image optimization
(`astro:assets`), responsive breakpoint-specific card sizing, and any change to the
intro/line/year-notes portion of the timeline chapter, none of which this epic touches.

---

## Why (the design intent)

The timeline chapter already has the _mechanism_ for "stop scrolling on a meaningful year,
reveal something, resume" — `stopTimelineAt(year, { dwell, reveal })`, working today for
exactly one real case (WineSmarts at 2000) and one placeholder (a "sample-2011" project
with lorem ipsum). What's missing isn't new motion machinery; it's making that mechanism
**data-driven** across a real project list instead of hand-authored per project, and
extracting the repeated card markup (currently duplicated once per project, each with its
own bespoke CSS class for size/position) into one shared component.

This matters for the same reason it always does in this codebase: nine hand-copied
`<figure class="tl-card tl-card--slug">` blocks, each with a bespoke `.tl-card--slug { left:
…; top: …; width: … }` rule, is nine places to keep in sync and nine places a future edit
can drift. One component with a `size` prop and one data file is the shape this problem
already has.

---

## Architecture

### The product card: `src/components/timeline/product-card/ProductCard.astro`

Styled like the existing `#winesmarts` figure (`.tl-card`/`.tl-thumb`/figcaption structure,
carried over almost unchanged), generalized in two ways:

- The placeholder gradient thumb (`.tl-thumb--warm`/`--cool`) becomes a real `<img>`.
- Width is driven by a `size` prop (`"small" | "medium" | "large"`) instead of a bespoke
  per-instance CSS class, mapped to new tokens in `global.css`:

  ```css
  --timeline-card-width-small: 32vw;
  --timeline-card-width-medium: 44vw;
  --timeline-card-width-large: 60vw;
  ```

  Applied via `w-(--timeline-card-width-small)` etc. — the established CSS-var-Tailwind
  pattern (see `Chapter.astro`'s `w-(--chapter-paper-width)`), not an arbitrary value.

**Position is deliberately NOT owned by this component.** `ProductCard` is meant to be a
genuinely reusable "here's a project" component, not a timeline-specific one — where it
lands on screen is contextual to whoever places it. `Content.astro` supplies position (see
below), `ProductCard` only owns its own visual shape and size.

**Props:** `image`, `title`, `description`, `size`, and `dataOverlay` (becomes the
`data-overlay` attribute the existing `reveal` mechanism targets — see `RevealSpec` in
`timeline-kit.ts`). `alt` defaults to `title` if not given, for the `<img>`.

`--shadow-card` in `global.css` already carries the comment `/* project card lift */` —
this epic is what that token was clearly waiting for; reused as-is, no change needed there.

### Project data: `src/chapters/home/timeline/projects.ts`

Transcribed from the addendum, normalized (the addendum's `Size` casing is inconsistent —
`Medium`/`Large`/`Small`/`medium`/`small` — normalized to the lowercase union type here),
with one correction: the addendum lists the 2011 image as `npr.jpg`; the actual file in
`public/timeline/` is `2011-npr.png` — the real file is what's used.

```ts
export type ProjectSize = "small" | "medium" | "large";

export interface Project {
  year: number;
  title: string;
  description: string;
  image: string; // public/ path, e.g. "/timeline/2000-winesmarts.png"
  size: ProjectSize;
  /** Beats to dwell on this year with the card shown. Default: DEFAULT_DWELL_BEATS. */
  dwellBeats?: number;
}

export const DEFAULT_DWELL_BEATS = 3;

export const PROJECTS: Project[] = [
  { year: 2000, title: "WineSmarts", ... , size: "medium" },
  { year: 2005, title: "Arnold Worldwide", ... , size: "large" },
  { year: 2008, title: "Carnival Cruise Lines", ... , size: "small" },
  { year: 2011, title: "NPR", ... , size: "medium" },
  { year: 2014, title: "NPR Core Publisher", ... , size: "large" },
  { year: 2017, title: "Wayfair", ... , size: "medium" },
  { year: 2021, title: "Wayfair Wedding Registry", ... , size: "small" },
  { year: 2025, title: "Gambel Custom Homes", ... , size: "medium" },
  { year: 2026, title: "Rainday", ... , size: "medium" },
];
```

This is pure content data — no motion, no positioning — matching this codebase's
established "content and motion are decoupled" rule (`docs/architecture.md`).

### `Content.astro`: one map, one shared anchor

The two hardcoded `<figure>` overlays (and their bespoke `.tl-card--winesmarts`/
`.tl-card--2011` position rules) are replaced with:

```astro
{
  PROJECTS.map((p) => (
    <ProductCard
      image={p.image}
      title={p.title}
      description={p.description}
      size={p.size}
      dataOverlay={String(p.year)}
      class="tl-card-anchor"
    />
  ))
}
```

**Decided for this first pass: every card shares one on-screen anchor position** (the
existing WineSmarts spot — `left: calc(var(--tl-line-x) + 4%); top: 14%`), rather than nine
hand-placed positions. This is sound, not just expedient: no two cards are ever visible at
the same time (each `stopTimelineAt` fully hides its reveal before the next one shows), so
there's no overlap risk — only width changes between cards, per their `size`. `--tl-line-x`
is chapter-local (defined in `.tl-stage`), which is exactly why this position class lives
in `Content.astro`, not in the shared component.

### `script.ts`: placing 9 stops without hand-computing 9 beat offsets

The existing script hand-writes explicit `at(beat, stopTimelineAt(...))` calls with manually
chosen beat numbers — fine for two examples, tedious and error-prone for nine chronological
stops where each one's start depends on where the last one ended. This epic adds one small,
**chapter-local** helper (not a `timeline-kit.ts` addition — there's exactly one timeline
chapter today; if a second one ever needs this, extracting it then is the right call, not
now):

```ts
const APPROACH_BEATS = 0.75; // matches stopTimelineAt's own default explicitly,
// not by coincidence — see the note below

function placeProjectStops(projects: Project[], startBeat: number) {
  let beat = startBeat;
  const entries: SequenceEntry[] = [];
  for (const project of projects) {
    const dwell = project.dwellBeats ?? DEFAULT_DWELL_BEATS;
    entries.push(
      at(
        beat,
        stopTimelineAt(project.year, {
          approach: APPROACH_BEATS,
          dwell,
          reveal: [String(project.year)],
        }),
      ),
    );
    beat += APPROACH_BEATS + dwell;
  }
  return { entries, endBeat: beat };
}
```

`approach` is passed **explicitly** on every generated call, rather than relying on
`stopTimelineAt`'s own internal default (also `0.75`, but that's `timeline-kit.ts`'s
implementation detail) — otherwise this helper's cumulative math and the compiler's actual
placement could silently drift apart if one default ever changes without the other.

`script.ts`'s `sequence` becomes: the existing intro/line/1995-notes-stop entries
(untouched, out of scope), then `...placeProjectStops(PROJECTS, <next beat>).entries`, then
a trailing `hold(1)` at the returned `endBeat` (replacing the old `travel({to:2026}) +
hold(1)` — no longer needed, since the last project year (2026) already matches
`CONFIG.lastYear` exactly, so the last stop _is_ the tape's true end).

### Cleanup

`.tl-card--winesmarts`, `.tl-card--2011`, `.tl-thumb--warm`, `.tl-thumb--cool` (the
placeholder gradients, explicitly commented in the current CSS as "to be replaced with real
project images") are deleted from `Content.astro`'s `<style>` block once `ProductCard` is
in place.

---

## File layout

```
src/
  components/timeline/product-card/
    ProductCard.astro          ← new: shared card, size-driven width, no position
  chapters/home/timeline/
    projects.ts                 ← new: PROJECTS data, DEFAULT_DWELL_BEATS
    Content.astro                ← reworked: map over PROJECTS instead of 2 hardcoded figures
    script.ts                    ← reworked: placeProjectStops() helper replaces hand-placed stops
  styles/
    global.css                   ← + --timeline-card-width-{small,medium,large} tokens
```

---

## Steps

1. **Design tokens.** Add the three `--timeline-card-width-*` tokens to `global.css`.
   _Verify:_ tokens resolve; no visual change yet (nothing references them).

2. **`ProductCard.astro`.** Build the shared component per the Architecture section above,
   using WineSmarts' real data as the first test case.
   _Verify:_ rendered standalone (temporarily swapped into the existing WineSmarts stop)
   looks equivalent to or better than the current hand-styled card, at a wide and a
   narrow/tall viewport.

3. **`projects.ts`.** Transcribe all 9 projects from the addendum, normalizing `size`
   casing and using the real `2011-npr.png` filename.
   _Verify:_ `astro check` clean; a quick console/dev check that `PROJECTS.length === 9`
   and every `image` path resolves (200, not 404) via a curl/Playwright check against
   `public/timeline/`.

4. **`Content.astro` rework.** Replace the two hardcoded figures with the `PROJECTS.map()`
   loop; delete the now-dead placeholder CSS.
   _Verify:_ `astro check` clean; DOM shows 9 `[data-overlay]` elements with the correct
   years, all still hidden (`opacity: 0`) before any scroll-driven reveal runs.

5. **`script.ts` rework.** Add `placeProjectStops()`, replace the two example stops with
   the full 9-project placement, adjust the trailing hold.
   _Verify:_ `?beats` HUD / resolved schedule shows 9 stops in chronological order with the
   expected dwell lengths; no overlapping or out-of-order entries.

6. **Full scroll-through verification.** Playwright: scroll the entire timeline chapter
   start to finish. For each of the 9 years: confirm the card is invisible until its year
   is reached, becomes visible with the correct image/title/description/size, stays
   through its dwell window, and animates away before the next stop. Confirm no card is
   ever visible outside its own window (the "not in view until scrolled to" requirement).
   Check at both a wide and a narrow/tall viewport.
   _Verify:_ screenshots at each stop; `astro check` clean.

---

## Done when

All 9 real projects from the addendum appear on the timeline at their correct years,
rendered through one shared `ProductCard` component with no per-project bespoke CSS. Each
card is invisible until its year is reached, dwells for its configured (or default 3-beat)
duration, and animates away as the tape resumes — reusing the existing
`stopTimelineAt`/`reveal` mechanism unchanged. The two example overlays (WineSmarts
placeholder styling, "sample-2011") and their bespoke CSS are gone. `astro check` is clean
and the full scroll-through looks correct at both a wide and a narrow/tall viewport. Exact
timing/positioning is understood to be a first pass the user will tune further.
