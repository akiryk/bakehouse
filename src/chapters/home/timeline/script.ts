/**
 * Chapter 2 — THE TWEAK FILE.
 *
 * The storyboard is a flat sequence of at(beat, ...moments) entries.
 * `beat` is an absolute position in this script's scope (0 = script start).
 * Moments in the same entry start together.
 *
 * Units: beats. 1 beat = CONFIG.vhPerBeat viewport-heights of scroll.
 * Add ?beats to the URL for the live HUD *and* a console table of the full
 * resolved schedule (absolute start/end of every moment — the ground truth).
 *
 * Editing ripple: use plain TS consts to name anchor points, then reference
 * them across entries so a single change ripples through.
 *
 * Project stops (Epic 18): each of PROJECTS (timeline-content.ts) gets one
 * stopTimelineAt, placed back to back by placeProjectStops() below rather
 * than nine hand-computed beat offsets. Content (year/title/image/size,
 * dwellBeats/dx/dy overrides) lives in timeline-content.ts — this file only
 * decides *where in the sequence* the whole run of stops starts. Year
 * labels (NOTES) live there too, not here — see that file's header.
 */

import {
  defineScript,
  at,
  show,
  hide,
  hold,
  enterTape,
  stopTimelineAt,
  type SequenceEntry,
} from "@motion/timeline-kit";
import {
  PROJECTS,
  DEFAULT_DWELL_BEATS,
  type Project,
} from "./timeline-content";

// ─── Geometry & feel ──────────────────────────────────────────────────────────

export const CONFIG = {
  firstYear: 1993,
  lastYear: 2026,

  /** vh of tape per year — bigger = years further apart, slower ticking */
  pitch: 26,

  /** where the current year sits on screen (0 top … 1 bottom) */
  anchor: 0.5,

  /**
   * How far past the viewport's bottom edge the tape parks before its
   * entrance, in vh — compile() computes the park position as
   * yFor(firstYear) + enterFrom (see its own comment), and yFor(firstYear)
   * === anchor*100 (50 here). The tape is only guaranteed hidden once
   * yFor(firstYear) + enterFrom > 100 (viewport bottom), i.e. enterFrom >
   * 100 - anchor*100 = 50 for this anchor. 55 keeps a 5vh safety margin
   * past that exact threshold — enough to avoid any hairline sliver of
   * 1993 peeking in from rounding, without adding real travel-time lag
   * before the tape becomes visible once its entrance starts (a bigger
   * margin doesn't make hiding "more correct", just slower to arrive).
   * If anchor ever changes, this threshold (100 - anchor*100) does too.
   */
  enterFrom: 55,
};

// ─── Project stops ────────────────────────────────────────────────────────────

/**
 * Beats to ease into a stop that's a different year from wherever the tape
 * currently is — passed explicitly on every generated stopTimelineAt call
 * so this helper's cumulative math can never silently drift from what the
 * compiler actually places. stopTimelineAt's own internal default is also
 * 0.75, but relying on that implicitly would mean two places having to
 * agree by coincidence rather than by construction.
 */
const APPROACH_BEATS = 0.75;

/**
 * Places one stopTimelineAt per project, back to back in chronological
 * order — project N's stop begins right where project N-1's ended (its own
 * approach + dwell). No explicit travel() between stops: stopTimelineAt
 * always eases directly from wherever the tape currently is to its target
 * year over `approach` beats (see timeline-kit.ts's compile()), so chaining
 * stops with no dead scroll between them is enough for a first pass.
 */
function placeProjectStops(
  projects: Project[],
  startBeat: number,
): { entries: SequenceEntry[]; endBeat: number } {
  let beat = startBeat;
  const entries: SequenceEntry[] = [];
  for (const project of projects) {
    const dwell = project.dwellBeats ?? DEFAULT_DWELL_BEATS;
    entries.push(
      at(
        beat,
        stopTimelineAt(project.year, {
          approach: APPROACH_BEATS,
          dwell,
          reveal: [String(project.year)],
          // Exit duration matches the *next* stop's own approach — both
          // start at the same beat (this stop's release), so equal
          // durations keep the card's exit motion and the tape's resumed
          // motion moving at the same rate instead of one outrunning the
          // other. Every project shares APPROACH_BEATS, so this is safe to
          // hardcode to the same constant rather than looking ahead.
          exitOver: APPROACH_BEATS,
        }),
      ),
    );
    beat += APPROACH_BEATS + dwell;
  }
  return { entries, endBeat: beat };
}

