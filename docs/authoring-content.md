# Authoring content

How to add, edit, reorder, and remove chapters — and the shape content takes.

---

## The page manifest: `src/components/page-system/config.ts`

Each page declares its chapters in order and whether the scroll engine is active:

```ts
export const pages: Record<string, PageConfig> = {
  home: {
    useScrollEngine: true,
    chapters: [
      { id: "intro", motionPath: "home/_chapters/01-intro/motion-script" },
      {
        id: "services",
        motionPath: "home/_chapters/02-services/motion-script",
      },
      {
        id: "timeline",
        motionPath: "home/_chapters/03-timeline/motion-script",
      },
    ],
  },
};
```

- **Add a chapter** → create its folder (below), then add one entry to the list.
- **Reorder chapters** → reorder the list.
- **Remove a chapter** → delete its entry (and, when you're sure, its folder).
- **Make a page scroll normally** → `useScrollEngine: false`.

`page-system/config.ts` only declares _which chapters exist and in what order_ — it doesn't
say anything about timing, entry/exit motion, or color. That's all authored in the page's
own script (see **Declaring a midground color** and `docs/motion.md`'s "Scroll geometry").

### Wiring chapters into a page

Each `.astro` page imports its chapter content and passes a `page` identity to `<Base>` —
it does **not** call `initPageEngine` itself:

```astro
---
import Base from "../layouts/Base.astro";
import IntroContent from "./home/_chapters/01-intro/Content.astro";
import ServicesContent from "./home/_chapters/02-services/Content.astro";
---

<Base page="home">
  <IntroContent />
  <ServicesContent />
</Base>
```

The actual `initPageEngine` call lives in `src/global-scripts/page-init.ts`'s
`initHomePage()` (one function per page), dispatched by `Base.astro`'s own script on every
`astro:page-load` (cold load or SPA navigation). This isn't a stylistic choice — a per-page
`<script>` calling `initPageEngine` directly cannot be made to reliably re-run on a repeat
visit to that page under Astro's `<ClientRouter />`; see `docs/motion.md` → "Calling
`initPageEngine` under the SPA router" for the full reasoning. Adding a new page means
adding a matching `init<PageName>Page()` function to `page-init.ts` and a case in
`Base.astro`'s dispatch, not a `<script>` tag on the page itself.

The motion array passed to `initPageEngine` (inside that function) must match the
`chapters` order in `page-system/config.ts`. `PAGE` (the resolved page script, built with
`definePageScript`/`at()` in that page's own `motion-script.ts`, e.g.
`src/pages/home/motion-script.ts`) is what actually places each chapter's dwell window and
its enter/exit motion on the scroll timeline — see `docs/motion.md`.

---

## A chapter folder

```
src/pages/<page>/_chapters/<NN-name>/
  Content.astro       ← the markup (imports Chapter.astro and uses its slots)
  motion-script.ts    ← its beats() timeline and event schedule, if any
```

The `_chapters` directory is underscore-prefixed so Astro's file-based router ignores it —
without that, `Content.astro` would otherwise become its own accidental public route.
Folder names carry a numeric ordering prefix (`01-intro`, `02-services`, …) purely for
at-a-glance ordering in the file tree; the real order chapters run in is still the list in
`page-system/config.ts` — renumbering a folder is cosmetic and doesn't reorder anything by
itself.

---

## The content shape: `Content.astro`

`Chapter.astro` is a neutral `[data-chapter]` marker — the transform target the scroll
engine sequences. It requires an `id` prop (matched by the scroll engine via
`[data-chapter]`) and renders a single default slot; it knows nothing about what a
"paper" is. Compose `Paper.astro` inside it when a chapter should render as a card.

### Standard chapter (with paper)

`Paper.astro` renders the foreground white card: the shadow, the width, and three
**optional** named slots:

- `header` — e.g. a title or eyebrow
- `main` — the body. Accepts arbitrary markup.
- `footer` — e.g. a caption, small action, or flourish

```astro
---
import Chapter from "@components/Chapter.astro";
import Paper from "@components/Paper.astro";
import StageLeft from "@layouts/StageLeft.astro";
---

<StageLeft>
  <Chapter id="intro">
    <Paper>
      <Fragment slot="main">
        <p>Dear ______,</p>
        <p>Thank you for your interest …</p>
      </Fragment>
    </Paper>
  </Chapter>
</StageLeft>
```

### Paperless chapter (no `Paper`)

Skip `Paper` to render no white card or shadow. Content sits directly on the
midground, straight in `Chapter`'s default slot. Use this for full-bleed, atmospheric
chapters.

```astro
<StageCenter>
  <Chapter id="my-chapter">
    <div>
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
// src/pages/home/motion-script.ts
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

### 2. Build the beats timeline in `motion-script.ts`

```ts
import gsap from "gsap";
import type { ChapterMotion } from "@components/scroll-engine/motion-script";
import {
  fadeInUpFrom,
  fadeInUpTo,
  shiftUp,
} from "@components/motion-presets/motion-script";

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

The chapter's _own_ `motion-script.ts` only builds the timeline — how long its dwell
window is on the page is set where it's placed in the page script:

```ts
// src/pages/home/motion-script.ts
at(0, chapter("my-chapter", { dwellBeats: 1.5 })),
```

The engine wraps the returned `beats()` timeline in a scrubbed ScrollTrigger for that
window. You do not add `scrollTrigger` to the timeline itself.

### Reduced motion

The engine calls `tl.progress(1)` in the reduced-motion branch, jumping all beats
to their final visible state. No additional work needed in `motion-script.ts`.

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
