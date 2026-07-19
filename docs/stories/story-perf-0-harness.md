# Story 0 — A reproducible performance harness

A standing measurement capability, landing **before** the image-choreography epic's baseline
capture (it replaces the hand-measurement in that epic's Story 1). Renumber to match the
repo's convention.

**Goal:** a Playwright script that measures any page's loading behavior deterministically and
writes machine-readable results, so "this improved things" becomes a number with an error bar.
Built page-agnostic on purpose: the image epic is its first customer, not its only one — a
motion change on Home or a layout change on About should be measurable with the same command.

**Why this exists.** Readings taken by hand in DevTools aren't reproducible — different network
conditions, different cache state, different moment. The harness makes comparisons honest and
lets the same measurement be re-run months later against a different commit.

**Fits existing convention:** the project already drives headless Chromium for scroll
verification (`docs/playwright-verification.md`). Same tool, different question — put it
alongside, not in a new structure.

**Out of scope:** any change to page behavior. This story only measures.

---

## Task 1 — The harness

A script (e.g. `scripts/perf/measure.ts`, or wherever the repo keeps tooling) taking
**`--url`** (or a page name resolved against known routes) so it works on `/`, `/work`,
`/about`, or anything added later. Per run it:

1. **Launches a fresh context with a cold cache.** New browser context per run, no reuse.
   Cache carryover is the easiest way to accidentally fake an improvement.
2. **Applies deterministic throttling over CDP** — not the DevTools dropdown, which can't be
   scripted reproducibly:
   ```ts
   const cdp = await context.newCDPSession(page);
   await cdp.send("Network.enable");
   await cdp.send("Network.emulateNetworkConditions", {
     offline: false,
     latency: 562.5,                                // ms — Chrome's "Fast 3G" profile
     downloadThroughput: (1.6 * 1024 * 1024) / 8,   // bytes/sec
     uploadThroughput: (750 * 1024) / 8,
   });
   await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
   ```
   CPU throttling matters as much as network: the premise of an eager first image is that JS
   parse/execute delays JS-initiated fetches, and an unthrottled dev machine hides that cost
   entirely. Make both profiles **named constants** (`FAST_3G`, `CPU_4X`) so they can't drift
   between runs, and record which profile was used in the results.
3. **Fixes the viewport** to a single desktop size, so layout — and therefore which element
   counts as LCP — stays constant across runs.

### Metrics

**Core Web Vitals and standard timings** (measure on every page, always):

- **LCP** — via `PerformanceObserver` on `largest-contentful-paint` with `buffered: true`,
  injected through `page.addInitScript` so it registers before first paint. Record the value
  **and the element** (selector or URL). An LCP that changes elements between runs invalidates
  the comparison, and you need to see that rather than silently compare unlike things.
- **CLS** — `PerformanceObserver` on `layout-shift`, summing entries where
  `hadRecentInput === false`. Directly relevant to image work: images arriving are a classic
  shift cause. Fixed card dimensions should keep this near zero — measuring proves it, and
  catches any future regression.
- **FCP** — from the `paint` entry type. Near-free and useful context when interpreting LCP.
- **TTFB** — from the navigation timing entry. Isolates server/network cost from rendering, so
  a noisy dev server doesn't get misread as a rendering regression.

**INP is deliberately excluded.** It measures interaction responsiveness; synthetic INP with no
real user input is close to meaningless. If interaction latency ever becomes the question, it
needs a purpose-built interaction script, not this.

**Resource metrics** (populated when a page has images; harmless when it doesn't):

- **Per-image resource timings** — `performance.getEntriesByType('resource')` filtered to
  images: `startTime`, `responseEnd`, `transferSize`.
- **Max concurrent image requests** — derived by counting overlapping
  `startTime`→`responseEnd` windows. The clearest single exposure of a request stampede versus
  a sequenced load; it will show a sequencer working even if LCP barely moves.
- **First image request start** — isolates a preload-scanner win.
- **Time until the first N visible images have painted** (N configurable, default 3) — the
  above-fold experience.
- **Bytes transferred by 3s** — distinguishes genuinely deferring work from merely reordering
  it.

### Output

**Writes JSON** to a results directory, keyed by a `--label` (`--label=baseline`,
`--label=after-sequencer`), including timestamp, git SHA, URL, viewport, and throttling
profile. The SHA and profile matter: results without provenance become unusable within a week.

Keep it a plain script with no new heavyweight dependencies — Playwright is already present.

**Verify & note:** a single run on two different pages produces complete JSON with every metric
populated and the LCP element recorded.

---

## Task 2 — Multi-run and the noise floor

**This is the task that makes claims defensible; don't shortcut it.**

- Add `--runs=N` (default 5). Run the full cold-load measurement N times, report the **median**
  per metric plus **min and max**. Median, not mean — one network hiccup destroys a mean and
  leaves no trace it happened.
- Run against the **current, unchanged commit** and record the spread. That spread is the
  measurement's error bar.
- Write it down explicitly, per metric and per page: *"On /work, LCP varies ±X ms (±Y%) across
  5 runs on identical code."*

The rule this establishes, which every later story must respect: **a change smaller than the
noise floor is not an improvement.** If LCP swings ±180ms run-to-run, a 120ms gain is
unclaimable. If the spread is ±40ms, a 400ms gain is real and can be stated as such.

If the spread is too wide to be useful, tighten before proceeding — raise the run count, close
background apps, or drop to a slower network profile where transfer dominates jitter. Report
the final spread either way.

**Verify & note:** the per-metric noise floor as a table, and the run count settled on.

---

## Task 3 — Comparison mode

Add `--compare=baseline,after-sequencer`, printing per metric: baseline median, new median,
absolute delta, percent delta, and **whether the delta exceeds the noise floor** from Task 2.

That last column is the point. It's what lets a note say "LCP improved 412ms (38%), against a
±45ms run variance" instead of "seems faster." Output should be readable pasted straight into a
story note or a commit message.

**Verify & note:** compare two runs of the *same* commit under different labels — every delta
should land inside the noise floor and be flagged not-significant. That's the harness proving
it isn't fooling you. If it flags something significant there, the harness is unreliable and
every number it produces later is worthless.

---

## Task 4 — Document it

A section in `docs/playwright-verification.md` (or a sibling doc): how to run it against a
page, what each metric means, where results land, and the noise-floor rule. Include the exact
commands for a baseline capture and for a comparison, so later stories reference it in one line
rather than re-explaining.

Add a short **Future consideration** note, phrased so it doesn't read as planned work: these
are synthetic headless numbers under scripted throttling — excellent for A/B-ing our own
changes, since the *deltas* are reproducible and trustworthy, but not field data. Absolute
values won't match a real user's. True Core Web Vitals as Google measures them would require
real-user monitoring on a deployed site, which is a different instrument entirely.

**Verify & note:** someone could run a comparison from the doc alone.

---

## Done when

- The harness runs any page by `--url`, cold, under scripted CDP network **and** CPU
  throttling, at a fixed viewport, writing labeled JSON with git SHA, URL, and profile.
- It captures LCP (value **and** element), CLS, FCP, TTFB, plus per-image timings, max
  concurrent image requests, first image request start, time-to-first-N-images-painted, and
  bytes by 3s. INP is explicitly excluded and the reason is noted.
- `--runs=N` reports median/min/max; the noise floor per metric is measured on unchanged code
  and written down.
- `--compare` diffs two labeled sets and marks whether each delta clears the noise floor —
  verified by comparing a commit against itself and getting no significant deltas.
- Documented well enough to run from the doc alone, with the synthetic-vs-field-data limit
  noted as a future consideration.
- No page behavior was changed.
