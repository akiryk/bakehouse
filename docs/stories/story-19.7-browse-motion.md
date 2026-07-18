# Story 19.7 — Browse motion: reveal, dwell, and advance

Part of **`docs/epics/epic-19-portfolio-browse.md`** — its Step 7, and the crux of the whole
epic. This is where scrolling `/work` starts to page the grid the way the mock promises. It's
the riskiest story: read the model section before writing any GSAP.

**Goal:** on load, the first six cards reveal (fade + slight rise); on scroll, each row of
three dwells in the stage, then the active row carries fully off the top while the next rises
into its place and the one after peeks up from below — native scroll, scrubbed, no hijacking —
and reversing scroll runs it backward. Reduced-motion-safe, every knob from `browse.ts`.

**Depends on 19.6** (the `/work` page, the `browse` chapter, the engine plumbing, the static
grid — which this story **restructures into per-row groups**, see below), **19.4** (`browse`
config), **19.1** (the neutral `Chapter`). Reuses the existing motion library — `presets.ts`
(`fadeInUp*`, the `flyUp`/accelerate exit), `timeline-kit` (`hold`, `compile`), and the page
script (`chapter`/`at`) — and the **timeline chapter is the closest existing reference**: it
already drives absolutely-positioned elements off a scrubbed timeline, including the
wrapper/figure split that keeps GSAP from fighting a CSS transform (documented in `global.css`
on `.tl-card-anchor`). Read it first.

**Out of scope:** the `/work/<slug>` detail pages (Step 8); final easing/dwell tuning
(rough-but-real is the bar); responsive.

---

## The model — read this before coding

### The geometric tension (why this isn't a single column translate)

Your three requirements, together, over-constrain a rigid column. If the whole grid is one
element that translates uniformly, then bringing the **next** row from its bottom peek up to
the rest position moves the **outgoing** row by that same distance — and that distance isn't
enough to clear it. Concretely, with the active row resting in the top third and cards roughly
half the viewport tall, one advance leaves the outgoing row still partly on screen (a sliver
hangs at the top). A rigid column can only satisfy "active row in the top third," "next row
peeking," and "outgoing row fully gone" simultaneously if the window is much taller than the
cards — which it isn't here. The mock itself, measured, leaves a small remnant.

So each row must move **independently**: the outgoing row travels farther (and accelerates)
than the incoming row, which merely settles. That's the model below.

> **The one simplifying lever.** If you'd accept the active row resting near the *very top*
> (not the top third), a rigid single-column translate becomes viable and this story gets much
> smaller. Everything below assumes you want the top-third placement from the mock. Say the
> word and I'll swap in the simpler version.

### The sliding window

Think in **pages**: one page = one row of `browse.columns` cards. As you scroll, a page index
`p` advances `0 → R-1` where `R = ceil(projects.length / columns)`. Each row `r` occupies one
of four positions as a function of `(p - r)`:

| `p` relative to row `r` | Position       | Meaning                                    |
| ----------------------- | -------------- | ------------------------------------------ |
| `p = r`                 | **REST**       | in the stage, top third                    |
| `p = r - 1`             | **PEEK**       | just poking up from the bottom             |
| `p < r - 1`             | **OFF-BOTTOM** | staged below the fold, not visible         |
| `p = r + 1` (and above) | **OFF-TOP**    | flown fully off the top, no trace          |

Positions, from `browse` + the measured viewport height `V`:

- **REST** `y = browse.dwellTop * V` (row top; the "top third" anchor)
- **PEEK** `y = V - browse.peek` (row top near the bottom, showing `peek` px)
- **OFF-TOP** `y = -(cardHeight + clearance)` (fully above; `clearance` ≈ `rowGutter`, so no sliver)
- **OFF-BOTTOM** `y = V` (top at the bottom edge, fully below)

### One advance (`p: k → k+1`) moves exactly three rows at once

