# Epic 17 — Working navigation + a custom SPA-style page transition

**Goal:** make the nav actually navigate. Add a real About page, and build a reusable
cross-page transition — driven by Astro's client router and GSAP, not the browser's
default full-reload flash or the router's own default crossfade — so leaving one page and
arriving at another reads as one continuous, quiet motion: the mat sweeps to fill the
screen, content fades, the mat springs back, the new paper fades in.

**Depends on:** Epic 16 (scroll-shapes — the exit sequence fades that layer) and the
ambient mat in `motion/octagon.ts` (Architecture → "The ambient mat" in `docs/motion.md`).

**In scope:** `src/pages/about.astro` as a real scroll-engine chapter (its own
`about.script.ts` + `chapters/home/about/motion.ts`); `<ClientRouter />` wired into
`Base.astro`; `transition:persist` on the mat, nav, and logo; a refactor of `octagon.ts` to
expose an imperative expand/spring-back controller alongside its existing ambient wobble; a
new `page-transitions.ts` motion module driven by Astro's transition lifecycle; dynamic
nav active-state; Home's nav link becoming real (`href="/"`).

**Out of scope:** Services and Work nav items (stay `href="#"` placeholders); any change
to the home page's own scroll-engine chapter motion; ScrollShapes on the About page;
building out more than the one page pair (Home ⇄ About) — though the sequence is authored
generically, so a third page gets it for free.

---

## Why (the design intent)

