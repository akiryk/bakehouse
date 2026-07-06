# Epic 13 — Isolate & rebuild the beat ruler as a storyboard view

**Goal:** make the beat ruler a **fully isolated, dev-only consumer** that reads only the
Epic 12 `BeatModel` — and rebuild it to lay each chapter's **schedule events as labeled spans**
alongside the numbered beat bars, so you can see the whole storyboard against scroll position.
Epics 11 (uniform beat) and 12 (model API) are complete and verified.

**In scope:** cutting the engine→ruler coupling, relocating the ruler, wiring it dev-only from
the app shell, rebuilding rendering on uniform beats + schedule spans.

**Out of scope:** any timing computation in the ruler — it only reads `BeatModel`. No new core
APIs; Epic 12 already exposes everything needed.

**Don't touch:** the engine's timing math; `script.ts`; the authoring vocabulary.

---

## The requirements this satisfies

- **#1 — never in prod.** Lives under `src/dev/`; loaded only behind `import.meta.env.DEV`
  from the app shell, so Vite tree-shakes it out of prod bundles.
- **#2 — core doesn't know it exists.** The `engine.ts` → `beat-ruler` dynamic import is
  removed. The engine already returns `BeatModel` from `initScrollEngine`; the shell (the
  caller) hands that model to the ruler. Engine contains zero devtool references.
- **#3 — general APIs only.** The ruler imports the `BeatModel` type and reads `window.scrollY`.
  Nothing bespoke is added to core for it.
- **#4 / #6 — see beats *and* events plainly.** Numbered bars give position; labeled spans
  give the storyboard — "show intro" as a band across beats 5–8, "stop @ 2002" across 26–34 —
  so you watch the playhead move through named events as you scroll.

## Wiring (the isolation seam)

The engine already returns the model:

```ts
const model = initScrollEngine(config, motions);   // BeatModel | undefined
if (import.meta.env.DEV && model) {
  import("../dev/beat-ruler").then(({ initBeatRuler }) => initBeatRuler(model));
}
```

This block lives in the **app shell** (wherever `initScrollEngine` is currently called), NOT
in the engine. The engine loses its `import("./beat-ruler")` entirely. `beat-ruler.ts` moves
`motion/` → `src/dev/`. The ruler's only import from core is `import type { BeatModel }`.

## What the ruler draws (the rebuild)

A fixed, full-height, right-edge column, `pointer-events:none`, keyboard-toggled, sliding
against scroll — same chassis as now. Two changes to the content:

**1. Numbered bars are per-chapter and uniform.** Walk `model.chapters`. Each chapter
contributes `endBeat` bars (chapter-relative: 0, 1, 2 …), each exactly `model.beatPx(window)`
tall, zebra-striped. Beat numbers **reset to 0 at each chapter** (they're already
chapter-relative in the model). The current `Math.ceil(flyRange / vhPerBeat)` fallback that
invented ~2 fake bars for chapter 1 is deleted — chapter 1 has `endBeat: 0`, so it contributes
no numbered bars, only its exit region. The `exitBeat − endBeat` range renders as a dim,
unnumbered exit band (chapter 1: a 1.5-beat exit; chapter 2: none, since exit == end).

To place a chapter's bars at the right scroll offset, the ruler needs each chapter's absolute
start. Two clean options — pick one during impl:
  - derive it by accumulating `endBeat + (exitBeat − endBeat)` across preceding chapters
    (the model is ordered and this is pure addition, no re-deriving engine math), or
  - if Epic 12's `ChapterBeats` didn't already carry an absolute offset, this is the moment to
    add a read-only `absoluteStartBeat` to the model (a general field, still not devtool-
    specific). Prefer accumulation if it's clean; add the field only if it isn't.

**2. Schedule events as labeled spans.** For each chapter, for each `event` in
`chapter.schedule`, draw a span positioned from `event.startBeat` to `event.endBeat`
(chapter-relative, offset by the chapter's absolute start), showing `event.label`. Lay these
in a **second lane** beside the numbered bars (numbers in a narrow left lane, event spans in a
wider right lane) so they don't overlap the numerals. A span shorter than its label still
shows the label (let it overflow its band a little; readability over strictness). Zero-length
or instantaneous events (if any) get a minimum height so they're visible.

Column width becomes: numbered-bar lane (probe-measured widest number + 4px each side, as now)
+ event lane (a sensible fixed width, e.g. wide enough for the longest label, probe-measured
the same way, capped). Keep it narrow enough not to dominate the viewport.

Keep everything already working: probe-measured widths, zebra `rgba(0,0,0,0.2)`/`rgba(0,0,0,0.1)`,
`1.125em` sans-serif centered numbers, rAF scroll sync, rebuild-on-resize, keyboard toggle.

## Steps

1. **Move + isolate.** `motion/beat-ruler.ts` → `src/dev/beat-ruler.ts`. Change its signature
   to `initBeatRuler(model: BeatModel)`. Remove the engine's dynamic import; add the DEV-gated
   import in the app shell. *Verify:* build clean; engine has no ruler reference; toggle still
   opens/closes the (old-render) overlay in dev.
2. **Rebuild numbered bars from the model.** Per-chapter, chapter-relative, uniform `beatPx`
   height, exit bands for `exitBeat − endBeat`. Delete the fake-bar fallback. *Verify:*
   chapter 1 shows only a dim exit band (no numbers); chapter 2 shows bars 0…N resetting at its
   start; a bar is exactly one screenful tall.
3. **Add event-span lane.** Draw `chapter.schedule` events as labeled spans in the second lane
   at their beat offsets. *Verify against the console model:* "show intro" spans 5→8,
   "show line" 13→14.5, "stop @ 2002" 26→34, "hold" 42.5→43.5 — matching
   `__beatModel.chapters[1].schedule`. As you scroll, the viewport line crosses each span
   exactly when that element animates on screen.

## Done when

The engine has no reference to the ruler; the ruler lives in `src/dev/`, loads only under
`import.meta.env.DEV`, imports only `BeatModel` + reads `scrollY`; it renders uniform
per-chapter numbered beat bars (resetting at each chapter, with dim exit bands) plus a lane of
labeled schedule-event spans that line up with the console model; and prod bundles contain
none of its code.
