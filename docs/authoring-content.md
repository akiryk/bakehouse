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
      { id: "intro", motionPath: "home/intro/motion" },
      { id: "services", motionPath: "home/services/motion" },
      { id: "timeline", motionPath: "home/timeline/motion" },
    ],
  },
};
```

- **Add a chapter** → create its folder (below), then add one entry to the list.
- **Reorder chapters** → reorder the list.
- **Remove a chapter** → delete its entry (and, when you're sure, its folder).
- **Make a page scroll normally** → `useScrollEngine: false`.

`pages.ts` only declares _which chapters exist and in what order_ — it doesn't say
anything about timing, entry/exit motion, or color. That's all authored in the page's
script (see **Declaring a midground color** and `docs/motion.md`'s "Scroll geometry").

### Wiring chapters into a page

Each `.astro` page imports its chapter content and motion explicitly, plus the page script
that places them on the scroll timeline:

```astro
---
import Base from "../layouts/Base.astro";
import IntroContent from "../chapters/home/intro/Content.astro";
import ServicesContent from "../chapters/home/services/Content.astro";
---

<Base>
  <IntroContent />
  <ServicesContent />
</Base>

<script>
  import { initPageEngine } from "../motion/engine";
  import { pages } from "../config/pages";
  import { PAGE } from "../motion/home.script";
  import introMotion from "../chapters/home/intro/motion";
  import servicesMotion from "../chapters/home/services/motion";

  initPageEngine(pages.home, PAGE, [introMotion, servicesMotion]);
</script>
```

The motion array passed to `initPageEngine` must match the `chapters` order in `pages.ts`.
`PAGE` (the resolved page script, built with `definePageScript`/`at()` in
`src/motion/<page>.script.ts`) is what actually places each chapter's dwell window and its
enter/exit motion on the scroll timeline — see `docs/motion.md`.

---

## A chapter folder

```
src/chapters/<page>/<name>/
  Content.astro   ← the markup (imports Chapter.astro and uses its slots)
  motion.ts       ← its beats() timeline and event schedule, if any
```

Folder names match the chapter's `id` directly (e.g. `home/intro/`, `home/services/`) —
there's no numeric ordering prefix on disk; the real order is the list in `pages.ts`.

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

A chapter's midground color isn't declared statically anywhere — it's authored as a
`morph({ from, to, over })` moment, placed with `at()` in the page script (or a chapter's
own `script.ts`, for an intra-chapter morph), scrubbing `--color-mat` between two palette
tokens as the transition scrolls:

```ts
// src/motion/home.script.ts
at(0, morph({ from: "--palette-tan", to: "--palette-yellow", over: 1 })),
```

Available palette tokens are in `global.css`'s `:root` block under `/* Color palette */`
(`--palette-tan`, `--palette-sage`, `--palette-slate`, …). To add a new color:

1. Add a token to the `:root` palette block in `global.css`.
2. Reference it by name in a `morph()` moment in the relevant page or chapter script.

See `docs/motion.md` → "Midground color morph" for the full technique.

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

### 3. Give it a dwell window in the page script

The chapter's _own_ `motion.ts` only builds the timeline — how long its dwell window is on
the page is set where it's placed in the page script:

```ts
// src/motion/home.script.ts
at(0, chapter("my-chapter", { dwellBeats: 1.5 })),
```

The engine wraps the returned `beats()` timeline in a scrubbed ScrollTrigger for that
window. You do not add `scrollTrigger` to the timeline itself.

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
