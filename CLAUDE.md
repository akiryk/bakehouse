# Bakehouse — CLAUDE.md

Bakehouse is the website for a small, independent web-design studio. The aesthetic is
quiet and refined — evocative of typed copy on paper — favoring restraint and the
occasional small delight over flash.

This is the **canonical guide** to the project: how we work, the decisions we've locked
in, and where everything lives. It's meant to stay stable across whatever we happen to be
building. Specialized detail lives in `docs/`.

---

## The developer-experience principle

This app is authored by iterating on how things look, animate, and transition. Every
convention below serves one goal: fine-tuning any of that from an obvious, predictable
place — a token, a config value, a Tailwind class at the point of use — without tracing
up a component tree or editing shared code to change one page's behavior. Three domains:

- **Element motion** — timing, delay, easing, duration, and what animates (position, color,
  opacity) belong in a chapter's own `motion-script.ts`, or a shared preset
  (`motion-presets/motion-script.ts`) — never buried in the engine.
- **Page transitions** — a page's stage color, motion, and duration belong in its own
  `PageConfig` (`page-system/config.ts`) and `page-transitions/config.ts`. A static per-page
  fact (e.g. a resting stage color) isn't a scroll event — don't force it through a
  scrubbed `morph()` just because that's the nearest mechanism; see `docs/motion.md`.
- **Styling** — everything downstream of color/spacing/type lives in Tailwind classes and
  `global.css` tokens, editable at the point of use. **A shared component must inherit
  minimal styling, so a class at the call site actually works** — if `ProjectCard` sets
  `text-base` internally and `text-lg` at the call site does nothing, the card is wrong.

If you can't point to the one file or token that controls something worth tuning, that's
the bug — even when the visible behavior is correct.

---

## How we work

Work **autonomously** on routine, reversible actions — editing files, installing a
called-for dependency, running the dev server or build — without asking first. Uphold
quality continuously as your own responsibility (security, best practices,
maintainability, performance), not something to check in about.

**Pause and ask only when a decision genuinely warrants a human:**

- It's destructive or hard to undo (deleting real work, force operations, clearing a
  non-empty directory).
- It touches security or secrets.
- It would deviate from the architecture or conventions in these docs — including
  introducing a significant new dependency the docs don't anticipate.
- It's a real fork with no clear right answer, where guessing wrong is costly to reverse.
- Something looks hacky or risky and the clean fix isn't obvious.

Otherwise, don't wait. Moving through an epic's steps, leave a short note at the end of
each — what you did, how you verified it, anything hacky or surprising — then continue
unless the note raises a question. Steps keep work legible; they're not approval gates.

**Verify against the rendered result, not your own report.** Confirm a change by looking
at what actually rendered, not by re-reading the source or restating intent. Check both a
wide and a narrow window for anything responsive — "I set the attribute" isn't evidence
it took effect.

**A brand-new Tailwind class rendering with zero effect is usually a stale dev-server
cache, not broken code.** Vite's dependency cache can go stale mid-session and keep
serving CSS missing a utility introduced since the server last started, even across a
plain restart. See `docs/playwright-verification.md` → "Stale dev-server cache" for the
fix (`npm run dev:force`).

---

## Stack & decisions

Settled. Don't relitigate without flagging.

- **Astro 6.x**, static output (SSG), TypeScript. **No UI framework** (no React/Vue/etc.).
  The only interactivity is one self-contained animation layer — the islands sweet spot.
- **Node 22.12+** (Astro 6 requirement; verify `node -v`).
- **Tailwind CSS v4** for styling and design tokens, via the `@tailwindcss/vite` plugin.
  Tokens are declared in an `@theme` block — see **Conventions** and `docs/design-tokens.md`.
- **GSAP** for all motion (free, all plugins), scrubbed by **ScrollTrigger**. **Native
  scroll, never wheel/touch hijacking, and never `pin:`** — every layer is already
  `position: fixed`; a scroll spacer gives the page real height, and one master timeline is
  scrubbed by scroll progress.
- **Adobe Caslon Pro** (serif) and **Jost** (sans, self-hosted variable) — see
  `docs/design-tokens.md`.
- A CMS (Decap/Storyblok) is possible later; the content shape stays regular enough to
  allow it. Not now.

---

## The core idea

(Full version: `docs/architecture.md`.)

Three visual layers, back to front: a flat **background**; a near-rectangular **stage**
(~8 vertices, CSS `clip-path`, not SVG) whose vertices drift within a small range so the
edges feel quietly alive; and a **foreground** that holds a chapter's content.

Every page is an **ordered list of chapters**. A chapter has two **decoupled** parts:
**content** (what it says) and **motion** (how it enters and leaves).

---

## Folder map

