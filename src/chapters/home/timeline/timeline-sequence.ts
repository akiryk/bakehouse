/**
 * Chapter 2's storyboard — the flat sequence of at(beat, ...moments)
 * entries that drives the timeline chapter. Imported by script.ts and
 * passed straight to defineScript({ config: CONFIG, sequence: SEQUENCE }).
 *
 * `beat` is an absolute position in this script's scope (0 = script start).
 * Moments in the same entry start together. Units: beats — 1 beat =
 * CONFIG.vhPerBeat viewport-heights of scroll (CONFIG lives in script.ts,
 * next to this file). Add ?beats to the URL for the live HUD and a console
 * table of the full resolved schedule — the ground truth while tuning.
 *
 * To change how a *specific* project feels — how fast it enters, what
 * easing it uses, how far down the page it rises from, how long it
 * dwells, how it exits — edit that project's own entry in
 * timeline-content.ts. Nothing here needs to change for that: the
 * per-project loop below just reads whatever each Project object
 * provides, falling back to the same defaults it always used if a project
 * doesn't override them. Only touch this file to change the entrance
 * choreography (intro/line/tape) or how project stops are placed relative
 * to each other.
 */

import {
  at,
  show,
  hide,
  hold,
  enterTape,
  stopTimelineAt,
  type SequenceEntry,
} from "@motion/timeline-kit";
import { PROJECTS, DEFAULT_DWELL_BEATS } from "./timeline-content";

// ─── Entrance timing: intro -> line -> tape ────────────────────────────────
// Each starts essentially as soon as the previous one lands, not on
// independently-guessed beats — line starts almost immediately after intro
// settles (a hair of a gap so it doesn't read as simultaneous), and the
// tape starts the instant the line finishes rising, zero gap ("as soon as
// the line reaches the top of the browser").
export const INTRO_SHOW_BEAT = 0;
export const INTRO_OVER = 0.5;
export const LINE_GAP_AFTER_INTRO = 0.1;
export const LINE_SHOW_BEAT =
  INTRO_SHOW_BEAT + INTRO_OVER + LINE_GAP_AFTER_INTRO;
export const LINE_OVER = 0.5;

/**
 * The tape's initial entrance — rises into view and lands on
 * TAPE_ENTER_YEAR, continuous with the rest of the scroll: no dwell/pause
 * on arrival, unlike project stops, which deliberately pause (see the
 * ease: "none" comment below for why). Starts the instant the line
 * finishes (LINE_SHOW_BEAT + LINE_OVER, zero gap).
 *
 * TAPE_ENTER_YEAR currently matches CONFIG.firstYear (script.ts) — the
 * tape simply enters on its own first year. Kept as its own constant
 * rather than importing CONFIG here to avoid a circular import
 * (script.ts imports SEQUENCE from this file); if you want the tape to
 * land somewhere other than the first year, this is safe to change
 * independently.
 */
export const TAPE_ENTER_BEAT = LINE_SHOW_BEAT + LINE_OVER;
export const TAPE_ENTER_YEAR = 1997;
export const TAPE_ENTER_OVER = 2;

// ─── Project stop timing ────────────────────────────────────────────────────

/**
 * Beats to ease into a stop that's a different year from wherever the tape
 * currently is — passed explicitly on every generated stopTimelineAt call
 * so the cumulative math below can never silently drift from what the
 * compiler actually places. stopTimelineAt's own internal default is also
 * 0.75, but relying on that implicitly would mean two places having to
 * agree by coincidence rather than by construction. Also doubles as every
 * project's default exit duration below — that's what keeps a card's exit
 * moving at the same rate the tape resumes at (see timeline-kit.ts's
 * compile(), the release-tween comment).
 */
export const APPROACH_BEATS = 0.75;

/** Right where the tape's entrance finishes. */
export const PROJECTS_START_BEAT = TAPE_ENTER_BEAT + TAPE_ENTER_OVER;

