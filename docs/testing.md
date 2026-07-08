# Testing

This is a visual, animation-driven project, and animation is among the worst things to
unit-test — you evaluate motion by eye, not by asserting numbers against a timeline. So the
goal here isn't lots of tests. It's a sound footing: one always-on gate that's cheap and
high-value, settled tool choices, and a clear rule for when a test is actually worth
writing.

## The always-on gate: `astro check`

`npm run check` runs `astro check` — TypeScript plus Astro's own template/type validation.
It's the cheapest guardrail that catches the most, so run it before considering any step
done. It pairs with the Prettier format hook already in `.claude/settings.json`.

Setup (one-time): `npm install -D @astrojs/check typescript`, then add
`"check": "astro check"` to `package.json` scripts.

## Tools

- **Unit / logic — Vitest.** Configure it through Astro's `getViteConfig()` helper so tests
  share the project's resolution and aliases. Note: that helper needs Vitest 3.2+ (or the
  4.1 beta), so pin accordingly when you add it.
- **Component / E2E / visual — Playwright,** deferred as an _installed, checked-in_ test
  suite. Worth setting up permanently only once there's a stable enough interactive
  behavior to justify a maintained spec. It's already in ad-hoc use, though: fetched via
  `npx` (not a `package.json` dependency) to drive a real headless browser and check
  scroll-driven/responsive changes against the actual rendered page — see
  `docs/playwright-verification.md` for the recipe. That's a manual verification step
  during a work session, not an automated suite; the "install it properly" decision is
  still deferred until a checked-in E2E suite is worth maintaining.

Neither Vitest nor a checked-in Playwright suite is installed during the footing pass —
only the `astro check` gate is. Install Vitest when the first unit test is actually
written (see below).

## Where tests live

Co-locate unit tests as `*.test.ts` beside the module they cover — `motion/engine.test.ts`
next to `motion/engine.ts`. Co-location keeps the test discoverable from the thing it
tests. Reserve a top-level `tests/` directory for cross-cutting or E2E suites if/when
Playwright arrives.

## When to write a test

Write a test when you add **real logic** — branching, computation, or state that can be
wrong independent of how it looks. The first things that will qualify:

- the scroll engine's chapter sequencing (which chapter is active at a given progress),
- the octagon vertex/drift math (resolving a vertex's base + range into a position),
- the `pages.ts` → engine wiring (a page resolves to the right ordered chapters).

Do **not** write tests that assert against animation values you judge by eye (easing
curves, exact drift offsets, pixel positions mid-flight). That's effort spent pinning down
something you're going to tune by feel anyway.

## Running

- `npm run check` — always, before calling work done.
- `npm run test` — Vitest, once it's installed and there are tests to run.
