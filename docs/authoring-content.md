# Authoring content

How to add, edit, reorder, and remove chapters — and the shape content takes.

---

## The page manifest: `src/config/pages.ts`

Each page declares its chapters in order and whether the scroll engine is active:

```ts
export const pages: Record<string, PageConfig> = {
  home: {
    useScrollEngine: true,
    chapters: [
      { id: "intro", motionPath: "home/01-intro/motion" },
      // add the next chapter here
    ],
  },
  // about: { useScrollEngine: false, chapters: [] },
};
```

- **Add a chapter** → create its folder (below), then add one entry to the list.
- **Reorder chapters** → reorder the list.
- **Remove a chapter** → delete its entry (and, when you're sure, its folder).
- **Make a page scroll normally** → `useScrollEngine: false`. The page renders in
  ordinary document flow with no pinning or fly-away.

The engine never assumes a chapter count. Two chapters or nine: same code path.

### Wiring chapters into a page

Each `.astro` page imports its chapter content and motion explicitly and calls
`initScrollEngine` in a `<script>` block:

```astro
---
import Base from "../layouts/Base.astro";
import IntroContent from "../chapters/home/01-intro/Content.astro";
---

<Base>
  <IntroContent />
</Base>

<script>
  import { initScrollEngine } from "../motion/engine";
  import { pages } from "../config/pages";
  import introMotion from "../chapters/home/01-intro/motion";

  initScrollEngine(pages.home, [introMotion]);
</script>
```

The motion array must match the `chapters` order in `pages.ts`.

---

## A chapter folder

```
src/chapters/<page>/<NN-name>/
  Content.astro   ← the markup (imports Chapter.astro and uses its slots)
  motion.ts       ← how it enters and leaves (see motion.md)
```

The `NN-` prefix (01-, 02-) is for human ordering on disk only; the real order is
the list in `pages.ts`.

---

## The content shape: `Content.astro`

`Content.astro` renders the chapter by wrapping the markup inside `Chapter.astro`,
which provides the foreground paper. Chapter.astro requires an `id` prop (used by
the scroll engine) and three **optional** named slots:

- `header` — e.g. a title or eyebrow
- `main` — the body. **Accepts arbitrary markup**: prose, an image grid, a table, an
  embed, anything.
- `footer` — e.g. a caption, a small action, a flourish

A chapter uses only the slots it needs. Example for the intro chapter:

```astro
---
import Chapter from "../../../components/Chapter.astro";
---

<Chapter id="intro">
  <Fragment slot="main">
    <p>Dear ______,</p>
    <p>Thank you for your interest in my studio. I design and build websites
       locally for a select group of very special clients …</p>
  </Fragment>
</Chapter>
```

That's the whole convention. Because `main` takes arbitrary markup, a chapter can
change from a paragraph today to an image grid next week with no change to its
motion, and no change to the engine.

### When the shape gets in your way

If a chapter genuinely doesn't fit header/main/footer, write a custom content
component and use it instead — see `architecture.md` → escape-hatch ladder, rung 3.
The framework won't fight you.

---

## Styling content

Reach for design tokens — Tailwind utilities (`text-ink`, `font-serif`) or token
variables (`var(--color-ink)`) — rather than literal values, so a palette or type
change propagates everywhere. See `design-tokens.md`.
