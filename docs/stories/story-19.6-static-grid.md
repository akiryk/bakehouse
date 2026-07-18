# Story 19.6 — The static grid on `/work`

Part of **`docs/epics/epic-19-portfolio-browse.md`** — its Step 6. The first time the three-
across grid renders on the mat.

**Goal:** a real `/work` page — routed through `Base`, wired into the scroll engine like every
other page — whose one `browse` chapter renders the full column of `ProjectCard`s: three
across, gutters and card size straight from `browse.ts`. **No paging motion yet** — that's
Step 7. What ships here is layout + page plumbing.

**Depends on 19.5** (`ProjectCard`), **19.4** (`projects`, `browse`, `browseCssVars`), and
**19.1** (the neutral `Chapter` — the browse chapter is a bare `<Chapter id="browse">`, no
`Paper`). **Confirm 19.1 has landed before starting** — CC was mid-flight on it. If it hasn't,
either wait, or use `<Chapter id="browse" paper={false}>` on the old component as an interim
and drop the prop once 19.1 merges. Independent of 19.2/19.3 beyond what the card already
consumes.

**Out of scope:** the reveal / dwell / advance motion, the resting-row placement, and the
peek (all Step 7). The mat stays the default tan for now — a `morph()` to a `/work` mat color
is a later authoring choice.

---

## The static-grid ↔ reduced-motion insight

Don't build a throwaway layout. Step 7's reduced-motion branch is, by design, exactly this:
the grid as a static, internally-scrollable column of all cards (mirroring About's reduced-
motion pattern — a fixed element whose content box gets `overflow-y: auto`). So **build that
presentation now** — it lets you verify every row's layout here, and Step 7 keeps it verbatim
as its `prefers-reduced-motion` branch and layers the animated paging on top for everyone
else. Nothing built here is discarded.

---

## How we work

Per `CLAUDE.md` → **How we work**. **Verify against the rendered page**, wide and tall (both
matter — a grid that's right at one window shape often isn't at another). `astro check` clean.
Tailwind-first; the one spot that needs custom CSS is the grid template (below), which is a
legitimate reason-1 exception.

---

## Task 0 — Recon

- **Find the page-dispatch site.** `page-init.ts`'s header says dispatch happens in
  `page-transitions.ts` on every `astro:page-load` (by `document.body.dataset.page`) — but
  `docs/authoring-content.md` says it's `Base.astro`'s own script. Read both and confirm which
  is real; you'll add the `work` case there, and correct whichever doc drifted.
- **Check for a `StageCenter` layout.** The epic centers the grid via a Stage layout "if one
  fits." If `StageCenter` (or similar) exists, use it; otherwise the grid container centers
  itself.
- **Confirm 19.1 landed** (neutral `Chapter`), per the dependency note above.

**Verify & note:** where dispatch lives, whether a centering Stage layout exists, and 19.1's
status.

---

## Task 1 — The browse chapter and its grid

`src/chapters/work/browse/Content.astro`:

```astro
---
import Chapter from "../../../components/Chapter.astro";
import ProjectCard from "../../../components/ProjectCard.astro";
import { projects } from "../../../data/projects";
import { browseCssVars } from "../../../config/browse";
---

<Chapter id="browse">
  <div class="browse-grid" style={browseCssVars()}>
    {projects.map((project) => <ProjectCard project={project} />)}
  </div>
</Chapter>
```

The grid template is the reason-1 custom-CSS spot — Tailwind can't cleanly express
`repeat(var(), var())` — and every value is a token, so it's compliant and documented:

```css
<style>
  /* Grid geometry is driven entirely by the --browse-* vars spread from
     browseCssVars() (single source: config/browse.ts). Custom CSS because
     Tailwind has no clean repeat(var(), var()) equivalent — CLAUDE.md reason 1.
     Static, internally-scrollable presentation: this IS Step 7's reduced-
     motion branch; the animated paging wraps it there. */
  .browse-grid {
    display: grid;
    grid-template-columns: repeat(var(--browse-columns), var(--browse-card-width));
    column-gap: var(--browse-col-gutter);
    row-gap: var(--browse-row-gutter);
    justify-content: center;
    /* Provisional resting box so all rows are reachable now; Step 7 sets the
       real dwell placement + peek for the animated branch. */
    max-height: calc(100vh - var(--mat-safe-inset-top) - var(--mat-safe-inset-bottom));
    overflow-y: auto;
    margin-inline: auto;
  }
</style>
```

(If `browseCssVars()` won't apply as an object on `style`, join it to a string — but confirm
the `--browse-*` vars actually land on the element in the DOM.)

**Verify & note:** the grid resolves all `--browse-*` vars; cards render three across.

---

## Task 2 — The page and its engine wiring

Mirror the existing Home/About plumbing exactly:

- **`src/config/pages.ts`** — add the entry:
  ```ts
  work: {
    useScrollEngine: true,
    chapters: [{ id: "browse", motionPath: "work/browse/motion" }],
  },
  ```
- **`src/pages/work.astro`**:
  ```astro
  ---
  import Base from "../layouts/Base.astro";
  import BrowseContent from "../chapters/work/browse/Content.astro";
  ---
  <Base page="work"><BrowseContent /></Base>
  ```
- **`src/motion/page-init.ts`** — add `initWorkPage()`, mirroring `initAboutPage()` (dynamic
  imports so Vite code-splits `/work`'s JS):
  ```ts
  export async function initWorkPage(): Promise<void> {
    const [{ PAGE }, browseMotion] = await Promise.all([
      import("./work.script"),
      import("../chapters/work/browse/motion").then((m) => m.default),
    ]);
    const model = initPageEngine(pages.work, PAGE, [browseMotion]);
    await exposeBeatModelForDevtools(model);
  }
  ```
- **The dispatch site** (Task 0) — add a `work` → `initWorkPage()` case.
- **Motion stubs** so the engine initializes cleanly (Step 7 fills these in):
  - `src/chapters/work/browse/motion.ts` — a minimal `ChapterMotion` whose `beats()` returns an
    empty `gsap.timeline()`.
  - `src/motion/work.script.ts` — a minimal `definePageScript` placing
    `chapter("browse", { dwellBeats: 0 })` with a trailing `hold(1)` so there's a valid,
    reachable timeline. Leave a comment that Step 7 replaces this with the derived-from-
    `projects.length` dwell, the reveal, and the paging.

**Verify & note:** `/work` cold-loads and SPA-navigates (from the nav's existing "Work" link,
if present) without console errors; `document.body.dataset.page === "work"`; the engine
initializes on a no-beats chapter without throwing (if it misbehaves on empty beats, that's a
real note for Step 7).

---

## Task 3 — Verify the grid, wide and tall

- **Three across**, centered on the mat, with `rowGutter` / `colGutter` visibly matching
  `browse.ts` — change a gutter in the config and confirm the grid responds (proves single-
  source, nothing baked in).
- **Uniform cards** across differing copy (Story 19.5 already proved the card; confirm it holds
  in the grid).
- **All projects present** and reachable by scrolling the column (the static/reduced-motion
  presentation).
- Tall window: the column still centers and scrolls; nothing overflows the mat horizontally.

**Verify & note:** screenshots wide + tall; confirm a config gutter change propagates; note
anything about the engine-on-empty-beats to carry into Step 7.

---

## Done when

- `/work` renders through `Base` with `body[data-page="work"]`, routed and SPA-navigable, no
  console errors.
- The `browse` chapter renders every `ProjectCard` three across, gutters and card size sourced
  from `browse.ts` via `browseCssVars()` — a config change propagates, no literals in the grid.
- The grid is the static, internally-scrollable column that Step 7 will keep as its reduced-
  motion branch; all projects are reachable.
- `pages.ts`, `work.astro`, `initWorkPage()`, the dispatch case, and the motion/script stubs
  are in place; the drifted dispatch doc is corrected.
- `astro check` clean.
