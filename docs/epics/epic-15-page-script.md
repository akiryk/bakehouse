# Epic 15 — The page script: one motion language at both levels

**Goal:** replace the engine's mechanical slot tiling with an **authored page-level script** —
same vocabulary, same compiler, same beat unit as chapter scripts — so inter-chapter motion
(enters, exits, overlaps, gaps, color morphs) is written the same way intra-chapter motion is.
Chapters become placeable moments on one master timeline scrubbed by one ScrollTrigger.

**Depends on:** Epic 14 (`at()` — the page script authors in absolute beats).

**In scope:** `pages/home.script.ts`; page-scope verbs; master-timeline compilation; retiring
`computeSlots`' fixed geometry and the `EnterSpec` bolt-on; migration reproducing today's
behavior exactly; beat-model/ruler updates to represent both scopes.

**Out of scope:** any change to chapter-internal authoring (chapter scripts are untouched);
reduced-motion redesign (keep the current collapse behavior); the phone breakpoint.

---

## Why (the architectural finding)

The slot model tiles non-overlapping rectangles per chapter. Freedom the author needs —
configurable enter/exit durations, gaps, deliberate overlap between chapters — is structurally
impossible inside it, and the recent `EnterSpec.delay` bug (an enter pushed out of its
borrowed window into the next chapter's fly range, two tweens fighting over one `y`) is the
model's signature failure: sequencing knowledge smeared across chapter configs with pairwise
coupling. GSAP itself imposes none of this. The fix is to make inter-chapter sequencing
*authored*, in the vocabulary that already works, and let geometry derive from the script.

**The two-level model (decided):** page scope and chapter scope stay distinct — this is
GSAP's canonical master/child nested-timeline pattern, not a workaround. Chapter scripts stay
in chapter-relative beats (their beat 0 is the feature: repositioning a chapter in the page
script is one edit, and the chapter's internal storyboard rides along). The page script is
the only place that knows where chapters sit.

**The scope rule (the quagmire fence):** a chapter script may reference only chapter time.
Cross-chapter or cross-scope choreography is expressed in the page script, which may also
animate individual elements when they're page-scale concerns. Visibility is one-way: parent
places children; children never reach out.

## Authoring surface

`src/pages/home.script.ts` (per-page file), authored with the same `defineScript`-style
wrapper and the Epic 14 `at()` entries. Draft vocabulary — **review before implementation**:

```ts
export const PAGE = definePageScript({
  sequence: [
    // Chapters as placeable moments. Duration defaults to the chapter's own
    // totalBeats (scriptless chapters default to durationBeats ?? 0).
    at(0,    chapter("intro")),                        // dwell 0 beats (current config)
    at(0,    exit("intro",   { over: 1, ease: "power2.in" })),   // fly-away
    at(0.5,  enter("services", { over: 1, from: { y: "120vh" }, ease: "power2.out" })),
    at(0.5,  morph({ from: "--midground-tan", to: "--midground-slate", over: 1 })),
    at(1.5,  chapter("services")),
    // ...
    at(N,    hold(1)),                                  // endRest, now explicit
  ],
});
```

- **`chapter(id, { dwellBeats? })`** — places a chapter's dwell window at a page beat. Its
  duration defaults to the chapter's compiled `totalBeats` (via the existing
  `ChapterMotion` / schedule mechanism — the page script does NOT import chapter scripts;
  the engine supplies each chapter's length the same general way it supplies schedules today).
  During the dwell window the chapter's child timeline is scrubbed.
- **`enter(id, { over, from, ease })` / `exit(id, { over, to?, ease })`** — chapter-scale
  element motion for the paper/container. `exit` defaults to the flyUp preset (replaces
  `ChapterMotion.paper`); `enter` replaces `EnterSpec` entirely. Because these are ordinary
  absolutely-placed moments, overlap between one chapter's exit and the next's enter is just
  two `at()` entries whose ranges intersect — no special field.
- **`morph({ from, to, over })`** — the midground color morph, now placed explicitly instead
  of implicitly spanning each fly window. (Reuses the existing morph moment from timeline-kit.)
- **`hold(beats)`** — dead air; replaces `endRestBeats` as an explicit trailing entry.
- **Element verbs at page scope** — `show`/`hide`/etc. are legal in the page script targeting
  `[data-el]` elements, for cross-chapter choreography. Same factories, no new code.
- The page script is authored in `at()` exclusively. (The deprecated relative entries would
  technically compile — same walk — but they are not part of this authoring surface.)

## Compilation model

One master GSAP timeline in **page-absolute beats**, scrubbed by **one ScrollTrigger** over a
spacer of `totalPageBeats × vhPerBeat` (converted to px with the established arrow-function
pattern — GSAP drops "vh" strings; never reintroduce them).

- `chapter(id)` compiles to `master.add(childTimeline, atBeat)` — the child is the chapter's
  existing compiled beats timeline, unchanged, in chapter-relative beats.
- `enter`/`exit`/`morph`/element verbs compile to tweens placed absolutely on the master —
  the *implementations* largely already exist in `engine.ts` (fly-away tween, fromTo enter,
  interpolate-proxy morph); they move from loop-generated to script-generated.
- One ScrollTrigger scrubbing one master replaces today's N independent triggers. This
  removes the entire class of per-trigger misalignment bugs by construction.
- `computeSlots` is retired. Geometry (spacer height, each chapter's scroll range, the
  BeatModel's `scrollVH`) is **derived from the resolved page script** — the resolver's
  placed entries are the slots.
- `ChapterMotion` slims down: `paper`, `enter`, `durationBeats` retire (all expressed in the
  page script); `beats` and `schedule` remain (chapter-internal, unchanged).
- Reduced-motion: unchanged behavior — jump children to progress(1), static page.

## Beat model & devtools

- `BeatModel` gains the page scope: `pageSchedule: ScheduledEvent[]` (the resolved page
  script) alongside the existing per-chapter entries; `ChapterBeats.scrollVH` now derives
  from the chapter's placed position. Chapter-relative beats inside `ChapterBeats` are
  unchanged.
- Ruler: page-level events render in the event lane alongside (or in a third narrow lane
  beside) chapter events; numbered bars can now show page-absolute beats with chapter-relative
  numbering retained per chapter band. Keep this step small — the ruler already consumes the
  model; it's additive.
- The `?beats` HUD should display page beat + active chapter + chapter-relative beat.

## Migration (the safety rail)

Step one of implementation is a page script that reproduces **today's exact behavior**:
intro (dwell 0, exit over `chapterExitBeats`), services enter over the same window, morph
across the same range, chapter 2 dwell = its totalBeats, trailing rest 1 beat. The done-when
for the migration step is the ruler/schedule and the scroll feel being indistinguishable from
pre-epic. Only after that lands does exploration start.

## Steps

1. **Vocabulary + resolver.** `definePageScript`, the `chapter/enter/exit` factories (morph/
   hold/show/hide reused), page-script resolution to placed entries. *Verify:* resolved page
   schedule prints via a `?beats`-style table.
2. **Master compilation.** Compile placed entries to the master timeline; child timelines
   added at their beats; single ScrollTrigger + spacer from script-derived total. *Verify:*
   the migration script (step 4's content, written now) drives the page.
3. **Geometry from script.** Retire `computeSlots`; BeatModel/scrollVH derive from the
   resolved script; slim `ChapterMotion`. *Verify:* model numbers match the resolved script.
4. **Migration parity.** The reproduction page script is the live one. *Verify:* scroll feel,
   ruler spans, and schedule identical to pre-epic recordings/screenshots.
5. **Devtools.** Page lane in the ruler; HUD shows page beat + chapter + chapter beat.
   *Verify:* watching the ruler, a page-level `exit("intro")` span crosses the now-line
   exactly as the intro paper flies.

## Done when

Inter-chapter motion is authored in `home.script.ts` with the same vocabulary as chapter
scripts; one master timeline + one ScrollTrigger drive the page; overlap/gap/duration are
ordinary script edits; `computeSlots`, `EnterSpec`, and `ChapterMotion.paper/enter/
durationBeats` are gone; the migration script reproduces pre-epic behavior exactly; and the
ruler/HUD show both scopes.