```
bakehouse/
  CLAUDE.md
  README.md
  docs/                    ← specialized guides; epics/ and stories/ track active work
  .claude/
    settings.json          ← permission allowlist + format-on-write hook
  src/
    styles/                ← global.css: Tailwind entry + ALL @theme tokens
    layouts/                 ← Base.astro (the persistent layers + <slot/>) and per-chapter
                                positioning layouts (StageLeft, StageCenter, ...)
    components/              ← reusable visual components (Chapter.astro, Paper.astro,
                                Nav.astro, ProjectCard.astro, scroll-shapes/, ...) AND one
                                folder per motion/config "concern" (stage/, scroll-engine/,
                                page-system/, motion-presets/, timeline/, page-transitions/,
                                beat-model/) — each concern folder holds a config.ts
                                (tunable values) and/or motion-script.ts (the logic that
                                reads them), never both mixed into one file.
    global-scripts/          ← page-agnostic bootstrapping that must run exactly once and
                                dispatch by page identity (page-init.ts)
    pages/                   ← one thin route file per page (index.astro, about.astro,
                                work.astro) that renders that page's content; a same-named
                                folder per page holds its own motion-script.ts and a
                                _chapters/<name>/ per chapter (Content.astro +
                                motion-script.ts). _chapters is underscore-prefixed so
                                Astro's router ignores it.
  public/                  ← static files served as-is
```

**Where does a new file go?**

- A new reusable visual component → `components/`.
- A new motion/config concern (its own tunable values and/or driving logic, reusable
  across pages) → its own folder under `components/`, holding `config.ts` and/or
  `motion-script.ts` — the same shape as every existing one.
- A new page → `pages/<name>.astro` (thin route) + `pages/<name>/` (that page's own
  `motion-script.ts` and `_chapters/`).
- A new top-level directory under `src/`? Only if none of the above fit — flag it first
  (see **How we work**).

**Where do I change X?**

- A color, font, or type token → `src/styles/global.css` (the `@theme` block)
- A stage wobble range or shape parameter → `src/components/stage/config.ts`
- Scroll/beat timing (fly-away distance, ease) → `src/components/scroll-engine/config.ts`
- A page's resting stage color, or its transition timing → `page-system/config.ts` (`matColor`) and `page-transitions/config.ts`
- A chapter's copy or images → that chapter's `Content.astro`
- A chapter's animation → that chapter's `motion-script.ts`
- A motion you want to reuse everywhere → `motion-presets/motion-script.ts`
- The order of chapters, or whether a page animates → `page-system/config.ts`
- The scroll engine's fundamental behavior → `scroll-engine/motion-script.ts` (rare; see `docs/architecture.md`)

---

## Conventions/Rules

- **All visual values come from design tokens.** `src/styles/global.css` holds color, font,
  shadow, and layout tokens: a `:root` palette of raw values, and `@theme` semantic tokens
  that reference the palette and generate Tailwind utilities (`text-ink`, `bg-ink`,
  `border-ink`). Motion and behavior values live in each concern's own `config.ts`. **Never
  hardcode a color, font, size, timing, or shadow in a component** — applies to every
  chapter, not just shared components.

- **Styling is Tailwind-first. This is non-negotiable.** A `<style>` block is a last resort.
  Acceptable reasons for custom CSS: (1) Tailwind has no equivalent (`clamp()`, `calc()` with
  CSS vars, `mask-image`, `will-change`, a GSAP-coordinated initial state); (2) Tailwind could
  express it, but clunkier than CSS already required nearby; (3) a unique, documented reason
  with an inline comment explaining why. If you can't write that comment, the CSS doesn't
  belong there.

- **No arbitrary Tailwind values** (`mt-[43px]`, `text-[#3a2b1c]`). Add a named token instead,
  or fall back to reason 2 above. `left-(--tl-line-x)`-style CSS-variable references are
  fine — they name a token, they're not arbitrary.

- **Respect `prefers-reduced-motion`** via `gsap.matchMedia()`. Content is always reachable
  without motion; motion is a grace note, never a gate.

- **Keep the scroll engine's contract minimal** — chapters expose `beats`/`schedule`; the
  engine only knows "things that enter and leave on scroll," never what a paper is. The
  motion domain above is why: rules here are expressions of the developer-experience
  principle, not an accumulating checklist.

---

## Docs

- **`docs/architecture.md`** — the three layers, the chapter contract, and the
  escape-hatch ladder that keeps the framework from locking us in.
- **`docs/authoring-content.md`** — add, edit, reorder, or remove chapters; the
  `Content.astro` slot shape; the `page-system/config.ts` manifest.
- **`docs/motion.md`** — the scroll engine, the page-script/chapter-beats two-level model,
  presets, a page's resting color vs. scroll-driven morphs, reduced-motion handling, and the
  ambient stage wobble.
- **`docs/design-tokens.md`** — the Tailwind `@theme` tokens, both typefaces, and
  `stage/config.ts` / `scroll-engine/config.ts`.
- **`docs/navigation.md`** — the persistent nav: active-link state, styling, and how it
  survives SPA navigation.
- **`docs/testing.md`** — the testing philosophy, the always-on `astro check` gate, tool
  choices, and where tests live / when to write them.
- **`docs/scroll-shapes.md`** — the ambient scroll-shapes layer: config reference,
  scroll-driven position model, and how to tune density, size mix, and timing.
- **`docs/playwright-verification.md`** — how to drive a real headless browser to verify
  scroll-driven and responsive behavior against the actual rendered page.
- **`docs/perf-harness.md`** — the reproducible perf harness: Core Web Vitals and image-load
  metrics with a noise floor, for A/B-ing whether a change actually helped.

---

## Current work

Discrete units of work are tracked as **epics** in `docs/epics/`, and as smaller
**stories** in `docs/stories/` (either standalone or part of an epic). You'll be pointed at
what's active at the start of a session — this file stays version-stable and doesn't track
which is current.
