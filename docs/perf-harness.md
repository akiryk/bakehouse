# Performance harness

A reproducible, scriptable way to answer "did that change actually help?" with a
number and an error bar, instead of a DevTools reading taken by hand once. Lives
alongside `docs/playwright-verification.md` — same tool (headless Chromium via
Playwright), different question: that doc is about verifying a scroll/motion effect
looks right; this one is about measuring load performance deterministically enough
to compare two states of the code.

Page-agnostic on purpose. The image-loading-choreography epic (`epic-20`) is its
first customer, not its only one — a motion change on Home or a layout change on
About is measured with the same command.

## Status: a real devDependency, unlike ad-hoc Playwright scripts

`docs/playwright-verification.md`'s `npx`-and-symlink dance is for one-off,
during-a-session verification, kept out of `package.json` on purpose. This harness
is different: it's meant to be re-run repeatedly, by anyone, months later, against
a different commit — a **standing** capability, not an ad-hoc script. `playwright`
is a real `devDependency` here for exactly that reason.

## Before you measure: build and preview, not `astro dev`

```bash
npm run build
npm run preview   # leave this running in its own terminal
```

Astro's dev server serves unminified, unbundled, per-module JS as many small
requests — a fundamentally different load profile than what a real visitor gets.
Since this harness's whole premise is about connection-pool contention and JS
parse/execute cost, measuring against `astro dev` would measure the wrong thing
(dev-mode LCP on `/work` reads **~5x worse** than the same page's production build,
for reasons that have nothing to do with the code being tested). Always point
`--base` at the preview server. `astro preview` picks a free port and prints it
(4321 if free, otherwise the next one) — pass whatever it printed.

## Running it

Single measurement (defaults to 5 runs):

```bash
node tests/perf/measure.mjs --url=/work --label=baseline --base=http://localhost:4321
```

- `--url` — path, resolved against `--base` (default `http://localhost:4321`).
- `--label` — names this result set; written to `tests/perf/results/<label>.json`.
- `--runs=N` — cold runs to take (default 5). Reports median, min, and max per metric.
- `--n=N` — how many images count toward "first N images loaded" (default 3).

Comparing two labeled results:

```bash
node tests/perf/measure.mjs --compare=baseline,after-sequencer
```

Prints a table: each metric's median for both labels, the absolute and percent
delta, that label's own noise floor, and whether the delta clears it.

## What each metric means

**Core Web Vitals and standard timings** (always measured):

- **LCP** (Largest Contentful Paint) — via `PerformanceObserver` on
  `largest-contentful-paint`, `buffered: true`, injected before first paint. Records
  the **element** (tag + src) alongside the time. If the element differs between two
  labeled runs being compared, `--compare` prints an explicit warning — an LCP
  element that changed invalidates a naive number comparison, and the harness
  refuses to hide that.
- **CLS** (Cumulative Layout Shift) — sum of `layout-shift` entries where
  `hadRecentInput` is false. Directly relevant to image work: images arriving late
  are a classic shift cause. Fixed card dimensions should keep this at ~0; this is
  what proves it, and what catches a future regression.
- **FCP** (First Contentful Paint) — from the `paint` entry type. Cheap context for
  interpreting LCP.
- **TTFB** (Time to First Byte) — from the navigation timing entry. Isolates
  server/network cost from rendering, so dev-server or machine noise doesn't get
  misread as a rendering regression.

**INP is deliberately excluded.** It measures real interaction responsiveness;
synthetic INP with no real user input is close to meaningless here. A future
interaction-latency question needs a purpose-built script, not this one.

**Resource metrics** (populated whenever a page has images; harmless — just sparse —
when it doesn't; a page with no dedicated imagery, like `/about`, still reports on
the persistent logo `<img>`):

- **Per-image resource timings** — `startTime`, `responseEnd`, `transferSize` for
  every resource whose `initiatorType` is `img` or whose URL looks like an image.
- **Max concurrent image requests** — a sweep-line count of overlapping
  `startTime`→`responseEnd` windows. The clearest single exposure of a request
  stampede vs. a sequenced load; it will show a sequencer working even if LCP barely
  moves.
- **First image request start** — isolates a preload-scanner win.
- **Time until the first N images finish loading** (`--n`, default 3) — a proxy for
  the above-fold experience. (An approximation: the browser doesn't expose true
  per-image _paint_ time the way it does for the single LCP element, so this uses
  each image's own network completion instead.)
- **Bytes transferred by 3s** — across _all_ resources, not just images; distinguishes
  genuinely deferring work from merely reordering it.

## The noise-floor rule

**A change smaller than the noise floor is not an improvement.** Every labeled
result already carries its own noise floor — the min/max spread across its `--runs`
— and `--compare` uses the _baseline_ label's own spread as the bar a delta has to
clear before it's called significant. This is what turns "seems faster" into "LCP
improved 412ms (38%), against a ±138ms run variance."

Measured on `/work`, current code, production build, 5 runs (Fast 3G + 4x CPU
throttling — see below):

| metric                        | median  | spread (noise floor) | spread as % of median                                    |
| ----------------------------- | ------- | -------------------- | -------------------------------------------------------- |
| LCP                           | 4228ms  | ±138ms               | ±3.3%                                                    |
| FCP                           | 2116ms  | ±132ms               | ±6.3%                                                    |
| TTFB                          | 2.2ms   | ±4.6ms               | (near-zero baseline; treat TTFB deltas skeptically here) |
| CLS                           | 0       | ±0.005               | —                                                        |
| max concurrent image requests | 7       | ±0                   | fully deterministic                                      |
| first image request start     | 591ms   | ±15ms                | ±2.6%                                                    |
| first 3 images loaded         | 1799ms  | ±111ms               | ±6.1%                                                    |
| bytes by 3s                   | 165,025 | ±3,153               | ±1.9%                                                    |

Sanity-checked per Task 3: comparing two independent 5-run measurements of the
_same_ commit correctly flagged **zero** metrics as significant. If a self-comparison
ever flags something, the harness itself is unreliable and nothing it reports after
that point should be trusted until fixed.

5 runs was enough to get a usable spread on this machine; raise `--runs` if a
future comparison's delta sits close to the noise floor and you need a tighter
read.

## Throttling profiles

Named constants in `tests/perf/profiles.mjs` — `FAST_3G` and `CPU_4X` — never
inlined at a call site, so they can't drift between runs. `FAST_3G` matches Chrome
DevTools' own manual-throttling "Fast 3G" preset (562.5ms RTT). Worth knowing:
Lighthouse's differently-calibrated _simulated_-throttling profile of the same name
uses a much shorter ~150ms RTT — a well-known point of confusion between the two
"Fast 3G"s. Numbers from this harness won't match a Lighthouse report's, and
shouldn't be compared against one directly.

## Future considerations (not planned work)

These are synthetic headless numbers under scripted throttling on one machine —
excellent for A/B-ing our own changes, since the _deltas_ are reproducible and
trustworthy, but not field data. Absolute values won't match a real visitor's.
True Core Web Vitals, the way Google's own tooling reports them, need real-user
monitoring on a deployed site — a different instrument entirely, and not something
this harness is trying to be.