// ─── Project stops — the real array, not hidden behind a helper ───────────
// One stopTimelineAt per project, placed back to back in chronological
// order: project N's stop begins right where project N-1's ended (its own
// approach + dwell). Beat placement is computed here — not hand-typed
// numbers — so inserting, removing, or changing one project's dwellBeats
// automatically ripples through every later project's position instead of
// requiring everyone downstream to be re-typed by hand. No explicit
// travel() between stops: stopTimelineAt always eases directly from
// wherever the tape currently is to its target year over `approach` beats,
// so chaining stops with no dead scroll between them is enough.
//
// Every per-project override (enterOver/enterEase/enterFrom/exitOver/
// exitEase/dwellBeats) is read straight off that project's own object in
// timeline-content.ts — this loop only ever decides *when in the
// sequence* each stop starts, never *how it looks or feels*.
const projectEntries: SequenceEntry[] = [];
let beat = PROJECTS_START_BEAT;
for (const project of PROJECTS) {
  const dwell = project.dwellBeats ?? DEFAULT_DWELL_BEATS;
  projectEntries.push(
    at(
      beat,
      stopTimelineAt(project.year, {
        approach: APPROACH_BEATS,
        dwell,
        exitOver: project.exitOver ?? APPROACH_BEATS,
        exitEase: project.exitEase,
        reveal: [
          {
            id: String(project.year),
            over: project.enterOver,
            ease: project.enterEase,
            from:
              project.enterFrom !== undefined
                ? { opacity: 0, y: project.enterFrom }
                : undefined,
          },
        ],
      }),
    ),
  );
  beat += APPROACH_BEATS + dwell;
}

/** Right after the last project's own stop ends. */
export const PROJECTS_END_BEAT = beat;

// ─── The full sequence ──────────────────────────────────────────────────────

export const SEQUENCE: SequenceEntry[] = [
  at(
    INTRO_SHOW_BEAT,
    show("intro", {
      over: INTRO_OVER,
      from: { opacity: 0, y: 300 },
      ease: "sine.out",
    }),
  ),

  at(
    LINE_SHOW_BEAT,
    show("line", {
      over: LINE_OVER,
      from: { opacity: 1, y: "100vh" },
      to: { opacity: 1, y: 0 },
      ease: "sine.out",
    }),
  ),

  // to: { y: -90 } — hide()'s own default (-18px) is a small nudge, not a
  // real "fly up and out" like the product cards get; this is a bigger
  // rise than default but deliberately far short of the cards' -70vh
  // (that distance is calibrated to match the tape's own scroll rate,
  // which doesn't apply to intro — it's not racing anything). Overridden
  // per-call, not by changing hide()'s own default, so any other element
  // that calls hide() later keeps the original small-nudge behavior.
  at(3, hide("intro", { over: 0.5, to: { y: -90 } })),

  // ease: "none" (constant speed, no deceleration into the landing) — the
  // tape hands off with zero gap straight into the first project's
  // approach (its own power1.out, which decelerates from full speed at ITS
  // start). Without this override, enterTape's default power2.out
  // decelerates the tape to near-zero right at TAPE_ENTER_YEAR, then the
  // approach immediately re-accelerates — a real, visible stop-then-go
  // stutter right at the landing, even though nothing is actually
  // authored to dwell there.
  at(
    TAPE_ENTER_BEAT,
    enterTape({ at: TAPE_ENTER_YEAR, over: TAPE_ENTER_OVER, ease: "none" }),
  ),

  // One stopTimelineAt per project (see PROJECTS in timeline-content.ts),
  // chronological, back to back — the real, computed array, built above.
  ...projectEntries,

  // Trailing rest, right after the last project's own stop ends. 2026
  // (Rainday, the last project) matches CONFIG.lastYear exactly, so this
  // is already the tape's true end — no travel() to a later year needed.
  at(PROJECTS_END_BEAT, hold(1)),
];
