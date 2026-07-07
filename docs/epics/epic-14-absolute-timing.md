# Epic 14 — Absolute timing: `at()` in timeline-kit

**Goal:** add absolute-position authoring to the sequencing layer — `at(beat, ...moments)` —
so a storyboard can say directly *when* things happen instead of deriving every start from
the previous entry. This is small, contained, and a prerequisite for Epic 15 (the page-level
script authors in `at()` from day one).

**In scope:** the `at()` entry type in `timeline-kit`, its handling in the sequence walk,
converting chapter 2's script fully to `at()`, and **deprecating** `sinceStart`/`sinceEnd`.

**Out of scope:** the page-level script (Epic 15); any engine or geometry change; physically
deleting `sinceStart`/`sinceEnd` (they stay in the code, deprecated, pending a removal
decision after some real-world authoring in the absolute style — see "Deprecation" below).

**Don't touch:** `engine.ts`, `computeSlots`, the beat model, the ruler, the HUD.

---

## Why

Field experience from authoring chapter 2: relative anchoring (`sinceStart`/`sinceEnd`) still
requires mental arithmetic to hit a specific beat, and "since the previous entry STARTED vs
ENDED" is a recurring memory tax. Absolute positions are how the author actually thinks
("intro fades at beat 2"), and how GSAP itself is professionally authored (absolute positions
and labels on a master timeline). Editing ripple ("change one time, adjust the ones after it")
is accepted by the author and mitigated for free by plain TS consts in the script file —
no feature needed:

```ts
const introIn = 0;
const introOut = introIn + 2;

sequence: [
  at(introIn,  show("intro", { over: 1 })),
  at(0.5,      show("line", { over: 1.5 })),
  at(introOut, hide("intro", { over: 1 })),
]
```

## Design

### The entry

```ts
/** Start these moments at an absolute beat (0 = start of this script's scope). */
export function at(beat: number, ...moments: Moment[]): SequenceEntry;
```

- `SequenceEntry` gains an `anchor: "absolute"` variant (alongside `"start"`/`"end"`), with
  `beat` carried in the existing `gap` field or a new field — implementer's choice, but keep
  the type discriminated and obvious.
- Moments in one `at()` entry start together (same rule as the other entries).
- The entry's end = end of its longest moment (same rule).

### Walk semantics

In `walkSequence`:
- An `at()` entry sets `start = entry.beat` directly — no reference to the cursor.
- It updates `prevStart`/`prevEnd` normally. This means legacy `sinceStart`/`sinceEnd`
  entries still resolve correctly if they appear in a sequence — a compatibility fact, not
  an invitation. New authoring is `at()` only.
- `at()` entries may be listed out of chronological order and must still compile correctly
  (GSAP placement is absolute anyway), but the docs comment should recommend keeping the
  list chronological for readability and for the tape-year caveat below.
- `totalBeats` remains max(entry ends) — already how the walk computes it; `at()` entries
  that extend past the previous max extend the script.
- No changes to `compile()` — it already consumes absolute `{ start, dur }` placements.
- `resolveSchedule` picks the new entries up for free (same walk).

### Deprecation of `sinceStart` / `sinceEnd`

The relative model is what this epic moves away from. It gave real service but in practice
still demanded arithmetic and carried a recurring "since previous STARTED or ENDED?" memory
tax. Treatment:

- Mark both factories `@deprecated` in TSDoc, with a comment:
  `TODO: candidate for removal — kept provisionally in case a use case survives real-world
  authoring in the absolute style. Do not use in new scripts.`
- Remove them from the header doc's SEQUENCING section as an authoring option; document
  `at()` as the model. A one-line note may say deprecated relative entries still compile.
- The deprecation decision gets revisited after Epic 15 (which authors the page script in
  `at()` from day one). If no use case has earned them back by then, a follow-up removes
  them and the legacy `moments`/`withPrevious` walk in one cleanup pass.

### Tape-year caveat

`stopTimelineAt`'s duration depends on the walked `tapeYear` (approach is skipped when the
tape is already at the year). The walk processes entries **in list order**, so an
out-of-chronological-order `at()` sequence can compute a different approach than scroll-order
would imply. Document this in the header comment: *tape state follows list order; keep
tape-moving entries (enterTape / travel / stopTimelineAt) in chronological order.*

## Steps

1. **`at()` + walk.** Add the entry factory and the `"absolute"` branch in `walkSequence`
   (including prevStart/prevEnd update for legacy compatibility). Rewrite the header doc's
   SEQUENCING section around `at()`; add the chronological-order recommendation and the
   tape-year caveat.
   *Verify:* a toy script authored in `at()` prints the expected schedule via the `?beats`
   console table; a legacy `sinceEnd` entry dropped into it still resolves (compatibility
   regression check only).
2. **Deprecate the relative factories.** `@deprecated` TSDoc + TODO comment on `sinceStart`
   and `sinceEnd`; remove them from the authoring docs as an option.
   *Verify:* editors show the strikethrough/deprecation hint at call sites.
3. **Convert chapter 2 — fully.** Rewrite `script.ts`'s sequence entirely in `at()`, using
   the current resolved schedule's absolute starts (the `?beats` table is the source). No
   `since*` entries remain in the file.
   *Verify:* the `?beats` schedule table is **identical** before and after conversion (same
   starts, same ends, same totalBeats). The scroll experience is pixel-identical.
4. **Ruler cross-check.** With the ruler open, confirm event spans sit exactly where they did
   before conversion.

## Done when

`at(beat, ...moments)` is the authoring model and the only style used in chapter 2's script;
the schedule is identical to its relative-form predecessor; `sinceStart`/`sinceEnd` are
formally deprecated (TSDoc + TODO, out of the authoring docs) but still compile, pending a
removal decision after Epic 15.
