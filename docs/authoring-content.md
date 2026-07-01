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
      {
        id: "intro",
        motionPath: "home/01-intro/motion",
        midground: "--midground-tan",
      },
      {
        id: "placeholder",
        motionPath: "home/02-placeholder/motion",
        midground: "--midground-slate",
      },
    ],
  },
};
```

- **Add a chapter** → create its folder (below), then add one entry to the list.
- **Reorder chapters** → reorder the list.
- **Remove a chapter** → delete its entry (and, when you're sure, its folder).
- **Make a page scroll normally** → `useScrollEngine: false`.

The `midground` field references a CSS palette token from `global.css`. The engine
interpolates `--color-midground` between adjacent chapters' values as the transition
scrolls. Omit it to default to `--midground-tan`.

### Wiring chapters into a page

Each `.astro` page imports its chapter content and motion explicitly:

```astro
---
import Base from "../layouts/Base.astro";
import IntroContent from "../chapters/home/01-intro/Content.astro";
import PlaceholderContent from "../chapters/home/02-placeholder/Content.astro";
---

<Base>
  <IntroContent />
  <PlaceholderContent />
</Base>

<script>
  import { initScrollEngine } from "../motion/engine";
  import { pages } from "../config/pages";
  import introMotion from "../chapters/home/01-intro/motion";
  import placeholderMotion from "../chapters/home/02-placeholder/motion";

  initScrollEngine(pages.home, [introMotion, placeholderMotion]);
</script>
```

The motion array must match the `chapters` order in `pages.ts`.

---

## A chapter folder

```
src/chapters/<page>/<NN-name>/
  Content.astro   ← the markup (imports Chapter.astro and uses its slots)
  motion.ts       ← how it enters, leaves, and reveals its content
```

The `NN-` prefix (01-, 02-) is for human ordering on disk only; the real order is
the list in `pages.ts`.

---

## The content shape: `Content.astro`

### Standard chapter (with paper)

`Chapter.astro` renders the foreground white card. It requires an `id` prop (matched
by the scroll engine via `[data-chapter]`) and three **optional** named slots:

- `header` — e.g. a title or eyebrow
- `main` — the body. Accepts arbitrary markup.
- `footer` — e.g. a caption, small action, or flourish

```astro
---
import Chapter from "../../../components/Chapter.astro";
import StageLeft from "../../../layouts/StageLeft.astro";
---

<StageLeft>
  <Chapter id="intro">
    <Fragment slot="main">
      <p>Dear ______,</p>
      <p>Thank you for your interest …</p>
    </Fragment>
  </Chapter>
</StageLeft>
```

### Paperless chapter (`paper={false}`)

Pass `paper={false}` to skip the white card and shadow entirely. Content sits
directly on the midground. Use this for full-bleed, atmospheric chapters.

```astro
<StageCenter>
  <Chapter id="my-chapter" paper={false}>
    <div slot="main">
      <!-- content goes here, styled for the midground color -->
    </div>
  </Chapter>
</StageCenter>
```

Text in a paperless chapter should use `color: var(--color-foreground)` (white)
so it reads against the midground tan or slate.

---

## Declaring a midground color

A chapter's midground color is declared in `pages.ts`, not in the component:

```ts
{ id: "my-chapter", motionPath: "…", midground: "--midground-slate" }
```

Available palette tokens are in `global.css` under `/* Midground color palette */`.
To add a new color:

1. Add a token to the `:root` palette block in `global.css`.
2. Reference it by name in `pages.ts`.

---

## Adding scroll beats

Beats are intra-chapter reveals driven by scroll. A chapter with beats is pinned
(visually — all layers are already `position:fixed`) while the beats timeline scrubs,
then exits.

### 1. Mark beat elements in the DOM

Give each block a `data-beat` attribute:

```astro
<div slot="main">
  <p data-beat="a">First beat.</p>
  <p data-beat="b">Second beat.</p>
</div>
```

### 2. Build the beats timeline in `motion.ts`

```ts
import gsap from "gsap";
import type { ChapterMotion } from "../../../motion/engine";
import { fadeInUpFrom, fadeInUpTo, shiftUp } from "../../../motion/presets";

const motion: ChapterMotion = {
  beatDurationVH: 150, // scroll travel allocated to the beats window

  beats(container) {
    const a = container.querySelector("[data-beat='a']");
    const b = container.querySelector("[data-beat='b']");
    const tl = gsap.timeline();

    tl.fromTo(a, fadeInUpFrom(), fadeInUpTo(), 0); // beat 1
    tl.fromTo(b, fadeInUpFrom(), fadeInUpTo(), 0.55); // beat 2 …
    tl.to(a, shiftUp(), 0.55); // … A shifts as B appears

    return tl;
  },
};

export default motion;
```

The engine wraps the returned timeline in a scrubbed ScrollTrigger. You do not add
`scrollTrigger` to the timeline itself.

### Reduced motion

The engine calls `tl.progress(1)` in the reduced-motion branch, jumping all beats
to their final visible state. No additional work needed in `motion.ts`.

### Beat presets

| Preset               | Use                                                   |
| -------------------- | ----------------------------------------------------- |
| `fadeInUpFrom()`     | `from` state: hidden, 40 px below                     |
| `fadeInUpTo()`       | `to` state: visible, at natural position              |
| `shiftUp(distance?)` | move element up from current position (default 36 px) |

Use raw GSAP for anything these don't cover.

---

## Styling content

Reach for design tokens — Tailwind utilities (`text-ink`, `font-serif`) or token
variables (`var(--color-ink)`) — rather than literal values, so a palette or type
change propagates everywhere. See `design-tokens.md`.
