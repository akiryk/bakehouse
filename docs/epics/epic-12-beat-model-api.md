# Epic 12 — Public beat-model API

**Goal:** expose the app's timing as a **public, read-only model** that any consumer reads
from — so no consumer ever recomputes timing or reaches into engine internals. Epic 11 landed,
so the beat unit is now uniform and this can be concrete.

**In scope:** a canonical `BeatModel` built as a normal part of engine operation; a general
`ChapterMotion.schedule` field the script populates; migrating the `?beats` HUD/table to read
the model.

**Out of scope:** the devtool ruler (Epic 13). Nothing in this epic is devtool-specific — the
model must be equally useful to the HUD, a test, or a future consumer.

**Don't touch:** the ruler; the `sinceStart`/`sinceEnd` authoring vocabulary; the scroll
geometry math (Epic 11 owns it — this epic *exposes* it, doesn't change it).

---

## Why

After Epic 11 the engine's `computeSlots` produces the one true timing, but it's a local
variable inside `initScrollEngine`. Two things read timing today and both are ad-hoc: the
`?beats` HUD/table in `timeline-kit` (chapter-local, knows nothing of inter-chapter position)
and the dev ruler (handed a hand-built `slots` array). This epic makes timing a **named,
exported model** so every consumer reads the same thing.

## The shape (concrete now that Epic 11 exists)

```ts
export interface ScheduledEvent {
  startBeat: number;   // chapter-relative
  endBeat: number;     // chapter-relative
  label: string;       // e.g. "show intro", "hide intro", "stop @ 2002"
}

export interface ChapterBeats {
  id: string;          // config.chapters[i].id
  index: number;       // array position, for stable identification
  startBeat: number;   // chapter-relative beat 0 (always 0; kept explicit)
  endBeat: number;     // end of the scripted beats window, in beats
  exitBeat: number;    // end of the fly-away, in beats (endBeat if no exit)
  schedule: ScheduledEvent[];  // resolved moments; [] for scriptless chapters
}

export interface BeatModel {
  vhPerBeat: number;
  minBeatPx: number;
  beatPx(win: { innerHeight: number }): number;  // the Epic 11 helper
  chapters: ChapterBeats[];
}
```

All beat fields are **chapter-relative** (each chapter starts at 0) — this is what the ruler
needs for "reset to 0 at each chapter" and what makes the numbers match `script.ts`. The
engine still owns absolute vh offsets for its ScrollTriggers; the model is the *beat* view.

## The schedule path (requirement #3 — the important rule)

The per-chapter event list must reach the model **without any script knowing a consumer
exists.** The mechanism mirrors how `totalBeats` already flows:

- `timeline-kit` already resolves every moment to `{ start, dur }` in `resolveScript` and can
  already label them (`describeMoment`). Add a pure exported function that returns the
  schedule from a script — e.g. `resolveSchedule(script): ScheduledEvent[]` — reusing the
  existing walk. No new timing logic; it's the same `placed` array, shaped for output.
- `ChapterMotion` gains an optional `schedule?: ScheduledEvent[]` field (sibling to `beats`
  and `beatDurationVH`). A chapter's `motion.ts` populates it: `schedule: resolveSchedule(SCRIPT)`.
- The engine reads `motion.schedule` generically when assembling `ChapterBeats`. It never
  reaches into `script.ts`, and `script.ts` never mentions the model, the HUD, or the ruler.

Scriptless chapters (chapter 1) simply omit `schedule`; their `ChapterBeats.schedule` is `[]`
and `exitBeat > endBeat` carries the fly-away.

## Steps

1. **Types + `resolveSchedule`.** Add the interfaces above (in a core module, e.g.
   `motion/beat-model.ts`); add `resolveSchedule(script)` to `timeline-kit` reusing the
   existing walk + `describeMoment`. *Verify:* `resolveSchedule(SCRIPT)` for chapter 2 lists
   show/hide/enterTape/stop/travel with correct chapter-relative start/end beats — matches the
   `?beats` console table.
2. **`ChapterMotion.schedule` + populate.** Add the field; set `schedule: resolveSchedule(SCRIPT)`
   in chapter 2's `motion.ts`. *Verify:* chapter 1 (no schedule) still builds; chapter 2's
   field is populated.
3. **Engine builds the model.** Have the engine assemble `BeatModel` from slots + each
   `motion.schedule`, converting absolute slot beats to chapter-relative. Expose it (return it
   from `initScrollEngine`, or a module-level getter — decide during impl, but it must be
   readable without recomputing). *Verify:* the model's chapter beats match the slot math.
4. **Migrate `?beats` to the model.** Point the HUD/table at `BeatModel` instead of the
   script-local walk, proving the API is real by making the existing tool its first consumer.
   *Verify:* `?beats` output is unchanged from the user's perspective.

## Done when

A single exported `BeatModel` is the only timing source of truth; each chapter exposes its
schedule via a general `ChapterMotion.schedule` field with zero knowledge of who consumes it;
and the `?beats` tooling reads from the model rather than recomputing. The ruler (Epic 13) can
now be built as a pure consumer.
