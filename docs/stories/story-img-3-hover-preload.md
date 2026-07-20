# Story 3 — Hover-preload the detail hero, and record the choreography

Part of the **image loading choreography** epic (its Steps 5 and 6) — the closing story.
Renumber to match the repo's convention.

**Goal:** hovering a card's **Learn More** starts fetching that project's detail hero, so the
click that follows lands on a page whose hero is already in cache. Then document the
choreography and close the epic cleanly.

**Depends on Story 1** (`detailHero` populated). Independent of Story 2's sequencer — this is
a separate mechanism on a separate trigger — so it could land in either order, though after
Story 2 is the natural sequence.

**Out of scope:** `astro:assets` and LQIP. This story's Task 3 is specifically about writing
them up as *future considerations* so a later agent doesn't mistake them for pending work.

---

## Task 1 — Hover-preload

In `ProjectCard.astro`, attach a `pointerenter` handler to the Learn More link:

- `new Image().src = project.detailHero` — that's the whole mechanism. The browser opens the
  fetch and caches the result; the subsequent navigation reads from cache.
- **Fire once per card per session.** Guard with a module-level `Set` of already-warmed URLs
  (or a boolean on the element) so repeated hovering doesn't re-trigger. Cheap, but sloppy
  without it.
- **If `detailHero` is missing, do nothing** — silently, no console noise. Some projects may
  not have one yet and that's a valid state.
- **Mobile analog:** consider `touchstart` as well. A touch that becomes a tap is the mobile
  equivalent of hover intent, and it buys the same head start. Small addition — implement it
  and note the behavior, or skip it and say why.

One judgment worth applying: `pointerenter` (not `pointerover`) so it fires once on entry
rather than on every descendant crossing.

**Verify & note:** hovering Learn More opens a fetch for that project's `detailHero` in the
Network panel; hovering repeatedly doesn't re-fetch; a card without `detailHero` does nothing
and logs nothing.

---

## Task 2 — Verify the payoff

The point isn't that a fetch happens — it's that the click feels instant. Measure it:

- On a **throttled** connection, click Learn More **without** hovering first (or after a hard
  reload) and note when the detail page's hero renders.
- Repeat **with** a deliberate hover-then-pause-then-click.
- The difference is the story's value. If it's negligible, say so — it may mean the hero is
  small enough not to matter, which is a legitimate finding worth recording rather than
  papering over.

**Verify & note:** the two timings, side by side, and an honest read on whether the technique
is earning its keep at current image sizes.

---

## Task 3 — Document the choreography, and fence off the deferred work

Write a short `docs/image-loading.md` (or a section in an existing doc if one fits better)
covering:

- **What the choreography does** — card 0 eager in HTML for the preload scanner; the rest
  sequenced by `image-sequencer.ts` in visible order at `browse.imageConcurrency`;
  hover-preload warming detail heroes. A reader should be able to tell *why* card 0 is
  special-cased without re-deriving it.
- **Why native `loading="lazy"` isn't sufficient here** — absolutely-positioned,
  transform-hidden rows defeat the browser's viewport heuristics. This is the single most
  re-derivable decision in the epic; write it down once.
- **The knobs** — `browse.imageConcurrency`, and whether `<link rel="preload">` was adopted
  (with the measured reason from Story 2).

Then, in a clearly-labelled **Future considerations** section — phrased so no later agent
reads it as a backlog:

- **`astro:assets`** — Astro's image-optimization pipeline. Governs file *size and format*,
  not load *order*; orthogonal to everything above. If adopted later, JS-assigned `src` keeps
  working unchanged, whether URLs point at `public/` or an optimized asset.
- **LQIP / blur-up placeholders** — polish on top of the sequenced images, where there's a
  visible wait. Pairs with this choreography rather than replacing it. Skip the placeholder on
  card 0, where it can make the page *feel* slower to finish loading.

Use wording like "a possible future direction, not planned work." Avoid TODO/FIXME framing
and checkbox lists, which read as commitments.

**Verify & note:** the doc exists, explains the why (not just the what), and the deferred
items are unmistakably framed as optional.

---

## Task 4 — Close out

- Confirm every tunable value lives in `config/browse.ts` — no literals in the sequencer or
  the hover handler.
- Confirm the epic introduced **no new dependencies** and did not touch image formats, the
  `public/` layout, or `astro:assets`. Either would be scope creep.
- Summarize the epic's measured before/after (pulling Story 1's baseline and Story 2's
  results) in one short paragraph.

**Verify & note:** the summary, and anything left rough or worth revisiting.

---

## Done when

- Hovering Learn More fetches that project's `detailHero` once per session; missing heroes are
  a silent no-op; the mobile `touchstart` question is decided and noted.
- The hover payoff is measured on a throttled connection, with an honest read on its value.
- `docs/image-loading.md` explains the choreography and *why* native lazy-loading was
  insufficient, and frames `astro:assets` and LQIP as future considerations — not pending
  work.
- All knobs live in `config/browse.ts`; no new dependencies; no optimization-pipeline or LQIP
  work was done.
- `astro check` clean.