Right now every nav link is `href="#"` — clicking does nothing. A real `<a href="/about">`
would work, but a plain browser navigation means a full reload: a flash of white, then the
new page assembling from scratch, which is exactly the kind of jolt the "quiet, refined,
typed-on-paper" aesthetic in `CLAUDE.md` is built to avoid. Astro's built-in View
Transitions router (`<ClientRouter />`) solves the mechanical half — it intercepts
same-origin link clicks, fetches the destination, and swaps the DOM in place, no full
reload — without adding a UI framework or a custom SPA router, so it doesn't strain the
"no UI framework" constraint. But its _default_ animation is a same-time crossfade of
old/new page snapshots, which can't express what's wanted here: a strict sequence (expand,
_then_ contract, _then_ reveal), not a blend. So the router supplies the plumbing; GSAP
(the project's one motion system) supplies the actual choreography, hooked into the
router's lifecycle events instead of the router's built-in transition directives.

**Three product decisions, settled going in:**

- **About's resting mat color** is the same tan as intro (`--palette-tan`) — About reads
  as a continuation of the opening tone, no new palette token needed yet.
- **About's paper height follows its content**, and if that's taller than one viewport, the
  paper scrolls by steadily as the user scrolls — no fixed-height token, no held "dwell"
  then all-at-once fly-away. Mechanically this stays inside the existing scroll-engine
  model: About is a real chapter whose `beats()` timeline continuously scrubs the paper's
  own `y` translate across a long dwell window (the same technique the `timeline` chapter
  already uses to scrub its year-strip), with a hand-tuned duration/ease rather than a
  discrete exit — see **The About page** below.
- **The enter animation (mat settle + paper fade-in) plays on every load** — a direct/cold
  load of `/about` (typed URL, refresh, new tab) gets the same sequence as an in-app nav
  click, not just an instantly-placed paper. This also means the enter logic needs exactly
  one code path that both a cold load and a post-swap navigation can trigger.

---

## Architecture

### The router: `<ClientRouter />`

Added to `Base.astro`'s `<head>`. This is what makes "no full reload" possible at all —
Astro fetches the destination page's HTML and swaps head/body content in place. It's
progressive enhancement: browsers without native View Transitions support still get the
swap, just without the browser's own crossfade — which we're overriding anyway.

### Persisted elements

`transition:persist` on three elements so they are **literally the same DOM node** across
a navigation, not just visually matched:

- `#midground-mat` — this is the load-bearing one. The mat's clip-path is rewritten every
  animation frame by `octagon.ts`'s closures, which hold a reference to this exact element.
  If the node were destroyed and recreated on navigation (the default swap behavior), the
  in-flight wobble/expand tweens would be talking to a detached element and the ambient
  motion would silently die on the first navigation.
- `<Nav />` — guarantees zero flash, structurally, not just "looks the same": nothing about
  it is re-painted or re-mounted.
- The logo (`<a class="logo">`) — same reasoning.

Confirm during implementation (Step 1) whether Astro 7's `transition:persist` needs an
explicit `transition:name` on each of these to match reliably, or infers one safely from
DOM position — don't assume either way before checking.

### Suppressing the router's own default animation

Left alone, the router applies its own crossfade to the page. That default must be fully
neutralized (`transition:animate="none"` or equivalent on the swapped containers) before
any of the custom sequence is built, or the two will visibly compete. This is its own step
with its own verification, ahead of building the real sequence, so there's a clean canvas
to animate into.

### The octagon controller (refactor, not addition)

`motion/octagon.ts` today is a single `initOctagonWobble()` call — homes, wobble state, and
the recursive `animateVertex` legs all live in closures, nothing exported. This epic needs
two new capabilities exposed from that same module, reusing its existing cached
measurements (`homes`, `W`, `H`) rather than re-deriving them:

- **`expandToEdges(durationMs)`** — kill in-flight wobble tweens per vertex, tween each
  vertex's absolute position to its edge/corner target, resolve when all eight arrive.
- **`springToHome(durationMs)`** — tween vertices back to `homes[i]` (i.e. `dx/dy → 0`),
  resolve on completion, then resume the ambient wobble loop.

**Vertex target mapping** (viewport `W × H`, vertex order matches the existing
`upperLeft → clockwise → centerLeft` layout in `octagon.ts`):

| Vertex      | Target   |
| ----------- | -------- |
| upperLeft   | `(0, 0)` |
| upperCenter | `(x, 0)` |
| upperRight  | `(W, 0)` |
| centerRight | `(W, y)` |
| lowerRight  | `(W, H)` |
| lowerCenter | `(x, H)` |
| lowerLeft   | `(0, H)` |
| centerLeft  | `(0, y)` |

Corners collapse to the viewport corner; edge-centers keep their free axis and snap only
the axis facing that edge — exactly "each vertex makes a beeline for the nearest edge of
the chrome" from the request. The bezier handles (`edgeCurve`) are left as-is during the
expand; the mat will read as a near-full-bleed rectangle with a very slight bow, consistent
with the rest of the site's "near-rectangular, not a hard rectangle" language — not a
defect to fix.

The trickiest part of this refactor is that today's ambient wobble is a bare
forever-recursion (`animateVertex`'s `onComplete` calls itself). It needs to become
**pausable and resumable**: a flag checked before each vertex schedules its next leg, and
a way to restart all eight after `springToHome` completes. Get this wrong and either two
tweens fight over the same vertex, or the ambient wobble never resumes after the first
transition — this is the highest-risk step in the epic and deserves care and a dedicated
by-eye check (does the mat keep gently wobbling, indefinitely, after several round trips?).

Export a module-level singleton populated once `initOctagonWobble()` runs
(`export const octagonController = { expandToEdges, springToHome }`, reassigned internally
once real functions exist) so `page-transitions.ts` can import and call it directly. Since
the mat persists and its init script only ever executes once, this is a true singleton for
the page's lifetime — no re-import/re-init race to worry about.

### The exit/enter sequence: `motion/page-transitions.ts`

One shared, page-agnostic module wired to Astro's transition lifecycle. (Confirm exact
event names/payloads against the installed Astro version — 7.0.2 — in Step 1; treat the
below as the intended contract, not a guarantee until verified against the real API.)

**Exit** — begins the instant a nav link is clicked, on the _outgoing_ page:

- In parallel, over `pageTransition.exitDuration` (350ms):
  - `octagonController.expandToEdges(350)`.
  - `.foreground-stage` (whatever chapter/paper is currently on screen) fades to opacity 0.
  - The scroll-shapes container, if present on the outgoing page, fades to opacity 0.
  - Nav and logo are untouched — they're persisted, not exiting.
- Hooked via `astro:before-preparation`'s `loader` override, so the actual navigation
  (fetch + parse of the destination) is gated on this. Run the exit animation and the
  destination fetch **concurrently** (`Promise.all`), not the animation followed by the
  fetch — the fetch should start immediately so a slow connection doesn't add fetch time
  on top of the animation, it should only add to whichever is longer.

**Enter** — hooked via `astro:page-load`, which fires both after a swap _and_ on a cold
load, giving cold-load and SPA-transition entry exactly one code path (per the settled
"plays on every load" decision):

1. `octagonController.springToHome(...)` — the mat settles to its idle shape. Not
   necessarily the exact wobble phase the outgoing page was at (explicitly not required —
   "the initial coordinates" is enough).
2. Once settled, the destination page's paper fades in (opacity 0 → 1).
3. Nav's active-link classes update to match `window.location.pathname` — see below.

All durations/eases for this sequence live in a new `src/config/page-transition.ts`
(mirroring how `config/scroll.ts` and `config/octagon.ts` hold their own domains' timing
values) — never inline in `page-transitions.ts`, per the no-magic-values rule.

### Nav active-state

`Nav.astro` currently hardcodes `text-ink` on "Home" via a literal class string per link.
Two changes, because Nav is persisted (its SSR output only reflects whichever page it was
_first_ rendered on — Astro won't re-render a persisted node's markup on a later swap):

1. SSR: compute the active link from `Astro.url.pathname` so a cold load of `/about`
   is correct without depending on JS (matches the project's reduced-motion/no-JS
   correctness bar).
2. Client: on every `astro:page-load` (same hook as the enter sequence, same step), compare
   `window.location.pathname` against each link's `href` and toggle `text-ink` /
   `text-nav-text` imperatively. This is the only way the active state stays correct across
   a persisted-node navigation.

Home's link becomes `href="/"` (currently `href="#"`) so nav is a real way back, not just
the browser back button.

### The About page

**Paper height follows content, and the paper scrolls by steadily as the user scrolls** —
but this stays inside the existing scroll-engine model rather than switching to native
document scroll. About's paper lives in `.foreground-stage`/`StageLeft` exactly like every
other chapter (fixed, pinned — the exit-sequence fade target below doesn't need to change),
but instead of a dwell-then-fly-away, its own `beats()` timeline continuously scrubs the
**paper element's own `y` translate** from `0` to a hand-tuned negative distance across a
long `dwellBeats` window. This is the same technique the `timeline` chapter already uses to
scrub its year-strip's `y` inside `beats()` — just applied to the paper itself instead of a
`[data-el="tape"]` child.

- `src/config/pages.ts` gains an `about` page entry (`useScrollEngine: true`, one chapter).
- `src/motion/about.script.ts` (mirroring `home.script.ts`) places `at(0, chapter("about",
{ dwellBeats: N }))` — no `exit()` moment; About is a dead end, nothing hands off to a
  next chapter, so the paper doesn't fly fully away. Scroll simply ends when the dwell
  window does (optionally with a trailing `hold()` for a soft landing).
- `src/chapters/home/about/motion.ts`'s `beats()` scrubs the `[data-chapter]` paper's own
  `y` from `0` to `-X` (both `N` beats and `X`/ease are hand-tuned constants local to this
  file, analogous to `timeline`'s `CONFIG.pitch`/`enterFrom` — not runtime-measured; tuned
  by eye against the actual placeholder copy, same as every other feel value in this
  codebase).
- No new height token: `--min-h-chapter`'s existing `60vh` floor still applies via
  `Chapter.astro`, unmodified — height comes from content, that's the whole point.
- Copy: title "About" (not "Dear **\_\_**,"), enough placeholder paragraphs (at the same
  size/color as intro's — `text-2xl`, `text-ink`) that the paper is visibly taller than one
  viewport, so the scrub is actually exercised when verifying this step.

Because the paper never leaves `.foreground-stage`, the cross-page exit sequence's fade
target (`.foreground-stage` → opacity 0) is unchanged and works identically for both pages
— no new `[data-el]` marker needed.

### Reduced motion

The whole exit/enter sequence is wrapped in `gsap.matchMedia()`, same pattern as every
other motion module. Under `prefers-reduced-motion: reduce`, the mat expand/contract and
fades are skipped — navigation still goes through the router (no full reload), but the
destination content is simply present, correct, and immediately visible.

---

## File layout

```
src/
  pages/
    about.astro                  ← new: StageLeft + Chapter, wired to initPageEngine
  chapters/home/about/
    Content.astro                ← new: title "About" + placeholder copy
    motion.ts                    ← new: beats() scrubs the paper's own y, hand-tuned
  motion/
    about.script.ts              ← new: places the single "about" chapter, no exit()
    octagon.ts                   ← refactored: + expandToEdges/springToHome controller
    page-transitions.ts          ← new: exit/enter sequence, wired to astro:* events
  config/
    pages.ts                     ← + "about" page entry
    page-transition.ts           ← new: exitDuration, enter timings, eases
  components/
    Nav.astro                    ← Astro.url.pathname-driven SSR active state + client update
  layouts/
    Base.astro                   ← + <ClientRouter />, transition:persist ×3, animate="none"
```

---

## Steps

1. **Research spike: confirm the Astro 7 transition API contract.** Pin down the real
   shape of `astro:before-preparation` (does overriding `event.loader` actually gate the
   swap the way described above?), `astro:after-swap` vs. `astro:page-load` firing order
   and timing, whether `transition:persist` needs an explicit `transition:name`, and how to
   fully disable the router's default root crossfade — against Astro 7.0.2 specifically,
   not assumed from memory.
   _Verify:_ a throwaway two-dummy-page prototype with `console.log`s on each event proves
   the firing order and confirms the `loader` override actually delays the swap.

2. **Router + persistence, no custom animation yet.** Add `<ClientRouter />` to
   `Base.astro`; `transition:persist` the mat, nav, and logo; make Home's link `href="/"`.
   _Verify:_ clicking Home→About (once About exists in step 3) shows a fetch in the Network
   tab, not a document navigation; stamp a temporary `data-instance-id` on the mat/nav/logo
   to confirm they're the same node before and after.

3. **About page.** `pages.ts`'s `about` entry, `about.script.ts`, `chapters/home/about/`
   (`Content.astro` + `motion.ts`), wired through `initPageEngine` like `home`. Placeholder
   copy long enough to visibly exceed one viewport at `--min-h-chapter`'s floor.
   _Verify:_ `/about` renders a paper at intro's text size/color; scrolling continuously
   translates the paper's `y` (not a dwell-then-snap) until all copy has passed through the
   viewport, then scroll ends — checked at a wide and a narrow/tall viewport.

4. **Octagon controller refactor.** Expose `expandToEdges`/`springToHome`; make the ambient
   wobble loop pausable and resumable instead of a bare forever-recursion.
   _Verify:_ trigger `expandToEdges(350)` from the console — the mat visibly fills the
   viewport in ~350ms; `springToHome(...)` returns it to the idle shape and the ambient
   wobble is confirmed still running afterward (watch several full legs, not just one).

5. **Suppress the router's default crossfade.**
   _Verify:_ navigate with network throttling on — no generic fade/ghosting is visible
   before step 6's real animation exists; a mid-navigation screenshot shows a clean,
   unanimated (for now) swap.

6. **Exit sequence.** Build the exit half of `page-transitions.ts`: mat expand, foreground
   fade, scroll-shapes fade, all in parallel over 350ms, gating the navigation via the
   `astro:before-preparation` loader hook, fetch running concurrently with the animation.
   _Verify:_ clicking About visibly expands the mat and fades content before the page
   changes; a Playwright screenshot ~200ms into the click shows the mat mid-expand and
   content faded, destination not yet visible.

7. **Enter sequence + nav active-state.** Wire `astro:page-load`: mat spring-back, then
   paper fade-in, then nav active-class update from `window.location.pathname`.
   _Verify:_ full round trip both directions (Home→About, About→Home) looks symmetric; nav
   shows the correct link in `text-ink` after each; a direct load of `/about` (typed URL)
   plays the identical enter sequence.

8. **Reduced motion.** Wrap the sequence in `gsap.matchMedia()`.
   _Verify:_ with `prefers-reduced-motion: reduce` emulated, navigating to About shows
   correct destination content immediately, no stuck mid-transition state.

9. **Full pass.** `npm run check` clean; wide + narrow viewport check on both pages; timing
   values confirmed to live only in `config/page-transition.ts`.
   _Verify:_ cold load `/`, click About, click Home, refresh on `/about` directly — all
   four look right; `astro check` passes.

---

## Done when

Home ⇄ About never shows a full reload or a flash: the mat sweeps to fill the viewport as
content fades over 350ms, springs back to its idle shape, and the destination's paper fades
in — with the nav and logo never themselves flashing, and the active nav link updating
correctly on every load (cold or in-app). Services and Work remain inert placeholders.
About is a real scroll-engine chapter whose paper height follows its content, scrubbing
by steadily as the user scrolls rather than holding still and flying away. Reduced-motion
users get correct content with the animation skipped. `astro check` is clean and the
sequence holds up at both a wide and a narrow/tall viewport.
