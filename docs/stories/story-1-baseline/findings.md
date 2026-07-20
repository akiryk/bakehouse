# Story 1 baseline — findings

Measured against the naive `/work` page (no loading choreography — every image
eager, no `data-src`, no sequencer, no hover-preload), after seeding real imagery
(Task 1). Environment: Chromium via Playwright, CDP `Network.emulateNetworkConditions`
set to Chrome DevTools' standard **Fast 3G** profile (150ms RTT, 1.6 Mbps down,
750 Kbps up), 1440×900 viewport.

Artifacts in this folder:

- `cold-load-waterfall.har`, `cold-load-data.json`, `cold-load-scroll.webm`
- `spa-nav-waterfall.har`, `spa-nav-data.json`, `spa-nav-scroll.webm`

---

## The single worst artifact

**On a cold load, the entire page shows nothing but the empty ambient mat — no
cards, no motion, not even the ambient stage wobble — for 14–22+ seconds, and this
does not happen on an SPA navigation into the same page.** This is a bigger problem
than "images arrive out of order"; the page looks completely broken/frozen, not
merely slow.

Precise, polled timeline (cold load, Fast 3G):

| t          | what's happening                                                                                                                                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0–14.2s    | `.foreground-stage` opacity is `0`. The mat's clip-path is still the static SSR fallback — `initOctagonWobble()` (called synchronously, at the very top of `Base.astro`'s inline script, with no dependency on images at all) **has not started running yet.**     |
| 14.7s      | The clip-path switches to the JS-computed wobble path for the first time — the page's own module script finally executes.                                                                                                                                          |
| 21.6s      | `window.load` fires (confirmed via `page.goto(..., { waitUntil: 'load' })` resolving at 21,633ms) — matching almost exactly when the slowest image (a 2.1MB PNG, a project three pages down that the user hasn't scrolled anywhere near yet) finishes downloading. |
| 21.7–22.2s | `.foreground-stage` fades to opacity `1`; the scroll-engine spacer appears (`document.body.scrollHeight` goes from `0` to `5400`). Only now can the page actually be scrolled.                                                                                     |

The mechanism: `astro:page-load` — which drives both the page-transition fade-in
and `initWorkPage()` (the scroll engine, the spacer, everything) — is tied to the
native `window.load` event **specifically on a cold load** (confirmed in
`docs/motion.md`: "fires after every swap AND on a cold `window load`"). `window.load`
does not fire until every resource referenced in the document — including a
2MB+ image for a card the user can't even see yet — has finished. Nine
equal-priority image requests firing at once are enough to saturate the browser's
per-origin connection pool badly enough to delay even the page's _own unrelated
module script_ by ~14 seconds, and the full page reveal by ~21 seconds.

**Confirmed this is cold-load-specific:** on an SPA navigation into `/work` (via
the nav link, home already loaded), `.foreground-stage` reaches opacity `1` and the
spacer exists by **~2.6 seconds** — a >8x difference — because `astro:page-load`
fires immediately on the swap, not gated on `window.load`. The slow images are
still loading in the background the whole time; they just don't block the page
from appearing and becoming scrollable. This is exactly the cold-load/SPA-nav
asymmetry the epic anticipated ("the two paths can behave differently and the
sequencer will have to handle both") — except here it's not just the sequencer
that needs to handle both, the base page-reveal timing already does.

---

## Network waterfall (cold load)

All 9 image requests fire within **~100ms of each other** (371–470ms after
navigation start) — a genuine stampede, not sequenced or prioritized by visibility
at all. Fetch order happens to match visible order here (both are just HTML
document order, since nothing currently reorders them) — but _duration_ doesn't
correlate with importance at all:

| order | file                                       | starts | duration | bytes  |
| ----- | ------------------------------------------ | ------ | -------- | ------ |
| 1     | thumb-winesmarts.webp (card 1, top-left)   | 0ms    | 857ms    | 12 KB  |
| 2     | thumb-npr-donate.webp                      | 43ms   | 1,174ms  | 7.7 KB |
| 3     | thumb-carnival-fun.webp                    | 28ms   | 1,358ms  | 27 KB  |
| 4     | thumb-oceanspray.webp                      | 13ms   | 1,658ms  | 39 KB  |
| 5     | thumb-registry.webp                        | 71ms   | 3,432ms  | 2.9 KB |
| 6     | thumb-favorites.webp                       | 56ms   | 3,527ms  | 7.8 KB |
| 7     | 2014-npr-corepub.jpg                       | 43ms   | 4,405ms  | 143 KB |
| 8     | 2026-budget-tool.png                       | 100ms  | 12,380ms | 360 KB |
| 9     | 2025-gambel.png (card 8, three pages down) | 85ms   | 21,177ms | 2.1 MB |

Even the **2.9 KB** registry thumbnail takes 3.4 seconds to complete — not
because it's slow to transfer on its own, but because it's sharing the throttled
pipe with three much larger, much-less-urgent files that all started at the same
instant it did.

## LCP

Reported LCP element: `<img src="thumb-winesmarts.webp">` (card 1's thumbnail —
correctly the intended LCP element, at least). Reported time: **~23,064ms**. That
number tracks the page-reveal delay above, not this specific file's own transfer
time (it finished downloading in under a second) — strong evidence LCP is being
held hostage by the same page-reveal mechanism, not by its own image weight.

## Throttled recordings

- `cold-load-scroll.webm` (44s): visually confirms the above — the mat sits empty
  and static for the first ~15 seconds, then a scroll-length page and full grid
  appear all at once around 21–22s, after which scrolling/paging behaves normally
  (cards already have their images by the time they're scrolled into view, since
  by ~22s several of the smaller ones have already finished in the background).
- `spa-nav-scroll.webm`: grid and motion are present and scrollable almost
  immediately; the two heaviest images (`2026-budget-tool.png`, `2025-gambel.png`)
  visibly continue loading well after the page is already interactive and being
  scrolled — this is where "card pops in mid-scroll" actually shows up, since nothing
  here blocks the reveal the way the cold-load path does.

## Request order vs. visible order

Matches today, coincidentally — not because anything orders requests by
visibility, but because nothing reorders them at all; the browser's preload
scanner (cold load) or the DOM swap (SPA nav) just discovers all 9 `<img>` tags
in the same document order they're rendered in. The instant any of that changes
(different grid order, more projects, a differently-laid-out page), fetch order
and visible order have no guaranteed relationship — there's no mechanism holding
them together today.

---

## Implication for Story 2

The sequencer (Story 2/3) fixes the waterfall and the mid-scroll pop-in on SPA
navigations. It does **not**, by itself, fix the worst artifact above — that's a
cold-load-specific `astro:page-load`/`window.load` coupling, upstream of anything
`ProjectCard` or the sequencer controls. Worth flagging as its own follow-up
(possibly: don't gate the initial reveal on `window.load` for pages with
JS-sequenced images) rather than assuming Story 2 resolves it as a side effect.