/**
 * Entrance choreography: intro -> line -> tape, each starting essentially
 * as soon as the previous one lands, not on independently-guessed beats.
 * INTRO settles, then LINE starts almost immediately after (a hair of a
 * gap so it doesn't read as simultaneous), then the TAPE starts the instant
 * the line finishes rising — no gap at all. Before this, line and tape
 * beats were hand-picked independently and left slack (line settled at 1.5,
 * tape didn't start until 2.0), and — worse — the tape's pre-entrance park
 * position had its own bug letting early years peek through the whole time
 * (see compile()'s park-position comment in timeline-kit.ts) — between the
 * two, numbers were visible well before the line even existed.
 */
const INTRO_SHOW_BEAT = 0;
const INTRO_OVER = 0.5;
const LINE_GAP_AFTER_INTRO = 0.1;
const LINE_SHOW_BEAT = INTRO_SHOW_BEAT + INTRO_OVER + LINE_GAP_AFTER_INTRO;
const LINE_OVER = 0.5;

/**
 * The tape's initial entrance — rises into view and lands on
 * TAPE_ENTER_YEAR, continuous with the rest of the scroll. No dwell/pause
 * here: unlike project stops, which deliberately pause, notes are meant to
 * just go by as the tape travels past them. This used to be a
 * stopTimelineAt(1995, { dwell: 3 }) with no reveal — a genuine pause on a
 * note year, which is exactly what "notes just go by" rules out.
 *
 * Landing year moved from 1995 to 1997 (2 years later, per request) —
 * conveniently the tape now lands right as NOTES[1997] itself is showing,
 * rather than an arbitrary blank year. NOTES[1995] still exists and still
 * appears — it just sweeps past during the rise instead of getting its own
 * stop, same as every other note.
 *
 * Starts the instant the line finishes (LINE_SHOW_BEAT + LINE_OVER, zero
 * gap) — "as soon as the line reaches the top of the browser" per request.
 */
const TAPE_ENTER_BEAT = LINE_SHOW_BEAT + LINE_OVER;
const TAPE_ENTER_YEAR = 1997;
const TAPE_ENTER_OVER = 2;

/** Right where the tape's entrance finishes. */
const PROJECTS_START_BEAT = TAPE_ENTER_BEAT + TAPE_ENTER_OVER;

const { entries: projectStops, endBeat: projectsEndBeat } = placeProjectStops(
  PROJECTS,
  PROJECTS_START_BEAT,
);

// ─── The storyboard ───────────────────────────────────────────────────────────

export const SCRIPT = defineScript({
  config: CONFIG,
  sequence: [
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
        ease: "power2.out",
      }),
    ),

    at(TAPE_ENTER_BEAT, hide("intro", { over: 0.5 })),

    // Tape rises into view and lands on TAPE_ENTER_YEAR — no dwell (see the
    // comment above). fromOffset isn't set here; it falls back to
    // CONFIG.enterFrom (100vh), which is what this already used implicitly.
    // ease: "none" (constant speed, no deceleration into the landing) —
    // same reasoning travel() uses it by default: enterTape here hands off
    // with zero gap straight into the first project's approach (its own
    // power1.out, which decelerates from full speed at ITS start). Without
    // this override, enterTape's default power2.out decelerates the tape
    // to near-zero right at 1997, then the approach immediately re-
    // accelerates — a real stop-then-go on a note year, which "notes just
    // go by" rules out just as much as an authored dwell would.
    at(
      TAPE_ENTER_BEAT,
      enterTape({ at: TAPE_ENTER_YEAR, over: TAPE_ENTER_OVER, ease: "none" }),
    ),

    // One stopTimelineAt per project (see PROJECTS in timeline-content.ts),
    // chronological, back to back — no per-project hand-placed beat.
    ...projectStops,

    // Trailing rest, right after the last project's own stop ends. 2026
    // (Rainday, the last project) matches CONFIG.lastYear exactly, so this
    // is already the tape's true end — no travel() to a later year needed,
    // unlike the old two-example script.
    at(projectsEndBeat, hold(1)),
  ],
});
