# Bakehouse — CLAUDE.md

Bakehouse is the website for a small, independent web-design studio. The aesthetic is
quiet and refined — evocative of typed copy on paper — favoring restraint and the
occasional small delight over flash.

This is the **canonical guide** to the project: how we work, the decisions we've locked
in, and where everything lives. It's meant to stay stable across whatever we happen to be
building. Specialized detail lives in `docs/`; the _current_ piece of work is whatever the
active epic says (see **Current work** at the end).

---

## How we work

Work **autonomously**. You don't need permission for routine, expected, reversible
actions — creating or editing files, installing a dependency the docs call for, running
the dev server or build, restructuring within the plan. Do them and keep moving.

Uphold quality **continuously**, as your own responsibility rather than something to ask
about: security (no secrets committed, no unsafe patterns), best practices,
maintainability (does this fit the architecture below?), and performance.

**Pause and ask only when a decision genuinely warrants a human:**

- It's destructive or hard to undo (deleting real work, force operations, clearing a
  non-empty directory).
- It touches security or secrets.
- It would deviate from the architecture or conventions in these docs — including
  introducing a significant new dependency the docs don't anticipate.
- It's a real fork with no clear right answer, where guessing wrong is costly to reverse.
- Something looks hacky or risky and the clean fix isn't obvious.

Otherwise, don't wait. When following an epic, move through its steps in order; at the end
of each step leave a short note — what you did, how you verified it, and anything
noteworthy (especially anything that felt hacky, risky, or surprising) — then continue
unless that note contains a question. The steps keep the work legible and verifiable; they
are **not approval gates**.

**Verify against the rendered result, not your own report.** Confirm a change by looking at
what actually rendered — the page, the DOM — not by re-reading the source or restating
intent. For anything responsive, check both a **wide** and a **tall/narrow** window before
calling it done: behavior that looks right at one window shape routinely breaks at another,
and "I set the attribute" is not evidence the attribute took effect.

---

## Stack & decisions

Settled. Don't relitigate without flagging.

- **Astro 6.x**, static output (SSG), TypeScript. **No UI framework** (no React/Vue/etc.).
  The only interactivity is one self-contained animation layer — the islands sweet spot.
- **Node 22.12+** (Astro 6 requirement; verify `node -v`).
- **Tailwind CSS v4** for styling and design tokens, via the `@tailwindcss/vite` plugin
  (the correct v4 pattern for Astro). Tokens are declared in an `@theme` block — see
  **Conventions** and `docs/design-tokens.md`.
- **GSAP** for all motion (free, all plugins). **ScrollTrigger with pinning** drives
  scroll — **native scroll, never wheel/touch hijacking.**
- **SVG** for the midground shape and the logo.
- **One paper per chapter** — each chapter's foreground rectangle flies away as the next
  arrives.
- **Adobe Caslon Pro** via Adobe Fonts (account embed; see `docs/design-tokens.md`).
- A CMS (Decap/Storyblok) is possible later; the content shape stays regular enough to
  allow it. Not now.

---

## The core idea

(Full version: `docs/architecture.md`.)

Three visual layers, back to front: a flat **background**; a near-rectangular **midground**
polygon (~8 vertices) whose vertices drift within a small range so the edges feel quietly
alive; and a **foreground** "paper" rectangle that holds content.

Every page is an **ordered list of chapters**. A chapter has two **decoupled** parts:
**content** (what it says) and **motion** (how it enters and leaves). By default a
chapter's paper flies away on scroll (slow, then accelerating) and the next arrives — but
that's a default a chapter can override, not a hardcoded rule.

---

## Folder map

```
bakehouse/
  CLAUDE.md
  README.md
  docs/
  .claude/
    settings.json            ← permission allowlist + format-on-write hook
  src/
    styles/
      global.css             ← Tailwind entry + @theme tokens  (ALL colors, fonts, type)
    config/
      motion.ts              ← motion tokens: wobble ranges, easings, durations
      pages.ts               ← each page's ordered chapter list + useScrollEngine flag
    layouts/
      Base.astro             ← background + persistent midground octagon + <slot/>
    components/
      Chapter.astro          ← the foreground "paper" + slots: header / main / footer
    motion/
      engine.ts              ← reads a page's chapters, builds the pinned scroll timeline
      presets.ts             ← reusable motions: flyUpAccelerate, fadeIn, paperRise, ...
      octagon.ts             ← the ambient vertex wobble (independent of scroll)
    chapters/
      home/
        01-intro/
          Content.astro      ← the "Dear ___," copy
          motion.ts          ← this chapter's enter/exit (or "use the default")
    assets/                  ← logo.svg and other imported assets
  public/                    ← static files served as-is
```

**Where do I change X?**

- A color, font, or type token → `src/styles/global.css` (the `@theme` block)
- A wobble range or motion timing → `src/config/motion.ts`
- A chapter's copy or images → that chapter's `Content.astro`
- A chapter's animation → that chapter's `motion.ts`
- A motion you want to reuse everywhere → `src/motion/presets.ts`
- The order of chapters, or whether a page animates → `src/config/pages.ts`
- The scroll engine's fundamental behavior → `src/motion/engine.ts` (rare; see architecture.md)

---

## Conventions

- **All visual values come from design tokens.** Colors, fonts, and type live in the
  Tailwind `@theme` block (`src/styles/global.css`); motion/behavior values (wobble
  ranges, easings, durations) live in `src/config/motion.ts`. **Never hardcode a color,
  font, size, or timing in a component** — reach for a token (a Tailwind utility, a CSS
  variable, or a value from `motion.ts`). If a value affects how the site looks or feels,
  it belongs in a token home, not inline.
- **Styling is Tailwind-first.** Use utilities for layout and positioning; reserve a scoped
  `<style>` block (or `@apply`) only for what utilities express clumsily. Global resets live
  in `global.css`, not in a component's styles.
- **Native scroll + ScrollTrigger pinning.** No scroll-jacking, no fake scrollbars.
- **Respect `prefers-reduced-motion`** via `gsap.matchMedia()`. Content is always
  reachable without motion; motion is a grace note.
- **Keep the engine's contract minimal** — chapters expose enter/exit hooks; the engine
  knows about "things that enter and leave on scroll," not papers. The fly-away is a
  default preset, not welded into the engine.
- **No one-off magic values** anywhere.

---

## Docs

- **`docs/architecture.md`** — the three layers, the chapter contract, and the
  escape-hatch ladder that keeps the framework from locking us in.
- **`docs/authoring-content.md`** — add, edit, reorder, or remove chapters; the
  `Content.astro` slot shape; the `pages.ts` manifest.
- **`docs/motion.md`** — the scroll engine, the two-track (paper / content) model,
  presets, reduced-motion handling, and the ambient octagon wobble.
- **`docs/design-tokens.md`** — the Tailwind `@theme` tokens, the Adobe Caslon Pro setup,
  and `config/motion.ts`.
- **`docs/testing.md`** — the testing philosophy, the always-on `astro check` gate, tool
  choices, and where tests live / when to write them.

---

Discrete units of work are tracked as **epics** in `docs/epics/`. You'll be pointed at
the active one at the start of a working session — this file stays version-stable and does
not track which epic is current.
