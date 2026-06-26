# Epic 01 — Foundation

**Goal:** get a basic Bakehouse site standing up — an Astro 6 + Tailwind v4 + GSAP project
with our folder structure, the correct fonts and colors, the three visual layers, some
rough ambient animation, the intro chapter with dummy copy, and a first pass at the
scroll-driven fly-away. Rough is fine. Real is the bar; polished is later.

**Out of scope:** portfolio/pricing chapters, additional pages, a CMS, deployment, final
easing/tuning, responsive polish.

---

## How we work this epic

Per `CLAUDE.md` → **How we work**. In short: work autonomously, uphold quality as you go,
and pause only for genuine decisions (destructive/irreversible actions, security,
deviations from the docs, real forks, or something hacky with no clean fix). Move through
the steps in order; after each, **verify it works**, leave a short note (what you did, how
you verified, anything noteworthy), and **continue** unless your note has a question for
me. The steps are for legibility and verification — not approval gates.

---

## Step 0 — Environment & inputs check

- Confirm `node -v` is **22.12+** (Astro 6 requirement). If not, stop and flag.
- Confirm npm works.
- Note the inputs that come from outside the repo:
  - The **logo SVG** already in `bakehouse/` (confirm its exact filename).
  - The **Adobe Fonts** embed (already recorded in `docs/design-tokens.md`).
  - The format hook (Step 1) needs `jq`, `prettier`, and `prettier-plugin-astro` — note
    whether they're present.
- **Verify & note:** report versions and whether the logo + tooling are available.

## Step 1 — Scaffold Astro + Tailwind, add settings

- Scaffold a **minimal** Astro 6 project **into the existing `bakehouse/` folder**
  (TypeScript, no UI framework, empty/minimal template). **Preserve** `CLAUDE.md`,
  `README.md`, `docs/`, `.claude/`, and the logo SVG — do not overwrite or delete them. If
  the scaffolder refuses to run in a non-empty directory, **stop and ask** rather than
  clearing anything (this is a destructive-action escalation).
- Add **Tailwind v4** via the `@tailwindcss/vite` plugin (the correct v4 pattern). Create
  `src/styles/global.css` with `@import "tailwindcss";` and import it from `Base.astro`.
- Drop in the provided `.claude/settings.json` (permission allowlist + format-on-write
  hook). Install `jq` / `prettier` / `prettier-plugin-astro` as needed, then confirm the
  hook actually fires on a file write (e.g. run `/hooks`, do a test edit). If the hook's
  file-path handling doesn't behave on this Claude Code version, adjust it and note what
  you changed.
- **Verify & note:** `npm run dev` serves a page with no errors; a Tailwind utility class
  takes effect; the format hook runs on save.

## Step 2 — Folder structure

- Create the structure from `CLAUDE.md` → Folder map: `src/config/` (`motion.ts`,
  `pages.ts`), `src/layouts/`, `src/components/`, `src/motion/`,
  `src/chapters/home/01-intro/`, `src/assets/`, with placeholder files where useful.
- **Verify & note:** project still builds; nothing imports a file that doesn't exist.

## Step 3 — Design tokens (colors + font)

- In `src/styles/global.css`, add the `@theme` block with the four colors and the TBD
  placeholders (link, accent, paper shadow) per `docs/design-tokens.md`.
- Wire the Adobe Fonts embed into `Base.astro`'s `<head>`; set `--font-serif` with the
  Caslon family + fallback stack. The fallback should render cleanly on its own.
- Create `src/config/motion.ts` with provisional octagon/scroll values.
- Render a throwaway test element using a Tailwind utility (`text-ink`, `font-serif`) and a
  token variable to prove both paths work.
- **Verify & note:** colors are correct; Caslon renders (or the fallback does, cleanly) —
  say explicitly which.

## Step 4 — The three layers (static)

- `Base.astro`: white **background**, the **midground** octagon as a *static* SVG polygon
  filled via `--color-midground` / `bg-midground`, and a **foreground** paper rectangle
  (`--color-foreground`) in front, roughly matching the reference composition.
- Place the **logo** (move the SVG into `src/assets/` or `public/` — your call; consider
  inlining it so it can take the ink color). Raise the placement choice in your note.
- **Verify & note:** the three layers stack correctly and resemble the reference at a glance.

## Step 5 — Ambient octagon wobble (rough)

- Add GSAP. Make the midground vertices **drift subtly and continuously** per
  `docs/motion.md` → "The ambient octagon," using values from `config/motion.ts`.
- Honor `prefers-reduced-motion` (hold still when requested).
- **Verify & note:** the wobble is barely-perceptible, smooth, and cheap; reduced-motion
  stops it. Flag anything about the SVG point animation that felt hacky.

## Step 6 — The intro chapter (static)

- `components/Chapter.astro`: the paper wrapper with optional `header` / `main` / `footer`
  slots.
- `chapters/home/01-intro/Content.astro`: the **"Dear ______,"** dummy copy from the
  reference, in the `main` slot.
- Register it in `src/config/pages.ts` under `home` with `useScrollEngine: true`.
- **Verify & note:** the intro renders inside the paper, in Caslon (or fallback), correct ink.

## Step 7 — Scroll engine skeleton + first fly-away (rough)

- `motion/engine.ts`: ScrollTrigger-pinned, progress-driven, reading the page's chapter
  list; does nothing when `useScrollEngine: false`.
- `motion/presets.ts`: a rough `flyUpAccelerate()` for the paper exit.
- `chapters/home/01-intro/motion.ts`: use the default (or name the preset).
- Even with a single chapter, demonstrate the paper beginning its **fly-away** on scroll.
  Wrap motion in `gsap.matchMedia()` with a reduced-motion branch.
- **Verify & note:** scrolling drives the paper's exit via native scroll (no hijacking);
  reduced-motion disables the fly-away and content stays reachable. This is the riskiest
  step — be especially candid about anything that felt like a workaround.

## Step 8 — Tidy & epic review

- Remove throwaway test elements. Make sure every visual value traces back to a token.
- Quick pass: does the folder map match `CLAUDE.md`? Do the docs still describe reality?
  Update any doc that drifted (you're allowed and expected to).
- **Verify & note:** summarize what's built, what's rough and known, and propose what
  Epic 02 should be.

---

## Done when

`npm run dev` shows: white background, the tan octagon gently breathing behind a white
paper, the "Dear ______," copy set in Adobe Caslon Pro (or a clean fallback) in the ink
color `#79530b`, and scrolling that begins to carry the paper away — all
reduced-motion-safe, with every color and font flowing from the Tailwind `@theme` tokens
and motion values from `config/motion.ts`.