- **row k: REST → OFF-TOP** — the accelerating fly-off ("scroll off screen above"). Use the
  accelerate ease (`power2.in`, matching the site's paper fly-away).
- **row k+1: PEEK → REST** — rises into the stage where row k was. Decelerate into place
  (`power2.out`) so it settles.
- **row k+2: OFF-BOTTOM → PEEK** — rises to just peek from below.

Every other row sits still (OFF-TOP or OFF-BOTTOM). Reversing scroll plays these in reverse for
free (it's a scrubbed timeline).

### A note on gutters, so it's not a surprise

`browse.rowGutter` governs the **static/flow** spacing (the reduced-motion column). In the
animated view the visible gap between the resting row and the peeking row is set by
`dwellTop`/`peek`/`V`, not `rowGutter` — you tune the motion's spacing with `dwellTop` and
`peek`, and the static grid's spacing with `rowGutter`. They're different presentations; that's
expected.

---

## Mechanics

### DOM: per-row groups (a restructure of 19.6's single grid)

Chunk `projects` into rows of `browse.columns` and render each as a `.browse-row` group of
cards. This serves both presentations:

- **Default / reduced-motion (no JS transforms):** rows in normal flow, stacked with
  `rowGutter`, centered, in the capped-height `overflow-y:auto` container from 19.6 — the static
  column, every card reachable. This is the progressive-enhancement baseline: content works
  with no motion.
- **Full-motion (JS):** each `.browse-row` is positioned absolutely (top:0, centered), so a
  single `translateY` per row drives its REST/PEEK/OFF state.

### Two coordinated mechanisms, kept on separate properties

1. **Paging** — a scrubbed `ScrollTrigger` timeline over the chapter's dwell window, setting
   each row's `translateY` per the sliding window. This is the chapter's `beats()`.
2. **Reveal** — an **autoplay** (time-based, not scrubbed) fade + micro-rise on the initially
   visible rows (0 and 1) at load, timed by `browse.reveal`. "Right away vs after a delay" =
   its delay. (Because it's autoplay, treat `reveal.delayBeats`/`overBeats` as **seconds**; flag
   if you'd rather rename them, or make the reveal scrubbed instead.)

**Keep paging and reveal on different properties/elements.** `global.css` already documents a
case where GSAP fighting a CSS transform on the same element dropped it entirely — hence the
`.tl-card-anchor` wrapper/figure split. Mirror it: the **outer** `.browse-row` carries the
paging `translateY`; an **inner** wrapper carries the reveal's opacity + micro-rise. Don't put
both on one element.

### Measure, and recompute on resize

Positions depend on `V` and the resolved config. Measure at init and recompute on resize, then
`ScrollTrigger.refresh()` — the same pattern as `octagon.ts`/the timeline chapter. And borrow
the `octagon.ts` guardrail idea: at init, compute the actual peek from `dwellTop`, `cardHeight`,
and `V`; if it's below `browse.peek`, `console.warn` (so a bad `dwellTop`/card-size combo tells
you instead of silently showing no peek).

---

## Timing and the derived dwell length

Structure of the scrub timeline: for each page, `hold(dwellBeats)` then an advance over
`advanceBeats`, repeated, then a trailing `hold`.

In **`src/motion/work.script.ts`**, place the chapter and **derive** its total from the data —
this is the data-driven decision from the epic, not a hand-authored number:

```ts
// dwellBeats is DERIVED from the project count, on purpose — unlike home.script.ts's
// hand-authored value. Browse is regular and data-driven: adding/removing a project must
// re-length the scroll automatically, or it silently goes stale (exactly the footgun
// home.script.ts's comment describes). Computed from projects.length + browse constants,
// NOT by importing this chapter's own script — that stays forbidden.
const rows = Math.ceil(projects.length / browse.columns);
const total = rows * browse.dwellBeats + (rows - 1) * browse.advanceBeats;
// ... at(0, chapter("browse", { dwellBeats: total })), then a trailing hold(1) so the last
// page's dwell is reachable at max scroll (motion.md's trailing-rest rule).
```

Leave that comment in — it's what stops the next person from "fixing" it back into a hand-synced
value.

---

## Reduced motion

Mirror the About chapter exactly: under `prefers-reduced-motion`, the chapter's `beats()`
returns an **empty timeline** and the reveal doesn't autoplay — the rows stay in the flow /
`overflow-y:auto` column (the baseline above), so **every** project is reachable by ordinary
scroll. Do **not** rely on the engine's generic reduced-motion path (`tl.progress(1)`) — for a
pager that would jump to the last page and strand the rest. Wrap everything in
`gsap.matchMedia()` with the reduced branch doing nothing.

---

## Exit behavior

Default (`browse.clipToBand === false`): rows fly to OFF-TOP and pass **under** the fixed nav
(z-nav sits above the foreground stage), fully off — no trace, no clip. If a row visibly
crossing the nav band mid-flight looks wrong, set `clipToBand: true` and wrap the rows in a
rectangular `overflow:hidden` band (a straight rectangle — not the mat shape). One config flip;
build the plain version first.

---

## Verify (Playwright — the riskiest step, be candid)

Check both a **wide** and a **tall** window, and drive real scroll:

- **Load:** the first two rows fade + rise in (not a hard pop); `reveal.delayBeats` visibly
  delays it; rows 2+ are not visible yet.
- **Advance:** scrolling holds the active row for its dwell (the "slight resistance"), then the
  active row flies **fully off the top with no remaining sliver**, the next row settles into the
  stage where it was, and the following row rises to a peek. Confirm the no-trace clearance
  explicitly — screenshot mid- and post-advance.
- **Reverse:** scrolling back runs the exact inverse; nothing gets stranded or doubled.
- **Native scroll intact:** momentum, keyboard, and scrollbar all normal — nothing hijacked.
- **Reduced motion:** the grid is the static scrollable column, all projects reachable, no
  pinning/paging, no autoplay.
- **Config propagates:** change `dwellTop`, `peek`, `dwellBeats`, and a gutter in `browse.ts`
  and confirm each visibly moves the right thing; confirm the peek guard warns when you set a
  `dwellTop` that kills the peek.
- **Data-driven length:** add a project to `projects.ts` and confirm the scroll auto-lengthens
  (no manual `dwellBeats` edit).

**Verify & note:** be especially candid about anything that felt like a workaround — GSAP/CSS
transform conflicts, resize recomputation, the reveal-vs-scrub coordination, or clearance math.

---

## Done when

- On load the first six cards reveal with fade + rise, timed by `browse.reveal`.
- Scrolling pages the rows: dwell, then the active row flies fully off the top (no trace) as the
  next settles into the stage and the following one peeks; reversing is exact; native scroll is
  untouched.
- The active row rests in the top third (per-row choreography), the peek is honored, and both
  are tunable from `browse.ts` (with the peek guard warning on bad combos).
- The browse chapter's scroll length is **derived** from `projects.length` in `work.script.ts`
  (with the why-it's-derived comment) plus a trailing hold; adding a project auto-lengthens it.
- Reduced motion falls back to the static, fully-reachable scrollable column (empty timeline,
  no autoplay), via `gsap.matchMedia()`.
- Every value traces to `browse.ts`; paging and reveal are kept on separate elements/properties;
  `astro check` clean.
