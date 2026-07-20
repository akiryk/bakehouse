# Story 2 — Eager hero 0 + the image sequencer

Part of the **image loading choreography** epic (its Steps 2, 3, and 4). The core of the
epic. Renumber to match the repo's convention.

**Goal:** the first card's image is discovered by the browser's preload scanner straight out
of the HTML, and every other image is fetched by a small sequencer in visible order — then
prove both against Story 1's baseline.

**Depends on Story 1** (real imagery + the baseline to measure against).

**These three steps are one story on purpose.** Step 2 removes `src` from every card after
the first; Step 3 is what puts it back via JS. Landing Step 2 alone leaves `/work` showing
one image and a grid of blanks — a broken intermediate state, not a shippable slice. Step 4's
measurement is folded in because it's this story's proof: without it, "the loading is better
now" is an assertion.

**Out of scope:** hover-preload (Story 3), `astro:assets`, LQIP. No new dependencies — this
is HTML attributes plus one small module.

---

## Task 1 — The `eager` prop on `ProjectCard`

Give `ProjectCard.astro` an `eager` prop, default `false`, that switches how the `<img>`
renders:

- **`eager={true}`** — a real `src`, plus `loading="eager"`, `fetchpriority="high"`,
  `decoding="async"`. Server-rendered, so the preload scanner finds it before the DOM is
  built and before any JS parses. This is the fastest fetch the platform offers and the whole
  reason card 0 is special-cased.
- **`eager={false}`** — **no `src` attribute at all**; the real URL goes on `data-src`. Also
  `loading="lazy"` and `decoding="async"` as belt-and-suspenders, though the sequencer is the
  actual mechanism. Native lazy-loading can't be relied on here: the rows are absolutely
  positioned and transform-hidden off-screen, so the browser's viewport heuristics don't see
  them the way a user does.

Keep the image box's dimensions fixed regardless of branch (they already come from
`--browse-image-height` and the card width), so nothing reflows as images arrive.

In the browse grid, pass `eager={i === 0}` — first card only.

**Verify & note:** in the DOM, card 0's `<img>` has a real `src` and the eager attributes;
every other `<img>` has `data-src` and no `src`. On a throttled cold load, card 0's image
appears in the Network panel before any JS-initiated request.

---

## Task 2 — Decide the no-JS / crawler fallback

**Raise this before implementing — it's a real fork, not a detail.** With `src` removed from
cards 1..N, those images exist only after JavaScript runs. That affects two audiences:

- **JS-disabled or JS-failed users** — they see one image and eleven empty boxes.
- **Crawlers and link-preview bots** that don't execute JS — they can't see the imagery at
  all, which has SEO and social-preview implications for a portfolio site.

Options:

1. **Accept it.** Simplest. Defensible for a design studio site where the audience runs modern
   browsers with JS, and where Google does execute JS.
2. **`<noscript>` fallback** — emit a plain `<img src loading="lazy">` inside `<noscript>` for
   each sequenced card. Costs nothing when JS runs, restores images when it doesn't. Doesn't
   help non-executing crawlers much, but it's cheap.
3. **Sequencer-with-src-swap** — render real `src` values and have JS *remove* them
   immediately on load, then re-add in sequence. This preserves markup for crawlers but is
   fragile and races the preload scanner — the fetches you're trying to control may already
   have started. **Not recommended**; noted so it's visibly rejected rather than
   rediscovered.

**Recommendation: option 2** — it's a few lines and removes the worst-case failure. Confirm
before proceeding; note the decision either way.

---

## Task 3 — The sequencer

One dependency-free module (`src/motion/image-sequencer.ts` or similar), wired into the
`work` page's existing per-page init path so it runs on `astro:page-load` (cold load **and**
SPA navigation — both were baselined in Story 1).

Behavior:

- Query `img[data-src]` inside the browse chapter, **in DOM order** (which is visible order).
- **Skip any `<img>` that already has a `src`** — this is what makes re-running safe on SPA
  navigation back into `/work`. Assign `src = dataset.src`, and remove the `data-src`
  attribute once assigned so a re-run can't pick it up twice.
- Advance on the **`load`** event of the previous image, walking the list.
- On **`error`**, log and advance anyway. One broken URL must never stall the remaining
  images — verify this deliberately with a bad path.
- **`browse.imageConcurrency`** in `config/browse.ts`, default `1`. `1` = strict serial
  (predictable ordering, no stampede); `2`–`3` = mild parallelism, faster on healthy networks.
  Keep it a config value and tune it from Task 4's recordings — no literal in the sequencer.
- If the sequencer runs when card 0's image is still in flight, that's fine — it fetches
  independently. Don't gate the sequence on card 0.
- **This runs regardless of `prefers-reduced-motion`.** Reduced motion governs *animation*,
  not resource loading; stalling image fetches under it would strand content. Confirm
  explicitly.

**Verify & note:** on a throttled reload, images populate one (or `imageConcurrency`) at a
time in visible order; a deliberately broken URL doesn't stall the rest; navigating away and
back into `/work` via the SPA router doesn't double-fetch or throw; no literals in the module.

---

## Task 4 — Measure, then decide on `<link rel="preload">`

Re-run Story 1's measurements identically — same conditions, same throttling — and compare:

- **Waterfall** — card 0 starts earlier than baseline; the rest are ordered rather than
  simultaneous.
- **LCP** — should now plausibly be card 0's image, and should fire earlier than baseline.
- **Throttled recording** — cards populate in visible order; the mid-scroll pop-in from the
  baseline should be gone.

**Only now** decide whether to add `<link rel="preload" as="image" fetchpriority="high"
href={hero0}>` to `<head>`. Add it, measure again, and **keep it only if LCP actually
improves**. Over-preloading competes with other critical resources and can move the number
backwards — this is a measured decision, not a default. Record the outcome either way.

If any metric got *worse* than baseline, say so plainly and diagnose rather than shipping —
that's a real finding, not a failure of the story.

**Verify & note:** before/after numbers and recordings side by side; whether preload was added
and the measured reason; the `imageConcurrency` value settled on and why.

---

## Done when

- Card 0 renders a real `src` with `loading="eager"` and `fetchpriority="high"` in
  server-rendered HTML and is fetched before any JS runs.
- Every other card renders with `data-src` and receives its `src` from the sequencer, in
  visible order, at `browse.imageConcurrency` at a time.
- Broken URLs don't stall the sequence; SPA re-entry into `/work` is safe and doesn't
  re-fetch; the sequencer runs under reduced motion.
- The no-JS/crawler fallback decision is made, implemented if chosen, and recorded.
- Measured LCP and throttled perceived-load both beat the Story 1 baseline, with artifacts
  kept; the `rel="preload"` decision is measurement-backed and recorded.
- No new dependencies; no image-optimization or LQIP work; `astro check` clean.
