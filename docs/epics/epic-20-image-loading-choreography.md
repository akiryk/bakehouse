# Epic — Image loading choreography for `/work`

**Goal:** load project imagery so the browse grid feels fast _and_ smooth — the first
visible image lands as early as the browser can arrange, the remaining above/below-fold
images arrive in a controlled sequence rather than a stampede, and hovering **Learn More**
kickstarts the detail-page hero so it's warm by the time the click happens. This is a
UX-and-performance epic: raw load time matters, but so does what the user sees while it's
happening (a card popping in mid-scroll is bad even if the total bytes were smaller).

The mechanism, in one sentence: the browser's preload scanner handles image 0 for us via
plain HTML, and a tiny JavaScript sequencer handles everything after. That's the entirety of
the design.

**Depends on:** Epic 19's card and grid landing (`ProjectCard`, `/work`). This epic
populates the `Project.image` field the card already renders when present.

**Explicitly out of scope — do not treat as pending work:**

- **`astro:assets` (Astro's image-optimization pipeline).** A separate, later decision about
  file sizing/format/`srcset`, orthogonal to _when_ images load. The choreography below works
  identically whether URLs point at `public/` or at an optimized asset — swapping in the
  pipeline later touches import paths, not this epic's JS. Do not migrate as part of this.
- **LQIP / blur-up placeholders.** A polish layer that can be added later on top of
  JS-sequenced images. Not a goal here.

These are called out only to prevent confusion with prior discussions. They are **not** work
items in this epic; a later epic may pick either up.

---

## The prerequisite: real images to sequence

Right now no cards actually have images — `Project.image` is optional and cards render a
`bg-neutral-400` placeholder when absent. The choreography can't be verified against
placeholders, so this epic includes seeding real imagery. If you'd rather populate imagery in
a separate motion (e.g. once portfolio copy is finalized), the sequencer and hover-preload
steps still work — they just have nothing to demonstrate against. Flag if you'd rather split
that off; the epic below assumes we seed as we go.

---

## The model

Three coordinated behaviors, each doing exactly one thing:

1. **Image 0 is in the HTML.** The very first project card renders its `<img>` with a real
   `src` in the server-rendered markup, `loading="eager"` and `fetchpriority="high"`. This
   lets the browser's preload scanner discover it before the DOM is built, before any JS runs,
   before Astro's client hydration — the fastest fetch the platform can give us. Optionally
   also emit a `<link rel="preload" as="image" href={hero0} fetchpriority="high">` in
   `<head>`; measure whether it helps before adding it (over-preloading can _hurt_).

2. **Images 1..N are JS-sequenced.** Every other card renders its `<img>` **without** a
   `src` (or with a placeholder), holding the real URL on a data attribute. A small sequencer
   on the browse chapter starts the next fetch once the current one fires `load`, walking the
   list in visible order. This replaces native `loading="lazy"` — which cannot be trusted for
   our layout because cards are absolutely positioned and transform-hidden off-screen (the
   viewport heuristics don't see them the way a user does).

3. **Hovering Learn More warms the detail hero.** A `pointerenter` handler on each card's
   Learn More does `new Image().src = detailHeroUrl` — the browser opens the fetch to a
   cached network resource, and the click that follows lands on a page whose hero image is
   already in the disk cache. Costs nothing when unhovered; cancellable by the browser if the
   user moves off.

Nothing else. No framework, no library, no orchestration beyond these three pieces.

### What each `Project` needs

- **`image`** — the browse-card thumbnail, already on the type (currently optional; make
  required for real projects, or keep optional with a documented placeholder branch).
- **`detailHero`** — the hero image on `/work/<slug>`. Distinct from `image` in principle
  (larger, differently cropped), even if some early projects use the same file. This is what
  hover-preload targets.

If `detailHero` is missing, hover-preload is simply skipped for that card. Don't fail loudly.

---

## Steps

### Step 0 — Baseline

Before changing anything, measure what "the current UX" actually is on `/work` with a
representative image set (seed a couple of real images temporarily if needed):

- Network waterfall — order and parallelism of image fetches.
- LCP (Largest Contentful Paint) — what element is the LCP right now, and when does it fire?
- Perceived load — screen-record a scroll from top to bottom on both a fast and a **throttled**
  connection (Fast 3G in DevTools is the honest test).

Keep the recordings — the whole epic's success is judged against them.

**Verify & note:** the current numbers and the recordings; the LCP element specifically.

### Step 1 — Seed real project images

- Add representative imagery for each project in `projects.ts` — real thumbnails plus a
  `detailHero` per project (a distinct file, even if some early ones reuse the thumbnail).
  Location and optimization approach are your call now; **do not** migrate to `astro:assets`
  as part of this epic (out of scope, above).
- Update the `Project` type: add `detailHero?: string` (optional, so an unseeded project
  degrades cleanly).
- Confirm all cards render real images (the `bg-neutral-400` branch is now only for genuinely
  imageless projects).

**Verify & note:** every card has a thumbnail; the type change compiles; the placeholder
branch still works when an image is deliberately omitted.

### Step 2 — Eager hero 0

- In `ProjectCard.astro` (or a small wrapper), accept an `eager` prop (default `false`). When
  true, render `<img src={image} loading="eager" fetchpriority="high" decoding="async">`;
  when false, render **without a src** and put the real URL on `data-src`, plus
  `loading="lazy" decoding="async"` (the `loading` attribute here is a belt-and-suspenders —
  the sequencer is the real mechanism).
- On the browse grid, pass `eager={i === 0}` to the first card only. Every other card is
  JS-sequenced.
- **Do not** add the `<link rel="preload">` yet — measure first, in Step 4, and add only if
  it helps.

**Verify & note:** the DOM confirms card 0's `<img>` has a real `src` and the eager
attributes; every other card's `<img>` has `data-src` and no `src`. In the Network panel on a
throttled reload, card 0's image starts fetching before any JS-driven request.

### Step 3 — The sequencer

Add a small module (`src/motion/image-sequencer.ts` or similar — one file, no dependencies)
that runs on `astro:page-load` for the `work` page (mirror the existing per-page init
pattern):

- Query all `img[data-src]` inside the browse chapter, in DOM order.
- Assign `src = dataset.src` on the **first** one immediately (card 1 — card 0 was already
  eager in HTML). On its `load` event, advance to the next. Repeat.
- On `error`, log and advance anyway — one broken URL must not stall the whole sequence.
- **Concurrency knob.** Add a `browse.imageConcurrency` value in `config/browse.ts` (default
  `1`). `1` = strict serial (safest, most predictable ordering); `2–3` = mild parallelism
  (faster on healthy networks, still avoids a stampede). Keep it configurable; tune from the
  recordings in Step 4.
- Under `prefers-reduced-motion`, this still runs — reduced motion is about _animation_, not
  images. Confirm.

**Verify & note:** on a throttled reload, images appear one (or `imageConcurrency`) at a
time in visible order; a deliberately broken URL doesn't stall the rest; the sequencer runs
on SPA navigation to `/work` as well as cold load.

### Step 4 — Measure, then decide on `<link rel="preload">`

Re-run the Step 0 measurements:

- Network waterfall — image 0 starts earlier than before; other images are ordered, not
  simultaneous.
- LCP — should be image 0 now (if the design implies it), and should fire earlier than
  baseline.
- Perceived load on throttled — cards should populate in visible order without the mid-scroll
  "pop-in" a native `loading="lazy"` gives on this layout.

Only **now** decide whether to add `<link rel="preload" as="image" fetchpriority="high"
href={hero0}>` to `<head>`. If LCP improves further, keep it; if it doesn't move (or moves
backwards — over-preload can compete with other critical resources), don't. Record the
decision.

**Verify & note:** before/after numbers and recordings; whether preload was added and why.

### Step 5 — Hover-preload Learn More

- In `ProjectCard.astro`, add a `pointerenter` handler on the Learn More link that does
  `new Image().src = project.detailHero` — once per card per session (guard with a boolean or
  a WeakSet so hovering repeatedly doesn't re-fetch).
- If `detailHero` is missing, do nothing (silently).
- Consider also `touchstart` as a mobile analog — a touch that becomes a tap is the mobile
  equivalent of hover intent. Small addition; call it out in the note.

**Verify & note:** hovering Learn More shows the detail image fetching in the Network panel;
clicking through lands on a page whose hero is already cached (compare the hero's fetch time
on the detail page with and without prior hover — should be near-zero with).

### Step 6 — Tidy and record

- Confirm `imageConcurrency` and any thresholds live in `config/browse.ts`; no literals in
  the sequencer.
- Confirm nothing in this epic touched `public/` layout, image formats, or introduced a
  dependency (both would be scope creep — the choreography is JS + HTML attributes, that's
  it).
- Note in `docs/` (either a small `docs/image-loading.md` or a section in an existing doc)
  what the choreography does and the two enhancements deliberately left for later:
  - `astro:assets` — Astro's image-optimization pipeline. A file-sizing/format decision, not a
    loading-order one. If picked up later, JS-assigned `src` continues to work unchanged.
  - LQIP / blur-up placeholders. Polish on top of JS-sequenced images. Pairs with this epic;
    doesn't replace it. Skip the placeholder on hero 0.

**Verify & note:** the doc is written and phrased as "future considerations," not "TODO."

---

## Done when

- `/work` cold-loads with hero 0 eagerly fetching from HTML (visible in the Network panel
  before JS runs), and no other image competing with it.
- All remaining images arrive under the sequencer in visible order, at
  `browse.imageConcurrency` at a time, with broken URLs surviving cleanly.
- Hovering **Learn More** on any card opens a fetch for that project's `detailHero`, and the
  detail page's hero renders effectively instantly on click.
- Measured LCP and perceived load on a throttled connection are both better than the Step 0
  baseline — recordings kept.
- All knobs live in `config/browse.ts`; no image-optimization migration or LQIP work was
  done, and the docs describe both as future considerations rather than pending work.
