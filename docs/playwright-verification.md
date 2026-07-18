# Playwright verification

How to drive a real (headless) browser to check a change against the actual rendered
page — the concrete tool behind CLAUDE.md's "verify against the rendered result, not
your own report" rule. This project has no UI framework and one animation layer driven
by GSAP/ScrollTrigger; reading the source can't tell you whether a scroll-driven effect
actually looks right, only loading the page and observing it can.

## Status: not an installed dependency

Playwright is **not** in `package.json`. It's fetched on demand via `npx` for ad-hoc
verification during a work session, not (yet) set up as a checked-in, automated E2E
suite — that's a separate, deferred decision tracked in `docs/testing.md`. Keeping it
out of the project's dependencies means a verification pass never touches
`package.json`/`package-lock.json`.

## One-time setup (per machine)

```bash
npx playwright@1.61.1 install chromium
```

Downloads the browser binary to a user-level cache (e.g.
`~/Library/Caches/ms-playwright`), not the repo.

`npx` resolves the `playwright` package into a temp cache directory rather than a local
`node_modules`, so a plain script's `import { chromium } from "playwright"` won't
resolve on its own. Symlink it once per session:

```bash
# Run once so npx has fetched the package into its cache:
npx playwright@1.61.1 --version

# Find where it landed, then symlink it into a node_modules Node will resolve from:
find ~/.npm/_npx -maxdepth 4 -iname playwright -type d
mkdir -p /tmp/node_modules
ln -s <path from the find output> /tmp/node_modules/playwright
```

Write and run verification scripts from `/tmp` so that resolution works.

## Before driving the page

Confirm the dev server is actually up and find its real port — `curl` the title tag
rather than assuming a port, since more than one dev server can be running on a machine
at once:

```bash
curl -s http://localhost:4321/ | grep -o "<title>.*</title>"
```

## Driving the page

- `chromium.launch()` → `browser.newPage({ viewport })`. Per CLAUDE.md, always check at
  least one **wide** and one **tall/narrow** viewport.
- **Prefer real input over programmatic scrolling.** Use `page.mouse.wheel(0, dy)` in a
  loop, not `page.evaluate(() => window.scrollTo(...))`. Forcing `scrollTo` — especially
  in one large jump — doesn't reliably exercise GSAP ScrollTrigger's own scroll/rAF
  pipeline the way real wheel input does; this project hit a case where a forced jump to
  `scrollTo(0, 0)` left `window.scrollY === 0` while the page was still visually showing
  a mid-page chapter. Real wheel events don't have this gap.
- Read rendered state with `page.$$eval(selector, els => ...)` and
  `getBoundingClientRect()` / `getComputedStyle()` — assert on the DOM's actual computed
  geometry, not on the source config that produced it.
- Always take a screenshot (`page.screenshot({ path })`) and use the Read tool to
  actually look at it. A numeric assertion ("0 shapes visible") can pass while the
  rendered result is still visually wrong, and vice versa — the screenshot is the check
  that matters.

## What this has caught that `astro check` couldn't

Layout-derived measurements (e.g. `document.documentElement.scrollHeight`) taken at
script-execution time can run before a _later_ script finishes mutating the DOM (e.g.
the scroll engine appending its scroll-height spacer to `<body>`). This produced a real
bug — an entry-range config that silently had no effect — that only showed up by loading
the page and measuring the rendered geometry; a type check has no opinion on document
script order.

## Stale dev-server cache: rule this out before doubting your code

**Symptom:** a class you just added — a new `@theme` token utility, or a
`utility-(--custom-property)` reference — renders with visibly zero effect. The element's
`getComputedStyle` shows the browser default, not your token's value, even though the
class name, the token name, and the component code are all correct. A _plain_ `astro dev`
restart does not fix it.

**Cause:** confirmed directly (Story 19.5's `ProjectCard.astro`) — Vite's on-disk
dependency-optimization cache (`node_modules/.vite`) can go stale mid-session and keep
serving a Tailwind build that's missing utility classes for candidates introduced by
files added or changed since the dev server last cold-started. A plain restart reuses
that on-disk cache, so it reproduces the exact same gap; only a forced re-scan clears it.
Concretely, some classes on the same element/line worked while others didn't (e.g.
`text-card-heading` compiled but `text-card-meta`, `bg-card-button`, and every
`-(--browse-*)` reference on the very same component did not) — a partial, inconsistent
miss, not "nothing works," which is what makes it easy to mistake for a code bug.

**Diagnostic — confirm it's the cache, not your code:** curl the dev server's own served
stylesheet directly and grep for the selector you expect, bypassing the DOM/computed-style
layer entirely:

```bash
curl -s "http://localhost:4321/src/styles/global.css" -o /tmp/served-global.css
grep -o "your-expected-class-fragment" /tmp/served-global.css
```

If the fragment is entirely absent from the served CSS, it's the cache — not a typo, not a
collision, not a wrong token name.

**Fix:** `npm run dev:force` (runs `astro dev --force`, which busts the dependency cache
and forces a full re-scan). Kill any plain `astro dev` first so they don't fight over the
port.

**When to reach for this:** any time in a session you add a brand-new file, a brand-new
`@theme` token, or a class that has never appeared literally in any file before, and its
effect doesn't show up. Check this before spending time re-deriving whether the token, the
collision rules, or the component markup are wrong — they're very possibly all fine.

## Cleanup

Temp verification scripts and the `/tmp/node_modules` symlink are scratch — safe to
delete anytime. Nothing in this workflow touches the repo.
