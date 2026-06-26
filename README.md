# Bakehouse

The website for an independent web-design studio. Quiet, refined, typed-on-paper.

## Prerequisites

- **Node 22.12 or later** (an Astro 6 requirement) — check with `node -v`
- **npm**

The required Node version is pinned in `package.json` via [Volta](https://volta.sh)
(the `volta` field). With Volta installed, it switches to the correct Node **automatically**
whenever you're in this directory — no manual step, and it can't be shadowed by a different
global Node. Without Volta, make sure your shell is on Node 22.12+ yourself before running
anything. Note that Volta does **not** read `.nvmrc` / `.node-version`; the pin lives only
in `package.json`.

## Setup

```bash
npm install
```

The display typeface (Adobe Caslon Pro) loads from an Adobe Fonts embed already wired into
the base layout. It renders on a fallback serif stack if that CDN is unreachable, so local
development needs no font setup.

## Develop

```bash
npm run dev       # start the dev server (astro dev) — http://localhost:4321
npm run build     # production build to dist/
npm run preview   # preview the production build locally
npm run check     # type + Astro validation (astro check) — run before calling work done
```

## Where things live

- **`CLAUDE.md`** — the canonical guide: stack, conventions, the core idea, the folder
  map, and where to change what. Read it first.
- **`docs/`** — specialized detail: `architecture.md`, `authoring-content.md`, `motion.md`,
  `design-tokens.md`, `testing.md`.
- **`docs/epics/`** — discrete units of work (an epic is named at the start of a build
  session).
