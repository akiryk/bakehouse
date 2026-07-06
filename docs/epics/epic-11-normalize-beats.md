# Epic 11 — Normalize the beat + split the motion config

**Goal:** make **one beat unit** that means the same thing everywhere — within a chapter and
between chapters — and separate the app's three motion concerns into clearly-named homes.
This is the foundation Epics 12 and 13 wait on; land it and verify the existing scroll feels
unchanged before touching anything else.

**In scope:** promoting `vhPerBeat` to an app-level unit, expressing inter-chapter pacing in
beats, splitting `config/motion.ts`, and making the engine compute all scroll geometry from
the single beat unit.

**Out of scope:** the public beat-model API (Epic 12), the devtool (Epic 13), authoring
inter-chapter transitions in the `sinceStart`/`sinceEnd` vocabulary (later horizon).

**Don't touch:** the intra-chapter authoring surface (`script.ts` verbs, `timeline-kit`
sequencing) beyond removing `vhPerBeat` from the chapter `CONFIG`; the octagon's motion
*behavior*.

---

## The problem (read once)

There are two timing systems that don't share a unit:

- **Intra-chapter** (`timeline-kit` + `script.ts`): a beat is real — `CONFIG.vhPerBeat = 100`
  — and every moment is placed in beats.
- **Inter-chapter** (`engine.ts`): raw vh constants — `TRAVEL_PER_CHAPTER_VH = 150`,
  `REST_VH = 100`, `DEFAULT_BEAT_VH = 100` — never expressed in beats.

They're equal by coincidence today. Change a chapter's `vhPerBeat` and everything downstream
silently desyncs. `vhPerBeat` is also *misplaced*: it sits in one chapter's `CONFIG`, but it
is the app's fundamental unit of time, not a chapter property.

## The definition (decided)

**One beat = one viewport-height of scroll (100vh), with a pixel floor.** Viewport-relative
is the conventional GSAP idiom and keeps the *feel* stable across window sizes: a half-beat
fade is always half a screenful of scrolling and always occupies the same portion of the
screen, regardless of window height. The floor prevents a beat collapsing on very short
windows:

```
beatPx = max(MIN_BEAT_PX, vhPerBeat/100 * window.innerHeight)   // e.g. MIN_BEAT_PX ≈ 560
```

## The three motion domains (clearly named, clearly separate)

- **`config/scroll.ts`** — THE CLOCK and inter-chapter pacing, all in beats:
  - `vhPerBeat` (the global beat unit; default 100) and `minBeatPx` (the floor).
  - `chapterExitBeats` (was `TRAVEL_PER_CHAPTER_VH`, now in beats: 150vh → 1.5 beats).
  - `endRestBeats` (was `REST_VH`: 1 beat).
  - This is the "what controls pacing between chapters" config that was missing.
- **`config/octagon.ts`** — the background-shape wobble (`OctagonMotion`: `motionRadius`,
  `defaultSpeed`, `edgeCurve`). Moved verbatim out of `config/motion.ts`; behavior unchanged.
- **`chapters/xx/script.ts`** — chapter-scoped storyboard (unchanged), minus `vhPerBeat`.
- **`config/motion.ts` retires** — its mixing of background wobble and scroll `flyUp` under a
  vague name is the ambiguity we're removing. `flyUp` moves to `config/scroll.ts` (it's scroll
  motion); the octagon block moves to `config/octagon.ts`. Update all imports.

Naming rule to record: **`scroll.*` = app-wide scroll/beat motion; `octagon.*` = background
shape; `chapters/*/script.ts` = that chapter only.** A reader should never wonder which scope
a motion value governs.

## Engine changes

- Delete `TRAVEL_PER_CHAPTER_VH`, `DEFAULT_BEAT_VH`, `REST_VH`. Read `vhPerBeat`,
  `chapterExitBeats`, `endRestBeats` from `config/scroll.ts`.
- `computeSlots` works in **beats**, converting to vh/px at the edge via the one
  `beatPx` helper. Every slot boundary (beatStart/End, flyStart/End) is a beat count × the
  beat unit — no independent vh literals anywhere.
- A chapter's beats window length comes from its script's `totalBeats` (already exported);
  its exit is `chapterExitBeats`. Chapter 1 (no scripted beats) has only an exit — that's the
  correct model: **every chapter has an exit in beats; a scripted beats window is optional.**
- Chapters read the global `vhPerBeat` rather than carrying their own. Remove `vhPerBeat` and
  `enterFrom` duplication from chapter `CONFIG` if they're app-global (keep `pitch`, `anchor`,
  `firstYear`, `lastYear` — those are genuinely chapter-specific).

---

## Steps

1. **`config/scroll.ts`.** Create it: `vhPerBeat`, `minBeatPx`, `chapterExitBeats`,
   `endRestBeats`, plus `flyUp` moved from `config/motion.ts`. One `beatPx(win)` helper.
   *Verify:* values resolve; floor applies on a short window.
2. **`config/octagon.ts`.** Move the `OctagonMotion` block out of `config/motion.ts`
   verbatim; update `octagon.ts` import. *Verify:* the wobble is visually identical.
3. **Retire `config/motion.ts`.** Delete it once nothing imports it; fix all import sites.
   *Verify:* build is clean, no dangling imports.
4. **Engine on the beat unit.** Rewrite `computeSlots` in beats; delete the three vh
   constants; source pacing from `config/scroll.ts`. *Verify:* the existing 2-chapter scroll
   feels unchanged — intro dwell, fly-away distance, chapter-2 window all match prior feel at
   the same window size.
5. **De-duplicate the chapter beat.** Remove `vhPerBeat` from chapter `CONFIG`; have the
   chapter/`timeline-kit` read the global. *Verify:* chapter 2 plays identically; changing the
   global `vhPerBeat` now rescales the whole app uniformly (test 100 → 50 and confirm *both*
   inter- and intra-chapter pacing halve together).

## Done when

There is exactly one beat unit, defined in `config/scroll.ts`, and both inter-chapter and
intra-chapter timing derive from it; the three motion domains live in `scroll.ts`,
`octagon.ts`, and per-chapter `script.ts` with names that make scope obvious; `config/motion.ts`
is gone; and changing the global `vhPerBeat` rescales the entire app's scroll pacing uniformly.
